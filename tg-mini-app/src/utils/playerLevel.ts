import type { PlayerLevel } from '../types';

export type PlayerLevelFilterOption = 'unassigned' | PlayerLevel;

export const PLAYER_LEVEL_FILTER_OPTIONS: { value: PlayerLevelFilterOption; label: string }[] = [
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'beginner', label: 'Beginner' },
];

export const ALL_PLAYER_LEVEL_FILTER_OPTIONS: PlayerLevelFilterOption[] =
  PLAYER_LEVEL_FILTER_OPTIONS.map((o) => o.value);

export function isShowingAllPlayerLevels(selected: PlayerLevelFilterOption[]): boolean {
  return selected.length === ALL_PLAYER_LEVEL_FILTER_OPTIONS.length;
}

export const PLAYER_LEVEL_LABELS: Record<PlayerLevel, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

/** Sort rank for admin list: unassigned first, then advanced → intermediate → beginner. */
const PLAYER_LEVEL_GROUP_ORDER: Record<PlayerLevel | 'unassigned', number> = {
  unassigned: 0,
  advanced: 1,
  intermediate: 2,
  beginner: 3,
};

export function comparePlayersForLevelsList(
  a: { displayName: string; playerLevel?: PlayerLevel | null },
  b: { displayName: string; playerLevel?: PlayerLevel | null },
): number {
  const rankA = a.playerLevel
    ? PLAYER_LEVEL_GROUP_ORDER[a.playerLevel]
    : PLAYER_LEVEL_GROUP_ORDER.unassigned;
  const rankB = b.playerLevel
    ? PLAYER_LEVEL_GROUP_ORDER[b.playerLevel]
    : PLAYER_LEVEL_GROUP_ORDER.unassigned;
  if (rankA !== rankB) {
    return rankA - rankB;
  }
  return a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' });
}

export function playerLevelPillClass(level: PlayerLevel): string {
  switch (level) {
    case 'advanced':
      return 'level-pill level-pill--advanced';
    case 'intermediate':
      return 'level-pill level-pill--intermediate';
    case 'beginner':
      return 'level-pill level-pill--beginner';
    default:
      return 'level-pill';
  }
}
