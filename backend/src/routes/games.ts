import { Router } from 'express';
import { db } from '../db';
import { games, gameRegistrations, users, gameAdministrators, priorityPlayers } from '../db/schema';
import { gte, desc, inArray, eq, and, sql, lt, lte, asc, isNull, or } from 'drizzle-orm';
import type { InferSelectModel } from 'drizzle-orm';
import { notifyUser } from '../services/notificationService';
import { checkTelegramGroupMembership, sendLateSignoutGroupNotification, LATE_SIGNOUT_THRESHOLD_HOURS } from '../services/telegramService';
import { getNotificationSubjectWithVerb } from '../utils/notificationUtils';
import { formatGameDate } from '../utils/dateUtils';
import { isUserAssignedToGameById } from '../middleware/adminOrAssignedAdmin';
import { getUserSelectFields } from '../utils/dbQueryUtils';
import {
  adminAssignmentWithPositionsForGameFormat,
  asGameFormat,
  usesPriorityPlayerWindows,
  type GameFormat,
} from '../domain/gameFormat';
import {
  GAME_CATEGORIES,
  GUEST_REGISTRATION_OPEN_DAYS,
  REGISTRATION_OPEN_DAYS,
  classifyGame,
  guestRegistrationOpensAt,
  isGuestRegistrationOpen,
  registrationOpenDaysFor,
  registrationOpensAt,
  isWaitlistAtIndex,
  type GameCategory,
} from '../domain/gamePolicy';
import {
  findRegistrationIndex,
  getUserById,
  mapRegistrationsWithWaitlist,
  placeRegistration,
  removeRegistration,
} from '../services/registrationService';
import {
  canUserAcceptSpotOfferOnGame,
  computeSelfRegistrationEligibility,
  getPlayerLevelForUser,
  userHasSelfRegistrationOnGame,
} from '../utils/registrationEligibility';
import {
  acceptSpotOffer,
  cancelMySpotOffer,
  createSpotOffer,
  getSpotOfferDetailFields,
} from '../services/spotOfferService';
const router = Router();

// Helper function to check if a user is a priority player for a game
async function isUserPriorityPlayerForGame(
  userId: number,
  game: { dateTime: Date | string; gameFormat: GameFormat | string }
): Promise<boolean> {
  const format = asGameFormat(String(game.gameFormat));
  if (!usesPriorityPlayerWindows(format)) {
    return false;
  }

  // Get game's day of week (Monday=0, Tuesday=1, ..., Sunday=6)
  const gameDate = new Date(game.dateTime);
  let dayOfWeek = gameDate.getDay();
  // Convert JavaScript day (0=Sunday, 1=Monday, ..., 6=Saturday) to Monday=0 format
  dayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  // Check if user is a priority player for the matching game administrator assignment
  // Join gameAdministrators with priorityPlayers in a single query
  const priorityPlayerCheck = await db
    .select()
    .from(priorityPlayers)
    .innerJoin(
      gameAdministrators,
      eq(priorityPlayers.gameAdministratorId, gameAdministrators.id)
    )
    .where(
      and(
        eq(gameAdministrators.dayOfWeek, dayOfWeek),
        eq(
          gameAdministrators.withPositions,
          adminAssignmentWithPositionsForGameFormat(format),
        ),
        eq(priorityPlayers.userId, userId)
      )
    )
    .limit(1);

  return priorityPlayerCheck.length > 0;
}

async function getRegistrationOpenDays(
  userId: number,
  game: { dateTime: Date | string; gameFormat: GameFormat | string },
  isGuest: boolean
): Promise<number> {
  if (isGuest) {
    return registrationOpenDaysFor({
      isGuest: true,
      gameFormat: game.gameFormat,
      isPriorityPlayer: false,
    });
  }

  const isPriorityPlayer = usesPriorityPlayerWindows(asGameFormat(String(game.gameFormat)))
    ? await isUserPriorityPlayerForGame(userId, game)
    : false;

  return registrationOpenDaysFor({
    isGuest: false,
    gameFormat: game.gameFormat,
    isPriorityPlayer,
  });
}

