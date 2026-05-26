import { alias } from 'drizzle-orm/pg-core';
import { eq } from 'drizzle-orm';
import { users } from '../db/schema';
import type { PlayerLevel } from '../domain/playerLevel';

export const playerLevelSetter = alias(users, 'player_level_setter');

export type PlayerLevelSetBy = {
  id: number;
  displayName: string;
};

export type UserPlayerLevelMetadata = {
  playerLevel: PlayerLevel | null;
  playerLevelSetBy: PlayerLevelSetBy | null;
  playerLevelSetAt: string | null;
};

type RowWithSetter = {
  playerLevel: string | null;
  playerLevelSetAt: Date | null;
  setterId: number | null;
  setterDisplayName: string | null;
};

export function mapPlayerLevelMetadata(row: RowWithSetter): UserPlayerLevelMetadata {
  return {
    playerLevel: (row.playerLevel as PlayerLevel | null) ?? null,
    playerLevelSetBy:
      row.setterId != null && row.setterDisplayName
        ? { id: row.setterId, displayName: row.setterDisplayName }
        : null,
    playerLevelSetAt: row.playerLevelSetAt ? row.playerLevelSetAt.toISOString() : null,
  };
}

export const playerLevelMetadataSelect = {
  playerLevel: users.playerLevel,
  playerLevelSetAt: users.playerLevelSetAt,
  setterId: playerLevelSetter.id,
  setterDisplayName: playerLevelSetter.displayName,
} as const;

export const playerLevelMetadataJoin = () =>
  eq(users.playerLevelSetById, playerLevelSetter.id);

export function attachPlayerLevelMetadataToUser<T extends Record<string, unknown>>(
  user: T,
  row: RowWithSetter,
  includeMetadata: boolean,
): T & Partial<UserPlayerLevelMetadata> {
  if (!includeMetadata) {
    return user;
  }
  return { ...user, ...mapPlayerLevelMetadata(row) };
}
