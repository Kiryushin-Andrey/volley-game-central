import { Telegraf } from 'telegraf';
import { formatLocationSection } from '../utils/telegramMessageUtils';
import { db } from '../db';
import { games, gameRegistrations, users } from '../db/schema';
import { gt, lte, and, eq, count } from 'drizzle-orm';
import {
  REGISTRATION_OPEN_DAYS,
  isBaseRegistrationOpen,
  lateSignoutTopicEnvKey,
} from '../domain/gamePolicy';
import { asGameFormat, type GameFormat } from '../domain/gameFormat';
import { formatGameDate, formatGameDateShort } from '../utils/dateUtils';
import { isDevMode, logDevMode } from '../utils/devMode';

// Get mini app URL from environment
const MINI_APP_URL = process.env.MINI_APP_URL || 'http://localhost:3001';

// The one community group — used for membership gating, announcements, and late sign-out notifications
const TELEGRAM_GROUP_ID = process.env.TELEGRAM_GROUP_ID || '';

// Topic (thread) within the group where recreational game-opening announcements are posted
const TELEGRAM_ANNOUNCEMENTS_TOPIC_ID = process.env.TELEGRAM_ANNOUNCEMENTS_TOPIC_ID
  ? parseInt(process.env.TELEGRAM_ANNOUNCEMENTS_TOPIC_ID)
  : undefined;

/** Synthetic monotonic message ids for DEV_MODE so persist/delete paths are testable. */
let syntheticMessageIdSeq = 1_000_000;

function nextSyntheticMessageId(): number {
  syntheticMessageIdSeq += 1;
  return syntheticMessageIdSeq;
}

/** Reset synthetic id counter (unit tests). */
export function resetSyntheticTelegramMessageIds(start = 1_000_000): void {
  syntheticMessageIdSeq = start;
}

export function getTelegramGroupId(): string {
  return TELEGRAM_GROUP_ID;
}

export type TelegramDmSendResult = { chatId: string; messageId: number };
export type TelegramGroupSendResult = { messageId: number };

/**
 * Resolve format-aware late-signout / spot-offer public topic id.
 * Positions → TELEGRAM_LATE_SIGNOUT_TOPIC_ID_POSITIONS;
 * recreational / priority_players → TELEGRAM_LATE_SIGNOUT_TOPIC_ID_NON_POSITIONS.
 * Returns undefined when unset (caller should skip send).
 */
export function resolveLateSignoutTopicId(
  gameFormat: GameFormat | string,
): number | undefined {
  const envKey = lateSignoutTopicEnvKey(asGameFormat(String(gameFormat)));
  const raw = process.env[envKey];
  if (!raw) return undefined;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

// Initialize Telegram bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');


// Handle any text message - show the mini-app
// IMPORTANT: This must come AFTER command handlers
bot.on('text', (ctx) => {
    // Special case for debugging
    if (ctx.message.text.toLowerCase() === 'ping') {
      return ctx.reply('pong');
    }
    
    // For regular text messages, inform about the bot's purpose and community groups
    const message = `🤖 I'm the Telegram bot for registering for volleyball games.

Please join one of our community groups before registering for games:

<b>Telegram Group</b> (mostly Russian-speaking)
https://t.me/+nZxG6L8bbcxhMTg0

<b>WhatsApp Group</b> (less active, but English-speaking)
https://chat.whatsapp.com/DE3sBMgi55tCEkyeUnA6be

To register for games, use the button below:`;
    
    ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          {
            text: '🏐 Open Games',
            web_app: { url: MINI_APP_URL }
          }
        ]]
      }
    });
});

/**
 * Build a bot URL with start parameter for deep linking to a specific game
 *
 * @param botUsername The bot's username
 * @param gameId Optional game ID to deep link to
 * @returns The bot URL with start parameter if gameId is provided
 */
export function buildBotUrl(botUsername: string, gameId?: number): string {
  const baseUrl = `https://t.me/${botUsername}`;
  if (!gameId) {
    return baseUrl;
  }
  // Use game_{id} format for the start parameter to make it clear this is a game link
  return `${baseUrl}?startapp=game_${gameId}`;
}

