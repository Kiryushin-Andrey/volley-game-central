import { expect, test } from '@playwright/test';
import {
  cleanupE2eData,
  createDevUserViaApi,
  createGameViaUi,
  daysFromNow,
  devLoginAs,
  e2eTitle,
  switchToUser,
  waitForBackend,
} from './support/fixtures';

test.describe('registration windows, guests, and blocked users', () => {
  test.beforeEach(async ({ request }) => {
    await waitForBackend(request);
    await cleanupE2eData();
  });

  test('E2E-WIN-001 participant sees registration opens message and cannot join yet', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Win1 Admin', true);
    const participant = await createDevUserViaApi(request, testInfo, 'Win1 Participant');
    await devLoginAs(page, admin);
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Far Registration'),
      dateTime: daysFromNow(14),
    });

    await switchToUser(page, participant);
    await page.goto(`/game/${game.id}`);

    await expect(page.getByRole('button', { name: 'Join Game' })).toHaveCount(0);
    await expect(page.getByText(/You can register for this game starting from/)).toBeVisible();
    await expect(page.getByText(/10 days before the game/)).toBeVisible();
  });

  test('E2E-WIN-002 participant can join but add guest is hidden before guest window', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Win2 Admin', true);
    const participant = await createDevUserViaApi(request, testInfo, 'Win2 Participant');
    await devLoginAs(page, admin);
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Guest Window'),
      dateTime: daysFromNow(6),
    });

    await switchToUser(page, participant);
    await page.goto(`/game/${game.id}`);

    await expect(page.getByRole('button', { name: 'Join Game' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add guest' })).toHaveCount(0);
  });

  test('E2E-BLOCK-001 blocked user cannot join and cannot add a guest', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Block Admin', true);
    const blocked = await createDevUserViaApi(request, testInfo, 'Blocked User');
    await devLoginAs(page, admin);

    const joinableGame = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Block Join'),
      dateTime: daysFromNow(2),
    });

    const readonlyGame = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Block Setup Readonly'),
      dateTime: daysFromNow(5),
      readonly: true,
    });

    await page.goto(`/game/${readonlyGame.id}`);
    await page.locator('.admin-actions').getByRole('button', { name: 'Add Participant' }).click();
    await page.getByPlaceholder('Search users to add...').fill(blocked.displayName);
    await page.getByText(blocked.displayName, { exact: true }).click();
    await expect(page.getByText(blocked.displayName)).toBeVisible();

    await page.locator('.player-item').filter({ hasText: blocked.displayName }).locator('.player-details').click();
    await expect(page.getByRole('heading', { name: 'Player details' })).toBeVisible();

    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('prompt');
      await dialog.accept('E2E unpaid games policy');
    });
    await page.locator('.player-info-dialog').getByRole('button', { name: 'Block' }).click();

    await expect(page.locator('.player-info-dialog').getByText('Blocked: E2E unpaid games policy')).toBeVisible();
    await page.locator('.player-info-dialog').getByRole('button', { name: 'Close' }).click();

    await switchToUser(page, blocked);
    await page.goto(`/game/${joinableGame.id}`);

    await page.getByRole('button', { name: 'Join Game' }).click();
    await expect(page.locator('.dialog-overlay .dialog-title').filter({ hasText: 'Registration blocked' })).toBeVisible();
    await expect(page.locator('.dialog-overlay .dialog-message')).toContainText('E2E unpaid games policy');
    await page.locator('.dialog-overlay').getByRole('button', { name: 'OK' }).click();

    await page.getByRole('button', { name: 'Add guest' }).click();
    await expect(page.locator('.dialog-overlay .dialog-title').filter({ hasText: 'Guest registration blocked' })).toBeVisible();
    await expect(page.locator('.dialog-overlay .dialog-message')).toContainText('E2E unpaid games policy');
    await page.locator('.dialog-overlay').getByRole('button', { name: 'OK' }).click();
  });

  test('E2E-GUEST-001 participant unregisters a guest from the players list', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Guest Unreg Admin', true);
    const participant = await createDevUserViaApi(request, testInfo, 'Guest Unreg Participant');
    await devLoginAs(page, admin);
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Guest Unreg'),
      dateTime: daysFromNow(2),
    });

    await switchToUser(page, participant);
    await page.goto(`/game/${game.id}`);
    await page.getByRole('button', { name: 'Join Game' }).click();
    await expect(page.getByRole('heading', { name: 'Will you bring a volleyball?' })).toBeVisible();
    await page.getByRole('button', { name: /No, I won't bring one/ }).click();
    await expect(page.getByText("You're in", { exact: true })).toBeVisible();

    const guestName = `GuestUnreg${Date.now().toString(36)}`;
    await page.getByRole('button', { name: 'Add guest' }).click();
    await page.getByLabel('Guest Name:').fill(guestName);
    await page.getByRole('button', { name: 'Register Guest' }).click();
    await expect(page.getByText(guestName)).toBeVisible();

    await page.getByRole('button', { name: `Unregister guest ${guestName}` }).click();
    await expect(page.locator('.dialog-overlay .dialog-title').filter({ hasText: 'Unregister Guest' })).toBeVisible();
    await page.locator('.dialog-overlay').getByRole('button', { name: 'Unregister Guest' }).click();

    await expect(page.getByText(guestName)).toHaveCount(0);
  });

  test('E2E-GUEST-002 global admin adds guest on readonly game with inviter selection', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Inviter Admin', true);
    const inviter = await createDevUserViaApi(request, testInfo, 'Inviter User');
    await devLoginAs(page, admin);
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Readonly Guest Inviter'),
      dateTime: daysFromNow(5),
      readonly: true,
    });

    await page.goto(`/game/${game.id}`);
    await page.getByRole('button', { name: 'Add guest' }).click();
    await expect(page.getByRole('heading', { name: 'Register guest' })).toBeVisible();
    await expect(page.getByText('Invited by:')).toBeVisible();

    await page.getByPlaceholder('Search user (inviter)...').fill(inviter.displayName);
    await page.getByText(inviter.displayName, { exact: true }).click();

    const guestName = `InvitedGuest${Date.now().toString(36)}`;
    await page.getByLabel('Guest Name:').fill(guestName);
    await page.getByRole('button', { name: 'Register Guest' }).click();

    await expect(page.getByText(guestName)).toBeVisible();
    await expect(page.getByText(new RegExp(`Invited by ${inviter.displayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))).toBeVisible();
  });
});
