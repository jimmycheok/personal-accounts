import { Router } from 'express';
import { verifyJwt } from '../middlewares/verifyJwt.js';
import { Invoice, InvoiceItem, Expense, ExpenseCategory, Customer, BusinessProfile, Payment, MileageLog } from '../models/index.js';
import { Op } from 'sequelize';
import { stringify as csvStringify } from 'csv-stringify/sync';
import archiver from 'archiver';
import multer from 'multer';
import path from 'path';
import { UPLOAD_DIR } from '../config/storage.js';
import fs from 'fs';
import { sequelize } from '../models/index.js';

const upload = multer({
  dest: path.join(UPLOAD_DIR, 'temp'),
  limits: { fileSize: 100 * 1024 * 1024 },
});

const router = Router();
router.use(verifyJwt);

// GET /export/invoices?from=2025-01-01&to=2025-12-31&format=csv
router.get('/invoices', async (req, res, next) => {
  try {
    const { from, to, status, format = 'csv' } = req.query;
    const where = {};
    if (status) where.status = status;
    if (from && to) where.issue_date = { [Op.between]: [from, to] };

    const invoices = await Invoice.findAll({
      where,
      include: [
        { model: Customer, as: 'customer', attributes: ['name', 'email', 'tin'] },
        { model: InvoiceItem, as: 'items' },
        { model: Payment, as: 'payments' },
      ],
      order: [['issue_date', 'ASC']],
    });

    if (format === 'json') {
      res.setHeader('Content-Disposition', `attachment; filename="invoices-export.json"`);
      res.json(invoices);
      return;
    }

    // CSV export — flatten for spreadsheet
    const rows = invoices.map(inv => ({
      invoice_number: inv.invoice_number,
      issue_date: inv.issue_date,
      due_date: inv.due_date,
      status: inv.status,
      customer_name: inv.customer?.name || '',
      customer_email: inv.customer?.email || '',
      customer_tin: inv.customer?.tin || '',
      currency: inv.currency || 'MYR',
      subtotal: inv.subtotal,
      tax_total: inv.tax_total,
      total: inv.total,
      amount_paid: inv.amount_paid || 0,
      amount_due: inv.amount_due,
      paid_at: inv.paid_at || '',
      notes: inv.notes || '',
    }));

    const csv = csvStringify(rows, { header: true });
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="invoices-export.csv"`,
    });
    res.send(csv);
  } catch (err) { next(err); }
});

// GET /export/expenses?from=2025-01-01&to=2025-12-31&format=csv
router.get('/expenses', async (req, res, next) => {
  try {
    const { from, to, year, format = 'csv' } = req.query;
    const where = {};
    if (from && to) where.expense_date = { [Op.between]: [from, to] };
    if (year) where.tax_year = parseInt(year);

    const expenses = await Expense.findAll({
      where,
      include: [{ model: ExpenseCategory, as: 'category', attributes: ['name', 'borang_b_code'] }],
      order: [['expense_date', 'ASC']],
    });

    if (format === 'json') {
      res.setHeader('Content-Disposition', `attachment; filename="expenses-export.json"`);
      res.json(expenses);
      return;
    }

    const rows = expenses.map(exp => ({
      expense_date: exp.expense_date,
      vendor_name: exp.vendor_name || '',
      description: exp.description || '',
      category: exp.category?.name || '',
      borang_b_code: exp.category?.borang_b_code || '',
      currency: exp.currency || 'MYR',
      amount: exp.amount,
      exchange_rate: exp.exchange_rate || 1,
      amount_myr: exp.amount_myr || exp.amount,
      tax_year: exp.tax_year || '',
      receipt_path: exp.receipt_path || '',
      notes: exp.notes || '',
    }));

    const csv = csvStringify(rows, { header: true });
    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="expenses-export.csv"`,
    });
    res.send(csv);
  } catch (err) { next(err); }
});

// GET /export/full-backup — download a full JSON backup of all data
router.get('/full-backup', async (req, res, next) => {
  try {
    const [
      invoices,
      invoiceItems,
      customers,
      expenses,
      expenseCategories,
      payments,
      mileageLogs,
      businessProfile,
    ] = await Promise.all([
      Invoice.findAll({ include: ['items', 'payments'] }),
      InvoiceItem.findAll(),
      Customer.findAll(),
      Expense.findAll({ include: ['category'] }),
      ExpenseCategory.findAll(),
      Payment.findAll(),
      MileageLog.findAll(),
      BusinessProfile.findOne(),
    ]);

    const backup = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      data: {
        businessProfile,
        customers,
        invoices,
        invoiceItems,
        expenses,
        expenseCategories,
        payments,
        mileageLogs,
      },
    };

    res.set({
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="personal-accountant-backup-${new Date().toISOString().split('T')[0]}.json"`,
    });
    res.json(backup);
  } catch (err) { next(err); }
});

// POST /export/restore — restore from a JSON backup
router.post('/restore', upload.single('backup'), async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    if (!req.file) return res.status(400).json({ error: 'No backup file uploaded' });

    const raw = fs.readFileSync(req.file.path, 'utf8');
    let backup;
    try {
      backup = JSON.parse(raw);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON backup file' });
    } finally {
      try { fs.unlinkSync(req.file.path); } catch {}
    }

    if (!backup.data) return res.status(400).json({ error: 'Invalid backup structure — missing data key' });

    const { data } = backup;
    const results = {};

    // Restore in dependency order
    if (data.businessProfile) {
      const bp = Array.isArray(data.businessProfile) ? data.businessProfile[0] : data.businessProfile;
      if (bp) {
        const existing = await BusinessProfile.findOne({ transaction: t });
        if (existing) {
          await existing.update(bp, { transaction: t });
          results.businessProfile = 'updated';
        } else {
          await BusinessProfile.create(bp, { transaction: t });
          results.businessProfile = 'created';
        }
      }
    }

    if (data.expenseCategories?.length) {
      for (const cat of data.expenseCategories) {
        await ExpenseCategory.upsert(cat, { transaction: t });
      }
      results.expenseCategories = data.expenseCategories.length;
    }

    if (data.customers?.length) {
      for (const customer of data.customers) {
        await Customer.upsert(customer, { transaction: t });
      }
      results.customers = data.customers.length;
    }

    if (data.invoices?.length) {
      for (const inv of data.invoices) {
        const { items, payments, ...invoiceData } = inv;
        await Invoice.upsert(invoiceData, { transaction: t });
      }
      results.invoices = data.invoices.length;
    }

    if (data.invoiceItems?.length) {
      for (const item of data.invoiceItems) {
        await InvoiceItem.upsert(item, { transaction: t });
      }
      results.invoiceItems = data.invoiceItems.length;
    }

    if (data.payments?.length) {
      for (const payment of data.payments) {
        await Payment.upsert(payment, { transaction: t });
      }
      results.payments = data.payments.length;
    }

    if (data.expenses?.length) {
      for (const exp of data.expenses) {
        const { category, ...expData } = exp;
        await Expense.upsert(expData, { transaction: t });
      }
      results.expenses = data.expenses.length;
    }

    if (data.mileageLogs?.length) {
      for (const log of data.mileageLogs) {
        await MileageLog.upsert(log, { transaction: t });
      }
      results.mileageLogs = data.mileageLogs.length;
    }

    await t.commit();
    res.json({ message: 'Restore completed successfully', results, backupDate: backup.exportedAt });
  } catch (err) {
    await t.rollback();
    if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch {}
    next(err);
  }
});

export default router;