/**
 * Check whether a Telegram user is in the volleyball group.
 * Used when registering for games. If TELEGRAM_GROUP_ID is not set, returns true (check skipped).
 */
export async function checkTelegramGroupMembership(telegramId: string): Promise<boolean> {
  if (!TELEGRAM_GROUP_ID) {
    return true;
  }
  try {
    const member = await bot.telegram.getChatMember(TELEGRAM_GROUP_ID, parseInt(telegramId, 10));
    return ['creator', 'administrator', 'member'].includes(member.status);
  } catch (err) {
    console.error('Error checking Telegram group membership:', err);
    return false;
  }
}

/**
 * Send a Telegram notification to a user.
 * Returns chatId + messageId when sent (for later delete); null if failed.
 * In DEV_MODE returns synthetic ids without hitting the network.
 */
export async function sendTelegramNotification(
  telegramId: string,
  message: string,
  gameId?: number,
  buttonText = '🏐 View Game',
): Promise<TelegramDmSendResult | null> {
  if (isDevMode()) {
    const messageId = nextSyntheticMessageId();
    logDevMode(
      `[SUPPRESSED] Telegram DM to ${telegramId} (synthetic messageId=${messageId}): ${message}`,
    );
    return { chatId: telegramId, messageId };
  }

  try {
    const botInfo = await bot.telegram.getMe();
    const botUsername = botInfo.username;
    const botUrl = buildBotUrl(botUsername, gameId);

    const result = await bot.telegram.sendMessage(telegramId, message, {
      parse_mode: 'HTML',
      reply_markup: gameId
        ? {
            inline_keyboard: [
              [
                {
                  text: buttonText,
                  url: botUrl,
                },
              ],
            ],
          }
        : undefined,
    });
    console.log(`Notification sent to user ${telegramId}`);
    return { chatId: telegramId, messageId: result.message_id };
  } catch (error) {
    console.error(`Failed to send notification to user ${telegramId}:`, error);
    return null;
  }
}

/**
 * Send an announcement to the configured Telegram group.
 * Returns messageId when sent (for later delete); null if skipped/failed.
 * In DEV_MODE returns a synthetic id without hitting the network.
 */
export async function sendGroupAnnouncement(
  message: string,
  gameId?: number,
  topicId?: number,
  buttonText = '🏐 Join Game',
): Promise<TelegramGroupSendResult | null> {
  if (isDevMode()) {
    const messageId = nextSyntheticMessageId();
    logDevMode(
      `[SUPPRESSED] Group announcement (synthetic messageId=${messageId}): ${message}`,
    );
    return { messageId };
  }

  if (!TELEGRAM_GROUP_ID) {
    console.warn('No Telegram group ID configured, skipping group announcement');
    return null;
  }

  try {
    const messageThreadId = topicId ?? TELEGRAM_ANNOUNCEMENTS_TOPIC_ID;
    const logSuffix = messageThreadId ? ` (topic: ${messageThreadId})` : '';
    console.log(`Sending announcement to group ${TELEGRAM_GROUP_ID}${logSuffix}`);

    const botInfo = await bot.telegram.getMe();
    const botUsername = botInfo.username;
    const botUrl = buildBotUrl(botUsername, gameId);

    const result = await bot.telegram.sendMessage(TELEGRAM_GROUP_ID, message, {
      parse_mode: 'HTML',
      disable_notification: false,
      message_thread_id: messageThreadId,
      reply_markup: {
        inline_keyboard: [[
          {
            text: buttonText,
            url: botUrl
          }
        ]]
      }
    });
    console.log(`Announcement sent to group ${TELEGRAM_GROUP_ID}`);
    return { messageId: result.message_id };
  } catch (error) {
    const logSuffix = (topicId ?? TELEGRAM_ANNOUNCEMENTS_TOPIC_ID) ? ` (topic: ${topicId ?? TELEGRAM_ANNOUNCEMENTS_TOPIC_ID})` : '';
    console.error(`Failed to send announcement to group ${TELEGRAM_GROUP_ID}${logSuffix}:`, error);
    return null;
  }
}

