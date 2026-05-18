import { expect, test } from '@playwright/test';
import {
  cleanupE2eData,
  createDevUserViaApi,
  createGame,
  daysFromNow,
  devLogin,
  e2eTitle,
  registerUser,
  waitForBackend,
} from './support/fixtures';

async function joinGame(page: import('@playwright/test').Page, bringBall = false) {
  await page.getByRole('button', { name: 'Join Game' }).click();
  await expect(page.getByRole('heading', { name: 'Will you bring a volleyball?' })).toBeVisible();
  await page.getByRole('button', { name: bringBall ? /Yes, I'll bring one/ : /No, I won't bring one/ }).click();
  await expect(page.getByText("You're in")).toBeVisible();
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
    const title = e2eTitle(testInfo, 'Details Open');
    const game = await createGame({
      title,
      createdById: admin.id,
      dateTime: daysFromNow(2),
      maxPlayers: 8,
      paymentAmount: 750,
      locationName: 'E2E Details Hall',
    });

    await devLogin(page, testInfo, 'Details Participant');
    await page.goto(`/game/${game.id}`);

    await expect(page.getByText(title)).toBeVisible();
    await expect(page.getByRole('link', { name: 'E2E Details Hall' })).toBeVisible();
    await expect(page.getByText('No players registered yet')).toBeVisible();
    await expect(page.getByText('Be the first to join this game!')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Join Game' })).toBeVisible();
  });

  test('E2E-GAME-002 participant joins an open game and sees registered status', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Join Admin', true);
    const game = await createGame({ title: e2eTitle(testInfo, 'Join Open'), createdById: admin.id, dateTime: daysFromNow(2) });

    await devLogin(page, testInfo, 'Join Participant');
    await page.goto(`/game/${game.id}`);
    await joinGame(page);

    await page.goto('/');
    await expect(page.getByText("You're in")).toBeVisible();
  });

  test('E2E-GAME-003 participant leaves a joined game before the deadline', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Leave Admin', true);
    const game = await createGame({ title: e2eTitle(testInfo, 'Leave Open'), createdById: admin.id, dateTime: daysFromNow(2) });

    await devLogin(page, testInfo, 'Leave Participant');
    await page.goto(`/game/${game.id}`);
    await joinGame(page);
    await leaveGame(page);

    await expect(page.getByText("You're in")).toHaveCount(0);
  });

  test('E2E-GAME-004 participant joins a full game and lands on waiting list', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Full Admin', true);
    const firstPlayer = await createDevUserViaApi(request, testInfo, 'Full First Player');
    const game = await createGame({ title: e2eTitle(testInfo, 'Full Game'), createdById: admin.id, dateTime: daysFromNow(2), maxPlayers: 1 });
    await registerUser(game.id, firstPlayer.id, new Date(Date.now() - 60_000));

    await devLogin(page, testInfo, 'Full Waitlist Participant');
    await page.goto(`/game/${game.id}`);
    await joinGame(page);

    await expect(page.getByText('Waiting List')).toBeVisible();
    await expect(page.getByText('Waitlist')).toBeVisible();
  });

  test('E2E-GAME-005 leaving a full game promotes the next waitlisted participant', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Promote Admin', true);
    const activePlayer = await devLogin(page, testInfo, 'Promote Active');
    const waitlistedPlayer = await createDevUserViaApi(request, testInfo, 'Promote Waitlisted');
    const game = await createGame({ title: e2eTitle(testInfo, 'Promote Waitlist'), createdById: admin.id, dateTime: daysFromNow(2), maxPlayers: 1 });
    await registerUser(game.id, activePlayer.id, new Date(Date.now() - 60_000));
    await registerUser(game.id, waitlistedPlayer.id, new Date());

    await page.goto(`/game/${game.id}`);
    await expect(page.getByText('Waiting List')).toBeVisible();
    await leaveGame(page);

    await expect(page.getByText('Waiting List')).toHaveCount(0);
    await expect(page.getByText(waitlistedPlayer.displayName)).toBeVisible();
  });

  test('E2E-GAME-006 readonly game blocks participant self-registration', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Readonly Admin', true);
    const game = await createGame({
      title: e2eTitle(testInfo, 'Readonly Game'),
      createdById: admin.id,
      dateTime: daysFromNow(2),
      readonly: true,
    });

    await devLogin(page, testInfo, 'Readonly Participant');
    await page.goto(`/game/${game.id}`);

    await expect(page.getByText('This game is readonly. Registration and deregistration are closed.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Join Game' })).toHaveCount(0);
  });

  test('E2E-GAME-007 registered participant sees deadline info after unregister deadline passes', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Deadline Admin', true);
    const participant = await devLogin(page, testInfo, 'Deadline Participant');
    const game = await createGame({
      title: e2eTitle(testInfo, 'Deadline Info'),
      createdById: admin.id,
      dateTime: daysFromNow(0, new Date().getHours() + 1),
      unregisterDeadlineHours: 5,
    });
    await registerUser(game.id, participant.id, new Date());

    await page.goto(`/game/${game.id}`);

    await expect(page.getByText('You can only leave the game up to 5 hours before it starts.')).toBeVisible();
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
    const game = await createGame({ title: e2eTitle(testInfo, 'Guest Game'), createdById: admin.id, dateTime: daysFromNow(2) });
    const guestName = `Guest ${Date.now().toString(36)}`;

    await devLogin(page, testInfo, 'Guest Participant');
    await page.goto(`/game/${game.id}`);
    await page.getByRole('button', { name: 'Add guest' }).click();
    await page.getByLabel('Guest Name:').fill(guestName);
    await page.getByRole('button', { name: 'Register Guest' }).click();

    await expect(page.getByText(guestName)).toBeVisible();
    await expect(page.getByText(/Invited by E2E Guest Participant/)).toBeVisible();
  });

  test('E2E-GAME-010 participant completes bring-ball flow', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Ball Admin', true);
    const game = await createGame({ title: e2eTitle(testInfo, 'Bring Ball'), createdById: admin.id, dateTime: daysFromNow(2) });

    await devLogin(page, testInfo, 'Ball Participant');
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

    await devLogin(page, testInfo, 'Season Participant');

    for (const seasonal of seasonalGames) {
      const game = await createGame({
        title: e2eTitle(testInfo, `Season ${seasonal.tag}`),
        createdById: admin.id,
        dateTime: daysFromNow(2),
        tag: seasonal.tag,
      });
      await page.goto(`/game/${game.id}`);
      await expect(page.getByText(seasonal.note)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Join Game' })).toBeVisible();
    }
  });
});
