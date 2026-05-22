import { expect, test } from '@playwright/test';
import {
  cleanupE2eData,
  createDevUserViaApi,
  createGameViaUi,
  daysFromNow,
  devLogin,
  devLoginAs,
  e2eTitle,
  switchToUser,
  waitForBackend,
} from './support/fixtures';

test.describe('Suite B — player levels admin (#21)', () => {
  test.beforeEach(async ({ request }) => {
    await waitForBackend(request);
    await cleanupE2eData();
  });

  test('B1: admin toolbar Players icon opens hub with two links', async ({ page }, testInfo) => {
    const admin = await devLogin(page, testInfo, 'Admin B1', true);
    expect(admin.isAdmin).toBe(true);

    await page.locator('.admin-icon-buttons a[title="Players"]').click();
    await expect(page).toHaveURL(/\/players$/);
    await expect(page.getByRole('heading', { name: 'Players' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Game administrators' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Player levels' })).toBeVisible();
  });

  test('B2: hub link Game administrators loads page', async ({ page }, testInfo) => {
    await devLogin(page, testInfo, 'Admin B2', true);
    await page.goto('/players');
    await page.getByRole('link', { name: 'Game administrators' }).click();
    await expect(page).toHaveURL(/\/game-administrators/);
    await expect(page.getByRole('heading', { name: 'Game Administrators' })).toBeVisible();
  });

  test('B3: player levels list loads with unassigned-first ordering', async ({ page, request }, testInfo) => {
    const unassigned = await createDevUserViaApi(request, testInfo, 'Unassigned B3', false);
    const advanced = await createDevUserViaApi(request, testInfo, 'Advanced B3', false);
    const beginner = await createDevUserViaApi(request, testInfo, 'Beginner B3', false);

    const { Pool } = await import('pg');
    const pool = new Pool({
      host: process.env.POSTGRES_HOST || '127.0.0.1',
      port: Number(process.env.POSTGRES_PORT || 5432),
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres',
      database: process.env.POSTGRES_DB || 'volley_game_central',
    });
    await pool.query(`UPDATE users SET player_level = 'advanced' WHERE id = $1`, [advanced.id]);
    await pool.query(`UPDATE users SET player_level = 'beginner' WHERE id = $1`, [beginner.id]);
    await pool.end();

    await devLogin(page, testInfo, 'Admin B3', true);
    await page.goto('/player-levels');
    await expect(page.getByRole('heading', { name: 'Player levels' })).toBeVisible();
    await expect(page.locator('.player-levels-row').first()).toBeVisible();

    const filter = page.getByPlaceholder('Filter by name');
    await filter.fill('E2E');
    const names = await page.locator('.player-levels-row .player-name').allTextContents();
    const uaIdx = names.findIndex((n) => n.includes(unassigned.displayName));
    const advIdx = names.findIndex((n) => n.includes(advanced.displayName));
    const begIdx = names.findIndex((n) => n.includes(beginner.displayName));
    expect(uaIdx).toBeGreaterThanOrEqual(0);
    expect(advIdx).toBeGreaterThanOrEqual(0);
    expect(begIdx).toBeGreaterThanOrEqual(0);
    expect(uaIdx).toBeLessThan(advIdx);
    expect(advIdx).toBeLessThan(begIdx);
  });

  test('B4–B7: assign and change level via dialog', async ({ page, request }, testInfo) => {
    const target = await createDevUserViaApi(request, testInfo, 'Target B4', false);
    await devLogin(page, testInfo, 'Admin B47', true);
    await page.goto('/player-levels');

    const row = page.locator('.player-levels-row', { hasText: target.displayName });
    await expect(row).toBeVisible();
    await expect(row.locator('.level-pill')).toHaveCount(0);

    await row.click();
    await expect(page.locator('.player-info-dialog')).toBeVisible();
    await page.locator('.player-level-select').selectOption('beginner');
    await expect(row.locator('.level-pill--beginner')).toBeVisible();

    await page.locator('.player-info-dialog').getByRole('button', { name: 'Close' }).click();
    await expect(page.locator('.player-info-dialog')).toHaveCount(0);

    await row.click();
    await page.locator('.player-level-select').selectOption('advanced');
    await expect(row.locator('.level-pill--advanced')).toBeVisible();
    await expect(page.locator('.player-level-select option[value=""]')).toHaveCount(0);

    await page.getByPlaceholder('Filter by name').fill(target.displayName.slice(0, 6));
    await expect(row).toBeVisible();
  });

  test('B8: non-admin cannot access player levels', async ({ page }, testInfo) => {
    await devLogin(page, testInfo, 'Regular B8', false);
    await page.goto('/player-levels');
    await expect(page).toHaveURL('/');
    await page.goto('/players');
    await expect(page).toHaveURL('/');
  });

  test('B9: non-admin game details show no level labels', async ({ page, request }, testInfo) => {
    const player = await createDevUserViaApi(request, testInfo, 'Player B9', false);
    const { Pool } = await import('pg');
    const pool = new Pool({
      host: process.env.POSTGRES_HOST || '127.0.0.1',
      port: Number(process.env.POSTGRES_PORT || 5432),
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres',
      database: process.env.POSTGRES_DB || 'volley_game_central',
    });
    await pool.query(`UPDATE users SET player_level = 'beginner' WHERE id = $1`, [player.id]);
    await pool.end();

    await devLogin(page, testInfo, 'Admin B9', true);
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'B9 recreational'),
      dateTime: daysFromNow(3),
      gameFormat: 'recreational',
    });

    await switchToUser(page, { ...player, id: player.id });
    await page.goto(`/game/${game.id}`);
    await expect(page.getByText(/beginner/i)).toHaveCount(0);
    await expect(page.getByText(/intermediate/i)).toHaveCount(0);
    await expect(page.getByText(/advanced/i)).toHaveCount(0);
  });

  test('B10: beginner can join positions game when restrictions off', async ({ page, request }, testInfo) => {
    const health = await request.get('/api/health');
    const healthBody = await health.json();
    test.skip(
      healthBody.positionsGameLevelRestrictionsEnabled === true,
      'Suite B10 requires POSITIONS_GAME_LEVEL_RESTRICTIONS_ENABLED=false'
    );

    const beginner = await createDevUserViaApi(request, testInfo, 'Beginner B10', false);
    const { Pool } = await import('pg');
    const pool = new Pool({
      host: process.env.POSTGRES_HOST || '127.0.0.1',
      port: Number(process.env.POSTGRES_PORT || 5432),
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres',
      database: process.env.POSTGRES_DB || 'volley_game_central',
    });
    await pool.query(`UPDATE users SET player_level = 'beginner' WHERE id = $1`, [beginner.id]);
    await pool.end();

    await devLogin(page, testInfo, 'Admin B10', true);
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'B10 positions'),
      dateTime: daysFromNow(3),
      gameFormat: 'positions',
    });

    await switchToUser(page, { ...beginner, id: beginner.id });
    await page.goto(`/game/${game.id}`);
    await expect(page.getByRole('button', { name: 'Join Game' })).toBeVisible();
  });
});
