import type { PlayerLevel } from '../types';

export type PlayerLevelFilter = 'all' | 'unassigned' | PlayerLevel;

export const PLAYER_LEVEL_FILTER_OPTIONS: { value: PlayerLevelFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'beginner', label: 'Beginner' },
];

export const PLAYER_LEVEL_LABELS: Record<PlayerLevel, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

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
