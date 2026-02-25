import { Router } from 'express';
import { verifyJwt } from '../middlewares/verifyJwt.js';
import { BankReconciliation, BankReconciliationRow, Invoice, Expense } from '../models/index.js';
import { Op } from 'sequelize';
import multer from 'multer';
import path from 'path';
import { UPLOAD_DIR } from '../config/storage.js';
import fs from 'fs';
import { parse as parseCsv } from 'csv-parse/sync';

const upload = multer({
  dest: path.join(UPLOAD_DIR, 'temp'),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const router = Router();
router.use(verifyJwt);

// GET /bank-reconciliation — list all reconciliation sessions
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const { count, rows } = await BankReconciliation.findAndCountAll({
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [['createdAt', 'DESC']],
    });
    res.json({ reconciliations: rows, total: count, page: parseInt(page) });
  } catch (err) { next(err); }
});

// POST /bank-reconciliation/import — import CSV bank statement
router.post('/import', upload.single('statement'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No CSV file uploaded' });

    const { account_name, statement_date, opening_balance = 0, closing_balance = 0 } = req.body;

    const csvContent = fs.readFileSync(req.file.path, 'utf8');
    let rows;
    try {
      rows = parseCsv(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch (parseErr) {
      return res.status(400).json({ error: 'Invalid CSV format', details: parseErr.message });
    } finally {
      try { fs.unlinkSync(req.file.path); } catch {}
    }

    // Create reconciliation session
    const reconciliation = await BankReconciliation.create({
      account_name: account_name || 'Bank Account',
      statement_date: statement_date || new Date().toISOString().split('T')[0],
      opening_balance: parseFloat(opening_balance),
      closing_balance: parseFloat(closing_balance),
      status: 'pending',
    });

    // Import rows — attempt to normalise common column name variations
    const normalise = (row, keys) => {
      for (const k of keys) {
        const found = Object.keys(row).find(rk => rk.toLowerCase().replace(/[^a-z]/g, '') === k.replace(/[^a-z]/g, ''));
        if (found && row[found] !== undefined && row[found] !== '') return row[found];
      }
      return null;
    };

    const rowData = rows.map(row => {
      const rawAmount = normalise(row, ['amount', 'credit', 'debit', 'value']) || '0';
      const credit = parseFloat(normalise(row, ['credit']) || 0);
      const debit = parseFloat(normalise(row, ['debit']) || 0);
      const amount = credit > 0 ? credit : debit > 0 ? -debit : parseFloat(rawAmount) || 0;

      return {
        reconciliation_id: reconciliation.id,
        transaction_date: normalise(row, ['date', 'transactiondate', 'valuedate']) || new Date().toISOString().split('T')[0],
        description: normalise(row, ['description', 'particulars', 'narrative', 'details', 'reference']) || '',
        amount,
        transaction_type: amount >= 0 ? 'credit' : 'debit',
        match_status: 'unmatched',
        raw_data: row,
      };
    }).filter(r => r.description || r.amount !== 0);

    await BankReconciliationRow.bulkCreate(rowData);

    res.status(201).json({
      reconciliation: await BankReconciliation.findByPk(reconciliation.id),
      rowCount: rowData.length,
    });
  } catch (err) {
    if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch {}
    next(err);
  }
});

// GET /bank-reconciliation/:id — get session with rows
router.get('/:id', async (req, res, next) => {
  try {
    const rec = await BankReconciliation.findByPk(req.params.id, {
      include: [{ model: BankReconciliationRow, as: 'rows', order: [['transaction_date', 'ASC']] }],
    });
    if (!rec) return res.status(404).json({ error: 'Reconciliation not found' });
    res.json(rec);
  } catch (err) { next(err); }
});

// PUT /bank-reconciliation/:id/rows/:rowId — manually update a row (match or unmatch)
router.put('/:id/rows/:rowId', async (req, res, next) => {
  try {
    const row = await BankReconciliationRow.findOne({
      where: { id: req.params.rowId, reconciliation_id: req.params.id },
    });
    if (!row) return res.status(404).json({ error: 'Row not found' });

    const { match_status, matched_invoice_id, matched_expense_id, notes } = req.body;
    await row.update({ match_status, matched_invoice_id, matched_expense_id, notes });
    res.json(row);
  } catch (err) { next(err); }
});

// POST /bank-reconciliation/:id/auto-match — attempt to auto-match rows against invoices and expenses
router.post('/:id/auto-match', async (req, res, next) => {
  try {
    const rec = await BankReconciliation.findByPk(req.params.id);
    if (!rec) return res.status(404).json({ error: 'Reconciliation not found' });

    const rows = await BankReconciliationRow.findAll({
      where: { reconciliation_id: rec.id, match_status: 'unmatched' },
    });

    const [invoices, expenses] = await Promise.all([
      Invoice.findAll({ where: { status: 'paid' } }),
      Expense.findAll(),
    ]);

    let matchCount = 0;

    for (const row of rows) {
      const absAmount = Math.abs(row.amount);
      const rowDesc = (row.description || '').toLowerCase();

      // Try to match against paid invoices (credits)
      if (row.amount > 0) {
        const matched = invoices.find(inv => {
          const diff = Math.abs(parseFloat(inv.total) - absAmount);
          const numMatch = rowDesc.includes(inv.invoice_number.toLowerCase());
          return diff < 0.01 || numMatch;
        });
        if (matched) {
          await row.update({ match_status: 'matched', matched_invoice_id: matched.id });
          matchCount++;
          continue;
        }
      }

      // Try to match against expenses (debits)
      if (row.amount < 0) {
        const matched = expenses.find(exp => {
          const diff = Math.abs(parseFloat(exp.amount_myr || exp.amount) - absAmount);
          const vendorMatch = exp.vendor_name && rowDesc.includes(exp.vendor_name.toLowerCase());
          return diff < 0.01 || vendorMatch;
        });
        if (matched) {
          await row.update({ match_status: 'matched', matched_expense_id: matched.id });
          matchCount++;
        }
      }
    }

    // Update reconciliation summary
    const allRows = await BankReconciliationRow.findAll({ where: { reconciliation_id: rec.id } });
    const matchedCount = allRows.filter(r => r.match_status === 'matched').length;
    const totalCount = allRows.length;
    await rec.update({
      matched_count: matchedCount,
      unmatched_count: totalCount - matchedCount,
      status: matchedCount === totalCount ? 'completed' : 'pending',
    });

    res.json({ autoMatched: matchCount, totalRows: totalCount, matchedRows: matchedCount });
  } catch (err) { next(err); }
});

// DELETE /bank-reconciliation/:id — delete a session
router.delete('/:id', async (req, res, next) => {
  try {
    const rec = await BankReconciliation.findByPk(req.params.id);
    if (!rec) return res.status(404).json({ error: 'Reconciliation not found' });
    await BankReconciliationRow.destroy({ where: { reconciliation_id: rec.id } });
    await rec.destroy();
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
