export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isToday = date.toDateString() === today.toDateString();
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isToday) {
    return `Today, ${timeString}`;
  } else if (isTomorrow) {
    return `Tomorrow, ${timeString}`;
  } else {
    const day = date.getDate();
    const month = date.toLocaleString('en-US', { month: 'long' });
    const weekday = date.toLocaleString('en-US', { weekday: 'long' });
    return `${day} ${month}, ${weekday}, ${timeString}`;
  }
};

export const isGameUpcoming = (gameDate: string): boolean => {
  const gameDateTime = new Date(gameDate);
  const now = new Date();
  return gameDateTime > now;
};

export const isGamePast = (gameDate: string): boolean => {
  const gameDateTime = new Date(gameDate);
  const now = new Date();
  return gameDateTime <= now;
};

/** True when the backend registration window has opened. */
export const canJoinGame = (registrationOpensAt: string): boolean => {
  return new Date() >= new Date(registrationOpensAt);
};

export const canLeaveGame = (
  gameDate: string,
  isWaitlist: boolean,
  deadlineHours: number
): boolean => {
  if (isWaitlist) return true;

  const gameDateTime = new Date(gameDate);
  const now = new Date();
  const deadlineTime = new Date(gameDateTime.getTime());
  deadlineTime.setHours(deadlineTime.getHours() - deadlineHours);
  return now <= deadlineTime;
};

export type GameCategory = 'thursday-5-1' | 'sunday' | 'other';

export const GAME_CATEGORIES: GameCategory[] = ['thursday-5-1', 'sunday', 'other'];

/**
 * Get the display name for a game category
 * @param category - The game category
 * @returns The display name for the category
 */
export function getCategoryDisplayName(category: GameCategory): string {
  const names: Record<GameCategory, string> = {
    'thursday-5-1': 'Thursday 5-1',
    'sunday': 'Sunday',
    'other': 'Other'
  };
  return names[category];
}

