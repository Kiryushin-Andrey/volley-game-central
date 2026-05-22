/** Parsed once at module load (process startup). */
function parsePositionsGameLevelRestrictionsEnabled(): boolean {
  const raw = process.env.POSITIONS_GAME_LEVEL_RESTRICTIONS_ENABLED;
  return raw === 'true' || raw === '1';
}

export const POSITIONS_GAME_LEVEL_RESTRICTIONS_ENABLED =
  parsePositionsGameLevelRestrictionsEnabled();
