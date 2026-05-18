import { expect, test } from '@playwright/test';
import {
  addParticipantViaUi,
  BUNQ_E2E_PASSWORD,
  cleanupE2eData,
  createDevUserViaApi,
  createGameViaUi,
  daysFromNow,
  devLoginAs,
  dismissPaymentRequestsSentDialog,
  enableBunqIntegrationForUserViaUi,
  enableBunqIntegrationViaUi,
  e2eTitle,
  moveGameToPastViaUi,
  resetBunqMock,
  sendPaymentRequestsViaUi,
  submitSendPaymentRequestsPassword,
  switchToUser,
  updateGame,
  waitForBackend,
} from './support/fixtures';

function assignmentDayOptionForDate(date: Date) {
  const jsDay = date.getDay();
  return String(jsDay === 0 ? 6 : jsDay - 1);
}

async function createAssignmentForDate(
  page: import('@playwright/test').Page,
  assigneeDisplayName: string,
  gameDate: Date
) {
  await page.goto('/game-administrators');
  await expect(page.getByRole('heading', { name: 'Game Administrators' })).toBeVisible();
  await page.getByRole('button', { name: 'Add Assignment' }).click();
  await page.getByLabel('Day of Week').selectOption(assignmentDayOptionForDate(gameDate));
  await page.getByRole('checkbox', { name: /5-1 positions game/i }).uncheck();
  await page.getByPlaceholder('Search for a user...').fill(assigneeDisplayName);
  await page.getByText(assigneeDisplayName, { exact: true }).click();
  await page.getByRole('button', { name: 'Create' }).click();
}

