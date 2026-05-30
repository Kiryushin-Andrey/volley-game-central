export type PlayerLevel = 'beginner' | 'intermediate' | 'advanced';

export const PLAYER_LEVELS: PlayerLevel[] = ['beginner', 'intermediate', 'advanced'];

/** Sort rank for admin list: unassigned first, then advanced → intermediate → beginner. */
export const PLAYER_LEVEL_GROUP_ORDER: Record<PlayerLevel | 'unassigned', number> = {
  unassigned: 0,
  advanced: 1,
  intermediate: 2,
  beginner: 3,
};

export function parsePlayerLevel(value: unknown): PlayerLevel | null {
  if (typeof value !== 'string') {
    return null;
  }
  return PLAYER_LEVELS.includes(value as PlayerLevel) ? (value as PlayerLevel) : null;
}

export function compareUsersForPlayerLevelsList(
  a: { displayName: string; playerLevel: PlayerLevel | null },
  b: { displayName: string; playerLevel: PlayerLevel | null },
): number {
  const rankA = a.playerLevel ? PLAYER_LEVEL_GROUP_ORDER[a.playerLevel] : PLAYER_LEVEL_GROUP_ORDER.unassigned;
  const rankB = b.playerLevel ? PLAYER_LEVEL_GROUP_ORDER[b.playerLevel] : PLAYER_LEVEL_GROUP_ORDER.unassigned;
  if (rankA !== rankB) {
    return rankA - rankB;
  }
  return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' });
}
