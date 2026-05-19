import { expect, test } from '@playwright/test';
import {
  BUNQ_E2E_API_KEY,
  BUNQ_E2E_API_KEY_NAME,
  BUNQ_E2E_PASSWORD,
  cleanupE2eData,
  createDevUserViaApi,
  devLoginAs,
  disableBunqIntegrationViaUi,
  enableBunqIntegrationViaUi,
  fillBunqCredentialsForm,
  installBunqWebhookViaUi,
  loadMonetaryAccountsViaUi,
  openBunqCredentialsForm,
  openBunqSettingsFromGamesHome,
  resetBunqMock,
  submitBunqCredentialsForm,
  waitForBackend,
  waitForBunqSettingsReady,
} from './support/fixtures';

async function createAdminAssignmentForUser(
  page: import('@playwright/test').Page,
  assigneeDisplayName: string
) {
  await page.goto('/game-administrators');
  await expect(page.getByRole('heading', { name: 'Game Administrators' })).toBeVisible();
  await page.getByRole('button', { name: 'Add Assignment' }).click();
  await expect(page.getByRole('heading', { name: 'New Assignment' })).toBeVisible();
  await page.getByLabel('Day of Week').selectOption('6');
  await page.getByRole('checkbox', { name: /5-1 positions game/i }).uncheck();
  await page.getByPlaceholder('Search for a user...').fill(assigneeDisplayName);
  await page.getByText(assigneeDisplayName, { exact: true }).click();
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText(assigneeDisplayName)).toBeVisible();
}

