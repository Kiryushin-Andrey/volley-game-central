export type PlayerLevel = 'beginner' | 'intermediate' | 'advanced';

export const PLAYER_LEVELS: readonly PlayerLevel[] = [
  'beginner',
  'intermediate',
  'advanced',
] as const;

/** Sort key: unassigned → advanced → intermediate → beginner */
export function playerLevelSortGroup(level: PlayerLevel | null): number {
  if (level === null) return 0;
  if (level === 'advanced') return 1;
  if (level === 'intermediate') return 2;
  return 3;
}

export function compareUsersForPlayerLevelsList(
  a: { displayName: string; playerLevel: PlayerLevel | null },
  b: { displayName: string; playerLevel: PlayerLevel | null }
): number {
  const ga = playerLevelSortGroup(a.playerLevel);
  const gb = playerLevelSortGroup(b.playerLevel);
  if (ga !== gb) return ga - gb;
  return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' });
}

export function isValidPlayerLevel(value: unknown): value is PlayerLevel {
  return typeof value === 'string' && (PLAYER_LEVELS as readonly string[]).includes(value);
}
