import { Router } from 'express';
import { db } from '../db';
import { games, gameRegistrations, users, paymentRequests } from '../db/schema';
import { gte, desc, inArray, eq, and, sql, lt, lte, asc, isNull } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { PricingMode } from '../types/PricingMode';

type PaymentRequest = InferSelectModel<typeof paymentRequests>;
import { telegramAuthMiddleware } from '../middleware/telegramAuth';
import { adminAuthMiddleware } from '../middleware/adminAuth';
import { sendTelegramNotification, sendGroupAnnouncement } from '../services/telegramService';
import { gameService } from '../services/gameService';
import { bunqService } from '../services/bunqService';
import { REGISTRATION_OPEN_DAYS } from '../constants';
import { getNotificationSubjectWithVerb, getNotificationSubjectLowercase } from '../utils/notificationUtils';
import { formatLocationSection } from '../utils/telegramMessageUtils';

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

      // After creating the game, if registration is already open and it's not a 5-1 game, announce it in the group
      try {
        const created = newGame[0];
        const gameDate = new Date(created.dateTime);
        const now = new Date();
        const registrationOpensAt = new Date(gameDate);
        registrationOpensAt.setDate(registrationOpensAt.getDate() - REGISTRATION_OPEN_DAYS);

        const isRegistrationOpen = now >= registrationOpensAt;
        const isFiveOne = !!created.withPositions;

        if (isRegistrationOpen && !isFiveOne) {
          const formattedDate = gameDate.toLocaleDateString('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit',
          });

          const locationText = formatLocationSection((created as any).locationName, (created as any).locationLink);
          const message = `<b>🏐 New Volleyball Game Registration Open!</b>\n\nRegistration is now open for the game on <b>${formattedDate}</b>${locationText}\n\nSpots are limited to ${created.maxPlayers} players. First come, first served!\n\nClick the button below to join:`;

          await sendGroupAnnouncement(message);
        }
      } catch (announceErr) {
        console.error('Failed to send creation announcement:', announceErr);
        // Non-blocking
      }

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
    const { guestName } = req.body; // Optional guest name from request body

    // Get user ID from authenticated user
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userId = req.user.id;

    // Prevent blocked users from registering (self or guest)
    if (req.user.blockReason) {
      return res.status(403).json({
        error: `You are blocked from registering for games: ${req.user.blockReason}`,
      });
    }

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
    // Allow both a self-registration (guestName IS NULL) and guest registrations (guestName NOT NULL)
    // Block duplicate self-registration, or duplicate guest registration with the same guestName
    const isSelfRegistration = !guestName;
    const existingRegistration = await db
      .select()
      .from(gameRegistrations)
      .where(
        and(
          eq(gameRegistrations.gameId, parseInt(gameId)),
          eq(gameRegistrations.userId, userId),
          isSelfRegistration
            ? isNull(gameRegistrations.guestName)
            : eq(gameRegistrations.guestName, guestName),
        ),
      );

    if (existingRegistration.length > 0) {
      return res.status(400).json({
        error: isSelfRegistration
          ? 'User already registered for this game'
          : 'This guest is already registered for this game',
      });
    }

    // Insert new registration - isWaitlist is now computed, not stored
    const registration = await db
      .insert(gameRegistrations)
      .values({
        gameId: parseInt(gameId),
        userId,
        guestName: guestName || null
      })
      .returning();

    // Get all registrations to determine if the user is on the waitlist
    const allRegistrations = await db
      .select()
      .from(gameRegistrations)
      .where(eq(gameRegistrations.gameId, parseInt(gameId)))
      .orderBy(gameRegistrations.createdAt);

    // Find position in registrations list for the newly inserted row
    const position = allRegistrations.findIndex((reg) => reg.id === registration[0].id);
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

      // Get the guest name from the registration for notifications
      const guestName = registration[0].guestName;
      
      // Send different notifications based on waitlist status
      if (isWaitlist) {
        // User is on waitlist
        const subject = getNotificationSubjectWithVerb(guestName, 'have');
        await sendTelegramNotification(
          userDetails[0].telegramId,
          `⏳ ${subject} been added to the waiting list for the volleyball game on ${formattedDate}. We'll notify you if a spot becomes available! Position on waitlist: ${
            position - game[0].maxPlayers + 1
          }`,
        );
      } else {
        // User is a direct participant
        const subject = getNotificationSubjectWithVerb(guestName, 'are');
        await sendTelegramNotification(
          userDetails[0].telegramId,
          `✅ ${subject} registered for the volleyball game on ${formattedDate}. See you there! 🏐`,
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
    const { guestName } = req.body as { guestName?: string };

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

    // Find target registration index: self if no guestName, otherwise specific guest
    const targetIndex = allRegistrations.findIndex(
      (reg) =>
        reg.userId === userId && (guestName
          ? reg.guestName === guestName
          : reg.guestName === null || reg.guestName === undefined),
    );
    if (targetIndex === -1) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    // Determine if the target registration is on the waitlist based on order
    const isWaitlist = targetIndex >= game[0].maxPlayers;

    // If not on waitlist, enforce timing restriction: can only leave up to unregisterDeadlineHours before the game
    if (!isWaitlist) {
      const gameDateTime = new Date(game[0].dateTime);
      const now = new Date();
      const deadlineHours = game[0].unregisterDeadlineHours || 5; // Default to 5 hours if not set
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

    // Get user details and registration details (including guest name) before deleting
    const userDetails = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    const registrationDetails = await db
      .select()
      .from(gameRegistrations)
      .where(
        and(
          eq(gameRegistrations.gameId, parseInt(gameId)),
          eq(gameRegistrations.userId, userId),
          guestName
            ? eq(gameRegistrations.guestName, guestName)
            : isNull(gameRegistrations.guestName),
        ),
      );

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
          guestName
            ? eq(gameRegistrations.guestName, guestName)
            : isNull(gameRegistrations.guestName),
        ),
      );

    // Send notification to the user who left
    if (userDetails.length > 0 && registrationDetails.length > 0) {
      const guestName = registrationDetails[0].guestName;
      const subject = getNotificationSubjectWithVerb(guestName, 'have');
      await sendTelegramNotification(
        userDetails[0].telegramId,
        `❌ ${subject} been unregistered from the volleyball game on ${formattedDate}. Hope to see you at another game soon! 🏐`,
      );
    }

    // Check if someone from the waitlist is being promoted
    if (!isWaitlist) {
      // Get all registrations again to find who's being promoted
      const updatedRegistrations = await db
        .select({
          userId: gameRegistrations.userId,
          guestName: gameRegistrations.guestName,
          createdAt: gameRegistrations.createdAt,
        })
        .from(gameRegistrations)
        .where(eq(gameRegistrations.gameId, parseInt(gameId)))
        .orderBy(gameRegistrations.createdAt);

      // If there are more registrations than maxPlayers, someone is being promoted
      if (updatedRegistrations.length >= game[0].maxPlayers) {
        // The user at position maxPlayers - 1 is now the last non-waitlisted player
        const promotedRegistration = updatedRegistrations[game[0].maxPlayers - 1];
        const promotedUserId = promotedRegistration.userId;
        const promotedGuestName = promotedRegistration.guestName;

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
          const subject = getNotificationSubjectWithVerb(promotedGuestName, 'have');
          await sendTelegramNotification(
            promotedUser[0].telegramId,
            `🎉 Good news! ${subject} been moved from the waiting list to the participants list for the volleyball game on ${formattedDate}. See you there! 🏐`,
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
        guestName: gameRegistrations.guestName,
        paid: gameRegistrations.paid,
        createdAt: gameRegistrations.createdAt,
        user: {
          id: users.id,
          telegramId: users.telegramId,
          displayName: users.displayName,
          telegramUsername: users.telegramUsername,
          avatarUrl: users.avatarUrl,
          blockReason: users.blockReason,
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

    // Get current date for filtering
    const currentDate = new Date();
    // Consider a game as past only after 6 hours from its start time
    const sixHoursMs = 6 * 60 * 60 * 1000;
    const nowMinusSixHours = new Date(currentDate.getTime() - sixHoursMs);
    let filteredGames;

    if (showPast) {
      // For past games: game date is before current date
      if (showAll) {
        // Show all past games (started more than 6 hours ago)
        filteredGames = await db
          .select()
          .from(games)
          .where(lt(games.dateTime, nowMinusSixHours))
          .orderBy(desc(games.dateTime));
      } else {
        // Get past games (older than 6 hours) with unpaid participants
        filteredGames = await db
          .select()
          .from(games)
          .where(
            and(lt(games.dateTime, nowMinusSixHours), eq(games.fullyPaid, false)),
          )
          .orderBy(desc(games.dateTime));
      }
    } else {
      // For upcoming games: game date is on or after current date
      if (showAll) {
        // Show all upcoming games (from 6 hours before now and into the future)
        filteredGames = await db
          .select()
          .from(games)
          .where(gte(games.dateTime, nowMinusSixHours))
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
              // Include games that started within the last 6 hours as upcoming
              gte(games.dateTime, nowMinusSixHours),
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

        // A game is in the past only after 6 hours since it started
        const isGameInPast = new Date(game.dateTime) < nowMinusSixHours;
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
            // Load only the user's own registration (exclude their guests) using SQL filter
            const selfRegistrationRow = await db
              .select()
              .from(gameRegistrations)
              .where(
                and(
                  eq(gameRegistrations.gameId, game.id),
                  eq(gameRegistrations.userId, userId),
                  isNull(gameRegistrations.guestName),
                ),
              )
              .limit(1);

            const selfRegistration = selfRegistrationRow[0];

            const isUserRegistered = !!selfRegistration;
            let userRegistration: (InferSelectModel<typeof gameRegistrations> & { isWaitlist: boolean }) | null = null;

            if (selfRegistration) {
              // Get all registrations to determine waitlist status
              const allRegistrations = await db
                .select()
                .from(gameRegistrations)
                .where(eq(gameRegistrations.gameId, game.id))
                .orderBy(gameRegistrations.createdAt);

              // Find position for the self-registration only (exclude guests)
              const position = allRegistrations.findIndex(
                (reg) => reg.userId === userId && (reg.guestName === null || reg.guestName === undefined),
              );
              const isWaitlist = position >= game.maxPlayers;

              userRegistration = {
                ...selfRegistration,
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

        // Create notification message based on what changed
        let notificationMessage = '🔄 <b>Game Update:</b>\n';
        const changes = [];

        if (dateTimeChanged) {
          changes.push(
            `The game has been rescheduled from ${formattedOldDate} to ${formattedNewDate}`,
          );
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
      const { userId, guestName } = req.body;

      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      // Check if game exists
      const game = await db.select().from(games).where(eq(games.id, gameId));
      if (!game.length) {
        return res.status(404).json({ error: 'Game not found' });
      }

      // Allow modifications only when the game is considered past (6 hours after start)
      const gameDateTime = new Date(game[0].dateTime);
      const now = new Date();
      const sixHoursAfterStart = new Date(gameDateTime.getTime() + 6 * 60 * 60 * 1000);
      if (now < sixHoursAfterStart) {
        return res
          .status(400)
          .json({ error: 'Cannot modify participants for future or ongoing games' });
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
      // If guestName is provided, allow multiple registrations per user but prevent duplicates for the same guest
      // If no guestName, ensure there is no existing self-registration (guestName IS NULL)
      const existingRegistration = await db
        .select()
        .from(gameRegistrations)
        .where(
          and(
            eq(gameRegistrations.gameId, gameId),
            eq(gameRegistrations.userId, userId),
            guestName ? eq(gameRegistrations.guestName, guestName) : isNull(gameRegistrations.guestName),
          ),
        );

      if (existingRegistration.length > 0) {
        return res
          .status(400)
          .json({
            error: guestName
              ? 'This guest is already registered for this game'
              : 'User already registered for this game',
          });
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
          guestName: guestName ?? null,
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
      const { guestName } = req.body;

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

      const registration = await db
        .select()
        .from(gameRegistrations)
        .where(
          and(
            eq(gameRegistrations.gameId, gameId),
            eq(gameRegistrations.userId, userId),
            guestName
              ? eq(gameRegistrations.guestName, guestName)
              : isNull(gameRegistrations.guestName),
          ),
        );

      if (!registration.length) {
        return res.status(404).json({ error: 'Registration not found' });
      }

      // Delete the registration
      await db
        .delete(gameRegistrations)
        .where(eq(gameRegistrations.id, registration[0].id));

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
            displayName: users.displayName,
            telegramUsername: users.telegramUsername,
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

// Get last used guest name for a user (excluding current game)
router.get(
  '/:gameId/last-guest-name',
  telegramAuthMiddleware,
  async (req, res) => {
    try {
      const { gameId } = req.params;
      
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      const userId = req.user.id;
      const currentGameId = parseInt(gameId);
      
      // Get user's existing guest names for current game to exclude them
      const currentGameGuests = await db
        .select({ guestName: gameRegistrations.guestName })
        .from(gameRegistrations)
        .where(
          and(
            eq(gameRegistrations.gameId, currentGameId),
            eq(gameRegistrations.userId, userId),
            sql`${gameRegistrations.guestName} IS NOT NULL`
          )
        );
      
      const existingGuestNames = currentGameGuests
        .map(reg => reg.guestName)
        .filter(name => name !== null) as string[];
      
      // Find the most recent guest name from other games that's not already used in current game
      const lastGuestQuery = db
        .select({ 
          guestName: gameRegistrations.guestName,
          createdAt: gameRegistrations.createdAt 
        })
        .from(gameRegistrations)
        .where(
          and(
            eq(gameRegistrations.userId, userId),
            sql`${gameRegistrations.gameId} != ${currentGameId}`,
            sql`${gameRegistrations.guestName} IS NOT NULL`
          )
        )
        .orderBy(desc(gameRegistrations.createdAt))
        .limit(10); // Get last 10 to filter through
      
      const recentGuests = await lastGuestQuery;
      
      // Find first guest name that's not already used in current game
      const lastGuestName = recentGuests.find(guest => 
        guest.guestName && !existingGuestNames.includes(guest.guestName)
      )?.guestName || null;
      
      res.json({ lastGuestName });
    } catch (error) {
      console.error('Error fetching last guest name:', error);
      res.status(500).json({ error: 'Failed to fetch last guest name' });
    }
  },
);

export default router;
