import { Op } from 'sequelize';
import { sequelize, Account, JournalEntry, JournalEntryLine } from '../models/index.js';

class JournalEntryService {

  // ── Reference number generation ──────────────────────────────────────
  async generateReferenceNumber(date, prefix = 'JE') {
    const d = new Date(date);
    const yyyymm = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
    const pattern = `${prefix}-${yyyymm}-%`;

    const last = await JournalEntry.findOne({
      where: { reference_number: { [Op.like]: pattern } },
      order: [['reference_number', 'DESC']],
    });

    let seq = 1;
    if (last) {
      const parts = last.reference_number.split('-');
      seq = parseInt(parts[parts.length - 1], 10) + 1;
    }
    return `${prefix}-${yyyymm}-${String(seq).padStart(4, '0')}`;
  }

  // ── Account lookup cache ─────────────────────────────────────────────
  #accountCache = new Map();

  async getAccountByCode(code) {
    if (this.#accountCache.has(code)) return this.#accountCache.get(code);
    const account = await Account.findOne({ where: { code } });
    if (!account) throw new Error(`Account with code "${code}" not found`);
    this.#accountCache.set(code, account);
    return account;
  }

  async getExpenseAccountBySection(borangBSection) {
    const cacheKey = `bb:${borangBSection}`;
    if (this.#accountCache.has(cacheKey)) return this.#accountCache.get(cacheKey);
    const account = await Account.findOne({ where: { borang_b_section: borangBSection, account_type: 'expense' } });
    if (!account) throw new Error(`No expense account found for Borang B section "${borangBSection}"`);
    this.#accountCache.set(cacheKey, account);
    return account;
  }

  clearCache() {
    this.#accountCache.clear();
  }

  // ── Core entry creation ──────────────────────────────────────────────
  async createAutoEntry({ entryDate, description, lines, sourceType, sourceId }) {
    return this.#createEntry({ entryDate, description, lines, sourceType, sourceId, isAuto: true, status: 'posted' });
  }

  async createManualEntry({ entryDate, description, lines, sourceType, sourceId }) {
    return this.#createEntry({ entryDate, description, lines, sourceType: sourceType || 'manual', sourceId: sourceId || null, isAuto: false, status: 'draft' });
  }

  async #createEntry({ entryDate, description, lines, sourceType, sourceId, isAuto, status }) {
    // Validate balanced entry
    let totalDebit = 0, totalCredit = 0;
    for (const line of lines) {
      totalDebit += parseFloat(line.debit || 0);
      totalCredit += parseFloat(line.credit || 0);
    }
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(`Journal entry is not balanced: debit=${totalDebit.toFixed(2)}, credit=${totalCredit.toFixed(2)}`);
    }

    const t = await sequelize.transaction();
    try {
      const referenceNumber = await this.generateReferenceNumber(entryDate);

      const entry = await JournalEntry.create({
        entry_date: entryDate,
        reference_number: referenceNumber,
        description,
        is_auto: isAuto,
        source_type: sourceType,
        source_id: sourceId,
        status,
        posted_at: status === 'posted' ? new Date() : null,
      }, { transaction: t });

      const lineRows = [];
      for (const line of lines) {
        const account = typeof line.accountCode === 'string'
          ? await this.getAccountByCode(line.accountCode)
          : { id: line.accountId };

        lineRows.push({
          journal_entry_id: entry.id,
          account_id: account.id,
          debit: parseFloat(line.debit || 0),
          credit: parseFloat(line.credit || 0),
          description: line.description || null,
        });
      }

      await JournalEntryLine.bulkCreate(lineRows, { transaction: t });
      await t.commit();

      return entry;
    } catch (err) {
      await t.rollback();
      throw err;
    }
  }

  // ── Post a draft entry ───────────────────────────────────────────────
  async postEntry(id) {
    const entry = await JournalEntry.findByPk(id);
    if (!entry) throw new Error('Journal entry not found');
    if (entry.status === 'posted') throw new Error('Entry is already posted');
    entry.status = 'posted';
    entry.posted_at = new Date();
    await entry.save();
    return entry;
  }

  // ── Delete auto entries for a source ─────────────────────────────────
  async deleteAutoEntriesForSource(sourceType, sourceId) {
    const entries = await JournalEntry.findAll({
      where: { source_type: sourceType, source_id: sourceId, is_auto: true },
    });
    for (const entry of entries) {
      await JournalEntryLine.destroy({ where: { journal_entry_id: entry.id } });
      await entry.destroy();
    }
  }