// Register user for a game
router.post('/:gameId/register', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { guestName, bringingTheBall } = req.body;

    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userId = req.user.id;

    if (req.user.blockReason) {
      return res.status(403).json({
        error: `You are blocked from registering for games: ${req.user.blockReason}`,
      });
    }

    if (req.user.telegramId) {
      const inGroup = await checkTelegramGroupMembership(req.user.telegramId);
      if (!inGroup) {
        return res.status(403).json({
          error: 'To register for games you must join our Telegram group.',
          code: 'TELEGRAM_GROUP_REQUIRED',
        });
      }
    }

    const game = await db
      .select()
      .from(games)
      .where(eq(games.id, parseInt(gameId)));
    if (!game.length) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const isPriorityPlayer = await isUserPriorityPlayerForGame(userId, game[0]);
    const result = await placeRegistration({
      game: game[0],
      userId,
      guestName: guestName || null,
      bringingTheBall: bringingTheBall || false,
      isPriorityPlayer,
    });

    if (!result.ok) {
      return res.status(result.status).json({
        error: result.error,
        ...(result.registrationOpensAt
          ? { registrationOpensAt: result.registrationOpensAt }
          : {}),
        ...(result.gameDateTime ? { gameDateTime: result.gameDateTime } : {}),
      });
    }

    const userDetails = await getUserById(userId);
    if (userDetails) {
      const formattedDate = formatGameDate(new Date(game[0].dateTime));
      const regGuestName = result.registration.guestName;
      if (result.isWaitlist) {
        const subject = getNotificationSubjectWithVerb(regGuestName, 'have');
        await notifyUser(
          userDetails,
          `⏳ ${subject} been added to the waiting list for the volleyball game on ${formattedDate}. We'll notify you if a spot becomes available! Position on waitlist: ${result.position - game[0].maxPlayers + 1}`,
          game[0].id,
          false,
        );
      } else {
        const subject = getNotificationSubjectWithVerb(regGuestName, 'are');
        await notifyUser(
          userDetails,
          `✅ ${subject} registered for the volleyball game on ${formattedDate}. See you there! 🏐`,
          game[0].id,
          false,
        );
      }
    }

    res.status(201).json(result.registration);
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

    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userId = req.user.id;

    const game = await db
      .select()
      .from(games)
      .where(eq(games.id, parseInt(gameId)));
    if (!game.length) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const result = await removeRegistration({
      game: game[0],
      userId,
      guestName,
    });

    if (!result.ok) {
      return res.status(result.status).json({
        error: result.error,
        ...(result.gameDateTime ? { gameDateTime: result.gameDateTime } : {}),
        ...(result.deadline ? { deadline: result.deadline } : {}),
      });
    }

    const formattedDate = formatGameDate(new Date(game[0].dateTime));
    const userDetails = await getUserById(userId);

    if (userDetails && result.registrationDetails) {
      const subject = getNotificationSubjectWithVerb(
        result.registrationDetails.guestName,
        'have',
      );
      await notifyUser(
        userDetails,
        `❌ ${subject} been unregistered from the volleyball game on ${formattedDate}. Hope to see you at another game soon! 🏐`,
        game[0].id,
        false,
      );
    }

    if (result.removedWasOnRoster) {
      if (result.promoted) {
        const promotedUser = await getUserById(result.promoted.userId);
        if (promotedUser) {
          const subject = getNotificationSubjectWithVerb(
            result.promoted.guestName,
            'have',
          );
          await notifyUser(
            promotedUser,
            `🎉 Good news! ${subject} been moved from the waiting list to the participants list for the volleyball game on ${formattedDate}. See you there! 🏐`,
            game[0].id,
          );
        }
      } else {
        const gameDateTime = new Date(game[0].dateTime);
        const now = new Date();
        const hoursUntilGame =
          (gameDateTime.getTime() - now.getTime()) / 3_600_000;
        if (hoursUntilGame >= 0 && hoursUntilGame < LATE_SIGNOUT_THRESHOLD_HOURS) {
          sendLateSignoutGroupNotification(
            gameDateTime,
            game[0].id,
            game[0].gameFormat,
          ).catch(
            (err) => console.error('Late sign-out notification failed:', err),
          );
        }
      }
    }

    res.json({ message: 'Successfully unregistered from game' });
  } catch (error) {
    console.error('Error unregistering from game:', error);
    res.status(500).json({ error: 'Failed to unregister from game' });
  }
});

// Create a spot offer (self or guest) — only after leave deadline
router.post('/:gameId/spot-offers', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const gameId = parseInt(req.params.gameId);
    const { guestName } = req.body as { guestName?: string };

    const game = await db.select().from(games).where(eq(games.id, gameId));
    if (!game.length) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const result = await createSpotOffer({
      game: game[0],
      userId: req.user.id,
      guestName,
    });

    if (!result.ok) {
      return res.status(result.status).json({ error: result.error, code: result.code });
    }

    res.status(201).json({
      offer: result.offer,
      enteredPublic: result.enteredPublic,
    });
  } catch (error) {
    console.error('Error creating spot offer:', error);
    res.status(500).json({ error: 'Failed to create spot offer' });
  }
});

// Cancel caller's open offer for self or a specific guest
router.delete('/:gameId/spot-offers/mine', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const gameId = parseInt(req.params.gameId);
    const { guestName } = (req.body || {}) as { guestName?: string };

    const result = await cancelMySpotOffer({
      gameId,
      userId: req.user.id,
      guestName,
    });

    if (!result.ok) {
      return res.status(result.status).json({ error: result.error, code: result.code });
    }

    res.json({ message: 'Spot offer cancelled' });
  } catch (error) {
    console.error('Error cancelling spot offer:', error);
    res.status(500).json({ error: 'Failed to cancel spot offer' });
  }
});

