import { expect, test } from '@playwright/test';
import {
  cleanupE2eData,
  createDevUserViaApi,
  createGame,
  createGameViaUi,
  daysFromNow,
  devLoginAs,
  e2eTitle,
  nextWeekday,
  registerUser,
  switchToUser,
  waitForBackend,
} from './support/fixtures';

async function joinGameWithoutBall(page: import('@playwright/test').Page, expectedStatus = "You're in") {
  await page.getByRole('button', { name: 'Join Game' }).click();
  await expect(page.getByRole('heading', { name: 'Will you bring a volleyball?' })).toBeVisible();
  await page.getByRole('button', { name: /No, I won't bring one/ }).click();
  await expect(page.getByText(expectedStatus, { exact: true })).toBeVisible();
}

test.describe('cross-user and state-transition scenarios', () => {
  test.beforeEach(async ({ request }) => {
    await waitForBackend(request);
    await cleanupE2eData();
  });

  test('E2E-STATE-001 admin sees participant in players list after refresh in another context', async ({ browser, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'State1 Admin', true);
    const participant = await createDevUserViaApi(request, testInfo, 'State1 Participant');
    const adminContext = await browser.newContext();
    const participantContext = await browser.newContext();

    try {
      const adminPage = await adminContext.newPage();
      const participantPage = await participantContext.newPage();

      await devLoginAs(adminPage, admin);
      const game = await createGameViaUi(adminPage, {
        title: e2eTitle(testInfo, 'State Cross Game'),
        dateTime: nextWeekday(0),
      });

      await devLoginAs(participantPage, participant);
      await participantPage.goto(`/game/${game.id}`);
      await joinGameWithoutBall(participantPage);

      await adminPage.goto(`/game/${game.id}`);
      await expect(adminPage.getByText(participant.displayName)).toHaveCount(0);
      await adminPage.reload();
      await expect(adminPage.getByText(participant.displayName)).toBeVisible();
    } finally {
      await adminContext.close();
      await participantContext.close();
    }
  });

  test('E2E-STATE-002 last spot goes to first joiner and second joiner is waitlisted', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'State2 Admin', true);
    const preRegistered = await createDevUserViaApi(request, testInfo, 'State2 PreRegistered');
    const first = await createDevUserViaApi(request, testInfo, 'State2 First');
    const second = await createDevUserViaApi(request, testInfo, 'State2 Second');
    await devLoginAs(page, admin);
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Almost Full'),
      dateTime: daysFromNow(2),
      maxPlayers: 2,
    });
    await registerUser(game.id, preRegistered.id, new Date(Date.now() - 60_000));

    await switchToUser(page, first);
    await page.goto(`/game/${game.id}`);
    await joinGameWithoutBall(page);

    await switchToUser(page, second);
    await page.goto(`/game/${game.id}`);
    await joinGameWithoutBall(page, 'Waitlist');

    await expect(page.getByRole('heading', { name: 'Waiting List' })).toBeVisible();
  });

  test('E2E-STATE-003 reducing capacity preserves active and waitlist sections', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'State3 Admin', true);
    const players = await Promise.all(
      [0, 1, 2, 3, 4].map((i) => createDevUserViaApi(request, testInfo, `State3 P${i}`))
    );
    const title = e2eTitle(testInfo, 'Capacity Shrink');
    const game = await createGame({
      title,
      createdById: admin.id,
      dateTime: daysFromNow(2),
      maxPlayers: 4,
    });
    const base = Date.now();
    for (let i = 0; i < 5; i++) {
      await registerUser(game.id, players[i].id, new Date(base + i * 1000));
    }

    await devLoginAs(page, admin);
    await page.goto(`/game/${game.id}/edit`);
    await expect(page.getByRole('heading', { name: 'Edit Game Settings' })).toBeVisible();
    await page.locator('#maxPlayers').fill('2');
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page).toHaveURL(new RegExp(`/game/${game.id}$`));

    await expect(page.locator('.registered-count')).toHaveText('2');
    await expect(page.locator('.max-count')).toHaveText('2');
    await expect(page.locator('.waitlist-indicator')).toHaveText('(+3)');
    await expect(page.locator('.players-section:not(.waitlist-section) .player-item')).toHaveCount(2);
    await expect(page.locator('.waitlist-section .player-item')).toHaveCount(3);
  });

  test('E2E-STATE-004 browser refresh keeps authenticated session and route', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'State4 Admin', true);
    const participant = await createDevUserViaApi(request, testInfo, 'State4 Participant');
    await devLoginAs(page, admin);
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'State4 Game'),
      dateTime: nextWeekday(0),
    });

    await switchToUser(page, participant);
    await page.goto(`/game/${game.id}`);
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();

    await page.reload();

    await expect(page).toHaveURL(new RegExp(`/game/${game.id}$`));
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
    await expect(page.getByText(game.title)).toBeVisible();
  });

  test('E2E-STATE-005 fresh browser context starts unauthenticated', async ({ browser }) => {
    const context = await browser.newContext();
    try {
      const page = await context.newPage();
      await page.goto('/');

      await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Logout' })).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