/** Best-effort delete of a Telegram message (DM or group). */
export async function deleteTelegramMessage(
  chatId: string,
  messageId: number,
): Promise<void> {
  if (isDevMode()) {
    logDevMode(
      `[SUPPRESSED] deleteTelegramMessage chatId=${chatId} messageId=${messageId}`,
    );
    return;
  }

  try {
    await bot.telegram.deleteMessage(chatId, messageId);
  } catch (error) {
    console.error(
      `Failed to delete Telegram message ${messageId} in chat ${chatId}:`,
      error,
    );
  }
}

// How many hours before the game a sign-out is considered "late"
export const LATE_SIGNOUT_THRESHOLD_HOURS = 48;

/**
 * Send a late sign-out notification to the format-keyed topic within TELEGRAM_GROUP_ID.
 * Called when a roster spot opens with no one on the waitlist (any format).
 * Silently skips if group id or the matching topic env is unset.
 */
export async function sendLateSignoutGroupNotification(
  gameDate: Date,
  gameId: number,
  gameFormat: GameFormat | string = 'recreational',
): Promise<TelegramGroupSendResult | null> {
  const topicId = resolveLateSignoutTopicId(gameFormat);

  if (!TELEGRAM_GROUP_ID || topicId === undefined) {
    return null;
  }

  const formattedDate = formatGameDate(gameDate);
  const message =
    `🏐 A spot just opened up for the volleyball game on <b>${formattedDate}</b>!\n\n` +
    `Join now before it's taken 👇`;

  if (isDevMode()) {
    const messageId = nextSyntheticMessageId();
    logDevMode(
      `[SUPPRESSED] Late sign-out notification to topic ${topicId} for game ${gameId} (synthetic messageId=${messageId})`,
    );
    return { messageId };
  }

  try {
    const botInfo = await bot.telegram.getMe();
    const botUrl = buildBotUrl(botInfo.username, gameId);

    const result = await bot.telegram.sendMessage(TELEGRAM_GROUP_ID, message, {
      parse_mode: 'HTML',
      message_thread_id: topicId,
      reply_markup: {
        inline_keyboard: [[
          { text: '🏐 Join Game', url: botUrl }
        ]]
      }
    });
    console.log(`Late sign-out notification sent to topic ${topicId} in group ${TELEGRAM_GROUP_ID} for game ${gameId}`);
    return { messageId: result.message_id };
  } catch (error) {
    console.error(`Failed to send late sign-out notification to topic ${topicId}:`, error);
    return null;
  }
}

/**
 * Public spot-offer announce — same topic resolver as late sign-out, distinct copy.
 * In DEV_MODE always returns a synthetic id so unit tests can persist/delete without topic env.
 */
export async function sendSpotOfferPublicAnnouncement(params: {
  gameDate: Date;
  gameId: number;
  gameFormat: GameFormat | string;
}): Promise<TelegramGroupSendResult | null> {
  const topicId = resolveLateSignoutTopicId(params.gameFormat);

  if (isDevMode()) {
    const messageId = nextSyntheticMessageId();
    logDevMode(
      `[SUPPRESSED] Spot-offer public announce for game ${params.gameId} topic=${topicId ?? 'unset'} (synthetic messageId=${messageId})`,
    );
    return { messageId };
  }

  if (!TELEGRAM_GROUP_ID || topicId === undefined) {
    return null;
  }

  const formattedDate = formatGameDate(params.gameDate);
  const message = `📣 A spot for the volleyball game on <b>${formattedDate}</b> is being offered.`;

  return sendGroupAnnouncement(
    message,
    params.gameId,
    topicId,
    '🏐 View Game',
  );
}


/**
 * Check for games that are opening for registration soon (X days befoXe the game)
 * and send announcements to the configured Telegram group
 */
