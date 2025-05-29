import { Router, Request, Response, NextFunction } from 'express';
import { Telegraf } from 'telegraf';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

const router = Router();
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');

export interface AuthRequest extends Request {
  user?: {
    id: number;
    telegramId: string;
    isAdmin: boolean;
  };
}

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
  isAdmin: boolean;
  createdAt: Date | null;
}

// Generate JWT token
const generateToken = (user: User): string => {
  return jwt.sign(
    { id: user.id, telegramId: user.telegramId, isAdmin: user.isAdmin },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
  );
};

export const verifyToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as jwt.JwtPayload;
    req.user = {
      id: decoded.id,
      telegramId: decoded.telegramId,
      isAdmin: decoded.isAdmin
    };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user?.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Telegram authentication endpoint
router.get('/telegram', (_req: Request, res: Response) => {
  // Get bot username from token (format: <numbers>:AAF...)
  const botUsername = process.env.TELEGRAM_BOT_TOKEN?.split(':')[0];
  const loginUrl = `https://oauth.telegram.org/auth?bot_id=${botUsername}&origin=${process.env.CORS_ORIGIN}&request_access=write`;
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

    // Send postMessage to parent window with user data and token
    res.send(`
      <script>
        window.opener.postMessage({
          type: 'TELEGRAM_LOGIN',
          user: ${JSON.stringify({
            ...user,
            token
          })},
          token: '${token}'
        }, '${process.env.CORS_ORIGIN}');
        window.close();
      </script>
    `);
  } catch (error: unknown) {
    console.error('Error during Telegram callback:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

export default router;
