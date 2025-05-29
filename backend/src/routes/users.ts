import { Router } from 'express';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// Create a new user
router.post('/', async (req, res) => {
  try {
    const { telegramId, username } = req.body;
    
    if (!telegramId || !username) {
      return res.status(400).json({ error: 'telegramId and username are required' });
    }

    const newUser = await db.insert(users).values({
      telegramId,
      username
    }).returning();

    res.status(201).json(newUser[0]);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
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

export default router;
