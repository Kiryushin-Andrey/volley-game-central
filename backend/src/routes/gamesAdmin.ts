import { Router } from 'express';
import { db } from '../db';
import { games, gameRegistrations, users, paymentRequests } from '../db/schema';
import { gte, desc, inArray, eq, and, sql, lt, lte, asc, isNull } from 'drizzle-orm';
import { PricingMode } from '../types/PricingMode';
import { sendGroupAnnouncement } from '../services/telegramService';
import { notifyUser } from '../services/notificationService';
import { gameService } from '../services/gameService';
import { bunqService } from '../services/bunqService';
import { REGISTRATION_OPEN_DAYS } from '../constants';
import { formatLocationSection } from '../utils/telegramMessageUtils';
import { getNotificationSubjectWithVerb } from '../utils/notificationUtils';
import { formatGameDate } from '../utils/dateUtils';

const router = Router();

// Calculate default settings for a new game
router.get('/defaults', async (req, res) => {
  try {
    const { defaultDateTime, defaultLocationName, defaultLocationLink, defaultPaymentAmount, defaultPricingMode, defaultWithPositions } =
      await gameService.calculateDefaultGameSettings();
    res.json({
      defaultDateTime,
      defaultLocationName,
      defaultLocationLink,
      defaultPaymentAmount,
      defaultPricingMode,
      defaultWithPositions,
    });
  } catch (error) {
    console.error('Error calculating default date time:', error);
    res.status(500).json({ error: 'Failed to calculate default date time' });
  }
});

// Create a new game
router.post('/', async (req, res) => {
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
      return res.status(400).json({ error: 'dateTime and maxPlayers are required' });
    }

    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Authentication required to create a game' });
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
        const formattedDate = formatGameDate(gameDate);

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
});

// Update game details
router.put('/:gameId', async (req, res) => {
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

    if (!dateTime || !maxPlayers) {
      return res.status(400).json({ error: 'dateTime and maxPlayers are required' });
    }

    const existingGame = await db.select().from(games).where(eq(games.id, gameId));
    if (!existingGame.length) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const originalDateTime = new Date(existingGame[0].dateTime);
    const newDateTime = new Date(dateTime);
    const originalMaxPlayers = existingGame[0].maxPlayers;
    const capacityIncreased = maxPlayers > originalMaxPlayers;

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

    // Fetch all registrations with user details once for both capacity increase and date change notifications
    const allRegistrations = await db
      .select({
        userId: gameRegistrations.userId,
        guestName: gameRegistrations.guestName,
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
      })
      .from(gameRegistrations)
      .innerJoin(users, eq(users.id, gameRegistrations.userId))
      .where(eq(gameRegistrations.gameId, gameId))
      .orderBy(gameRegistrations.createdAt);

    // Send notifications to promoted users
    if (capacityIncreased && allRegistrations.length > originalMaxPlayers) {
      const promotedUsers = allRegistrations.slice(originalMaxPlayers, maxPlayers);

      const gameDate = new Date(newDateTime);
      const formattedDate = formatGameDate(gameDate);
      for (const promotedRegistration of promotedUsers) {
        const subject = getNotificationSubjectWithVerb(promotedRegistration.guestName, 'have');
        await notifyUser(
          promotedRegistration.user,
          `🎉 Great news! The game capacity has been increased and ${subject} been moved from the waiting list to the participants list for the volleyball game on ${formattedDate}. See you there! 🏐`,
        );
      }
    }

    if (allRegistrations.length > 0) {
      const formattedNewDate = formatGameDate(newDateTime);
      const formattedOldDate = formatGameDate(originalDateTime);

      const dateTimeChanged = originalDateTime.getTime() !== newDateTime.getTime();

      if (dateTimeChanged) {
        const notificationMessage = `🔄 <b>Game Update:</b>\n\n• The game has been rescheduled from ${formattedOldDate} to ${formattedNewDate}`;

        for (const registration of allRegistrations) {
          await notifyUser(registration.user, notificationMessage);
        }
      }

      res.json(game[0]);
    }
  } catch (error) {
    console.error('Error updating game:', error);
    res.status(500).json({ error: 'Failed to update game' });
  }
});

