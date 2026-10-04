export type GameFormat = 'recreational' | 'positions' | 'priority_players';

export function isPositionsGame(format: GameFormat): boolean {
  return format === 'positions';
}

/** Default leave/unregister freeze window for recreational and priority-players games. */
export const DEFAULT_UNREGISTER_DEADLINE_HOURS_RECREATIONAL = 5;

/** Default leave/unregister freeze window for positions games. */
export const DEFAULT_UNREGISTER_DEADLINE_HOURS_POSITIONS = 24;

/** Suggested unregisterDeadlineHours when creating a game of the given format. */
export function defaultUnregisterDeadlineHours(format: GameFormat): number {
  return isPositionsGame(format)
    ? DEFAULT_UNREGISTER_DEADLINE_HOURS_POSITIONS
    : DEFAULT_UNREGISTER_DEADLINE_HOURS_RECREATIONAL;
}

export function usesPriorityPlayerWindows(format: GameFormat): boolean {
  return format === 'priority_players';
}

export function parseGameFormat(value: string): GameFormat | null {
  if (value === 'recreational' || value === 'positions' || value === 'priority_players') {
    return value;
  }
  return null;
}

export const GAME_FORMAT_OPTIONS: { value: GameFormat; label: string }[] = [
  { value: 'recreational', label: 'Recreational game' },
  { value: 'positions', label: 'With positions' },
  { value: 'priority_players', label: 'With priority players' },
];
