/**
 * Reports (and with --apply, repairs) source records that have no posted
 * journal entry. The GL is the source of truth for cash flow, dashboard and
 * tax, so any gap here is a number missing from those screens.
 *
 *   node scripts/backfill-journal-entries.js           # dry run (default, writes nothing)
 *   node scripts/backfill-journal-entries.js --apply   # write missing entries
 *
 * Known limitations (see task-4-report.md for full investigation):
 *
 *  - source_type='payment' holds two id namespaces. Entries created from a
 *    real `Payment` row store source_id = payment.id. Entries created by
 *    invoicesController.markPaid's fallback store source_id = invoice.id
 *    under the SAME source_type='payment'. If a payments.id ever equals an
 *    invoice.id that already has a markPaid entry, the LEFT JOIN below will
 *    treat the payment as already covered even though the entry actually
 *    belongs to an unrelated invoice. This is a pre-existing data-model
 *    ambiguity, not something this script can safely resolve — re-architecting
 *    source_type is out of scope here. The dry-run output below cannot detect
 *    this collision case; only a manual reconciliation against the payments
 *    table can.
 *
 *  - Orphan entries with source_type='payment' AND source_id IS NULL are
 *    pre-Task-3 markPaid artifacts. They cannot be matched back to any
 *    payment or invoice, and they double-count money already reflected
 *    elsewhere. This script only *reports* their count — it never repairs
 *    or deletes them. That decision is left to a human.
 *
 *  - The "invoices without an issue entry" count is REPORT-ONLY. Invoice
 *    "issued" entries post to Accounts Receivable and require more care
 *    (e.g. distinguishing draft vs sent/paid, choosing the right entry
 *    date) than a generic backfill loop should apply automatically. This
 *    script does not create invoice entries under --apply.
 */
// Mirrors server.js: dotenv must run before any model/service import, and ES
// static imports are hoisted, so the model imports below are dynamic.
import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, '../../../.env') });

const { sequelize, Expense, Payment, Invoice, ExpenseCategory } = await import('../models/index.js');
const { default: JournalEntryService } = await import('../services/JournalEntryService.js');

const APPLY = process.argv.includes('--apply');

async function missingIds(table, sourceType) {
  const [rows] = await sequelize.query(
    `SELECT s.id FROM ${table} s
     LEFT JOIN journal_entries je
       ON je.source_type = :sourceType AND je.source_id = s.id
     WHERE je.id IS NULL
     ORDER BY s.id`,
    { replacements: { sourceType } },
  );
  return rows.map((r) => r.id);
}

async function orphanPaymentEntryCount() {
  const [rows] = await sequelize.query(
    `SELECT COUNT(*)::int AS count FROM journal_entries
     WHERE source_type = 'payment' AND source_id IS NULL`,
  );
  return rows[0].count;
}

async function main() {
  const expenseIds = await missingIds('expenses', 'expense');
  const paymentIds = await missingIds('payments', 'payment');
  const invoiceIds = (await missingIds('invoices', 'invoice')).length;
  const orphanPaymentEntries = await orphanPaymentEntryCount();

  console.log(`Expenses without a GL entry: ${expenseIds.length}`);
  console.log(`Payments without a GL entry: ${paymentIds.length}`);
  console.log(`Invoices without an issue entry: ${invoiceIds} (REPORT ONLY — this script does not repair invoices)`);
  console.log(`Orphan payment entries (source_id IS NULL, unreconcilable): ${orphanPaymentEntries} (REPORT ONLY — not repaired or deleted by this script)`);

  if (!APPLY) {
    console.log('\nDry run. Re-run with --apply to create the missing expense and payment entries.');
    console.log('Note: invoice and orphan-entry counts above are informational only and are never written by --apply.');
    return;
  }

  let ok = 0;
  const failures = [];

  for (const id of expenseIds) {
    try {
      const expense = await Expense.findByPk(id, { include: [{ model: ExpenseCategory, as: 'category' }] });
      await JournalEntryService.onExpenseCreated(expense);
      ok++;
    } catch (err) { failures.push(`expense ${id}: ${err.message}`); }
  }

  for (const id of paymentIds) {
    try {
      const payment = await Payment.findByPk(id);
      const invoice = await Invoice.findByPk(payment.invoice_id);
      if (!invoice) throw new Error('orphaned payment — no invoice');
      await JournalEntryService.onPaymentReceived(payment, invoice);
      ok++;
    } catch (err) { failures.push(`payment ${id}: ${err.message}`); }
  }

  console.log(`\nCreated ${ok} entries (expenses + payments only; invoices were not touched).`);
  if (failures.length) {
    console.log(`${failures.length} failed:`);
    failures.forEach((f) => console.log('  ' + f));
    // The run still completed and printed a full summary (per-record
    // failures must not abort the whole run), but a non-zero exit code
    // lets a caller distinguish "ran clean" from "ran but needs attention".
    process.exitCode = 1;
  }
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => sequelize.close());
