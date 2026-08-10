import { test, expect } from '@playwright/test';
import { readStat } from './helpers.js';

// Regression test for the original bug: a Payment Voucher's expense was
// posted to journal_entries but never reached the Cash Flow page because
// that page read `expenses`/`invoices` directly, and PVs never wrote to
// those tables. The GL-sourced fix routes everything through
// LedgerQueryService instead. If the bug returns, Total Expenses on this
// page will drop from RM2,399.00 back to RM599.00 (the PV's RM1,800.00
// outflow silently disappearing).
test.describe('Cash Flow — payment vouchers reach the ledger-sourced total', () => {
  test('Total Expenses includes the payment voucher outflow, not just plain expenses', async ({ page }) => {
    const responsePromise = page.waitForResponse((res) => res.url().includes('/api/v1/cash-flow/actual'));
    await page.goto('/cash-flow');
    const apiResponse = await responsePromise;
    const body = await apiResponse.json();

    // API-level assertion: the GL total, not a UI-rounded approximation.
    expect(body.totals.totalIncome).toBeCloseTo(1460.0, 2);
    expect(body.totals.totalExpenses).toBeCloseTo(2399.0, 2);

    // The specific months that carry the regression signal.
    const july = body.monthly.find((m) => m.month === 'Jul 26');
    const august = body.monthly.find((m) => m.month === 'Aug 26');
    expect(july, 'July 2026 bucket (payment voucher month) missing from response').toBeTruthy();
    expect(august, 'August 2026 bucket (plain expense month) missing from response').toBeTruthy();
    expect(july.expenses).toBeCloseTo(1800.0, 2); // the PV outflow — this is what the bug hid
    expect(august.expenses).toBeCloseTo(599.0, 2);
    expect(august.income).toBeCloseTo(1460.0, 2);

    // UI-level assertion: what the user actually sees on screen agrees.
    await expect(page.getByText('Total Expenses', { exact: true })).toBeVisible();
    const totalExpenses = await readStat(page, 'Total Expenses');
    const totalIncome = await readStat(page, 'Total Income');
    expect(totalExpenses).toBeCloseTo(2399.0, 2);
    expect(totalIncome).toBeCloseTo(1460.0, 2);

    // The specific failure mode of the original bug: expenses stuck at
    // RM599 (the plain-expense-only figure) instead of RM2,399.
    expect(totalExpenses).not.toBeCloseTo(599.0, 2);
  });
});
