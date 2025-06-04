import { Router } from 'express';
import { db } from '../db';
import { users } from '../db/schema';
import { eq, and, ne } from 'drizzle-orm';

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
router.get('/', async (req, res) => {
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

router.put('/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const { telegramId, username } = req.body;

    // Check if user exists
    const existingUser = await db.select().from(users).where(eq(users.id, userId));
    if (!existingUser.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if telegramId is already taken by another user
    const userWithTelegramId = await db.select().from(users).where(and(
      eq(users.telegramId, telegramId),
      ne(users.id, userId)
    ));
    if (userWithTelegramId.length) {
      return res.status(400).json({ error: 'Telegram ID already taken' });
    }

    // Update user
    const updatedUser = await db.update(users)
      .set({ telegramId, username })
      .where(eq(users.id, userId))
      .returning();

    res.json(updatedUser[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

export default router;
