import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db';
import { gameRegistrations, games, users } from '../db/schema';
import { POSITIONS_GAME_LEVEL_RESTRICTIONS_ENABLED } from '../config/positionsGameLevelRestrictions';
import {
  asGameFormat,
  type GameFormat,
  usesPriorityPlayerWindows,
} from '../domain/gameFormat';
import {
  evaluateRegistrationEligibility,
  GUEST_REGISTRATION_OPEN_DAYS,
  REGISTRATION_OPEN_DAYS,
  registrationOpenDaysFor,
  registrationOpensAt,
} from '../domain/gamePolicy';
import type { PlayerLevel } from '../domain/playerLevel';
import type { PositionsRegistrationBlockReason } from '../domain/positionsGameRegistrationEligibility';
import {
  getPlayerLevelForUser,
  userHasSelfRegistrationOnGame,
} from '../utils/registrationEligibility';

type GameRow = typeof games.$inferSelect;
type RegistrationRow = typeof gameRegistrations.$inferSelect;

/** Registration row ordered by createdAt, used for waitlist position and promotion. */
export type OrderedRegistration = {
  id?: number;
  userId: number;
  guestName?: string | null;
  createdAt?: Date | string | null;
};

/** Whether the registration at `index` (0-based, createdAt order) is on the waitlist. */
export function isWaitlistAtIndex(index: number, maxPlayers: number): boolean {
  return index >= 0 && index >= maxPlayers;
}

export function findRegistrationIndex(
  ordered: ReadonlyArray<OrderedRegistration>,
  match: { id?: number; userId?: number; guestName?: string | null },
): number {
  return ordered.findIndex((reg) => {
    if (match.id !== undefined) {
      return reg.id === match.id;
    }
    if (match.userId === undefined) {
      return false;
    }
    const regGuest = reg.guestName ?? null;
    const matchGuest = match.guestName ?? null;
    return reg.userId === match.userId && regGuest === matchGuest;
  });
}

/**
 * After a roster (non-waitlist) removal, the registration that slides into the
 * last roster slot is promoted. Ordered list must already exclude the removed row.
 */
function promotionOnUnregister(
  orderedAfterRemoval: ReadonlyArray<OrderedRegistration>,
  maxPlayers: number,
  removedWasOnRoster: boolean,
): OrderedRegistration | null {
  if (!removedWasOnRoster) {
    return null;
  }
  if (orderedAfterRemoval.length < maxPlayers) {
    return null;
  }
  return orderedAfterRemoval[maxPlayers - 1] ?? null;
}

type RegistrationWindowDecision =
  | {
      allowed: true;
      registrationOpenDays: number;
      baseRegistrationOpensAt: Date;
      registrationOpensAt: Date;
    }
  | {
      allowed: false;
      blockReason: PositionsRegistrationBlockReason;
      registrationOpenDays: number;
      baseRegistrationOpensAt: Date;
      registrationOpensAt: Date;
    };

/**
 * Whether a player may self-register now: open timing from gamePolicy, plus
 * level/guest rules from evaluateRegistrationEligibility. Does not invent its own windows.
 */
function evaluateRegistrationWindow(params: {
  now: Date;
  gameDateTime: Date;
  gameFormat: GameFormat;
  isGuest: boolean;
  isPriorityPlayer: boolean;
  playerLevel: PlayerLevel | null;
  restrictionsEnabled: boolean;
  hostCanSelfRegister: boolean;
  hasExistingSelfRegistration: boolean;
}): RegistrationWindowDecision {
  const registrationOpenDays = registrationOpenDaysFor({
    isGuest: params.isGuest,
    gameFormat: params.gameFormat,
    isPriorityPlayer: params.isPriorityPlayer,
  });
  const baseOpensAt = registrationOpensAt(params.gameDateTime, registrationOpenDays);
  const eligibility = evaluateRegistrationEligibility({
    gameFormat: params.gameFormat,
    playerLevel: params.playerLevel,
    restrictionsEnabled: params.restrictionsEnabled,
    gameDateTime: params.gameDateTime,
    now: params.now,
    isGuestRegistration: params.isGuest,
    hostCanSelfRegister: params.hostCanSelfRegister,
    hasExistingSelfRegistration: params.hasExistingSelfRegistration,
    baseRegistrationOpensAt: baseOpensAt,
  });

  if (!eligibility.canSelfRegister) {
    return {
      allowed: false,
      blockReason: eligibility.blockReason,
      registrationOpenDays,
      baseRegistrationOpensAt: baseOpensAt,
      registrationOpensAt: eligibility.registrationOpensAt,
    };
  }

  return {
    allowed: true,
    registrationOpenDays,
    baseRegistrationOpensAt: baseOpensAt,
    registrationOpensAt: eligibility.registrationOpensAt,
  };
}

