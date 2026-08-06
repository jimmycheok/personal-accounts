import { test, expect } from '@playwright/test';

// Borang B (Taxation page) must include the payment voucher's GL-posted
// D2 expense, and must exclude account 6995 (Non-Deductible Expenses) from
// every section — that account carries no borang_b_section specifically so
// GL-sourced tax queries skip it.
//
// NOTE ON HOW THIS IS ASSERTED: the Taxation page (apps/web/src/pages/Taxation/index.jsx)
// fetches GET /taxation/summary, which contains the full per-section
// Borang B breakdown at `borangB.partD.sections` — but the page currently
// renders none of it (see e2e-report.md "Findings" for the DOM gap). Since
// there is no visible D1-D20 breakdown in the UI to assert against, this
// test drives the real page in a real browser and asserts on the exact
// network response the page itself loaded and would need to render — the
// closest thing to "the page shows X" that the current UI supports.
test.describe('Taxation — Borang B includes the payment voucher, excludes non-deductible', () => {
  test('D2 carries the RM1800 payment voucher; no section includes the RM183.50 in 6995', async ({ page }) => {
    const responsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/v1/taxation/summary') && res.url().includes('year=2026'),
    );
    await page.goto('/taxation');
    await page.locator('#tax-year').selectOption('2026');
    const apiResponse = await responsePromise;
    const body = await apiResponse.json();

    const sections = body.borangB.partD.sections;
    const d2 = sections.find((s) => s.code === 'D2');
    expect(d2, 'D2 section missing from response').toBeTruthy();
    expect(d2.amount).toBeCloseTo(1800.0, 2);

    // The RM183.50 in account 6995 (Non-Deductible Expenses) must not
    // surface in ANY Borang B section — 6995 has no borang_b_section, so
    // the GL query excludes it by construction.
    for (const section of sections) {
      expect(section.amount).not.toBeCloseTo(183.5, 2);
    }
    const totalAcrossSections = sections.reduce((sum, s) => sum + s.amount, 0);
    expect(totalAcrossSections).toBeCloseTo(body.borangB.partD.totalExpenses, 2);
  });
});
