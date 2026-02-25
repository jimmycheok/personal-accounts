import { Op, fn, col, literal } from 'sequelize';
import { Invoice, Expense, Customer, MileageLog } from '../models/index.js';
import TaxCalculator from '../services/TaxCalculator.js';
import CashFlowService from '../services/CashFlowService.js';

function getPeriodDates(period = 'month') {
  const now = new Date();
  if (period === 'month') {
    return [
      new Date(now.getFullYear(), now.getMonth(), 1),
      new Date(now.getFullYear(), now.getMonth() + 1, 0),
    ];
  }
  if (period === 'quarter') {
    const q = Math.floor(now.getMonth() / 3);
    return [new Date(now.getFullYear(), q * 3, 1), new Date(now.getFullYear(), q * 3 + 3, 0)];
  }
  return [new Date(now.getFullYear(), 0, 1), new Date(now.getFullYear(), 11, 31)];
}

export async function overview(req, res, next) {
  try {
    const [from, to] = getPeriodDates(req.query.period);

    const [totalIncome, totalExpenses, totalOutstanding, invoiceCount] = await Promise.all([
      Invoice.sum('total', { where: { status: 'paid', paid_at: { [Op.between]: [from, to] } } }),
      Expense.sum('amount_myr', { where: { expense_date: { [Op.between]: [from.toISOString().split('T')[0], to.toISOString().split('T')[0]] } } }),
      Invoice.sum('amount_due', { where: { status: { [Op.in]: ['sent', 'overdue'] } } }),
      Invoice.count({ where: { issue_date: { [Op.between]: [from.toISOString().split('T')[0], to.toISOString().split('T')[0]] } } }),
    ]);

    res.json({
      totalIncome: totalIncome || 0,
      totalExpenses: totalExpenses || 0,
      netProfit: (totalIncome || 0) - (totalExpenses || 0),
      totalOutstanding: totalOutstanding || 0,
      invoiceCount: invoiceCount || 0,
      period: req.query.period || 'month',
    });
  } catch (err) {
    next(err);
  }
}

export async function outstandingInvoices(req, res, next) {
  try {
    const invoices = await Invoice.findAll({
      where: { status: { [Op.in]: ['sent', 'overdue'] } },
      include: [{ model: Customer, as: 'customer', attributes: ['name'] }],
      order: [['due_date', 'ASC']],
      limit: 20,
    });
    res.json(invoices);
  } catch (err) {
    next(err);
  }
}

export async function recentTransactions(req, res, next) {
  try {
    const [invoices, expenses] = await Promise.all([
      Invoice.findAll({ where: { status: { [Op.ne]: 'draft' } }, order: [['updatedAt', 'DESC']], limit: 10, include: [{ model: Customer, as: 'customer', attributes: ['name'] }] }),
      Expense.findAll({ order: [['expense_date', 'DESC']], limit: 10 }),
    ]);

    const transactions = [
      ...invoices.map(i => ({ type: 'invoice', date: i.issue_date, amount: i.total, description: `Invoice ${i.invoice_number}`, status: i.status, customer: i.customer?.name })),
      ...expenses.map(e => ({ type: 'expense', date: e.expense_date, amount: -parseFloat(e.amount_myr || e.amount), description: e.vendor_name })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 15);

    res.json(transactions);
  } catch (err) {
    next(err);
  }
}

export async function taxEstimate(req, res, next) {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const estimate = await TaxCalculator.estimateTax(year);
    res.json(estimate);
  } catch (err) {
    next(err);
  }
}

export async function upcomingDeadlines(req, res, next) {
  try {
    const today = new Date();
    const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    const overdue = await Invoice.findAll({
      where: { status: 'overdue' },
      include: [{ model: Customer, as: 'customer', attributes: ['name'] }],
      limit: 5,
    });

    const upcoming = await Invoice.findAll({
      where: {
        status: 'sent',
        due_date: { [Op.between]: [today.toISOString().split('T')[0], in30Days.toISOString().split('T')[0]] },
      },
      include: [{ model: Customer, as: 'customer', attributes: ['name'] }],
      order: [['due_date', 'ASC']],
      limit: 5,
    });

    const deadlines = [
      ...overdue.map(i => ({ type: 'overdue_invoice', date: i.due_date, description: `Overdue: ${i.invoice_number}`, amount: i.amount_due, customer: i.customer?.name })),
      ...upcoming.map(i => ({ type: 'due_invoice', date: i.due_date, description: `Due: ${i.invoice_number}`, amount: i.amount_due, customer: i.customer?.name })),
    ];

    // Add annual LHDN deadline
    const currentYear = today.getFullYear();
    if (today.getMonth() < 6) {
      deadlines.push({ type: 'tax_deadline', date: `${currentYear}-04-30`, description: `Borang B submission deadline AY${currentYear - 1}`, amount: null });
    }

    res.json(deadlines.sort((a, b) => new Date(a.date) - new Date(b.date)));
  } catch (err) {
    next(err);
  }
}

export async function cashFlowSnapshot(req, res, next) {
  try {
    const projections = await CashFlowService.getProjection(3);
    res.json(projections);
  } catch (err) {
    next(err);
  }
}
