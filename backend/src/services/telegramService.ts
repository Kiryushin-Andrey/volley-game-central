import { Telegraf } from 'telegraf';
import { formatLocationSection } from '../utils/telegramMessageUtils';
import { db } from '../db';
import { games, gameRegistrations, users } from '../db/schema';
import { gt, lte, and, eq, count } from 'drizzle-orm';
import { REGISTRATION_OPEN_DAYS } from '../constants';
import { formatGameDate, formatGameDateShort } from '../utils/dateUtils';
import { isDevMode, logDevMode } from '../utils/devMode';

// Get mini app URL from environment
const MINI_APP_URL = process.env.MINI_APP_URL || 'http://localhost:3001';

// Get Telegram group chat ID from environment
const TELEGRAM_GROUP_ID = process.env.TELEGRAM_GROUP_ID || '';

// Get Telegram group topic ID from environment (optional)
const TELEGRAM_TOPIC_ID = process.env.TELEGRAM_TOPIC_ID ? parseInt(process.env.TELEGRAM_TOPIC_ID) : undefined;

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
    const message = `🤖 I'm just a Telegram bot for registering for volleyball games.

If you want to talk to people, join one of our community groups:

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
 * Send a notification message to a user via Telegram
 * 
 * @param telegramId The Telegram ID of the user to send the notification to
 * @param message The message to send
 * @returns Promise that resolves when the message is sent
 */
export async function sendTelegramNotification(telegramId: string, message: string): Promise<void> {
  if (isDevMode()) {
    logDevMode(`[SUPPRESSED] Telegram notification to ${telegramId}: ${message}`);
    return;
  }
  
  try {
    await bot.telegram.sendMessage(telegramId, message, { parse_mode: 'HTML' });
    console.log(`Notification sent to user ${telegramId}`);
  } catch (error) {
    console.error(`Failed to send notification to user ${telegramId}:`, error);
    // Don't throw the error as this is a non-critical operation
  }
}

/**
 * Send an announcement message to the configured Telegram group
 * 
 * @param message The message to send to the group
 * @param topicId Optional topic ID to send the message to (for forum groups)
 * @returns Promise that resolves when the message is sent
 */
export async function sendGroupAnnouncement(message: string, topicId?: number): Promise<void> {
  if (isDevMode()) {
    logDevMode(`[SUPPRESSED] Group announcement: ${message}`);
    return;
  }
  
  if (!TELEGRAM_GROUP_ID) {
    console.warn('No Telegram group ID configured, skipping group announcement');
    return;
  }
  
  try {
    const messageThreadId = topicId || TELEGRAM_TOPIC_ID;
    const logSuffix = messageThreadId ? ` (topic: ${messageThreadId})` : '';
    console.log(`Sending announcement to group ${TELEGRAM_GROUP_ID}${logSuffix}`);
    
    const botInfo = await bot.telegram.getMe();
    const botUsername = botInfo.username;
    const botUrl = `https://t.me/${botUsername}`;
    
    await bot.telegram.sendMessage(TELEGRAM_GROUP_ID, message, {
      parse_mode: 'HTML',
      disable_notification: false,
      message_thread_id: messageThreadId,
      reply_markup: {
        inline_keyboard: [[
          {
            text: '🏐 Join Game',
            url: botUrl
          }
        ]]
      }
    });
    console.log(`Announcement sent to group ${TELEGRAM_GROUP_ID}`);
  } catch (error) {
    const logSuffix = (topicId || TELEGRAM_TOPIC_ID) ? ` (topic: ${topicId || TELEGRAM_TOPIC_ID})` : '';
    console.error(`Failed to send announcement to group ${TELEGRAM_GROUP_ID}${logSuffix}:`, error);
    // Don't throw the error as this is a non-critical operation
  }
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
    // Skip games with withPositions flag set to true
    const upcomingGames = await db.select()
      .from(games)
      .where(
        // Games that are between X days and X days 23 hours from now
        // (registration opened within the last hour)
        and(
          lte(games.dateTime, registrationWindowEnd),  // Less than or equal to X days fromXnow
          gt(games.dateTime, registrationWindowStart),  // Greater than 4 days 23 hours from now
          eq(games.withPositions, false)  // Skip games with withPositions = true
        )
      );
    
    // Send announcements for each game
    for (const game of upcomingGames) {
      const gameDate = new Date(game.dateTime);
      const formattedDate = formatGameDate(gameDate);
      
      const locationText = formatLocationSection((game as any).locationName, (game as any).locationLink);

      // Check if this is a Halloween game
      const isHalloween = (game as any).tag === 'halloween';
      
      let message: string;
      if (isHalloween) {
        message = `<b>🎃👻 SPOOKY VOLLEYBALL NIGHT! 👻🎃</b>\n\n🦇 <b>Halloween Special Game Registration Open!</b> 🦇\n\nGet ready for a frightfully fun volleyball night on <b>${formattedDate}</b>${locationText}\n\n🕷️ Costumes encouraged! 🕸️\n🎃 Spooky vibes guaranteed! 🎃\n👻 Limited to ${game.maxPlayers} brave players! 👻\n\n<i>Dare to join? Click below if you're not too scared...</i> 😈`;
      } else {
        message = `<b>🏐 New Volleyball Game Registration Open!</b>\n\nRegistration is now open for the game on <b>${formattedDate}</b>${locationText}\n\nSpots are limited to ${game.maxPlayers} players. First come, first served!\n\nClick the button below to join:`;
      }
      
      await sendGroupAnnouncement(message);
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
    reminderWindowStart.setHours(reminderWindowStart.getHours() + 23);
    
    const reminderWindowEnd = new Date(now);
    reminderWindowEnd.setHours(reminderWindowEnd.getHours() + 24);
    
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
        
        await sendTelegramNotification(firstRegistration.telegramId, message);
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
    
    // Filter games that are open for registration (less than X days away)
    const openRegistrationGames = upcomingGames.filter(game => {
      const gameDate = new Date(game.dateTime);
      const registrationOpensAt = new Date(gameDate);
      registrationOpensAt.setDate(registrationOpensAt.getDate() - REGISTRATION_OPEN_DAYS);
      return now >= registrationOpensAt;
    });
    
    console.log(`[DEBUG] Found ${openRegistrationGames.length} games with open registration`);
    
    for (const game of openRegistrationGames) {
      const gameDate = new Date(game.dateTime);
      const formattedDate = formatGameDate(gameDate);
      
      const availableSpots = game.maxPlayers - Number(game.registrationCount);
      const spotsText = availableSpots > 0 
        ? `${availableSpots} spots available` 
        : 'Waitlist only';
      
      const message = `<b>🏐 [DEBUG] Game Registration Open!</b>\n\n<b>${formattedDate}</b>\n${spotsText} (${game.registrationCount}/${game.maxPlayers})\n\nClick the button below to join:`;
      
      await sendGroupAnnouncement(message);
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
  
  // Also check once at startup
  checkAndAnnounceGameRegistrations();
  checkAndSendGameReminders();
  
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

// Initialize the bot when this module is imported
launchBot();
