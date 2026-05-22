export type GameFormat = 'recreational' | 'positions' | 'priority_players';

export const GAME_FORMAT_OPTIONS: { value: GameFormat; label: string }[] = [
  { value: 'recreational', label: 'Recreational game' },
  { value: 'positions', label: 'With positions' },
  { value: 'priority_players', label: 'With priority players' },
];

export function isPositionsGame(format: GameFormat): boolean {
  return format === 'positions';
}

export function usesPriorityPlayerWindows(format: GameFormat): boolean {
  return format === 'priority_players';
}
