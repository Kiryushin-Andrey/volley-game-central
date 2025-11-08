import { Router } from 'express';
import { db } from '../db';
import { gameAdministrators } from '../db/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// Get current user's administrator assignments (available to all authenticated users)
router.get('/', async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const assignments = await db
      .select()
      .from(gameAdministrators)
      .where(eq(gameAdministrators.userId, req.user.id));

    res.json(assignments);
  } catch (error) {
    console.error('Error fetching user administrator assignments:', error);
    res.status(500).json({ error: 'Failed to fetch administrator assignments' });
  }
});

export default router;
