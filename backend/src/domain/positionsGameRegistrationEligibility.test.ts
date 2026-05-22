import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluatePositionsGameRegistrationEligibility,
  getIntermediateLevelOpensAt,
  INTERMEDIATE_REGISTRATION_DAYS_BEFORE_START,
} from './positionsGameRegistrationEligibility';

const gameStart = new Date('2026-06-15T18:00:00Z');
const baseOpens = new Date('2026-06-05T18:00:00Z'); // 10 days before

function input(
  overrides: Partial<Parameters<typeof evaluatePositionsGameRegistrationEligibility>[0]> = {}
) {
  return {
    gameFormat: 'positions' as const,
    playerLevel: null,
    restrictionsEnabled: true,
    gameDateTime: gameStart,
    now: new Date('2026-06-10T12:00:00Z'),
    isGuestRegistration: false,
    hostCanSelfRegister: true,
    hasExistingSelfRegistration: false,
    baseRegistrationOpensAt: baseOpens,
    ...overrides,
  };
}

describe('getIntermediateLevelOpensAt', () => {
  it('opens 3 days before game start', () => {
    const opens = getIntermediateLevelOpensAt(gameStart);
    const diffDays =
      (gameStart.getTime() - opens.getTime()) / (24 * 60 * 60 * 1000);
    assert.equal(diffDays, INTERMEDIATE_REGISTRATION_DAYS_BEFORE_START);
  });
});

describe('evaluatePositionsGameRegistrationEligibility', () => {
  it('allows recreational games regardless of beginner level', () => {
    const r = evaluatePositionsGameRegistrationEligibility(
      input({
        gameFormat: 'recreational',
        playerLevel: 'beginner',
        now: new Date('2026-06-10T12:00:00Z'),
      })
    );
    assert.equal(r.canSelfRegister, true);
    assert.equal(r.blockReason, null);
  });

  it('allows priority_players games for beginner', () => {
    const r = evaluatePositionsGameRegistrationEligibility(
      input({
        gameFormat: 'priority_players',
        playerLevel: 'beginner',
      })
    );
    assert.equal(r.canSelfRegister, true);
  });

  it('blocks beginner on positions when restrictions on', () => {
    const r = evaluatePositionsGameRegistrationEligibility(
      input({ playerLevel: 'beginner', now: new Date('2026-06-10T12:00:00Z') })
    );
    assert.equal(r.canSelfRegister, false);
    assert.equal(r.blockReason, 'level');
  });

  it('allows beginner on positions when restrictions off', () => {
    const r = evaluatePositionsGameRegistrationEligibility(
      input({
        playerLevel: 'beginner',
        restrictionsEnabled: false,
        now: new Date('2026-06-10T12:00:00Z'),
      })
    );
    assert.equal(r.canSelfRegister, true);
  });

  it('allows advanced and unassigned on positions (base timing)', () => {
    for (const level of [null, 'advanced'] as const) {
      const r = evaluatePositionsGameRegistrationEligibility(
        input({ playerLevel: level, now: new Date('2026-06-10T12:00:00Z') })
      );
      assert.equal(r.canSelfRegister, true, String(level));
    }
  });

  it('blocks intermediate until 3 days before start', () => {
    const far = evaluatePositionsGameRegistrationEligibility(
      input({
        playerLevel: 'intermediate',
        now: new Date('2026-06-08T12:00:00Z'), // 7 days before start
      })
    );
    assert.equal(far.canSelfRegister, false);
    assert.equal(far.blockReason, 'level');

    const near = evaluatePositionsGameRegistrationEligibility(
      input({
        playerLevel: 'intermediate',
        now: new Date('2026-06-13T12:00:00Z'), // 2 days before
      })
    );
    assert.equal(near.canSelfRegister, true);
  });

  it('grandfathers existing self registration for beginner', () => {
    const r = evaluatePositionsGameRegistrationEligibility(
      input({
        playerLevel: 'beginner',
        hasExistingSelfRegistration: true,
      })
    );
    assert.equal(r.canSelfRegister, true);
  });

  it('blocks guest when host cannot self-register', () => {
    const r = evaluatePositionsGameRegistrationEligibility(
      input({
        isGuestRegistration: true,
        hostCanSelfRegister: false,
        playerLevel: 'beginner',
      })
    );
    assert.equal(r.canSelfRegister, false);
    assert.equal(r.blockReason, 'level');
  });

  it('allows guest when host can self-register', () => {
    const r = evaluatePositionsGameRegistrationEligibility(
      input({
        isGuestRegistration: true,
        hostCanSelfRegister: true,
      })
    );
    assert.equal(r.canSelfRegister, true);
  });

  it('uses later of base and intermediate open times', () => {
    const r = evaluatePositionsGameRegistrationEligibility(
      input({ playerLevel: 'intermediate', now: new Date('2026-06-04T12:00:00Z') })
    );
    assert.equal(r.canSelfRegister, false);
    assert.ok(r.registrationOpensAt);
    assert.ok(
      r.registrationOpensAt!.getTime() >=
        getIntermediateLevelOpensAt(gameStart).getTime()
    );
  });

  it('reports timing block when before base open', () => {
    const r = evaluatePositionsGameRegistrationEligibility(
      input({
        playerLevel: 'advanced',
        now: new Date('2026-06-01T12:00:00Z'),
      })
    );
    assert.equal(r.canSelfRegister, false);
    assert.equal(r.blockReason, 'timing');
  });
});
