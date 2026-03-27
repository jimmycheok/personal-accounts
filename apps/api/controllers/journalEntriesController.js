import { JournalEntry, JournalEntryLine, Account } from '../models/index.js';
import { Op } from 'sequelize';
import JournalEntryService from '../services/JournalEntryService.js';

export async function list(req, res, next) {
  try {
    const { from, to, source_type, status, page = 1, limit = 50 } = req.query;
    const where = {};
    if (source_type) where.source_type = source_type;
    if (status) where.status = status;
    if (from && to) where.entry_date = { [Op.between]: [from, to] };

    const { count, rows } = await JournalEntry.findAndCountAll({
      where,
      include: [{ model: JournalEntryLine, as: 'lines', attributes: ['debit', 'credit'] }],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [['entry_date', 'DESC'], ['id', 'DESC']],
    });

    const entries = rows.map(e => {
      const json = e.toJSON();
      json.total_debit = json.lines.reduce((s, l) => s + parseFloat(l.debit), 0);
      json.total_credit = json.lines.reduce((s, l) => s + parseFloat(l.credit), 0);
      json.line_count = json.lines.length;
      delete json.lines;
      return json;
    });

    res.json({ entries, total: count, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
}

export async function getById(req, res, next) {
  try {
    const entry = await JournalEntry.findByPk(req.params.id, {
      include: [{
        model: JournalEntryLine,
        as: 'lines',
        include: [{ model: Account, as: 'account', attributes: ['id', 'code', 'name', 'account_type'] }],
      }],
    });
    if (!entry) return res.status(404).json({ error: 'Journal entry not found' });
    res.json(entry);
  } catch (err) { next(err); }
}

export async function create(req, res, next) {
  try {
    const { entry_date, description, source_type, source_id, lines } = req.body;
    if (!entry_date) return res.status(400).json({ error: 'Entry date is required' });
    if (!lines || lines.length < 2) return res.status(400).json({ error: 'At least 2 lines required' });

    const entry = await JournalEntryService.createManualEntry({
      entryDate: entry_date,
      description,
      sourceType: source_type,
      sourceId: source_id,
      lines: lines.map(l => ({
        accountId: l.account_id,
        debit: parseFloat(l.debit || 0),
        credit: parseFloat(l.credit || 0),
        description: l.description,
      })),
    });

    res.status(201).json(await JournalEntry.findByPk(entry.id, {
      include: [{ model: JournalEntryLine, as: 'lines', include: [{ model: Account, as: 'account' }] }],
    }));
  } catch (err) { next(err); }
}

export async function post(req, res, next) {
  try {
    const entry = await JournalEntryService.postEntry(req.params.id);
    res.json(entry);
  } catch (err) { next(err); }
}

export async function remove(req, res, next) {
  try {
    const entry = await JournalEntry.findByPk(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Journal entry not found' });
    if (entry.is_auto) return res.status(400).json({ error: 'Cannot delete auto-generated entries' });
    if (entry.status === 'posted') return res.status(400).json({ error: 'Cannot delete posted entries' });

    await JournalEntryLine.destroy({ where: { journal_entry_id: entry.id } });
    await entry.destroy();
    res.status(204).send();
  } catch (err) { next(err); }
}
