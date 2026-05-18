import { expect, test } from '@playwright/test';
import {
  cleanupE2eData,
  createDevUserViaApi,
  createGameViaUi,
  daysFromNow,
  deliverBunqRequestInquiryAcceptedWebhook,
  devLoginAs,
  e2eTitle,
  getPaymentRequestIdForUserRegistration,
  registerForGameViaUi,
  resetBunqMock,
  updateGame,
  waitForBackend,
} from './support/fixtures';

const BUNQ_E2E_PASSWORD = 'BunqE2E!Pass9';

test.describe('Bunq mock and webhook-driven payments', () => {
  test.beforeEach(async ({ request }) => {
    await waitForBackend(request);
    await resetBunqMock();
    await cleanupE2eData();
  });

  test('E2E-BUNQ-001 Bunq mock webhook marks player paid after admin sends payment requests', async ({ browser, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Bunq Admin', true);
    const participant = await createDevUserViaApi(request, testInfo, 'Bunq Participant');

    const adminContext = await browser.newContext();
    const participantContext = await browser.newContext();

    try {
      const adminPage = await adminContext.newPage();
      const participantPage = await participantContext.newPage();

      await devLoginAs(adminPage, admin);
      const game = await createGameViaUi(adminPage, {
        title: e2eTitle(testInfo, 'Bunq Webhook Game'),
        dateTime: daysFromNow(2),
      });

      await devLoginAs(participantPage, participant);
      await registerForGameViaUi(participantPage, participant, game.id);

      await updateGame(game.id, { date_time: daysFromNow(-2) });

      await adminPage.goto('/bunq-settings');
      await expect(adminPage.getByRole('heading', { name: 'Bunq Settings' })).toBeVisible();
      await adminPage.getByRole('button', { name: 'Enable Bunq Integration' }).click();
      await adminPage.locator('#apiKey').fill('e2e-bunq-api-key');
      await adminPage.locator('#apiKeyName').fill('E2E Bunq Client');
      await adminPage.locator('.credentials-form #password').fill(BUNQ_E2E_PASSWORD);
      await adminPage.getByRole('button', { name: 'Enable Integration' }).click();
      await expect(adminPage.getByText('Bunq integration enabled successfully')).toBeVisible({ timeout: 60_000 });

      await adminPage.goto(`/game/${game.id}`);
      const sendBtn = adminPage.getByTitle('Send payment requests to unpaid players');
      await expect(sendBtn).toBeVisible({ timeout: 30_000 });
      await sendBtn.click();
      await adminPage.locator('.password-dialog-overlay').getByLabel('Password:').fill(BUNQ_E2E_PASSWORD);
      await adminPage.locator('.password-dialog-overlay').getByRole('button', { name: 'Submit' }).click();
      const paymentSentDialog = adminPage.getByRole('dialog').filter({ hasText: 'Payment requests sent' });
      await expect(paymentSentDialog.getByText(/payment requests sent successfully/i)).toBeVisible({ timeout: 60_000 });
      await paymentSentDialog.getByRole('button', { name: 'OK' }).click();

      const inquiryId = await getPaymentRequestIdForUserRegistration(game.id, participant.id);
      expect(inquiryId).toBeTruthy();
      await deliverBunqRequestInquiryAcceptedWebhook(inquiryId!);

      await adminPage.reload();
      const row = adminPage.locator('.player-item').filter({ hasText: participant.displayName });
      await expect(row.getByText('Paid')).toBeVisible();
    } finally {
      await adminContext.close();
      await participantContext.close();
    }
  });
});
