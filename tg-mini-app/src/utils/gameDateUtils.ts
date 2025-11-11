/** Number of days before a game when registration opens (must match server policy) */
export const DAYS_BEFORE_GAME_TO_JOIN = 10;
/** Number of days before a game when guest registration opens (must match server policy) */
export const DAYS_BEFORE_GAME_TO_REGISTER_GUEST = 3;
/** Number of days before a game when regular players can register (for games with priority players) */
export const REGULAR_PLAYER_REGISTRATION_OPEN_DAYS = 3;

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

export const canJoinGame = (gameDate: string, registrationOpensAt?: string): boolean => {
  const gameDateTime = new Date(gameDate);
  const now = new Date();
  
  // If registrationOpensAt is provided (from backend), use it
  if (registrationOpensAt) {
    const registrationOpenDate = new Date(registrationOpensAt);
    return now >= registrationOpenDate;
  }
  
  // Fallback to default 10 days
  const daysBeforeGame = new Date(gameDateTime.getTime());
  daysBeforeGame.setDate(daysBeforeGame.getDate() - DAYS_BEFORE_GAME_TO_JOIN);
  return now >= daysBeforeGame;
};

export const canRegisterGuest = (gameDate: string): boolean => {
  const gameDateTime = new Date(gameDate);
  const now = new Date();
  const daysBeforeGame = new Date(gameDateTime.getTime());
  daysBeforeGame.setDate(daysBeforeGame.getDate() - DAYS_BEFORE_GAME_TO_REGISTER_GUEST);
  return now >= daysBeforeGame;
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

export type GameCategory = 'thursday-5-1' | 'thursday-deti-plova' | 'sunday' | 'other';

/**
 * Get the display name for a game category
 * @param category - The game category
 * @returns The display name for the category
 */
export function getCategoryDisplayName(category: GameCategory): string {
  const names: Record<GameCategory, string> = {
    'thursday-5-1': 'Thursday 5-1',
    'thursday-deti-plova': 'Thursday Deti Plova',
    'sunday': 'Sunday',
    'other': 'Other'
  };
  return names[category];
}

/**
 * Classify a game into a category based on its date and whether it uses positions
 * @param dateTime - The game's date and time
 * @param withPositions - Whether the game uses positions (5-1 scheme)
 * @returns The game category
 */
export function classifyGame(dateTime: string, withPositions: boolean): GameCategory {
  const gameDate = new Date(dateTime);
  let dayOfWeek = gameDate.getDay();
  // Convert JavaScript day (0=Sunday, 1=Monday, ..., 6=Saturday) to Monday=0 format
  dayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  
  // Thursday = 3, Sunday = 6
  if (dayOfWeek === 3) { // Thursday
    return withPositions ? 'thursday-5-1' : 'thursday-deti-plova';
  } else if (dayOfWeek === 6) { // Sunday
    return 'sunday';
  } else {
    return 'other';
  }
}


