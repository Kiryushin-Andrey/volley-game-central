import { Router } from 'express';
import { db } from '../db';
import { games, gameRegistrations, users, gameAdministrators } from '../db/schema';
import { gte, desc, inArray, eq, and, sql, lt, lte, asc, isNull, or } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { REGISTRATION_OPEN_DAYS } from '../constants';
import { notifyUser } from '../services/notificationService';
import { getNotificationSubjectWithVerb } from '../utils/notificationUtils';
import { formatGameDate } from '../utils/dateUtils';
import { isUserAssignedToGameById } from '../middleware/adminOrAssignedAdmin';

const router = Router();

// Register user for a game
router.post('/:gameId/register', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { guestName, bringingTheBall } = req.body; // Optional guest name and bringingTheBall from request body

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
        guestName: guestName || null,
        bringingTheBall: bringingTheBall || false
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
      const formattedDate = formatGameDate(gameDate);

      // Get the guest name from the registration for notifications
      const guestName = registration[0].guestName;

      // Send different notifications based on waitlist status
      if (isWaitlist) {
        const subject = getNotificationSubjectWithVerb(guestName, 'have');
        await notifyUser(
          userDetails[0],
          `⏳ ${subject} been added to the waiting list for the volleyball game on ${formattedDate}. We'll notify you if a spot becomes available! Position on waitlist: ${position - game[0].maxPlayers + 1}`,
          { allowSms: false }
        );
      } else {
        const subject = getNotificationSubjectWithVerb(guestName, 'are');
        await notifyUser(
          userDetails[0],
          `✅ ${subject} registered for the volleyball game on ${formattedDate}. See you there! 🏐`,
          { allowSms: false }
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
router.delete('/:gameId/register', async (req, res) => {
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
    const formattedDate = formatGameDate(gameDate);

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
      await notifyUser(
        userDetails[0],
        `❌ ${subject} been unregistered from the volleyball game on ${formattedDate}. Hope to see you at another game soon! 🏐`,
        { allowSms: false }
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
          const formattedDate = formatGameDate(gameDate);

          // Send notification to the promoted user
          const subject = getNotificationSubjectWithVerb(promotedGuestName, 'have');
          await notifyUser(
            promotedUser[0],
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
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { gameId } = req.params;
    const game = await db
      .select()
      .from(games)
      .where(eq(games.id, parseInt(gameId)));

    if (!game.length) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Get collector user information if collectorUserId is set
    let collectorUser = null;
    if (game[0].collectorUserId) {
      const collectorResult = await db
        .select({
          id: users.id,
          displayName: users.displayName,
          telegramUsername: users.telegramUsername,
          avatarUrl: users.avatarUrl,
        })
        .from(users)
        .where(eq(users.id, game[0].collectorUserId));
      
      if (collectorResult.length > 0) {
        collectorUser = collectorResult[0];
      }
    }

    // Get registrations with user information joined
    const registrations = await db
      .select({
        id: gameRegistrations.id,
        gameId: gameRegistrations.gameId,
        userId: gameRegistrations.userId,
        guestName: gameRegistrations.guestName,
        paid: gameRegistrations.paid,
        bringingTheBall: gameRegistrations.bringingTheBall,
        createdAt: gameRegistrations.createdAt,
        user: {
          id: users.id,
          telegramId: users.telegramId,
          displayName: users.displayName,
          telegramUsername: users.telegramUsername,
          avatarUrl: users.avatarUrl,
          blockReason: users.blockReason,
          phoneNumber: users.phoneNumber,
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

    let isAssignedAdmin = await isUserAssignedToGameById(req.user.id, parseInt(gameId));

    // Ensure legacy field not leaked; respond with new fields
    const { locationAddress: _deprecated, ...restGame } = game[0] as any;
    res.json({
      ...restGame,
      registrations: registrationsWithWaitlistStatus,
      collectorUser,
      isAssignedAdmin,
    });
  } catch (error) {
    console.error('Error fetching game:', error);
    res.status(500).json({ error: 'Failed to fetch game' });
  }
});

router.get('/', async (req, res) => {
  try {
    // Parse query parameters
    const showPast = req.query.showPast === 'true';
    const showAll = req.query.showAll === 'true';

    // Get current date for filtering
    const currentDate = new Date();
    const userId = req.user?.id;
    const isAdmin = req.user?.isAdmin || false;
    
    let filteredGames: InferSelectModel<typeof games>[];

    if (showPast) {
      // For past games: game date is strictly before now
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

      // For non-admin users, filter games based on their administrator assignments
      if (!isAdmin && userId) {
        // Get user's administrator assignments
        const userAssignments = await db
          .select()
          .from(gameAdministrators)
          .where(eq(gameAdministrators.userId, userId));

        if (userAssignments.length > 0) {
          // Filter games to only show those matching user's assignments
          filteredGames = filteredGames.filter((game) => {
            const gameDate = new Date(game.dateTime);
            // Get day of week (0=Monday, 6=Sunday)
            // JavaScript: 0=Sunday, 1=Monday, ..., 6=Saturday
            let dayOfWeek = gameDate.getDay();
            dayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to Monday=0 format

            return userAssignments.some(
              (assignment) =>
                assignment.dayOfWeek === dayOfWeek &&
                assignment.withPositions === game.withPositions
            );
          });
        } else {
          // User has no assignments, return empty array for past games
          filteredGames = [];
        }
      }
    } else {
      // For upcoming games: game date is on or after now
      if (showAll) {
        // Show all upcoming games (now and into the future)
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
              // Include games starting from now until registration window end
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

        // A game is in the past as soon as its start time is before now
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

// Get last used guest name for a user (excluding current game)
router.get(
  '/:gameId/last-guest-name',
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
