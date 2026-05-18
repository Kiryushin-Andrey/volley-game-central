import { expect, test } from '@playwright/test';
import {
  cleanupE2eData,
  createDevUserViaApi,
  createGame,
  devLogin,
  devLoginAs,
  e2eTitle,
  findGameByTitle,
  waitForBackend,
} from './support/fixtures';

async function fillRequiredGameFields(page: import('@playwright/test').Page, title: string) {
  await page.locator('#maxPlayers').fill('12');
  await page.locator('#unregisterDeadlineHours').fill('5');
  await page.locator('#paymentAmount').fill('7.50');
  await page.locator('#locationName').fill('E2E Form Hall');
  await page.locator('#locationLink').fill('https://maps.example/e2e-form-hall');
  await page.locator('#title').fill(title);
}

async function setCheckbox(page: import('@playwright/test').Page, selector: string, checked = true) {
  await page.locator(selector).evaluate((element, value) => {
    const input = element as HTMLInputElement;
    input.checked = value;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, checked);
}

test.describe('game creation and editing scenarios', () => {
  test.beforeEach(async ({ request }) => {
    await waitForBackend(request);
    await cleanupE2eData();
  });

  test('E2E-FORM-001 global admin opens Create New Game from games home', async ({ page }, testInfo) => {
    await devLogin(page, testInfo, 'Open Form Admin', true);
    await page.getByTitle('Create New Game').click();

    await expect(page.getByRole('heading', { name: 'Create New Game' })).toBeVisible();
  });

  test('E2E-FORM-002 global admin creates a standard game', async ({ page }, testInfo) => {
    const title = e2eTitle(testInfo, 'Standard Create');

    await devLogin(page, testInfo, 'Standard Create Admin', true);
    await page.goto('/games/new');
    await fillRequiredGameFields(page, title);
    await page.getByRole('button', { name: 'Create Game' }).click();

    await expect(page).toHaveURL('/');
    const created = await findGameByTitle(title);
    expect(created).toBeTruthy();
    expect(created.location_name).toBe('E2E Form Hall');
    expect(created.payment_amount).toBe(750);
  });

  test('E2E-FORM-003 global admin previews total-cost pricing', async ({ page }, testInfo) => {
    await devLogin(page, testInfo, 'Total Cost Admin', true);
    await page.goto('/games/new');

    await page.locator('#maxPlayers').fill('10');
    await setCheckbox(page, '#pricingMode');
    await page.locator('#paymentAmount').fill('100');

    await expect(page.getByText('€100 ÷ 10 players = €10.00 per player')).toBeVisible();
  });

  test('E2E-FORM-004 global admin creates a Playing 5-1 game', async ({ page }, testInfo) => {
    const title = e2eTitle(testInfo, 'Five One Create');

    await devLogin(page, testInfo, 'Five One Admin', true);
    await page.goto('/games/new');
    await fillRequiredGameFields(page, title);
    await setCheckbox(page, '#withPositions');
    await page.getByRole('button', { name: 'Create Game' }).click();

    const created = await findGameByTitle(title);
    expect(created.with_positions).toBe(true);
  });

  test('E2E-FORM-005 global admin creates a priority-player game', async ({ page }, testInfo) => {
    const title = e2eTitle(testInfo, 'Priority Create');

    await devLogin(page, testInfo, 'Priority Create Admin', true);
    await page.goto('/games/new');
    await fillRequiredGameFields(page, title);
    await setCheckbox(page, '#withPriorityPlayers');
    await page.getByRole('button', { name: 'Create Game' }).click();

    const created = await findGameByTitle(title);
    expect(created.with_priority_players).toBe(true);
  });

  test('E2E-FORM-006 global admin creates a readonly game that participants cannot self-register for', async ({ page, request }, testInfo) => {
    const title = e2eTitle(testInfo, 'Readonly Create');
    const participant = await createDevUserViaApi(request, testInfo, 'Readonly Created Participant');

    await devLogin(page, testInfo, 'Readonly Create Admin', true);
    await page.goto('/games/new');
    await fillRequiredGameFields(page, title);
    await setCheckbox(page, '#readonly');
    await page.getByRole('button', { name: 'Create Game' }).click();

    const created = await findGameByTitle(title);
    expect(created.readonly).toBe(true);

    await page.getByRole('button', { name: 'Logout' }).click();
    await devLoginAs(page, participant);
    await page.goto(`/game/${created.id}`);
    await expect(page.getByText('This game is readonly. Registration and deregistration are closed.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Join Game' })).toHaveCount(0);
  });

  test('E2E-FORM-007 global admin cancels game creation without creating a game', async ({ page }, testInfo) => {
    const title = e2eTitle(testInfo, 'Cancelled Create');

    await devLogin(page, testInfo, 'Cancel Create Admin', true);
    await page.goto('/games/new');
    await fillRequiredGameFields(page, title);
    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(page).toHaveURL('/');
    expect(await findGameByTitle(title)).toBeNull();
  });

  test('E2E-FORM-008 global admin edits game settings and sees updated details', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Edit Admin', true);
    const originalTitle = e2eTitle(testInfo, 'Edit Original');
    const updatedTitle = e2eTitle(testInfo, 'Edit Updated');
    const game = await createGame({ title: originalTitle, createdById: admin.id });

    await devLoginAs(page, admin);
    await page.goto(`/game/${game.id}`);
    await page.getByTitle('Edit Game Settings').click();
    await expect(page.getByRole('heading', { name: 'Edit Game Settings' })).toBeVisible();

    await page.locator('#title').fill(updatedTitle);
    await page.locator('#locationName').fill('E2E Edited Hall');
    await page.locator('#maxPlayers').fill('16');
    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect(page).toHaveURL(new RegExp(`/game/${game.id}$`));
    await expect(page.getByText(updatedTitle)).toBeVisible();
    await expect(page.getByRole('link', { name: 'E2E Edited Hall' })).toBeVisible();
  });

  test('E2E-FORM-009 global admin cancels editing without persisting changes', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Cancel Edit Admin', true);
    const originalTitle = e2eTitle(testInfo, 'Cancel Edit Original');
    const cancelledTitle = e2eTitle(testInfo, 'Cancel Edit New');
    const game = await createGame({ title: originalTitle, createdById: admin.id });

    await devLoginAs(page, admin);
    await page.goto(`/game/${game.id}/edit`);
    await page.locator('#title').fill(cancelledTitle);
    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(page).toHaveURL(new RegExp(`/game/${game.id}$`));
    await expect(page.getByText(originalTitle)).toBeVisible();
    await expect(page.getByText(cancelledTitle)).toHaveCount(0);
  });

  test('E2E-FORM-010 invalid numeric bounds prevent game creation', async ({ page }, testInfo) => {
    const title = e2eTitle(testInfo, 'Invalid Create');

    await devLogin(page, testInfo, 'Invalid Create Admin', true);
    await page.goto('/games/new');
    await fillRequiredGameFields(page, title);
    await page.locator('#maxPlayers').fill('1');
    await page.getByRole('button', { name: 'Create Game' }).click();

    await expect(page.getByRole('heading', { name: 'Create New Game' })).toBeVisible();
    expect(await findGameByTitle(title)).toBeNull();
  });
});