test.describe('Bunq integration configuration scenarios', () => {
  test.beforeEach(async ({ request }) => {
    await waitForBackend(request);
    await resetBunqMock();
    await cleanupE2eData();
  });

  test('E2E-BUNQ-CONFIG-001 global admin opens Bunq Settings from games home', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Bunq Config Home Admin', true);
    await devLoginAs(page, admin);

    await openBunqSettingsFromGamesHome(page);

    await expect(page).toHaveURL(/\/bunq-settings$/);
    await expect(page.getByText(/Bunq integration is disabled/)).toBeVisible();
  });

  test('E2E-BUNQ-CONFIG-002 credentials form requires all fields before submit', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Bunq Config Form Admin', true);
    await devLoginAs(page, admin);
    await page.goto('/bunq-settings');
    await waitForBunqSettingsReady(page);

    await openBunqCredentialsForm(page);
    const submit = page.getByRole('button', { name: 'Enable Integration' });
    await expect(submit).toBeDisabled();

    await page.locator('#apiKey').fill(BUNQ_E2E_API_KEY);
    await expect(submit).toBeDisabled();

    await page.locator('#apiKeyName').fill(BUNQ_E2E_API_KEY_NAME);
    await expect(submit).toBeDisabled();

    await page.locator('.credentials-form #password').fill(BUNQ_E2E_PASSWORD);
    await expect(submit).toBeEnabled();
  });

  test('E2E-BUNQ-CONFIG-003 global admin enables Bunq integration with mock credentials', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Bunq Config Enable Admin', true);
    await devLoginAs(page, admin);
    await page.goto('/bunq-settings');
    await waitForBunqSettingsReady(page);

    await openBunqCredentialsForm(page);
    await fillBunqCredentialsForm(page, {
      apiKey: BUNQ_E2E_API_KEY,
      apiKeyName: BUNQ_E2E_API_KEY_NAME,
      password: BUNQ_E2E_PASSWORD,
    });
    await submitBunqCredentialsForm(page);

    await expect(page.getByText(/Bunq integration enabled successfully/i)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/Bunq integration is enabled/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Disable Integration' })).toBeVisible();
  });

  test('E2E-BUNQ-CONFIG-004 global admin loads and selects a monetary account', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Bunq Config Account Admin', true);
    await devLoginAs(page, admin);
    await enableBunqIntegrationViaUi(page);

    await page.reload();
    await waitForBunqSettingsReady(page);
    await expect(page.getByText(/Bunq integration is enabled/)).toBeVisible();

    await loadMonetaryAccountsViaUi(page, BUNQ_E2E_PASSWORD);
    await expect(page.locator('#monetaryAccount')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#monetaryAccount')).toContainText('E2E mock EUR account');

    const updatePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' &&
        /\/api\/users\/me\/bunq\/monetary-account$/.test(new URL(response.url()).pathname)
    );
    await page.locator('#monetaryAccount').selectOption({ label: 'E2E mock EUR account' });
    const updateResponse = await updatePromise;
    expect(updateResponse.ok()).toBeTruthy();

    await expect(page.getByText(/Bunq account updated successfully/i)).toBeVisible();
  });

  test('E2E-BUNQ-CONFIG-005 global admin installs webhook from settings page', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Bunq Config Webhook Admin', true);
    await devLoginAs(page, admin);
    await enableBunqIntegrationViaUi(page);

    await installBunqWebhookViaUi(page, BUNQ_E2E_PASSWORD);

    await expect(page.getByText(/Webhook installed successfully/i)).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(/\/bunq-settings$/);
    await expect(page.getByRole('heading', { name: 'Bunq Settings' })).toBeVisible();
  });

  test('E2E-BUNQ-CONFIG-006 global admin cancels Update API Key form', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Bunq Config Cancel Update Admin', true);
    await devLoginAs(page, admin);
    await enableBunqIntegrationViaUi(page);

    await page.getByRole('button', { name: 'Update API Key' }).click();
    await expect(page.getByRole('heading', { name: 'Specify Bunq API Credentials' })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(page.getByRole('heading', { name: 'Specify Bunq API Credentials' })).toHaveCount(0);
    await expect(page.getByText(/Bunq integration is enabled/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Disable Integration' })).toBeVisible();
  });

  test('E2E-BUNQ-CONFIG-007 global admin disables Bunq integration after confirm', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Bunq Config Disable Admin', true);
    await devLoginAs(page, admin);
    await enableBunqIntegrationViaUi(page);

    await disableBunqIntegrationViaUi(page, true);

    await expect(page.getByText(/Bunq integration disabled successfully/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Bunq integration is disabled/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enable Bunq Integration' })).toBeVisible();
  });

  test('E2E-BUNQ-CONFIG-008 global admin cancels disable and integration stays enabled', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Bunq Config Cancel Disable Admin', true);
    await devLoginAs(page, admin);
    await enableBunqIntegrationViaUi(page);

    await disableBunqIntegrationViaUi(page, false);

    await expect(page.getByText(/Bunq integration disabled successfully/i)).toHaveCount(0);
    await expect(page.getByText(/Bunq integration is enabled/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Disable Integration' })).toBeVisible();
  });

  test('E2E-BUNQ-CONFIG-009 global admin enables Bunq for assigned administrator', async ({ page, request }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Bunq Config Assign Global', true);
    const assigned = await createDevUserViaApi(request, testInfo, 'Bunq Config Assign Target');
    await devLoginAs(page, admin);
    await createAdminAssignmentForUser(page, assigned.displayName);

    const assignmentRow = page.locator('.administrator-item').filter({ hasText: assigned.displayName });
    await assignmentRow.getByTitle('Configure Bunq Settings').click();
    await waitForBunqSettingsReady(page, new RegExp(`Bunq Settings \\(${assigned.displayName}\\)`));

    await openBunqCredentialsForm(page);
    await fillBunqCredentialsForm(page, {
      apiKey: BUNQ_E2E_API_KEY,
      apiKeyName: BUNQ_E2E_API_KEY_NAME,
      password: BUNQ_E2E_PASSWORD,
    });
    await submitBunqCredentialsForm(page);

    await expect(page.getByText(/Bunq integration enabled successfully/i)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/Bunq integration is enabled/)).toBeVisible();
  });

  test('E2E-BUNQ-CONFIG-010 participant cannot manage Bunq settings', async ({ page, request }, testInfo) => {
    const participant = await createDevUserViaApi(request, testInfo, 'Bunq Config Participant');
    await devLoginAs(page, participant);

    await page.goto('/bunq-settings');
    await waitForBunqSettingsReady(page);

    await expect(page.getByText(/Failed to load Bunq integration status/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enable Bunq Integration' })).toBeVisible();
    await expect(page.getByText(/Bunq integration is disabled/)).toBeVisible();

    await openBunqCredentialsForm(page);
    await fillBunqCredentialsForm(page, {
      apiKey: BUNQ_E2E_API_KEY,
      apiKeyName: BUNQ_E2E_API_KEY_NAME,
      password: BUNQ_E2E_PASSWORD,
    });
    const enableResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/users/me/bunq/enable'
    );
    await submitBunqCredentialsForm(page);
    const enableResponse = await enableResponsePromise;
    expect(enableResponse.status()).toBe(403);
    await expect(page.getByText(/Bunq integration is enabled/i)).toHaveCount(0);
  });

  test('E2E-BUNQ-CONFIG-011 wrong Bunq password shows inline errors on account load and webhook install', async ({
    page,
    request,
  }, testInfo) => {
    const admin = await createDevUserViaApi(request, testInfo, 'Bunq Config Wrong Pass Admin', true);
    await devLoginAs(page, admin);
    await enableBunqIntegrationViaUi(page);

    await page.reload();
    await waitForBunqSettingsReady(page);

    await loadMonetaryAccountsViaUi(page, 'WrongPassword!9');
    await expect(page.locator('.bunq-settings-container .error-message')).toContainText(/Failed to load Bunq accounts/i);
    await expect(page.locator('#monetaryAccount')).toHaveCount(0);

    await page.reload();
    await waitForBunqSettingsReady(page);
    await expect(page.getByText(/Bunq integration is enabled/)).toBeVisible();

    await installBunqWebhookViaUi(page, 'WrongPassword!9');
    await expect(page.locator('.password-dialog-overlay')).toBeVisible();
    await expect(page.locator('.password-dialog-overlay .error-message')).toContainText(/Failed to install webhook/i);
    await expect(page.getByText(/Webhook installed successfully/i)).toHaveCount(0);
  });
});
