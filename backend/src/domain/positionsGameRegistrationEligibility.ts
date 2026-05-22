import { isPositionsGame, type GameFormat } from './gameFormat';
import type { PlayerLevel } from './playerLevel';

export type RegistrationBlockReason = 'level' | 'timing' | null;

/** Days before game start when intermediate players may self-register for positions games. */
export const INTERMEDIATE_POSITIONS_REGISTRATION_DAYS = 3;

export interface PositionsGameRegistrationEligibilityInput {
  gameFormat: GameFormat;
  playerLevel: PlayerLevel | null;
  restrictionsEnabled: boolean;
  gameDateTime: Date;
  now: Date;
  isGuestRegistration: boolean;
  hostCanSelfRegister: boolean;
  baseRegistrationOpensAt: Date;
}

export interface PositionsGameRegistrationEligibilityResult {
  canSelfRegister: boolean;
  registrationOpensAt: Date;
  blockReason: RegistrationBlockReason;
}

function subtractDaysFromGameStart(gameDateTime: Date, days: number): Date {
  const opens = new Date(gameDateTime.getTime());
  opens.setDate(opens.getDate() - days);
  return opens;
}

function laterDate(a: Date, b: Date): Date {
  return a.getTime() >= b.getTime() ? a : b;
}

function timingResult(
  baseRegistrationOpensAt: Date,
  now: Date,
): PositionsGameRegistrationEligibilityResult {
  if (now < baseRegistrationOpensAt) {
    return {
      canSelfRegister: false,
      registrationOpensAt: baseRegistrationOpensAt,
      blockReason: 'timing',
    };
  }
  return {
    canSelfRegister: true,
    registrationOpensAt: baseRegistrationOpensAt,
    blockReason: null,
  };
}

function selfEligibilityForPositionsWithRestrictions(
  input: Omit<
    PositionsGameRegistrationEligibilityInput,
    'isGuestRegistration' | 'hostCanSelfRegister'
  >,
): PositionsGameRegistrationEligibilityResult {
  const { playerLevel, gameDateTime, now, baseRegistrationOpensAt } = input;

  if (playerLevel === 'beginner') {
    return {
      canSelfRegister: false,
      registrationOpensAt: baseRegistrationOpensAt,
      blockReason: 'level',
    };
  }

  if (playerLevel === 'intermediate') {
    const intermediateOpensAt = subtractDaysFromGameStart(
      gameDateTime,
      INTERMEDIATE_POSITIONS_REGISTRATION_DAYS,
    );
    const effectiveOpensAt = laterDate(baseRegistrationOpensAt, intermediateOpensAt);
    if (now < effectiveOpensAt) {
      return {
        canSelfRegister: false,
        registrationOpensAt: effectiveOpensAt,
        blockReason: 'level',
      };
    }
    return {
      canSelfRegister: true,
      registrationOpensAt: effectiveOpensAt,
      blockReason: null,
    };
  }

  return timingResult(baseRegistrationOpensAt, now);
}

/**
 * Pure eligibility for self-serve registration (host or participant).
 * Grandfathered roster/waitlist spots are not removed by this module; re-registration after leave uses normal rules.
 */
export function positionsGameRegistrationEligibility(
  input: PositionsGameRegistrationEligibilityInput,
): PositionsGameRegistrationEligibilityResult {
  const {
    gameFormat,
    playerLevel,
    restrictionsEnabled,
    gameDateTime,
    now,
    isGuestRegistration,
    hostCanSelfRegister,
    baseRegistrationOpensAt,
  } = input;

  if (isGuestRegistration) {
    if (!hostCanSelfRegister) {
      return {
        canSelfRegister: false,
        registrationOpensAt: baseRegistrationOpensAt,
        blockReason: 'level',
      };
    }
    return timingResult(baseRegistrationOpensAt, now);
  }

  const appliesLevelRestrictions =
    restrictionsEnabled && isPositionsGame(gameFormat);

  if (!appliesLevelRestrictions) {
    return timingResult(baseRegistrationOpensAt, now);
  }

  return selfEligibilityForPositionsWithRestrictions({
    gameFormat,
    playerLevel,
    restrictionsEnabled,
    gameDateTime,
    now,
    baseRegistrationOpensAt,
  });
}

/** Host self-serve eligibility (no guest flag) — used before guest registration. */
export function hostSelfRegistrationEligibility(
  input: Omit<
    PositionsGameRegistrationEligibilityInput,
    'isGuestRegistration' | 'hostCanSelfRegister'
  >,
): PositionsGameRegistrationEligibilityResult {
  return positionsGameRegistrationEligibility({
    ...input,
    isGuestRegistration: false,
    hostCanSelfRegister: true,
  });
}
