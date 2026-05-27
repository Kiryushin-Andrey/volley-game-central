import { Router } from 'express';
import { db } from '../db';
import { gameAdministrators, users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { getUserSelectFields } from '../utils/dbQueryUtils';

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

// Single assignment with user details (global admin or the assigned user only)
router.get('/assignments/:id', async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid assignment ID' });
    }

    const rows = await db
      .select({
        id: gameAdministrators.id,
        dayOfWeek: gameAdministrators.dayOfWeek,
        withPositions: gameAdministrators.withPositions,
        userId: gameAdministrators.userId,
        createdAt: gameAdministrators.createdAt,
        user: getUserSelectFields(),
      })
      .from(gameAdministrators)
      .innerJoin(users, eq(users.id, gameAdministrators.userId))
      .where(eq(gameAdministrators.id, id))
      .limit(1);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Game administrator assignment not found' });
    }

    const assignment = rows[0];
    if (!req.user.isAdmin && assignment.userId !== req.user.id) {
      return res.status(403).json({ error: 'You are not authorized to view this assignment' });
    }

    res.json(assignment);
  } catch (error) {
    console.error('Error fetching game administrator assignment:', error);
    res.status(500).json({ error: 'Failed to fetch administrator assignment' });
  }
});

export default router;
