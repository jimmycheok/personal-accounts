import multer from 'multer';
import path from 'path';
import { Expense, ExpenseCategory } from '../models/index.js';
import { Op } from 'sequelize';
import OcrService from '../services/OcrService.js';
import StorageService from '../services/StorageService.js';
import { writeAuditLog } from '../middlewares/auditLog.js';
import JournalEntryService from '../services/JournalEntryService.js';
import { UPLOAD_DIR } from '../config/storage.js';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

const upload = multer({
  dest: path.join(UPLOAD_DIR, 'temp'),
  limits: { fileSize: 10 * 1024 * 1024 },
});

export const uploadMiddleware = upload.single('receipt');

export async function list(req, res, next) {
  try {
    const { from, to, categoryId, year, page = 1, limit = 50 } = req.query;
    const where = {};
    if (from && to) where.expense_date = { [Op.between]: [from, to] };
    if (categoryId) where.category_id = categoryId;
    if (year) where.tax_year = year;

    const { count, rows } = await Expense.findAndCountAll({
      where,
      include: [{ model: ExpenseCategory, as: 'category' }],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [['createdAt', 'DESC']],
    });

    res.json({ expenses: rows, total: count, page: parseInt(page) });
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const data = req.body;
    const year = data.expense_date ? new Date(data.expense_date).getFullYear() : new Date().getFullYear();
    const amountMyr = parseFloat(data.amount) * (parseFloat(data.exchange_rate) || 1);

    const expense = await Expense.create({ ...data, tax_year: year, amount_myr: amountMyr });
    // The GL is the source of truth for cash flow, dashboard and tax, so an
    // expense must never exist without an entry. Use the client's reviewed
    // lines when present, otherwise derive them. If the GL post fails, the
    // expense must not survive either — compensate by destroying it so we
    // never leave a record without a matching journal entry.
    try {
      if (data.journal_lines?.length) {
        await JournalEntryService.createAutoEntry({
          entryDate: expense.expense_date,
          description: `Expense: ${expense.vendor_name || 'Unknown vendor'}`,
          lines: data.journal_lines.map(l => ({ accountId: l.account_id, debit: parseFloat(l.debit || 0), credit: parseFloat(l.credit || 0), description: l.description })),
          sourceType: 'expense',
          sourceId: expense.id,
        });
      } else {
        await JournalEntryService.onExpenseCreated(
          await expense.reload({ include: [{ association: 'category' }] }),
        );
      }
    } catch (err) {
      // The original GL error is the real cause and must survive. A failed cleanup
      // is logged loudly instead: that record now has no journal entry and will
      // need the backfill script.
      try {
        await expense.destroy();
      } catch (cleanupErr) {
        console.error(
          `GL rollback failed for expense ${expense.id} — record may have no journal entry:`,
          cleanupErr.message,
        );
      }
      throw err;
    }
    await writeAuditLog({ action: 'create', subjectType: 'Expense', subjectId: expense.id });
    res.status(201).json(expense);
  } catch (err) {
    next(err);
  }
}

export async function getById(req, res, next) {
  try {
    const expense = await Expense.findByPk(req.params.id, { include: ['category'] });
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    res.json(expense);
  } catch (err) {
    next(err);
  }
}

// Fields that change the amount posted to the GL or which account it posts
// to. Editing anything else (notes, vendor_name, etc.) must not churn the
// ledger with a delete + repost.
const GL_MATERIAL_FIELDS = ['amount', 'exchange_rate', 'category_id', 'is_tax_deductible', 'expense_date'];

export async function update(req, res, next) {
  try {
    const expense = await Expense.findByPk(req.params.id, { include: [{ association: 'category' }] });
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    const amountMyr = parseFloat(req.body.amount || expense.amount) * (parseFloat(req.body.exchange_rate || expense.exchange_rate) || 1);

    const isMaterial = GL_MATERIAL_FIELDS.some(
      (field) => field in req.body && String(req.body[field]) !== String(expense[field]),
    );

    // Fix E: compute what account the existing entry *should* use, per the
    // PRE-edit record (category / is_tax_deductible), before the update
    // below mutates them. Comparing this against the entry's actual
    // account afterwards tells a default posting apart from one that was
    // reviewed and customised in GLReviewModal.
    const expectedDebitCodeBefore = isMaterial
      ? (await JournalEntryService.resolveExpenseDebitAccount(expense)).code
      : null;

    await expense.update({ ...req.body, amount_myr: amountMyr });

    // The GL is the source of truth for cash flow, dashboard and tax, so an
    // edit to amount, category, deductibility or date must be reflected
    // there too — otherwise those surfaces keep reporting the pre-edit
    // figures indefinitely. Replace (not adjust) the entry: delete the old
    // auto-entry for this expense, then re-derive from the updated record.
    //
    // Unless the existing entry was posted with non-default accounts (i.e.
    // reviewed/edited in GLReviewModal) — reposting via onExpenseCreated
    // would silently revert those to the computed defaults. Detect that
    // and skip the automatic repost instead, logging loudly for manual
    // review (same ruling as the invoice repost path — see Fix E in
    // final-round-report.md).
    if (isMaterial) {
      const existingCodes = await JournalEntryService.getAutoEntryAccountCodes('expense', expense.id);
      const usesDefaultAccounts =
        existingCodes.length === 0 ||
        existingCodes.every((c) => c === '1010' || c === expectedDebitCodeBefore);

      if (!usesDefaultAccounts) {
        const reason =
          `existing entry uses non-default accounts (${existingCodes.join(', ')}); ` +
          `edit was NOT reflected in the journal entry`;
        console.error(`GL repost skipped for expense ${expense.id}: ${reason}. Needs manual review.`);
      } else {
        try {
          await JournalEntryService.deleteAutoEntriesForSource('expense', expense.id);
          await JournalEntryService.onExpenseCreated(
            await expense.reload({ include: [{ association: 'category' }] }),
          );
        } catch (err) {
          console.error(
            `GL repost failed for expense ${expense.id} after an edit — record may have no journal entry:`,
            err.message,
          );
          throw err;
        }
      }
    }

    res.json(expense);
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    const expense = await Expense.findByPk(req.params.id);
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    await JournalEntryService.deleteAutoEntriesForSource('expense', expense.id);
    await expense.destroy();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function ocrReceipt(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const result = await OcrService.extractReceiptData(req.file.path);

    // Upload to storage if confidence >= 70
    let storagePath = null;
    if (result.confidence >= 70) {
      const buffer = await fs.promises.readFile(req.file.path);
      const stored = await StorageService.upload(buffer, req.file.originalname, req.file.mimetype, 'receipts');
      storagePath = stored.storagePath;
    }

    // Cleanup temp file
    await fs.promises.unlink(req.file.path);

    res.json({ ...result, storagePath, requiresManualInput: result.confidence < 70 });
  } catch (err) {
    if (req.file?.path) try { await fs.promises.unlink(req.file.path); } catch {}
    next(err);
  }
}
