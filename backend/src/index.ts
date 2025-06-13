import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { telegramAuthMiddleware } from './middleware/telegramAuth';
import userRoutes from './routes/users';
import gameRoutes from './routes/games';
import { db } from './db';
import './services/telegramService'; // Import to ensure the bot is initialized

// Initialize Express app
const app = express();
const corsOrigins = [
  'http://127.0.0.1',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
];
if (process.env.MINI_APP_URL) {
  corsOrigins.push(process.env.MINI_APP_URL);
}

app.use(cors({
  origin: corsOrigins,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


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

// Bot commands are now configured in telegramService.ts

// Handle shutdown - bot shutdown is handled in telegramService.ts
process.on('SIGTERM', () => {
  process.exit();
});

process.on('SIGINT', () => {
  process.exit();
});
