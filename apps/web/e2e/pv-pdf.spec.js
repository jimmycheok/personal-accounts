import { test, expect } from '@playwright/test';

/**
 * Regression test for: clicking PDF on a Payment Voucher opened a new tab
 * showing {"error":"No token provided"}.
 *
 * Cause: PaymentVoucherDetail used window.open() on the API URL directly. A
 * raw browser navigation never passes through the axios request interceptor
 * (services/api.js), which is the only thing that attaches the
 * `Authorization: Bearer <token>` header from localStorage — so verifyJwt
 * rejected it. Every other PDF in the app fetches via axios as a blob.
 *
 * The voucher PDF now downloads (matching Invoices and Quotations) rather
 * than previewing in a tab.
 *
 * These assertions fail against the old implementation: the unauthenticated
 * navigation returns 401 with a JSON body, not 200 with application/pdf.
 */

// PV 6 / PV-202607-0005 is `approved`; the PDF button only renders for
// approved vouchers.
const APPROVED_PV_ID = 6;

// Every test here renders a PDF through the Gotenberg sidecar. Running them
// concurrently puts three simultaneous render requests on one external
// service for no benefit — serialise so a cold or busy Gotenberg can't turn
// into a spurious failure.
test.describe.configure({ mode: 'serial' });

test.describe('Payment Voucher PDF', () => {
  test('PDF request carries the JWT and returns a real PDF, not a 401 JSON error', async ({ page }) => {
    await page.goto(`/payment-vouchers/${APPROVED_PV_ID}`);

    const pdfButton = page.getByRole('button', { name: 'PDF' });
    await expect(pdfButton).toBeVisible();

    const [response] = await Promise.all([
      page.waitForResponse(
        (r) => /\/payment-vouchers\/\d+\/pdf/.test(r.url()),
        { timeout: 20_000 },
      ),
      pdfButton.click(),
    ]);

    // The bug produced 401 {"error":"No token provided"} here.
    expect(
      response.request().headers()['authorization'],
      'the PDF request must carry the JWT — a raw window.open() does not',
    ).toMatch(/^Bearer /);

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/pdf');

    const body = await response.body();
    expect(body.length).toBeGreaterThan(0);
    // A real PDF starts with %PDF-
    expect(body.subarray(0, 5).toString()).toBe('%PDF-');
  });

  test('clicking PDF downloads the voucher named after its PV number', async ({ page }) => {
    await page.goto(`/payment-vouchers/${APPROVED_PV_ID}`);

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 20_000 }),
      page.getByRole('button', { name: 'PDF' }).click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/^PV-\d{6}-\d{4}\.pdf$/);
  });

  test('no error notification is shown after downloading the PDF', async ({ page }) => {
    await page.goto(`/payment-vouchers/${APPROVED_PV_ID}`);

    await page.getByRole('button', { name: 'PDF' }).click();
    await page.waitForResponse((r) => /\/payment-vouchers\/\d+\/pdf/.test(r.url()));

    await expect(page.getByText(/No token provided/i)).toHaveCount(0);
    await expect(page.getByText(/Failed to (open|download)/i)).toHaveCount(0);
  });
});