export async function checkAndAnnounceGameRegistrations(): Promise<void> {
  try {
    const now = new Date();
    
    // Calculate the date range for games whose registration opened in the last hour
    // Registration opens exactly X days befoXe the game
    // So we're looking for games that are between X days and X days 23 hours from now
    const registrationWindowEnd = new Date(now);
    registrationWindowEnd.setDate(registrationWindowEnd.getDate() + REGISTRATION_OPEN_DAYS);
    
    // X days 23 hours from now - games that opened registration 1 hour ago
    const registrationWindowStart = new Date(now);
    registrationWindowStart.setDate(registrationWindowStart.getDate() + (REGISTRATION_OPEN_DAYS - 1));
    registrationWindowStart.setHours(registrationWindowStart.getHours() + 23);
    
    // Find games whose registration opened in the last hour
    // Announce recreational games only (skip positions, priority windows, readonly)
    const upcomingGames = await db.select()
      .from(games)
      .where(
        // Games that are between X days and X days 23 hours from now
        // (registration opened within the last hour)
        and(
          lte(games.dateTime, registrationWindowEnd),  // Less than or equal to X days fromXnow
          gt(games.dateTime, registrationWindowStart),  // Greater than 4 days 23 hours from now
          eq(games.gameFormat, 'recreational'),  // Announce recreational games only
          eq(games.readonly, false),  // Skip readonly games
        )
      );
    
    // Send announcements for each game
    for (const game of upcomingGames) {
      const gameDate = new Date(game.dateTime);
      const formattedDate = formatGameDate(gameDate);

      const locationText = formatLocationSection((game as any).locationName, (game as any).locationLink);

      // Check if this is a themed game
      const isHalloween = (game as any).tag === 'halloween';
      const isNewYear = (game as any).tag === 'newyear';
      const isMarch8 = (game as any).tag === 'march8';

      let message: string;
      if (isHalloween) {
        message = `<b>🎃👻 SPOOKY VOLLEYBALL EVENING! 👻🎃</b>\n\n🦇 <b>Halloween Special Game Registration Open!</b> 🦇\n\nGet ready for a frightfully fun volleyball evening on <b>${formattedDate}</b>${locationText}\n\n🕷️ Costumes encouraged! 🕸️\n🎃 Spooky vibes guaranteed! 🎃\n👻 Limited to ${game.maxPlayers} brave players! 👻\n\n<i>Dare to join? Click below if you're not too scared...</i> 😈`;
      } else if (isNewYear) {
        message = `<b>❄️🎄 FESTIVE VOLLEYBALL EVENING! 🎄❄️</b>\n\n⛷️ <b>New Year Special Game Registration Open!</b> ⛷️\n\nGet ready for a festive volleyball evening on <b>${formattedDate}</b>${locationText}\n\n❄️ Winter vibes! ❄️\n🎄 Festive fun guaranteed! 🎄\n☃️ Limited to ${game.maxPlayers} players! ☃️\n\n<i>Join us for a magical winter volleyball experience!</i> ⛸️`;
      } else if (isMarch8) {
        message = `<b>🌸💐 SPRING VOLLEYBALL EVENING! 💐🌸</b>\n\n🌷 <b>March 8 Special — Game Registration Open!</b> 🌷\n\nGet ready for a lovely volleyball evening on <b>${formattedDate}</b>${locationText}\n\n🌸 Spring vibes &amp; flowers! 🌸\n💐 Beauty and fun guaranteed! 💐\n🦋 Limited to ${game.maxPlayers} players! 🦋\n\n<i>Join us for a beautiful spring volleyball experience!</i> ✨`;
      } else {
        message = `<b>🏐 New Volleyball Game Registration Open!</b>\n\nRegistration is now open for the game on <b>${formattedDate}</b>${locationText}\n\nSpots are limited to ${game.maxPlayers} players. First come, first served!\n\nClick the button below to join:`;
      }

      await sendGroupAnnouncement(message, game.id);
    }
    
    console.log(`Checked for games with registration opening today, found ${upcomingGames.length} games`);
  } catch (error) {
    console.error('Error checking for games with registration opening:', error);
  }
}

// No commands to register with BotFather
console.log('No bot commands to register with Telegram');

/**
 * Check for games starting in approximately 24 hours and send reminder notifications
 * to registered players (Telegram users only, excluding waitlist)
 */
