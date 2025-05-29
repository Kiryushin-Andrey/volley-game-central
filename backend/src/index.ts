import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Telegraf } from 'telegraf';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import gameRoutes from './routes/games';
import { db } from './db';

// Initialize Express app
const app = express();
const corsOrigins = ['http://127.0.0.1'];
if (process.env.CORS_ORIGIN) {
  corsOrigins.push(process.env.CORS_ORIGIN);
}

app.use(cors({
  origin: corsOrigins,
  credentials: true
}));
app.use(express.json());

// Initialize Telegram bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');

// Routes
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/games', gameRoutes);

// Start the server
const PORT = process.env.PORT || 3000;

// Start Express server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
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
