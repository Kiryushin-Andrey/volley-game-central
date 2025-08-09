import { db } from '../db';
import { games } from '../db/schema';
import { desc } from 'drizzle-orm';

/**
 * Game service functions
 */
export const gameService = {
  /**
   * Calculate default date/time and suggest location based on last game on same weekday.
   */
  calculateDefaultDateTime: async (): Promise<{ defaultDateTime: Date; defaultLocationName?: string | null; defaultLocationLink?: string | null }> => {
    try {
      // Find the game with the latest createdAt timestamp
      const latestGames = await db
        .select()
        .from(games)
        .orderBy(desc(games.createdAt))
        .limit(1);

      let defaultDate: Date;

      if (latestGames.length > 0) {
        // Use the latest game's date + 1 week
        const latestGame = latestGames[0];
        defaultDate = new Date(latestGame.dateTime);
        defaultDate.setDate(defaultDate.getDate() + 7);
      } else {
        // If no games exist, use current date + 1 week
        defaultDate = new Date();
        defaultDate.setDate(defaultDate.getDate() + 7);
      }

      // Prefill location from the most recent game on the same weekday
      const targetWeekday = defaultDate.getDay(); // 0-6
      const recentGames = await db
        .select()
        .from(games)
        .orderBy(desc(games.dateTime))
        .limit(50);

      const matching = recentGames.find((g: any) => {
        const d = new Date(g.dateTime);
        return d.getDay() === targetWeekday && (g.locationName || g.locationLink);
      });

      return {
        defaultDateTime: defaultDate,
        defaultLocationName: matching?.locationName ?? null,
        defaultLocationLink: matching?.locationLink ?? null,
      };
    } catch (error) {
      console.error('Error calculating default date time:', error);
      // Fallback to current date + 1 week with no location suggestion
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 7);
      return { defaultDateTime: defaultDate, defaultLocationName: null, defaultLocationLink: null };
    }
  },
};