export async function checkAndSendGameReminders(): Promise<void> {
  try {
    const now = new Date();
    
    const reminderWindowStart = new Date(now);
    reminderWindowStart.setHours(reminderWindowStart.getHours() + 31);
    
    const reminderWindowEnd = new Date(now);
    reminderWindowEnd.setHours(reminderWindowEnd.getHours() + 32);
    
    // Find games starting in the reminder window
    const upcomingGames = await db
      .select()
      .from(games)
      .where(
        and(
          gt(games.dateTime, reminderWindowStart),
          lte(games.dateTime, reminderWindowEnd)
        )
      );
    
    if (upcomingGames.length === 0) {
      console.log('No games found starting in ~24 hours');
      return;
    }
    
    console.log(`Found ${upcomingGames.length} game(s) starting in ~24 hours, checking registrations...`);
    
    // Process each game
    for (const game of upcomingGames) {
      // Get all registrations for this game, ordered by creation time
      const allRegistrations = await db
        .select({
          id: gameRegistrations.id,
          userId: gameRegistrations.userId,
          guestName: gameRegistrations.guestName,
          createdAt: gameRegistrations.createdAt,
          telegramId: users.telegramId,
          displayName: users.displayName,
        })
        .from(gameRegistrations)
        .innerJoin(users, eq(gameRegistrations.userId, users.id))
        .where(eq(gameRegistrations.gameId, game.id))
        .orderBy(gameRegistrations.createdAt);
      
      // Filter to only active registrations (not waitlist) - first maxPlayers registrations
      const activeRegistrations = allRegistrations.slice(0, game.maxPlayers);
      
      // Filter to only Telegram users (telegramId is not null)
      const telegramRegistrations = activeRegistrations.filter(
        (reg) => reg.telegramId !== null && reg.telegramId !== undefined
      );
      
      if (telegramRegistrations.length === 0) {
        console.log(`No Telegram registrations found for game ${game.id}`);
        continue;
      }
      
      // Calculate unregister deadline
      const gameDateTime = new Date(game.dateTime);
      const deadlineHours = game.unregisterDeadlineHours || 5; // Default to 5 hours if not set
      const unregisterDeadline = new Date(gameDateTime);
      unregisterDeadline.setHours(unregisterDeadline.getHours() - deadlineHours);
      
      const formattedGameDate = formatGameDate(gameDateTime);
      const formattedDeadline = formatGameDateShort(unregisterDeadline);
      
      // Group registrations by userId to send one reminder per user
      const registrationsByUser = new Map<number, typeof telegramRegistrations>();
      
      for (const registration of telegramRegistrations) {
        if (!registrationsByUser.has(registration.userId)) {
          registrationsByUser.set(registration.userId, []);
        }
        registrationsByUser.get(registration.userId)!.push(registration);
      }
      
      // Send reminders to each registered Telegram user
      for (const [userId, userRegistrations] of registrationsByUser.entries()) {
        const firstRegistration = userRegistrations[0];
        if (!firstRegistration.telegramId) {
          continue;
        }
        
        // Build message based on registrations
        const selfRegistration = userRegistrations.find(reg => !reg.guestName);
        const guestRegistrations = userRegistrations.filter(reg => reg.guestName);
        
        let registrationText: string;
        if (selfRegistration && guestRegistrations.length > 0) {
          // User registered themselves and guests
          const guestNames = guestRegistrations.map(reg => `"${reg.guestName}"`).join(', ');
          registrationText = `You're registered for the game${guestRegistrations.length === 1 ? ` with guest ${guestNames}` : ` with guests ${guestNames}`}`;
        } else if (selfRegistration) {
          // User only registered themselves
          registrationText = `You're registered for the game`;
        } else {
          // User only registered guests
          const guestNames = guestRegistrations.map(reg => `"${reg.guestName}"`).join(', ');
          registrationText = `You're registered${guestRegistrations.length === 1 ? ` with guest ${guestNames}` : ` with guests ${guestNames}`} for the game`;
        }
        
        const message = `⏰ <b>Reminder: Volleyball Game Tomorrow!</b>\n\n${registrationText} on <b>${formattedGameDate}</b>.\n\n⏳ <b>Unregister deadline:</b> ${formattedDeadline}\n\nSee you there! 🏐`;

        await sendTelegramNotification(firstRegistration.telegramId, message, game.id);
        console.log(`Sent reminder to Telegram user ${firstRegistration.telegramId} (${firstRegistration.displayName || 'unknown'}) for game ${game.id}`);
      }
      
      console.log(`Sent reminders to ${registrationsByUser.size} Telegram user(s) for game ${game.id}`);
    }
  } catch (error) {
    console.error('Error checking and sending game reminders:', error);
  }
}

