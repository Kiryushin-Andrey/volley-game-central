import { expect, test } from '@playwright/test';
import {
  assignPlayerLevelViaAdminUi,
  cleanupE2eData,
  createDevUserViaApi,
  createGameViaUi,
  daysFromNow,
  devLoginAs,
  e2eTitle,
  switchToUser,
  waitForBackend,
} from './support/fixtures';

test.describe('positions game level restrictions', () => {
  test.beforeEach(async ({ request }) => {
    await waitForBackend(request);
    await cleanupE2eData();
  });

  test('E2E-RESTRICT-001 beginner on positions game sees no join button', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Restrict Beginner Admin', true);
    const beginner = await createDevUserViaApi(request, testInfo, 'Restrict Beginner User');
    await assignPlayerLevelViaAdminUi(page, admin, beginner, 'beginner');

    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Positions Beginner Block'),
      dateTime: daysFromNow(5),
      gameFormat: 'positions',
    });

    await switchToUser(page, beginner);
    await page.goto(`/game/${game.id}`);

    await expect(page.getByRole('button', { name: 'Join Game' })).toHaveCount(0);
  });

  test('E2E-RESTRICT-002 intermediate blocked until three days before positions game', async ({
    page,
    request,
  }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Restrict Inter Admin', true);
    const intermediate = await createDevUserViaApi(request, testInfo, 'Restrict Inter User');
    await assignPlayerLevelViaAdminUi(page, admin, intermediate, 'intermediate');

    const farGame = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Positions Inter Far'),
      dateTime: daysFromNow(7),
      gameFormat: 'positions',
    });
    const nearGame = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Positions Inter Near'),
      dateTime: daysFromNow(2),
      gameFormat: 'positions',
    });

    await switchToUser(page, intermediate);
    await page.goto(`/game/${farGame.id}`);
    await expect(page.getByRole('button', { name: 'Join Game' })).toHaveCount(0);

    await page.goto(`/game/${nearGame.id}`);
    await expect(page.getByRole('button', { name: 'Join Game' })).toBeVisible();
  });

  test('E2E-RESTRICT-003 beginner host cannot add guest on positions game', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Restrict Guest Admin', true);
    const beginner = await createDevUserViaApi(request, testInfo, 'Restrict Guest Host');
    await assignPlayerLevelViaAdminUi(page, admin, beginner, 'beginner');

    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Positions Guest Block'),
      dateTime: daysFromNow(2),
      gameFormat: 'positions',
    });

    await switchToUser(page, beginner);
    await page.goto(`/game/${game.id}`);

    await expect(page.getByRole('button', { name: 'Join Game' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Add guest' })).toHaveCount(0);
  });

  test('E2E-RESTRICT-004 beginner can join recreational game when restrictions on', async ({
    page,
    request,
  }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Restrict Rec Admin', true);
    const beginner = await createDevUserViaApi(request, testInfo, 'Restrict Rec User');
    await assignPlayerLevelViaAdminUi(page, admin, beginner, 'beginner');

    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Recreational Beginner OK'),
      dateTime: daysFromNow(2),
    });

    await switchToUser(page, beginner);
    await page.goto(`/game/${game.id}`);
    await expect(page.getByRole('button', { name: 'Join Game' })).toBeVisible();
  });

  test('E2E-RESTRICT-005 beginner cannot re-join positions game after leaving', async ({
    page,
    request,
  }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Restrict Rejoin Admin', true);
    const beginner = await createDevUserViaApi(request, testInfo, 'Restrict Rejoin User');

    await devLoginAs(page, admin);
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Positions Rejoin Block'),
      dateTime: daysFromNow(2),
      gameFormat: 'positions',
    });

    await switchToUser(page, beginner);
    await page.goto(`/game/${game.id}`);
    await page.getByRole('button', { name: 'Join Game' }).click();
    await expect(page.getByRole('heading', { name: 'Will you bring a volleyball?' })).toBeVisible();
    await page.getByRole('button', { name: /No, I won't bring one/ }).click();
    await expect(page.getByText("You're in", { exact: true })).toBeVisible();

    await switchToUser(page, admin);
    await assignPlayerLevelViaAdminUi(page, admin, beginner, 'beginner', { adminAlreadyLoggedIn: true });

    await switchToUser(page, beginner);
    await page.goto(`/game/${game.id}`);
    await page.getByRole('button', { name: 'Leave Game' }).click();
    await page.locator('.dialog-overlay').getByRole('button', { name: 'Leave Game' }).click();
    await expect(page.getByText("You're in", { exact: true })).toHaveCount(0);

    await expect(page.getByRole('button', { name: 'Join Game' })).toHaveCount(0);
  });
});
