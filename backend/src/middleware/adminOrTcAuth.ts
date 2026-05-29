import { Request, Response, NextFunction } from 'express';

/**
 * Middleware for player-levels admin routes: global administrators or TC members.
 * Must run after authMiddleware.
 */
export const adminOrTcAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!req.user.isAdmin && !req.user.isTc) {
    return res.status(403).json({ error: 'Admin or Technical Committee access required' });
  }

  next();
};
