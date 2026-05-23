/** Parsed once at module load from POSITIONS_GAME_LEVEL_RESTRICTIONS_ENABLED. */
export const POSITIONS_GAME_LEVEL_RESTRICTIONS_ENABLED = (() => {
  const raw = process.env.POSITIONS_GAME_LEVEL_RESTRICTIONS_ENABLED;
  return raw === 'true' || raw === '1';
})();
