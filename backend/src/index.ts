import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { telegramAuthMiddleware } from './middleware/telegramAuth';
import userRoutes from './routes/users';
import gameRoutes from './routes/games';
import './services/telegramService'; // Import to ensure the bot is initialized
import { db } from './db';
import { users } from './db/schema';
import { eq } from 'drizzle-orm';

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

// Public: check whether a user with specified phone number is registered
app.post('/users/phone-exists', async (req, res) => {
  try {
    const { phoneNumber } = req.body as { phoneNumber?: string };
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return res.status(400).json({ error: 'phoneNumber is required' });
    }

    // Normalize phone: remove spaces, hyphens, parentheses
    const normalized = phoneNumber.replace(/[\s\-()]/g, '');
    if (normalized.length < 5) {
      return res.status(400).json({ error: 'phoneNumber is invalid' });
    }

    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.phoneNumber, normalized));

    return res.json({ exists: rows.length > 0 });
  } catch (err) {
    console.error('Error checking phone existence:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
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

