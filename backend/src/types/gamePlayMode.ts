export const GAME_PLAY_MODES = ['with_positions', 'with_priority_players', 'regular'] as const;
export type GamePlayMode = (typeof GAME_PLAY_MODES)[number];

export const PLAYER_SKILL_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export type PlayerSkillLevel = (typeof PLAYER_SKILL_LEVELS)[number];

export function isWithPositionsPlayMode(mode: GamePlayMode): boolean {
  return mode === 'with_positions';
}

export function isWithPriorityPlayersPlayMode(mode: GamePlayMode): boolean {
  return mode === 'with_priority_players';
}

/** Maps game `play_mode` to `game_administrators.with_positions` (5-1 admin track vs regular). */
export function gameAdministratorsWithPositions(playMode: GamePlayMode): boolean {
  return playMode === 'with_positions';
}