  // ── Auto-entry trigger methods ───────────────────────────────────────

  async onInvoiceSent(invoice) {
    const total = parseFloat(invoice.total);
    if (total <= 0) return;

    await this.createAutoEntry({
      entryDate: invoice.issue_date,
      description: `Invoice ${invoice.invoice_number} issued`,
      lines: [
        { accountCode: '1100', debit: total, credit: 0, description: 'Accounts Receivable' },
        { accountCode: '4000', debit: 0, credit: total, description: 'Sales Revenue' },
      ],
      sourceType: 'invoice',
      sourceId: invoice.id,
    });
  }

  async onPaymentReceived(payment, invoice) {
    const amount = parseFloat(payment.amount);
    if (amount <= 0) return;

    const bankCode = payment.method === 'cash' ? '1000' : '1010';
    await this.createAutoEntry({
      entryDate: payment.payment_date,
      description: `Payment received for ${invoice.invoice_number}`,
      lines: [
        { accountCode: bankCode, debit: amount, credit: 0, description: `Payment via ${payment.method}` },
        { accountCode: '1100', debit: 0, credit: amount, description: 'Accounts Receivable' },
      ],
      sourceType: 'payment',
      sourceId: payment.id,
    });
  }

  async onExpenseCreated(expense) {
    const amount = parseFloat(expense.amount_myr || expense.amount);
    if (amount <= 0) return;

    // Look up the GL account via the category's borang_b_section
    const category = expense.category || await expense.getCategory();
    if (!category || !category.borang_b_section) {
      // Non-deductible or uncategorised — use Other Expenses (D20)
      const account = await this.getAccountByCode('6999');
      await this.createAutoEntry({
        entryDate: expense.expense_date,
        description: `Expense: ${expense.vendor_name || 'Unknown vendor'}`,
        lines: [
          { accountId: account.id, debit: amount, credit: 0, description: expense.description || expense.vendor_name },
          { accountCode: '1010', debit: 0, credit: amount, description: 'Bank payment' },
        ],
        sourceType: 'expense',
        sourceId: expense.id,
      });
      return;
    }

    const expenseAccount = await this.getExpenseAccountBySection(category.borang_b_section);
    await this.createAutoEntry({
      entryDate: expense.expense_date,
      description: `Expense: ${expense.vendor_name || 'Unknown vendor'}`,
      lines: [
        { accountId: expenseAccount.id, debit: amount, credit: 0, description: expense.description || expense.vendor_name },
        { accountCode: '1010', debit: 0, credit: amount, description: 'Bank payment' },
      ],
      sourceType: 'expense',
      sourceId: expense.id,
    });
  }

  async onCreditNoteSubmitted(creditNote) {
    const amount = parseFloat(creditNote.amount);
    if (amount <= 0) return;

    await this.createAutoEntry({
      entryDate: creditNote.issue_date,
      description: `Credit note ${creditNote.credit_note_number} issued`,
      lines: [
        { accountCode: '4000', debit: amount, credit: 0, description: 'Sales Revenue reversal' },
        { accountCode: '1100', debit: 0, credit: amount, description: 'Accounts Receivable reversal' },
      ],
      sourceType: 'credit_note',
      sourceId: creditNote.id,
    });
  }

  async onInvoiceVoided(invoice) {
    await this.deleteAutoEntriesForSource('invoice', invoice.id);
  }

  async onPaymentDeleted(payment) {
    await this.deleteAutoEntriesForSource('payment', payment.id);
  }

  async onExpenseDeleted(expense) {
    await this.deleteAutoEntriesForSource('expense', expense.id);
  }

