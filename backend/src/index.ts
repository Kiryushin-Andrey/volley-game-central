/// <reference path="./types/express.d.ts" />
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import userRoutes from './routes/users';
import bunqRoutes from './routes/bunqConfig';
import gameRoutes from './routes/games';
import gamesAdminRoutes from './routes/gamesAdmin';
import usersAdminRoutes from './routes/usersAdmin';
import gameAdministratorsRoutes from './routes/gameAdministrators';
import gameAdministratorsMeRoutes from './routes/gameAdministratorsMe';
import priorityPlayersRoutes from './routes/priorityPlayers';
import authRoutes from './routes/auth';
import webhookRoutes from './routes/webhooks';
import './services/telegramService'; // Import to ensure the bot is initialized
import cookieParser from 'cookie-parser';
import { authMiddleware } from './middleware/auth';
import { adminAuthMiddleware } from './middleware/adminAuth';
import { adminOrAssignedAdminMiddleware } from './middleware/adminOrAssignedAdmin';

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
app.use(cookieParser());


// Public routes
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Public webhooks (no auth)
app.use('/webhooks', webhookRoutes);

// Public auth routes
app.use('/auth', authRoutes);

// Protected routes - accept Telegram WebApp auth or JWT cookie (phone auth)
app.use('/games', authMiddleware, gameRoutes);
app.use('/users', authMiddleware, userRoutes);
app.use('/users/me/bunq', authMiddleware, adminOrAssignedAdminMiddleware, bunqRoutes);

app.use('/games/admin', authMiddleware, adminOrAssignedAdminMiddleware, gamesAdminRoutes);
app.use('/users/admin', authMiddleware, adminOrAssignedAdminMiddleware, usersAdminRoutes);
app.use('/users/admin/id/:collectorUserId/bunq', authMiddleware, adminAuthMiddleware, bunqRoutes);
app.use('/game-administrators/me', authMiddleware, gameAdministratorsMeRoutes);
app.use('/game-administrators', authMiddleware, adminAuthMiddleware, gameAdministratorsRoutes);
app.use('/priority-players', authMiddleware, priorityPlayersRoutes);

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

