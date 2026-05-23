import { expect, test } from '@playwright/test';
import {
  addParticipantViaUi,
  cleanupE2eData,
  createDevUserViaApi,
  createGameViaUi,
  daysFromNow,
  devLogin,
  devLoginAs,
  enableBunqIntegrationViaUi,
  e2eTitle,
  moveGameToPastViaUi,
  nextWeekday,
  markGameFullyPaidViaBunq,
  registerForGameViaUi,
  resetBunqMock,
  sendPaymentRequestsViaUi,
  switchToUser,
  waitForBackend,
} from './support/fixtures';

type AdminAssignmentViaUiOptions = {
  dayOptionValue?: string;
  withPositions?: boolean;
};

async function createAdminAssignmentViaUi(
  page: import('@playwright/test').Page,
  userDisplayName: string,
  options?: AdminAssignmentViaUiOptions
) {
  const dayOptionValue = options?.dayOptionValue ?? '6';
  const withPositions = options?.withPositions ?? false;

  await page.goto('/players');
  await page.getByRole('link', { name: 'Game administrators' }).click();
  await expect(page.getByRole('heading', { name: 'Game Administrators' })).toBeVisible();
  await page.getByRole('button', { name: 'Add Assignment' }).click();
  await page.getByLabel('Day of Week').selectOption(dayOptionValue);
  const positionsCheckbox = page.getByRole('checkbox', { name: /5-1 positions game/i });
  if (withPositions) {
    await positionsCheckbox.check();
  } else {
    await positionsCheckbox.uncheck();
  }
  await page.getByPlaceholder('Search for a user...').fill(userDisplayName);
  await page.getByText(userDisplayName, { exact: true }).click();
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText(userDisplayName)).toBeVisible();
}

