import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  INTERMEDIATE_LEVEL_REGISTRATION_OPEN_DAYS,
  positionsGameRegistrationEligibility,
} from './positionsGameRegistrationEligibility';

const gameDate = new Date('2026-06-10T18:00:00Z');
const baseOpens = new Date('2026-05-31T18:00:00Z'); // 10 days before

function eligibility(overrides: Partial<Parameters<typeof positionsGameRegistrationEligibility>[0]> = {}) {
  return positionsGameRegistrationEligibility({
    gameFormat: 'positions',
    playerLevel: null,
    restrictionsEnabled: true,
    gameDateTime: gameDate,
    now: new Date('2026-06-01T12:00:00Z'),
    isGuestRegistration: false,
    hostCanSelfRegister: true,
    hasExistingSelfRegistration: false,
    baseRegistrationOpensAt: baseOpens,
    ...overrides,
  });
}

describe('positionsGameRegistrationEligibility', () => {
  it('allows all levels when restrictions are off', () => {
    const result = eligibility({
      restrictionsEnabled: false,
      playerLevel: 'beginner',
      now: new Date('2026-05-20T12:00:00Z'),
    });
    assert.equal(result.canSelfRegister, false);
    assert.equal(result.blockReason, 'timing');
  });

  it('does not apply restrictions to recreational games', () => {
    const result = eligibility({
      gameFormat: 'recreational',
      playerLevel: 'beginner',
      now: new Date('2026-06-05T12:00:00Z'),
    });
    assert.equal(result.canSelfRegister, true);
  });

  it('does not apply restrictions to priority_players games', () => {
    const result = eligibility({
      gameFormat: 'priority_players',
      playerLevel: 'beginner',
      now: new Date('2026-06-05T12:00:00Z'),
    });
    assert.equal(result.canSelfRegister, true);
  });

  it('blocks beginner on positions games when restrictions on', () => {
    const result = eligibility({
      playerLevel: 'beginner',
      now: new Date('2026-06-09T12:00:00Z'),
    });
    assert.equal(result.canSelfRegister, false);
    assert.equal(result.blockReason, 'level');
  });

  it('allows advanced and unassigned per base timing', () => {
    const advanced = eligibility({ playerLevel: 'advanced', now: new Date('2026-06-05T12:00:00Z') });
    assert.equal(advanced.canSelfRegister, true);

    const unassigned = eligibility({ playerLevel: null, now: new Date('2026-06-05T12:00:00Z') });
    assert.equal(unassigned.canSelfRegister, true);
  });

  it('defers intermediate until 3 days before game', () => {
    const tooEarly = eligibility({
      playerLevel: 'intermediate',
      now: new Date('2026-06-05T12:00:00Z'),
    });
    assert.equal(tooEarly.canSelfRegister, false);
    assert.equal(tooEarly.blockReason, 'timing');

    const intermediateOpens = new Date(gameDate);
    intermediateOpens.setDate(intermediateOpens.getDate() - INTERMEDIATE_LEVEL_REGISTRATION_OPEN_DAYS);
    assert.equal(tooEarly.registrationOpensAt.getTime(), intermediateOpens.getTime());

    const allowed = eligibility({
      playerLevel: 'intermediate',
      now: new Date('2026-06-08T12:00:00Z'),
    });
    assert.equal(allowed.canSelfRegister, true);
  });

  it('uses later of base and intermediate open dates for intermediate', () => {
    const lateBase = new Date('2026-06-09T12:00:00Z');
    const result = eligibility({
      playerLevel: 'intermediate',
      baseRegistrationOpensAt: lateBase,
      now: new Date('2026-06-08T12:00:00Z'),
    });
    assert.equal(result.canSelfRegister, false);
    assert.equal(result.registrationOpensAt.getTime(), lateBase.getTime());
  });

  it('grandfathers existing self registration', () => {
    const result = eligibility({
      playerLevel: 'beginner',
      hasExistingSelfRegistration: true,
      now: new Date('2026-06-01T12:00:00Z'),
    });
    assert.equal(result.canSelfRegister, true);
  });

  it('blocks guests when host cannot self-register', () => {
    const result = eligibility({
      isGuestRegistration: true,
      hostCanSelfRegister: false,
      now: new Date('2026-06-09T12:00:00Z'),
    });
    assert.equal(result.canSelfRegister, false);
    assert.equal(result.blockReason, 'level');
  });

  it('allows guests when host can and guest window is open', () => {
    const guestOpens = new Date('2026-06-07T18:00:00Z');
    const result = eligibility({
      isGuestRegistration: true,
      hostCanSelfRegister: true,
      baseRegistrationOpensAt: guestOpens,
      now: new Date('2026-06-08T12:00:00Z'),
    });
    assert.equal(result.canSelfRegister, true);
  });
});
