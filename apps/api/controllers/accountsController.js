import { Account, JournalEntryLine, JournalEntry } from '../models/index.js';
import { Op } from 'sequelize';
import { sequelize } from '../models/index.js';

export async function list(req, res, next) {
  try {
    const where = {};
    if (req.query.type) where.account_type = req.query.type;
    if (req.query.active !== undefined) where.is_active = req.query.active === 'true';

    const accounts = await Account.findAll({ where, order: [['code', 'ASC']] });
    res.json(accounts);
  } catch (err) { next(err); }
}

export async function create(req, res, next) {
  try {
    const { code, name, account_type, sub_type, borang_b_section, description, parent_id } = req.body;

    const existing = await Account.findOne({ where: { code } });
    if (existing) return res.status(400).json({ error: `Account code "${code}" already exists` });

    const account = await Account.create({
      code, name, account_type, sub_type,
      borang_b_section: borang_b_section || null,
      description: description || null,
      parent_id: parent_id || null,
      is_system: false,
      is_active: true,
    });
    res.status(201).json(account);
  } catch (err) { next(err); }
}

export async function update(req, res, next) {
  try {
    const account = await Account.findByPk(req.params.id);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    // Block changing code/type on system accounts
    if (account.is_system) {
      delete req.body.code;
      delete req.body.account_type;
      delete req.body.sub_type;
    }

    await account.update(req.body);
    res.json(account);
  } catch (err) { next(err); }
}

export async function getLedger(req, res, next) {
  try {
    const account = await Account.findByPk(req.params.id);
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const { from, to } = req.query;
    const dateFilter = {};
    if (from) dateFilter[Op.gte] = from;
    if (to) dateFilter[Op.lte] = to;

    const whereJE = { status: 'posted' };
    if (from || to) whereJE.entry_date = dateFilter;

    const lines = await JournalEntryLine.findAll({
      where: { account_id: account.id },
      include: [{
        model: JournalEntry,
        as: 'journalEntry',
        where: whereJE,
        attributes: ['id', 'entry_date', 'reference_number', 'description', 'source_type'],
      }],
      order: [[{ model: JournalEntry, as: 'journalEntry' }, 'entry_date', 'ASC'], ['id', 'ASC']],
    });

    // Compute running balance
    const isDebitNormal = ['asset', 'expense'].includes(account.account_type);
    let runningBalance = 0;
    const ledger = lines.map(line => {
      const debit = parseFloat(line.debit);
      const credit = parseFloat(line.credit);
      runningBalance += isDebitNormal ? (debit - credit) : (credit - debit);
      return {
        id: line.id,
        entry_date: line.journalEntry.entry_date,
        reference_number: line.journalEntry.reference_number,
        journal_entry_id: line.journalEntry.id,
        description: line.description || line.journalEntry.description,
        source_type: line.journalEntry.source_type,
        debit,
        credit,
        balance: runningBalance,
      };
    });

    res.json({ account, ledger });
  } catch (err) { next(err); }
}
