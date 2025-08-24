import { Router } from 'express';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { getUserUnpaidItems } from '../services/unpaidService';

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

// Current user: Get unpaid games (grouped per game)
// Returns one entry per game with total amount and paymentLink (if exists), excluding waitlist
router.get('/me/unpaid-games', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const result = await getUserUnpaidItems(req.user.id);
    res.json(result);
  } catch (error) {
    console.error('Error fetching unpaid games for current user:', error);
    res.status(500).json({ error: 'Failed to fetch unpaid games' });
  }
});


export default router;
