import { expect, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';
import { Pool } from 'pg';

export type DevUser = {
  id: number;
  displayName: string;
  phoneLocal: string;
  isAdmin: boolean;
};

export type GameFixture = {
  id: number;
  title: string;
  dateTime: Date;
};

type UiGameInput = {
  title: string;
  dateTime?: Date;
  maxPlayers?: number;
  unregisterDeadlineHours?: number;
  paymentAmount?: string;
  pricingMode?: 'per_participant' | 'total_cost';
  withPositions?: boolean;
  readonly?: boolean;
  locationName?: string;
  locationLink?: string;
};

const pool = new Pool({
  host: process.env.POSTGRES_HOST || '127.0.0.1',
  port: Number(process.env.POSTGRES_PORT || 5432),
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  database: process.env.POSTGRES_DB || 'volley_game_central',
});

export async function waitForBackend(request: APIRequestContext) {
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

export function uniqueRunId(testInfo: TestInfo) {
  return `${testInfo.workerIndex}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function uniqueName(testInfo: TestInfo, label: string) {
  return `E2E ${label} ${uniqueRunId(testInfo)}`;
}

export function uniquePhoneLocal(testInfo: TestInfo, suffix: number) {
  const timestamp = Date.now().toString().slice(-8);
  return `6${timestamp}${testInfo.workerIndex}${suffix}`;
}

export async function openDevLogin(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
  await page.getByRole('button', { name: 'Phone number' }).click();
  await expect(page.getByText('Dev mode: No SMS verification required')).toBeVisible();
}

export async function devLogin(page: Page, testInfo: TestInfo, label: string, isAdmin = false): Promise<DevUser> {
  const displayName = uniqueName(testInfo, label);
  const phoneLocal = uniquePhoneLocal(testInfo, isAdmin ? 8 : 1);

  return devLoginAs(page, { id: 0, displayName, phoneLocal, isAdmin });
}

export async function devLoginAs(page: Page, user: DevUser): Promise<DevUser> {
  await openDevLogin(page);
  await page.getByLabel('Phone number').fill(user.phoneLocal);
  await page.getByLabel('Display name').fill(user.displayName);

  if (user.isAdmin) {
    await page.getByLabel('Administrator').check();
  }

  await page.getByRole('button', { name: 'Dev Login' }).click();
  await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
  await expect(page.getByLabel('Edit display name')).toContainText(user.displayName);

  const currentUser = await page.evaluate(async () => {
    const response = await fetch('/api/users/me', { credentials: 'include' });
    if (!response.ok) throw new Error(`Failed to load current user: ${response.status}`);
    return response.json();
  });

  return {
    id: currentUser.user.id,
    displayName: user.displayName,
    phoneLocal: user.phoneLocal,
    isAdmin: user.isAdmin,
  };
}

export async function createDevUserViaApi(request: APIRequestContext, testInfo: TestInfo, label: string, isAdmin = false): Promise<DevUser> {
  const displayName = uniqueName(testInfo, label);
  const phoneLocal = uniquePhoneLocal(testInfo, isAdmin ? 9 : 2);
  const response = await request.post('/api/auth/dev-login', {
    data: {
      phoneNumber: `+31${phoneLocal}`,
      displayName,
      isAdmin,
    },
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  return {
    id: body.user.id,
    displayName,
    phoneLocal,
    isAdmin,
  };
}

export function daysFromNow(days: number, hour = 18) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date;
}

export function nextWeekday(jsDay: number, minDaysAhead = 1, hour = 18) {
  const date = new Date();
  const current = date.getDay();
  let delta = (jsDay - current + 7) % 7;
  if (delta < minDaysAhead) delta += 7;
  date.setDate(date.getDate() + delta);
  date.setHours(hour, 0, 0, 0);
  return date;
}

export function e2eTitle(testInfo: TestInfo, label: string) {
  return `E2E ${label} ${uniqueRunId(testInfo)}`;
}

export function formatGameDateTimeForInput(date: Date) {
  const month = date.toLocaleString('en-US', { month: 'long' });
  const day = date.getDate();
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${month} ${day}, ${year} ${hours}:${minutes}`;
}

export async function setCheckbox(page: Page, selector: string, checked = true) {
  const input = page.locator(selector);
  if ((await input.isChecked()) !== checked) {
    await page.locator(`label[for="${selector.replace('#', '')}"]`).click();
  }
}

/** POST /api/games/admin — call immediately before clicking Create Game. */
export function waitForAdminGameCreateResponse(page: Page) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      /\/api\/games\/admin$/.test(new URL(response.url()).pathname)
  );
}

