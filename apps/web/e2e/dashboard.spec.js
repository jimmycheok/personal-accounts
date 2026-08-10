import { test, expect } from '@playwright/test';
import { readStat } from './helpers.js';

// All the ledger data in this dev DB falls between 2026-07-23 and
// 2026-08-06 (see .superpowers/sdd baseline). Dashboard "This Year"
// (2026-01-01..2026-12-31) and Cash Flow "Last 12 Months"
// (2025-09..2026-08) both fully contain that range, so both surfaces are
// summing the exact same underlying GL rows — the same invariant the
// branch exists to establish. Comparing against each other, not a
// hardcoded constant, is what keeps this test meaningful as data changes.
test.describe('Dashboard agrees with Cash Flow', () => {
  test('Cash In / Cash Out on Dashboard equal Total Income / Total Expenses on Cash Flow', async ({ page }) => {
    await page.goto('/cash-flow');
    await page.locator('#months').selectOption('12');
    await expect(page.getByText('Total Expenses', { exact: true })).toBeVisible();
    const cashFlowIncome = await readStat(page, 'Total Income');
    const cashFlowExpenses = await readStat(page, 'Total Expenses');

    await page.goto('/dashboard');
    await page.locator('#period').selectOption('year');
    await expect(page.getByText('Cash In', { exact: true })).toBeVisible();
    const dashboardCashIn = await readStat(page, 'Cash In');
    const dashboardCashOut = await readStat(page, 'Cash Out');

    expect(dashboardCashIn).toBeCloseTo(cashFlowIncome, 2);
    expect(dashboardCashOut).toBeCloseTo(cashFlowExpenses, 2);

    // Sanity: both surfaces should actually be non-trivial (i.e. this isn't
    // an accidental 0 === 0 pass) — the payment voucher's RM1,800 must be in there.
    expect(dashboardCashOut).toBeGreaterThan(1800);
  });
});

// Dashboard tiles used to read "Revenue" / "Expenses" / "Net Profit", which
// implied an accrual P&L figure. Once the figures became cash-basis
// (GL-sourced, includes payment vouchers), those labels were misleading —
// they were renamed to "Cash In" / "Cash Out" / "Net Cash".
test.describe('Dashboard tile labels', () => {
  test('reads Cash In / Cash Out / Net Cash, not the old Revenue/Expenses/Net Profit labels', async ({ page }) => {
    await page.goto('/dashboard');

    // Scoped to the stat-tile row specifically (`className="grid-4"` in
    // Dashboard/index.jsx) — the sidenav legitimately has its own
    // "Expenses" link, which is a different thing from the tile label.
    const statRow = page.locator('.grid-4').first();
    await expect(statRow).toBeVisible();

    await expect(statRow.getByText('Cash In', { exact: true })).toBeVisible();
    await expect(statRow.getByText('Cash Out', { exact: true })).toBeVisible();
    await expect(statRow.getByText('Net Cash', { exact: true })).toBeVisible();

    await expect(statRow.getByText('Revenue', { exact: true })).toHaveCount(0);
    await expect(statRow.getByText('Expenses', { exact: true })).toHaveCount(0);
    await expect(statRow.getByText('Net Profit', { exact: true })).toHaveCount(0);
  });
});
