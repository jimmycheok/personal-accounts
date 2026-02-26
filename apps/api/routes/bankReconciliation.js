import { Router } from 'express';
import { verifyJwt } from '../middlewares/verifyJwt.js';
import { BankStatement, BankStatementRow, Invoice, Expense } from '../models/index.js';
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

// GET /bank-reconciliation — list all bank statements
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const { count, rows } = await BankStatement.findAndCountAll({
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [['createdAt', 'DESC']],
    });
    res.json({ statements: rows, total: count, page: parseInt(page) });
  } catch (err) { next(err); }
});

// POST /bank-reconciliation/import — import CSV bank statement
router.post('/import', upload.single('statement'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No CSV file uploaded' });

    const { bank_name, statement_period_start, statement_period_end, opening_balance = 0, closing_balance = 0 } = req.body;

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

    const statement = await BankStatement.create({
      bank_name: bank_name || 'Bank Account',
      file_name: req.file.originalname || 'statement.csv',
      statement_period_start: statement_period_start || new Date().toISOString().split('T')[0],
      statement_period_end: statement_period_end || null,
      opening_balance: parseFloat(opening_balance),
      closing_balance: parseFloat(closing_balance),
      import_status: 'imported',
      total_rows: 0,
      matched_rows: 0,
    });

    // Normalise common column name variations
    const normalise = (row, keys) => {
      for (const k of keys) {
        const found = Object.keys(row).find(rk => rk.toLowerCase().replace(/[^a-z]/g, '') === k.replace(/[^a-z]/g, ''));
        if (found && row[found] !== undefined && row[found] !== '') return row[found];
      }
      return null;
    };

    const rowData = rows.map(row => {
      const credit = Math.abs(parseFloat(normalise(row, ['credit']) || 0));
      const debit = Math.abs(parseFloat(normalise(row, ['debit']) || 0));
      const rawAmount = parseFloat(normalise(row, ['amount', 'value']) || 0);
      const balanceStr = normalise(row, ['balance', 'runningbalance']);
      const balance = balanceStr !== null ? parseFloat(balanceStr) : null;

      return {
        bank_statement_id: statement.id,
        transaction_date: normalise(row, ['date', 'transactiondate', 'valuedate']) || new Date().toISOString().split('T')[0],
        description: normalise(row, ['description', 'particulars', 'narrative', 'details', 'reference']) || '',
        reference: normalise(row, ['reference', 'ref', 'chequeno']) || null,
        credit: credit > 0 ? credit : (rawAmount > 0 ? rawAmount : null),
        debit: debit > 0 ? debit : (rawAmount < 0 ? Math.abs(rawAmount) : null),
        balance,
        is_reconciled: false,
      };
    }).filter(r => r.description || r.credit || r.debit);

    await BankStatementRow.bulkCreate(rowData);
    await statement.update({ total_rows: rowData.length });

    res.status(201).json({
      statement: await BankStatement.findByPk(statement.id),
      rowCount: rowData.length,
    });
  } catch (err) {
    if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch {}
    next(err);
  }
});

// GET /bank-reconciliation/:id — get statement with rows
router.get('/:id', async (req, res, next) => {
  try {
    const statement = await BankStatement.findByPk(req.params.id, {
      include: [{ model: BankStatementRow, as: 'rows', order: [['transaction_date', 'ASC']] }],
    });
    if (!statement) return res.status(404).json({ error: 'Bank statement not found' });
    res.json(statement);
  } catch (err) { next(err); }
});

// PUT /bank-reconciliation/:id/rows/:rowId — manually match or unmatch a row
router.put('/:id/rows/:rowId', async (req, res, next) => {
  try {
    const row = await BankStatementRow.findOne({
      where: { id: req.params.rowId, bank_statement_id: req.params.id },
    });
    if (!row) return res.status(404).json({ error: 'Row not found' });

    const { matched_type, matched_id, is_reconciled, notes } = req.body;
    await row.update({ matched_type, matched_id, is_reconciled, notes });

    // Update statement matched_rows count
    await syncMatchedCount(req.params.id);

    res.json(row);
  } catch (err) { next(err); }
});

// POST /bank-reconciliation/:id/auto-match
router.post('/:id/auto-match', async (req, res, next) => {
  try {
    const statement = await BankStatement.findByPk(req.params.id);
    if (!statement) return res.status(404).json({ error: 'Bank statement not found' });

    const rows = await BankStatementRow.findAll({
      where: { bank_statement_id: statement.id, is_reconciled: false },
    });

    const [invoices, expenses] = await Promise.all([
      Invoice.findAll({ where: { status: 'paid' } }),
      Expense.findAll(),
    ]);

    let matchCount = 0;

    for (const row of rows) {
      const rowDesc = (row.description || '').toLowerCase();

      // Credits → try to match against paid invoices
      if (row.credit) {
        const amount = parseFloat(row.credit);
        const matched = invoices.find(inv => {
          const diff = Math.abs(parseFloat(inv.total) - amount);
          const numMatch = rowDesc.includes(inv.invoice_number.toLowerCase());
          return diff < 0.01 || numMatch;
        });
        if (matched) {
          await row.update({ matched_type: 'invoice', matched_id: matched.id, is_reconciled: true });
          matchCount++;
          continue;
        }
      }

      // Debits → try to match against expenses
      if (row.debit) {
        const amount = parseFloat(row.debit);
        const matched = expenses.find(exp => {
          const diff = Math.abs(parseFloat(exp.amount_myr || exp.amount) - amount);
          const vendorMatch = exp.vendor_name && rowDesc.includes(exp.vendor_name.toLowerCase());
          return diff < 0.01 || vendorMatch;
        });
        if (matched) {
          await row.update({ matched_type: 'expense', matched_id: matched.id, is_reconciled: true });
          matchCount++;
        }
      }
    }

    await syncMatchedCount(statement.id);
    const updated = await BankStatement.findByPk(statement.id);

    res.json({ autoMatched: matchCount, totalRows: updated.total_rows, matchedRows: updated.matched_rows });
  } catch (err) { next(err); }
});

// DELETE /bank-reconciliation/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const statement = await BankStatement.findByPk(req.params.id);
    if (!statement) return res.status(404).json({ error: 'Bank statement not found' });
    await BankStatementRow.destroy({ where: { bank_statement_id: statement.id } });
    await statement.destroy();
    res.status(204).send();
  } catch (err) { next(err); }
});

async function syncMatchedCount(statementId) {
  const allRows = await BankStatementRow.findAll({ where: { bank_statement_id: statementId } });
  const matchedRows = allRows.filter(r => r.is_reconciled).length;
  const totalRows = allRows.length;
  const import_status = matchedRows === totalRows ? 'reconciled' : matchedRows > 0 ? 'partial' : 'imported';
  await BankStatement.update({ matched_rows: matchedRows, total_rows: totalRows, import_status }, { where: { id: statementId } });
}

export default router;
