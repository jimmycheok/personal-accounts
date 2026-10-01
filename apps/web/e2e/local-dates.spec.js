import { test, expect } from '@playwright/test';

// 07:30 on 1 Nov in Malaysia is still 31 Oct in UTC; default dates must follow local time.
test.use({ timezoneId: 'Asia/Kuala_Lumpur' });

test('Cash Flow requests whole local months ending today', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-01T07:30:00+08:00'));
  const request = page.waitForRequest((r) => r.url().includes('/api/v1/cash-flow/actual'));
  await page.goto('/cash-flow');

  const params = new URL((await request).url()).searchParams;
  expect(params.get('from')).toBe('2026-06-01');
  expect(params.get('to')).toBe('2026-11-01');
});