// Delete game and its registrations
router.delete('/:gameId', async (req, res) => {
  try {
    const gameId = parseInt(req.params.gameId);

    await db.delete(gameRegistrations).where(eq(gameRegistrations.gameId, gameId));

    const game = await db.delete(games).where(eq(games.id, gameId)).returning();
    if (!game.length) {
      return res.status(404).json({ error: 'Game not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting game:', error);
    res.status(500).json({ error: 'Failed to delete game' });
  }
});

// Create payment requests for all unpaid players in a game
router.post('/:gameId/payment-requests', async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const gameId = parseInt(req.params.gameId);
    const password = req.body.password;

    const game = await db.select().from(games).where(eq(games.id, gameId));
    if (!game.length) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const result = await bunqService.createPaymentRequests(gameId, req.user.id, password);

    if (result.success) {
      // Update the game to track who collected payments
      await db.update(games).set({ collectorUserId: req.user.id }).where(eq(games.id, gameId));
      
      res.json({
        message: `Successfully created ${result.requestsCreated} payment requests`,
        requestsCreated: result.requestsCreated,
        errors: result.errors,
      });
    } else {
      res.status(500).json({
        error: result.errors.length == 1 ? result.errors[0] : 'Failed to create payment requests',
        errors: result.errors,
      });
    }
  } catch (error) {
    console.error('Error creating payment requests:', error);
    res.status(500).json({ error: 'Failed to create payment requests' });
  }
});

// Add a participant to a past game
router.post('/:gameId/participants', async (req, res) => {
  try {
    const gameId = parseInt(req.params.gameId);
    const { userId, guestName } = req.body as { userId?: number; guestName?: string };

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const game = await db.select().from(games).where(eq(games.id, gameId));
    if (!game.length) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const gameDateTime = new Date(game[0].dateTime);
    const now = new Date();
    if (now < gameDateTime) {
      return res.status(400).json({ error: 'Cannot modify participants for future or ongoing games' });
    }

    const paymentRequestsExist = await db
      .select()
      .from(paymentRequests)
      .innerJoin(gameRegistrations, eq(paymentRequests.gameRegistrationId, gameRegistrations.id))
      .where(eq(gameRegistrations.gameId, gameId))
      .limit(1);

    if (paymentRequestsExist.length > 0) {
      return res.status(400).json({ error: 'Cannot modify participants after payment requests have been sent' });
    }

    const user = await db.select().from(users).where(eq(users.id, userId));
    if (!user.length) {
      return res.status(404).json({ error: 'User not found' });
    }

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
      return res.status(400).json({ error: guestName ? 'This guest is already registered for this game' : 'User already registered for this game' });
    }

    const registrationOpenDate = new Date(gameDateTime);
    registrationOpenDate.setDate(registrationOpenDate.getDate() - REGISTRATION_OPEN_DAYS);

    const registration = await db
      .insert(gameRegistrations)
      .values({
        gameId,
        userId,
        guestName: guestName ?? null,
        paid: false,
        createdAt: registrationOpenDate,
      })
      .returning();

    res.status(201).json(registration[0]);
  } catch (error) {
    console.error('Error adding participant:', error);
    res.status(500).json({ error: 'Failed to add participant' });
  }
});

// Remove a participant from a past game
router.delete('/:gameId/participants/:userId', async (req, res) => {
  try {
    const gameId = parseInt(req.params.gameId);
    const userId = parseInt(req.params.userId);
    const { guestName } = req.body as { guestName?: string };

    const game = await db.select().from(games).where(eq(games.id, gameId));
    if (!game.length) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const gameDateTime = new Date(game[0].dateTime);
    const now = new Date();
    if (gameDateTime > now) {
      return res.status(400).json({ error: 'Cannot modify participants for future games' });
    }

    const paymentRequestsExist = await db
      .select()
      .from(paymentRequests)
      .innerJoin(gameRegistrations, eq(paymentRequests.gameRegistrationId, gameRegistrations.id))
      .where(eq(gameRegistrations.gameId, gameId))
      .limit(1);

    if (paymentRequestsExist.length > 0) {
      return res.status(400).json({ error: 'Cannot modify participants after payment requests have been sent' });
    }

    const registration = await db
      .select()
      .from(gameRegistrations)
      .where(
        and(
          eq(gameRegistrations.gameId, gameId),
          eq(gameRegistrations.userId, userId),
          guestName ? eq(gameRegistrations.guestName, guestName) : isNull(gameRegistrations.guestName),
        ),
      );

    if (!registration.length) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    await db.delete(gameRegistrations).where(eq(gameRegistrations.id, registration[0].id));

    res.json({ message: 'Participant removed successfully' });
  } catch (error) {
    console.error('Error removing participant:', error);
    res.status(500).json({ error: 'Failed to remove participant' });
  }
});

