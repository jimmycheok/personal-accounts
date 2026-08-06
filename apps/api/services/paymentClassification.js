/**
 * Classifies a single payment's GL coverage. Pure — no DB access — so it is
 * unit-testable on its own. `scripts/backfill-journal-entries.js` runs the
 * SQL that produces the inputs; this module only decides what to do with
 * the result.
 *
 * Background (see docs/superpowers/plans/2026-08-06-gl-sourced-cashflow.md,
 * Amendment B and the final-review Fix 7): `journal_entries.source_type =
 * 'payment'` mixes two id namespaces. Entries created from a real `Payment`
 * row store `source_id = payment.id`. Pre-Task-3 `invoicesController.markPaid`
 * entries store `source_id = invoice.id` under the SAME source_type, and a
 * few of those predate Task 3 entirely and were saved with `source_id =
 * NULL` (a genuine orphan — money in the ledger, no way to join it back to
 * a payment row). Both are landmines for a naive LEFT JOIN backfill:
 *   - A source_id collision can make an unrelated invoice's entry look like
 *     this payment's own entry.
 *   - A source_id IS NULL orphan can already cover this payment's invoice
 *     while looking, to a plain "is there a matching row" check, like this
 *     payment is simply missing and safe to auto-repair.
 *
 * `classifyPayment` never over-repairs: any doubt resolves to 'ambiguous',
 * which the backfill script never writes under --apply.
 */
export function classifyPayment({ invoiceNumber, matchedEntry, orphanEntries = [] }) {
  // Check source_id IS NULL orphans FIRST, independently of whether this
  // payment also has a source_id=payment.id match. If an orphan entry
  // already names this payment's invoice, its money is already in the
  // ledger — auto-repairing would post a second inflow.
  const coveringOrphan = invoiceNumber
    ? orphanEntries.find((o) => (o.description || '').includes(invoiceNumber))
    : null;

  if (coveringOrphan) {
    return {
      status: 'ambiguous',
      entryId: coveringOrphan.id,
      entryDescription: coveringOrphan.description,
      reason: 'already covered by a source_id IS NULL orphan entry for this invoice',
    };
  }

  if (!matchedEntry) {
    return { status: 'missing' };
  }

  const description = matchedEntry.description || '';
  const coveredByOwnInvoice = Boolean(invoiceNumber) && description.includes(invoiceNumber);
  if (!coveredByOwnInvoice) {
    return {
      status: 'ambiguous',
      entryId: matchedEntry.id,
      entryDescription: matchedEntry.description,
      reason:
        "matched entry (by source_id) does not name this payment's own invoice — likely source_id collision with an unrelated invoice's markPaid entry",
    };
  }

  return { status: 'covered' };
}
