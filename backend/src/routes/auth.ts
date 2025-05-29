import { Router, Request, Response } from 'express';
import { Telegraf } from 'telegraf';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

const router = Router();
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');

interface TelegramAuthData {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

interface User {
  id: number;
  telegramId: string;
  username: string;
  createdAt: Date | null;
}

// Generate JWT token
const generateToken = (user: User): string => {
  return jwt.sign(
    { id: user.id, telegramId: user.telegramId },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
  );
};

// Telegram authentication endpoint
router.get('/telegram', (_req: Request, res: Response) => {
  const loginUrl = `https://telegram.org/auth?bot_id=${process.env.TELEGRAM_BOT_TOKEN}&origin=http://localhost:5173`;
  res.redirect(loginUrl);
});

// Telegram callback endpoint
router.post('/telegram/callback', async (req: Request<{}, {}, TelegramAuthData>, res: Response) => {
  try {
    const { id, first_name, last_name, username } = req.body;

    // Find existing user
    const existingUsers = await db.select().from(users).where(eq(users.telegramId, id.toString()));
    let user = existingUsers[0];

    if (!user) {
      // Create new user
      const [newUser] = await db.insert(users).values({
        telegramId: id.toString(),
        username: username || 'unknown'
      }).returning();
      user = newUser;
    }

    const token = generateToken(user);

    // Send postMessage to parent window with user data
    res.send(`
      <script>
        window.opener.postMessage({
          type: 'TELEGRAM_LOGIN',
          user: ${JSON.stringify(user)},
          token: '${token}'
        }, 'http://localhost:5173');
        window.close();
      </script>
    `);
  } catch (error: unknown) {
    console.error('Error during Telegram callback:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

export default router;
