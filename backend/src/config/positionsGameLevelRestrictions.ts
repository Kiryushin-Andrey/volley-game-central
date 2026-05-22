/** Parsed once at process start. Truthy: `true` or `1`; unset/false = off. */
function parsePositionsGameLevelRestrictionsEnabled(): boolean {
  const raw = process.env.POSITIONS_GAME_LEVEL_RESTRICTIONS_ENABLED;
  if (!raw) return false;
  const normalized = raw.trim().toLowerCase();
  return normalized === 'true' || normalized === '1';
}

export const positionsGameLevelRestrictionsEnabled =
  parsePositionsGameLevelRestrictionsEnabled();
