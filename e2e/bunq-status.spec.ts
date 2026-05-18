import { expect, test } from '@playwright/test';
import {
  addParticipantViaUi,
  BUNQ_E2E_PASSWORD,
  cleanupE2eData,
  createDevUserViaApi,
  createGameViaUi,
  daysFromNow,
  devLoginAs,
  dismissPaymentCheckCompletedDialog,
  enableBunqIntegrationViaUi,
  e2eTitle,
  getPaymentRequestIdForUserRegistration,
  markBunqRequestInquiryAccepted,
  moveGameToPastViaUi,
  registerForGameViaUi,
  resetBunqMock,
  sendPaymentRequestsViaUi,
  submitCheckPaymentStatusForGame,
  switchToUser,
  togglePlayerPaidStatusViaUi,
  waitForBackend,
} from './support/fixtures';

test.describe('Bunq payment status scenarios', () => {
  test.beforeEach(async ({ request }) => {
    await waitForBackend(request);
    await resetBunqMock();
    await cleanupE2eData();
  });

  test('E2E-BUNQ-STATUS-002 per-game check marks unpaid players paid when mock reports ACCEPTED', async ({
    page,
    request,
  }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Status Check Admin', true);
    const participant = await createDevUserViaApi(request, testInfo, 'Status Check Player');

    await devLoginAs(page, admin);
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Status Check Game'),
      dateTime: daysFromNow(2),
    });

    await moveGameToPastViaUi(page, game.id);
    await enableBunqIntegrationViaUi(page);

    await page.goto(`/game/${game.id}`);
    await addParticipantViaUi(page, participant.displayName);
    await sendPaymentRequestsViaUi(page);

    const inquiryId = await getPaymentRequestIdForUserRegistration(game.id, participant.id);
    expect(inquiryId).toBeTruthy();
    await markBunqRequestInquiryAccepted(inquiryId!);

    await submitCheckPaymentStatusForGame(page);
    await dismissPaymentCheckCompletedDialog(page);

    const row = page.locator('.player-item').filter({ hasText: participant.displayName });
    await expect(row.getByText('Paid')).toBeVisible();
  });

  test('E2E-BUNQ-STATUS-003 admin toggles paid status and past list counts update', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Status Toggle Admin', true);
    const playerA = await createDevUserViaApi(request, testInfo, 'Status Toggle A');
    const playerB = await createDevUserViaApi(request, testInfo, 'Status Toggle B');
    const title = e2eTitle(testInfo, 'Status Toggle Game');

    await devLoginAs(page, admin);
    const game = await createGameViaUi(page, { title, dateTime: daysFromNow(2) });

    await moveGameToPastViaUi(page, game.id);
    await enableBunqIntegrationViaUi(page);

    await page.goto(`/game/${game.id}`);
    await addParticipantViaUi(page, playerA.displayName);
    await addParticipantViaUi(page, playerB.displayName);
    await sendPaymentRequestsViaUi(page);

    await togglePlayerPaidStatusViaUi(page, playerA.displayName);
    await togglePlayerPaidStatusViaUi(page, playerB.displayName);

    await page.goto('/');
    await page.getByLabel('Past').check();
    await page.getByLabel('Show fully paid games').check();
    const card = page.locator('.game-card-wrapper').filter({ hasText: title });
    await expect(card).toBeVisible();
    await expect(card.locator('.compact-stats .counter').nth(0)).toHaveText('2');
    await expect(card.locator('.compact-stats .counter').nth(1)).toHaveText('2');

    await page.goto(`/game/${game.id}`);
    await togglePlayerPaidStatusViaUi(page, playerA.displayName);

    await page.goto('/');
    await page.getByLabel('Past').check();
    await page.getByLabel('Show fully paid games').check();
    await expect(card.locator('.compact-stats .counter').nth(0)).toHaveText('1');
    await expect(card.locator('.compact-stats .counter').nth(1)).toHaveText('2');
  });

  test('E2E-BUNQ-STATUS-004 fully paid past game shows counts and hides until toggle', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Status Fully Paid Admin', true);
    const playerA = await createDevUserViaApi(request, testInfo, 'Status Fully Paid A');
    const playerB = await createDevUserViaApi(request, testInfo, 'Status Fully Paid B');
    const title = e2eTitle(testInfo, 'Status Fully Paid Game');

    await devLoginAs(page, admin);
    const game = await createGameViaUi(page, { title, dateTime: daysFromNow(2), maxPlayers: 12 });

    await moveGameToPastViaUi(page, game.id);
    await enableBunqIntegrationViaUi(page);

    await page.goto(`/game/${game.id}`);
    await addParticipantViaUi(page, playerA.displayName);
    await addParticipantViaUi(page, playerB.displayName);
    await sendPaymentRequestsViaUi(page);
    await togglePlayerPaidStatusViaUi(page, playerA.displayName);
    await togglePlayerPaidStatusViaUi(page, playerB.displayName);

    await page.goto('/');
    await page.getByLabel('Past').check();
    await page.getByLabel('Show fully paid games').check();
    const card = page.locator('.game-card-wrapper').filter({ hasText: title });
    await expect(card).toBeVisible();
    await expect(card.locator('.compact-stats .counter').nth(0)).toHaveText('2');
    await expect(card.locator('.compact-stats .counter').nth(1)).toHaveText('2');

    await page.getByLabel('Show fully paid games').uncheck();
    await expect(page.getByText(title)).toHaveCount(0);
    await page.getByLabel('Show fully paid games').check();
    await expect(page.getByText(title)).toBeVisible();
    await expect(card.locator('.compact-stats .counter').nth(0)).toHaveText('2');
  });

  test('E2E-BUNQ-STATUS-005 wrong password on per-game check keeps dialog open', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Status Wrong Pass Admin', true);
    const participant = await createDevUserViaApi(request, testInfo, 'Status Wrong Pass Player');

    await devLoginAs(page, admin);
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Status Wrong Pass'),
      dateTime: daysFromNow(2),
    });

    await moveGameToPastViaUi(page, game.id);
    await enableBunqIntegrationViaUi(page);

    await page.goto(`/game/${game.id}`);
    await addParticipantViaUi(page, participant.displayName);
    await sendPaymentRequestsViaUi(page);

    await submitCheckPaymentStatusForGame(page, 'WrongPassword!9');
    await expect(page.locator('.password-dialog-overlay')).toBeVisible();
    await expect(page.locator('.password-dialog-overlay')).toContainText('Invalid password');
    await expect(page.locator('.dialog-overlay').filter({ hasText: 'Payment check completed' })).toHaveCount(0);
  });

  test('E2E-BUNQ-STATUS-006 bulk check-payments route updates unpaid past games', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Status Bulk Admin', true);
    const participant = await createDevUserViaApi(request, testInfo, 'Status Bulk Player');
    const title = e2eTitle(testInfo, 'Status Bulk Game');

    await devLoginAs(page, admin);
    const game = await createGameViaUi(page, { title, dateTime: daysFromNow(2) });

    await moveGameToPastViaUi(page, game.id);
    await enableBunqIntegrationViaUi(page);

    await page.goto(`/game/${game.id}`);
    await addParticipantViaUi(page, participant.displayName);
    await sendPaymentRequestsViaUi(page);

    const inquiryId = await getPaymentRequestIdForUserRegistration(game.id, participant.id);
    expect(inquiryId).toBeTruthy();
    await markBunqRequestInquiryAccepted(inquiryId!);

    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toMatch(/Payment check completed/i);
      await dialog.accept();
    });

    await page.goto('/check-payments');
    await expect(page.getByRole('heading', { name: 'Enter Bunq API Password' })).toBeVisible();
    await page.locator('.password-dialog-overlay').getByLabel('Password:').fill(BUNQ_E2E_PASSWORD);
    await page.locator('.password-dialog-overlay').getByRole('button', { name: 'Submit' }).click();

    await expect(page).toHaveURL('/', { timeout: 60_000 });
    await page.getByLabel('Past').check();
    await page.goto(`/game/${game.id}`);
    const row = page.locator('.player-item').filter({ hasText: participant.displayName });
    await expect(row.getByText('Paid')).toBeVisible();
  });

  test('E2E-BUNQ-STATUS-007 participant does not see admin payment controls on past game', async ({
    page,
    request,
  }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Status Participant Admin', true);
    const participant = await createDevUserViaApi(request, testInfo, 'Status Participant View');

    await devLoginAs(page, admin);
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Status Participant Game'),
      dateTime: daysFromNow(2),
      paymentAmount: '7.50',
    });

    await registerForGameViaUi(page, participant, game.id);

    await switchToUser(page, admin);
    await moveGameToPastViaUi(page, game.id);
    await enableBunqIntegrationViaUi(page);

    await page.goto(`/game/${game.id}`);
    await sendPaymentRequestsViaUi(page);

    await switchToUser(page, participant);
    await page.goto(`/game/${game.id}`);

    await expect(page.getByText('€7.50')).toBeVisible();
    await expect(page.getByText("You're in", { exact: true })).toBeVisible();
    await expect(page.getByTitle('Check payment status for this game')).toHaveCount(0);
    await expect(page.getByTitle('Send payment requests to unpaid players')).toHaveCount(0);
    await expect(page.locator('.paid-status')).toHaveCount(0);
  });
});
