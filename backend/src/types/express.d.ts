import type { InferSelectModel } from 'drizzle-orm';
import type { users } from '../db/schema';

// Global Express Request augmentation used across the backend
// Keeps req.user aligned with the Drizzle users row type

declare global {
  namespace Express {
    interface Request {
      user?: InferSelectModel<typeof users>;
      telegramInitData?: string;
    }
  }
}

export {};