export type PlaceRegistrationInput = {
  game: GameRow;
  userId: number;
  guestName?: string | null;
  bringingTheBall?: boolean;
  isPriorityPlayer: boolean;
  /** When placing a guest, whether the host may self-register (policy). */
  hostCanSelfRegister?: boolean;
  now?: Date;
};

export type PlaceRegistrationResult =
  | {
      ok: true;
      registration: RegistrationRow;
      position: number;
      isWaitlist: boolean;
    }
  | {
      ok: false;
      code:
        | 'readonly'
        | 'duplicate'
        | 'closed_window'
        | 'level_blocked';
      status: 400 | 403;
      error: string;
      registrationOpensAt?: Date;
      gameDateTime?: Date;
      registrationOpenDays?: number;
    };

export type RemoveRegistrationInput = {
  game: GameRow;
  userId: number;
  guestName?: string | null;
  now?: Date;
};

export type RemoveRegistrationResult =
  | {
      ok: true;
      removedWasOnRoster: boolean;
      promoted: OrderedRegistration | null;
      registrationDetails: RegistrationRow | null;
    }
  | {
      ok: false;
      code: 'readonly' | 'not_found' | 'deadline';
      status: 403 | 404;
      error: string;
      gameDateTime?: Date;
      deadline?: Date;
    };

async function loadOrderedRegistrations(gameId: number): Promise<RegistrationRow[]> {
  return db
    .select()
    .from(gameRegistrations)
    .where(eq(gameRegistrations.gameId, gameId))
    .orderBy(gameRegistrations.createdAt);
}

export async function placeRegistration(
  input: PlaceRegistrationInput,
): Promise<PlaceRegistrationResult> {
  const { game, userId } = input;
  const now = input.now ?? new Date();
  const guestName = input.guestName ?? null;
  const isGuest = !!guestName;

  if (game.readonly) {
    return {
      ok: false,
      code: 'readonly',
      status: 403,
      error:
        'This game is readonly. Registration is closed. Please contact the game organizers if you have any questions.',
    };
  }

  const playerLevel = await getPlayerLevelForUser(userId);
  const hasExistingSelfRegistration = await userHasSelfRegistrationOnGame(
    userId,
    game.id,
  );

  const gameFormat = asGameFormat(game.gameFormat);
  const gameDateTime = game.dateTime;

  let hostCanSelfRegister = input.hostCanSelfRegister ?? true;
  if (isGuest && input.hostCanSelfRegister === undefined) {
    const hostWindow = evaluateRegistrationWindow({
      now,
      gameDateTime,
      gameFormat,
      isGuest: false,
      isPriorityPlayer: input.isPriorityPlayer,
      playerLevel,
      restrictionsEnabled: POSITIONS_GAME_LEVEL_RESTRICTIONS_ENABLED,
      hostCanSelfRegister: true,
      hasExistingSelfRegistration,
    });
    hostCanSelfRegister = hostWindow.allowed;
  }

  const windowDecision = evaluateRegistrationWindow({
    now,
    gameDateTime,
    gameFormat,
    isGuest,
    isPriorityPlayer: input.isPriorityPlayer,
    playerLevel,
    restrictionsEnabled: POSITIONS_GAME_LEVEL_RESTRICTIONS_ENABLED,
    hostCanSelfRegister,
    hasExistingSelfRegistration,
  });

  if (!windowDecision.allowed) {
    if (windowDecision.blockReason === 'level') {
      return {
        ok: false,
        code: 'level_blocked',
        status: 403,
        error: 'You cannot register for this game at the moment.',
        registrationOpensAt: windowDecision.registrationOpensAt,
      };
    }

    const errorMessage = isGuest
      ? `Guest registration is only possible starting ${GUEST_REGISTRATION_OPEN_DAYS} days before the game`
      : usesPriorityPlayerWindows(gameFormat)
        ? `Registration is only possible starting ${windowDecision.registrationOpenDays} days before the game`
        : `Registration is only possible starting ${REGISTRATION_OPEN_DAYS} days before the game`;

    return {
      ok: false,
      code: 'closed_window',
      status: 403,
      error: errorMessage,
      gameDateTime,
      registrationOpensAt: windowDecision.registrationOpensAt,
      registrationOpenDays: windowDecision.registrationOpenDays,
    };
  }

  const isSelfRegistration = !guestName;
  const existingRegistration = await db
    .select()
    .from(gameRegistrations)
    .where(
      and(
        eq(gameRegistrations.gameId, game.id),
        eq(gameRegistrations.userId, userId),
        isSelfRegistration
          ? isNull(gameRegistrations.guestName)
          : eq(gameRegistrations.guestName, guestName!),
      ),
    );

  if (existingRegistration.length > 0) {
    return {
      ok: false,
      code: 'duplicate',
      status: 400,
      error: isSelfRegistration
        ? 'User already registered for this game'
        : 'This guest is already registered for this game',
    };
  }

  const inserted = await db
    .insert(gameRegistrations)
    .values({
      gameId: game.id,
      userId,
      guestName,
      bringingTheBall: input.bringingTheBall || false,
    })
    .returning();

  const allRegistrations = await loadOrderedRegistrations(game.id);
  const position = findRegistrationIndex(allRegistrations, { id: inserted[0].id });
  const isWaitlist = isWaitlistAtIndex(position, game.maxPlayers);

  return {
    ok: true,
    registration: inserted[0],
    position,
    isWaitlist,
  };
}

