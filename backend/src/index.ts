import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Telegraf } from 'telegraf';
import { telegramAuthMiddleware } from './middleware/telegramAuth';
import userRoutes from './routes/users';
import gameRoutes from './routes/games';
import { db } from './db';

// Initialize Express app
const app = express();
const corsOrigins = [
  'http://127.0.0.1',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'https://rnuwm-83-82-223-154.a.free.pinggy.link/'
];
if (process.env.CORS_ORIGIN) {
  corsOrigins.push(process.env.CORS_ORIGIN);
}

app.use(cors({
  origin: corsOrigins,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Telegram bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');

// Public routes
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Protected routes - apply telegramAuth middleware
app.use('/users', telegramAuthMiddleware, userRoutes);
app.use('/games', telegramAuthMiddleware, gameRoutes);

// Start the server
const PORT = process.env.PORT || 3000;
const MINI_APP_URL = process.env.MINI_APP_URL || 'http://localhost:3001';

// Start Express server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Configure bot commands
bot.command('start', (ctx) => {
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

// Handle any text message - show the mini-app
bot.on('text', (ctx) => {
  // Skip if it's a command (already handled above)
  if (ctx.message.text.startsWith('/')) return;
  
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
});

// Start Telegram bot
bot.launch().catch((error: unknown) => {
  console.error("Error starting Telegram bot:", error);
});

// Handle shutdown
process.on('SIGTERM', () => {
  bot.stop('SIGTERM');
  process.exit();
});

process.on('SIGINT', () => {
  bot.stop('SIGINT');
  process.exit();
});