export async function createGameViaUi(page: Page, input: UiGameInput): Promise<GameFixture> {
  await page.goto('/games/new');
  await expect(page.getByRole('heading', { name: 'Create New Game' })).toBeVisible();

  const dateTime = input.dateTime || daysFromNow(2);
  const dateInput = page.getByPlaceholder('Select date and time');
  await dateInput.fill(formatGameDateTimeForInput(dateTime));
  await dateInput.press('Enter');
  await page.locator('#maxPlayers').fill(String(input.maxPlayers ?? 14));
  await page.locator('#unregisterDeadlineHours').fill(String(input.unregisterDeadlineHours ?? 5));
  await page.locator('#paymentAmount').fill(input.paymentAmount ?? '5.00');
  await page.locator('#locationName').fill(input.locationName ?? 'E2E Sports Hall');
  await page.locator('#locationLink').fill(input.locationLink ?? 'https://maps.example/e2e');
  await page.locator('#title').fill(input.title);

  if (input.pricingMode === 'total_cost') {
    await setCheckbox(page, '#pricingMode');
  }
  if (input.withPositions) {
    await setCheckbox(page, '#withPositions');
  }
  if (input.readonly) {
    await setCheckbox(page, '#readonly');
  }

  const createResponsePromise = waitForAdminGameCreateResponse(page);
  await page.getByRole('button', { name: 'Create Game' }).click();
  const createResponse = await createResponsePromise;
  expect(createResponse.ok()).toBeTruthy();
  const body = (await createResponse.json()) as { id: number; title: string | null };
  expect(body.id).toBeGreaterThan(0);

  await expect(page).toHaveURL('/');

  return {
    id: body.id,
    title: body.title ?? input.title,
    dateTime,
  };
}

export async function switchToUser(page: Page, user: DevUser) {
  if (await page.getByRole('button', { name: 'Logout' }).isVisible().catch(() => false)) {
    await page.getByRole('button', { name: 'Logout' }).click();
  }
  return devLoginAs(page, user);
}

export async function registerForGameViaUi(page: Page, user: DevUser, gameId: number, expectedStatus = "You're in") {
  await switchToUser(page, user);
  await page.goto(`/game/${gameId}`);
  await page.getByRole('button', { name: 'Join Game' }).click();
  await expect(page.getByRole('heading', { name: 'Will you bring a volleyball?' })).toBeVisible();
  await page.getByRole('button', { name: /No, I won't bring one/ }).click();
  await expect(page.getByText(expectedStatus, { exact: true })).toBeVisible();
}

/** Fields that cannot be set through the mini-app UI (allowed for E2E DB helpers only). */
export type GameDbOnlyPatch = {
  tag?: string | null;
  fully_paid?: boolean;
};

export async function updateGame(id: number, updates: GameDbOnlyPatch): Promise<void> {
  const allowedKeys = new Set(['tag', 'fully_paid']);
  const keys = Object.keys(updates);
  const bad = keys.filter((k) => !allowedKeys.has(k));
  if (bad.length > 0) {
    throw new Error(`updateGame: disallowed keys: ${bad.join(', ')}. Only "tag" and "fully_paid" are permitted.`);
  }

  const entries: [string, unknown][] = [];
  if (Object.prototype.hasOwnProperty.call(updates, 'tag')) {
    entries.push(['tag', updates.tag ?? null]);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'fully_paid')) {
    entries.push(['fully_paid', updates.fully_paid]);
  }
  if (entries.length === 0) return;

  const setSql = entries.map(([key], index) => `${key} = $${index + 2}`).join(', ');
  await pool.query(`update games set ${setSql} where id = $1`, [id, ...entries.map(([, value]) => value)]);
}

export async function countRegistrations(gameId: number) {
  const result = await pool.query(`select count(*)::int as count from game_registrations where game_id = $1`, [gameId]);
  return result.rows[0].count as number;
}

/** PUT /api/games/admin/:gameId — await immediately before clicking Save Changes on edit form. */
export function waitForAdminGameUpdateResponse(page: Page, gameId: number) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      new URL(response.url()).pathname === `/api/games/admin/${gameId}`
  );
}

