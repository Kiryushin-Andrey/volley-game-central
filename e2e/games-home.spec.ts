import { expect, test } from '@playwright/test';
import {
  cleanupE2eData,
  createAdminAssignment,
  createDevUserViaApi,
  createGame,
  daysFromNow,
  devLogin,
  devLoginAs,
  e2eTitle,
  nextWeekday,
  registerUser,
  updateGame,
  waitForBackend,
} from './support/fixtures';

test.describe('games home scenarios', () => {
  test.beforeEach(async ({ request }) => {
    await waitForBackend(request);
    await cleanupE2eData();
  });

  test('E2E-HOME-001 participant sees an upcoming game on the games home', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Home Admin', true);
    const title = e2eTitle(testInfo, 'Home Upcoming');
    await createGame({ title, createdById: admin.id, dateTime: nextWeekday(0), maxPlayers: 12 });

    await devLogin(page, testInfo, 'Home Participant');

    await expect(page.getByText(title)).toBeVisible();
  });

  test('E2E-HOME-002 participant opens a game card and reaches details', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Card Admin', true);
    const title = e2eTitle(testInfo, 'Open Card');
    await createGame({ title, createdById: admin.id, dateTime: nextWeekday(0) });

    await devLogin(page, testInfo, 'Card Participant');
    await page.getByText(title).click();

    await expect(page).toHaveURL(/\/game\/\d+/);
    await expect(page.getByText(title)).toBeVisible();
  });

  test('E2E-HOME-003 category multi-select shows selected category information', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Category Admin', true);
    await createGame({
      title: e2eTitle(testInfo, 'Thursday Five One'),
      createdById: admin.id,
      dateTime: nextWeekday(4),
      withPositions: true,
    });

    await devLogin(page, testInfo, 'Category Participant');
    await page.locator('.category-multiselect-trigger').click();
    await page.getByText('Thursday 5-1').click();

    await expect(page.getByText('Thursday 5-1: Competitive games with assigned positions')).toBeVisible();
  });

  test('E2E-HOME-004 registered participant sees You are in badge', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Registered Admin', true);
    const participant = await devLogin(page, testInfo, 'Registered Participant');
    const title = e2eTitle(testInfo, 'Registered Badge');
    const game = await createGame({ title, createdById: admin.id, dateTime: nextWeekday(0) });
    await registerUser(game.id, participant.id, new Date());

    await page.goto('/');

    await expect(page.getByText(title)).toBeVisible();
    await expect(page.getByText("You're in")).toBeVisible();
  });

  test('E2E-HOME-005 waitlisted participant sees Waitlist badge', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Waitlist Admin', true);
    const firstPlayer = await createDevUserViaApi(request, testInfo, 'First Player');
    const participant = await devLogin(page, testInfo, 'Waitlist Participant');
    const title = e2eTitle(testInfo, 'Waitlist Badge');
    const game = await createGame({ title, createdById: admin.id, dateTime: nextWeekday(0), maxPlayers: 1 });
    await registerUser(game.id, firstPlayer.id, new Date(Date.now() - 60_000));
    await registerUser(game.id, participant.id, new Date());

    await page.goto('/');

    await expect(page.getByText(title)).toBeVisible();
    await expect(page.getByText('Waitlist', { exact: true })).toBeVisible();
  });

  test('E2E-HOME-006 location link opens externally without changing app route', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Location Admin', true);
    const title = e2eTitle(testInfo, 'Location Card');
    await createGame({
      title,
      createdById: admin.id,
      dateTime: nextWeekday(0),
      locationName: 'E2E Maps Gym',
      locationLink: 'https://example.com/e2e-gym',
    });

    await devLogin(page, testInfo, 'Location Participant');
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
    await createGame({ title, createdById: adminUser.id, dateTime: daysFromNow(-1) });

    await devLoginAs(page, adminUser);
    await page.getByLabel('Past').check();

    await expect(page.getByText(title)).toBeVisible();
    await page.getByLabel('Upcoming').check();
    await expect(page.getByText(title)).toHaveCount(0);
  });

  test('E2E-HOME-008 global admin toggles Show all scheduled games', async ({ page, request }, testInfo) => {
    const adminUser = await createDevUserViaApi(request, testInfo, 'Show All Admin', true);
    const title = e2eTitle(testInfo, 'Far Future');
    await createGame({ title, createdById: adminUser.id, dateTime: nextWeekday(0, 21) });

    await devLoginAs(page, adminUser);
    await expect(page.getByText(title)).toHaveCount(0);
    await page.getByLabel('Show all scheduled games').check();

    await expect(page.getByText(title)).toBeVisible();
  });

  test('E2E-HOME-009 global admin toggles Show fully paid games', async ({ page, request }, testInfo) => {
    const adminUser = await createDevUserViaApi(request, testInfo, 'Fully Paid Admin', true);
    const title = e2eTitle(testInfo, 'Fully Paid Past');
    await createGame({ title, createdById: adminUser.id, dateTime: daysFromNow(-1), fullyPaid: true });

    await devLoginAs(page, adminUser);
    await page.getByLabel('Past').check();
    await expect(page.getByText(title)).toHaveCount(0);
    await page.getByLabel('Show fully paid games').check();

    await expect(page.getByText(title)).toBeVisible();
  });

  test('E2E-HOME-010 global admin sees non-integration admin controls', async ({ page }, testInfo) => {
    await devLogin(page, testInfo, 'Toolbar Admin', true);

    await expect(page.getByTitle('Game Administrators')).toBeVisible();
    await expect(page.getByTitle('Create New Game')).toBeVisible();
  });

  test('E2E-HOME-011 assigned admin sees create access without global admin links', async ({ page, request }, testInfo) => {
    const assignedAdmin = await createDevUserViaApi(request, testInfo, 'Assigned Home Admin');
    await createAdminAssignment(6, false, assignedAdmin.id);

    await devLoginAs(page, assignedAdmin);

    await expect(page.getByTitle('Create New Game')).toBeVisible();
    await expect(page.getByTitle('Game Administrators')).toHaveCount(0);
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
});
