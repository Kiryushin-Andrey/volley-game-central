import type { GamePlayMode, PlayerSkillLevel } from '../types/gamePlayMode';
import { isWithPositionsPlayMode } from '../types/gamePlayMode';
import { isFiveOneLevelRestrictionsEnabled } from '../constants';

const INTERMEDIATE_REGISTRATION_OPEN_DAYS = 3;

export type FiveOneLevelAccessDenied =
  | { allowed: false; code: 'FIVE_ONE_LEVEL_NOT_ELIGIBLE'; message: string }
  | {
      allowed: false;
      code: 'FIVE_ONE_LEVEL_WINDOW';
      message: string;
      registrationOpensAt: Date;
    };

export type FiveOneLevelAccessResult = { allowed: true } | FiveOneLevelAccessDenied;

function intermediateRegistrationOpensAt(gameDateTime: Date): Date {
  const open = new Date(gameDateTime);
  open.setDate(open.getDate() - INTERMEDIATE_REGISTRATION_OPEN_DAYS);
  return open;
}

/**
 * FR-2: Restrict registration for `with_positions` games when enforcement is on.
 * Evaluated after general registration-open timing (caller responsibility).
 */
export function evaluateFiveOneLevelAccess(params: {
  playMode: GamePlayMode;
  playerLevel: PlayerSkillLevel | null;
  gameDateTime: Date;
  now?: Date;
}): FiveOneLevelAccessResult {
  const now = params.now ?? new Date();

  if (!isFiveOneLevelRestrictionsEnabled() || !isWithPositionsPlayMode(params.playMode)) {
    return { allowed: true };
  }

  const level = params.playerLevel;

  if (level === null || level === 'advanced') {
    return { allowed: true };
  }

  if (level === 'beginner') {
    return {
      allowed: false,
      code: 'FIVE_ONE_LEVEL_NOT_ELIGIBLE',
      message: 'You cannot register for this game.',
    };
  }

  // intermediate
  const registrationOpensAt = intermediateRegistrationOpensAt(params.gameDateTime);
  if (now < registrationOpensAt) {
    return {
      allowed: false,
      code: 'FIVE_ONE_LEVEL_WINDOW',
      message:
        'Registration for this game opens three calendar days before the game starts.',
      registrationOpensAt,
    };
  }

  return { allowed: true };
}
