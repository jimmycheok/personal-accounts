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
 *    under the SAME source_type='payment'. So a payments row and an
 *    unrelated invoice's markPaid entry can share the same source_id. A
 *    plain LEFT JOIN cannot tell these apart and would silently treat a
 *    genuinely-missing payment as already covered — confirmed live in this
 *    repo (payment id 4 collided with invoice 4's markPaid entry). Rather
 *    than re-architecting source_type (out of scope), this script resolves
 *    the ambiguity per match: it compares the payment's own invoice_number
 *    against the matched entry's description (see `classifyPayments`
 *    below). A match whose description doesn't mention the payment's own
 *    invoice is reported as AMBIGUOUS and is never auto-repaired.
 *
 *  - A payment whose invoice has been voided is reported as its own
 *    "skipped (invoice void)" category, never as missing or ambiguous
 *    (Fix B, final review, 2026-08-06). Voiding an invoice deliberately
 *    deletes that invoice's payment-sourced journal entries while leaving
 *    the `payments` row itself intact — without this check, the next dry
 *    run would see "no matched entry" and classify it as missing, and
 *    --apply would recreate exactly the phantom cash inflow the void
 *    intentionally removed.
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
 *
 *  - The AMBIGUOUS check is a substring test: it accepts a match as
 *    "genuinely covered" only if the matched entry's description contains
 *    the payment's own invoice number. This is a deliberate, reviewed
 *    design decision (do not change it without a new ruling) but it has a
 *    known blind spot: a manually-created journal entry (POST
 *    /journal-entries accepts arbitrary description text) whose
 *    description happens to contain the payment's invoice number would
 *    still be accepted as covered. Invoice numbers are normally
 *    `INV-` + 4-digit padding, which makes prefix collisions between
 *    different invoice numbers unlikely, but callers can supply custom
 *    invoice numbers (e.g. imported data), so that padding is not
 *    guaranteed. Net effect: AMBIGUOUS is a floor, not a ceiling — the
 *    script can under-report ambiguity in unusual cases, but it can never
 *    over-repair (an ambiguous id never reaches the --apply loop).
 *
 *  - Minor implementation notes:
 *    - `missingIds(table, ...)` interpolates `table` directly into the SQL
 *      string rather than binding it. Every call site passes a hardcoded
 *      literal ('expenses' / 'payments' / 'invoices'), so this is not
 *      exploitable today — noted so a future edit doesn't wire in
 *      caller-supplied table names without adding validation.
 *    - This script has no inter-process lock. Running two `--apply`
 *      invocations concurrently could both read the same "missing" set
 *      before either writes, causing a double insert. Idempotency is only
 *      guaranteed for sequential runs — do not run --apply concurrently.
 */
// Mirrors server.js: dotenv must run before any model/service import, and ES
// static imports are hoisted, so the model imports below are dynamic.
import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { classifyPayment } from '../services/paymentClassification.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, '../../../.env') });

const { sequelize, Expense, Payment, Invoice, ExpenseCategory } = await import('../models/index.js');
const { default: JournalEntryService } = await import('../services/JournalEntryService.js');

// This script's output is a human safety gate before writing to live books —
// keep it readable regardless of NODE_ENV (config/database.js enables SQL
// query logging whenever NODE_ENV=development, which would otherwise bury
// the summary and the AMBIGUOUS detail block under raw SQL).
sequelize.options.logging = false;

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

