import { expect, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';

type DevLoginOptions = {
  displayName: string;
  phoneLocal: string;
  isAdmin?: boolean;
};

async function waitForBackend(request: APIRequestContext) {
  await expect
    .poll(
      async () => {
        try {
          const response = await request.get('/api/health', { timeout: 5_000 });
          return response.status();
        } catch {
          return 0;
        }
      },
      { timeout: 45_000, message: 'backend health endpoint should be reachable through Vite proxy' }
    )
    .toBe(200);
}

function uniquePhoneLocal(testInfo: TestInfo, suffix: number) {
  const timestamp = Date.now().toString().slice(-8);
  return `6${timestamp}${testInfo.workerIndex}${suffix}`;
}

function uniqueName(testInfo: TestInfo, label: string) {
  return `E2E ${label} ${testInfo.workerIndex}-${Date.now().toString().slice(-5)}`;
}

async function openDevLogin(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
  await page.getByRole('button', { name: 'Phone number' }).click();
  await expect(page.getByText('Dev mode: No SMS verification required')).toBeVisible();
}

async function devLogin(page: Page, options: DevLoginOptions) {
  await openDevLogin(page);
  await page.getByLabel('Phone number').fill(options.phoneLocal);
  await page.getByLabel('Display name').fill(options.displayName);

  if (options.isAdmin) {
    await page.getByLabel('Administrator').check();
  }

  await page.getByRole('button', { name: 'Dev Login' }).click();
  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
  await expect(page.getByText(options.displayName)).toBeVisible();
}

test.describe('authentication and session scenarios', () => {
  test.beforeEach(async ({ request }) => {
    await waitForBackend(request);
  });

  test('E2E-AUTH-001 unauthenticated visitor sees landing page choices', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
    await expect(page.getByText('Choose how you want to continue:')).toBeVisible();
    await expect(page.getByText('Telegram')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Phone number' })).toBeVisible();
    await expect(page.getByText('How it works')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Source code at GitHub' })).toBeVisible();
  });

  test('E2E-AUTH-002 visitor expands How it works content', async ({ page }) => {
    await page.goto('/');

    await page.getByText('How it works').click();

    await expect(page.getByText('non-profit, recreational volleyball community')).toBeVisible();
    await expect(page.getByText('register for any game')).toBeVisible();
    await expect(page.getByText('payment requests and important notifications')).toBeVisible();
    await expect(page.getByText('cover the cost of the hall rental')).toBeVisible();
  });

  test('E2E-AUTH-003 participant logs in through dev mode', async ({ page }, testInfo) => {
    const displayName = uniqueName(testInfo, 'Participant');

    await devLogin(page, {
      displayName,
      phoneLocal: uniquePhoneLocal(testInfo, 1),
    });

    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
    await expect(page.getByLabel('Edit display name')).toContainText(displayName);
  });

  test('E2E-AUTH-004 global admin logs in through dev mode and sees admin controls', async ({ page }, testInfo) => {
    await devLogin(page, {
      displayName: uniqueName(testInfo, 'Admin'),
      phoneLocal: uniquePhoneLocal(testInfo, 2),
      isAdmin: true,
    });

    await expect(page.getByTitle('Game Administrators')).toBeVisible();
    await expect(page.getByTitle('Create New Game')).toBeVisible();
  });

  test('E2E-AUTH-005 isolated browser contexts keep separate users', async ({ browser }, testInfo) => {
    const participantName = uniqueName(testInfo, 'Context A');
    const adminName = uniqueName(testInfo, 'Context B');
    const participantContext = await browser.newContext();
    const adminContext = await browser.newContext();

    try {
      const participantPage = await participantContext.newPage();
      const adminPage = await adminContext.newPage();

      await devLogin(participantPage, {
        displayName: participantName,
        phoneLocal: uniquePhoneLocal(testInfo, 3),
      });
      await devLogin(adminPage, {
        displayName: adminName,
        phoneLocal: uniquePhoneLocal(testInfo, 4),
        isAdmin: true,
      });

      await expect(participantPage.getByLabel('Edit display name')).toContainText(participantName);
      await expect(participantPage.getByText(adminName)).toHaveCount(0);
      await expect(adminPage.getByLabel('Edit display name')).toContainText(adminName);
      await expect(adminPage.getByTitle('Create New Game')).toBeVisible();
    } finally {
      await participantContext.close();
      await adminContext.close();
    }
  });

  test('E2E-AUTH-006 user edits display name and header updates', async ({ page }, testInfo) => {
    const originalName = uniqueName(testInfo, 'Rename');
    const updatedName = `${originalName} Updated`;

    await devLogin(page, {
      displayName: originalName,
      phoneLocal: uniquePhoneLocal(testInfo, 5),
    });
    await page.getByLabel('Edit display name').click();
    await expect(page.getByRole('heading', { name: 'Edit display name' })).toBeVisible();

    await page.getByLabel('Display name').fill(updatedName);
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByRole('heading', { name: 'Edit display name' })).toHaveCount(0);
    await expect(page.getByLabel('Edit display name')).toContainText(updatedName);
  });

  test('E2E-AUTH-007 authenticated user logs out to landing page', async ({ page }, testInfo) => {
    await devLogin(page, {
      displayName: uniqueName(testInfo, 'Logout'),
      phoneLocal: uniquePhoneLocal(testInfo, 6),
    });

    await page.getByRole('button', { name: 'Logout' }).click();

    await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Phone number' })).toBeVisible();
  });

  test('E2E-AUTH-008 dev login requires both phone and display name', async ({ page }, testInfo) => {
    await openDevLogin(page);

    const devLoginButton = page.getByRole('button', { name: 'Dev Login' });
    await expect(devLoginButton).toBeDisabled();

    await page.getByLabel('Phone number').fill(uniquePhoneLocal(testInfo, 7));
    await expect(devLoginButton).toBeDisabled();

    await page.getByLabel('Display name').fill(uniqueName(testInfo, 'Validation'));
    await expect(devLoginButton).toBeEnabled();

    await page.getByLabel('Phone number').fill('');
    await expect(devLoginButton).toBeDisabled();
  });
});
