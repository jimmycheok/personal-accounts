import { Router } from 'express';
import { verifyJwt } from '../middlewares/verifyJwt.js';
import { Invoice, Expense } from '../models/index.js';
import { Op } from 'sequelize';
import CashFlowService from '../services/CashFlowService.js';

const router = Router();
router.use(verifyJwt);

// GET /cash-flow/projection?months=3
// Returns projected cash flow for the next N months based on outstanding invoices and recurring expenses
router.get('/projection', async (req, res, next) => {
  try {
    const months = parseInt(req.query.months) || 3;
    if (months < 1 || months > 24) return res.status(400).json({ error: 'months must be between 1 and 24' });
    const projection = await CashFlowService.getProjection(months);
    res.json(projection);
  } catch (err) { next(err); }
});

// GET /cash-flow/actual?from=2025-01-01&to=2025-12-31
// Returns actual cash inflows (paid invoices) and outflows (expenses) grouped by month.
// Every month in the from–to range is always present, zero-filled if no data.
router.get('/actual', async (req, res, next) => {
  try {
    const now = new Date();
    const from = req.query.from || new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
    const to = req.query.to || new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];

    const [invoices, expenses] = await Promise.all([
      Invoice.findAll({
        where: {
          status: 'paid',
          paid_at: { [Op.between]: [new Date(`${from}T00:00:00`), new Date(`${to}T23:59:59`)] },
        },
        attributes: ['paid_at', 'total'],
      }),
      Expense.findAll({
        where: { expense_date: { [Op.between]: [from, to] } },
        attributes: ['expense_date', 'amount_myr', 'amount'],
      }),
    ]);

    // Pre-fill every month in the range with zeros so the chart always shows all slots
    const monthly = {};
    const cursor = new Date(`${from.slice(0, 7)}-01`);
    const end = new Date(`${to.slice(0, 7)}-01`);
    while (cursor <= end) {
      const key = cursor.toISOString().slice(0, 7); // YYYY-MM
      const label = cursor.toLocaleString('en-MY', { month: 'short', year: '2-digit' }); // e.g. "Jan 25"
      monthly[key] = { month: label, income: 0, expenses: 0, net: 0 };
      cursor.setMonth(cursor.getMonth() + 1);
    }

    for (const inv of invoices) {
      const key = new Date(inv.paid_at).toISOString().slice(0, 7);
      if (monthly[key]) monthly[key].income += parseFloat(inv.total || 0);
    }

    for (const exp of expenses) {
      const key = exp.expense_date.slice(0, 7);
      if (monthly[key]) monthly[key].expenses += parseFloat(exp.amount_myr || exp.amount || 0);
    }

    const result = Object.keys(monthly)
      .sort()
      .map(k => ({ ...monthly[k], net: monthly[k].income - monthly[k].expenses }));

    const totalIncome = result.reduce((s, m) => s + m.income, 0);
    const totalExpenses = result.reduce((s, m) => s + m.expenses, 0);
    const netCashFlow = totalIncome - totalExpenses;
    const avgMonthlyNet = result.length ? netCashFlow / result.length : 0;

    res.json({ from, to, monthly: result, totals: { totalIncome, totalExpenses, netCashFlow, avgMonthlyNet } });
  } catch (err) { next(err); }
});

export default router;