// Classifies every payment into one of three buckets — missing / ambiguous /
// covered — via the pure `classifyPayment` (see services/paymentClassification.js
// for the full rationale and unit tests). This function's only job is to
// fetch the SQL rows that function needs and bucket the results.
async function classifyPayments() {
  const [rows] = await sequelize.query(`
    SELECT p.id AS payment_id, p.amount, p.invoice_id, inv.invoice_number, inv.status AS invoice_status,
           je.id AS entry_id, je.description AS entry_description
    FROM payments p
    LEFT JOIN invoices inv ON inv.id = p.invoice_id
    LEFT JOIN journal_entries je
      ON je.source_type = 'payment' AND je.source_id = p.id
    ORDER BY p.id
  `);

  const [orphanRows] = await sequelize.query(`
    SELECT id, description FROM journal_entries
    WHERE source_type = 'payment' AND source_id IS NULL
  `);

  const missing = [];
  const ambiguous = [];
  const voidSkipped = [];

  for (const row of rows) {
    const result = classifyPayment({
      invoiceNumber: row.invoice_number,
      invoiceStatus: row.invoice_status,
      matchedEntry: row.entry_id == null ? null : { id: row.entry_id, description: row.entry_description },
      orphanEntries: orphanRows,
    });

    if (result.status === 'missing') {
      missing.push(row.payment_id);
    } else if (result.status === 'ambiguous') {
      ambiguous.push({
        paymentId: row.payment_id,
        amount: row.amount,
        invoiceId: row.invoice_id,
        invoiceNumber: row.invoice_number,
        entryId: result.entryId,
        entryDescription: result.entryDescription,
        reason: result.reason,
      });
    } else if (result.status === 'void_skip') {
      voidSkipped.push({
        paymentId: row.payment_id,
        amount: row.amount,
        invoiceId: row.invoice_id,
        invoiceNumber: row.invoice_number,
      });
    }
    // else 'covered': skipped silently, same as before.
  }

  return { missing, ambiguous, voidSkipped };
}

function formatVoidSkipped(v) {
  const amount = parseFloat(v.amount).toFixed(2);
  const invoiceLabel = v.invoiceNumber ? `invoice ${v.invoiceId} / ${v.invoiceNumber}` : `invoice ${v.invoiceId}`;
  return `  payment id=${v.paymentId} (RM${amount}, ${invoiceLabel}, void) -> skipped, not counted as missing`;
}

function formatAmbiguous(a) {
  const amount = parseFloat(a.amount).toFixed(2);
  const invoiceLabel = a.invoiceNumber ? `invoice ${a.invoiceId} / ${a.invoiceNumber}` : `invoice ${a.invoiceId} (invoice not found)`;
  const lines = [
    `  payment id=${a.paymentId} (RM${amount}, ${invoiceLabel})`,
    `    matched journal entry ${a.entryId}, described "${a.entryDescription}"`,
    `    reason: ${a.reason || 'unspecified'}`,
    `    -> NOT auto-repaired; review manually`,
  ];
  return lines.join('\n');
}

async function main() {
  const expenseIds = await missingIds('expenses', 'expense');
  const { missing: paymentMissingIds, ambiguous: paymentAmbiguous, voidSkipped: paymentVoidSkipped } = await classifyPayments();
  const invoiceIds = (await missingIds('invoices', 'invoice')).length;
  const orphanPaymentEntries = await orphanPaymentEntryCount();

  console.log(`Expenses without a GL entry: ${expenseIds.length}`);
  console.log(`Payments with no GL entry: ${paymentMissingIds.length}`);
  console.log(`Payments AMBIGUOUS (need review): ${paymentAmbiguous.length}`);
  paymentAmbiguous.forEach((a) => console.log(formatAmbiguous(a)));
  console.log(`Payments skipped (invoice void — not counted as missing): ${paymentVoidSkipped.length}`);
  paymentVoidSkipped.forEach((v) => console.log(formatVoidSkipped(v)));
  console.log(`Invoices without an issue entry: ${invoiceIds} (REPORT ONLY — this script does not repair invoices)`);
  console.log(`Orphan payment entries (source_id IS NULL, unreconcilable): ${orphanPaymentEntries} (REPORT ONLY — not repaired or deleted by this script)`);

  if (!APPLY) {
    console.log('\nDry run. Re-run with --apply to create the missing expense and payment entries.');
    console.log('Note: invoice and orphan-entry counts above are informational only and are never written by --apply.');
    console.log('Note: AMBIGUOUS payments above are never written by --apply either — they need manual review.');
    console.log('Note: void-skipped payments are correct as-is — their invoice was voided, which deliberately removes the payment entry — and are never written by --apply.');
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

  for (const id of paymentMissingIds) {
    try {
      const payment = await Payment.findByPk(id);
      const invoice = await Invoice.findByPk(payment.invoice_id);
      if (!invoice) throw new Error('orphaned payment — no invoice');
      await JournalEntryService.onPaymentReceived(payment, invoice);
      ok++;
    } catch (err) { failures.push(`payment ${id}: ${err.message}`); }
  }

  console.log(`\nCreated ${ok} entries (expenses + payments only; invoices were not touched).`);
  console.log(`Payments AMBIGUOUS (still unrepaired, need review): ${paymentAmbiguous.length}`);
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
