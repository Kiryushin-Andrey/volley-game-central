import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { validate } from '@telegram-apps/init-data-node';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

// Helper: find user by ID
async function findUserById(userId: number) {
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return rows[0] || null;
}

// Helper: find or create by Telegram
interface TelegramUser { id: number; first_name: string; last_name?: string; username?: string; photo_url?: string }

async function findOrCreateTelegramUser(tu: TelegramUser) {
  const telegramId = tu.id.toString();
  const hasFirst = !!tu.first_name && tu.first_name.trim().length > 0;
  const hasLast = !!tu.last_name && tu.last_name.trim().length > 0;
  const displayName = (hasFirst || hasLast)
    ? [tu.first_name, tu.last_name].filter((v): v is string => !!v && v.trim().length > 0).map(v => v.trim()).join(' ')
    : (tu.username || `user_${tu.id}`);

  const existing = await db.select().from(users).where(eq(users.telegramId, telegramId)).limit(1);
  if (existing.length > 0) {
    const [updated] = await db.update(users)
      .set({ displayName, avatarUrl: tu.photo_url ?? null, telegramUsername: tu.username ?? null })
      .where(eq(users.telegramId, telegramId))
      .returning();
    return updated;
  }
  const [created] = await db.insert(users).values({
    telegramId,
    displayName: displayName || telegramId,
    telegramUsername: tu.username ?? null,
    avatarUrl: tu.photo_url ?? null,
  }).returning();
  return created;
}

/**
 * Combined authentication middleware:
 * 1) Prefer Telegram WebApp auth when Authorization header is present
 * 2) Fallback to JWT cookie from phone auth
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    // 1) Prefer Telegram WebApp auth if provided
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('TelegramWebApp ')) {
      const initData = authHeader.replace('TelegramWebApp ', '');
      if (!initData) {
        console.warn('[Auth][TG] Missing init data in Authorization header');
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (!botToken) {
        console.error('[Auth] TELEGRAM_BOT_TOKEN not configured');
        return res.status(500).json({ error: 'Server authentication configuration error' });
      }

      validate(initData, botToken);
      const params = new URLSearchParams(initData);
      const userDataString = params.get('user');
      if (!userDataString) {
        console.warn('[Auth][TG] Missing user field in init data');
        return res.status(401).json({ error: 'Unauthorized' });
      }
      let tgUser: TelegramUser;
      try {
        tgUser = JSON.parse(userDataString);
      } catch (e) {
        console.warn('[Auth][TG] Failed to parse user JSON from init data:', e);
        return res.status(401).json({ error: 'Unauthorized' });
      }
      if (!tgUser.id) {
        console.warn('[Auth][TG] Parsed user missing id');
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const user = await findOrCreateTelegramUser(tgUser);
      req.user = user;
      return next();
    }

    // 2) Fallback to JWT cookie from phone auth
    const token = (req as any).cookies?.auth_token;
    const secret = process.env.JWT_SECRET;
    if (token && secret) {
      try {
        const payload = jwt.verify(token, secret) as { userId: number };
        const user = await findUserById(payload.userId);
        if (user) {
          req.user = user;
          return next();
        }
      } catch (err) {
        // Log and fall through to 401 below
        console.warn('[Auth] JWT verification failed:', err);
      }
    }

    // Neither Telegram nor JWT produced a user
    return res.status(401).json({ error: 'Unauthorized' });
  } catch (err) {
    console.error('[Auth] Combined auth error:', err);
    return res.status(401).json({ error: 'Unauthorized' });
  }
}
