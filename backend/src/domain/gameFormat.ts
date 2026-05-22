export type GameFormat = 'recreational' | 'positions' | 'priority_players';

export const GAME_FORMATS: readonly GameFormat[] = [
  'recreational',
  'positions',
  'priority_players',
] as const;

export function gameFormatFromLegacy(
  withPositions: boolean,
  withPriorityPlayers: boolean
): GameFormat {
  if (withPositions && withPriorityPlayers) {
    return 'recreational';
  }
  if (withPositions) {
    return 'positions';
  }
  if (withPriorityPlayers) {
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

/** Maps game format to game_administrators.withPositions (day/slot assignment). */
export function withPositionsForAdminAssignment(format: GameFormat): boolean {
  return isPositionsGame(format);
}

export function isValidGameFormat(value: unknown): value is GameFormat {
  return typeof value === 'string' && (GAME_FORMATS as readonly string[]).includes(value);
}
