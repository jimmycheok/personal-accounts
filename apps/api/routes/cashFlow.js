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
// Returns actual cash inflows (paid invoices) and outflows (expenses) grouped by month
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
        order: [['paid_at', 'ASC']],
      }),
      Expense.findAll({
        where: {
          expense_date: { [Op.between]: [from, to] },
        },
        attributes: ['expense_date', 'amount_myr', 'amount'],
        order: [['expense_date', 'ASC']],
      }),
    ]);

    // Group by month (YYYY-MM)
    const monthly = {};

    for (const inv of invoices) {
      const month = new Date(inv.paid_at).toISOString().slice(0, 7);
      if (!monthly[month]) monthly[month] = { month, inflow: 0, outflow: 0, net: 0 };
      monthly[month].inflow += parseFloat(inv.total || 0);
    }

    for (const exp of expenses) {
      const month = exp.expense_date.slice(0, 7);
      if (!monthly[month]) monthly[month] = { month, inflow: 0, outflow: 0, net: 0 };
      monthly[month].outflow += parseFloat(exp.amount_myr || exp.amount || 0);
    }

    const result = Object.values(monthly)
      .map(m => ({ ...m, net: m.inflow - m.outflow }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const totals = result.reduce(
      (acc, m) => ({ inflow: acc.inflow + m.inflow, outflow: acc.outflow + m.outflow, net: acc.net + m.net }),
      { inflow: 0, outflow: 0, net: 0 }
    );

    res.json({ from, to, monthly: result, totals });
  } catch (err) { next(err); }
});

export default router;
