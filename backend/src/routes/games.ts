import { Router } from 'express';
import { db } from '../db';
import { games, gameRegistrations } from '../db/schema';
import { eq, and } from 'drizzle-orm';

const router = Router();

// Create a new game
router.post('/', async (req, res) => {
  try {
    const { dateTime, maxPlayers, createdById } = req.body;
    
    if (!dateTime || !maxPlayers || !createdById) {
      return res.status(400).json({ error: 'dateTime, maxPlayers, and createdById are required' });
    }

    const newGame = await db.insert(games).values({
      dateTime: new Date(dateTime),
      maxPlayers,
      createdById
    }).returning();

    res.status(201).json(newGame[0]);
  } catch (error) {
    console.error('Error creating game:', error);
    res.status(500).json({ error: 'Failed to create game' });
  }
});

// Register user for a game
router.post('/:gameId/register', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Check if game exists and has space
    const game = await db.select().from(games).where(eq(games.id, parseInt(gameId)));
    if (!game.length) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Count current registrations
    const registrations = await db.select().from(gameRegistrations)
      .where(and(
        eq(gameRegistrations.gameId, parseInt(gameId)),
        eq(gameRegistrations.isWaitlist, false)
      ));

    const isWaitlist = registrations.length >= game[0].maxPlayers;

    // Check if user is already registered
    const existingRegistration = await db.select().from(gameRegistrations)
      .where(and(
        eq(gameRegistrations.gameId, parseInt(gameId)),
        eq(gameRegistrations.userId, userId)
      ));

    if (existingRegistration.length > 0) {
      return res.status(400).json({ error: 'User already registered for this game' });
    }

    const registration = await db.insert(gameRegistrations).values({
      gameId: parseInt(gameId),
      userId,
      isWaitlist
    }).returning();

    res.status(201).json(registration[0]);
  } catch (error) {
    console.error('Error registering for game:', error);
    res.status(500).json({ error: 'Failed to register for game' });
  }
});

// Unregister user from a game
router.delete('/:gameId/register/:userId', async (req, res) => {
  try {
    const { gameId, userId } = req.params;

    const result = await db.delete(gameRegistrations)
      .where(and(
        eq(gameRegistrations.gameId, parseInt(gameId)),
        eq(gameRegistrations.userId, parseInt(userId))
      ))
      .returning();

    if (!result.length) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    // If someone was unregistered from the main list, move the first waitlisted person to the main list
    if (!result[0].isWaitlist) {
      const waitlistedUsers = await db.select().from(gameRegistrations)
        .where(and(
          eq(gameRegistrations.gameId, parseInt(gameId)),
          eq(gameRegistrations.isWaitlist, true)
        ));

      if (waitlistedUsers.length > 0) {
        await db.update(gameRegistrations)
          .set({ isWaitlist: false })
          .where(eq(gameRegistrations.id, waitlistedUsers[0].id));
      }
    }

    res.json({ message: 'Successfully unregistered from game' });
  } catch (error) {
    console.error('Error unregistering from game:', error);
    res.status(500).json({ error: 'Failed to unregister from game' });
  }
});

// Get game details with registrations
router.get('/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;
    const game = await db.select().from(games).where(eq(games.id, parseInt(gameId)));
    
    if (!game.length) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const registrations = await db.select().from(gameRegistrations)
      .where(eq(gameRegistrations.gameId, parseInt(gameId)));

    res.json({
      ...game[0],
      registrations
    });
  } catch (error) {
    console.error('Error fetching game:', error);
    res.status(500).json({ error: 'Failed to fetch game' });
  }
});

export default router;