test.describe('games home scenarios', () => {
  test.beforeEach(async ({ request }) => {
    await waitForBackend(request);
    await cleanupE2eData();
  });

  test('E2E-HOME-001 participant sees an upcoming game on the games home', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Home Admin', true);
    const participant = await createDevUserViaApi(request, testInfo, 'Home Participant');
    const title = e2eTitle(testInfo, 'Home Upcoming');
    await devLoginAs(page, admin);
    await createGameViaUi(page, { title, dateTime: nextWeekday(0), maxPlayers: 12 });

    await switchToUser(page, participant);

    await expect(page.getByText(title)).toBeVisible();
  });

  test('E2E-HOME-002 participant opens a game card and reaches details', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Card Admin', true);
    const participant = await createDevUserViaApi(request, testInfo, 'Card Participant');
    const title = e2eTitle(testInfo, 'Open Card');
    await devLoginAs(page, admin);
    await createGameViaUi(page, { title, dateTime: nextWeekday(0) });

    await switchToUser(page, participant);
    await page.getByText(title).click();

    await expect(page).toHaveURL(/\/game\/\d+/);
    await expect(page.getByText(title)).toBeVisible();
  });

  test('E2E-HOME-003 category multi-select shows selected category information', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Category Admin', true);
    const participant = await createDevUserViaApi(request, testInfo, 'Category Participant');
    await devLoginAs(page, admin);
    await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Thursday Five One'),
      dateTime: nextWeekday(4),
      withPositions: true,
    });

    await switchToUser(page, participant);
    await page.locator('.category-multiselect-trigger').click();
    await page.getByText('Thursday 5-1').click();

    await expect(page.getByText('Thursday 5-1: Competitive games with assigned positions')).toBeVisible();
  });

  test('E2E-HOME-004 registered participant sees You are in badge', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Registered Admin', true);
    const participant = await createDevUserViaApi(request, testInfo, 'Registered Participant');
    const title = e2eTitle(testInfo, 'Registered Badge');
    await devLoginAs(page, admin);
    const game = await createGameViaUi(page, { title, dateTime: nextWeekday(0) });
    await registerForGameViaUi(page, participant, game.id);

    await page.goto('/');

    await expect(page.getByText(title)).toBeVisible();
    await expect(page.getByText("You're in")).toBeVisible();
  });

  test('E2E-HOME-005 waitlisted participant sees Waitlist badge', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Waitlist Admin', true);
    const firstPlayer = await createDevUserViaApi(request, testInfo, 'First Player');
    const secondPlayer = await createDevUserViaApi(request, testInfo, 'Second Player');
    const participant = await createDevUserViaApi(request, testInfo, 'Waitlist Participant');
    const title = e2eTitle(testInfo, 'Waitlist Badge');
    await devLoginAs(page, admin);
    const game = await createGameViaUi(page, { title, dateTime: nextWeekday(0), maxPlayers: 2 });
    await registerForGameViaUi(page, firstPlayer, game.id);
    await registerForGameViaUi(page, secondPlayer, game.id);
    await registerForGameViaUi(page, participant, game.id, 'Waitlist');

    await page.goto('/');

    await expect(page.getByText(title)).toBeVisible();
    await expect(page.getByText('Waitlist', { exact: true })).toBeVisible();
  });

  test('E2E-HOME-006 location link opens externally without changing app route', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Location Admin', true);
    const participant = await createDevUserViaApi(request, testInfo, 'Location Participant');
    const title = e2eTitle(testInfo, 'Location Card');
    await devLoginAs(page, admin);
    await createGameViaUi(page, {
      title,
      dateTime: nextWeekday(0),
      locationName: 'E2E Maps Gym',
      locationLink: 'https://example.com/e2e-gym',
    });

    await switchToUser(page, participant);
    const popupPromise = page.waitForEvent('popup');
    await page.getByRole('link', { name: /E2E Maps Gym/ }).click();
    const popup = await popupPromise;

    await expect(page).toHaveURL('/');
    expect(popup.url()).toContain('example.com/e2e-gym');
    await popup.close();
  });

  test('E2E-HOME-007 global admin switches between Upcoming and Past filters', async ({ page, request }, testInfo) => {
    const title = e2eTitle(testInfo, 'Past Filter');
    const adminUser = await createDevUserViaApi(request, testInfo, 'Past Filter Admin', true);
    await devLoginAs(page, adminUser);
    await createGameViaUi(page, { title, dateTime: daysFromNow(-1) });
    await page.getByLabel('Past').check();

    await expect(page.getByText(title)).toBeVisible();
    await page.getByLabel('Upcoming').check();
    await expect(page.getByText(title)).toHaveCount(0);
  });

  test('E2E-HOME-008 global admin toggles Show all scheduled games', async ({ page, request }, testInfo) => {
    const adminUser = await createDevUserViaApi(request, testInfo, 'Show All Admin', true);
    const title = e2eTitle(testInfo, 'Far Future');
    await devLoginAs(page, adminUser);
    await createGameViaUi(page, { title, dateTime: nextWeekday(0, 21) });
    await expect(page.getByText(title)).toHaveCount(0);
    await page.getByLabel('Show all scheduled games').check();

    await expect(page.getByText(title)).toBeVisible();
  });

  test('E2E-HOME-009 global admin toggles Show fully paid games', async ({ page, request }, testInfo) => {
    const adminUser = await createDevUserViaApi(request, testInfo, 'Fully Paid Admin', true);
    const participant = await createDevUserViaApi(request, testInfo, 'Fully Paid Participant');
    const title = e2eTitle(testInfo, 'Fully Paid Past');
    await devLoginAs(page, adminUser);
    const game = await createGameViaUi(page, { title, dateTime: daysFromNow(2) });
    await moveGameToPastViaUi(page, game.id);
    await resetBunqMock();
    await enableBunqIntegrationViaUi(page);
    await page.goto(`/game/${game.id}`);
    await addParticipantViaUi(page, participant.displayName);
    await markGameFullyPaidViaBunq(page, game.id, [participant.id]);
    await page.goto('/');
    await page.getByLabel('Past').check();
    await expect(page.getByText(title)).toHaveCount(0);
    await page.getByLabel('Show fully paid games').check();

    await expect(page.getByText(title)).toBeVisible();
  });

  test('E2E-HOME-010 global admin sees non-integration admin controls', async ({ page }, testInfo) => {
    await devLogin(page, testInfo, 'Toolbar Admin', true);

    await expect(page.getByTitle('Players')).toBeVisible();
    await expect(page.getByTitle('Create New Game')).toBeVisible();
  });

  test('E2E-HOME-011 assigned admin sees create access without global admin links', async ({ page, request }, testInfo) => {
    const globalAdmin = await createDevUserViaApi(request, testInfo, 'Assignment Home Creator', true);
    const assignedAdmin = await createDevUserViaApi(request, testInfo, 'Assigned Home Admin');
    await devLoginAs(page, globalAdmin);
    await createAdminAssignmentViaUi(page, assignedAdmin.displayName);

    await switchToUser(page, assignedAdmin);

    await expect(page.getByTitle('Create New Game')).toBeVisible();
    await expect(page.getByTitle('Players')).toHaveCount(0);
  });

  test('E2E-HOME-012 home error state retries after games API failure', async ({ page }, testInfo) => {
    let failedOnce = false;
    await page.route('**/api/games?**', async (route) => {
      if (!failedOnce) {
        failedOnce = true;
        await route.fulfill({ status: 500, body: JSON.stringify({ error: 'E2E forced failure' }) });
        return;
      }
      await route.continue();
    });

    await devLogin(page, testInfo, 'Retry Participant');

    await expect(page.getByRole('heading', { name: 'Error' })).toBeVisible();
    await page.getByRole('button', { name: 'Retry' }).click();
    await expect(page.getByRole('heading', { name: 'Error' })).toHaveCount(0);
  });

  test('E2E-HOME-013 default Sunday filter shows empty when only Thursday 5-1 games exist', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Sunday Filter Admin', true);
    const participant = await createDevUserViaApi(request, testInfo, 'Sunday Filter Participant');
    await devLoginAs(page, admin);
    await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Thursday Five One Only'),
      dateTime: nextWeekday(4),
      withPositions: true,
    });

    await switchToUser(page, participant);
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('selectedCategories'));
    await page.reload();

    await expect(page.getByText('No games available')).toBeVisible();
  });

  test('E2E-HOME-014 category multiselect can exclude all visible games', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Cat Exclude Admin', true);
    const participant = await createDevUserViaApi(request, testInfo, 'Cat Exclude Participant');
    await devLoginAs(page, admin);
    await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Sunday Category Game'),
      dateTime: nextWeekday(0),
      withPositions: false,
    });

    await switchToUser(page, participant);
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('selectedCategories'));
    await page.reload();
    await page.locator('.category-multiselect-trigger').click();
    await page.locator('label.category-multiselect-option').filter({ hasText: 'Thursday 5-1' }).click();
    await page.locator('label.category-multiselect-option').filter({ hasText: 'Sunday' }).click();

    await expect(page.getByText('No games available')).toBeVisible();
  });

  test('E2E-HOME-015 participant sees unpaid games block and Pay now opens payment link', async ({
    page,
    request,
  }, testInfo) => {
    await resetBunqMock();

    const admin = await createDevUserViaApi(request, testInfo, 'Unpaid Home Admin', true);
    const participant = await createDevUserViaApi(request, testInfo, 'Unpaid Home Participant');
    const locationName = 'E2E Unpaid Home Hall';
    const title = e2eTitle(testInfo, 'Unpaid Home Game');

    await devLoginAs(page, admin);
    const game = await createGameViaUi(page, {
      title,
      dateTime: daysFromNow(2),
      locationName,
    });

    await registerForGameViaUi(page, participant, game.id);

    await switchToUser(page, admin);
    await moveGameToPastViaUi(page, game.id);
    await enableBunqIntegrationViaUi(page);

    await page.goto(`/game/${game.id}`);
    await sendPaymentRequestsViaUi(page);

    await switchToUser(page, participant);
    await page.goto('/');

    await expect(page.getByText('Your unpaid games')).toBeVisible();
    const unpaidItem = page.locator('.unpaid-item').filter({ hasText: locationName });
    await expect(unpaidItem).toBeVisible();

    const popupPromise = page.waitForEvent('popup');
    await unpaidItem.getByRole('button', { name: 'Pay now' }).click();
    const popup = await popupPromise;
    await expect(popup).toHaveURL(/bunq\.me\/e2e-mock/);
    await popup.close();
  });
});
