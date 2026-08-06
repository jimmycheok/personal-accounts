import { test, expect } from '@playwright/test';

// Companion coverage for the responsive AppShell fix: at narrow widths the
// side nav starts closed (that's what explainers.spec.js's ~600px tests
// exercise as the normal landing state) and is opened/closed via the
// hamburger button, overlaying content rather than displacing it.
//
// Note: the nav's <a> links stay in the DOM and read as "visible" to
// Playwright's accessibility-tree check even while the nav panel itself is
// collapsed to zero width (they're clipped away by an ancestor, not
// display:none'd) — so this asserts against the nav panel's own bounding
// box rather than a link's visibility.
test.describe('responsive side navigation', () => {
  test('hamburger opens the side nav as an overlay and closes it on outside click', async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 900 });
    await page.goto('/expenses');

    const openButton = page.getByRole('button', { name: 'Open menu' });
    await expect(openButton).toBeVisible();

    const sideNav = page.getByRole('navigation', { name: 'Side navigation' });

    // Closed by default: the nav panel is collapsed to zero width.
    await expect(async () => {
      const box = await sideNav.boundingBox();
      expect(box.width).toBe(0);
    }).toPass();

    await openButton.click();
    const closeButton = page.getByRole('button', { name: 'Close menu' });
    await expect(closeButton).toBeVisible();

    await expect(async () => {
      const box = await sideNav.boundingBox();
      expect(box.width).toBeGreaterThan(0);
    }).toPass();

    // The "Dashboard" link is now genuinely usable, not just in the DOM.
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeInViewport();

    // Click at a raw page coordinate well outside the open nav panel (and
    // below the header). The overlay backdrop is a fixed, higher-stacked
    // element that covers the rest of the viewport while open, so this
    // hits the backdrop rather than whatever page content sits beneath it.
    await page.mouse.click(450, 300);

    await expect(openButton).toBeVisible();
    await expect(async () => {
      const box = await sideNav.boundingBox();
      expect(box.width).toBe(0);
    }).toPass();
  });
});
