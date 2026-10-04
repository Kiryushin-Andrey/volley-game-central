export type GameFormat = 'recreational' | 'positions' | 'priority_players';

export const GAME_FORMATS: GameFormat[] = ['recreational', 'positions', 'priority_players'];

export function gameFormatFromLegacy(
  withPositions: boolean,
  withPriorityPlayers: boolean,
): GameFormat {
  if (withPositions && !withPriorityPlayers) {
    return 'positions';
  }
  if (!withPositions && withPriorityPlayers) {
    return 'priority_players';
  }
  return 'recreational';
}

export function isPositionsGame(format: GameFormat): boolean {
  return format === 'positions';
}

export function usesPriorityPlayerWindows(format: GameFormat): boolean {
  return format === 'priority_players';
}

/** Maps game format to game_administrators.with_positions for day/slot assignment lookup. */
export function adminAssignmentWithPositionsForGameFormat(format: GameFormat): boolean {
  return isPositionsGame(format);
}

export function parseGameFormat(value: unknown): GameFormat | null {
  if (typeof value !== 'string') {
    return null;
  }
  return GAME_FORMATS.includes(value as GameFormat) ? (value as GameFormat) : null;
}

export function asGameFormat(value: string): GameFormat {
  return parseGameFormat(value) ?? 'recreational';
}
