import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to check if the authenticated user is an admin
 * This middleware should be used after the telegramAuthMiddleware
 */
export const adminAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Check if user exists and is authenticated
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Check if user is an admin
  if (!req.user.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  // User is authenticated and is an admin, proceed
  next();
};
