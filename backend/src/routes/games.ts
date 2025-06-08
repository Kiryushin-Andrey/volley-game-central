import { Router } from 'express';
import { db } from '../db';
import { games, gameRegistrations, users } from '../db/schema';
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
router.post('/:gameId/register', telegramAuthMiddleware, async (req, res) => {
  try {
    const { gameId } = req.params;
    
    // Get user ID from authenticated user
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const userId = req.user.id;

    // Check if game exists and has space
    const game = await db.select().from(games).where(eq(games.id, parseInt(gameId)));
    if (!game.length) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    // Enforce timing restriction: can only join starting 6 days before the game
    const gameDateTime = new Date(game[0].dateTime);
    const now = new Date();
    const sixDaysBeforeGame = new Date(gameDateTime);
    sixDaysBeforeGame.setDate(sixDaysBeforeGame.getDate() - 6);
    
    if (now < sixDaysBeforeGame) {
      return res.status(403).json({ 
        error: 'Registration is only possible starting 6 days before the game',
        gameDateTime: gameDateTime,
        registrationOpensAt: sixDaysBeforeGame
      });
    }

    // Count current registrations
    const registrations = await db.select().from(gameRegistrations)
      .where(eq(gameRegistrations.gameId, parseInt(gameId)))
      .orderBy(gameRegistrations.createdAt);

    // First maxPlayers registrations are active, the rest are waitlist
    // No need to store isWaitlist - it's computed based on registration order

    // Check if user is already registered
    const existingRegistration = await db.select().from(gameRegistrations)
      .where(and(
        eq(gameRegistrations.gameId, parseInt(gameId)),
        eq(gameRegistrations.userId, userId)
      ));

    if (existingRegistration.length > 0) {
      return res.status(400).json({ error: 'User already registered for this game' });
    }

    // Insert new registration - isWaitlist is now computed, not stored
    const registration = await db.insert(gameRegistrations).values({
      gameId: parseInt(gameId),
      userId
    }).returning();

    res.status(201).json(registration[0]);
  } catch (error) {
    console.error('Error registering for game:', error);
    res.status(500).json({ error: 'Failed to register for game' });
  }
});

// Unregister user from a game
router.delete('/:gameId/register', telegramAuthMiddleware, async (req, res) => {
  try {
    const { gameId } = req.params;
    
    // Get user ID from authenticated user
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const userId = req.user.id;
    
    // Check if game exists
    const game = await db.select().from(games).where(eq(games.id, parseInt(gameId)));
    if (!game.length) {
      return res.status(404).json({ error: 'Game not found' });
    }
    
    // Get all registrations for this game to determine which are waitlisted
    const allRegistrations = await db.select().from(gameRegistrations)
      .where(eq(gameRegistrations.gameId, parseInt(gameId)))
      .orderBy(gameRegistrations.createdAt);
    
    // Check if user is registered
    const userRegIndex = allRegistrations.findIndex(reg => reg.userId === userId);
    if (userRegIndex === -1) {
      return res.status(404).json({ error: 'Registration not found' });
    }
    
    // Determine if the user is on the waitlist based on registration order
    const isWaitlist = userRegIndex >= game[0].maxPlayers;
    
    // If not on waitlist, enforce timing restriction: can only leave up to 6 hours before the game
    if (!isWaitlist) {
      const gameDateTime = new Date(game[0].dateTime);
      const now = new Date();
      const sixHoursBeforeGame = new Date(gameDateTime);
      sixHoursBeforeGame.setHours(sixHoursBeforeGame.getHours() - 6);
      
      if (now > sixHoursBeforeGame) {
        return res.status(403).json({ 
          error: 'You can only unregister up to 6 hours before the game starts',
          gameDateTime: gameDateTime,
          unregistrationDeadline: sixHoursBeforeGame
        });
      }
    }
    // Note: If user is on waitlist, they can leave at any time (no timing restriction)

    // Perform the unregistration
    const result = await db.delete(gameRegistrations)
      .where(and(
        eq(gameRegistrations.gameId, parseInt(gameId)),
        eq(gameRegistrations.userId, userId)
      ))
      .returning();

    // If someone was unregistered, we don't need to do any explicit promotion
    // The next time the game is loaded, the waitlist status will be automatically computed
    // based on the registration order, effectively promoting the next person in line

    res.json({ message: 'Successfully unregistered from game' });
  } catch (error) {
    console.error('Error unregistering from game:', error);
    res.status(500).json({ error: 'Failed to unregister from game' });
  }
});

