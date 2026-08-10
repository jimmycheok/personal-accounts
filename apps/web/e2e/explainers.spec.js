import { test, expect } from '@playwright/test';

const NORMAL_VIEWPORT = { width: 1280, height: 800 };
const NARROW_VIEWPORT = { width: 600, height: 900 };

const cases = [
  {
    path: '/expenses',
    heading: 'Expenses',
    button: 'Add Expense',
    boldPhrase: 'the seller gave you the paperwork',
    fullSentence:
      'Money you spent where the seller gave you the paperwork — a receipt, bill or supplier invoice. Record it here and attach their document.',
  },
  {
    path: '/payment-vouchers',
    heading: 'Payment Vouchers',
    button: 'New Payment Voucher',
    boldPhrase: 'you have to produce the paperwork',
    fullSentence:
      'Money you paid where you have to produce the paperwork — typically a freelancer or contractor with no invoice to give you. Issue a voucher as the record.',
  },
];

for (const c of cases) {
  test.describe(`${c.path} explainer`, () => {
    test(`shows the explainer copy with the key phrase rendered bold`, async ({ page }) => {
      await page.setViewportSize(NORMAL_VIEWPORT);
      await page.goto(c.path);

      const heading = page.getByRole('heading', { level: 1, name: c.heading });
      await expect(heading).toBeVisible();

      // Full explainer sentence is present verbatim (normalizes internal whitespace).
      const paragraph = page.locator('p', { hasText: c.boldPhrase });
      await expect(paragraph).toBeVisible();
      const normalized = (await paragraph.innerText()).replace(/\s+/g, ' ').trim();
      expect(normalized).toBe(c.fullSentence);

      // The key phrase is inside a real <strong> element...
      const strong = paragraph.locator('strong');
      await expect(strong).toHaveText(c.boldPhrase);

      // ...and it actually renders heavier than the surrounding paragraph text,
      // not just semantically marked up with no visual effect.
      const strongWeight = Number(await strong.evaluate((el) => getComputedStyle(el).fontWeight));
      const paragraphWeight = Number(await paragraph.evaluate((el) => getComputedStyle(el).fontWeight));
      expect(strongWeight).toBeGreaterThan(paragraphWeight);
    });

    test(`action button stays right-aligned and on-screen at a normal viewport`, async ({ page }) => {
      await page.setViewportSize(NORMAL_VIEWPORT);
      await page.goto(c.path);

      const heading = page.getByRole('heading', { level: 1, name: c.heading });
      const textColumn = heading.locator('xpath=..'); // the div wrapping <h1> + ModuleIntro
      const button = page.getByRole('button', { name: c.button, exact: true });
      await expect(button).toBeVisible();

      const textBox = await textColumn.boundingBox();
      const btnBox = await button.boundingBox();
      expect(textBox).toBeTruthy();
      expect(btnBox).toBeTruthy();

      // Button sits to the right of the text column (no overlap)...
      expect(btnBox.x).toBeGreaterThanOrEqual(textBox.x + textBox.width);
      // ...and is fully within the viewport, not clipped or pushed off-screen.
      expect(btnBox.x + btnBox.width).toBeLessThanOrEqual(NORMAL_VIEWPORT.width);
      expect(btnBox.x).toBeGreaterThanOrEqual(0);
    });

    test(`action button stays right-aligned and on-screen at ~600px wide`, async ({ page }) => {
      await page.setViewportSize(NARROW_VIEWPORT);
      await page.goto(c.path);

      const heading = page.getByRole('heading', { level: 1, name: c.heading });
      const textColumn = heading.locator('xpath=..');
      const button = page.getByRole('button', { name: c.button, exact: true });
      await expect(button).toBeVisible();

      const textBox = await textColumn.boundingBox();
      const btnBox = await button.boundingBox();
      expect(textBox).toBeTruthy();
      expect(btnBox).toBeTruthy();

      expect(btnBox.x).toBeGreaterThanOrEqual(textBox.x + textBox.width);
      expect(btnBox.x + btnBox.width).toBeLessThanOrEqual(NARROW_VIEWPORT.width);
      expect(btnBox.x).toBeGreaterThanOrEqual(0);
    });
  });
}
