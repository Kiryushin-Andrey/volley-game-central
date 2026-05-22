import { expect, test } from '@playwright/test';
import { Pool } from 'pg';
import {
  cleanupE2eData,
  createDevUserViaApi,
  createGameViaUi,
  daysFromNow,
  devLogin,
  e2eTitle,
  switchToUser,
  waitForBackend,
} from './support/fixtures';

const pool = new Pool({
  host: process.env.POSTGRES_HOST || '127.0.0.1',
  port: Number(process.env.POSTGRES_PORT || 5432),
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  database: process.env.POSTGRES_DB || 'volley_game_central',
});

async function restrictionsEnabled(request: import('@playwright/test').APIRequestContext) {
  const res = await request.get('/api/health');
  const body = await res.json();
  return body.positionsGameLevelRestrictionsEnabled === true;
}

async function setPlayerLevel(userId: number, level: string | null) {
  await pool.query(`UPDATE users SET player_level = $2 WHERE id = $1`, [userId, level]);
}

async function setGameDateTime(gameId: number, daysFromNowOffset: number) {
  await pool.query(
    `UPDATE games SET date_time = NOW() + ($2::text || ' days')::interval WHERE id = $1`,
    [gameId, String(daysFromNowOffset)]
  );
}

test.describe('Suite C — positions level restrictions (#22)', () => {
  test.beforeEach(async ({ request }) => {
    await waitForBackend(request);
    test.skip(
      !(await restrictionsEnabled(request)),
      'POSITIONS_GAME_LEVEL_RESTRICTIONS_ENABLED must be true on backend'
    );
    await cleanupE2eData();
  });

  test('C1: beginner on POS-NEAR has no Join Game', async ({ page, request }, testInfo) => {
    const beginner = await createDevUserViaApi(request, testInfo, 'Beginner C1', false);
    await setPlayerLevel(beginner.id, 'beginner');

    await devLogin(page, testInfo, 'Admin C1', true);
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'POS-NEAR C1'),
      dateTime: daysFromNow(2),
      gameFormat: 'positions',
    });

    await switchToUser(page, beginner);
    await page.goto(`/game/${game.id}`);
    await expect(page.getByRole('button', { name: 'Join Game' })).toHaveCount(0);
  });

  test('C3: unassigned on POS-FAR sees Join Game', async ({ page, request }, testInfo) => {
    const unassigned = await createDevUserViaApi(request, testInfo, 'Unassigned C3', false);
    await setPlayerLevel(unassigned.id, null);

    await devLogin(page, testInfo, 'Admin C3', true);
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'POS-FAR C3'),
      dateTime: daysFromNow(7),
      gameFormat: 'positions',
    });

    await switchToUser(page, unassigned);
    await page.goto(`/game/${game.id}`);
    await expect(page.getByRole('button', { name: 'Join Game' })).toBeVisible();
  });

  test('C2: advanced on POS-FAR sees Join Game', async ({ page, request }, testInfo) => {
    const advanced = await createDevUserViaApi(request, testInfo, 'Advanced C2', false);
    await setPlayerLevel(advanced.id, 'advanced');

    await devLogin(page, testInfo, 'Admin C2', true);
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'POS-FAR C2'),
      dateTime: daysFromNow(7),
      gameFormat: 'positions',
    });

    await switchToUser(page, advanced);
    await page.goto(`/game/${game.id}`);
    await expect(page.getByRole('button', { name: 'Join Game' })).toBeVisible();
  });

  test('C4: intermediate on POS-FAR has no Join Game', async ({ page, request }, testInfo) => {
    const intermediate = await createDevUserViaApi(request, testInfo, 'Intermediate C4', false);
    await setPlayerLevel(intermediate.id, 'intermediate');

    await devLogin(page, testInfo, 'Admin C4', true);
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'POS-FAR C4'),
      dateTime: daysFromNow(7),
      gameFormat: 'positions',
    });

    await switchToUser(page, intermediate);
    await page.goto(`/game/${game.id}`);
    await expect(page.getByRole('button', { name: 'Join Game' })).toHaveCount(0);
  });

  test('C5: intermediate on POS-NEAR sees Join Game', async ({ page, request }, testInfo) => {
    const intermediate = await createDevUserViaApi(request, testInfo, 'Intermediate C5', false);
    await setPlayerLevel(intermediate.id, 'intermediate');

    await devLogin(page, testInfo, 'Admin C5', true);
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'POS-NEAR C5'),
      dateTime: daysFromNow(2),
      gameFormat: 'positions',
    });

    await switchToUser(page, intermediate);
    await page.goto(`/game/${game.id}`);
    await expect(page.getByRole('button', { name: 'Join Game' })).toBeVisible();
  });

  test('C6: beginner on priority players game can join', async ({ page, request }, testInfo) => {
    const beginner = await createDevUserViaApi(request, testInfo, 'Beginner C6', false);
    await setPlayerLevel(beginner.id, 'beginner');

    await devLogin(page, testInfo, 'Admin C6', true);
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Priority C6'),
      dateTime: daysFromNow(2),
      gameFormat: 'priority_players',
    });

    await switchToUser(page, beginner);
    await page.goto(`/game/${game.id}`);
    await expect(page.getByRole('button', { name: 'Join Game' })).toBeVisible();
  });

  test('C7: beginner on recreational game can join', async ({ page, request }, testInfo) => {
    const beginner = await createDevUserViaApi(request, testInfo, 'Beginner C7', false);
    await setPlayerLevel(beginner.id, 'beginner');

    await devLogin(page, testInfo, 'Admin C7', true);
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'Recreational C7'),
      dateTime: daysFromNow(3),
      gameFormat: 'recreational',
    });

    await switchToUser(page, beginner);
    await page.goto(`/game/${game.id}`);
    await expect(page.getByRole('button', { name: 'Join Game' })).toBeVisible();
  });

  test('C9: grandfather — beginner stays on roster when restrictions on', async ({ page, request }, testInfo) => {
    const beginner = await createDevUserViaApi(request, testInfo, 'Beginner C9', false);
    await setPlayerLevel(beginner.id, 'beginner');

    await devLogin(page, testInfo, 'Admin C9', true);
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'POS-NEAR C9'),
      dateTime: daysFromNow(2),
      gameFormat: 'positions',
    });

    await pool.query(
      `INSERT INTO game_registrations (game_id, user_id, guest_name, paid, bringing_the_ball)
       VALUES ($1, $2, NULL, false, false)`,
      [game.id, beginner.id]
    );

    await switchToUser(page, beginner);
    await page.goto(`/game/${game.id}`);
    await expect(page.getByRole('button', { name: 'Leave Game' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Join Game' })).toHaveCount(0);
  });

  test('C10: beginner cannot re-join after leaving under restrictions', async ({ page, request }, testInfo) => {
    const beginner = await createDevUserViaApi(request, testInfo, 'Beginner C10', false);
    await setPlayerLevel(beginner.id, 'beginner');

    await devLogin(page, testInfo, 'Admin C10', true);
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'POS-NEAR C10'),
      dateTime: daysFromNow(2),
      gameFormat: 'positions',
    });

    await pool.query(
      `INSERT INTO game_registrations (game_id, user_id, guest_name, paid, bringing_the_ball)
       VALUES ($1, $2, NULL, false, false)`,
      [game.id, beginner.id]
    );

    await switchToUser(page, beginner);
    await page.goto(`/game/${game.id}`);
    await page.getByRole('button', { name: 'Leave Game' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Leave Game' }).click();
    await expect(page.getByRole('button', { name: 'Join Game' })).toHaveCount(0);
  });

  test('C11: beginner host cannot add guest on positions game', async ({ page, request }, testInfo) => {
    const beginner = await createDevUserViaApi(request, testInfo, 'Beginner C11', false);
    await setPlayerLevel(beginner.id, 'beginner');

    await devLogin(page, testInfo, 'Admin C11', true);
    const game = await createGameViaUi(page, {
      title: e2eTitle(testInfo, 'POS-NEAR C11'),
      dateTime: daysFromNow(2),
      gameFormat: 'positions',
    });

    await switchToUser(page, beginner);
    await page.goto(`/game/${game.id}`);
    await expect(page.getByRole('button', { name: /add guest/i })).toHaveCount(0);
  });
});
