'use strict';

/**
 * Retroactive journal entry generation.
 * Creates double-entry journal entries for all existing transactions.
 * Uses raw SQL since seeders are CJS and cannot import ESM services.
 */
module.exports = {
  async up(queryInterface) {
    const sq = queryInterface.sequelize;
    const now = new Date();
    let seq = 0;

    function nextRef(date) {
      const d = new Date(date);
      const yyyymm = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
      seq++;
      return `JE-${yyyymm}-${String(seq).padStart(4, '0')}`;
    }

    // Build account code → id lookup
    const [accounts] = await sq.query('SELECT id, code, borang_b_section FROM accounts');
    const codeMap = {};
    const sectionMap = {};
    for (const a of accounts) {
      codeMap[a.code] = a.id;
      if (a.borang_b_section) sectionMap[a.borang_b_section] = a.id;
    }

    const arId = codeMap['1100'];  // Accounts Receivable
    const bankId = codeMap['1010']; // Bank Account
    const revenueId = codeMap['4000']; // Sales Revenue
    const otherExpId = codeMap['6999']; // Other Expenses (fallback)

    // ── 1. Invoices (sent or paid) → DR AR, CR Revenue ──
    const [invoices] = await sq.query(
      `SELECT id, invoice_number, issue_date, total FROM invoices WHERE status IN ('sent', 'paid') ORDER BY issue_date`
    );

    for (const inv of invoices) {
      const total = parseFloat(inv.total);
      if (total <= 0) continue;
      const ref = nextRef(inv.issue_date);

      await sq.query(
        `INSERT INTO journal_entries (entry_date, reference_number, description, is_auto, source_type, source_id, status, posted_at, created_at, updated_at)
         VALUES (:date, :ref, :desc, true, 'invoice', :sid, 'posted', :now, :now, :now)`,
        { replacements: { date: inv.issue_date, ref, desc: `Invoice ${inv.invoice_number} issued`, sid: inv.id, now } }
      );
      const [[je]] = await sq.query(`SELECT id FROM journal_entries WHERE reference_number = :ref`, { replacements: { ref } });

      await sq.query(
        `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description, created_at, updated_at) VALUES
         (:jeId, :arId, :total, 0, 'Accounts Receivable', :now, :now),
         (:jeId, :revId, 0, :total, 'Sales Revenue', :now, :now)`,
        { replacements: { jeId: je.id, arId, revId: revenueId, total, now } }
      );
    }

    // ── 2. Payments → DR Bank, CR AR ──
    const [payments] = await sq.query(
      `SELECT p.id, p.amount, p.payment_date, p.method, i.invoice_number
       FROM payments p JOIN invoices i ON i.id = p.invoice_id ORDER BY p.payment_date`
    );

    for (const pmt of payments) {
      const amount = parseFloat(pmt.amount);
      if (amount <= 0) continue;
      const ref = nextRef(pmt.payment_date);
      const debitAcct = pmt.method === 'cash' ? codeMap['1000'] : bankId;

      await sq.query(
        `INSERT INTO journal_entries (entry_date, reference_number, description, is_auto, source_type, source_id, status, posted_at, created_at, updated_at)
         VALUES (:date, :ref, :desc, true, 'payment', :sid, 'posted', :now, :now, :now)`,
        { replacements: { date: pmt.payment_date, ref, desc: `Payment received for ${pmt.invoice_number}`, sid: pmt.id, now } }
      );
      const [[je]] = await sq.query(`SELECT id FROM journal_entries WHERE reference_number = :ref`, { replacements: { ref } });

      await sq.query(
        `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description, created_at, updated_at) VALUES
         (:jeId, :bankId, :amount, 0, 'Bank receipt', :now, :now),
         (:jeId, :arId, 0, :amount, 'Accounts Receivable', :now, :now)`,
        { replacements: { jeId: je.id, bankId: debitAcct, arId, amount, now } }
      );
    }

    // ── 3. Expenses → DR Expense Account, CR Bank ──
    const [expenses] = await sq.query(
      `SELECT e.id, e.vendor_name, e.expense_date, COALESCE(e.amount_myr, e.amount) AS amount, ec.borang_b_section
       FROM expenses e LEFT JOIN expense_categories ec ON ec.id = e.category_id ORDER BY e.expense_date`
    );

    for (const exp of expenses) {
      const amount = parseFloat(exp.amount);
      if (amount <= 0) continue;
      const ref = nextRef(exp.expense_date);
      const expAcctId = exp.borang_b_section ? (sectionMap[exp.borang_b_section] || otherExpId) : otherExpId;

      await sq.query(
        `INSERT INTO journal_entries (entry_date, reference_number, description, is_auto, source_type, source_id, status, posted_at, created_at, updated_at)
         VALUES (:date, :ref, :desc, true, 'expense', :sid, 'posted', :now, :now, :now)`,
        { replacements: { date: exp.expense_date, ref, desc: `Expense: ${exp.vendor_name || 'Unknown'}`, sid: exp.id, now } }
      );
      const [[je]] = await sq.query(`SELECT id FROM journal_entries WHERE reference_number = :ref`, { replacements: { ref } });

      await sq.query(
        `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description, created_at, updated_at) VALUES
         (:jeId, :expId, :amount, 0, :vendor, :now, :now),
         (:jeId, :bankId, 0, :amount, 'Bank payment', :now, :now)`,
        { replacements: { jeId: je.id, expId: expAcctId, bankId, amount, vendor: exp.vendor_name || 'Expense', now } }
      );
    }

    // ── 4. Credit Notes (submitted/valid) → DR Revenue, CR AR ──
    const [creditNotes] = await sq.query(
      `SELECT id, credit_note_number, issue_date, amount FROM credit_notes WHERE status IN ('submitted', 'valid') ORDER BY issue_date`
    );

    for (const cn of creditNotes) {
      const amount = parseFloat(cn.amount);
      if (amount <= 0) continue;
      const ref = nextRef(cn.issue_date);

      await sq.query(
        `INSERT INTO journal_entries (entry_date, reference_number, description, is_auto, source_type, source_id, status, posted_at, created_at, updated_at)
         VALUES (:date, :ref, :desc, true, 'credit_note', :sid, 'posted', :now, :now, :now)`,
        { replacements: { date: cn.issue_date, ref, desc: `Credit note ${cn.credit_note_number} issued`, sid: cn.id, now } }
      );
      const [[je]] = await sq.query(`SELECT id FROM journal_entries WHERE reference_number = :ref`, { replacements: { ref } });

      await sq.query(
        `INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description, created_at, updated_at) VALUES
         (:jeId, :revId, :amount, 0, 'Sales Revenue reversal', :now, :now),
         (:jeId, :arId, 0, :amount, 'Accounts Receivable reversal', :now, :now)`,
        { replacements: { jeId: je.id, revId: revenueId, arId, amount, now } }
      );
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('journal_entry_lines', null, {});
    await queryInterface.bulkDelete('journal_entries', null, {});
  },
};
