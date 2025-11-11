import { Router } from 'express';
import { db } from '../db';
import { gameAdministrators, users } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getUserSelectFields } from '../utils/dbQueryUtils';

const router = Router();

// Get all game administrators
router.get('/', async (req, res) => {
  try {
    const administrators = await db
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
      .orderBy(desc(gameAdministrators.createdAt));

    res.json(administrators);
  } catch (error) {
    console.error('Error fetching game administrators:', error);
    res.status(500).json({ error: 'Failed to fetch game administrators' });
  }
});

// Create a new game administrator assignment
router.post('/', async (req, res) => {
  try {
    const { dayOfWeek, withPositions, userId } = req.body;

    if (dayOfWeek === undefined || dayOfWeek === null) {
      return res.status(400).json({ error: 'dayOfWeek is required' });
    }

    const day = parseInt(dayOfWeek);
    if (Number.isNaN(day) || day < 0 || day > 6) {
      return res.status(400).json({ error: 'dayOfWeek must be between 0 (Monday) and 6 (Sunday)' });
    }

    if (withPositions === undefined || withPositions === null) {
      return res.status(400).json({ error: 'withPositions is required' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const userExists = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (userExists.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const withPos = Boolean(withPositions);

    // Check if an assignment already exists for this day/position combination
    const existing = await db
      .select()
      .from(gameAdministrators)
      .where(
        and(
          eq(gameAdministrators.dayOfWeek, day),
          eq(gameAdministrators.withPositions, withPos),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({ error: 'An administrator assignment already exists for this day and position combination' });
    }

    // Create new assignment
    const newAdministrator = await db
      .insert(gameAdministrators)
      .values({
        dayOfWeek: day,
        withPositions: withPos,
        userId,
      })
      .returning();

    // Fetch with user details
    const administrator = await db
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
      .where(eq(gameAdministrators.id, newAdministrator[0].id));

    res.status(201).json(administrator[0]);
  } catch (error) {
    console.error('Error creating game administrator:', error);
    res.status(500).json({ error: 'Failed to create game administrator' });
  }
});

// Delete a game administrator assignment
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid administrator ID' });
    }

    const deleted = await db.delete(gameAdministrators).where(eq(gameAdministrators.id, id)).returning();

    if (deleted.length === 0) {
      return res.status(404).json({ error: 'Game administrator assignment not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting game administrator:', error);
    res.status(500).json({ error: 'Failed to delete game administrator' });
  }
});

export default router;
