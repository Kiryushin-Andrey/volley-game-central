import { Request, Response, NextFunction } from 'express';
import { validate } from '@telegram-apps/init-data-node';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

// Extend the Express Request type to include a user property
declare global {
  namespace Express {
    interface Request {
      user?: any;
      telegramInitData?: string;
    }
  }
}

/**
 * Middleware to verify Telegram WebApp auth and attach user to request
 */
export const telegramAuthMiddleware = async (
  req: Request, 
  res: Response, 
  next: NextFunction
) => {
  try {
    // Get Telegram WebApp init data from the Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('TelegramWebApp ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    // Extract the init data from the header
    const initData = authHeader.replace('TelegramWebApp ', '');
    req.telegramInitData = initData;
    
    if (!initData) {
      return res.status(401).json({ error: 'Missing Telegram WebApp init data' });
    }

    // Get bot token for validation
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
      console.error('[Auth] TELEGRAM_BOT_TOKEN not configured');
      return res.status(500).json({ error: 'Server authentication configuration error' });
    }

    // Verify the Telegram WebApp init data
    try {
      // This will throw an error if validation fails
      validate(initData, botToken);
      
      // Extract user data from initData
      const initDataParams = new URLSearchParams(initData);
      const userDataString = initDataParams.get('user');
      
      if (!userDataString) {
        return res.status(401).json({ error: 'Missing user data in Telegram WebApp init data' });
      }
      
      // Parse user data
      const userData = JSON.parse(userDataString);
      if (!userData.id) {
        return res.status(401).json({ error: 'Invalid user data in Telegram WebApp init data' });
      }
      
      // Find or create the user
      const user = await findOrCreateUser(userData.id.toString(), {
        username: userData.username || userData.first_name || `user_${userData.id}`
      });
      
      // Attach the user to the request object for downstream middleware/routes
      req.user = user;
      
      // Proceed to the next middleware/route handler
      next();
    } catch (validationError) {
      console.error('[Auth] Telegram WebApp data validation failed:', validationError);
      return res.status(401).json({ error: 'Invalid Telegram WebApp authentication data' });
    }
  } catch (error) {
    console.error('[Auth] Authentication middleware error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
};

/**
 * Helper function to find or create a user
 */
async function findOrCreateUser(telegramId: string, data: { username?: string }) {
  const existingUser = await db.select().from(users).where(eq(users.telegramId, telegramId)).limit(1);

  if (existingUser.length > 0) {
    return existingUser[0];
  }

  const [newUser] = await db.insert(users).values({
    telegramId,
    username: data.username || telegramId,
  }).returning();

  return newUser;
}