router.get('/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;
    const game = await db.select().from(games).where(eq(games.id, parseInt(gameId)));
    
    if (!game.length) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Get registrations with user information joined
    const registrations = await db.select({
      id: gameRegistrations.id,
      gameId: gameRegistrations.gameId,
      userId: gameRegistrations.userId,
      paid: gameRegistrations.paid,
      createdAt: gameRegistrations.createdAt,
      user: {
        id: users.id,
        telegramId: users.telegramId,
        username: users.username,
        avatarUrl: users.avatarUrl
      }
    })
    .from(gameRegistrations)
    .innerJoin(users, eq(gameRegistrations.userId, users.id))
    .where(eq(gameRegistrations.gameId, parseInt(gameId)))
    .orderBy(gameRegistrations.createdAt);  // Order by registration time

    // Add isWaitlist field dynamically based on registration order
    const registrationsWithWaitlistStatus = registrations.map((reg, index) => ({
      ...reg,
      isWaitlist: index >= game[0].maxPlayers
    }));
    
    res.json({
      ...game[0],
      registrations: registrationsWithWaitlistStatus
    });
  } catch (error) {
    console.error('Error fetching game:', error);
    res.status(500).json({ error: 'Failed to fetch game' });
  }
});

// Get all games with optimized registration stats and user-specific registration info
router.get('/', telegramAuthMiddleware, async (req, res) => {
  try {
    // Parse the includePastGames query parameter
    const includePastGames = req.query.includePastGames === 'true';
    
    // Get current date for filtering
    const currentDate = new Date();
    
    // Calculate date 5 days from now for timing threshold
    const fiveDaysFromNow = new Date();
    fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
    
    // Build a query that filters and sorts in SQL
    let query;
    
    // Apply date filter in SQL if not including past games
    if (!includePastGames) {
      query = db.select().from(games).where(gte(games.dateTime, currentDate));
    } else {
      query = db.select().from(games);
    }
    
    // Sort by dateTime descending (newest to oldest) in SQL
    const filteredGames = await query.orderBy(desc(games.dateTime));
    
    if (filteredGames.length === 0) {
      return res.json([]);
    }
    
    // Get game IDs for registration count queries
    const gameIds = filteredGames.map(game => game.id);
    
    // Calculate registration counts for each game (optimize with SQL counts)
    const registrationCounts = await db.select({
      gameId: gameRegistrations.gameId,
      totalCount: sql<number>`count(${gameRegistrations.id})`
    })
    .from(gameRegistrations)
    .where(inArray(gameRegistrations.gameId, gameIds))
    .groupBy(gameRegistrations.gameId);
    
    // For past games, also get paid counts
    const paidCounts = await db.select({
      gameId: gameRegistrations.gameId,
      paidCount: sql<number>`count(${gameRegistrations.id})`
    })
    .from(gameRegistrations)
    .where(and(
      inArray(gameRegistrations.gameId, gameIds),
      eq(gameRegistrations.paid, true)
    ))
    .groupBy(gameRegistrations.gameId);
    
    // Process games with their stats asynchronously with proper user registration info
    const processGames = async () => {
      const gamesWithStats = [];
      const userId = req.user?.id; // Safely access user ID
      
      // Process each game one by one to handle async operations properly
      for (const game of filteredGames) {
        // Find registration counts for this game
        const regCount = registrationCounts.find(rc => rc.gameId === game.id);
        const paidCount = paidCounts.find(pc => pc.gameId === game.id);
        const totalCount = regCount?.totalCount || 0;
        
        const isGameInPast = new Date(game.dateTime) < currentDate;
        const isWithinFiveDays = new Date(game.dateTime) < fiveDaysFromNow;
        
        // Build response based on game timing
        const gameWithStats = {
          ...game,
          // Do not include registrations array for performance
          registrations: [],
          totalRegisteredCount: totalCount
        };
        
        // Add specific counts based on game timing
        if (isGameInPast) {
          // For past games, include paid user count
          Object.assign(gameWithStats, {
            paidCount: paidCount?.paidCount || 0
          });
        } else if (isWithinFiveDays) {
          // For upcoming games within 5 days, include registration count
          Object.assign(gameWithStats, {
            registeredCount: totalCount,
          });
          
          // Get user registration status for upcoming games within 5 days
          if (userId !== undefined) {
            // Find if the current user is registered for this game
            const registration = await db.select()
              .from(gameRegistrations)
              .where(and(
                eq(gameRegistrations.gameId, game.id),
                eq(gameRegistrations.userId, userId)
              ));
            
            const isUserRegistered = registration.length > 0;
            let userRegistration = null;
            
            if (isUserRegistered) {
              // Get all registrations to determine waitlist status
              const allRegistrations = await db.select()
                .from(gameRegistrations)
                .where(eq(gameRegistrations.gameId, game.id))
                .orderBy(gameRegistrations.createdAt);
              
              // Find position in registrations list
              const position = allRegistrations.findIndex(reg => reg.userId === userId);
              const isWaitlist = position >= game.maxPlayers;
              
              // Add waitlist status to the registration
              userRegistration = {
                ...registration[0],
                isWaitlist
              };
            }
            
            // Add user-specific info to the game data
            Object.assign(gameWithStats, {
              isUserRegistered,
              userRegistration
            });
          }
        }
        
        gamesWithStats.push(gameWithStats);
      }
      
      return gamesWithStats;
    };
    
    // Execute the async processing and return the results
    const gamesWithStats = await processGames();
    res.json(gamesWithStats);
  } catch (error) {
    console.error('Error fetching all games:', error);
    res.status(500).json({ error: 'Failed to fetch games' });
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
