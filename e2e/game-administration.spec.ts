import { expect, test } from '@playwright/test';
import {
  addParticipantViaUi,
  cleanupE2eData,
  countRegistrations,
  createDevUserViaApi,
  createGameViaUi,
  daysFromNow,
  devLoginAs,
  enableBunqIntegrationViaUi,
  e2eTitle,
  formatGameDateTimeForInput,
  moveGameToPastViaUi,
  nextWeekday,
  resetBunqMock,
  sendPaymentRequestsViaUi,
  switchToUser,
  waitForAdminGameCreateResponse,
  waitForAdminGameUpdateResponse,
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

type AdminAssignmentViaUiOptions = {
  /** Game Administrators form value: Monday = 0 … Sunday = 6 */
  dayOptionValue?: string;
  withPositions?: boolean;
};

async function createAdminAssignmentViaUi(
  page: import('@playwright/test').Page,
  userDisplayName: string,
  options?: AdminAssignmentViaUiOptions
) {
  const dayOptionValue = options?.dayOptionValue ?? '6';
  const withPositions = options?.withPositions ?? false;

  await page.goto('/game-administrators');
  await expect(page.getByRole('heading', { name: 'Game Administrators' })).toBeVisible();
  await page.getByRole('button', { name: 'Add Assignment' }).click();
  await page.getByLabel('Day of Week').selectOption(dayOptionValue);
  const positionsCheckbox = page.getByRole('checkbox', { name: /5-1 positions game/i });
  if (withPositions) {
    await positionsCheckbox.check();
  } else {
    await positionsCheckbox.uncheck();
  }
  await page.getByPlaceholder('Search for a user...').fill(userDisplayName);
  await page.getByText(userDisplayName, { exact: true }).click();
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

  test('E2E-ADMIN-009 assigned admin receives error when creating a game on an unauthorized weekday', async ({ page, request }, testInfo) => {
    const globalAdmin = await createDevUserViaApi(request, testInfo, 'Wrong Create Global', true);
    const assigned = await createDevUserViaApi(request, testInfo, 'Wrong Create Assigned');
    await devLoginAs(page, globalAdmin);
    await createAdminAssignmentViaUi(page, assigned.displayName, { dayOptionValue: '0', withPositions: false });

    await switchToUser(page, assigned);
    await page.goto('/games/new');
    await expect(page.getByRole('heading', { name: 'Create New Game' })).toBeVisible();

    const tuesday = nextWeekday(2);
    await page.getByPlaceholder('Select date and time').fill(formatGameDateTimeForInput(tuesday));
    await page.getByPlaceholder('Select date and time').press('Enter');
    await page.locator('#maxPlayers').fill('12');
    await page.locator('#unregisterDeadlineHours').fill('5');
    await page.locator('#paymentAmount').fill('7.50');
    await page.locator('#locationName').fill('E2E Wrong Day Hall');
    await page.locator('#locationLink').fill('https://maps.example/e2e-wrong-day');
    await page.locator('#title').fill(e2eTitle(testInfo, 'Wrong Weekday'));

    const createPromise = waitForAdminGameCreateResponse(page);
    await page.getByRole('button', { name: 'Create Game' }).click();
    const response = await createPromise;
    expect(response.status()).toBe(403);

    await expect(page.locator('.error-message')).toContainText('not authorized to create games for this day and type');
  });

  test('E2E-ADMIN-010 assigned admin cannot save edits to a game outside their assignment', async ({ page, request }, testInfo) => {
    const globalAdmin = await createDevUserViaApi(request, testInfo, 'Wrong Edit Global', true);
    const assigned = await createDevUserViaApi(request, testInfo, 'Wrong Edit Assigned');
    await devLoginAs(page, globalAdmin);
    await createAdminAssignmentViaUi(page, assigned.displayName, { dayOptionValue: '0', withPositions: false });
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Tuesday Outside Assignment'),
      dateTime: nextWeekday(2),
      gameFormat: 'recreational',
    });

    await switchToUser(page, assigned);
    await page.goto(`/game/${game.id}/edit`);
    await expect(page.getByRole('heading', { name: 'Edit Game Settings' })).toBeVisible();

    const newTitle = e2eTitle(testInfo, 'Should Not Persist');
    await page.locator('#title').fill(newTitle);

    const updatePromise = waitForAdminGameUpdateResponse(page, game.id);
    await page.getByRole('button', { name: 'Save Changes' }).click();
    const updateResponse = await updatePromise;
    expect(updateResponse.status()).toBe(403);

    await expect(page.locator('.error-message')).toContainText('not authorized to manage this game');
  });
});

