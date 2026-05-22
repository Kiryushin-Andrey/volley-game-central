import { isPositionsGame, type GameFormat } from './gameFormat';
import type { PlayerLevel } from './playerLevel';

export const INTERMEDIATE_REGISTRATION_DAYS_BEFORE_START = 3;

export type RegistrationBlockReason = 'level' | 'timing' | null;

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
  registrationOpensAt: Date | null;
  blockReason: RegistrationBlockReason;
}

export function getIntermediateLevelOpensAt(gameDateTime: Date): Date {
  const opensAt = new Date(gameDateTime);
  opensAt.setDate(opensAt.getDate() - INTERMEDIATE_REGISTRATION_DAYS_BEFORE_START);
  return opensAt;
}

function maxDate(a: Date, b: Date): Date {
  return a.getTime() >= b.getTime() ? new Date(a) : new Date(b);
}

/**
 * Pure eligibility for self-serve registration (and guest host gate).
 * Combines base registration-open timing with positions-game level rules.
 */
export function evaluatePositionsGameRegistrationEligibility(
  input: PositionsRegistrationEligibilityInput
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
    if (
      restrictionsEnabled &&
      isPositionsGame(gameFormat) &&
      !hostCanSelfRegister
    ) {
      return {
        canSelfRegister: false,
        registrationOpensAt: null,
        blockReason: 'level',
      };
    }
    return {
      canSelfRegister: true,
      registrationOpensAt: baseRegistrationOpensAt,
      blockReason: null,
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
    const timingOpen = now >= baseRegistrationOpensAt;
    return {
      canSelfRegister: timingOpen,
      registrationOpensAt: baseRegistrationOpensAt,
      blockReason: timingOpen ? null : 'timing',
    };
  }

  let effectiveOpensAt = new Date(baseRegistrationOpensAt);
  let levelAllows = true;

  if (playerLevel === 'beginner') {
    levelAllows = false;
  } else if (playerLevel === 'intermediate') {
    const intermediateOpensAt = getIntermediateLevelOpensAt(gameDateTime);
    effectiveOpensAt = maxDate(baseRegistrationOpensAt, intermediateOpensAt);
    levelAllows = now >= intermediateOpensAt;
  }

  if (!levelAllows) {
    return {
      canSelfRegister: false,
      registrationOpensAt:
        playerLevel === 'intermediate' ? effectiveOpensAt : null,
      blockReason: 'level',
    };
  }

  const timingOpen = now >= effectiveOpensAt;
  return {
    canSelfRegister: timingOpen,
    registrationOpensAt: effectiveOpensAt,
    blockReason: timingOpen ? null : 'timing',
  };
}
