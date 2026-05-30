import { expect, test, type Page } from '@playwright/test';
import {
  assignPlayerLevelViaApi,
  cleanupE2eData,
  createDevUserViaApi,
  createGameViaUi,
  daysFromNow,
  devLogin,
  devLoginAs,
  e2eTitle,
  registerForGameViaUi,
  switchToUser,
  waitForBackend,
} from './support/fixtures';

const LEVEL_FILTER_LABELS = ['Unassigned', 'Advanced', 'Intermediate', 'Beginner'] as const;

async function setPlayerLevelFilters(page: Page, activeLabels: readonly string[]) {
  const filter = page.getByLabel('Filter by level');
  await filter.locator('.category-multiselect-trigger').click();
  for (const label of LEVEL_FILTER_LABELS) {
    const option = filter.locator('label.category-multiselect-option').filter({ hasText: label });
    const shouldBeChecked = activeLabels.includes(label);
    const isChecked = await option.locator('input[type="checkbox"]').isChecked();
    if (isChecked !== shouldBeChecked) {
      await option.click();
    }
  }
  await filter.locator('.category-multiselect-trigger').click();
}

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
    await expect(page.getByLabel('Filter by level')).toBeVisible();
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

    await expect(page.locator('.level-pill--intermediate')).toBeVisible();
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

    await page.getByRole('link', { name: 'Manage player levels' }).click();
    await expect(page.getByRole('heading', { name: 'Player levels' })).toBeVisible();
    await page.getByPlaceholder('Filter by name...').fill(player.displayName);
    await page.getByText(player.displayName, { exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Player details' })).toBeVisible();
    await page.getByRole('button', { name: 'Advanced' }).click();
    await page.getByLabel('Close').click();

    await expect(page.locator('.level-pill--advanced')).toBeVisible();
  });

  test('E2E-LEVELS-006 TC-only user is redirected from Players hub', async ({ page, request }, testInfo) => {
    const tcUser = await createDevUserViaApi(request, testInfo, 'Levels TC Hub', false, true);
    await devLoginAs(page, tcUser);

    await page.goto('/players');
    await expect(page).toHaveURL('/player-levels');
  });

  test('E2E-LEVELS-007 set by shows assigner display name on list and dialog', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Levels Audit Admin', true);
    const player = await createDevUserViaApi(request, testInfo, 'Levels Audit Target');
    await devLoginAs(page, admin);

    await page.goto('/player-levels');
    await page.getByPlaceholder('Filter by name...').fill(player.displayName);
    await page.getByText(player.displayName, { exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Player details' })).toBeVisible();
    await page.getByRole('button', { name: 'Beginner' }).click();
    await expect(
      page.locator('.player-info-dialog').getByText(`Set by ${admin.displayName}`),
    ).toBeVisible();
    await page.getByLabel('Close').click();
    await expect(
      page.locator('.player-level-set-by').getByText(`Set by ${admin.displayName}`),
    ).toBeVisible();
  });

  test('E2E-LEVELS-008 global admin uses level multiselect combined with name filter', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Levels Filter Admin', true);
    const beginner = await createDevUserViaApi(request, testInfo, 'Levels Filter Beginner');
    const advanced = await createDevUserViaApi(request, testInfo, 'Levels Filter Advanced');
    const unassigned = await createDevUserViaApi(request, testInfo, 'Levels Filter Unassigned');
    await assignPlayerLevelViaApi(request, testInfo, beginner.id, 'beginner');
    await assignPlayerLevelViaApi(request, testInfo, advanced.id, 'advanced');
    await devLoginAs(page, admin);

    await page.goto('/player-levels');
    await setPlayerLevelFilters(page, ['Beginner']);
    await expect(page.getByText(beginner.displayName, { exact: true })).toBeVisible();
    await expect(page.getByText(advanced.displayName, { exact: true })).toHaveCount(0);
    await expect(page.getByText(unassigned.displayName, { exact: true })).toHaveCount(0);

    await setPlayerLevelFilters(page, ['Unassigned']);
    await expect(page.getByText(unassigned.displayName, { exact: true })).toBeVisible();
    await expect(page.getByText(beginner.displayName, { exact: true })).toHaveCount(0);

    await setPlayerLevelFilters(page, LEVEL_FILTER_LABELS);
    await page.getByPlaceholder('Filter by name...').fill('Advanced');
    await expect(page.getByText(advanced.displayName, { exact: true })).toBeVisible();
    await expect(page.getByText(beginner.displayName, { exact: true })).toHaveCount(0);

    await setPlayerLevelFilters(page, ['Beginner']);
    await expect(page.getByText(advanced.displayName, { exact: true })).toHaveCount(0);
    await expect(page.getByText(beginner.displayName, { exact: true })).toHaveCount(0);
  });

  test('E2E-LEVELS-009 TC-only sees read-only level on game details without payment or moderation', async ({
    page,
    request,
  }, testInfo) => {
    const globalAdmin = await createDevUserViaApi(request, testInfo, 'Levels TC Dialog GA', true);
    const tcUser = await createDevUserViaApi(request, testInfo, 'Levels TC Dialog TC', false, true);
    const player = await createDevUserViaApi(request, testInfo, 'Levels TC Dialog Player');
    await assignPlayerLevelViaApi(request, testInfo, player.id, 'intermediate');
    await devLoginAs(page, globalAdmin);
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'TC Dialog Game'),
      dateTime: daysFromNow(2),
    });
    await registerForGameViaUi(page, player, game.id);

    await switchToUser(page, tcUser);
    await page.goto(`/game/${game.id}`);
    await page
      .locator('.player-item')
      .filter({ hasText: player.displayName })
      .locator('.player-details')
      .click();

    const dialog = page.locator('.player-info-dialog');
    await expect(dialog.getByRole('heading', { name: 'Player details' })).toBeVisible();
    await expect(dialog.getByText('Player level')).toBeVisible();
    await expect(dialog.getByText('Intermediate')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Beginner' })).toHaveCount(0);
    await expect(dialog.getByText('Unpaid games')).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Block' })).toHaveCount(0);
  });

  test('E2E-LEVELS-010 global admin sees read-only level on game details', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Levels GA Dialog Admin', true);
    const player = await createDevUserViaApi(request, testInfo, 'Levels GA Dialog Player');
    await assignPlayerLevelViaApi(request, testInfo, player.id, 'advanced');
    await devLoginAs(page, admin);
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'GA Dialog Game'),
      dateTime: daysFromNow(2),
    });
    await registerForGameViaUi(page, player, game.id);
    await switchToUser(page, admin);
    await page.goto(`/game/${game.id}`);
    await page
      .locator('.player-item')
      .filter({ hasText: player.displayName })
      .locator('.player-details')
      .click();

    const dialog = page.locator('.player-info-dialog');
    await expect(dialog.getByText('Player level')).toBeVisible();
    await expect(dialog.getByText('Advanced')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Beginner' })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Block' })).toBeVisible();
  });

  test('E2E-LEVELS-011 assigned-only admin dialog has no level fields', async ({ page, request }, testInfo) => {
    const globalAdmin = await createDevUserViaApi(request, testInfo, 'Levels Assign Dialog GA', true);
    const assignedAdmin = await createDevUserViaApi(request, testInfo, 'Levels Assign Dialog AA');
    const player = await createDevUserViaApi(request, testInfo, 'Levels Assign Dialog Player');
    await devLoginAs(page, globalAdmin);
    await page.goto('/players');
    await page.getByRole('link', { name: 'Game administrators' }).click();
    await page.getByRole('button', { name: 'Add Assignment' }).click();
    await page.getByLabel('Day of Week').selectOption('6');
    await page.getByPlaceholder('Search for a user...').fill(assignedAdmin.displayName);
    await page.getByText(assignedAdmin.displayName, { exact: true }).click();
    await page.getByRole('button', { name: 'Create' }).click();

    await switchToUser(page, assignedAdmin);
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Assign Dialog Game'),
      dateTime: daysFromNow(2),
    });
    await registerForGameViaUi(page, player, game.id);
    await switchToUser(page, assignedAdmin);
    await page.goto(`/game/${game.id}`);
    await page
      .locator('.player-item')
      .filter({ hasText: player.displayName })
      .locator('.player-details')
      .click();

    const dialog = page.locator('.player-info-dialog');
    await expect(dialog.getByRole('heading', { name: 'Player details' })).toBeVisible();
    await expect(dialog.getByText('Player level')).toHaveCount(0);
    await expect(dialog.getByText('Unassigned')).toHaveCount(0);
  });
});
