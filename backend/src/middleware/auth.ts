import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { validate } from '@telegram-apps/init-data-node';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { isDevMode } from '../utils/devMode';
import type { InferSelectModel } from 'drizzle-orm';

export type AuthUser = InferSelectModel<typeof users>;

/** Claims extracted from a validated Telegram WebApp initData payload. */
export interface TelegramUserClaims {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

export type TelegramProfileFields = {
  telegramId: string;
  displayName: string;
  telegramUsername: string | null;
  avatarUrl: string | null;
};

/**
 * Persistence port for auth middleware.
 * Proof (initData / JWT validation) never calls this; provisioning does.
 */
export interface AuthUserStore {
  findById(userId: number): Promise<AuthUser | null>;
  findByTelegramId(telegramId: string): Promise<AuthUser | null>;
  updateTelegramProfile(
    telegramId: string,
    fields: Omit<TelegramProfileFields, 'telegramId'>,
  ): Promise<AuthUser>;
  insertTelegramUser(fields: TelegramProfileFields): Promise<AuthUser>;
}

export function displayNameFromTelegramClaims(tu: TelegramUserClaims): string {
  const hasFirst = !!tu.first_name && tu.first_name.trim().length > 0;
  const hasLast = !!tu.last_name && tu.last_name.trim().length > 0;
  if (hasFirst || hasLast) {
    return [tu.first_name, tu.last_name]
      .filter((v): v is string => !!v && v.trim().length > 0)
      .map((v) => v.trim())
      .join(' ');
  }
  return tu.username || `user_${tu.id}`;
}

/**
 * Proof only: validate Telegram initData and return user claims.
 * Does not insert or update users.
 */
export function proveTelegramInitData(initData: string, botToken: string): TelegramUserClaims {
  validate(initData, botToken);
  const params = new URLSearchParams(initData);
  const userDataString = params.get('user');
  if (!userDataString) {
    throw new Error('Missing user field in init data');
  }
  let tgUser: TelegramUserClaims;
  try {
    tgUser = JSON.parse(userDataString);
  } catch {
    throw new Error('Failed to parse user JSON from init data');
  }
  if (!tgUser.id) {
    throw new Error('Parsed user missing id');
  }
  return tgUser;
}

/**
 * Proof only: verify JWT and return the userId claim.
 * Does not insert or update users.
 */
export function proveJwtUserId(token: string, secret: string): number {
  const payload = jwt.verify(token, secret) as { userId: number };
  if (typeof payload.userId !== 'number') {
    throw new Error('JWT missing userId');
  }
  return payload.userId;
}

/**
 * Provisioning: find-or-create Telegram user and sync profile fields.
 */
export async function provisionTelegramUser(
  tu: TelegramUserClaims,
  store: AuthUserStore,
): Promise<AuthUser> {
  const telegramId = tu.id.toString();
  const displayName = displayNameFromTelegramClaims(tu);
  const profile = {
    displayName: displayName || telegramId,
    avatarUrl: tu.photo_url ?? null,
    telegramUsername: tu.username ?? null,
  };

  const existing = await store.findByTelegramId(telegramId);
  if (existing) {
    return store.updateTelegramProfile(telegramId, profile);
  }
  return store.insertTelegramUser({ telegramId, ...profile });
}

export const dbAuthUserStore: AuthUserStore = {
  async findById(userId) {
    const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    return rows[0] || null;
  },
  async findByTelegramId(telegramId) {
    const rows = await db.select().from(users).where(eq(users.telegramId, telegramId)).limit(1);
    return rows[0] || null;
  },
  async updateTelegramProfile(telegramId, fields) {
    const [updated] = await db
      .update(users)
      .set({
        displayName: fields.displayName,
        avatarUrl: fields.avatarUrl,
        telegramUsername: fields.telegramUsername,
      })
      .where(eq(users.telegramId, telegramId))
      .returning();
    return updated;
  },
  async insertTelegramUser(fields) {
    const [created] = await db
      .insert(users)
      .values({
        telegramId: fields.telegramId,
        displayName: fields.displayName,
        telegramUsername: fields.telegramUsername,
        avatarUrl: fields.avatarUrl,
      })
      .returning();
    return created;
  },
};

export type AuthMiddlewareDeps = {
  store: AuthUserStore;
  botToken?: string;
  jwtSecret?: string;
};

/**
 * Combined authentication middleware:
 * 1) Prefer Telegram WebApp auth when Authorization header is present
 * 2) Fallback to JWT cookie from phone auth (works for both regular and dev mode users)
 *
 * Telegram: prove initData → provision user.
 * JWT: prove token → lookup by id (no insert/update).
 */
export function createAuthMiddleware(deps: AuthMiddlewareDeps) {
  return async function authMiddleware(req: Request, res: Response, next: NextFunction) {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('TelegramWebApp ')) {
        const initData = authHeader.replace('TelegramWebApp ', '');
        if (!initData) {
          console.warn('[Auth][TG] Missing init data in Authorization header');
          return res.status(401).json({ error: 'Unauthorized', isDevMode: isDevMode() });
        }

        const botToken = deps.botToken ?? process.env.TELEGRAM_BOT_TOKEN;
        if (!botToken) {
          console.error('[Auth] TELEGRAM_BOT_TOKEN not configured');
          return res.status(500).json({ error: 'Server authentication configuration error' });
        }

        let claims: TelegramUserClaims;
        try {
          claims = proveTelegramInitData(initData, botToken);
        } catch (e) {
          console.warn('[Auth][TG] Init data proof failed:', e);
          return res.status(401).json({ error: 'Unauthorized', isDevMode: isDevMode() });
        }

        const user = await provisionTelegramUser(claims, deps.store);
        req.user = user;
        return next();
      }

      // Fallback to JWT cookie from phone auth
      const token = (req as any).cookies?.auth_token;
      const secret = deps.jwtSecret ?? process.env.JWT_SECRET;
      if (token && secret) {
        try {
          const userId = proveJwtUserId(token, secret);
          const user = await deps.store.findById(userId);
          if (user) {
            req.user = user;
            return next();
          }
        } catch (err) {
          console.warn('[Auth] JWT verification failed:', err);
        }
      }

      return res.status(401).json({ error: 'Unauthorized', isDevMode: isDevMode() });
    } catch (err) {
      console.error('[Auth] Combined auth error:', err);
      return res.status(401).json({ error: 'Unauthorized', isDevMode: isDevMode() });
    }
  };
}

export const authMiddleware = createAuthMiddleware({ store: dbAuthUserStore });
