import { expect, test } from '@playwright/test';
import {
  cleanupE2eData,
  createDevUserViaApi,
  devLoginAs,
  selectUserInUserSearch,
  waitForBackend,
} from './support/fixtures';

async function openAdministratorsPage(page: import('@playwright/test').Page) {
  await page.goto('/game-administrators');
  await expect(page.getByRole('heading', { name: 'Game Administrators' })).toBeVisible();
}

async function openCreateAssignmentForm(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Add Assignment' }).click();
  await expect(page.getByRole('heading', { name: 'New Assignment' })).toBeVisible();
}

async function createAssignmentViaUi(
  page: import('@playwright/test').Page,
  options: { dayOptionValue: string; withPositions: boolean; userDisplayName: string }
) {
  await openCreateAssignmentForm(page);
  await page.getByLabel('Day of Week').selectOption(options.dayOptionValue);
  const positionsCheckbox = page.getByRole('checkbox', { name: /5-1 positions game/i });
  if (options.withPositions) {
    await positionsCheckbox.check();
  } else {
    await positionsCheckbox.uncheck();
  }
  await selectUserInUserSearch(page, options.userDisplayName);
  await page.getByRole('button', { name: 'Create' }).click();
}

test.describe('game administrator assignment scenarios', () => {
  test.beforeEach(async ({ request }) => {
    await waitForBackend(request);
    await cleanupE2eData();
  });

  test('E2E-ASSIGN-001 global admin opens Game Administrators and sees empty state', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Assign Empty Admin', true);
    await devLoginAs(page, admin);
    await openAdministratorsPage(page);

    await expect(page.getByText('No administrator assignments yet.')).toBeVisible();
    await expect(page.getByText('Create one to get started.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Assignment' })).toBeVisible();
  });

  test('E2E-ASSIGN-002 and E2E-ASSIGN-003 global admin creates assignment with day and 5-1 badge', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Assign Create Admin', true);
    const assignee = await createDevUserViaApi(request, testInfo, 'Assign Create Target');
    await devLoginAs(page, admin);
    await openAdministratorsPage(page);
    await createAssignmentViaUi(page, {
      dayOptionValue: '2',
      withPositions: true,
      userDisplayName: assignee.displayName,
    });

    const row = page.locator('.administrator-item').filter({ hasText: assignee.displayName });
    await expect(row).toBeVisible();
    await expect(row.locator('.day-badge')).toHaveText('Wednesday');
    await expect(row.locator('.positions-badge')).toHaveText('5-1');
  });

  test('E2E-ASSIGN-004 global admin opens player info from an assignment row', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Assign Info Admin', true);
    const assignee = await createDevUserViaApi(request, testInfo, 'Assign Info Target');
    await devLoginAs(page, admin);
    await openAdministratorsPage(page);
    await createAssignmentViaUi(page, {
      dayOptionValue: '0',
      withPositions: false,
      userDisplayName: assignee.displayName,
    });

    await page.locator('.administrator-item').filter({ hasText: assignee.displayName }).locator('.user-name.clickable').click();

    await expect(page.getByRole('heading', { name: 'Player details' })).toBeVisible();
    await expect(page.getByText('Display Name')).toBeVisible();
    await expect(page.locator('.player-info-dialog').getByText(assignee.displayName)).toBeVisible();
  });

  test('E2E-ASSIGN-005 global admin deletes an assignment after confirming', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Assign Delete Admin', true);
    const assignee = await createDevUserViaApi(request, testInfo, 'Assign Delete Target');
    await devLoginAs(page, admin);
    await openAdministratorsPage(page);
    await createAssignmentViaUi(page, {
      dayOptionValue: '1',
      withPositions: false,
      userDisplayName: assignee.displayName,
    });

    page.once('dialog', (dialog) => {
      expect(dialog.message()).toContain('delete this assignment');
      void dialog.accept();
    });
    await page.getByLabel('Delete assignment').click();

    await expect(page.getByText('No administrator assignments yet.')).toBeVisible();
  });

  test('E2E-ASSIGN-006 global admin cancels assignment deletion and assignment remains', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Assign Cancel Admin', true);
    const assignee = await createDevUserViaApi(request, testInfo, 'Assign Cancel Target');
    await devLoginAs(page, admin);
    await openAdministratorsPage(page);
    await createAssignmentViaUi(page, {
      dayOptionValue: '3',
      withPositions: false,
      userDisplayName: assignee.displayName,
    });

    page.once('dialog', (dialog) => {
      void dialog.dismiss();
    });
    await page.getByLabel('Delete assignment').click();

    await expect(page.locator('.administrator-item').filter({ hasText: assignee.displayName })).toBeVisible();
  });

  test('E2E-ASSIGN-007 non-admin participant is redirected away from game administrators', async ({ page, request }, testInfo) => {
    const participant = await createDevUserViaApi(request, testInfo, 'Assign Blocked Participant');
    await devLoginAs(page, participant);
    await page.goto('/game-administrators');

    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: 'Game Administrators' })).toHaveCount(0);
  });
});
