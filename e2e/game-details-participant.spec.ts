import { expect, test } from '@playwright/test';
import {
  cleanupE2eData,
  createDevUserViaApi,
  createGameViaUi,
  daysFromNow,
  devLogin,
  devLoginAs,
  e2eTitle,
  nextWeekday,
  registerForGameViaUi,
  switchToUser,
  updateGame,
  waitForBackend,
} from './support/fixtures';

async function joinGame(page: import('@playwright/test').Page, bringBall = false, expectedStatus = "You're in") {
  await page.getByRole('button', { name: 'Join Game' }).click();
  await expect(page.getByRole('heading', { name: 'Will you bring a volleyball?' })).toBeVisible();
  await page.getByRole('button', { name: bringBall ? /Yes, I'll bring one/ : /No, I won't bring one/ }).click();
  await expect(page.getByText(expectedStatus, { exact: true })).toBeVisible();
}

async function leaveGame(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Leave Game' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Leave Game' }).click();
  await expect(page.getByRole('button', { name: 'Join Game' })).toBeVisible();
}

test.describe('game details participant scenarios', () => {
  test.beforeEach(async ({ request }) => {
    await waitForBackend(request);
    await cleanupE2eData();
  });

  test('E2E-GAME-001 participant sees upcoming game details and registration action', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Details Admin', true);
    const participant = await createDevUserViaApi(request, testInfo, 'Details Participant');
    const title = e2eTitle(testInfo, 'Details Open');
    await devLoginAs(page, admin);
    const game = await createGameViaUi(page, {
      title,
      dateTime: daysFromNow(2),
      maxPlayers: 8,
      paymentAmount: '7.50',
      locationName: 'E2E Details Hall',
    });

    await switchToUser(page, participant);
    await page.goto(`/game/${game.id}`);

    await expect(page.getByText(title)).toBeVisible();
    await expect(page.getByRole('link', { name: 'E2E Details Hall' })).toBeVisible();
    await expect(page.getByText('No players registered yet')).toBeVisible();
    await expect(page.getByText('Be the first to join this game!')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Join Game' })).toBeVisible();
  });

  test('E2E-GAME-002 participant joins an open game and sees registered status', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Join Admin', true);
    const participant = await createDevUserViaApi(request, testInfo, 'Join Participant');
    await devLoginAs(page, admin);
    const game = await createGameViaUi(page, { title: e2eTitle(testInfo, 'Join Open'), dateTime: nextWeekday(0) });

    await switchToUser(page, participant);
    await page.goto(`/game/${game.id}`);
    await joinGame(page);

    await page.goto('/');
    await expect(page.getByText("You're in")).toBeVisible();
  });

  test('E2E-GAME-003 participant leaves a joined game before the deadline', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Leave Admin', true);
    const participant = await createDevUserViaApi(request, testInfo, 'Leave Participant');
    await devLoginAs(page, admin);
    const game = await createGameViaUi(page, { title: e2eTitle(testInfo, 'Leave Open'), dateTime: daysFromNow(2) });

    await switchToUser(page, participant);
    await page.goto(`/game/${game.id}`);
    await joinGame(page);
    await page.waitForTimeout(1100);
    await leaveGame(page);

    await expect(page.getByText("You're in")).toHaveCount(0);
  });

  test('E2E-GAME-004 participant joins a full game and lands on waiting list', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Full Admin', true);
    const firstPlayer = await createDevUserViaApi(request, testInfo, 'Full First Player');
    const secondPlayer = await createDevUserViaApi(request, testInfo, 'Full Second Player');
    const waitlistedPlayer = await createDevUserViaApi(request, testInfo, 'Full Waitlist Participant');
    await devLoginAs(page, admin);
    const game = await createGameViaUi(page, { title: e2eTitle(testInfo, 'Full Game'), dateTime: daysFromNow(2), maxPlayers: 2 });
    await registerForGameViaUi(page, firstPlayer, game.id);
    await registerForGameViaUi(page, secondPlayer, game.id);

    await switchToUser(page, waitlistedPlayer);
    await page.goto(`/game/${game.id}`);
    await joinGame(page, false, 'Waitlist');

    await expect(page.getByText('Waiting List')).toBeVisible();
    await expect(page.getByText('Waitlist', { exact: true })).toBeVisible();
  });

  test('E2E-GAME-005 leaving a full game promotes the next waitlisted participant', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Promote Admin', true);
    const activePlayer = await createDevUserViaApi(request, testInfo, 'Promote Active');
    const secondActivePlayer = await createDevUserViaApi(request, testInfo, 'Promote Second Active');
    const waitlistedPlayer = await createDevUserViaApi(request, testInfo, 'Promote Waitlisted');
    await devLoginAs(page, admin);
    const game = await createGameViaUi(page, { title: e2eTitle(testInfo, 'Promote Waitlist'), dateTime: daysFromNow(2), maxPlayers: 2 });
    await registerForGameViaUi(page, activePlayer, game.id);
    await registerForGameViaUi(page, secondActivePlayer, game.id);
    await registerForGameViaUi(page, waitlistedPlayer, game.id, 'Waitlist');

    await switchToUser(page, activePlayer);
    await page.goto(`/game/${game.id}`);
    await expect(page.getByText('Waiting List')).toBeVisible();
    await leaveGame(page);

    await expect(page.getByText('Waiting List')).toHaveCount(0);
    await expect(page.getByText(waitlistedPlayer.displayName)).toBeVisible();
  });

  test('E2E-GAME-006 readonly game blocks participant self-registration', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Readonly Admin', true);
    const participant = await createDevUserViaApi(request, testInfo, 'Readonly Participant');
    await devLoginAs(page, admin);
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Readonly Game'),
      dateTime: daysFromNow(2),
      readonly: true,
    });

    await switchToUser(page, participant);
    await page.goto(`/game/${game.id}`);

    await expect(page.getByText('This game is readonly. Registration and deregistration are closed.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Join Game' })).toHaveCount(0);
  });

  test('E2E-GAME-007 registered participant sees deadline info after unregister deadline passes', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Deadline Admin', true);
    const participant = await createDevUserViaApi(request, testInfo, 'Deadline Participant');
    await devLoginAs(page, admin);
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Deadline Info'),
      dateTime: daysFromNow(0, new Date().getHours() + 1),
      unregisterDeadlineHours: 5,
    });
    await switchToUser(page, participant);
    await page.goto(`/game/${game.id}`);
    await joinGame(page);

    await page.goto(`/game/${game.id}`);

    await expect(page.getByText('You can only leave the game up to 5 hours before it starts.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Leave Game' })).toHaveCount(0);
  });

  test('E2E-GAME-008 participant opens a non-existent game id and sees error recovery', async ({ page }, testInfo) => {
    await devLogin(page, testInfo, 'Missing Game Participant');
    await page.goto('/game/999999999');

    await expect(page.getByRole('heading', { name: 'Error' })).toBeVisible();
    await expect(page.getByText('Failed to load game details')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back to Games' })).toBeVisible();
  });

  test('E2E-GAME-009 participant registers a guest and sees guest in players list', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Guest Admin', true);
    const participant = await createDevUserViaApi(request, testInfo, 'Guest Participant');
    await devLoginAs(page, admin);
    const game = await createGameViaUi(page, { title: e2eTitle(testInfo, 'Guest Game'), dateTime: daysFromNow(2) });
    const guestName = `Guest ${Date.now().toString(36)}`;

    await switchToUser(page, participant);
    await page.goto(`/game/${game.id}`);
    await page.getByRole('button', { name: 'Add guest' }).click();
    await page.getByLabel('Guest Name:').fill(guestName);
    await page.getByRole('button', { name: 'Register Guest' }).click();

    await expect(page.getByText(guestName)).toBeVisible();
    await expect(page.getByText(/Invited by E2E Guest Participant/)).toBeVisible();
  });

  test('E2E-GAME-010 participant completes bring-ball flow', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Ball Admin', true);
    const participant = await createDevUserViaApi(request, testInfo, 'Ball Participant');
    await devLoginAs(page, admin);
    const game = await createGameViaUi(page, { title: e2eTitle(testInfo, 'Bring Ball'), dateTime: daysFromNow(2) });

    await switchToUser(page, participant);
    await page.goto(`/game/${game.id}`);
    await joinGame(page, true);

    await expect(page.getByLabel('Bringing the ball')).toBeVisible();
  });

  test('E2E-GAME-011 seasonal game notes render without blocking core details', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Season Admin', true);
    const seasonalGames = [
      { tag: 'halloween' as const, note: 'Halloween Special' },
      { tag: 'newyear' as const, note: 'New Year Special' },
      { tag: 'march8' as const, note: 'March 8 Special' },
    ];

    await devLoginAs(page, admin);
    const games = [];
    for (const seasonal of seasonalGames) {
      const game = await createGameViaUi(page, {
        title: e2eTitle(testInfo, `Season ${seasonal.tag}`),
        dateTime: daysFromNow(2),
      });
      await updateGame(game.id, { tag: seasonal.tag });
      games.push({ game, note: seasonal.note });
    }

    const participant = await createDevUserViaApi(request, testInfo, 'Season Participant');
    await switchToUser(page, participant);

    for (const { game, note } of games) {
      await page.goto(`/game/${game.id}`);
      await expect(page.getByText(note)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Join Game' })).toBeVisible();
    }
  });
});
