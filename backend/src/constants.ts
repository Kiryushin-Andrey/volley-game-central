export const REGISTRATION_OPEN_DAYS = 10;
export const GUEST_REGISTRATION_OPEN_DAYS = 3;
export const REGULAR_PLAYER_REGISTRATION_OPEN_DAYS = 3; // For games with priority players enabled

/** Default until flipped at deploy; overridden when `FIVE_ONE_LEVEL_RESTRICTIONS_ENABLED` is set. */
export const FIVE_ONE_LEVEL_RESTRICTIONS_ENABLED_DEFAULT = false;

function parseFiveOneEnvToggle(raw: string | undefined): boolean | undefined {
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (trimmed === '') return undefined;
  const lower = trimmed.toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(lower)) return true;
  return false;
}

/** Player-level gates for 5-1 (`with_positions`) games when enforcement is on. */
export function isFiveOneLevelRestrictionsEnabled(): boolean {
  const fromEnv = parseFiveOneEnvToggle(process.env.FIVE_ONE_LEVEL_RESTRICTIONS_ENABLED);
  if (fromEnv !== undefined) return fromEnv;
  return FIVE_ONE_LEVEL_RESTRICTIONS_ENABLED_DEFAULT;
}
