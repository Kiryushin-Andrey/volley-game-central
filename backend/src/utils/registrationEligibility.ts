import { POSITIONS_GAME_LEVEL_RESTRICTIONS_ENABLED } from '../config/positionsGameLevelRestrictions';
import {
  hostSelfRegistrationEligibility,
  positionsGameRegistrationEligibility,
  type PositionsGameRegistrationEligibilityResult,
} from '../domain/positionsGameRegistrationEligibility';
import type { GameFormat } from '../domain/gameFormat';
import type { PlayerLevel } from '../domain/playerLevel';

export function buildBaseRegistrationOpensAt(
  gameDateTime: Date,
  registrationOpenDays: number,
): Date {
  const opens = new Date(gameDateTime);
  opens.setDate(opens.getDate() - registrationOpenDays);
  return opens;
}

export function evaluateRegistrationEligibility(params: {
  gameFormat: GameFormat;
  playerLevel: PlayerLevel | null;
  gameDateTime: Date;
  now: Date;
  isGuestRegistration: boolean;
  registrationOpenDays: number;
}): PositionsGameRegistrationEligibilityResult {
  const baseRegistrationOpensAt = buildBaseRegistrationOpensAt(
    params.gameDateTime,
    params.registrationOpenDays,
  );

  const hostEligibility = hostSelfRegistrationEligibility({
    gameFormat: params.gameFormat,
    playerLevel: params.playerLevel,
    restrictionsEnabled: POSITIONS_GAME_LEVEL_RESTRICTIONS_ENABLED,
    gameDateTime: params.gameDateTime,
    now: params.now,
    baseRegistrationOpensAt,
  });

  return positionsGameRegistrationEligibility({
    gameFormat: params.gameFormat,
    playerLevel: params.playerLevel,
    restrictionsEnabled: POSITIONS_GAME_LEVEL_RESTRICTIONS_ENABLED,
    gameDateTime: params.gameDateTime,
    now: params.now,
    isGuestRegistration: params.isGuestRegistration,
    hostCanSelfRegister: hostEligibility.canSelfRegister,
    baseRegistrationOpensAt,
  });
}
