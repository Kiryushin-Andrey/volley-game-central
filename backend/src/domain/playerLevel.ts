export type PlayerLevel = 'beginner' | 'intermediate' | 'advanced';

export const PLAYER_LEVELS: readonly PlayerLevel[] = [
  'beginner',
  'intermediate',
  'advanced',
] as const;

/** List order: unassigned → advanced → intermediate → beginner (alphabetical within group). */
export const PLAYER_LEVEL_LIST_GROUP_ORDER: Record<string, number> = {
  unassigned: 0,
  advanced: 1,
  intermediate: 2,
  beginner: 3,
};

export function isValidPlayerLevel(value: unknown): value is PlayerLevel {
  return typeof value === 'string' && (PLAYER_LEVELS as readonly string[]).includes(value);
}

export function playerLevelListGroupKey(level: PlayerLevel | null | undefined): keyof typeof PLAYER_LEVEL_LIST_GROUP_ORDER {
  if (level == null) return 'unassigned';
  return level;
}

export function compareUsersForPlayerLevelsList(
  a: { displayName: string; playerLevel: PlayerLevel | null },
  b: { displayName: string; playerLevel: PlayerLevel | null },
): number {
  const groupDiff =
    PLAYER_LEVEL_LIST_GROUP_ORDER[playerLevelListGroupKey(a.playerLevel)] -
    PLAYER_LEVEL_LIST_GROUP_ORDER[playerLevelListGroupKey(b.playerLevel)];
  if (groupDiff !== 0) return groupDiff;
  return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' });
}
