import { createAgenda, getAgenda } from '../config/agenda.js';
import { defineOverdueInvoicesJob } from './overdue-invoices.js';
import { defineRecurringEntriesJob } from './recurring-entries.js';
import { definePaymentRemindersJob } from './payment-reminders.js';
import { definePollEinvoiceStatusJob } from './poll-einvoice-status.js';
import { defineCleanupTempFilesJob } from './cleanup-temp-files.js';

export async function startAgenda() {
  const agenda = await createAgenda();

  // Define all jobs
  defineOverdueInvoicesJob(agenda);
  defineRecurringEntriesJob(agenda);
  definePaymentRemindersJob(agenda);
  definePollEinvoiceStatusJob(agenda);
  defineCleanupTempFilesJob(agenda);

  // Start agenda
  await agenda.start();

  // Schedule recurring jobs (idempotent — won't duplicate if already scheduled)
  await agenda.every('0 0 * * *', 'check-overdue-invoices');     // daily 00:00
  await agenda.every('0 6 * * *', 'generate-recurring-entries'); // daily 06:00
  await agenda.every('0 9 * * *', 'send-payment-reminders');     // daily 09:00
  await agenda.every('30 minutes', 'poll-einvoice-status');       // every 30 min
  await agenda.every('0 2 * * *', 'cleanup-temp-files');          // daily 02:00

  console.log('✓ Agenda jobs scheduled');
  return agenda;
}
