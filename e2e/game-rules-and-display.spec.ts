import { expect, test } from '@playwright/test';
import {
  cleanupE2eData,
  createDevUserViaApi,
  createGameViaUi,
  daysFromNow,
  devLogin,
  devLoginAs,
  e2eTitle,
  formatGameDateTimeForInput,
  nextWeekday,
  registerForGameViaUi,
  setCheckbox,
  switchToUser,
  waitForAdminGameCreateResponse,
  waitForBackend,
} from './support/fixtures';

test.describe('game rules and display scenarios', () => {
  test.beforeEach(async ({ request }) => {
    await waitForBackend(request);
    await cleanupE2eData();
  });

  test('E2E-ADMIN-015 global admin cannot add or remove players on upcoming open game', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Open Game Admin', true);
    const player = await createDevUserViaApi(request, testInfo, 'Open Game Player');
    await devLoginAs(page, admin);
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Upcoming Open Admin'),
      dateTime: daysFromNow(2),
      maxPlayers: 8,
    });
    await registerForGameViaUi(page, player, game.id);

    await switchToUser(page, admin);
    await page.goto(`/game/${game.id}`);

    await expect(page.locator('.admin-actions').getByTitle('Add Participant')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Remove player' })).toHaveCount(0);
    await expect(page.getByText(player.displayName)).toBeVisible();
  });

  test('E2E-GAME-012 past game hides waitlist and shows only main list for admin', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Past Waitlist Admin', true);
    const activeOne = await createDevUserViaApi(request, testInfo, 'Past Active One');
    const activeTwo = await createDevUserViaApi(request, testInfo, 'Past Active Two');
    const waitlisted = await createDevUserViaApi(request, testInfo, 'Past Waitlisted Only');
    await devLoginAs(page, admin);
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Past Waitlist Hidden'),
      dateTime: daysFromNow(-1),
      maxPlayers: 2,
    });
    await registerForGameViaUi(page, activeOne, game.id);
    await registerForGameViaUi(page, activeTwo, game.id);
    await registerForGameViaUi(page, waitlisted, game.id, 'Waitlist');

    await switchToUser(page, admin);
    await page.goto(`/game/${game.id}`);

    await expect(page.getByRole('heading', { name: 'Waiting List' })).toHaveCount(0);
    await expect(page.getByText(activeOne.displayName)).toBeVisible();
    await expect(page.getByText(activeTwo.displayName)).toBeVisible();
    await expect(page.getByText(waitlisted.displayName)).toHaveCount(0);
    await expect(page.locator('.players-section:not(.waitlist-section) .player-item')).toHaveCount(2);
  });

  test('E2E-FORM-011 global admin creates total-cost game and sees per-participant price on details', async ({
    page,
  }, testInfo) => {
    const title = e2eTitle(testInfo, 'Total Cost Saved');
    await devLogin(page, testInfo, 'Total Cost Admin', true);
    await page.goto('/games/new');
    const dateInput = page.getByPlaceholder('Select date and time');
    await dateInput.fill(formatGameDateTimeForInput(daysFromNow(2)));
    await dateInput.press('Enter');
    await page.locator('#maxPlayers').fill('10');
    await page.locator('#unregisterDeadlineHours').fill('5');
    await setCheckbox(page, '#pricingMode');
    await page.locator('#paymentAmount').fill('100');
    await page.locator('#locationName').fill('E2E Total Cost Hall');
    await page.locator('#locationLink').fill('https://maps.example/e2e-total-cost');
    await page.locator('#title').fill(title);
    const createResponsePromise = waitForAdminGameCreateResponse(page);
    await page.getByRole('button', { name: 'Create Game' }).click();
    const createResponse = await createResponsePromise;
    expect(createResponse.ok()).toBeTruthy();
    const { id } = (await createResponse.json()) as { id: number };
    await expect(page).toHaveURL('/');

    await page.goto(`/game/${id}`);
    await expect(page.getByText('€10.00 per participant')).toBeVisible();
  });

  test('E2E-FORM-012 editing max players updates total-cost per-player preview', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Edit Total Cost Admin', true);
    await devLoginAs(page, admin);
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Edit Total Cost'),
      dateTime: daysFromNow(2),
      maxPlayers: 10,
      paymentAmount: '100',
      pricingMode: 'total_cost',
    });

    await page.goto(`/game/${game.id}/edit`);
    await expect(page.getByText(/€100\.00 ÷ 10 players = €10\.00 per player/)).toBeVisible();

    await page.locator('#maxPlayers').fill('20');
    await expect(page.getByText(/€100\.00 ÷ 20 players = €5\.00 per player/)).toBeVisible();
  });

  test('E2E-HOME-016 game cards use yellow border for 5-1 and green for non-5-1 games', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Card Colors Admin', true);
    const participant = await createDevUserViaApi(request, testInfo, 'Card Colors Participant');
    await devLoginAs(page, admin);
    const fiveOneTitle = e2eTitle(testInfo, 'Card Five One');
    const regularTitle = e2eTitle(testInfo, 'Card Deti Plova');
    const thursday = nextWeekday(4);
    await createGameViaUi(page, {
      title: fiveOneTitle,
      dateTime: thursday,
      withPositions: true,
    });
    await createGameViaUi(page, {
      title: regularTitle,
      dateTime: thursday,
      withPositions: false,
      maxPlayers: 12,
    });

    await switchToUser(page, participant);
    await page.locator('.category-multiselect-trigger').click();
    await page.locator('label.category-multiselect-option').filter({ hasText: 'Thursday 5-1' }).click();
    await page.locator('.category-multiselect-trigger').click();
    await page.locator('label.category-multiselect-option').filter({ hasText: 'Thursday Deti Plova' }).click();
    await expect(page.getByText(fiveOneTitle)).toBeVisible();
    await expect(page.getByText(regularTitle)).toBeVisible();

    const fiveOneCard = page.locator('.game-card').filter({ hasText: fiveOneTitle });
    const regularCard = page.locator('.game-card').filter({ hasText: regularTitle });

    await expect(fiveOneCard).toHaveClass(/with-positions/);
    await expect(fiveOneCard).not.toHaveClass(/without-positions/);
    await expect(fiveOneCard).toHaveCSS('border-left-color', 'rgb(255, 193, 7)');

    await expect(regularCard).toHaveClass(/without-positions/);
    await expect(regularCard).not.toHaveClass(/with-positions/);
    await expect(regularCard).toHaveCSS('border-left-color', 'rgb(76, 175, 80)');
  });

  test('E2E-HOME-017 category info blocks use yellow for 5-1 and green for other categories', async ({
    page,
    request,
  }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Category Colors Admin', true);
    const participant = await createDevUserViaApi(request, testInfo, 'Category Colors Participant');
    await devLoginAs(page, admin);
    await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Category Five One'),
      dateTime: nextWeekday(4),
      withPositions: true,
    });
    await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Category Sunday'),
      dateTime: nextWeekday(0),
      withPositions: false,
    });

    await switchToUser(page, participant);
    await page.locator('.category-multiselect-trigger').click();
    await page.locator('label.category-multiselect-option').filter({ hasText: 'Thursday 5-1' }).click();

    const fiveOneBlock = page.locator('.category-info-block').filter({ hasText: 'Thursday 5-1' });
    await expect(fiveOneBlock).toHaveClass(/with-positions/);
    await expect(fiveOneBlock).toHaveCSS('background-color', 'rgb(255, 248, 225)');

    const sundayBlock = page.locator('.category-info-block').filter({ hasText: 'Sunday' });
    await expect(sundayBlock).toHaveClass(/without-positions/);
    await expect(sundayBlock).toHaveCSS('background-color', 'rgb(232, 245, 233)');
  });

  test('E2E-GAME-013 game details shows 5-1 category notice with yellow styling', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Details 5-1 Admin', true);
    const participant = await createDevUserViaApi(request, testInfo, 'Details 5-1 Participant');
    await devLoginAs(page, admin);
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Details Five One'),
      dateTime: nextWeekday(4),
      withPositions: true,
    });

    await switchToUser(page, participant);
    await page.goto(`/game/${game.id}`);

    const categoryBlock = page.locator('.category-info-block');
    await expect(categoryBlock).toContainText('Thursday 5-1');
    await expect(categoryBlock).toHaveClass(/with-positions/);
    await expect(categoryBlock).toHaveCSS('background-color', 'rgb(255, 248, 225)');
  });
});
