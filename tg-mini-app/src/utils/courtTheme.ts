import type { GameFormat } from '../types';

export type FormatTone = 'recreational' | 'positions' | 'priority';
export type CapacityKind = 'roster' | 'payments';

export function formatTone(format: GameFormat): FormatTone {
  if (format === 'positions') return 'positions';
  if (format === 'priority_players') return 'priority';
  return 'recreational';
}

export function formatPillLabel(format: GameFormat): string {
  if (format === 'positions') return 'Positions';
  if (format === 'priority_players') return 'Priority';
  return 'Recreational';
}

/** Classes the games list already uses for positions vs recreational, plus the court tone. */
export function formatCardClass(format: GameFormat): string {
  if (format === 'positions') return 'with-positions format-positions';
  if (format === 'priority_players') return 'format-priority';
  return 'without-positions format-recreational';
}

export function capacityRatio(count: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(1, Math.max(0, count / max));
}

/** A side of six (or fewer) reads as dots. Larger rosters use a bar. */
export function usesSpotDots(max: number, kind: CapacityKind): boolean {
  return kind === 'roster' && max > 0 && max <= 6;
}

export function benchOverflow(count: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, count - max);
}

export interface ListCapacity {
  count: number;
  max: number;
  kind: CapacityKind;
}

export function listCapacity(game: {
  paidCount?: number;
  registeredCount?: number;
  totalRegisteredCount: number;
  maxPlayers: number;
  readonly: boolean;
}): ListCapacity | null {
  if (game.readonly && game.paidCount === undefined) return null;
  if (game.paidCount !== undefined) {
    return { count: game.paidCount, max: game.totalRegisteredCount, kind: 'payments' };
  }
  if (game.registeredCount !== undefined) {
    return { count: game.registeredCount, max: game.maxPlayers, kind: 'roster' };
  }
  return { count: game.totalRegisteredCount, max: game.maxPlayers, kind: 'roster' };
}
