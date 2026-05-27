import { expect, test, type Page, type APIRequestContext, type TestInfo } from '@playwright/test';
import {
  addParticipantViaUi,
  assignPlayerLevelViaAdminUi,
  cleanupE2eData,
  createDevUserViaApi,
  createGameViaUi,
  daysFromNow,
  devLogin,
  devLoginAs,
  e2eTitle,
  dayOfWeekOptionFromDate,
  nextWeekday,
  openPlayerInfoFromGameRoster,
  playerInfoDialog,
  selectUserInUserSearch,
  waitForPlayerOnPlayerLevelsPage,
  switchToUser,
  type DevUser,
  waitForBackend,
} from './support/fixtures';

async function createAssignmentViaUi(
  page: Page,
  userDisplayName: string,
  options?: { dayOptionValue?: string },
) {
  await page.goto('/game-administrators');
  await expect(page.getByRole('heading', { name: 'Game Administrators' })).toBeVisible();
  await page.getByRole('button', { name: 'Add Assignment' }).click();
  await page.getByLabel('Day of Week').selectOption(options?.dayOptionValue ?? '6');
  await page.getByRole('checkbox', { name: /5-1 positions game/i }).uncheck();
  await selectUserInUserSearch(page, userDisplayName);
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText(userDisplayName)).toBeVisible();
}

async function setupLeveledPlayerOnGameWithTarget(
  page: Page,
  request: APIRequestContext,
  testInfo: TestInfo,
  options?: { gameDate?: Date },
) {
  const admin = await createDevUserViaApi(request, testInfo, 'Level Game Setup Admin', true);
  const target = await createDevUserViaApi(request, testInfo, 'Level Game Setup Target');
  await devLoginAs(page, admin);
  await assignPlayerLevelViaAdminUi(page, admin, target, 'intermediate', { managerAlreadyLoggedIn: true });
  const game = await createGameViaUi(page, {
    title: e2eTitle(testInfo, 'Level Visibility Game'),
    dateTime: options?.gameDate ?? daysFromNow(2),
    maxPlayers: 12,
    readonly: true,
  });
  await page.goto(`/game/${game.id}`);
  await addParticipantViaUi(page, target.displayName);
  return { admin, target, game };
}

async function expectReadOnlyPlayerLevelInDialog(
  page: Page,
  options: { levelLabel: string; setByName?: string },
) {
  const dialog = playerInfoDialog(page);
  await expect(dialog.locator('.player-level-select')).toHaveCount(0);
  await expect(dialog.getByText('Player level', { exact: true })).toBeVisible();
  await expect(dialog.getByText(options.levelLabel, { exact: true })).toBeVisible();
  if (options.setByName) {
    await expect(dialog.getByText(/Set by/)).toContainText(options.setByName);
  }
}

