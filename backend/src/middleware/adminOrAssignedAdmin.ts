import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { gameAdministrators, games } from '../db/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Middleware to check if the authenticated user is either:
 * 1. A global admin (isAdmin === true), OR
 * 2. An assigned administrator (has at least one gameAdministrators assignment)
 * 
 * This middleware should be used after the authMiddleware
 */
export const adminOrAssignedAdminMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Check if user exists and is authenticated
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  // Global admins always have access
  if (req.user.isAdmin) {
    return next();
  }

  // Check if user is an assigned administrator
  const assignments = await db
    .select()
    .from(gameAdministrators)
    .where(eq(gameAdministrators.userId, req.user.id))
    .limit(1);

  if (assignments.length === 0) {
    return res.status(403).json({ error: 'Admin or assigned administrator access required' });
  }

  // User is an assigned administrator, proceed
  next();
};

/**
 * Helper function to check if a user is assigned as administrator for a specific game
 * @param userId - The user ID to check
 * @param game - The game object with dateTime and withPositions
 * @returns true if the user is assigned to this game, false otherwise
 */
export async function isUserAssignedToGame(
  userId: number,
  game: { dateTime: Date | string; withPositions: boolean }
): Promise<boolean> {
  const gameDate = new Date(game.dateTime);
  // Get day of week (0=Monday, 6=Sunday)
  // JavaScript: 0=Sunday, 1=Monday, ..., 6=Saturday
  let dayOfWeek = gameDate.getDay();
  dayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to Monday=0 format

  const assignments = await db
    .select()
    .from(gameAdministrators)
    .where(
      and(
        eq(gameAdministrators.userId, userId),
        eq(gameAdministrators.dayOfWeek, dayOfWeek),
        eq(gameAdministrators.withPositions, game.withPositions)
      )
    )
    .limit(1);

  return assignments.length > 0;
}

/**
 * Helper function to check if a user is assigned as administrator for a game by gameId
 * @param userId - The user ID to check
 * @param gameId - The game ID
 * @returns true if the user is assigned to this game, false otherwise
 */
export async function isUserAssignedToGameById(
  userId: number,
  gameId: number
): Promise<boolean> {
  const gameResults = await db
    .select()
    .from(games)
    .where(eq(games.id, gameId))
    .limit(1);

  if (gameResults.length === 0) {
    return false;
  }

  const game = gameResults[0];
  return isUserAssignedToGame(userId, {
    dateTime: game.dateTime,
    withPositions: game.withPositions,
  });
}

