import { test, expect } from '@playwright/test';

// All the ledger data in this dev DB falls between 2026-07-23 and
// 2026-08-06 (see .superpowers/sdd baseline). Dashboard "This Year"
// (2026-01-01..2026-12-31) and Cash Flow's default "Last 6 Months" both
// fully contain that range, so both surfaces sum the exact same underlying
// GL rows — the invariant this branch exists to establish. Comparing them
// against each other, rather than a hardcoded constant, is what keeps this
// test meaningful as the data changes.
test.describe('Dashboard agrees with Cash Flow', () => {
  test('Cash In / Cash Out on Dashboard equal Total Income / Total Expenses on Cash Flow', async ({ page }) => {
    // Read the API payloads the pages actually loaded, not their rendered
    // text. "Do these two surfaces agree" is a backend invariant; proving it
    // by scraping two React pages under parallel load was the source of a
    // ~1-in-5 flake that had nothing to do with the invariant.
    //
    // Match on the QUERY PARAMS, not just the endpoint. React 18 invokes the
    // initial effect twice in dev, so two requests land before any selector
    // change — matching the endpoint alone can capture an initial
    // `period=month` response and silently compare August (599) against the
    // full year (2399). That is exactly how this test failed.
    //
    // Cash Flow's default view is the last 6 months, which already contains
    // all the dev data, so its period is left alone — one less thing to race.
    const cashFlowResponse = page.waitForResponse((r) => r.url().includes('/api/v1/cash-flow/actual'));
    await page.goto('/cash-flow');
    const cashFlowBody = await (await cashFlowResponse).json();
    const cashFlowIncome = cashFlowBody.totals.totalIncome;
    const cashFlowExpenses = cashFlowBody.totals.totalExpenses;
    await expect(page.getByText('Total Expenses', { exact: true })).toBeVisible();

    const dashboardResponse = page.waitForResponse(
      (r) => r.url().includes('/api/v1/dashboard/overview') && r.url().includes('period=year'),
    );
    await page.goto('/dashboard');
    await page.locator('#period').selectOption('year');
    const dashboardBody = await (await dashboardResponse).json();
    const dashboardCashIn = dashboardBody.totalIncome;
    const dashboardCashOut = dashboardBody.totalExpenses;

    await expect(page.getByText('Cash In', { exact: true })).toBeVisible();
    await expect(page.getByText('Cash Out', { exact: true })).toBeVisible();

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
