import {
  asGameFormat,
  isPositionsGame,
  usesPriorityPlayerWindows,
  type GameFormat,
} from './gameFormat';
import {
  positionsGameRegistrationEligibility,
  type PositionsRegistrationEligibilityInput,
  type PositionsRegistrationEligibilityResult,
} from './positionsGameRegistrationEligibility';

/** Days before game start when base (priority / recreational) registration opens. */
export const REGISTRATION_OPEN_DAYS = 10;
/** Days before game start when guest registration opens. */
export const GUEST_REGISTRATION_OPEN_DAYS = 3;
/** Days before game start when non-priority players may register on priority-window games. */
export const REGULAR_PLAYER_REGISTRATION_OPEN_DAYS = 3;

export type GameCategory = 'thursday-5-1' | 'sunday' | 'other';

export const GAME_CATEGORIES: GameCategory[] = ['thursday-5-1', 'sunday', 'other'];

export type GameForPolicy = {
  dateTime: Date | string;
  gameFormat: GameFormat | string;
};

function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

/** Monday=0 … Sunday=6 (matches game_administrators.day_of_week). */
export function mondayBasedDayOfWeek(dateTime: Date | string): number {
  const gameDate = new Date(dateTime);
  const jsDay = gameDate.getDay(); // 0=Sunday … 6=Saturday
  return jsDay === 0 ? 6 : jsDay - 1;
}

/**
 * Classify a game for list/detail filtering and category UI.
 * Thursday + positions → thursday-5-1; Sunday + recreational → sunday; else other.
 */
export function classifyGame(game: GameForPolicy): GameCategory {
  const format = asGameFormat(String(game.gameFormat));
  const dayOfWeek = mondayBasedDayOfWeek(game.dateTime);

  if (dayOfWeek === 3) {
    // Thursday
    return isPositionsGame(format) ? 'thursday-5-1' : 'other';
  }
  if (dayOfWeek === 6) {
    // Sunday
    return format === 'recreational' ? 'sunday' : 'other';
  }
  return 'other';
}

/**
 * Day-count for when registration opens for a caller.
 * Priority-player table lookup stays outside; pass the boolean result here.
 */
export function registrationOpenDaysFor(params: {
  isGuest: boolean;
  gameFormat: GameFormat | string;
  isPriorityPlayer: boolean;
}): number {
  if (params.isGuest) {
    return GUEST_REGISTRATION_OPEN_DAYS;
  }

  const format = asGameFormat(String(params.gameFormat));
  if (usesPriorityPlayerWindows(format)) {
    return params.isPriorityPlayer
      ? REGISTRATION_OPEN_DAYS
      : REGULAR_PLAYER_REGISTRATION_OPEN_DAYS;
  }

  return REGISTRATION_OPEN_DAYS;
}

/** Instant when a registration window opens given a day count. */
export function registrationOpensAt(gameDateTime: Date | string, openDays: number): Date {
  return addDays(new Date(gameDateTime), -openDays);
}

export function baseRegistrationOpensAt(gameDateTime: Date | string): Date {
  return registrationOpensAt(gameDateTime, REGISTRATION_OPEN_DAYS);
}

export function guestRegistrationOpensAt(gameDateTime: Date | string): Date {
  return registrationOpensAt(gameDateTime, GUEST_REGISTRATION_OPEN_DAYS);
}

export function isRegistrationOpen(
  gameDateTime: Date | string,
  openDays: number,
  now: Date = new Date(),
): boolean {
  return now >= registrationOpensAt(gameDateTime, openDays);
}

/** Base 10-day window — used for group announcements and open-registration scans. */
export function isBaseRegistrationOpen(
  gameDateTime: Date | string,
  now: Date = new Date(),
): boolean {
  return isRegistrationOpen(gameDateTime, REGISTRATION_OPEN_DAYS, now);
}

export function isGuestRegistrationOpen(
  gameDateTime: Date | string,
  now: Date = new Date(),
): boolean {
  return isRegistrationOpen(gameDateTime, GUEST_REGISTRATION_OPEN_DAYS, now);
}

/**
 * Self/guest eligibility via the existing positions eligibility function.
 * Caller supplies baseRegistrationOpensAt from registrationOpenDaysFor + registrationOpensAt.
 */
export function evaluateRegistrationEligibility(
  input: PositionsRegistrationEligibilityInput,
): PositionsRegistrationEligibilityResult {
  return positionsGameRegistrationEligibility(input);
}
