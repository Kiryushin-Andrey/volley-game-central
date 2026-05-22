import { expect, test } from '@playwright/test';
import {
  cleanupE2eData,
  createDevUserViaApi,
  devLogin,
  devLoginAs,
  waitForBackend,
} from './support/fixtures';

test.describe('player levels admin scenarios', () => {
  test.beforeEach(async ({ request }) => {
    await waitForBackend(request);
    await cleanupE2eData();
  });

  test('E2E-LEVEL-001 global admin opens Players hub from games home', async ({ page }, testInfo) => {
    await devLogin(page, testInfo, 'Players Hub Admin', true);
    await page.getByRole('link', { name: 'Players' }).click();

    await expect(page).toHaveURL('/players');
    await expect(page.getByRole('heading', { name: 'Players' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Game administrators' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Player levels' })).toBeVisible();
  });

  test('E2E-LEVEL-002 global admin assigns player level from player levels page', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Level Assign Admin', true);
    const target = await createDevUserViaApi(request, testInfo, 'Level Assign Target');

    await devLoginAs(page, admin);
    await page.goto('/player-levels');
    await expect(page.getByRole('heading', { name: 'Player levels' })).toBeVisible();
    await expect(page.getByText(target.displayName)).toBeVisible();

    await page.getByText(target.displayName).click();
    await expect(page.getByRole('heading', { name: 'Player details' })).toBeVisible();
    await page.locator('.player-level-select').selectOption('intermediate');
    await expect(page.locator('.player-level-select')).toHaveValue('intermediate');

    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('.player-levels-item').filter({ hasText: target.displayName }).getByText('Intermediate')).toBeVisible();
  });

  test('E2E-LEVEL-003 name filter hides non-matching players client-side', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Level Filter Admin', true);
    const alpha = await createDevUserViaApi(request, testInfo, 'Alpha Filter Player');
    const beta = await createDevUserViaApi(request, testInfo, 'Beta Filter Player');

    await devLoginAs(page, admin);
    await page.goto('/player-levels');
    await expect(page.getByText(alpha.displayName)).toBeVisible();
    await expect(page.getByText(beta.displayName)).toBeVisible();

    await page.getByLabel('Filter by name').fill('Alpha Filter');
    await expect(page.getByText(alpha.displayName)).toBeVisible();
    await expect(page.getByText(beta.displayName)).toHaveCount(0);
  });

  test('E2E-LEVEL-004 non-admin cannot access players hub or player levels', async ({ page, request }, testInfo) => {
    const participant = await createDevUserViaApi(request, testInfo, 'Level Blocked Participant');
    await devLoginAs(page, participant);

    await page.goto('/players');
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: 'Players' })).toHaveCount(0);

    await page.goto('/player-levels');
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: 'Player levels' })).toHaveCount(0);
  });
});
