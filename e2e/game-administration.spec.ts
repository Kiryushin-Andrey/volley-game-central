import { expect, test } from '@playwright/test';
import {
  cleanupE2eData,
  countRegistrations,
  createDevUserViaApi,
  createGameViaUi,
  daysFromNow,
  devLoginAs,
  e2eTitle,
  nextWeekday,
  switchToUser,
  waitForBackend,
} from './support/fixtures';

async function confirmDialog(page: import('@playwright/test').Page, confirm = true) {
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: confirm ? 'OK' : 'Cancel' }).click();
}

async function removePlayerByName(page: import('@playwright/test').Page, displayName: string) {
  const row = page.locator('.player-item').filter({ hasText: displayName }).first();
  await row.getByRole('button', { name: 'Remove player' }).click();
  await confirmDialog(page, true);
  await expect(page.getByRole('dialog').getByText('Success')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'OK' }).click();
}

async function addParticipantViaUi(page: import('@playwright/test').Page, displayName: string) {
  await page.locator('.admin-actions').getByRole('button', { name: 'Add Participant' }).click();
  await page.getByPlaceholder('Search users to add...').fill(displayName);
  await page.getByText(displayName).click();
  await expect(page.getByText(displayName)).toBeVisible();
}

async function createAdminAssignmentViaUi(page: import('@playwright/test').Page, userDisplayName: string) {
  await page.goto('/game-administrators');
  await expect(page.getByRole('heading', { name: 'Game Administrators' })).toBeVisible();
  await page.getByRole('button', { name: 'Add Assignment' }).click();
  await page.getByLabel('Day of Week').selectOption('6');
  await page.getByPlaceholder('Search for a user...').fill(userDisplayName);
  await page.getByText(userDisplayName).click();
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText(userDisplayName)).toBeVisible();
}

