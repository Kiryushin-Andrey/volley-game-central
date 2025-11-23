export const isTelegramApp = (): boolean => {
  return Boolean(window.Telegram?.WebApp?.initDataUnsafe?.user);
};

/**
 * Extended interface for Telegram WebApp initDataUnsafe with start_param
 */
interface TelegramInitDataUnsafe {
  user?: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    photo_url?: string;
  };
  start_param?: string;
  [key: string]: any;
}

/**
 * Get the start parameter from Telegram WebApp
 * This parameter is passed when the mini app is opened with a deep link
 * Format: game_{gameId} for game deep links
 */
export const getTelegramStartParam = (): string | null => {
  if (!window.Telegram?.WebApp) {
    return null;
  }

  // Cast initDataUnsafe to extended type that includes start_param
  const initDataUnsafe = window.Telegram.WebApp.initDataUnsafe as TelegramInitDataUnsafe;
  const startParam = initDataUnsafe?.start_param;

  if (startParam) {
    return startParam;
  }

  return null;
};

/**
 * Parse game ID from start parameter
 * Expected format: game_{gameId}
 * Returns null if the format is invalid or no game ID is present
 */
export const parseGameIdFromStartParam = (startParam: string | null): number | null => {
  if (!startParam) {
    return null;
  }

  // Check if it matches the game_{id} format
  const match = startParam.match(/^game_(\d+)$/);
  if (match && match[1]) {
    const gameId = parseInt(match[1], 10);
    if (!isNaN(gameId)) {
      return gameId;
    }
  }

  return null;
};
