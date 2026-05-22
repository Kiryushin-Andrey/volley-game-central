import type { PlayerLevel } from '../types';

export const PLAYER_LEVEL_LABELS: Record<PlayerLevel, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export function playerLevelPillClass(level: PlayerLevel): string {
  return `level-pill level-pill--${level}`;
}
