import { Op } from 'sequelize';
import { Invoice, RecurringTemplate, CashFlowProjection } from '../models/index.js';
import LedgerQueryService from './LedgerQueryService.js';
import { ymd } from './ledgerAggregation.js';

class CashFlowService {
  async getProjection(months = 6) {
    const today = new Date();
    const projections = [];

    for (let i = 0; i < months; i++) {
      const projDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
      const monthStart = new Date(projDate.getFullYear(), projDate.getMonth(), 1);
      const monthEnd = new Date(projDate.getFullYear(), projDate.getMonth() + 1, 0);
      const monthKey = `${projDate.getFullYear()}-${String(projDate.getMonth() + 1).padStart(2, '0')}`;

      let projectedIncome = 0;
      let projectedExpenses = 0;
      let actualIncome = null;
      let actualExpenses = null;

      // Outstanding invoices due in this month (expected income)
      const outstanding = await Invoice.findAll({
        where: {
          status: { [Op.in]: ['sent', 'overdue'] },
          due_date: { [Op.between]: [ymd(monthStart), ymd(monthEnd)] },
        },
        attributes: ['amount_due'],
      });
      projectedIncome += outstanding.reduce((sum, inv) => sum + parseFloat(inv.amount_due || 0), 0);

      // Recurring invoice templates
      const recurringInvoices = await RecurringTemplate.findAll({
        where: { template_type: 'invoice', is_active: true },
      });
      recurringInvoices.forEach(t => {
        const amount = t.template_data?.total || t.template_data?.amount || 0;
        projectedIncome += parseFloat(amount);
      });

      // Recurring expense templates
      const recurringExpenses = await RecurringTemplate.findAll({
        where: { template_type: 'expense', is_active: true },
      });
      recurringExpenses.forEach(t => {
        projectedExpenses += parseFloat(t.template_data?.amount || 0);
      });

      // Actual data for past months
      if (monthEnd < today) {
        const totals = await LedgerQueryService.getCashTotals(
          ymd(monthStart),
          ymd(monthEnd),
        );
        actualIncome = totals.income;
        actualExpenses = totals.expenses;
      }

      // Update or create projection record
      await CashFlowProjection.upsert({
        projection_date: `${projDate.getFullYear()}-${String(projDate.getMonth() + 1).padStart(2, '0')}-01`,
        projected_income: projectedIncome,
        projected_expenses: projectedExpenses,
        actual_income: actualIncome,
        actual_expenses: actualExpenses,
        generated_at: new Date(),
      }, { conflictFields: ['projection_date'] });

      projections.push({
        month: monthKey,
        projected_income: projectedIncome,
        projected_expenses: projectedExpenses,
        projected_net: projectedIncome - projectedExpenses,
        actual_income: actualIncome,
        actual_expenses: actualExpenses,
        actual_net: actualIncome != null ? actualIncome - (actualExpenses || 0) : null,
      });
    }

    return projections;
  }

  async getActual(from, to) {
    const monthly = await LedgerQueryService.getCashFlowByMonth(from, to);
    return {
      totalIncome: monthly.reduce((s, m) => s + m.income, 0),
      totalExpenses: monthly.reduce((s, m) => s + m.expenses, 0),
      monthly,
    };
  }
}

export default new CashFlowService();
