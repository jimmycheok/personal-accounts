/**
 * Removes journal entries that mileage logs posted before mileage became a
 * logbook-only feature (see fix/mileage-logbook-only). LHDN publishes no
 * per-km rate for a sole proprietor's business deduction — the statutory
 * basis is actual costs apportioned by business use under s.33(1) ITA 1967,
 * substantiated by a logbook — so these entries (DR Motor Vehicle Expenses /
 * CR Owner's Capital, posted per trip) were never a valid deduction and also
 * fabricated an expense funded by owner capital, overstating both the P&L
 * and the Balance Sheet.
 *
 *   node scripts/remove-mileage-journal-entries.js           # dry run (default, writes nothing)
 *   node scripts/remove-mileage-journal-entries.js --apply   # delete the entries
 *
 * Scope, deliberately narrow:
 *  - Deletes ONLY `journal_entries` rows with source_type = 'mileage' (and
 *    their `journal_entry_lines`). It never touches `mileage_logs` — those
 *    trip records are the owner's logbook, substantiating actual-cost
 *    deductions claimed separately through Expenses, and must survive.
 *  - Dry run by default. Reports the entries and their total value, grouped
 *    by year, and the D5 (Motor Vehicle Expenses) before/after total, before
 *    any write happens.
 *  - The delete runs inside a single transaction so the run either removes
 *    every mileage entry or none — no partial state on failure.
 */
// Mirrors server.js: dotenv must run before any model/service import, and ES
// static imports are hoisted, so the model imports below are dynamic.
import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, '../../../.env') });

const { sequelize, JournalEntry, JournalEntryLine } = await import('../models/index.js');

// This script's output is a human safety gate before writing to live books —
// keep it readable regardless of NODE_ENV (config/database.js enables SQL
// query logging whenever NODE_ENV=development, which would otherwise bury
// the summary under raw SQL).
sequelize.options.logging = false;

const APPLY = process.argv.includes('--apply');

// Per-year entry count and total value of mileage-sourced journal entries.
// "Value" is the debit posted to the expense account (Motor Vehicle
// Expenses), not a net across both entry lines — netting debit and credit
// of the same balanced entry would always be zero.
async function mileageEntrySummaryByYear() {
  const [rows] = await sequelize.query(`
    SELECT EXTRACT(YEAR FROM je.entry_date)::int AS year,
           COUNT(DISTINCT je.id)::int AS entry_count,
           COALESCE(SUM(jel.debit), 0) AS total_value
    FROM journal_entries je
    JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
    JOIN accounts a ON a.id = jel.account_id
    WHERE je.source_type = 'mileage'
      AND a.account_type = 'expense'
    GROUP BY 1
    ORDER BY 1
  `);
  return rows.map((r) => ({
    year: r.year,
    entryCount: r.entry_count,
    totalValue: Math.round(parseFloat(r.total_value) * 100) / 100,
  }));
}

async function mileageEntryCount() {
  const [rows] = await sequelize.query(`
    SELECT COUNT(*)::int AS count FROM journal_entries WHERE source_type = 'mileage'
  `);
  return rows[0].count;
}

// D5 (Motor Vehicle Expenses) total across all posted, non-closing entries —
// same shape as LedgerQueryService.getExpensesBySection, scoped to D5.
async function d5Total() {
  const [rows] = await sequelize.query(`
    SELECT COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0) AS amount
    FROM journal_entry_lines jel
    JOIN journal_entries je ON je.id = jel.journal_entry_id
    JOIN accounts a        ON a.id = jel.account_id
    WHERE je.status = 'posted'
      AND a.account_type = 'expense'
      AND a.borang_b_section = 'D5'
      AND je.source_type IS DISTINCT FROM 'year_end_close'
  `);
  return Math.round(parseFloat(rows[0]?.amount || 0) * 100) / 100;
}

function formatSummary(byYear) {
  const totalEntries = byYear.reduce((s, y) => s + y.entryCount, 0);
  const totalValue = Math.round(byYear.reduce((s, y) => s + y.totalValue, 0) * 100) / 100;
  console.log('Mileage journal entries by year:');
  for (const y of byYear) {
    console.log(`  ${y.year}: ${y.entryCount} entries, RM${y.totalValue.toFixed(2)}`);
  }
  console.log(`Total: ${totalEntries} entries, RM${totalValue.toFixed(2)}`);
  return { totalEntries, totalValue };
}

async function deleteMileageEntries() {
  const entries = await JournalEntry.findAll({ where: { source_type: 'mileage' } });
  const t = await sequelize.transaction();
  try {
    let deletedLines = 0;
    for (const entry of entries) {
      deletedLines += await JournalEntryLine.destroy({ where: { journal_entry_id: entry.id }, transaction: t });
      await entry.destroy({ transaction: t });
    }
    await t.commit();
    return { deletedEntries: entries.length, deletedLines };
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

async function main() {
  const byYear = await mileageEntrySummaryByYear();
  formatSummary(byYear);

  const d5Before = await d5Total();
  console.log(`\nD5 (Motor Vehicle Expenses) total before: RM${d5Before.toFixed(2)}`);

  // Gate on the same scope the delete uses (source_type='mileage', no account
  // filter), not on mileageEntrySummaryByYear's expense-account-only total —
  // otherwise a mileage entry whose lines happen to hit no expense account
  // would report "Nothing to do" and never reach --apply.
  const totalEntries = await mileageEntryCount();
  if (totalEntries === 0) {
    console.log('\nNo mileage journal entries found. Nothing to do.');
    return;
  }

  if (!APPLY) {
    console.log('\nDry run. Re-run with --apply to delete these mileage journal entries.');
    console.log('Note: mileage_logs is never touched by this script, with or without --apply.');
    return;
  }

  const { deletedEntries, deletedLines } = await deleteMileageEntries();
  const d5After = await d5Total();

  console.log(`\nDeleted ${deletedEntries} journal entries (${deletedLines} lines).`);
  console.log(`D5 (Motor Vehicle Expenses) total after: RM${d5After.toFixed(2)}`);

  const remaining = await mileageEntryCount();
  if (remaining !== 0) {
    console.error(`\n${remaining} mileage journal entries still remain after the delete — investigate before re-running.`);
    process.exitCode = 1;
  }
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => sequelize.close());