export async function removeRegistration(
  input: RemoveRegistrationInput,
): Promise<RemoveRegistrationResult> {
  const { game, userId } = input;
  const guestName = input.guestName;
  const now = input.now ?? new Date();

  if (game.readonly) {
    return {
      ok: false,
      code: 'readonly',
      status: 403,
      error:
        'This game is readonly. Deregistration is closed. Please contact the game organizers if you have any questions.',
    };
  }

  const allRegistrations = await loadOrderedRegistrations(game.id);
  const targetIndex = findRegistrationIndex(allRegistrations, {
    userId,
    guestName: guestName ?? null,
  });

  if (targetIndex === -1) {
    return {
      ok: false,
      code: 'not_found',
      status: 404,
      error: 'Registration not found',
    };
  }

  const removedWasOnRoster = !isWaitlistAtIndex(targetIndex, game.maxPlayers);

  if (removedWasOnRoster) {
    const gameDateTime = new Date(game.dateTime);
    const deadlineHours = game.unregisterDeadlineHours || 5;
    const deadlineBeforeGame = new Date(gameDateTime);
    deadlineBeforeGame.setHours(deadlineBeforeGame.getHours() - deadlineHours);

    if (now > deadlineBeforeGame) {
      return {
        ok: false,
        code: 'deadline',
        status: 403,
        error: `You can only unregister up to ${deadlineHours} hours before the game starts`,
        gameDateTime,
        deadline: deadlineBeforeGame,
      };
    }
  }

  const registrationDetails = allRegistrations[targetIndex] ?? null;

  await db
    .delete(gameRegistrations)
    .where(
      and(
        eq(gameRegistrations.gameId, game.id),
        eq(gameRegistrations.userId, userId),
        guestName
          ? eq(gameRegistrations.guestName, guestName)
          : isNull(gameRegistrations.guestName),
      ),
    );

  const updated = await loadOrderedRegistrations(game.id);
  const promoted = promotionOnUnregister(
    updated,
    game.maxPlayers,
    removedWasOnRoster,
  );

  return {
    ok: true,
    removedWasOnRoster,
    promoted,
    registrationDetails,
  };
}

export function mapRegistrationsWithWaitlist<T extends OrderedRegistration>(
  ordered: ReadonlyArray<T>,
  maxPlayers: number,
): Array<T & { isWaitlist: boolean }> {
  return ordered.map((reg, index) => ({
    ...reg,
    isWaitlist: isWaitlistAtIndex(index, maxPlayers),
  }));
}

/** Registrations that move from waitlist onto the roster when capacity increases. */
export function capacityPromotions<T extends OrderedRegistration>(
  ordered: ReadonlyArray<T>,
  originalMaxPlayers: number,
  newMaxPlayers: number,
): T[] {
  if (newMaxPlayers <= originalMaxPlayers) {
    return [];
  }
  return ordered.slice(originalMaxPlayers, newMaxPlayers);
}

export async function getUserById(userId: number) {
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return rows[0] ?? null;
}