  // ── Year-end closing ─────────────────────────────────────────────────
  async yearEndClose(year) {
    // Prevent double-close
    const existing = await JournalEntry.findOne({
      where: { source_type: 'year_end_close', reference_number: { [Op.like]: `YEC-${year}-%` } },
    });
    if (existing) {
      throw new Error(`Year-end closing entries for ${year} already exist (${existing.reference_number})`);
    }

    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;

    // Get all revenue and expense account balances for the year
    const accountBalances = await sequelize.query(`
      SELECT a.id, a.code, a.name, a.account_type, a.sub_type,
             COALESCE(SUM(jel.debit), 0) AS total_debit,
             COALESCE(SUM(jel.credit), 0) AS total_credit
      FROM accounts a
      JOIN journal_entry_lines jel ON jel.account_id = a.id
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE je.status = 'posted'
        AND je.entry_date BETWEEN :yearStart AND :yearEnd
        AND a.account_type IN ('revenue', 'expense')
      GROUP BY a.id
      HAVING COALESCE(SUM(jel.debit), 0) != 0 OR COALESCE(SUM(jel.credit), 0) != 0
    `, {
      replacements: { yearStart, yearEnd },
      type: sequelize.constructor.QueryTypes.SELECT,
    });

    // Get Owner's Drawings balance
    const drawingsBalances = await sequelize.query(`
      SELECT a.id, a.code,
             COALESCE(SUM(jel.debit), 0) AS total_debit,
             COALESCE(SUM(jel.credit), 0) AS total_credit
      FROM accounts a
      JOIN journal_entry_lines jel ON jel.account_id = a.id
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE je.status = 'posted'
        AND je.entry_date BETWEEN :yearStart AND :yearEnd
        AND a.code = '3100'
      GROUP BY a.id
    `, {
      replacements: { yearStart, yearEnd },
      type: sequelize.constructor.QueryTypes.SELECT,
    });

    const retainedEarnings = await this.getAccountByCode('3200');
    const ownerCapital = await this.getAccountByCode('3000');

    const lines = [];
    let revenueClosed = 0;
    let expensesClosed = 0;

    // Close revenue accounts: DR Revenue, CR Retained Earnings
    for (const acct of accountBalances.filter(a => a.account_type === 'revenue')) {
      const balance = parseFloat(acct.total_credit) - parseFloat(acct.total_debit);
      if (Math.abs(balance) < 0.01) continue;
      revenueClosed += balance;
      lines.push({ accountId: acct.id, debit: balance, credit: 0, description: `Close ${acct.name}` });
    }

    // Close expense accounts: DR Retained Earnings, CR Expense
    for (const acct of accountBalances.filter(a => a.account_type === 'expense')) {
      const balance = parseFloat(acct.total_debit) - parseFloat(acct.total_credit);
      if (Math.abs(balance) < 0.01) continue;
      expensesClosed += balance;
      lines.push({ accountId: acct.id, debit: 0, credit: balance, description: `Close ${acct.name}` });
    }

    // Net to Retained Earnings
    const netProfit = revenueClosed - expensesClosed;
    if (Math.abs(netProfit) >= 0.01) {
      if (netProfit > 0) {
        lines.push({ accountId: retainedEarnings.id, debit: 0, credit: netProfit, description: 'Net profit to Retained Earnings' });
      } else {
        lines.push({ accountId: retainedEarnings.id, debit: Math.abs(netProfit), credit: 0, description: 'Net loss to Retained Earnings' });
      }
    }

    // Close Owner's Drawings to Owner's Capital
    let drawingsClosed = 0;
    if (drawingsBalances.length > 0) {
      const drawingsAcct = drawingsBalances[0];
      const drawingsBalance = parseFloat(drawingsAcct.total_debit) - parseFloat(drawingsAcct.total_credit);
      if (Math.abs(drawingsBalance) >= 0.01) {
        drawingsClosed = drawingsBalance;
        lines.push({ accountId: parseInt(drawingsAcct.id), debit: 0, credit: drawingsBalance, description: "Close Owner's Drawings" });
        lines.push({ accountId: ownerCapital.id, debit: drawingsBalance, credit: 0, description: "Transfer drawings to Owner's Capital" });
      }
    }

    if (lines.length === 0) {
      return { message: 'No balances to close', revenue_closed: 0, expenses_closed: 0, net_profit: 0, drawings_closed: 0 };
    }

    const refNum = `YEC-${year}-0001`;
    const t = await sequelize.transaction();
    try {
      const entry = await JournalEntry.create({
        entry_date: yearEnd,
        reference_number: refNum,
        description: `Year-end closing entries for YA ${year}`,
        is_auto: true,
        source_type: 'year_end_close',
        source_id: null,
        status: 'posted',
        posted_at: new Date(),
      }, { transaction: t });

      const lineRows = lines.map(l => ({
        journal_entry_id: entry.id,
        account_id: l.accountId,
        debit: parseFloat(l.debit || 0),
        credit: parseFloat(l.credit || 0),
        description: l.description,
      }));

      await JournalEntryLine.bulkCreate(lineRows, { transaction: t });
      await t.commit();

      return {
        journal_entry_id: entry.id,
        reference_number: refNum,
        revenue_closed: revenueClosed,
        expenses_closed: expensesClosed,
        net_profit: netProfit,
        drawings_closed: drawingsClosed,
      };
    } catch (err) {
      await t.rollback();
      throw err;
    }
  }
}

export default new JournalEntryService();
