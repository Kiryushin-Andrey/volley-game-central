import { Telegraf } from 'telegraf';
import { formatLocationSection } from '../utils/telegramMessageUtils';
import { db } from '../db';
import { games, gameRegistrations } from '../db/schema';
import { gt, lte, and, eq, count } from 'drizzle-orm';
import { REGISTRATION_OPEN_DAYS } from '../constants';
import { formatGameDate } from '../utils/dateUtils';

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
  // Skip if it's a command (already handled above)
  if (ctx.message.text.startsWith('/')) {
    console.log('Command detected in text handler but not processed:', ctx.message.text);
    // Don't return here, let it fall through to command handlers
  } else {
    // Special case for debugging
    if (ctx.message.text.toLowerCase() === 'ping') {
      return ctx.reply('pong');
    }
    
    // For regular text messages, show the mini-app button
    ctx.reply('🏐 Access your volleyball games:', {
      reply_markup: {
        inline_keyboard: [[
          {
            text: '🏐 Open Games',
            web_app: { url: MINI_APP_URL }
          }
        ]]
      }
    });
  }
});

/**
 * Send a notification message to a user via Telegram
 * 
 * @param telegramId The Telegram ID of the user to send the notification to
 * @param message The message to send
 * @returns Promise that resolves when the message is sent
 */
export async function sendTelegramNotification(telegramId: string, message: string): Promise<void> {
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

      const message = `<b>🏐 New Volleyball Game Registration Open!</b>\n\nRegistration is now open for the game on <b>${formattedDate}</b>${locationText}\n\nSpots are limited to ${game.maxPlayers} players. First come, first served!\n\nClick the button below to join:`;
      
      await sendGroupAnnouncement(message);
    }
    
    console.log(`Checked for games with registration opening today, found ${upcomingGames.length} games`);
  } catch (error) {
    console.error('Error checking for games with registration opening:', error);
  }
}

// No commands to register with BotFather
console.log('No bot commands to register with Telegram');

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
  
  // Also check once at startup
  checkAndAnnounceGameRegistrations();
  
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
