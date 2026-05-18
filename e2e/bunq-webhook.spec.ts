import { expect, test } from '@playwright/test';
import {
  cleanupE2eData,
  createDevUserViaApi,
  createGameViaUi,
  daysFromNow,
  deliverBunqRequestInquiryAcceptedWebhook,
  devLoginAs,
  enableBunqIntegrationViaUi,
  e2eTitle,
  getPaymentRequestIdForUserRegistration,
  moveGameToPastViaUi,
  registerForGameViaUi,
  resetBunqMock,
  sendPaymentRequestsViaUi,
  waitForBackend,
} from './support/fixtures';

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

      await moveGameToPastViaUi(adminPage, game.id);
      await enableBunqIntegrationViaUi(adminPage);
      await adminPage.goto(`/game/${game.id}`);
      await sendPaymentRequestsViaUi(adminPage);

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