// Accept an open spot offer — any eligible user; invite row never required
router.post('/:gameId/spot-offers/:offerId/accept', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const gameId = parseInt(req.params.gameId);
    const offerId = parseInt(req.params.offerId);

    const game = await db.select().from(games).where(eq(games.id, gameId));
    if (!game.length) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const result = await acceptSpotOffer({
      game: game[0],
      offerId,
      acceptorUserId: req.user.id,
    });

    if (!result.ok) {
      return res.status(result.status).json({ error: result.error, code: result.code });
    }

    res.json({
      message: 'Spot offer accepted',
      offer: result.offer,
      registrationId: result.registrationId,
    });
  } catch (error) {
    console.error('Error accepting spot offer:', error);
    res.status(500).json({ error: 'Failed to accept spot offer' });
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
        user: getUserSelectFields(),
      })
      .from(gameRegistrations)
      .innerJoin(users, eq(gameRegistrations.userId, users.id))
      .where(eq(gameRegistrations.gameId, parseInt(gameId)))
      .orderBy(gameRegistrations.createdAt); // Order by registration time

    const registrationsWithWaitlistStatus = mapRegistrationsWithWaitlist(
      registrations,
      game[0].maxPlayers,
    );

    let isAssignedAdmin = await isUserAssignedToGameById(req.user.id, parseInt(gameId));

    // Check if user is a priority player for this game (for frontend display)
    const isPriorityPlayer = await isUserPriorityPlayerForGame(req.user.id, game[0]);
    const registrationOpenDays = await getRegistrationOpenDays(req.user.id, game[0], false);
    const baseRegistrationOpensAt = registrationOpensAt(game[0].dateTime, registrationOpenDays);
    const now = new Date();
    const playerLevel = await getPlayerLevelForUser(req.user.id);
    const hasExistingSelfRegistration = await userHasSelfRegistrationOnGame(
      req.user.id,
      parseInt(gameId),
    );
    const eligibility = computeSelfRegistrationEligibility({
      game: game[0],
      playerLevel,
      now,
      isGuestRegistration: false,
      hostCanSelfRegister: true,
      hasExistingSelfRegistration,
      baseRegistrationOpensAt,
    });
    const guestOpensAt = guestRegistrationOpensAt(game[0].dateTime);

    const spotOfferFields = await getSpotOfferDetailFields(
      parseInt(gameId),
      req.user.id,
    );
    // Open offers must be taken before self-join / waitlist / guest add
    const hasOpenSpotOffer = spotOfferFields.activeSpotOffers.length > 0;
    const canSelfRegister = eligibility.canSelfRegister && !hasOpenSpotOffer;
    const canRegisterGuest =
      canSelfRegister && isGuestRegistrationOpen(game[0].dateTime, now);
    const canAcceptSpotOffer = await canUserAcceptSpotOfferOnGame({
      game: game[0],
      userId: req.user.id,
    });

    // Ensure legacy field not leaked; respond with new fields
    const { locationAddress: _deprecated, ...restGame } = game[0] as any;
    res.json({
      ...restGame,
      registrations: registrationsWithWaitlistStatus,
      collectorUser,
      isAssignedAdmin,
      category: classifyGame(game[0]),
      registrationOpenDays,
      registrationOpensAt: eligibility.registrationOpensAt.toISOString(),
      canSelfRegister,
      guestRegistrationOpensAt: guestOpensAt.toISOString(),
      guestRegistrationOpenDays: GUEST_REGISTRATION_OPEN_DAYS,
      canRegisterGuest,
      isPriorityPlayer,
      activeSpotOffers: spotOfferFields.activeSpotOffers,
      myOffers: spotOfferFields.myOffers,
      canAcceptSpotOffer,
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
    
    // Parse categories - expect an array of strings
    const categories = req.query.categories as GameCategory[] | undefined;

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
                assignment.withPositions ===
                  adminAssignmentWithPositionsForGameFormat(asGameFormat(game.gameFormat))
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

    // Apply category filter if specified (only for upcoming games)
    if (categories && categories.length > 0 && !showPast) {
      const validSelectedCategories = categories.filter((cat) =>
        GAME_CATEGORIES.includes(cat),
      );

      if (validSelectedCategories.length > 0) {
        filteredGames = filteredGames.filter((game) => {
          const gameCategory = classifyGame(game);
          return validSelectedCategories.includes(gameCategory);
        });
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
          category: classifyGame(game),
          guestRegistrationOpensAt: guestRegistrationOpensAt(game.dateTime).toISOString(),
          guestRegistrationOpenDays: GUEST_REGISTRATION_OPEN_DAYS,
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

              const position = findRegistrationIndex(allRegistrations, {
                userId,
                guestName: null,
              });
              const isWaitlist = isWaitlistAtIndex(position, game.maxPlayers);

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
