import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { sign } from '@telegram-apps/init-data-node';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { pool } from '../db';
import {
  type AuthUser,
  type AuthUserStore,
  type TelegramUserClaims,
  createAuthMiddleware,
  proveTelegramInitData,
  provisionTelegramUser,
} from './auth';

const BOT_TOKEN = 'test-bot-token-for-auth-unit-tests';
const JWT_SECRET = 'test-jwt-secret-for-auth-unit-tests';

function fakeUser(partial: Partial<AuthUser> & Pick<AuthUser, 'id' | 'displayName'>): AuthUser {
  return {
    telegramId: null,
    telegramUsername: null,
    avatarUrl: null,
    prevDisplayNames: null,
    blockReason: null,
    blockedById: null,
    isAdmin: false,
    isTc: false,
    phoneNumber: null,
    playerLevel: null,
    playerLevelSetById: null,
    playerLevelSetAt: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...partial,
  };
}

function createFakeStore(): AuthUserStore & {
  calls: { findById: number[]; findByTelegramId: string[]; updates: string[]; inserts: string[] };
  usersByTelegramId: Map<string, AuthUser>;
  usersById: Map<number, AuthUser>;
} {
  const usersByTelegramId = new Map<string, AuthUser>();
  const usersById = new Map<number, AuthUser>();
  let nextId = 1;
  const calls = {
    findById: [] as number[],
    findByTelegramId: [] as string[],
    updates: [] as string[],
    inserts: [] as string[],
  };

  return {
    usersByTelegramId,
    usersById,
    calls,
    async findById(userId) {
      calls.findById.push(userId);
      return usersById.get(userId) ?? null;
    },
    async findByTelegramId(telegramId) {
      calls.findByTelegramId.push(telegramId);
      return usersByTelegramId.get(telegramId) ?? null;
    },
    async updateTelegramProfile(telegramId, fields) {
      calls.updates.push(telegramId);
      const existing = usersByTelegramId.get(telegramId);
      if (!existing) {
        throw new Error(`missing user ${telegramId}`);
      }
      const updated = { ...existing, ...fields };
      usersByTelegramId.set(telegramId, updated);
      usersById.set(updated.id, updated);
      return updated;
    },
    async insertTelegramUser(fields) {
      calls.inserts.push(fields.telegramId);
      const created = fakeUser({
        id: nextId++,
        telegramId: fields.telegramId,
        displayName: fields.displayName,
        telegramUsername: fields.telegramUsername,
        avatarUrl: fields.avatarUrl,
      });
      usersByTelegramId.set(fields.telegramId, created);
      usersById.set(created.id, created);
      return created;
    },
  };
}

function signedInitData(user: TelegramUserClaims): string {
  return sign({ user }, BOT_TOKEN, new Date());
}

function mockRes() {
  const state: {
    statusCode?: number;
    body?: unknown;
  } = {};
  const res = {
    status(code: number) {
      state.statusCode = code;
      return this;
    },
    json(body: unknown) {
      state.body = body;
      return this;
    },
  } as unknown as Response;
  return { res, state };
}

