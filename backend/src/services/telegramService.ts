import { Telegraf } from 'telegraf';
import { db } from '../db';
import { games, gameRegistrations } from '../db/schema';
import { gt, lte, and, eq, count } from 'drizzle-orm';

// Get mini app URL from environment
const MINI_APP_URL = process.env.MINI_APP_URL || 'http://localhost:3001';

// Get Telegram group chat ID from environment
const TELEGRAM_GROUP_ID = process.env.TELEGRAM_GROUP_ID || '';

// Get Telegram group topic ID from environment (optional)
const TELEGRAM_TOPIC_ID = process.env.TELEGRAM_TOPIC_ID ? parseInt(process.env.TELEGRAM_TOPIC_ID) : undefined;

// Initialize Telegram bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');

// Configure bot commands - IMPORTANT: Register commands before the text handler
bot.command('start', (ctx) => {
  console.log('Start command received');
  ctx.reply('🏐 Welcome to Haarlem Volleyball Community!', {
    reply_markup: {
      inline_keyboard: [[
        {
          text: '🏐 Join games',
          web_app: { url: MINI_APP_URL }
        }
      ]]
    }
  });
});

// Command to list all upcoming games with open registration
bot.command('games', async (ctx) => {
  console.log('Games command received from:', ctx.from?.id, ctx.from?.username);
  try {
    const now = new Date();
    
    // Find all games in the future that are open for registration
    // (games happening within the next 5 days)
    const fiveDaysFromNow = new Date(now);
    fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
    
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
    
    // Filter games that are open for registration (less than 5 days away)
    const openRegistrationGames = upcomingGames.filter(game => {
      const gameDate = new Date(game.dateTime);
      const registrationOpensAt = new Date(gameDate);
      registrationOpensAt.setDate(registrationOpensAt.getDate() - 5);
      return now >= registrationOpensAt;
    });
    
    if (openRegistrationGames.length === 0) {
      await ctx.reply('No games with open registration at the moment. Check back later!');
      return;
    }
    
    // Format the response
    let message = '<b>🏐 Upcoming Games with Open Registration:</b>\n\n';
    
    openRegistrationGames.forEach(game => {
      const gameDate = new Date(game.dateTime);
      const formattedDate = gameDate.toLocaleDateString('en-GB', { 
        weekday: 'long',
        day: 'numeric', 
        month: 'long',
        hour: '2-digit', 
        minute: '2-digit'
      });
      
      const availableSpots = game.maxPlayers - Number(game.registrationCount);
      const spotsText = availableSpots > 0 
        ? `${availableSpots} spots available` 
        : 'Waitlist only';
      
      message += `<b>${formattedDate}</b>\n${spotsText} (${game.registrationCount}/${game.maxPlayers})\n\n`;
    });
    
    // Send the message with appropriate button based on chat type
    // web_app buttons only work in private chats, not in groups
    const isPrivateChat = ctx.chat?.type === 'private';
    
    if (isPrivateChat) {
      // In private chats, we can use web_app buttons
      await ctx.reply(message, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            {
              text: '🏐 Register for Games',
              web_app: { url: MINI_APP_URL }
            }
          ]]
        }
      });
    } else {
      // In groups, we need to use a URL button that opens the mini app within Telegram
      // Format: https://t.me/your_bot_username?startapp=...
      const botInfo = await bot.telegram.getMe();
      const botUsername = botInfo.username;
      const telegramAppUrl = `https://t.me/${botUsername}?startapp=games`;
      
      await ctx.reply(message, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [[
            {
              text: '🏐 Register for Games',
              url: telegramAppUrl
            }
          ]]
        }
      });
    }
    
  } catch (error) {
    console.error('Error listing games:', error);
    await ctx.reply('❌ An error occurred while fetching the games. Please try again later.');
  }
});

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
    await bot.telegram.sendMessage(telegramId, message);
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
    // Use the provided topicId, or fall back to the environment variable, or undefined if neither exists
    const messageThreadId = topicId || TELEGRAM_TOPIC_ID;
    
    await bot.telegram.sendMessage(TELEGRAM_GROUP_ID, message, {
      parse_mode: 'HTML',
      disable_notification: false,
      message_thread_id: messageThreadId,
      reply_markup: {
        inline_keyboard: [[
          {
            text: '🏐 Join Game',
            web_app: { url: MINI_APP_URL }
          }
        ]]
      }
    });
    console.log(`Announcement sent to group ${TELEGRAM_GROUP_ID}`);
  } catch (error) {
    console.error(`Failed to send announcement to group ${TELEGRAM_GROUP_ID}:`, error);
    // Don't throw the error as this is a non-critical operation
  }
}

/**
 * Check for games that are opening for registration soon (5 days before the game)
 * and send announcements to the configured Telegram group
 */
export async function checkAndAnnounceGameRegistrations(): Promise<void> {
  try {
    const now = new Date();
    
    // Calculate the date range for games whose registration opened in the last hour
    // Registration opens exactly 5 days before the game
    // So we're looking for games that are between 5 days and 4 days 23 hours from now
    
    // Exactly 5 days from now - this is when registration opens
    const fiveDaysFromNow = new Date(now);
    fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);
    
    // 4 days 23 hours from now - games that opened registration 1 hour ago
    const fourDays23HoursFromNow = new Date(now);
    fourDays23HoursFromNow.setDate(fourDays23HoursFromNow.getDate() + 4);
    fourDays23HoursFromNow.setHours(fourDays23HoursFromNow.getHours() + 23);
    
    // Find games whose registration opened in the last hour
    const upcomingGames = await db.select()
      .from(games)
      .where(
        // Games that are between 5 days and 4 days 23 hours from now
        // (registration opened within the last hour)
        and(
          lte(games.dateTime, fiveDaysFromNow),  // Less than or equal to 5 days from now
          gt(games.dateTime, fourDays23HoursFromNow)  // Greater than 4 days 23 hours from now
        )
      );
    
    // Send announcements for each game
    for (const game of upcomingGames) {
      const gameDate = new Date(game.dateTime);
      const formattedDate = gameDate.toLocaleDateString('en-GB', { 
        weekday: 'long',
        day: 'numeric', 
        month: 'long',
        hour: '2-digit', 
        minute: '2-digit'
      });
      
      const message = `<b>🏐 New Volleyball Game Registration Open!</b>\n\nRegistration is now open for the game on <b>${formattedDate}</b>\n\nSpots are limited to ${game.maxPlayers} players. First come, first served!\n\nClick the button below to join:`;
      
      await sendGroupAnnouncement(message);
    }
    
    console.log(`Checked for games with registration opening today, found ${upcomingGames.length} games`);
  } catch (error) {
    console.error('Error checking for games with registration opening:', error);
  }
}

// Register the commands with BotFather
bot.telegram.setMyCommands([
  { command: 'start', description: 'Start the bot' },
  { command: 'games', description: 'List upcoming games with open registration' }
]).then(() => {
  console.log('Bot commands registered with Telegram');
}).catch(error => {
  console.error('Failed to register bot commands:', error);
});

// Initialize the bot
bot.launch().catch((error: unknown) => {
  console.error("Error starting Telegram bot in telegramService:", error);
});

// Set up an hourly check for games with registration opening
setInterval(checkAndAnnounceGameRegistrations, 60 * 60 * 1000); // Run once every hour

// Also run once at startup to catch any games that might have been missed
setTimeout(checkAndAnnounceGameRegistrations, 5000); // Run 5 seconds after startup

// Handle shutdown gracefully
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
