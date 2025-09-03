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

// Update current user's profile (currently supports displayName)
router.put('/me', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { displayName } = req.body as { displayName?: string };
    if (typeof displayName !== 'string') {
      return res.status(400).json({ error: 'displayName is required' });
    }
    const trimmed = displayName.trim();
    if (!trimmed) {
      return res.status(400).json({ error: 'Display name cannot be empty' });
    }
    if (trimmed.length > 255) {
      return res.status(400).json({ error: 'Display name too long' });
    }

    // Load current user row
    const currentRows = await db.select().from(users).where(eq(users.id, req.user.id));
    if (!currentRows.length) {
      return res.status(404).json({ error: 'User not found' });
    }
    const current = currentRows[0] as any;

    // If no change, return current
    if (current.displayName === trimmed) {
      return res.json(current);
    }

    // Build prevDisplayNames list
    const prev = (current.prevDisplayNames as string | null | undefined)?.split(',')
      .map((s) => s.trim())
      .filter(Boolean) || [];
    const updatedPrev = [current.displayName, ...prev]
      .filter(Boolean)
      .slice(0, 5);
    const prevDisplayNamesStr = updatedPrev.join(',');

    // Update row
    await db
      .update(users)
      .set({ displayName: trimmed, prevDisplayNames: prevDisplayNamesStr })
      .where(eq(users.id, req.user.id));

    const updatedRows = await db.select().from(users).where(eq(users.id, req.user.id));
    return res.json(updatedRows[0]);
  } catch (error) {
    console.error('Error updating current user profile:', error);
    return res.status(500).json({ error: 'Failed to update profile' });
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
