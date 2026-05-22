export type GameFormat = 'recreational' | 'positions' | 'priority_players';

const GAME_FORMATS: GameFormat[] = ['recreational', 'positions', 'priority_players'];

export function isGameFormat(value: unknown): value is GameFormat {
  return typeof value === 'string' && (GAME_FORMATS as string[]).includes(value);
}

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

/** Maps game format to game_administrators.with_positions (5-1 slot vs regular slot). */
export function gameFormatToAdminWithPositions(format: GameFormat): boolean {
  return format === 'positions';
}
