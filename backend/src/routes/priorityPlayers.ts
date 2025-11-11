import { Router } from 'express';
import { db } from '../db';
import { priorityPlayers, users, gameAdministrators } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { isUserAssignedAdminForDayAndPosition } from '../middleware/adminOrAssignedAdmin';
import { getUserSelectFields } from '../utils/dbQueryUtils';

const router = Router();

// Get all priority players (optionally filtered by gameAdministratorId)
router.get('/', async (req, res) => {
  try {
    const { gameAdministratorId } = req.query;

    let baseQuery = db
      .select({
        id: priorityPlayers.id,
        gameAdministratorId: priorityPlayers.gameAdministratorId,
        userId: priorityPlayers.userId,
        createdAt: priorityPlayers.createdAt,
        user: getUserSelectFields(),
      })
      .from(priorityPlayers)
      .innerJoin(users, eq(users.id, priorityPlayers.userId));

    if (gameAdministratorId) {
      const adminId = parseInt(gameAdministratorId as string);
      if (!Number.isNaN(adminId)) {
        const results = await baseQuery
          .where(eq(priorityPlayers.gameAdministratorId, adminId))
          .orderBy(desc(priorityPlayers.createdAt));
        return res.json(results);
      }
    }

    const results = await baseQuery.orderBy(desc(priorityPlayers.createdAt));
    res.json(results);
  } catch (error) {
    console.error('Error fetching priority players:', error);
    res.status(500).json({ error: 'Failed to fetch priority players' });
  }
});

// Create a new priority player assignment
router.post('/', async (req, res) => {
  try {
    const { gameAdministratorId, userId } = req.body;

    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!gameAdministratorId) {
      return res.status(400).json({ error: 'gameAdministratorId is required' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const adminId = parseInt(gameAdministratorId);
    if (Number.isNaN(adminId)) {
      return res.status(400).json({ error: 'Invalid gameAdministratorId' });
    }

    // Fetch the game administrator to get dayOfWeek and withPositions
    const gameAdmin = await db
      .select()
      .from(gameAdministrators)
      .where(eq(gameAdministrators.id, adminId))
      .limit(1);

    if (gameAdmin.length === 0) {
      return res.status(404).json({ error: 'Game administrator assignment not found' });
    }

    // Check authorization: global admin OR assigned admin for this day/position combination
    if (!req.user.isAdmin) {
      const isAssigned = await isUserAssignedAdminForDayAndPosition(
        req.user.id,
        gameAdmin[0].dayOfWeek,
        gameAdmin[0].withPositions
      );
      if (!isAssigned) {
        return res.status(403).json({ error: 'You are not authorized to manage priority players for this assignment' });
      }
    }

    // Check if user exists
    const userExists = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (userExists.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if this priority player assignment already exists
    const existing = await db
      .select()
      .from(priorityPlayers)
      .where(
        and(
          eq(priorityPlayers.gameAdministratorId, adminId),
          eq(priorityPlayers.userId, userId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({ error: 'This priority player assignment already exists' });
    }

    // Create new priority player assignment
    const newPriorityPlayer = await db
      .insert(priorityPlayers)
      .values({
        gameAdministratorId: adminId,
        userId,
      })
      .returning();

    // Fetch with user details
    const result = await db
      .select({
        id: priorityPlayers.id,
        gameAdministratorId: priorityPlayers.gameAdministratorId,
        userId: priorityPlayers.userId,
        createdAt: priorityPlayers.createdAt,
        user: getUserSelectFields(),
      })
      .from(priorityPlayers)
      .innerJoin(users, eq(users.id, priorityPlayers.userId))
      .where(eq(priorityPlayers.id, newPriorityPlayer[0].id));

    res.status(201).json(result[0]);
  } catch (error) {
    console.error('Error creating priority player:', error);
    res.status(500).json({ error: 'Failed to create priority player' });
  }
});

// Delete a priority player assignment
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid priority player ID' });
    }

    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Fetch the existing priority player to get gameAdministratorId
    const existing = await db
      .select({
        id: priorityPlayers.id,
        gameAdministratorId: priorityPlayers.gameAdministratorId,
      })
      .from(priorityPlayers)
      .where(eq(priorityPlayers.id, id))
      .limit(1);

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Priority player assignment not found' });
    }

    // Fetch the game administrator to get dayOfWeek and withPositions
    const gameAdmin = await db
      .select()
      .from(gameAdministrators)
      .where(eq(gameAdministrators.id, existing[0].gameAdministratorId))
      .limit(1);

    if (gameAdmin.length === 0) {
      return res.status(404).json({ error: 'Game administrator assignment not found' });
    }

    // Check authorization: global admin OR assigned admin for this day/position combination
    if (!req.user.isAdmin) {
      const isAssigned = await isUserAssignedAdminForDayAndPosition(
        req.user.id,
        gameAdmin[0].dayOfWeek,
        gameAdmin[0].withPositions
      );
      if (!isAssigned) {
        return res.status(403).json({ error: 'You are not authorized to manage priority players for this assignment' });
      }
    }

    const deleted = await db.delete(priorityPlayers).where(eq(priorityPlayers.id, id)).returning();

    if (deleted.length === 0) {
      return res.status(404).json({ error: 'Priority player assignment not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting priority player:', error);
    res.status(500).json({ error: 'Failed to delete priority player' });
  }
});

export default router;

