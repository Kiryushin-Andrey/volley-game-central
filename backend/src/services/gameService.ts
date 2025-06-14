import { db } from '../db';
import { games } from '../db/schema';
import { desc } from 'drizzle-orm';

/**
 * Game service functions
 */
export const gameService = {
  /**
   * Calculate default date and time for a new game
   * Finds the game with the latest createdAt timestamp and returns its date + 1 week
   * If no games exist, returns the current date + 1 week
   */
  calculateDefaultDateTime: async (): Promise<Date> => {
    try {
      // Find the game with the latest createdAt timestamp
      const latestGames = await db.select()
        .from(games)
        .orderBy(desc(games.createdAt))
        .limit(1);
      
      let defaultDate: Date;
      
      if (latestGames.length > 0) {
        // Use the latest game's date + 1 week
        const latestGame = latestGames[0];
        defaultDate = new Date(latestGame.dateTime);
        defaultDate.setDate(defaultDate.getDate() + 7); // Add 1 week
      } else {
        // If no games exist, use current date + 1 week
        defaultDate = new Date();
        defaultDate.setDate(defaultDate.getDate() + 7);
      }
      
      return defaultDate;
    } catch (error) {
      console.error('Error calculating default date time:', error);
      // Fallback to current date + 1 week
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 7);
      return defaultDate;
    }
  }
};
