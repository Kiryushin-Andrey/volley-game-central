import { expect, test } from '@playwright/test';
import {
  cleanupE2eData,
  createDevUserViaApi,
  devLogin,
  devLoginAs,
  switchToUser,
  waitForBackend,
} from './support/fixtures';

test.describe('player levels admin scenarios', () => {
  test.beforeEach(async ({ request }) => {
    await waitForBackend(request);
    await cleanupE2eData();
  });

  test('E2E-LEVELS-001 global admin opens Players hub and player levels', async ({ page }, testInfo) => {
    await devLogin(page, testInfo, 'Levels Hub Admin', true);

    await page.getByTitle('Players').click();
    await expect(page.getByRole('heading', { name: 'Players' })).toBeVisible();
    await page.getByRole('link', { name: 'Player levels' }).click();
    await expect(page.getByRole('heading', { name: 'Player levels' })).toBeVisible();
    await expect(page.getByPlaceholder('Filter by name...')).toBeVisible();
  });

  test('E2E-LEVELS-002 global admin assigns player level via dialog', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Levels Assign Admin', true);
    const player = await createDevUserViaApi(request, testInfo, 'Levels Target Player');
    await devLoginAs(page, admin);

    await page.goto('/player-levels');
    await page.getByPlaceholder('Filter by name...').fill(player.displayName);
    await page.getByText(player.displayName, { exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Player details' })).toBeVisible();
    await page.getByRole('button', { name: 'Intermediate' }).click();
    await page.getByLabel('Close').click();

    await expect(page.getByText('Intermediate')).toBeVisible();
  });

  test('E2E-LEVELS-003 non-admin cannot open player levels routes', async ({ page, request }, testInfo) => {
    const participant = await createDevUserViaApi(request, testInfo, 'Levels Participant');
    await devLoginAs(page, participant);

    await page.goto('/players');
    await expect(page).toHaveURL('/');
    await page.goto('/player-levels');
    await expect(page).toHaveURL('/');
  });

  test('E2E-LEVELS-004 assigned admin has no Players toolbar link', async ({ page, request }, testInfo) => {
    const globalAdmin = await createDevUserViaApi(request, testInfo, 'Levels GA', true);
    const assignedAdmin = await createDevUserViaApi(request, testInfo, 'Levels Assigned');
    await devLoginAs(page, globalAdmin);
    await page.goto('/players');
    await page.getByRole('link', { name: 'Game administrators' }).click();
    await page.getByRole('button', { name: 'Add Assignment' }).click();
    await page.getByLabel('Day of Week').selectOption('6');
    await page.getByPlaceholder('Search for a user...').fill(assignedAdmin.displayName);
    await page.getByText(assignedAdmin.displayName, { exact: true }).click();
    await page.getByRole('button', { name: 'Create' }).click();

    await switchToUser(page, assignedAdmin);
    await expect(page.getByTitle('Players')).toHaveCount(0);
  });

  test('E2E-LEVELS-005 TC-only user opens player levels and assigns level via dialog', async ({ page, request }, testInfo) => {
    const tcUser = await createDevUserViaApi(request, testInfo, 'Levels TC User', false, true);
    const player = await createDevUserViaApi(request, testInfo, 'Levels TC Target');
    await devLoginAs(page, tcUser);

    await page.getByTitle('Players').click();
    await expect(page.getByRole('heading', { name: 'Player levels' })).toBeVisible();
    await page.getByPlaceholder('Filter by name...').fill(player.displayName);
    await page.getByText(player.displayName, { exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Player details' })).toBeVisible();
    await page.getByRole('button', { name: 'Advanced' }).click();
    await page.getByLabel('Close').click();

    await expect(page.getByText('Advanced')).toBeVisible();
  });

  test('E2E-LEVELS-006 TC-only user is redirected from Players hub', async ({ page, request }, testInfo) => {
    const tcUser = await createDevUserViaApi(request, testInfo, 'Levels TC Hub', false, true);
    await devLoginAs(page, tcUser);

    await page.goto('/players');
    await expect(page).toHaveURL('/player-levels');
  });
});
