import { eq, and, isNull } from 'drizzle-orm';
import { db } from '../db';
import { gameRegistrations, users } from '../db/schema';
import { POSITIONS_GAME_LEVEL_RESTRICTIONS_ENABLED } from '../config/positionsGameLevelRestrictions';
import {
  positionsGameRegistrationEligibility,
  type PositionsRegistrationEligibilityResult,
} from '../domain/positionsGameRegistrationEligibility';
import { asGameFormat, isPositionsGame, type GameFormat } from '../domain/gameFormat';
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

/**
 * Positions level restrictions only (no priority windows or registration timing).
 * Waitlist/roster self-registration grandfathering still applies.
 */
export function spotOfferAcceptAllowedByLevel(params: {
  gameFormat: GameFormat;
  playerLevel: PlayerLevel | null;
  hasExistingSelfRegistration: boolean;
}): boolean {
  if (params.hasExistingSelfRegistration) {
    return true;
  }
  if (!POSITIONS_GAME_LEVEL_RESTRICTIONS_ENABLED) {
    return true;
  }
  if (!isPositionsGame(params.gameFormat)) {
    return true;
  }
  return params.playerLevel !== 'beginner';
}

export async function evaluateSpotOfferAcceptEligibility(params: {
  game: GameForEligibility & { id: number };
  acceptorUserId: number;
}): Promise<
  | { ok: true }
  | { ok: false; code: 'ineligible'; status: 403; error: string }
> {
  const hasExistingSelfRegistration = await userHasSelfRegistrationOnGame(
    params.acceptorUserId,
    params.game.id,
  );
  const playerLevel = await getPlayerLevelForUser(params.acceptorUserId);

  if (
    !spotOfferAcceptAllowedByLevel({
      gameFormat: asGameFormat(String(params.game.gameFormat)),
      playerLevel,
      hasExistingSelfRegistration,
    })
  ) {
    return {
      ok: false,
      code: 'ineligible',
      status: 403,
      error: 'You cannot register for this game at the moment.',
    };
  }

  return { ok: true };
}

/** For GET /games/:id — whether the viewer may accept an open spot offer. */
export async function canUserAcceptSpotOfferOnGame(params: {
  game: GameForEligibility & { id: number };
  userId: number;
}): Promise<boolean> {
  const hasExistingSelfRegistration = await userHasSelfRegistrationOnGame(
    params.userId,
    params.game.id,
  );
  const playerLevel = await getPlayerLevelForUser(params.userId);
  return spotOfferAcceptAllowedByLevel({
    gameFormat: asGameFormat(String(params.game.gameFormat)),
    playerLevel,
    hasExistingSelfRegistration,
  });
}
