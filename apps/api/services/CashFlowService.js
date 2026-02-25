import { Op } from 'sequelize';
import { Invoice, Expense, RecurringTemplate, CashFlowProjection } from '../models/index.js';

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
          due_date: { [Op.between]: [monthStart.toISOString().split('T')[0], monthEnd.toISOString().split('T')[0]] },
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
        const paidInvoices = await Invoice.findAll({
          where: {
            status: 'paid',
            paid_at: { [Op.between]: [monthStart, monthEnd] },
          },
          attributes: ['total'],
        });
        actualIncome = paidInvoices.reduce((sum, inv) => sum + parseFloat(inv.total || 0), 0);

        const paidExpenses = await Expense.findAll({
          where: {
            expense_date: {
              [Op.between]: [monthStart.toISOString().split('T')[0], monthEnd.toISOString().split('T')[0]],
            },
          },
          attributes: ['amount_myr', 'amount'],
        });
        actualExpenses = paidExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount_myr || exp.amount || 0), 0);
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
    const invoices = await Invoice.findAll({
      where: { status: 'paid', paid_at: { [Op.between]: [from, to] } },
      attributes: ['total', 'paid_at'],
    });

    const expenses = await Expense.findAll({
      where: { expense_date: { [Op.between]: [from, to] } },
      attributes: ['amount_myr', 'amount', 'expense_date'],
    });

    return {
      totalIncome: invoices.reduce((s, i) => s + parseFloat(i.total), 0),
      totalExpenses: expenses.reduce((s, e) => s + parseFloat(e.amount_myr || e.amount), 0),
      invoices,
      expenses,
    };
  }
}

export default new CashFlowService();