test.describe('game administration scenarios', () => {
  test.beforeEach(async ({ request }) => {
    await waitForBackend(request);
    await cleanupE2eData();
  });

  test('E2E-ADMIN-001 global admin deletes an upcoming game after confirming', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Delete Admin', true);

    await devLoginAs(page, admin);
    const game = await createGameViaUi(page, { title: e2eTitle(testInfo, 'Delete Upcoming'), dateTime: daysFromNow(2) });
    await page.goto(`/game/${game.id}`);
    await page.getByTitle('Delete Game').click();
    await confirmDialog(page, true);

    await expect(page).toHaveURL('/');
    await page.goto(`/game/${game.id}`);
    await expect(page.getByRole('heading', { name: 'Error' })).toBeVisible();
  });

  test('E2E-ADMIN-002 global admin cancels delete and game remains available', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Cancel Delete Admin', true);
    const title = e2eTitle(testInfo, 'Cancel Delete Game');

    await devLoginAs(page, admin);
    const game = await createGameViaUi(page, { title, dateTime: daysFromNow(2) });
    await page.goto(`/game/${game.id}`);
    await page.getByTitle('Delete Game').click();
    await confirmDialog(page, false);

    await expect(page.getByText(title)).toBeVisible();
  });

  test('E2E-ADMIN-003 global admin adds an existing user to a readonly or past game', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Add Participant Admin', true);
    const readonlyTarget = await createDevUserViaApi(request, testInfo, 'Readonly Added Participant');
    const pastTarget = await createDevUserViaApi(request, testInfo, 'Past Added Participant');
    await devLoginAs(page, admin);

    const readonlyGame = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Readonly Add Participant'),
      dateTime: daysFromNow(2),
      readonly: true,
    });
    await page.goto(`/game/${readonlyGame.id}`);
    await addParticipantViaUi(page, readonlyTarget.displayName);
    await expect.poll(() => countRegistrations(readonlyGame.id)).toBe(1);

    const pastGame = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Past Add Participant'),
      dateTime: daysFromNow(-1),
    });
    await page.goto(`/game/${pastGame.id}`);
    await addParticipantViaUi(page, pastTarget.displayName);
    await expect.poll(() => countRegistrations(pastGame.id)).toBe(1);
  });

  test('E2E-ADMIN-004 global admin removes a player and players list updates', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Remove Player Admin', true);
    const player = await createDevUserViaApi(request, testInfo, 'Removed Player');
    await devLoginAs(page, admin);
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Readonly Remove Player'),
      dateTime: daysFromNow(2),
      readonly: true,
    });

    await page.goto(`/game/${game.id}`);
    await addParticipantViaUi(page, player.displayName);
    await removePlayerByName(page, player.displayName);

    await expect(page.getByText(player.displayName)).toHaveCount(0);
    expect(await countRegistrations(game.id)).toBe(0);
  });

  test('E2E-ADMIN-005 global admin opens player info from a player row', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Player Info Admin', true);
    const player = await createDevUserViaApi(request, testInfo, 'Player Info Target');
    await devLoginAs(page, admin);
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Player Info Game'),
      dateTime: daysFromNow(2),
      readonly: true,
    });

    await page.goto(`/game/${game.id}`);
    await addParticipantViaUi(page, player.displayName);
    await page.locator('.player-item').filter({ hasText: player.displayName }).locator('.player-details').click();

    await expect(page.getByRole('heading', { name: 'Player details' })).toBeVisible();
    await expect(page.getByText('Display Name')).toBeVisible();
    await expect(page.locator('.player-info-dialog').getByText(player.displayName)).toBeVisible();
  });

  test('E2E-ADMIN-006 assigned admin can manage games for assigned day and type', async ({ page, request }, testInfo) => {
    const globalAdmin = await createDevUserViaApi(request, testInfo, 'Assignment Creator', true);
    const assignedAdmin = await createDevUserViaApi(request, testInfo, 'Assigned Game Admin');
    await devLoginAs(page, globalAdmin);
    await createAdminAssignmentViaUi(page, assignedAdmin.displayName);

    await switchToUser(page, assignedAdmin);
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Assigned Managed Game'),
      dateTime: nextWeekday(0),
    });
    await page.goto(`/game/${game.id}`);

    await expect(page.getByTitle('Edit Game Settings')).toBeVisible();
  });

  test('E2E-ADMIN-007 assigned admin cannot access global-only assignment management', async ({ page, request }, testInfo) => {
    const globalAdmin = await createDevUserViaApi(request, testInfo, 'Assignment Access Creator', true);
    const assignedAdmin = await createDevUserViaApi(request, testInfo, 'Not Global Admin');
    await devLoginAs(page, globalAdmin);
    await createAdminAssignmentViaUi(page, assignedAdmin.displayName);

    await switchToUser(page, assignedAdmin);
    await page.goto('/game-administrators');

    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: 'Game Administrators' })).toHaveCount(0);
  });

  test('E2E-ADMIN-008 non-admin cannot use create/edit/admin-only screens by direct URL', async ({ page, request }, testInfo) => {
    const globalAdmin = await createDevUserViaApi(request, testInfo, 'Blocked Route Admin', true);
    const participant = await createDevUserViaApi(request, testInfo, 'Blocked Route Participant');
    await devLoginAs(page, globalAdmin);
    const game = await createGameViaUi(page, { title: e2eTitle(testInfo, 'Blocked Route Game') });

    await switchToUser(page, participant);
    await page.goto('/game-administrators');
    await expect(page).toHaveURL('/');

    await page.goto('/games/new');
    await expect(page.getByRole('heading', { name: 'Create New Game' })).toBeVisible();
    await expect(page.getByText(/Admin or assigned administrator access required|Failed to fetch default date and time/)).toBeVisible();

    await page.goto(`/game/${game.id}`);
    await expect(page.getByTitle('Edit Game Settings')).toHaveCount(0);
  });
});