test.describe('Bunq payment request scenarios', () => {
  test.beforeEach(async ({ request }) => {
    await waitForBackend(request);
    await resetBunqMock();
    await cleanupE2eData();
  });

  test('E2E-BUNQ-PAY-001 send control on past paid game only', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Pay Visibility Admin', true);
    const title = e2eTitle(testInfo, 'Pay Visibility');
    await devLoginAs(page, admin);

    const pastGame = await createGameViaUi(page, {
      title: `${title} Past`,
      dateTime: daysFromNow(2),
    });
    const upcomingGame = await createGameViaUi(page, {
      title: `${title} Upcoming`,
      dateTime: daysFromNow(3),
    });

    await moveGameToPastViaUi(page, pastGame.id);
    await enableBunqIntegrationViaUi(page);

    await page.goto(`/game/${pastGame.id}`);
    await expect(page.getByTitle('Send payment requests to unpaid players')).toBeVisible();

    await page.goto(`/game/${upcomingGame.id}`);
    await expect(page.getByTitle('Send payment requests to unpaid players')).toHaveCount(0);
  });

  test('E2E-BUNQ-PAY-002 send payment requests locks roster and shows collector', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Pay Send Admin', true);
    const participantA = await createDevUserViaApi(request, testInfo, 'Pay Send A');
    const participantB = await createDevUserViaApi(request, testInfo, 'Pay Send B');

    await devLoginAs(page, admin);
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Pay Send Game'),
      dateTime: daysFromNow(2),
    });

    await moveGameToPastViaUi(page, game.id);
    await enableBunqIntegrationViaUi(page);

    await page.goto(`/game/${game.id}`);
    await addParticipantViaUi(page, participantA.displayName);
    await expect(page.getByTitle('Add Participant')).toBeVisible();
    await addParticipantViaUi(page, participantB.displayName);

    await sendPaymentRequestsViaUi(page);

    await expect(page.getByText('Payments collected by')).toBeVisible();
    await expect(page.locator('.collector-name')).toContainText(admin.displayName);
    await expect(page.getByTitle('Add Participant')).toHaveCount(0);
    await expect(page.locator('.player-item').filter({ hasText: participantA.displayName }).getByText('Unpaid')).toBeVisible();
    await expect(page.locator('.player-item').filter({ hasText: participantB.displayName }).getByText('Unpaid')).toBeVisible();
    await expect(
      page.locator('.player-item').filter({ hasText: participantB.displayName }).getByRole('button', { name: 'Remove player' })
    ).toHaveCount(0);
  });

  test('E2E-BUNQ-PAY-003 second send reports zero new payment requests', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Pay Second Send Admin', true);
    const participant = await createDevUserViaApi(request, testInfo, 'Pay Second Send Player');

    await devLoginAs(page, admin);
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Pay Second Send'),
      dateTime: daysFromNow(2),
    });

    await moveGameToPastViaUi(page, game.id);
    await enableBunqIntegrationViaUi(page);

    await page.goto(`/game/${game.id}`);
    await addParticipantViaUi(page, participant.displayName);
    await sendPaymentRequestsViaUi(page);

    await page.reload();
    await expect(page.getByText('Payments collected by')).toBeVisible();
    await submitSendPaymentRequestsPassword(page, BUNQ_E2E_PASSWORD);
    await dismissPaymentRequestsSentDialog(page, 0);
  });

  test('E2E-BUNQ-PAY-004 invalid password on send keeps dialog open', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Pay Wrong Pass Admin', true);
    const participant = await createDevUserViaApi(request, testInfo, 'Pay Wrong Pass Player');

    await devLoginAs(page, admin);
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Pay Wrong Pass'),
      dateTime: daysFromNow(2),
    });

    await moveGameToPastViaUi(page, game.id);
    await enableBunqIntegrationViaUi(page);

    await page.goto(`/game/${game.id}`);
    await addParticipantViaUi(page, participant.displayName);

    await submitSendPaymentRequestsPassword(page, 'WrongPassword!9');
    await expect(page.locator('.password-dialog-overlay')).toBeVisible();
    await expect(page.locator('.password-dialog-overlay')).toContainText('Invalid password');
    await expect(page.getByRole('dialog').filter({ hasText: 'Payment requests sent' })).toHaveCount(0);
  });

  test('E2E-BUNQ-PAY-005 assigned admin can send payment requests participant cannot', async ({ page, request }, testInfo) => {
    const globalAdmin = await createDevUserViaApi(request, testInfo, 'Pay Assigned Global', true);
    const assignedAdmin = await createDevUserViaApi(request, testInfo, 'Pay Assigned Admin');
    const participant = await createDevUserViaApi(request, testInfo, 'Pay Assigned Participant');

    await devLoginAs(page, globalAdmin);
    const pastGameDate = daysFromNow(-3);
    await createAssignmentForDate(page, assignedAdmin.displayName, pastGameDate);
    await enableBunqIntegrationForUserViaUi(page, assignedAdmin.id);

    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Pay Assigned Game'),
      dateTime: pastGameDate,
    });
    await page.goto(`/game/${game.id}`);
    await addParticipantViaUi(page, participant.displayName);

    await switchToUser(page, assignedAdmin);
    await page.goto(`/game/${game.id}`);
    await sendPaymentRequestsViaUi(page);
    await expect(page.getByText('Payments collected by')).toBeVisible();

    await switchToUser(page, participant);
    await page.goto(`/game/${game.id}`);
    await expect(page.getByTitle('Send payment requests to unpaid players')).toHaveCount(0);
    await expect(page.getByTitle('Check payment status for this game')).toHaveCount(0);
    await expect(page.getByTitle('Edit Game Settings')).toHaveCount(0);
  });

  test('E2E-BUNQ-PAY-006 readonly past game supports send payment requests', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Pay Readonly Admin', true);
    const participant = await createDevUserViaApi(request, testInfo, 'Pay Readonly Player');

    await devLoginAs(page, admin);
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Pay Readonly Past'),
      dateTime: daysFromNow(2),
      readonly: true,
    });

    await moveGameToPastViaUi(page, game.id);
    await enableBunqIntegrationViaUi(page);

    await page.goto(`/game/${game.id}`);
    await addParticipantViaUi(page, participant.displayName);
    await expect(page.getByTitle('Send payment requests to unpaid players')).toBeVisible();
    await sendPaymentRequestsViaUi(page);
    await expect(page.getByText('Payments collected by')).toBeVisible();
  });

  test('E2E-BUNQ-PAY-007 zero-cost past game hides send payment requests', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Pay Zero Cost Admin', true);

    await devLoginAs(page, admin);
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Pay Zero Cost'),
      dateTime: daysFromNow(2),
      paymentAmount: '0',
    });

    await moveGameToPastViaUi(page, game.id);
    await enableBunqIntegrationViaUi(page);

    await page.goto(`/game/${game.id}`);
    await expect(page.getByTitle('Send payment requests to unpaid players')).toHaveCount(0);
  });

  test('E2E-BUNQ-PAY-008 fully paid past game hides send payment requests', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Pay Fully Paid Admin', true);

    await devLoginAs(page, admin);
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Pay Fully Paid'),
      dateTime: daysFromNow(-1),
    });

    await updateGame(game.id, { fully_paid: true });
    await enableBunqIntegrationViaUi(page);

    await page.goto(`/game/${game.id}`);
    await expect(page.getByTitle('Send payment requests to unpaid players')).toHaveCount(0);
  });
});
