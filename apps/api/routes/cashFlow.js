import { Router } from 'express';
import { verifyJwt } from '../middlewares/verifyJwt.js';
import LedgerQueryService from '../services/LedgerQueryService.js';
import CashFlowService from '../services/CashFlowService.js';
import { ymd } from '../services/ledgerAggregation.js';

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

// GET /cash-flow/actual?from=2026-01-01&to=2026-12-31
// Sourced from the general ledger: an inflow is a debit to a cash account and
// an outflow is a credit to one, so invoices, expenses and payment vouchers all
// count. Every month in range is present, zero-filled.
router.get('/actual', async (req, res, next) => {
  try {
    const now = new Date();
    const from = req.query.from || ymd(new Date(now.getFullYear(), 0, 1));
    const to = req.query.to || ymd(new Date(now.getFullYear(), 11, 31));

    const monthly = await LedgerQueryService.getCashFlowByMonth(from, to);

    const totalIncome = monthly.reduce((s, m) => s + m.income, 0);
    const totalExpenses = monthly.reduce((s, m) => s + m.expenses, 0);
    const netCashFlow = totalIncome - totalExpenses;
    const avgMonthlyNet = monthly.length ? netCashFlow / monthly.length : 0;

    res.json({ from, to, monthly, totals: { totalIncome, totalExpenses, netCashFlow, avgMonthlyNet } });
  } catch (err) { next(err); }
});

export default router;
