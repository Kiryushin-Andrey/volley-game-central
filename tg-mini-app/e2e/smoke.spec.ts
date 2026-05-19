import { test, expect } from '@playwright/test';

test.describe('smoke', () => {
  test('landing page renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
  });
});