describe('Telegram auth proof vs provisioning', () => {
  after(async () => {
    await pool.end();
  });

  it('proveTelegramInitData rejects invalid init data without needing a store', () => {
    assert.throws(
      () => proveTelegramInitData('user=%7B%22id%22%3A1%7D&auth_date=1&hash=deadbeef', BOT_TOKEN),
      /./,
    );
  });

  it('invalid init data does not touch the user store', async () => {
    const store = createFakeStore();
    const middleware = createAuthMiddleware({
      store,
      botToken: BOT_TOKEN,
      jwtSecret: JWT_SECRET,
    });

    const req = {
      headers: { authorization: 'TelegramWebApp not-valid-init-data' },
      cookies: {},
    } as unknown as Request;
    const { res, state } = mockRes();
    let nextCalled = false;

    await middleware(req, res, (() => {
      nextCalled = true;
    }) as NextFunction);

    assert.equal(nextCalled, false);
    assert.equal(state.statusCode, 401);
    assert.deepEqual(store.calls.findByTelegramId, []);
    assert.deepEqual(store.calls.inserts, []);
    assert.deepEqual(store.calls.updates, []);
    assert.deepEqual(store.calls.findById, []);
  });

  it('valid first-time Telegram user proves then provisions via the store', async () => {
    const store = createFakeStore();
    const middleware = createAuthMiddleware({
      store,
      botToken: BOT_TOKEN,
      jwtSecret: JWT_SECRET,
    });

    const claims: TelegramUserClaims = {
      id: 424242,
      first_name: 'Ada',
      last_name: 'Lovelace',
      username: 'ada',
      photo_url: 'https://example.com/ada.png',
    };
    const initData = signedInitData(claims);

    const req = {
      headers: { authorization: `TelegramWebApp ${initData}` },
      cookies: {},
    } as unknown as Request;
    const { res, state } = mockRes();
    let nextCalled = false;

    await middleware(req, res, (() => {
      nextCalled = true;
    }) as NextFunction);

    assert.equal(nextCalled, true);
    assert.equal(state.statusCode, undefined);
    assert.deepEqual(store.calls.findByTelegramId, ['424242']);
    assert.deepEqual(store.calls.inserts, ['424242']);
    assert.deepEqual(store.calls.updates, []);
    assert.equal(req.user?.telegramId, '424242');
    assert.equal(req.user?.displayName, 'Ada Lovelace');
    assert.equal(req.user?.telegramUsername, 'ada');
    assert.equal(req.user?.avatarUrl, 'https://example.com/ada.png');
  });

  it('provisionTelegramUser inserts on first sight and updates profile on repeat', async () => {
    const store = createFakeStore();
    const claims: TelegramUserClaims = {
      id: 7,
      first_name: 'First',
      username: 'u7',
    };

    const created = await provisionTelegramUser(claims, store);
    assert.equal(created.displayName, 'First');
    assert.deepEqual(store.calls.inserts, ['7']);
    assert.deepEqual(store.calls.updates, []);

    const updated = await provisionTelegramUser(
      { ...claims, first_name: 'Updated', photo_url: 'https://example.com/u.png' },
      store,
    );
    assert.equal(updated.id, created.id);
    assert.equal(updated.displayName, 'Updated');
    assert.equal(updated.avatarUrl, 'https://example.com/u.png');
    assert.deepEqual(store.calls.inserts, ['7']);
    assert.deepEqual(store.calls.updates, ['7']);
  });

  it('JWT cookie path verifies then looks up by id without Telegram provisioning', async () => {
    const store = createFakeStore();
    const existing = fakeUser({ id: 99, displayName: 'Phone User', phoneNumber: '+31612345678' });
    store.usersById.set(99, existing);

    const middleware = createAuthMiddleware({
      store,
      botToken: BOT_TOKEN,
      jwtSecret: JWT_SECRET,
    });

    const token = jwt.sign({ userId: 99 }, JWT_SECRET);
    const req = {
      headers: {},
      cookies: { auth_token: token },
    } as unknown as Request;
    const { res, state } = mockRes();
    let nextCalled = false;

    await middleware(req, res, (() => {
      nextCalled = true;
    }) as NextFunction);

    assert.equal(nextCalled, true);
    assert.equal(state.statusCode, undefined);
    assert.equal(req.user?.id, 99);
    assert.deepEqual(store.calls.findById, [99]);
    assert.deepEqual(store.calls.findByTelegramId, []);
    assert.deepEqual(store.calls.inserts, []);
    assert.deepEqual(store.calls.updates, []);
  });

  it('invalid JWT does not provision or insert users', async () => {
    const store = createFakeStore();
    const middleware = createAuthMiddleware({
      store,
      botToken: BOT_TOKEN,
      jwtSecret: JWT_SECRET,
    });

    const req = {
      headers: {},
      cookies: { auth_token: 'not.a.jwt' },
    } as unknown as Request;
    const { res, state } = mockRes();
    let nextCalled = false;

    await middleware(req, res, (() => {
      nextCalled = true;
    }) as NextFunction);

    assert.equal(nextCalled, false);
    assert.equal(state.statusCode, 401);
    assert.deepEqual(store.calls.findById, []);
    assert.deepEqual(store.calls.inserts, []);
    assert.deepEqual(store.calls.updates, []);
  });
});