test.describe('game administration after payment requests', () => {
  test.beforeEach(async ({ request }) => {
    await waitForBackend(request);
    await resetBunqMock();
    await cleanupE2eData();
  });

  test('E2E-ADMIN-011 add participant before payment requests; locked after send', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Roster Lock Admin', true);
    const participantA = await createDevUserViaApi(request, testInfo, 'Roster Lock A');
    const participantB = await createDevUserViaApi(request, testInfo, 'Roster Lock B');

    await devLoginAs(page, admin);
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Roster Lock Add'),
      dateTime: daysFromNow(2),
    });

    await moveGameToPastViaUi(page, game.id);
    await enableBunqIntegrationViaUi(page);

    await page.goto(`/game/${game.id}`);
    await addParticipantViaUi(page, participantA.displayName);
    await expect(page.getByTitle('Add Participant')).toBeVisible();
    await addParticipantViaUi(page, participantB.displayName);

    await sendPaymentRequestsViaUi(page);

    await expect(page.getByTitle('Add Participant')).toHaveCount(0);
    await expect(page.getByPlaceholder('Search users to add...')).toHaveCount(0);
    await expect(page.locator('.player-item').filter({ hasText: participantB.displayName })).toBeVisible();
  });

  test('E2E-ADMIN-012 remove player before payment requests; paid controls after send', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Remove Lock Admin', true);
    const player = await createDevUserViaApi(request, testInfo, 'Remove Lock Player');

    await devLoginAs(page, admin);
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Remove Lock Game'),
      dateTime: daysFromNow(2),
      readonly: true,
    });

    await page.goto(`/game/${game.id}`);
    await addParticipantViaUi(page, player.displayName);
    await removePlayerByName(page, player.displayName);
    await expect(page.getByText(player.displayName)).toHaveCount(0);

    await addParticipantViaUi(page, player.displayName);
    await moveGameToPastViaUi(page, game.id);
    await enableBunqIntegrationViaUi(page);

    await page.goto(`/game/${game.id}`);
    await sendPaymentRequestsViaUi(page);

    const row = page.locator('.player-item').filter({ hasText: player.displayName });
    await expect(row.getByRole('button', { name: 'Remove player' })).toHaveCount(0);
    await expect(row.locator('.paid-status')).toContainText('Unpaid');
  });

  test('E2E-ADMIN-013 player info shows unpaid games and payment reminder succeeds', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Reminder Admin', true);
    const participant = await createDevUserViaApi(request, testInfo, 'Reminder Participant');
    const locationName = 'E2E Reminder Hall';

    await devLoginAs(page, admin);
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Reminder Game'),
      dateTime: daysFromNow(2),
      locationName,
    });

    await moveGameToPastViaUi(page, game.id);
    await page.goto(`/game/${game.id}`);
    await addParticipantViaUi(page, participant.displayName);
    await enableBunqIntegrationViaUi(page);

    await page.goto(`/game/${game.id}`);
    await sendPaymentRequestsViaUi(page);

    await page.locator('.player-item').filter({ hasText: participant.displayName }).locator('.player-details').click();
    await expect(page.getByRole('heading', { name: 'Player details' })).toBeVisible();
    await expect(page.locator('.player-info-dialog').getByText('Unpaid games')).toBeVisible();
    await expect(page.locator('.player-info-dialog .unpaid-list')).toContainText(locationName);

    const reminderPromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === `/api/users/admin/id/${participant.id}/payment-reminder`
    );
    await page.locator('.player-info-dialog').getByRole('button', { name: 'Send payment reminder' }).click();
    const reminderResponse = await reminderPromise;
    expect(reminderResponse.ok()).toBeTruthy();

    await expect(page.locator('.player-info-dialog .error')).toHaveCount(0);
    await expect(page.locator('.player-info-dialog').getByRole('button', { name: 'Send payment reminder' })).toBeEnabled();
  });

  test('E2E-ADMIN-014 readonly past guest add locked after payment requests', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Guest Lock Admin', true);
    const inviter = await createDevUserViaApi(request, testInfo, 'Guest Lock Inviter');

    await devLoginAs(page, admin);
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Guest Lock Game'),
      dateTime: daysFromNow(2),
      readonly: true,
    });

    await page.goto(`/game/${game.id}`);
    await addParticipantViaUi(page, inviter.displayName);

    const guestBefore = `GuestBefore${Date.now().toString(36)}`;
    await page.getByRole('button', { name: 'Add guest' }).click();
    await expect(page.getByRole('heading', { name: 'Register guest' })).toBeVisible();
    await expect(page.getByText('Invited by:')).toBeVisible();
    await page.getByPlaceholder('Search user (inviter)...').fill(inviter.displayName);
    await page.locator('.guest-dialog .user-search-item').filter({ hasText: inviter.displayName }).click();
    await page.getByLabel('Guest Name:').fill(guestBefore);
    await page.getByRole('button', { name: 'Register Guest' }).click();
    await expect(page.getByText(guestBefore)).toBeVisible();

    await moveGameToPastViaUi(page, game.id);
    await enableBunqIntegrationViaUi(page);
    await page.goto(`/game/${game.id}`);
    await sendPaymentRequestsViaUi(page);

    const guestAfter = `GuestAfter${Date.now().toString(36)}`;
    await page.getByRole('button', { name: 'Add guest' }).click();
    await expect(page.getByRole('heading', { name: 'Register guest' })).toBeVisible();
    await expect(page.getByText('Invited by:')).toHaveCount(0);
    await expect(page.getByPlaceholder('Search user (inviter)...')).toHaveCount(0);
    await page.getByLabel('Guest Name:').fill(guestAfter);
    await page.getByRole('button', { name: 'Register Guest' }).click();
    await expect(page.locator('.guest-dialog .error-message')).toContainText(/readonly|payment requests have been sent/i);
    await expect(page.getByText(guestAfter)).toHaveCount(0);
  });
});