export async function cleanupE2eData() {
  await pool.query(`delete from payment_requests where payment_request_id like 'e2e-%'`);
  await pool.query(`delete from game_registrations where game_id in (select id from games where title like 'E2E %')`);
  await pool.query(`delete from priority_players where user_id in (select id from users where display_name like 'E2E %')`);
  await pool.query(`delete from game_administrators where user_id in (select id from users where display_name like 'E2E %')`);
  await pool.query(`delete from games where title like 'E2E %'`);
  await pool.query(`delete from users where display_name like 'E2E %'`);
}

const BUNQ_MOCK_CONTROL_ORIGIN = process.env.BUNQ_MOCK_CONTROL_ORIGIN ?? 'http://127.0.0.1:3999';
const BUNQ_MOCK_CONTROL_TOKEN = process.env.BUNQ_MOCK_CONTROL_TOKEN ?? 'e2e-bunq-mock-secret';

export async function resetBunqMock(): Promise<void> {
  const res = await fetch(`${BUNQ_MOCK_CONTROL_ORIGIN}/reset`, {
    method: 'POST',
    headers: { 'X-Bunq-Mock-Control-Token': BUNQ_MOCK_CONTROL_TOKEN },
  });
  if (!res.ok) {
    throw new Error(`resetBunqMock failed: HTTP ${res.status} ${await res.text()}`);
  }
}

export async function deliverBunqRequestInquiryAcceptedWebhook(
  requestInquiryId: string,
  targetUrlOverride?: string
): Promise<void> {
  const res = await fetch(`${BUNQ_MOCK_CONTROL_ORIGIN}/webhooks/deliver-request-inquiry-accepted`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Bunq-Mock-Control-Token': BUNQ_MOCK_CONTROL_TOKEN,
    },
    body: JSON.stringify({
      requestInquiryId,
      ...(targetUrlOverride ? { targetUrlOverride } : {}),
    }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    status?: number;
    responseSnippet?: string;
    detail?: string;
  };
  if (!res.ok) {
    throw new Error(`deliverBunqRequestInquiryAcceptedWebhook failed: HTTP ${res.status} ${JSON.stringify(body)}`);
  }
  if (body.ok === false) {
    throw new Error(
      `Bunq mock could not POST webhook (target HTTP ${body.status ?? '?'}): ${body.responseSnippet ?? body.error ?? JSON.stringify(body)}`
    );
  }
}

/** Bunq payment_request_id after /games/admin/:id/payment-requests (primary registration row). */
export async function getPaymentRequestIdForUserRegistration(gameId: number, userId: number): Promise<string | null> {
  const result = await pool.query(
    `select pr.payment_request_id::text as payment_request_id
     from payment_requests pr
     inner join game_registrations gr on gr.id = pr.game_registration_id
     where gr.game_id = $1 and gr.user_id = $2 and gr.guest_name is null
     order by pr.id desc
     limit 1`,
    [gameId, userId]
  );
  return (result.rows[0]?.payment_request_id as string) ?? null;
}

export async function closeDbPool() {
  await pool.end();
}
