import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_URL = process.env.E2E_API_URL || 'http://localhost:3001';

// A per-km mileage claim substitutes for actual vehicle costs; recording a
// fuel/maintenance receipt (account 6400) AND a mileage claim (account
// 6410) in the same month is the signal that a trip may have been claimed
// under both bases. This test proves the resulting warning is real DOM on
// both surfaces that read D5, and that it disappears once the overlapping
// records are removed — it must never block either flow.
//
// Test data lives in January 2026, deliberately outside the Cash Flow
// page's default 6-month window (Mar-Aug 2026, see cash-flow-bug.spec.js)
// so this spec cannot perturb that spec's hardcoded totals, while still
// falling inside "year 2026" for both the Taxation year selector and the
// Mileage page's overlap query (which defaults to the current year).
const TEST_MONTH = '2026-01';
const TEST_DATE = '2026-01-15';

function loadToken() {
  const authFile = path.resolve(__dirname, '.auth/user.json');
  const state = JSON.parse(fs.readFileSync(authFile, 'utf-8'));
  const token = state.origins?.[0]?.localStorage?.find((e) => e.name === 'pa_token')?.value;
  if (!token) throw new Error('No pa_token found in e2e/.auth/user.json — did global.setup.js run?');
  return token;
}

const overlapNotification = (page) => page.getByText('Possible double-claimed vehicle costs', { exact: true });

test.describe('Mileage / vehicle-expense overlap warning', () => {
  test('warning appears with overlapping data on Mileage and Taxation, and disappears once removed', async ({ page, request }) => {
    const token = loadToken();
    const authHeaders = { Authorization: `Bearer ${token}` };

    // Baseline: no D5 activity in January 2026 in this dev DB, so neither
    // page should show the warning yet.
    await page.goto('/mileage');
    await expect(overlapNotification(page)).toHaveCount(0);

    await page.goto('/taxation');
    await page.locator('#tax-year').selectOption('2026');
    await page.waitForResponse((res) => res.url().includes('/api/v1/taxation/summary') && res.url().includes('year=2026'));
    await expect(overlapNotification(page)).toHaveCount(0);

    let expenseId;
    let mileageId;
    try {
      // Look up the "Petrol / Fuel" category (D5) rather than hardcoding an id.
      const categoriesRes = await request.get(`${API_URL}/api/v1/expense-categories`, { headers: authHeaders });
      expect(categoriesRes.ok()).toBeTruthy();
      const categories = await categoriesRes.json();
      const petrolCategory = categories.find((c) => c.name === 'Petrol / Fuel' && c.borang_b_section === 'D5');
      expect(petrolCategory, 'Petrol / Fuel (D5) category not found').toBeTruthy();

      // Actual receipt → posts to 6400 Motor Vehicle Expenses.
      const expenseRes = await request.post(`${API_URL}/api/v1/expenses`, {
        headers: authHeaders,
        data: {
          vendor_name: 'E2E Overlap Test — Petrol Station',
          amount: 100,
          currency: 'MYR',
          expense_date: TEST_DATE,
          category_id: petrolCategory.id,
        },
      });
      expect(expenseRes.ok(), await expenseRes.text()).toBeTruthy();
      expenseId = (await expenseRes.json()).id;

      // Mileage claim for the "same" trip → posts to 6410 Mileage Claim.
      const mileageRes = await request.post(`${API_URL}/api/v1/mileage`, {
        headers: authHeaders,
        data: {
          log_date: TEST_DATE,
          from_location: 'E2E Overlap Test — Office',
          to_location: 'E2E Overlap Test — Client Site',
          km: 50,
          purpose: 'client_visit',
        },
      });
      expect(mileageRes.ok(), await mileageRes.text()).toBeTruthy();
      mileageId = (await mileageRes.json()).id;

      // Confirm the API itself sees the overlap before checking the UI.
      const overlapRes = await request.get(`${API_URL}/api/v1/mileage/overlap?year=2026`, { headers: authHeaders });
      expect(overlapRes.ok()).toBeTruthy();
      const overlapBody = await overlapRes.json();
      const overlapMonth = overlapBody.months.find((m) => m.month === TEST_MONTH);
      expect(overlapMonth, 'January 2026 missing from /mileage/overlap response').toBeTruthy();
      expect(overlapMonth.receiptsTotal).toBeCloseTo(100, 2);
      expect(overlapMonth.mileageTotal).toBeCloseTo(30, 2); // 50km x RM0.60/km

      // Mileage page shows the warning.
      await page.goto('/mileage');
      await expect(overlapNotification(page)).toBeVisible();
      await expect(page.getByText(/January 2026/)).toBeVisible();

      // Taxation page (where D5 becomes a filed number) shows it too.
      await page.goto('/taxation');
      await page.locator('#tax-year').selectOption('2026');
      await page.waitForResponse((res) => res.url().includes('/api/v1/taxation/summary') && res.url().includes('year=2026'));
      await expect(overlapNotification(page)).toBeVisible();
      await expect(page.getByText(/January 2026/)).toBeVisible();

      // Neither flow was blocked — both records exist and are queryable.
      const expenseCheck = await request.get(`${API_URL}/api/v1/expenses/${expenseId}`, { headers: authHeaders });
      expect(expenseCheck.ok()).toBeTruthy();
      const mileageCheck = await request.get(`${API_URL}/api/v1/mileage/${mileageId}`, { headers: authHeaders });
      expect(mileageCheck.ok()).toBeTruthy();
    } finally {
      // Both DELETE handlers cascade their auto-posted GL entries, so the
      // ledger goes back to its exact pre-test state.
      if (mileageId) await request.delete(`${API_URL}/api/v1/mileage/${mileageId}`, { headers: authHeaders });
      if (expenseId) await request.delete(`${API_URL}/api/v1/expenses/${expenseId}`, { headers: authHeaders });
    }

    // Warning is gone from both surfaces once the overlap is removed.
    await page.goto('/mileage');
    await expect(overlapNotification(page)).toHaveCount(0);

    await page.goto('/taxation');
    await page.locator('#tax-year').selectOption('2026');
    await page.waitForResponse((res) => res.url().includes('/api/v1/taxation/summary') && res.url().includes('year=2026'));
    await expect(overlapNotification(page)).toHaveCount(0);
  });
});