test.describe('player levels admin scenarios', () => {
  test.beforeEach(async ({ request }) => {
    await waitForBackend(request);
    await cleanupE2eData();
  });

  test('E2E-LEVEL-001 global admin opens Players hub from games home', async ({ page }, testInfo) => {
    await devLogin(page, testInfo, 'Players Hub Admin', true);
    await page.getByRole('link', { name: 'Players' }).click();

    await expect(page).toHaveURL('/players');
    await expect(page.getByRole('heading', { name: 'Players' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Game administrators' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Player levels' })).toBeVisible();
  });

  test('E2E-LEVEL-002 global admin assigns player level from player levels page', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Level Assign Admin', true);
    const target = await createDevUserViaApi(request, testInfo, 'Level Assign Target');

    await devLoginAs(page, admin);
    await page.goto('/player-levels');
    await expect(page.getByRole('heading', { name: 'Player levels' })).toBeVisible();
    await expect(page.getByText(target.displayName)).toBeVisible();

    await page.getByText(target.displayName).click();
    await expect(page.getByRole('heading', { name: 'Player details' })).toBeVisible();
    await page.locator('.player-level-select').selectOption('intermediate');
    await expect(page.locator('.player-level-select')).toHaveValue('intermediate');
    await expect(playerInfoDialog(page).getByText(/Set by/)).toContainText(admin.displayName);

    await page.getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('.player-levels-item').filter({ hasText: target.displayName }).getByText('Intermediate')).toBeVisible();
  });

  test('E2E-LEVEL-003 name filter hides non-matching players client-side', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Level Filter Admin', true);
    const alpha = await createDevUserViaApi(request, testInfo, 'Alpha Filter Player');
    const beta = await createDevUserViaApi(request, testInfo, 'Beta Filter Player');

    await devLoginAs(page, admin);
    await page.goto('/player-levels');
    await expect(page.getByText(alpha.displayName)).toBeVisible();
    await expect(page.getByText(beta.displayName)).toBeVisible();

    await page.getByLabel('Filter by name').fill('Alpha Filter');
    await expect(page.getByText(alpha.displayName)).toBeVisible();
    await expect(page.getByText(beta.displayName)).toHaveCount(0);
  });

  test('E2E-LEVEL-004 non-admin cannot access players hub or player levels', async ({ page, request }, testInfo) => {
    const participant = await createDevUserViaApi(request, testInfo, 'Level Blocked Participant');
    await devLoginAs(page, participant);

    await page.goto('/players');
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: 'Players' })).toHaveCount(0);

    await page.goto('/player-levels');
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: 'Player levels' })).toHaveCount(0);
  });

  test('E2E-LEVEL-005 TC user can manage player levels but not game administrators', async ({ page, request }, testInfo) => {
    const tcUser = await createDevUserViaApi(request, testInfo, 'Level TC User', { isTc: true });
    const target = await createDevUserViaApi(request, testInfo, 'Level TC Target');

    await devLoginAs(page, tcUser);
    await page.getByTitle('Player levels').click();
    await expect(page).toHaveURL('/player-levels');
    await waitForPlayerOnPlayerLevelsPage(page, target.displayName);

    await page.goto('/players');
    await expect(page).toHaveURL('/player-levels');

    await page.getByText(target.displayName).click();
    await page.locator('.player-level-select').selectOption('advanced');
    await expect(page.locator('.player-level-select')).toHaveValue('advanced');

    await page.goto('/game-administrators');
    await expect(page).toHaveURL('/');
  });

  test('E2E-LEVEL-006 TC-only user sees Player levels toolbar icon not Players hub', async ({ page, request }, testInfo) => {
    const tcUser = await createDevUserViaApi(request, testInfo, 'Level TC Toolbar', { isTc: true });
    await devLoginAs(page, tcUser);

    await expect(page.getByTitle('Player levels')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Players' })).toHaveCount(0);
  });

  test('E2E-LEVEL-007 admin and TC user sees full Players hub', async ({ page, request }, testInfo) => {
    const adminTc = await createDevUserViaApi(request, testInfo, 'Level Admin TC', { isAdmin: true, isTc: true });
    await devLoginAs(page, adminTc);

    await page.getByRole('link', { name: 'Players' }).click();
    await expect(page).toHaveURL('/players');
    await expect(page.getByRole('heading', { name: 'Players' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Game administrators' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Player levels' })).toBeVisible();
  });

  test('E2E-LEVEL-008 TC user assignment shows Set by TC display name', async ({ page, request }, testInfo) => {
    const tcUser = await createDevUserViaApi(request, testInfo, 'Level TC Assigner', { isTc: true });
    const target = await createDevUserViaApi(request, testInfo, 'Level TC Assign Target');

    await devLoginAs(page, tcUser);
    await page.goto('/player-levels');
    await waitForPlayerOnPlayerLevelsPage(page, target.displayName);
    await page.locator('.player-levels-item').filter({ hasText: target.displayName }).click();
    await page.locator('.player-level-select').selectOption('advanced');
    await expect(playerInfoDialog(page).getByText(/Set by/)).toContainText(tcUser.displayName);
  });

  test('E2E-LEVEL-009 global admin sees read-only player level on game details', async ({ page, request }, testInfo) => {
    const { admin, target, game } = await setupLeveledPlayerOnGameWithTarget(page, request, testInfo);
    await page.goto(`/game/${game.id}`);
    await openPlayerInfoFromGameRoster(page, target.displayName);
    await expectReadOnlyPlayerLevelInDialog(page, { levelLabel: 'Intermediate', setByName: admin.displayName });
  });

  test('E2E-LEVEL-010 TC user sees read-only player level on game details', async ({ page, request }, testInfo) => {
    const { admin, target, game } = await setupLeveledPlayerOnGameWithTarget(page, request, testInfo);
    const tcUser = await createDevUserViaApi(request, testInfo, 'Level TC Game Details', { isTc: true });
    await switchToUser(page, tcUser);
    await page.goto(`/game/${game.id}`);
    await openPlayerInfoFromGameRoster(page, target.displayName);
    await expectReadOnlyPlayerLevelInDialog(page, { levelLabel: 'Intermediate', setByName: admin.displayName });
  });

  test('E2E-LEVEL-011 assigned admin sees read-only player level on game details', async ({ page, request }, testInfo) => {
    const globalAdmin = await createDevUserViaApi(request, testInfo, 'Level Assigned Setup Admin', true);
    const assignedAdmin = await createDevUserViaApi(request, testInfo, 'Level Assigned Admin');
    const target = await createDevUserViaApi(request, testInfo, 'Level Assigned Target');

    await devLoginAs(page, globalAdmin);
    await assignPlayerLevelViaAdminUi(page, globalAdmin, target, 'intermediate', { managerAlreadyLoggedIn: true });
    const gameDate = nextWeekday(6);
    await createAssignmentViaUi(page, assignedAdmin.displayName, {
      dayOptionValue: dayOfWeekOptionFromDate(gameDate),
    });
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Assigned Admin Level Game'),
      dateTime: gameDate,
      maxPlayers: 12,
      readonly: true,
    });
    await page.goto(`/game/${game.id}`);
    await addParticipantViaUi(page, target.displayName);

    await switchToUser(page, assignedAdmin);
    await page.goto(`/game/${game.id}`);
    await openPlayerInfoFromGameRoster(page, target.displayName);
    await expectReadOnlyPlayerLevelInDialog(page, { levelLabel: 'Intermediate', setByName: globalAdmin.displayName });
  });

  test('E2E-LEVEL-012 participant cannot open player info from game details roster', async ({ page, request }, testInfo) => {
    const { admin, target, game } = await setupLeveledPlayerOnGameWithTarget(page, request, testInfo);
    const participant = await createDevUserViaApi(request, testInfo, 'Level Roster Participant');
    await page.goto(`/game/${game.id}`);
    await addParticipantViaUi(page, participant.displayName);
    await switchToUser(page, participant);
    await page.goto(`/game/${game.id}`);

    const otherRow = page.locator('.players-section .player-item').filter({ hasText: target.displayName });
    await otherRow.locator('.player-details').click();
    await expect(page.getByRole('heading', { name: 'Player details' })).toHaveCount(0);
  });

  test('E2E-LEVEL-013 global admin sees player level in Game Administrators dialog', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Level Assign Dialog Admin', true);
    const assignee = await createDevUserViaApi(request, testInfo, 'Level Assign Dialog Target');

    await devLoginAs(page, admin);
    await assignPlayerLevelViaAdminUi(page, admin, assignee, 'beginner', { managerAlreadyLoggedIn: true });
    await createAssignmentViaUi(page, assignee.displayName, { dayOptionValue: '0' });

    await page.locator('.administrator-item').filter({ hasText: assignee.displayName }).locator('.user-name.clickable').click();
    await expect(page.getByRole('heading', { name: 'Player details' })).toBeVisible();
    await expectReadOnlyPlayerLevelInDialog(page, { levelLabel: 'Beginner', setByName: admin.displayName });
  });

  test('E2E-LEVEL-014 global admin sees player level in Priority Players dialog', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Level Priority Admin', true);
    const assignmentHolder = await createDevUserViaApi(request, testInfo, 'Level Priority Assignment Holder');
    const priorityPlayer = await createDevUserViaApi(request, testInfo, 'Level Priority Target');

    await devLoginAs(page, admin);
    await assignPlayerLevelViaAdminUi(page, admin, priorityPlayer, 'advanced', { managerAlreadyLoggedIn: true });
    await createAssignmentViaUi(page, assignmentHolder.displayName, { dayOptionValue: '1' });

    const assignmentRow = page.locator('.administrator-item').filter({ hasText: assignmentHolder.displayName });
    const manageLink = assignmentRow.getByTitle('Manage Priority Players');
    await manageLink.click();
    await expect(page.getByRole('heading', { name: 'Priority Players' })).toBeVisible();
    await expect(page.locator('.assignment-group')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Add Priority Player' })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Add Priority Player' }).click();
    await selectUserInUserSearch(page, priorityPlayer.displayName);
    await expect(page.locator('.priority-player-item').filter({ hasText: priorityPlayer.displayName })).toBeVisible();

    await page.locator('.priority-player-item').filter({ hasText: priorityPlayer.displayName }).locator('.user-name.clickable').click();
    await expect(page.getByRole('heading', { name: 'Player details' })).toBeVisible();
    await expectReadOnlyPlayerLevelInDialog(page, { levelLabel: 'Advanced', setByName: admin.displayName });
  });

  test('E2E-LEVEL-015 assigned admin does not see player level in Priority Players dialog', async ({ page, request }, testInfo) => {
    const globalAdmin = await createDevUserViaApi(request, testInfo, 'Level Priority Setup Admin', true);
    const assignedAdmin = await createDevUserViaApi(request, testInfo, 'Level Priority Assigned Admin');
    const priorityPlayer = await createDevUserViaApi(request, testInfo, 'Level Priority Assigned Target');

    await devLoginAs(page, globalAdmin);
    await assignPlayerLevelViaAdminUi(page, globalAdmin, priorityPlayer, 'intermediate', { managerAlreadyLoggedIn: true });
    await createAssignmentViaUi(page, assignedAdmin.displayName, { dayOptionValue: '2' });

    const assignmentRow = page.locator('.administrator-item').filter({ hasText: assignedAdmin.displayName });
    const assignmentHref = await assignmentRow.getByTitle('Manage Priority Players').getAttribute('href');
    expect(assignmentHref).toBeTruthy();

    await switchToUser(page, assignedAdmin);
    await page.goto(assignmentHref!);
    await expect(page.getByRole('heading', { name: 'Priority Players' })).toBeVisible();
    await expect(page.locator('.assignment-group')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Add Priority Player' })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Add Priority Player' }).click();
    await selectUserInUserSearch(page, priorityPlayer.displayName);

    await page.locator('.priority-player-item').filter({ hasText: priorityPlayer.displayName }).locator('.user-name.clickable').click();
    await expect(page.getByRole('heading', { name: 'Player details' })).toBeVisible();
    await expect(playerInfoDialog(page).getByText('Player level', { exact: true })).toHaveCount(0);
    await expect(playerInfoDialog(page).getByText(/Set by/)).toHaveCount(0);
  });
});

