import { Router } from 'express';
import { db } from '../db';
import { games, gameRegistrations, users, paymentRequests } from '../db/schema';
import { gte, desc, inArray, eq, and, sql, lt, lte, asc } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { PricingMode } from '../types/PricingMode';

type PaymentRequest = InferSelectModel<typeof paymentRequests>;
import { telegramAuthMiddleware } from '../middleware/telegramAuth';
import { adminAuthMiddleware } from '../middleware/adminAuth';
import { sendTelegramNotification } from '../services/telegramService';
import { gameService } from '../services/gameService';
import { bunqService } from '../services/bunqService';
import { REGISTRATION_OPEN_DAYS } from '../constants';

const router = Router();

// Calculate default date and time for a new game
router.get('/default-datetime', telegramAuthMiddleware, async (req, res) => {
  try {
    const { defaultDateTime, defaultLocationName, defaultLocationLink } =
      await gameService.calculateDefaultDateTime();
    res.json({ defaultDateTime, defaultLocationName, defaultLocationLink });
  } catch (error) {
    console.error('Error calculating default date time:', error);
    res.status(500).json({ error: 'Failed to calculate default date time' });
  }
});

// Create a new game
router.post(
  '/',
  telegramAuthMiddleware,
  adminAuthMiddleware,
  async (req, res) => {
    try {
      const {
        dateTime,
        maxPlayers,
        unregisterDeadlineHours = 5,
        paymentAmount,
        pricingMode = PricingMode.PER_PARTICIPANT,
        withPositions = false,
        locationName,
        locationLink,
      } = req.body;

      if (!dateTime || !maxPlayers) {
        return res
          .status(400)
          .json({ error: 'dateTime and maxPlayers are required' });
      }

      // Extract the user ID from the authenticated session
      if (!req.user || !req.user.id) {
        return res
          .status(401)
          .json({ error: 'Authentication required to create a game' });
      }

      const createdById = req.user.id;

      const newGame = await db
        .insert(games)
        .values({
          dateTime: new Date(dateTime),
          maxPlayers,
          unregisterDeadlineHours,
          paymentAmount,
          pricingMode,
          withPositions,
          locationName,
          locationLink,
          createdById,
        })
        .returning();

      res.status(201).json(newGame[0]);
    } catch (error) {
      console.error('Error creating game:', error);
      res.status(500).json({ error: 'Failed to create game' });
    }
  },
);

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
    const game = await db
      .select()
      .from(games)
      .where(eq(games.id, parseInt(gameId)));
    if (!game.length) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Enforce timing restriction: can only join starting X days before the game
    const gameDateTime = new Date(game[0].dateTime);
    const now = new Date();
    const registrationOpenDate = new Date(gameDateTime);
    registrationOpenDate.setDate(
      registrationOpenDate.getDate() - REGISTRATION_OPEN_DAYS,
    );

    if (now < registrationOpenDate) {
      return res.status(403).json({
        error: `Registration is only possible starting ${REGISTRATION_OPEN_DAYS} days before the game`,
        gameDateTime: gameDateTime,
        registrationOpensAt: registrationOpenDate,
      });
    }

    // Count current registrations
    const registrations = await db
      .select()
      .from(gameRegistrations)
      .where(eq(gameRegistrations.gameId, parseInt(gameId)))
      .orderBy(gameRegistrations.createdAt);

    // First maxPlayers registrations are active, the rest are waitlist
    // No need to store isWaitlist - it's computed based on registration order

    // Check if user is already registered
    const existingRegistration = await db
      .select()
      .from(gameRegistrations)
      .where(
        and(
          eq(gameRegistrations.gameId, parseInt(gameId)),
          eq(gameRegistrations.userId, userId),
        ),
      );

    if (existingRegistration.length > 0) {
      return res
        .status(400)
        .json({ error: 'User already registered for this game' });
    }

    // Insert new registration - isWaitlist is now computed, not stored
    const registration = await db
      .insert(gameRegistrations)
      .values({
        gameId: parseInt(gameId),
        userId,
      })
      .returning();

    // Get all registrations to determine if the user is on the waitlist
    const allRegistrations = await db
      .select()
      .from(gameRegistrations)
      .where(eq(gameRegistrations.gameId, parseInt(gameId)))
      .orderBy(gameRegistrations.createdAt);

    // Find position in registrations list
    const position = allRegistrations.findIndex((reg) => reg.userId === userId);
    const isWaitlist = position >= game[0].maxPlayers;

    // Get user details to send notification
    const userDetails = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    if (userDetails.length > 0) {
      // Format date for the notification
      const gameDate = new Date(game[0].dateTime);
      const formattedDate = gameDate.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      });

      // Send different notifications based on waitlist status
      if (isWaitlist) {
        // User is on waitlist
        await sendTelegramNotification(
          userDetails[0].telegramId,
          `⏳ You've been added to the waiting list for the volleyball game on ${formattedDate}. We'll notify you if a spot becomes available! Position on waitlist: ${
            position - game[0].maxPlayers + 1
          }`,
        );
      } else {
        // User is a direct participant
        await sendTelegramNotification(
          userDetails[0].telegramId,
          `✅ You're registered for the volleyball game on ${formattedDate}. See you there! 🏐`,
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
    const game = await db
      .select()
      .from(games)
      .where(eq(games.id, parseInt(gameId)));
    if (!game.length) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Get all registrations for this game to determine which are waitlisted
    const allRegistrations = await db
      .select()
      .from(gameRegistrations)
      .where(eq(gameRegistrations.gameId, parseInt(gameId)))
      .orderBy(gameRegistrations.createdAt);

    // Check if user is registered
    const userRegIndex = allRegistrations.findIndex(
      (reg) => reg.userId === userId,
    );
    if (userRegIndex === -1) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    // Determine if the user is on the waitlist based on registration order
    const isWaitlist = userRegIndex >= game[0].maxPlayers;

    // If not on waitlist, enforce timing restriction: can only leave up to unregisterDeadlineHours before the game
    if (!isWaitlist) {
      const gameDateTime = new Date(game[0].dateTime);
      const now = new Date();
      const deadlineHours = game[0].unregisterDeadlineHours || 5; // Default to 6 hours if not set
      const deadlineBeforeGame = new Date(gameDateTime);
      deadlineBeforeGame.setHours(
        deadlineBeforeGame.getHours() - deadlineHours,
      );

      if (now > deadlineBeforeGame) {
        return res.status(403).json({
          error: `You can only unregister up to ${deadlineHours} hours before the game starts`,
          gameDateTime: gameDateTime,
          deadline: deadlineBeforeGame,
        });
      }
    }
    // Note: If user is on waitlist, they can leave at any time (no timing restriction)

    // Get user details to send notification before deleting registration
    const userDetails = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    // Format date for the notification
    const gameDate = new Date(game[0].dateTime);
    const formattedDate = gameDate.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });

    // Delete the registration
    await db
      .delete(gameRegistrations)
      .where(
        and(
          eq(gameRegistrations.gameId, parseInt(gameId)),
          eq(gameRegistrations.userId, userId),
        ),
      );

    // Send notification to the user who left
    if (userDetails.length > 0) {
      await sendTelegramNotification(
        userDetails[0].telegramId,
        `❌ You've been unregistered from the volleyball game on ${formattedDate}. Hope to see you at another game soon! 🏐`,
      );
    }

    // Check if someone from the waitlist is being promoted
    if (!isWaitlist) {
      // Get all registrations again to find who's being promoted
      const updatedRegistrations = await db
        .select({
          userId: gameRegistrations.userId,
          createdAt: gameRegistrations.createdAt,
        })
        .from(gameRegistrations)
        .where(eq(gameRegistrations.gameId, parseInt(gameId)))
        .orderBy(gameRegistrations.createdAt);

      // If there are more registrations than maxPlayers, someone is being promoted
      if (updatedRegistrations.length >= game[0].maxPlayers) {
        // The user at position maxPlayers - 1 is now the last non-waitlisted player
        const promotedUserId =
          updatedRegistrations[game[0].maxPlayers - 1].userId;

        // Get the promoted user's details to send notification
        const promotedUser = await db
          .select()
          .from(users)
          .where(eq(users.id, promotedUserId));

        if (promotedUser.length > 0) {
          // Format date for the notification
          const gameDate = new Date(game[0].dateTime);
          const formattedDate = gameDate.toLocaleDateString('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit',
          });

          // Send notification to the promoted user
          await sendTelegramNotification(
            promotedUser[0].telegramId,
            `🎉 Good news! You've been moved from the waiting list to the participants list for the volleyball game on ${formattedDate}. See you there! 🏐`,
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
    const game = await db
      .select()
      .from(games)
      .where(eq(games.id, parseInt(gameId)));

    if (!game.length) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Get registrations with user information joined
    const registrations = await db
      .select({
        id: gameRegistrations.id,
        gameId: gameRegistrations.gameId,
        userId: gameRegistrations.userId,
        paid: gameRegistrations.paid,
        createdAt: gameRegistrations.createdAt,
        user: {
          id: users.id,
          telegramId: users.telegramId,
          username: users.username,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(gameRegistrations)
      .innerJoin(users, eq(gameRegistrations.userId, users.id))
      .where(eq(gameRegistrations.gameId, parseInt(gameId)))
      .orderBy(gameRegistrations.createdAt); // Order by registration time

    // Add isWaitlist field dynamically based on registration order
    const registrationsWithWaitlistStatus = registrations.map((reg, index) => ({
      ...reg,
      isWaitlist: index >= game[0].maxPlayers,
    }));

    // Ensure legacy field not leaked; respond with new fields
    const { locationAddress: _deprecated, ...restGame } = game[0] as any;
    res.json({
      ...restGame,
      registrations: registrationsWithWaitlistStatus,
    });
  } catch (error) {
    console.error('Error fetching game:', error);
    res.status(500).json({ error: 'Failed to fetch game' });
  }
});

// Get all games with optimized registration stats and user-specific registration info
router.get('/', telegramAuthMiddleware, async (req, res) => {
  try {
    // Parse query parameters
    const showPast = req.query.showPast === 'true';
    const showAll = req.query.showAll === 'true';
    const isAdmin = req.user?.isAdmin;

    // Get current date for filtering
    const currentDate = new Date();
    let filteredGames;

    if (showPast) {
      // For past games: game date is before current date
      if (showAll) {
        // Show all past games
        filteredGames = await db
          .select()
          .from(games)
          .where(lt(games.dateTime, currentDate))
          .orderBy(desc(games.dateTime));
      } else {
        // Get past games with unpaid participants
        filteredGames = await db
          .select()
          .from(games)
          .where(
            and(lt(games.dateTime, currentDate), eq(games.fullyPaid, false)),
          )
          .orderBy(desc(games.dateTime));
      }
    } else {
      // For upcoming games: game date is on or after current date
      if (showAll) {
        // Show all upcoming games
        filteredGames = await db
          .select()
          .from(games)
          .where(gte(games.dateTime, currentDate))
          .orderBy(asc(games.dateTime));
      } else {
        // Only show games within the next REGISTRATION_OPEN_DAYS days (open for registration)
        const registrationWindowEnd = new Date();
        registrationWindowEnd.setDate(
          registrationWindowEnd.getDate() + REGISTRATION_OPEN_DAYS,
        );

        filteredGames = await db
          .select()
          .from(games)
          .where(
            and(
              gte(games.dateTime, currentDate),
              lte(games.dateTime, registrationWindowEnd),
            ),
          )
          .orderBy(asc(games.dateTime));
      }
    }

    if (filteredGames.length === 0) {
      return res.json([]);
    }

    // Get game IDs for registration count queries
    const gameIds = filteredGames.map((game) => game.id);

    // Calculate registration counts for each game (optimize with SQL counts)
    const registrationCounts = await db
      .select({
        gameId: gameRegistrations.gameId,
        totalCount: sql<number>`count(${gameRegistrations.id})`,
      })
      .from(gameRegistrations)
      .where(inArray(gameRegistrations.gameId, gameIds))
      .groupBy(gameRegistrations.gameId);

    // For past games, also get paid counts
    const paidCounts = await db
      .select({
        gameId: gameRegistrations.gameId,
        paidCount: sql<number>`count(${gameRegistrations.id})`,
      })
      .from(gameRegistrations)
      .where(
        and(
          inArray(gameRegistrations.gameId, gameIds),
          eq(gameRegistrations.paid, true),
        ),
      )
      .groupBy(gameRegistrations.gameId);

    // Process games with their stats asynchronously with proper user registration info
    const processGames = async () => {
      const gamesWithStats = [];
      const userId = req.user?.id; // Safely access user ID

      const registrationWindowEnd = new Date();
      registrationWindowEnd.setDate(
        registrationWindowEnd.getDate() + REGISTRATION_OPEN_DAYS,
      );

      // Process each game one by one to handle async operations properly
      for (const game of filteredGames) {
        // Find registration counts for this game
        const regCount = registrationCounts.find((rc) => rc.gameId === game.id);
        const paidCount = paidCounts.find((pc) => pc.gameId === game.id);
        const totalCount = regCount?.totalCount || 0;

        const isGameInPast = new Date(game.dateTime) < currentDate;
        const isWithinRegistrationWindow =
          new Date(game.dateTime) < registrationWindowEnd;

        // Build response based on game timing
        const { locationAddress: _deprecatedLocation, ...gameNoLegacy } =
          game as any;
        const gameWithStats = {
          ...gameNoLegacy,
          // Do not include registrations array for performance
          registrations: [],
          totalRegisteredCount: totalCount,
        };

        // Add specific counts based on game timing
        if (isGameInPast) {
          // For past games, include paid user count
          Object.assign(gameWithStats, {
            paidCount: paidCount?.paidCount || 0,
          });
        } else if (isWithinRegistrationWindow) {
          // For upcoming games within X days, include registration count
          Object.assign(gameWithStats, {
            registeredCount: totalCount,
          });

          // Get user registration status for upcoming games within X days
          if (userId !== undefined) {
            // Find if the current user is registered for this game
            const registration = await db
              .select()
              .from(gameRegistrations)
              .where(
                and(
                  eq(gameRegistrations.gameId, game.id),
                  eq(gameRegistrations.userId, userId),
                ),
              );

            const isUserRegistered = registration.length > 0;
            let userRegistration = null;

            if (isUserRegistered) {
              // Get all registrations to determine waitlist status
              const allRegistrations = await db
                .select()
                .from(gameRegistrations)
                .where(eq(gameRegistrations.gameId, game.id))
                .orderBy(gameRegistrations.createdAt);

              // Find position in registrations list
              const position = allRegistrations.findIndex(
                (reg) => reg.userId === userId,
              );
              const isWaitlist = position >= game.maxPlayers;

              // Add waitlist status to the registration
              userRegistration = {
                ...registration[0],
                isWaitlist,
              };
            }

            // Add user-specific info to the game data
            Object.assign(gameWithStats, {
              isUserRegistered,
              userRegistration,
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
router.put(
  '/:gameId',
  telegramAuthMiddleware,
  adminAuthMiddleware,
  async (req, res) => {
    try {
      const gameId = parseInt(req.params.gameId);
      const {
        dateTime,
        maxPlayers,
        unregisterDeadlineHours,
        paymentAmount,
        pricingMode,
        withPositions,
        locationName,
        locationLink,
      } = req.body;

      // Validate required fields
      if (!dateTime || !maxPlayers) {
        return res
          .status(400)
          .json({ error: 'dateTime and maxPlayers are required' });
      }

      // Check if game exists before updating
      const existingGame = await db
        .select()
        .from(games)
        .where(eq(games.id, gameId));
      if (!existingGame.length) {
        return res.status(404).json({ error: 'Game not found' });
      }

      // Store original values for comparison to determine what changed
      const originalDateTime = new Date(existingGame[0].dateTime);
      const originalMaxPlayers = existingGame[0].maxPlayers;
      const originalDeadlineHours =
        existingGame[0].unregisterDeadlineHours || 5;
      const originalPaymentAmount = existingGame[0].paymentAmount;
      const originalWithPositions = existingGame[0].withPositions || false;
      const newDateTime = new Date(dateTime);

      // Update the game with new settings
      const game = await db
        .update(games)
        .set({
          dateTime: newDateTime,
          maxPlayers,
          unregisterDeadlineHours,
          paymentAmount,
          pricingMode,
          withPositions,
          locationName,
          locationLink,
        })
        .where(eq(games.id, gameId))
        .returning();

      // Get all registrations for this game to notify users
      const registrations = await db
        .select({
          userId: gameRegistrations.userId,
        })
        .from(gameRegistrations)
        .where(eq(gameRegistrations.gameId, gameId));

      // If there are registrations, notify all registered users about the changes
      if (registrations.length > 0) {
        // Format dates for the notification
        const formattedNewDate = newDateTime.toLocaleDateString('en-GB', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          hour: '2-digit',
          minute: '2-digit',
        });

        const formattedOldDate = originalDateTime.toLocaleDateString('en-GB', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          hour: '2-digit',
          minute: '2-digit',
        });

        // Determine what changed for the notification message
        const dateTimeChanged =
          originalDateTime.getTime() !== newDateTime.getTime();
        const maxPlayersChanged = originalMaxPlayers !== maxPlayers;
        const paymentAmountChanged = originalPaymentAmount !== paymentAmount;
        const withPositionsChanged = originalWithPositions !== withPositions;

        // Create notification message based on what changed
        let notificationMessage = '🔄 <b>Game Update:</b>\n';
        const changes = [];

        if (dateTimeChanged) {
          changes.push(
            `The game has been rescheduled from ${formattedOldDate} to ${formattedNewDate}`,
          );
        }

        if (maxPlayersChanged) {
          changes.push(
            `The player limit has changed to ${maxPlayers} (was ${originalMaxPlayers})`,
          );
        }

        if (paymentAmountChanged) {
          const paymentAmountEuros = (paymentAmount / 100).toFixed(2);
          const originalPaymentAmountEuros = (
            originalPaymentAmount / 100
          ).toFixed(2);
          changes.push(
            `The payment amount is now €${paymentAmountEuros} (was €${originalPaymentAmountEuros})`,
          );
        }

        if (withPositionsChanged) {
          if (withPositions)
            changes.push(
              'The game will be played with positions according to the 5-1 system',
            );
          else changes.push('The game will be played without positions');
        }

        // Only send notification if there are actual changes
        if (changes.length > 0) {
          notificationMessage = '🔄 <b>Game Update:</b>\n\n';
          notificationMessage += changes
            .map((change) => `• ${change}`)
            .join('\n');

          // Get user details for all registered users
          for (const registration of registrations) {
            const userDetails = await db
              .select()
              .from(users)
              .where(eq(users.id, registration.userId));

            if (userDetails.length > 0 && userDetails[0].telegramId) {
              // Send notification to each registered user
              await sendTelegramNotification(
                userDetails[0].telegramId,
                notificationMessage,
              );
            }
          }
        }

        res.json(game[0]);
      }
    } catch (error) {
      console.error('Error updating game:', error);
      res.status(500).json({ error: 'Failed to update game' });
    }
  },
);

// Delete game and its registrations
router.delete(
  '/:gameId',
  telegramAuthMiddleware,
  adminAuthMiddleware,
  async (req, res) => {
    try {
      const gameId = parseInt(req.params.gameId);

      // Delete all registrations for this game first
      await db
        .delete(gameRegistrations)
        .where(eq(gameRegistrations.gameId, gameId));

      // Then delete the game itself
      const game = await db
        .delete(games)
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
  },
);

// Create payment requests for all unpaid players in a game (admin only)
router.post(
  '/:gameId/payment-requests',
  telegramAuthMiddleware,
  adminAuthMiddleware,
  async (req, res) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const gameId = parseInt(req.params.gameId);
      const password = req.body.password;

      // Check if game exists
      const game = await db.select().from(games).where(eq(games.id, gameId));
      if (!game.length) {
        return res.status(404).json({ error: 'Game not found' });
      }

      // Create payment requests for all unpaid players
      const result = await bunqService.createPaymentRequests(
        gameId,
        req.user.id,
        password,
      );

      if (result.success) {
        res.json({
          message: `Successfully created ${result.requestsCreated} payment requests`,
          requestsCreated: result.requestsCreated,
          errors: result.errors,
        });
      } else {
        res.status(500).json({
          error:
            result.errors.length == 1
              ? result.errors[0]
              : 'Failed to create payment requests',
          errors: result.errors,
        });
      }
    } catch (error) {
      console.error('Error creating payment requests:', error);
      res.status(500).json({ error: 'Failed to create payment requests' });
    }
  },
);

// Admin: Add a participant to a game (admin only)
router.post(
  '/:gameId/participants',
  telegramAuthMiddleware,
  adminAuthMiddleware,
  async (req, res) => {
    try {
      const gameId = parseInt(req.params.gameId);
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      // Check if game exists
      const game = await db.select().from(games).where(eq(games.id, gameId));
      if (!game.length) {
        return res.status(404).json({ error: 'Game not found' });
      }

      // Check if game is in the past
      const gameDateTime = new Date(game[0].dateTime);
      const now = new Date();
      if (gameDateTime > now) {
        return res
          .status(400)
          .json({ error: 'Cannot modify participants for future games' });
      }

      // Check if payment requests exist for this game
      const paymentRequestsExist = await db
        .select()
        .from(paymentRequests)
        .innerJoin(
          gameRegistrations,
          eq(paymentRequests.gameRegistrationId, gameRegistrations.id),
        )
        .where(eq(gameRegistrations.gameId, gameId))
        .limit(1);

      if (paymentRequestsExist.length > 0) {
        return res.status(400).json({
          error:
            'Cannot modify participants after payment requests have been sent',
        });
      }

      // Check if user exists
      const user = await db.select().from(users).where(eq(users.id, userId));
      if (!user.length) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Check if user is already registered
      const existingRegistration = await db
        .select()
        .from(gameRegistrations)
        .where(
          and(
            eq(gameRegistrations.gameId, gameId),
            eq(gameRegistrations.userId, userId),
          ),
        );

      if (existingRegistration.length > 0) {
        return res
          .status(400)
          .json({ error: 'User already registered for this game' });
      }

      // Add user to the game with timestamp set to REGISTRATION_OPEN_DAYS days before the game date
      const registrationOpenDate = new Date(gameDateTime);
      registrationOpenDate.setDate(
        registrationOpenDate.getDate() - REGISTRATION_OPEN_DAYS,
      );

      const registration = await db
        .insert(gameRegistrations)
        .values({
          gameId,
          userId,
          paid: false,
          createdAt: registrationOpenDate, // Set to X days before game date
        })
        .returning();

      res.status(201).json(registration[0]);
    } catch (error) {
      console.error('Error adding participant:', error);
      res.status(500).json({ error: 'Failed to add participant' });
    }
  },
);

// Admin: Remove a participant from a game (admin only)
router.delete(
  '/:gameId/participants/:userId',
  telegramAuthMiddleware,
  adminAuthMiddleware,
  async (req, res) => {
    try {
      const gameId = parseInt(req.params.gameId);
      const userId = parseInt(req.params.userId);

      // Check if game exists
      const game = await db.select().from(games).where(eq(games.id, gameId));
      if (!game.length) {
        return res.status(404).json({ error: 'Game not found' });
      }

      // Check if game is in the past
      const gameDateTime = new Date(game[0].dateTime);
      const now = new Date();
      if (gameDateTime > now) {
        return res
          .status(400)
          .json({ error: 'Cannot modify participants for future games' });
      }

      // Check if payment requests exist for this game
      const paymentRequestsExist = await db
        .select()
        .from(paymentRequests)
        .innerJoin(
          gameRegistrations,
          eq(paymentRequests.gameRegistrationId, gameRegistrations.id),
        )
        .where(eq(gameRegistrations.gameId, gameId))
        .limit(1);

      if (paymentRequestsExist.length > 0) {
        return res.status(400).json({
          error:
            'Cannot modify participants after payment requests have been sent',
        });
      }

      // Check if registration exists
      const registration = await db
        .select()
        .from(gameRegistrations)
        .where(
          and(
            eq(gameRegistrations.gameId, gameId),
            eq(gameRegistrations.userId, userId),
          ),
        );

      if (!registration.length) {
        return res.status(404).json({ error: 'Registration not found' });
      }

      // Delete the registration
      await db
        .delete(gameRegistrations)
        .where(
          and(
            eq(gameRegistrations.gameId, gameId),
            eq(gameRegistrations.userId, userId),
          ),
        );

      res.json({ message: 'Participant removed successfully' });
    } catch (error) {
      console.error('Error removing participant:', error);
      res.status(500).json({ error: 'Failed to remove participant' });
    }
  },
);

// Update a player's paid status for a game (admin only)
router.put(
  '/:gameId/players/:userId/paid',
  telegramAuthMiddleware,
  adminAuthMiddleware,
  async (req, res) => {
    try {
      const gameId = parseInt(req.params.gameId);
      const userId = parseInt(req.params.userId);

      // Check if game exists
      const game = await db.select().from(games).where(eq(games.id, gameId));
      if (!game.length) {
        return res.status(404).json({ error: 'Game not found' });
      }

      // Check if registration exists
      const registration = await db
        .select()
        .from(gameRegistrations)
        .where(
          and(
            eq(gameRegistrations.gameId, gameId),
            eq(gameRegistrations.userId, userId),
          ),
        );

      if (!registration.length) {
        return res.status(404).json({ error: 'Registration not found' });
      }

      // Get paid status from request body, default to true if not provided
      const { paid = true } = req.body;

      // Update paid status
      const success = await bunqService.updatePaidStatus(gameId, userId, paid);

      if (success) {
        const statusMessage = paid ? 'paid' : 'unpaid';
        res.json({
          message: `Successfully marked registration as ${statusMessage}`,
        });
      } else {
        res
          .status(400)
          .json({ error: 'Failed to update registration paid status' });
      }
    } catch (error) {
      console.error('Error updating registration paid status:', error);
      res
        .status(500)
        .json({ error: 'Failed to update registration paid status' });
    }
  },
);

// Check payment statuses for all unpaid games
router.post(
  '/check-payments',
  telegramAuthMiddleware,
  adminAuthMiddleware,
  async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { password } = req.body;
      if (!password) {
        return res.status(400).json({ error: 'Password is required' });
      }

      // 1. Get up to 10 unpaid past games
      const unpaidGames = await db
        .select()
        .from(games)
        .where(and(eq(games.fullyPaid, false), lt(games.dateTime, new Date())))
        .orderBy(desc(games.dateTime))
        .limit(10);

      if (unpaidGames.length === 0) {
        return res.json({
          success: true,
          message: 'No unpaid past games found',
          updatedPlayers: 0,
          updatedGames: 0,
          processedGames: 0,
        });
      }

      const gameIds = unpaidGames.map((g) => g.id);
      let totalUpdatedPlayers = 0;
      let totalUpdatedGames = 0;
      const errors: string[] = [];

      // 2. Get all unpaid registrations for these games with payment requests
      const unpaidRegistrations = await db
        .select({
          id: gameRegistrations.id,
          gameId: gameRegistrations.gameId,
          userId: gameRegistrations.userId,
          paid: gameRegistrations.paid,
          createdAt: gameRegistrations.createdAt,
          user: {
            id: users.id,
            telegramId: users.telegramId,
            username: users.username,
            avatarUrl: users.avatarUrl,
            isAdmin: users.isAdmin,
            createdAt: users.createdAt,
          },
          paymentRequest: {
            id: paymentRequests.id,
            paymentRequestId: paymentRequests.paymentRequestId,
            monetaryAccountId: paymentRequests.monetaryAccountId,
            paid: paymentRequests.paid,
            gameRegistrationId: paymentRequests.gameRegistrationId,
            paymentLink: paymentRequests.paymentLink,
            createdAt: paymentRequests.createdAt,
            lastCheckedAt: paymentRequests.lastCheckedAt,
          },
        })
        .from(gameRegistrations)
        .innerJoin(users, eq(users.id, gameRegistrations.userId))
        .leftJoin(
          paymentRequests,
          eq(paymentRequests.gameRegistrationId, gameRegistrations.id),
        )
        .where(
          and(
            inArray(gameRegistrations.gameId, gameIds),
            eq(gameRegistrations.paid, false),
          ),
        );

      // 3. Process each registration with a payment request
      for (const registration of unpaidRegistrations) {
        if (!registration.paymentRequest) continue;

        const isPaid = await bunqService.checkPaymentRequestStatus(
          registration.paymentRequest.paymentRequestId,
          registration.paymentRequest.monetaryAccountId,
          req.user.id, // admin user ID
          password,
        );

        if (isPaid) {
          await db
            .update(gameRegistrations)
            .set({ paid: true })
            .where(eq(gameRegistrations.id, registration.id));

          totalUpdatedPlayers++;

          // Check if all registrations for this game are now paid
          const unpaidCount = await db
            .select({ count: sql<number>`count(*)` })
            .from(gameRegistrations)
            .where(
              and(
                eq(gameRegistrations.gameId, registration.gameId),
                eq(gameRegistrations.paid, false),
              ),
            )
            .then((rows) => rows[0]?.count ?? 0);

          if (unpaidCount === 0) {
            await db
              .update(games)
              .set({ fullyPaid: true })
              .where(eq(games.id, registration.gameId));
            totalUpdatedGames++;
          }
        }
      }

      // 4. Check each game to see if all registrations are now paid
      for (const game of unpaidGames) {
        // Get all registrations ordered by creation time
        const allRegistrations = await db
          .select({
            id: gameRegistrations.id,
            paid: gameRegistrations.paid,
          })
          .from(gameRegistrations)
          .where(eq(gameRegistrations.gameId, game.id))
          .orderBy(gameRegistrations.createdAt);

        // Only consider the first maxPlayers registrations as non-waitlist
        const activeRegistrations = allRegistrations.slice(0, game.maxPlayers);

        // Count unpaid active registrations
        const unpaidCount = activeRegistrations.filter(
          (reg) => !reg.paid,
        ).length;

        if (unpaidCount === 0) {
          await db
            .update(games)
            .set({ fullyPaid: true })
            .where(eq(games.id, game.id));
          totalUpdatedGames++;
        }
      }

      res.json({
        success: true,
        message: `Payment check completed. Updated ${totalUpdatedPlayers} players and marked ${totalUpdatedGames} games as fully paid.`,
        updatedPlayers: totalUpdatedPlayers,
        updatedGames: totalUpdatedGames,
        processedGames: unpaidGames.length,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error) {
      console.error('Error checking payments:', error);
      res.status(500).json({
        error: 'Failed to check payments',
        message:
          error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  },
);

export default router;
