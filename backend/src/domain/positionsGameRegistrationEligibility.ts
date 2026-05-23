import type { GameFormat } from './gameFormat';
import { isPositionsGame } from './gameFormat';
import type { PlayerLevel } from './playerLevel';

/** Days before game start when intermediate players may self-register (positions + restrictions). */
export const INTERMEDIATE_LEVEL_REGISTRATION_OPEN_DAYS = 3;

export type PositionsRegistrationBlockReason = 'level' | 'timing' | null;

export interface PositionsRegistrationEligibilityInput {
  gameFormat: GameFormat;
  playerLevel: PlayerLevel | null;
  restrictionsEnabled: boolean;
  gameDateTime: Date;
  now: Date;
  isGuestRegistration: boolean;
  hostCanSelfRegister: boolean;
  hasExistingSelfRegistration: boolean;
  baseRegistrationOpensAt: Date;
}

export interface PositionsRegistrationEligibilityResult {
  canSelfRegister: boolean;
  registrationOpensAt: Date;
  blockReason: PositionsRegistrationBlockReason;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setDate(result.getDate() + days);
  return result;
}

function laterDate(a: Date, b: Date): Date {
  return a.getTime() >= b.getTime() ? a : b;
}

/**
 * Pure eligibility for self-serve registration (and guest registration via host).
 * Does not expose level-specific messaging to callers — use blockReason internally only.
 */
export function positionsGameRegistrationEligibility(
  input: PositionsRegistrationEligibilityInput,
): PositionsRegistrationEligibilityResult {
  const {
    gameFormat,
    playerLevel,
    restrictionsEnabled,
    gameDateTime,
    now,
    isGuestRegistration,
    hostCanSelfRegister,
    hasExistingSelfRegistration,
    baseRegistrationOpensAt,
  } = input;

  if (isGuestRegistration) {
    const canSelfRegister = hostCanSelfRegister && now >= baseRegistrationOpensAt;
    return {
      canSelfRegister,
      registrationOpensAt: baseRegistrationOpensAt,
      blockReason: !canSelfRegister
        ? !hostCanSelfRegister
          ? 'level'
          : 'timing'
        : null,
    };
  }

  if (hasExistingSelfRegistration) {
    return {
      canSelfRegister: true,
      registrationOpensAt: baseRegistrationOpensAt,
      blockReason: null,
    };
  }

  if (!restrictionsEnabled || !isPositionsGame(gameFormat)) {
    const canSelfRegister = now >= baseRegistrationOpensAt;
    return {
      canSelfRegister,
      registrationOpensAt: baseRegistrationOpensAt,
      blockReason: canSelfRegister ? null : 'timing',
    };
  }

  if (playerLevel === 'beginner') {
    return {
      canSelfRegister: false,
      registrationOpensAt: baseRegistrationOpensAt,
      blockReason: 'level',
    };
  }

  let effectiveOpensAt = baseRegistrationOpensAt;

  if (playerLevel === 'intermediate') {
    const intermediateOpensAt = addDays(gameDateTime, -INTERMEDIATE_LEVEL_REGISTRATION_OPEN_DAYS);
    effectiveOpensAt = laterDate(baseRegistrationOpensAt, intermediateOpensAt);
  }

  const canSelfRegister = now >= effectiveOpensAt;
  return {
    canSelfRegister,
    registrationOpensAt: effectiveOpensAt,
    blockReason: canSelfRegister ? null : playerLevel === 'intermediate' ? 'timing' : 'timing',
  };
}
