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


