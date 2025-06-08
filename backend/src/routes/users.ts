import { Router } from 'express';
import { db } from '../db';
import { users } from '../db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { telegramAuthMiddleware } from '../middleware/telegramAuth';
import { adminAuthMiddleware } from '../middleware/adminAuth';

const router = Router();



// Get currently authenticated user
router.get('/me', async (req, res) => {
  try {
    // The user is attached to the request by the telegramAuth middleware
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    res.json(req.user);
  } catch (error) {
    console.error('Error fetching current user:', error);
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

// Get all users
router.get('/', telegramAuthMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const allUsers = await db.select().from(users);
    res.json(allUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user by telegramId
router.get('/:telegramId', async (req, res) => {
  try {
    const { telegramId } = req.params;
    const user = await db.select().from(users).where(eq(users.telegramId, telegramId));
    
    if (!user.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Get user by ID
router.get('/id/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await db.select().from(users).where(eq(users.id, parseInt(userId)));
    
    if (!user.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user[0]);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});



export default router;
