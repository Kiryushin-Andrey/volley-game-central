import { Request, Response, NextFunction } from 'express';
import { canManagePlayerLevels } from '../domain/userRoles';

/**
 * Allows global admins and TC users to manage player levels.
 * Use after authMiddleware.
 */
export const tcOrAdminAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!canManagePlayerLevels(req.user)) {
    return res.status(403).json({ error: 'Player level management access required' });
  }

  next();
};
