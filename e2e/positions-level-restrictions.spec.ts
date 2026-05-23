import { expect, test } from '@playwright/test';
import {
  assignPlayerLevelViaApi,
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

  test('E2E-POSLVL-001 beginner cannot self-register on positions game', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'PosLvl Admin', true);
    const beginner = await createDevUserViaApi(request, testInfo, 'PosLvl Beginner');
    await assignPlayerLevelViaApi(request, testInfo, beginner.id, 'beginner');

    await devLoginAs(page, admin);
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Positions Beginner Block'),
      dateTime: daysFromNow(6),
      gameFormat: 'positions',
    });

    await switchToUser(page, beginner);
    await page.goto(`/game/${game.id}`);

    await expect(page.getByRole('button', { name: 'Join Game' })).toHaveCount(0);
    await expect(page.getByText(/Registration is not available for this game/i)).toBeVisible();
  });

  test('E2E-POSLVL-002 advanced can join positions game within base window', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'PosLvl Adv Admin', true);
    const advanced = await createDevUserViaApi(request, testInfo, 'PosLvl Advanced');
    await assignPlayerLevelViaApi(request, testInfo, advanced.id, 'advanced');

    await devLoginAs(page, admin);
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Positions Advanced Join'),
      dateTime: daysFromNow(6),
      gameFormat: 'positions',
    });

    await switchToUser(page, advanced);
    await page.goto(`/game/${game.id}`);
    await expect(page.getByRole('button', { name: 'Join Game' })).toBeVisible();
  });

  test('E2E-POSLVL-003 intermediate blocked until three days before start', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'PosLvl Int Admin', true);
    const intermediate = await createDevUserViaApi(request, testInfo, 'PosLvl Intermediate');
    await assignPlayerLevelViaApi(request, testInfo, intermediate.id, 'intermediate');

    await devLoginAs(page, admin);
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Positions Intermediate Window'),
      dateTime: daysFromNow(6),
      gameFormat: 'positions',
    });

    await switchToUser(page, intermediate);
    await page.goto(`/game/${game.id}`);
    await expect(page.getByRole('button', { name: 'Join Game' })).toHaveCount(0);
    await expect(page.getByText(/Registration opens/i)).toBeVisible();
  });

  test('E2E-POSLVL-004 recreational game unaffected for beginner', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'PosLvl Rec Admin', true);
    const beginner = await createDevUserViaApi(request, testInfo, 'PosLvl Rec Beginner');
    await assignPlayerLevelViaApi(request, testInfo, beginner.id, 'beginner');

    await devLoginAs(page, admin);
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Recreational Beginner OK'),
      dateTime: daysFromNow(6),
      gameFormat: 'recreational',
    });

    await switchToUser(page, beginner);
    await page.goto(`/game/${game.id}`);
    await expect(page.getByRole('button', { name: 'Join Game' })).toBeVisible();
  });
});
