import { Router } from 'express';
import { db } from '../db';
import { games, gameRegistrations, users } from '../db/schema';
import { gte, desc, inArray, eq, and, sql } from 'drizzle-orm';
import { telegramAuthMiddleware } from '../middleware/telegramAuth';
import { adminAuthMiddleware } from '../middleware/adminAuth';
import { sendTelegramNotification } from '../services/telegramService';

const router = Router();

// Create a new game
router.post('/', telegramAuthMiddleware, adminAuthMiddleware, async (req, res) => {
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
    
    // Enforce timing restriction: can only join starting 5 days before the game
    const gameDateTime = new Date(game[0].dateTime);
    const now = new Date();
    const fiveDaysBeforeGame = new Date(gameDateTime);
    fiveDaysBeforeGame.setDate(fiveDaysBeforeGame.getDate() - 5);
    
    if (now < fiveDaysBeforeGame) {
      return res.status(403).json({ 
        error: 'Registration is only possible starting 5 days before the game',
        gameDateTime: gameDateTime,
        registrationOpensAt: fiveDaysBeforeGame
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

    // Get all registrations to determine if the user is on the waitlist
    const allRegistrations = await db.select()
      .from(gameRegistrations)
      .where(eq(gameRegistrations.gameId, parseInt(gameId)))
      .orderBy(gameRegistrations.createdAt);

    // Find position in registrations list
    const position = allRegistrations.findIndex(reg => reg.userId === userId);
    const isWaitlist = position >= game[0].maxPlayers;

    // Get user details to send notification
    const userDetails = await db.select().from(users).where(eq(users.id, userId));
    
    if (userDetails.length > 0) {
      // Format date for the notification
      const gameDate = new Date(game[0].dateTime);
      const formattedDate = gameDate.toLocaleDateString('en-GB', { 
        weekday: 'long',
        day: 'numeric', 
        month: 'long', 
        hour: '2-digit', 
        minute: '2-digit'
      });
      
      // Send different notifications based on waitlist status
      if (isWaitlist) {
        // User is on waitlist
        await sendTelegramNotification(
          userDetails[0].telegramId,
          `⏳ You've been added to the waiting list for the volleyball game on ${formattedDate}. We'll notify you if a spot becomes available! Position on waitlist: ${position - game[0].maxPlayers + 1}`
        );
      } else {
        // User is a direct participant
        await sendTelegramNotification(
          userDetails[0].telegramId,
          `✅ You're registered for the volleyball game on ${formattedDate}. See you there! 🏐`
        );
      }
    }

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
    
    // If not on waitlist, enforce timing restriction: can only leave up to 5 hours before the game
    if (!isWaitlist) {
      const gameDateTime = new Date(game[0].dateTime);
      const now = new Date();
      const fiveHoursBeforeGame = new Date(gameDateTime);
      fiveHoursBeforeGame.setHours(fiveHoursBeforeGame.getHours() - 5);
      
      if (now > fiveHoursBeforeGame) {
        return res.status(403).json({
          error: 'You can only unregister up to 5 hours before the game starts',
          gameDateTime: gameDateTime,
          deadline: fiveHoursBeforeGame
        });
      }
    }
    // Note: If user is on waitlist, they can leave at any time (no timing restriction)

    // Get user details to send notification before deleting registration
    const userDetails = await db.select().from(users).where(eq(users.id, userId));
    
    // Format date for the notification
    const gameDate = new Date(game[0].dateTime);
    const formattedDate = gameDate.toLocaleDateString('en-GB', { 
      weekday: 'long',
      day: 'numeric', 
      month: 'long', 
      hour: '2-digit', 
      minute: '2-digit'
    });
    
    // Delete the registration
    await db.delete(gameRegistrations)
      .where(and(
        eq(gameRegistrations.gameId, parseInt(gameId)),
        eq(gameRegistrations.userId, userId)
      ));
      
    // Send notification to the user who left
    if (userDetails.length > 0) {
      await sendTelegramNotification(
        userDetails[0].telegramId,
        `❌ You've been unregistered from the volleyball game on ${formattedDate}. Hope to see you at another game soon! 🏐`
      );
    }
    
    // Check if someone from the waitlist is being promoted
    if (!isWaitlist) {
      // Get all registrations again to find who's being promoted
      const updatedRegistrations = await db.select({
        userId: gameRegistrations.userId,
        createdAt: gameRegistrations.createdAt
      })
      .from(gameRegistrations)
      .where(eq(gameRegistrations.gameId, parseInt(gameId)))
      .orderBy(gameRegistrations.createdAt);
      
      // If there are more registrations than maxPlayers, someone is being promoted
      if (updatedRegistrations.length >= game[0].maxPlayers) {
        // The user at position maxPlayers - 1 is now the last non-waitlisted player
        const promotedUserId = updatedRegistrations[game[0].maxPlayers - 1].userId;
        
        // Get the promoted user's details to send notification
        const promotedUser = await db.select().from(users).where(eq(users.id, promotedUserId));
        
        if (promotedUser.length > 0) {
          // Format date for the notification
          const gameDate = new Date(game[0].dateTime);
          const formattedDate = gameDate.toLocaleDateString('en-GB', { 
            weekday: 'long',
            day: 'numeric', 
            month: 'long', 
            hour: '2-digit', 
            minute: '2-digit'
          });
          
          // Send notification to the promoted user
          await sendTelegramNotification(
            promotedUser[0].telegramId,
            `🎉 Good news! You've been moved from the waiting list to the participants list for the volleyball game on ${formattedDate}. See you there! 🏐`
          );
        }
      }
    }
    
    // The waitlist status will be automatically computed based on registration order
    // when the game is loaded next time

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
    // Parse the includeInactiveGames query parameter
    const includeInactiveGames = req.query.includeInactiveGames === 'true';
    
    // Get current date for filtering
    const currentDate = new Date();
    
    // Calculate date 5 days from now for timing threshold
    const fiveDaysFromNow = new Date();
    fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
    
    // Build a query that filters and sorts in SQL
    let query;
    
    // Apply date filter in SQL if not including inactive games (past games or future games not available for registration)
    if (!includeInactiveGames) {
      // Only show active games: current date <= game date <= 5 days from now
      query = db.select().from(games).where(and(
        gte(games.dateTime, currentDate),
        sql`${games.dateTime} <= ${fiveDaysFromNow}`
      ));
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


// Update game details - Admin only
router.put('/:gameId', telegramAuthMiddleware, adminAuthMiddleware, async (req, res) => {
  try {
    const gameId = parseInt(req.params.gameId);
    const { dateTime, maxPlayers } = req.body;

    // Validate required fields
    if (!dateTime || !maxPlayers) {
      return res.status(400).json({ error: 'dateTime and maxPlayers are required' });
    }

    // Check if game exists before updating
    const existingGame = await db.select().from(games).where(eq(games.id, gameId));
    if (!existingGame.length) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Update the game with new settings
    const game = await db.update(games)
      .set({ 
        dateTime: new Date(dateTime), 
        maxPlayers 
      })
      .where(eq(games.id, gameId))
      .returning();

    res.json(game[0]);
  } catch (error) {
    console.error('Error updating game:', error);
    res.status(500).json({ error: 'Failed to update game' });
  }
});

// Delete game and its registrations
router.delete('/:gameId', telegramAuthMiddleware, adminAuthMiddleware, async (req, res) => {
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
