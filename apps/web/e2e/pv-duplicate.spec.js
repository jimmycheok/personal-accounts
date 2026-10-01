import { test, expect } from '@playwright/test';

// Read-only: every modal is cancelled, so no voucher is created.
test.describe('Payment Voucher duplicate', () => {
  test('prefills a new voucher from the source, and the next New voucher starts empty', async ({ page }) => {
    await page.goto('/payment-vouchers');

    // Today's date as the picker renders it, whatever its display format.
    await page.getByRole('button', { name: 'New Payment Voucher' }).click();
    const today = await page.locator('#pv-date').inputValue();
    await page.getByRole('button', { name: 'Cancel' }).click();

    const sourceResponse = page.waitForResponse((r) => /\/payment-vouchers\/\d+$/.test(new URL(r.url()).pathname));
    await page.getByRole('button', { name: 'Options' }).first().click();
    await page.getByRole('menuitem', { name: 'Duplicate' }).click();
    const source = await (await sourceResponse).json();

    await expect(page.locator('#pv-payee')).toHaveValue(source.payee_name);
    await expect(page.locator('#pv-bank')).toHaveValue(source.payee_bank_name || '');
    await expect(page.locator('#pv-acct')).toHaveValue(source.payee_bank_account || '');
    await expect(page.locator('#pv-method')).toHaveValue(source.payment_method);
    await expect(page.locator('#pv-ref')).toHaveValue('');
    await expect(page.locator('#pv-date')).toHaveValue(today);

    await expect(page.locator('[id^="pv-item-"]')).toHaveCount(source.lines.length);
    for (const [idx, line] of source.lines.entries()) {
      await expect(page.locator(`#pv-item-${idx}`)).toHaveValue(line.service_item || '');
      expect(Number(await page.locator(`#pv-amt-${idx}`).inputValue())).toBe(Number(line.amount));
    }

    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.getByRole('button', { name: 'New Payment Voucher' }).click();
    await expect(page.locator('#pv-payee')).toHaveValue('');
    await expect(page.locator('[id^="pv-item-"]')).toHaveCount(1);
    await expect(page.locator('#pv-item-0')).toHaveValue('');
  });
});