// Update a player's paid status for a game
router.put('/:gameId/players/:userId/paid', async (req, res) => {
  try {
    const gameId = parseInt(req.params.gameId);
    const userId = parseInt(req.params.userId);

    const game = await db.select().from(games).where(eq(games.id, gameId));
    if (!game.length) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const registration = await db
      .select()
      .from(gameRegistrations)
      .where(and(eq(gameRegistrations.gameId, gameId), eq(gameRegistrations.userId, userId)));

    if (!registration.length) {
      return res.status(404).json({ error: 'Registration not found' });
    }

    const { paid = true } = req.body as { paid?: boolean };

    const success = await bunqService.updatePaidStatus(gameId, userId, paid);

    if (success) {
      const statusMessage = paid ? 'paid' : 'unpaid';
      res.json({ message: `Successfully marked registration as ${statusMessage}` });
    } else {
      res.status(400).json({ error: 'Failed to update registration paid status' });
    }
  } catch (error) {
    console.error('Error updating registration paid status:', error);
    res.status(500).json({ error: 'Failed to update registration paid status' });
  }
});

// Check payment statuses for all unpaid past games or a specific game
router.post('/check-payments', async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { password, gameId } = req.body as { password?: string, gameId?: number };
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    let unpaidGames;
    if (gameId) {
      // Check specific game
      unpaidGames = await db
        .select()
        .from(games)
        .where(and(eq(games.id, gameId), eq(games.fullyPaid, false), lt(games.dateTime, new Date())));
    } else {
      // Check all unpaid past games (legacy behavior)
      unpaidGames = await db
        .select()
        .from(games)
        .where(and(eq(games.fullyPaid, false), lt(games.dateTime, new Date())))
        .orderBy(desc(games.dateTime))
        .limit(10);
    }

    if (unpaidGames.length === 0) {
      return res.json({
        success: true,
        message: gameId ? 'Game not found or already fully paid' : 'No unpaid past games found',
        updatedPlayers: 0,
        updatedGames: 0,
        processedGames: 0,
      });
    }

    const gameIds = unpaidGames.map((g) => g.id);
    let totalUpdatedPlayers = 0;
    let totalUpdatedGames = 0;

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
      .leftJoin(paymentRequests, eq(paymentRequests.gameRegistrationId, gameRegistrations.id))
      .where(and(inArray(gameRegistrations.gameId, gameIds), eq(gameRegistrations.paid, false)));

    for (const registration of unpaidRegistrations) {
      if (!registration.paymentRequest) continue;

      const isPaid = await bunqService.checkPaymentRequestStatus(
        registration.paymentRequest.paymentRequestId,
        registration.paymentRequest.monetaryAccountId,
        req.user.id,
        password,
      );

      if (isPaid) {
        await db.update(gameRegistrations).set({ paid: true }).where(eq(gameRegistrations.id, registration.id));
        totalUpdatedPlayers++;

        const unpaidCount = await db
          .select({ count: sql<number>`count(*)` })
          .from(gameRegistrations)
          .where(and(eq(gameRegistrations.gameId, registration.gameId), eq(gameRegistrations.paid, false)))
          .then((rows) => rows[0]?.count ?? 0);

        if (unpaidCount === 0) {
          await db.update(games).set({ fullyPaid: true }).where(eq(games.id, registration.gameId));
          totalUpdatedGames++;
        }
      }
    }

    for (const game of unpaidGames) {
      const allRegistrations = await db
        .select({ id: gameRegistrations.id, paid: gameRegistrations.paid })
        .from(gameRegistrations)
        .where(eq(gameRegistrations.gameId, game.id))
        .orderBy(gameRegistrations.createdAt);

      const activeRegistrations = allRegistrations.slice(0, game.maxPlayers);
      const unpaidCount = activeRegistrations.filter((reg) => !reg.paid).length;

      if (unpaidCount === 0) {
        await db.update(games).set({ fullyPaid: true }).where(eq(games.id, game.id));
        totalUpdatedGames++;
      }
    }

    res.json({
      success: true,
      message: gameId
        ? `Payment check completed for game. Updated ${totalUpdatedPlayers} players${totalUpdatedGames > 0 ? ' and marked game as fully paid' : ''}.`
        : `Payment check completed. Updated ${totalUpdatedPlayers} players and marked ${totalUpdatedGames} games as fully paid.`,
      updatedPlayers: totalUpdatedPlayers,
      updatedGames: totalUpdatedGames,
      processedGames: unpaidGames.length,
    });
  } catch (error) {
    console.error('Error checking payments:', error);
    res.status(500).json({ error: 'Failed to check payments', message: error instanceof Error ? error.message : 'Unknown error occurred' });
  }
});

export default router;
