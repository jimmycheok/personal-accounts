import { Router } from 'express';
import { verifyJwt } from '../middlewares/verifyJwt.js';
import { Invoice, Expense, ExpenseCategory, MileageLog } from '../models/index.js';
import { Op } from 'sequelize';
import TaxCalculator from '../services/TaxCalculator.js';
import PdfService from '../services/PdfService.js';

const router = Router();
router.use(verifyJwt);

function getYearDates(year) {
  return {
    from: `${year}-01-01`,
    to: `${year}-12-31`,
  };
}

// GET /taxation/summary?year=2025
router.get('/summary', async (req, res, next) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const summary = await TaxCalculator.estimateTax(year);
    res.json(summary);
  } catch (err) { next(err); }
});

// GET /taxation/income-summary?year=2025
router.get('/income-summary', async (req, res, next) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const { from, to } = getYearDates(year);

    const invoices = await Invoice.findAll({
      where: {
        status: 'paid',
        paid_at: { [Op.between]: [new Date(`${from}T00:00:00`), new Date(`${to}T23:59:59`)] },
      },
      attributes: ['id', 'invoice_number', 'total', 'paid_at', 'customer_id'],
      order: [['paid_at', 'ASC']],
    });

    const total = invoices.reduce((sum, inv) => sum + parseFloat(inv.total || 0), 0);

    res.json({
      year,
      totalIncome: total,
      invoiceCount: invoices.length,
      invoices,
    });
  } catch (err) { next(err); }
});

// GET /taxation/expense-summary?year=2025
router.get('/expense-summary', async (req, res, next) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();

    const expenses = await Expense.findAll({
      where: { tax_year: year },
      include: [{ model: ExpenseCategory, as: 'category', attributes: ['id', 'name', 'borang_b_code', 'is_deductible'] }],
      order: [['expense_date', 'ASC']],
    });

    // Group by category
    const byCategory = {};
    let totalExpenses = 0;
    let totalDeductible = 0;

    for (const expense of expenses) {
      const catName = expense.category?.name || 'Uncategorised';
      const catCode = expense.category?.borang_b_code || 'Z1';
      const isDeductible = expense.category?.is_deductible !== false;
      const amount = parseFloat(expense.amount_myr || expense.amount || 0);

      totalExpenses += amount;
      if (isDeductible) totalDeductible += amount;

      if (!byCategory[catName]) {
        byCategory[catName] = { name: catName, borang_b_code: catCode, total: 0, count: 0, isDeductible };
      }
      byCategory[catName].total += amount;
      byCategory[catName].count += 1;
    }

    res.json({
      year,
      totalExpenses,
      totalDeductible,
      nonDeductible: totalExpenses - totalDeductible,
      byCategory: Object.values(byCategory).sort((a, b) => b.total - a.total),
    });
  } catch (err) { next(err); }
});

// GET /taxation/estimate?year=2025
router.get('/estimate', async (req, res, next) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const estimate = await TaxCalculator.estimateTax(year);
    res.json(estimate);
  } catch (err) { next(err); }
});

// GET /taxation/borang-b?year=2025 — structured Borang B data
router.get('/borang-b', async (req, res, next) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const borangB = await TaxCalculator.generateBorangBData(year);
    res.json(borangB);
  } catch (err) { next(err); }
});

// GET /taxation/pdf?year=2025 — tax summary PDF
router.get('/pdf', async (req, res, next) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const summary = await TaxCalculator.estimateTax(year);
    const pdfBuffer = await PdfService.generateTaxSummaryPdf(summary, year);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="tax-summary-${year}.pdf"`,
    });
    res.send(pdfBuffer);
  } catch (err) { next(err); }
});

export default router;
