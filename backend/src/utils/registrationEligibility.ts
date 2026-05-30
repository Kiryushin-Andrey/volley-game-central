import { eq, and, isNull } from 'drizzle-orm';
import { db } from '../db';
import { gameRegistrations, users } from '../db/schema';
import { POSITIONS_GAME_LEVEL_RESTRICTIONS_ENABLED } from '../config/positionsGameLevelRestrictions';
import {
  positionsGameRegistrationEligibility,
  type PositionsRegistrationEligibilityResult,
} from '../domain/positionsGameRegistrationEligibility';
import { asGameFormat, type GameFormat } from '../domain/gameFormat';
import { parsePlayerLevel, type PlayerLevel } from '../domain/playerLevel';

export type GameForEligibility = {
  dateTime: Date | string;
  gameFormat: GameFormat | string;
};

export async function userHasSelfRegistrationOnGame(
  userId: number,
  gameId: number,
): Promise<boolean> {
  const rows = await db
    .select({ id: gameRegistrations.id })
    .from(gameRegistrations)
    .where(
      and(
        eq(gameRegistrations.gameId, gameId),
        eq(gameRegistrations.userId, userId),
        isNull(gameRegistrations.guestName),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function getPlayerLevelForUser(userId: number): Promise<PlayerLevel | null> {
  const row = await db
    .select({ playerLevel: users.playerLevel })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row.length || !row[0].playerLevel) {
    return null;
  }
  return parsePlayerLevel(row[0].playerLevel);
}

export function computeSelfRegistrationEligibility(params: {
  game: GameForEligibility;
  playerLevel: PlayerLevel | null;
  now: Date;
  isGuestRegistration: boolean;
  hostCanSelfRegister: boolean;
  hasExistingSelfRegistration: boolean;
  baseRegistrationOpensAt: Date;
}): PositionsRegistrationEligibilityResult {
  return positionsGameRegistrationEligibility({
    gameFormat: asGameFormat(String(params.game.gameFormat)),
    playerLevel: params.playerLevel,
    restrictionsEnabled: POSITIONS_GAME_LEVEL_RESTRICTIONS_ENABLED,
    gameDateTime: new Date(params.game.dateTime),
    now: params.now,
    isGuestRegistration: params.isGuestRegistration,
    hostCanSelfRegister: params.hostCanSelfRegister,
    hasExistingSelfRegistration: params.hasExistingSelfRegistration,
    baseRegistrationOpensAt: params.baseRegistrationOpensAt,
  });
}
