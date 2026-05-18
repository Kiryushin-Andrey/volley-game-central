import { expect, test } from '@playwright/test';
import {
  cleanupE2eData,
  countRegistrations,
  createAdminAssignment,
  createDevUserViaApi,
  createGame,
  daysFromNow,
  devLogin,
  devLoginAs,
  e2eTitle,
  findGameById,
  nextWeekday,
  registerUser,
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

test.describe('game administration scenarios', () => {
  test.beforeEach(async ({ request }) => {
    await waitForBackend(request);
    await cleanupE2eData();
  });

  test('E2E-ADMIN-001 global admin deletes an upcoming game after confirming', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Delete Admin', true);
    const game = await createGame({ title: e2eTitle(testInfo, 'Delete Upcoming'), createdById: admin.id, dateTime: daysFromNow(2) });

    await devLoginAs(page, admin);
    await page.goto(`/game/${game.id}`);
    await page.getByTitle('Delete Game').click();
    await confirmDialog(page, true);

    await expect(page).toHaveURL('/');
    expect(await findGameById(game.id)).toBeNull();
  });

  test('E2E-ADMIN-002 global admin cancels delete and game remains available', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Cancel Delete Admin', true);
    const title = e2eTitle(testInfo, 'Cancel Delete Game');
    const game = await createGame({ title, createdById: admin.id, dateTime: daysFromNow(2) });

    await devLoginAs(page, admin);
    await page.goto(`/game/${game.id}`);
    await page.getByTitle('Delete Game').click();
    await confirmDialog(page, false);

    await expect(page.getByText(title)).toBeVisible();
    expect(await findGameById(game.id)).toBeTruthy();
  });

  test('E2E-ADMIN-003 global admin adds an existing user to a readonly game', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Add Participant Admin', true);
    const targetUser = await createDevUserViaApi(request, testInfo, 'Added Participant');
    const game = await createGame({
      title: e2eTitle(testInfo, 'Readonly Add Participant'),
      createdById: admin.id,
      dateTime: daysFromNow(2),
      readonly: true,
    });

    await devLoginAs(page, admin);
    await page.goto(`/game/${game.id}`);
    await page.locator('.admin-actions').getByRole('button', { name: 'Add Participant' }).click();
    await page.getByPlaceholder('Search users to add...').fill(targetUser.displayName);
    await page.getByText(targetUser.displayName).click();

    await expect(page.getByText(targetUser.displayName)).toBeVisible();
    await expect.poll(() => countRegistrations(game.id)).toBe(1);
  });

  test('E2E-ADMIN-004 global admin removes a player and players list updates', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Remove Player Admin', true);
    const player = await createDevUserViaApi(request, testInfo, 'Removed Player');
    const game = await createGame({
      title: e2eTitle(testInfo, 'Readonly Remove Player'),
      createdById: admin.id,
      dateTime: daysFromNow(2),
      readonly: true,
    });
    await registerUser(game.id, player.id, new Date());

    await devLoginAs(page, admin);
    await page.goto(`/game/${game.id}`);
    await removePlayerByName(page, player.displayName);

    await expect(page.getByText(player.displayName)).toHaveCount(0);
    expect(await countRegistrations(game.id)).toBe(0);
  });

  test('E2E-ADMIN-005 global admin removes a waitlisted player and waiting list updates', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Waitlist Remove Admin', true);
    const activePlayer = await createDevUserViaApi(request, testInfo, 'Active Waitlist Seed');
    const waitlistedPlayer = await createDevUserViaApi(request, testInfo, 'Waitlisted Removed');
    const game = await createGame({
      title: e2eTitle(testInfo, 'Readonly Remove Waitlist'),
      createdById: admin.id,
      dateTime: daysFromNow(2),
      maxPlayers: 1,
      readonly: true,
    });
    await registerUser(game.id, activePlayer.id, new Date(Date.now() - 60_000));
    await registerUser(game.id, waitlistedPlayer.id, new Date());

    await devLoginAs(page, admin);
    await page.goto(`/game/${game.id}`);
    await expect(page.getByText('Waiting List')).toBeVisible();
    await removePlayerByName(page, waitlistedPlayer.displayName);

    await expect(page.getByText(waitlistedPlayer.displayName)).toHaveCount(0);
    await expect(page.getByText('Waiting List')).toHaveCount(0);
    expect(await countRegistrations(game.id)).toBe(1);
  });

  test('E2E-ADMIN-006 global admin opens player info from a player row', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Player Info Admin', true);
    const player = await createDevUserViaApi(request, testInfo, 'Player Info Target');
    const game = await createGame({
      title: e2eTitle(testInfo, 'Player Info Game'),
      createdById: admin.id,
      dateTime: daysFromNow(2),
      readonly: true,
    });
    await registerUser(game.id, player.id, new Date());

    await devLoginAs(page, admin);
    await page.goto(`/game/${game.id}`);
    await page.locator('.player-item').filter({ hasText: player.displayName }).locator('.player-details').click();

    await expect(page.getByRole('heading', { name: 'Player details' })).toBeVisible();
    await expect(page.getByText('Display Name')).toBeVisible();
    await expect(page.locator('.player-info-dialog').getByText(player.displayName)).toBeVisible();
  });

  test('E2E-ADMIN-007 assigned admin can manage games for assigned day and type', async ({ page, request }, testInfo) => {
    const globalAdmin = await createDevUserViaApi(request, testInfo, 'Assignment Creator', true);
    const assignedAdmin = await createDevUserViaApi(request, testInfo, 'Assigned Game Admin');
    await createAdminAssignment(6, false, assignedAdmin.id);
    const game = await createGame({
      title: e2eTitle(testInfo, 'Assigned Managed Game'),
      createdById: globalAdmin.id,
      dateTime: nextWeekday(0),
      withPositions: false,
    });

    await devLoginAs(page, assignedAdmin);
    await page.goto(`/game/${game.id}`);

    await expect(page.getByTitle('Edit Game Settings')).toBeVisible();
  });

  test('E2E-ADMIN-008 assigned admin cannot access global-only assignment management', async ({ page, request }, testInfo) => {
    const assignedAdmin = await createDevUserViaApi(request, testInfo, 'Not Global Admin');
    await createAdminAssignment(6, false, assignedAdmin.id);

    await devLoginAs(page, assignedAdmin);
    await page.goto('/game-administrators');

    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: 'Game Administrators' })).toHaveCount(0);
  });

  test('E2E-ADMIN-009 non-admin cannot use create/edit/admin-only screens by direct URL', async ({ page, request }, testInfo) => {
    const globalAdmin = await createDevUserViaApi(request, testInfo, 'Blocked Route Admin', true);
    const game = await createGame({ title: e2eTitle(testInfo, 'Blocked Route Game'), createdById: globalAdmin.id });

    await devLogin(page, testInfo, 'Blocked Route Participant');
    await page.goto('/game-administrators');
    await expect(page).toHaveURL('/');

    await page.goto('/games/new');
    await expect(page.getByRole('heading', { name: 'Create New Game' })).toBeVisible();
    await expect(page.getByText(/Admin or assigned administrator access required|Failed to fetch default date and time/)).toBeVisible();

    await page.goto(`/game/${game.id}`);
    await expect(page.getByTitle('Edit Game Settings')).toHaveCount(0);
  });
});
