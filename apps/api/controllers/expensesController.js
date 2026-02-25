import multer from 'multer';
import path from 'path';
import { Expense, ExpenseCategory } from '../models/index.js';
import { Op } from 'sequelize';
import OcrService from '../services/OcrService.js';
import StorageService from '../services/StorageService.js';
import { writeAuditLog } from '../middlewares/auditLog.js';
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
      order: [['expense_date', 'DESC']],
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

export async function update(req, res, next) {
  try {
    const expense = await Expense.findByPk(req.params.id);
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    const amountMyr = parseFloat(req.body.amount || expense.amount) * (parseFloat(req.body.exchange_rate || expense.exchange_rate) || 1);
    await expense.update({ ...req.body, amount_myr: amountMyr });
    res.json(expense);
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    const expense = await Expense.findByPk(req.params.id);
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
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
      const buffer = fs.readFileSync(req.file.path);
      const stored = await StorageService.upload(buffer, req.file.originalname, req.file.mimetype, 'receipts');
      storagePath = stored.storagePath;
    }

    // Cleanup temp file
    fs.unlinkSync(req.file.path);

    res.json({ ...result, storagePath, requiresManualInput: result.confidence < 70 });
  } catch (err) {
    if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch {}
    next(err);
  }
}
