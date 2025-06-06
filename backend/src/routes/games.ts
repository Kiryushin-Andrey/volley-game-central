import { Router } from 'express';
import { db } from '../db';
import { games, gameRegistrations } from '../db/schema';
import { gte, desc, inArray, eq, and, sql } from 'drizzle-orm';
import { telegramAuthMiddleware } from '../middleware/telegramAuth';

const router = Router();

// Create a new game
router.post('/', async (req, res) => {
  try {
    const { dateTime, maxPlayers } = req.body;
    
    if (!dateTime || !maxPlayers) {
      return res.status(400).json({ error: 'dateTime and maxPlayers are required' });
    }

    // Extract the user ID from the authenticated session
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Authentication required to create a game' });
    }
    
    const createdById = req.user.id;

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

// Get all games with their registrations
router.get('/', async (req, res) => {
  try {
    // Parse the includePastGames query parameter
    const includePastGames = req.query.includePastGames === 'true';
    
    // Get current date for filtering
    const currentDate = new Date();
    
    // Build a query that filters and sorts in SQL rather than in memory
    let query;
    
    // Apply date filter in SQL if not including past games
    if (!includePastGames) {
      query = db.select().from(games).where(gte(games.dateTime, currentDate));
    } else {
      query = db.select().from(games);
    }
    
    // Sort by dateTime descending (newest to oldest) in SQL
    const filteredGames = await query.orderBy(desc(games.dateTime));
    
    // Get registrations for these games (could optimize further with a join if needed)
    const gameIds = filteredGames.map(game => game.id);
    const relevantRegistrations = gameIds.length > 0 
      ? await db.select()
        .from(gameRegistrations)
        .where(inArray(gameRegistrations.gameId, gameIds))
      : [];
    
    // Map registrations to each game
    const gamesWithRegistrations = filteredGames.map(game => ({
      ...game,
      registrations: relevantRegistrations.filter(reg => reg.gameId === game.id)
    }));

    res.json(gamesWithRegistrations);
  } catch (error) {
    console.error('Error fetching all games:', error);
    res.status(500).json({ error: 'Failed to fetch games' });
  }
});

// Update registration status (move between active and waitlist)
router.patch('/:gameId/register/:userId', async (req, res) => {
  try {
    const { gameId, userId } = req.params;
    const { isWaitlist } = req.body;

    if (typeof isWaitlist !== 'boolean') {
      return res.status(400).json({ error: 'isWaitlist boolean is required' });
    }

    // If moving to active list, check if there's space
    if (!isWaitlist) {
      const game = await db.select().from(games).where(eq(games.id, parseInt(gameId)));
      if (!game.length) {
        return res.status(404).json({ error: 'Game not found' });
      }

      const activeRegistrations = await db.select().from(gameRegistrations)
        .where(and(
          eq(gameRegistrations.gameId, parseInt(gameId)),
          eq(gameRegistrations.isWaitlist, false)
        ));

      if (activeRegistrations.length >= game[0].maxPlayers) {
        return res.status(400).json({ error: 'Game is full' });
      }
    }

    const result = await db.update(gameRegistrations)
      .set({ isWaitlist })
      .where(and(
        eq(gameRegistrations.gameId, parseInt(gameId)),
        eq(gameRegistrations.userId, parseInt(userId))
      ))
      .returning();

    if (!result.length) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    res.json(result[0]);
  } catch (error) {
    console.error('Error updating registration status:', error);
    res.status(500).json({ error: 'Failed to update registration status' });
  }
});

// Update game details
router.put('/:gameId', async (req, res) => {
  try {
    const gameId = parseInt(req.params.gameId);
    const { dateTime, maxPlayers } = req.body;

    const game = await db.update(games)
      .set({ dateTime: new Date(dateTime), maxPlayers })
      .where(eq(games.id, gameId))
      .returning();

    if (!game.length) {
      return res.status(404).json({ error: 'Game not found' });
    }

    res.json(game[0]);
  } catch (error) {
    console.error('Error updating game:', error);
    res.status(500).json({ error: 'Failed to update game' });
  }
});

// Delete game and its registrations
router.delete('/:gameId', async (req, res) => {
  try {
    const gameId = parseInt(req.params.gameId);

    // Delete all registrations for this game first
    await db.delete(gameRegistrations)
      .where(eq(gameRegistrations.gameId, gameId));

    // Then delete the game itself
    const game = await db.delete(games)
      .where(eq(games.id, gameId))
      .returning();

    if (!game.length) {
      return res.status(404).json({ error: 'Game not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting game:', error);
    res.status(500).json({ error: 'Failed to delete game' });
  }
});

export default router;
