import { RecurringTemplate, Invoice, InvoiceItem, Expense, BusinessProfile } from '../models/index.js';
import { Op } from 'sequelize';
import { addDays, addWeeks, addMonths, addQuarters, addYears, format, parseISO } from 'date-fns';

function getNextDate(frequency, fromDate) {
  const date = typeof fromDate === 'string' ? parseISO(fromDate) : fromDate;
  switch (frequency) {
    case 'daily':     return addDays(date, 1);
    case 'weekly':    return addWeeks(date, 1);
    case 'monthly':   return addMonths(date, 1);
    case 'quarterly': return addMonths(date, 3);
    case 'annually':  return addYears(date, 1);
    default: return addMonths(date, 1);
  }
}

export function defineRecurringEntriesJob(agenda) {
  agenda.define('generate-recurring-entries', async (job) => {
    const today = new Date().toISOString().split('T')[0];

    const dueTemplates = await RecurringTemplate.findAll({
      where: {
        is_active: true,
        next_run_date: { [Op.lte]: today },
      },
    });

    let created = 0;

    for (const template of dueTemplates) {
      try {
        if (template.template_type === 'invoice') {
          const data = template.template_data;
          const profile = await BusinessProfile.findOne();
          const prefix = profile?.invoice_prefix || 'INV';
          const last = await Invoice.findOne({ order: [['id', 'DESC']] });
          const num = last ? parseInt(last.invoice_number.replace(/[^0-9]/g, '')) + 1 : 1;
          const invoice_number = `${prefix}-${String(num).padStart(4, '0')}`;

          const invoice = await Invoice.create({
            invoice_number,
            customer_id: data.customer_id,
            issue_date: today,
            due_date: data.due_date_offset
              ? format(addDays(new Date(), data.due_date_offset), 'yyyy-MM-dd')
              : null,
            status: 'draft',
            subtotal: data.subtotal || 0,
            tax_total: data.tax_total || 0,
            total: data.total || 0,
            amount_due: data.total || 0,
            notes: data.notes,
            is_recurring: true,
            recurring_template_id: template.id,
          });

          if (data.items?.length) {
            await InvoiceItem.bulkCreate(data.items.map(item => ({ ...item, invoice_id: invoice.id })));
          }
        } else if (template.template_type === 'expense') {
          const data = template.template_data;
          await Expense.create({
            vendor_name: data.vendor_name,
            description: data.description,
            amount: data.amount,
            currency: data.currency || 'MYR',
            amount_myr: data.amount,
            expense_date: today,
            category_id: data.category_id,
            is_tax_deductible: data.is_tax_deductible ?? true,
            tax_year: new Date().getFullYear(),
            is_recurring: true,
            recurring_template_id: template.id,
          });
        }

        // Advance next_run_date
        const nextDate = getNextDate(template.frequency, template.next_run_date);
        const shouldContinue = !template.end_date || nextDate <= new Date(template.end_date);

        await template.update({
          next_run_date: format(nextDate, 'yyyy-MM-dd'),
          last_run_date: today,
          run_count: template.run_count + 1,
          is_active: shouldContinue,
        });

        created++;
      } catch (err) {
        console.error(`[recurring-entries] Error processing template ${template.id}:`, err.message);
      }
    }

    console.log(`[generate-recurring-entries] Created ${created} entries from ${dueTemplates.length} templates`);
  });
}
