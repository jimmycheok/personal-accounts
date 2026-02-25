import { Invoice } from '../models/index.js';
import { Op } from 'sequelize';

export function defineOverdueInvoicesJob(agenda) {
  agenda.define('check-overdue-invoices', async (job) => {
    const today = new Date().toISOString().split('T')[0];

    const result = await Invoice.update(
      { status: 'overdue' },
      {
        where: {
          status: 'sent',
          due_date: { [Op.lt]: today },
        },
      }
    );

    const count = result[0];
    console.log(`[check-overdue-invoices] Marked ${count} invoices as overdue`);
    job.attrs.data = { ...job.attrs.data, lastRun: new Date().toISOString(), overdueCount: count };
    await job.save();
  });
}
