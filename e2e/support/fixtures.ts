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

type GameInput = {
  title: string;
  createdById: number;
  dateTime?: Date;
  maxPlayers?: number;
  unregisterDeadlineHours?: number;
  paymentAmount?: number;
  pricingMode?: 'per_participant' | 'total_cost';
  fullyPaid?: boolean;
  withPositions?: boolean;
  withPriorityPlayers?: boolean;
  readonly?: boolean;
  locationName?: string;
  locationLink?: string;
  tag?: 'halloween' | 'newyear' | 'march8';
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

function formatDateForInput(date: Date) {
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
  await dateInput.fill(formatDateForInput(dateTime));
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

export async function createGame(input: GameInput): Promise<GameFixture> {
  const dateTime = input.dateTime || daysFromNow(2);
  const result = await pool.query(
    `insert into games (
      date_time,
      max_players,
      unregister_deadline_hours,
      payment_amount,
      pricing_mode,
      fully_paid,
      with_positions,
      with_priority_players,
      readonly,
      location_name,
      location_link,
      tag,
      title,
      created_by_id
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    returning id, title, date_time as "dateTime"`,
    [
      dateTime,
      input.maxPlayers ?? 14,
      input.unregisterDeadlineHours ?? 5,
      input.paymentAmount ?? 500,
      input.pricingMode ?? 'per_participant',
      input.fullyPaid ?? false,
      input.withPositions ?? false,
      input.withPriorityPlayers ?? false,
      input.readonly ?? false,
      input.locationName ?? 'E2E Sports Hall',
      input.locationLink ?? 'https://maps.example/e2e',
      input.tag ?? null,
      input.title,
      input.createdById,
    ]
  );

  return {
    id: result.rows[0].id,
    title: result.rows[0].title,
    dateTime: new Date(result.rows[0].dateTime),
  };
}

export async function updateGame(id: number, updates: Record<string, unknown>) {
  const entries = Object.entries(updates);
  if (entries.length === 0) return;

  const setSql = entries.map(([key], index) => `${key} = $${index + 2}`).join(', ');
  await pool.query(`update games set ${setSql} where id = $1`, [id, ...entries.map(([, value]) => value)]);
}

export async function countRegistrations(gameId: number) {
  const result = await pool.query(`select count(*)::int as count from game_registrations where game_id = $1`, [gameId]);
  return result.rows[0].count as number;
}

export async function createAdminAssignment(dayOfWeek: number, withPositions: boolean, userId: number) {
  const result = await pool.query(
    `insert into game_administrators (day_of_week, with_positions, user_id)
     values ($1,$2,$3)
     returning id`,
    [dayOfWeek, withPositions, userId]
  );
  return result.rows[0].id as number;
}

export async function cleanupE2eData() {
  await pool.query(`delete from payment_requests where payment_request_id like 'e2e-%'`);
  await pool.query(`delete from game_registrations where game_id in (select id from games where title like 'E2E %')`);
  await pool.query(`delete from priority_players where user_id in (select id from users where display_name like 'E2E %')`);
  await pool.query(`delete from game_administrators where user_id in (select id from users where display_name like 'E2E %')`);
  await pool.query(`delete from games where title like 'E2E %'`);
  await pool.query(`delete from users where display_name like 'E2E %'`);
}

export async function closeDbPool() {
  await pool.end();
}