// Debug function to post notifications about all upcoming games with open registration
async function debugPostAllOpenRegistrations(): Promise<void> {
  try {
    const now = new Date();
    
    // Get upcoming games with their registration counts
    const upcomingGames = await db
      .select({
        id: games.id,
        dateTime: games.dateTime,
        maxPlayers: games.maxPlayers,
        registrationCount: count(gameRegistrations.id)
      })
      .from(games)
      .leftJoin(gameRegistrations, eq(games.id, gameRegistrations.gameId))
      .where(gt(games.dateTime, now))
      .groupBy(games.id)
      .orderBy(games.dateTime);
    
    // Filter games that are open for registration (base policy window)
    const openRegistrationGames = upcomingGames.filter((game) =>
      isBaseRegistrationOpen(game.dateTime, now),
    );
    
    console.log(`[DEBUG] Found ${openRegistrationGames.length} games with open registration`);
    
    for (const game of openRegistrationGames) {
      const gameDate = new Date(game.dateTime);
      const formattedDate = formatGameDate(gameDate);
      
      const availableSpots = game.maxPlayers - Number(game.registrationCount);
      const spotsText = availableSpots > 0 
        ? `${availableSpots} spots available` 
        : 'Waitlist only';
      
      const message = `<b>🏐 [DEBUG] Game Registration Open!</b>\n\n<b>${formattedDate}</b>\n${spotsText} (${game.registrationCount}/${game.maxPlayers})\n\nClick the button below to join:`;

      await sendGroupAnnouncement(message, game.id);
      console.log(`[DEBUG] Posted notification for game on ${formattedDate}`);
    }
  } catch (error) {
    console.error('[DEBUG] Error posting debug notifications:', error);
  }
}

// Launch the bot
export function launchBot(): void {
  // Set up periodic job to check for game registrations opening
  setInterval(checkAndAnnounceGameRegistrations, 60 * 60 * 1000); // Check every hour
  
  // Set up periodic job to check for games starting in ~24 hours and send reminders
  setInterval(checkAndSendGameReminders, 60 * 60 * 1000); // Check every hour

  // Spot-offer waitlist walk / public transition poller (default ~30s; override via SPOT_OFFER_POLLER_INTERVAL_MS for E2E)
  // Lazy import avoids circular deps with spotOfferJobs -> spotOfferService -> telegramService
  const runSpotOfferJobs = () => {
    import('./spotOfferJobs')
      .then(({ processSpotOfferJobs }) => processSpotOfferJobs())
      .catch((err) => console.error('Spot offer jobs failed:', err));
  };
  const pollerMsRaw = Number(process.env.SPOT_OFFER_POLLER_INTERVAL_MS);
  const pollerMs =
    Number.isFinite(pollerMsRaw) && pollerMsRaw > 0 ? pollerMsRaw : 30 * 1000;
  setInterval(runSpotOfferJobs, pollerMs);
  
  // Also check once at startup
  checkAndAnnounceGameRegistrations();
  checkAndSendGameReminders();
  runSpotOfferJobs();
  
  // Debug: Post notifications about all upcoming games with open registration
  // debugPostAllOpenRegistrations();
  
  // Launch the bot
  bot.launch()
    .then(() => {
      console.log('Bot commands registered with Telegram');
    })
    .catch((error) => {
      console.error('Failed to start the bot:', error);
    });
  
  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
