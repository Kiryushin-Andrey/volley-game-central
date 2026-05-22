import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  hostSelfRegistrationEligibility,
  positionsGameRegistrationEligibility,
  INTERMEDIATE_POSITIONS_REGISTRATION_DAYS,
} from './positionsGameRegistrationEligibility';

const gameStart = new Date('2026-06-15T18:00:00Z');
const baseOpens = new Date('2026-06-05T18:00:00Z'); // 10 days before

function input(overrides: Partial<Parameters<typeof positionsGameRegistrationEligibility>[0]> = {}) {
  return {
    gameFormat: 'positions' as const,
    playerLevel: null,
    restrictionsEnabled: true,
    gameDateTime: gameStart,
    now: new Date('2026-06-10T12:00:00Z'),
    isGuestRegistration: false,
    hostCanSelfRegister: true,
    baseRegistrationOpensAt: baseOpens,
    ...overrides,
  };
}

describe('positionsGameRegistrationEligibility', () => {
  it('restrictions off: positions game follows base timing only', () => {
    const blocked = positionsGameRegistrationEligibility(
      input({ restrictionsEnabled: false, now: new Date('2026-06-01T12:00:00Z') }),
    );
    assert.equal(blocked.canSelfRegister, false);
    assert.equal(blocked.blockReason, 'timing');

    const open = positionsGameRegistrationEligibility(input({ restrictionsEnabled: false }));
    assert.equal(open.canSelfRegister, true);
    assert.equal(open.blockReason, null);
  });

  it('recreational and priority_players unaffected when restrictions on', () => {
    const rec = positionsGameRegistrationEligibility(
      input({ gameFormat: 'recreational', playerLevel: 'beginner' }),
    );
    assert.equal(rec.canSelfRegister, true);

    const pri = positionsGameRegistrationEligibility(
      input({ gameFormat: 'priority_players', playerLevel: 'beginner' }),
    );
    assert.equal(pri.canSelfRegister, true);
  });

  it('beginner blocked on positions game when restrictions on', () => {
    const result = positionsGameRegistrationEligibility(
      input({ playerLevel: 'beginner' }),
    );
    assert.equal(result.canSelfRegister, false);
    assert.equal(result.blockReason, 'level');
  });

  it('advanced and unassigned use base timing on positions game', () => {
    const advanced = positionsGameRegistrationEligibility(
      input({ playerLevel: 'advanced', now: new Date('2026-06-01T12:00:00Z') }),
    );
    assert.equal(advanced.canSelfRegister, false);
    assert.equal(advanced.blockReason, 'timing');

    const open = positionsGameRegistrationEligibility(input({ playerLevel: 'advanced' }));
    assert.equal(open.canSelfRegister, true);
  });

  it('intermediate blocked until 3 days before start', () => {
    const tooEarly = positionsGameRegistrationEligibility(
      input({
        playerLevel: 'intermediate',
        now: new Date('2026-06-10T12:00:00Z'), // 5 days before
      }),
    );
    assert.equal(tooEarly.canSelfRegister, false);
    assert.equal(tooEarly.blockReason, 'level');
    const expectedOpens = new Date(gameStart);
    expectedOpens.setDate(expectedOpens.getDate() - INTERMEDIATE_POSITIONS_REGISTRATION_DAYS);
    assert.equal(tooEarly.registrationOpensAt.getTime(), expectedOpens.getTime());

    const inWindow = positionsGameRegistrationEligibility(
      input({
        playerLevel: 'intermediate',
        now: new Date('2026-06-13T12:00:00Z'), // 2 days before
      }),
    );
    assert.equal(inWindow.canSelfRegister, true);
    assert.equal(inWindow.blockReason, null);
  });

  it('intermediate effective open is later of base and 3-day window', () => {
    const lateBase = new Date('2026-06-14T12:00:00Z');
    const result = positionsGameRegistrationEligibility(
      input({
        playerLevel: 'intermediate',
        baseRegistrationOpensAt: lateBase,
        now: new Date('2026-06-13T12:00:00Z'),
      }),
    );
    assert.equal(result.canSelfRegister, false);
    assert.equal(result.registrationOpensAt.getTime(), lateBase.getTime());
  });

  it('guest blocked when host cannot self-register', () => {
    const result = positionsGameRegistrationEligibility(
      input({
        isGuestRegistration: true,
        hostCanSelfRegister: false,
        playerLevel: 'beginner',
      }),
    );
    assert.equal(result.canSelfRegister, false);
    assert.equal(result.blockReason, 'level');
  });

  it('guest allowed when host can self-register and guest timing open', () => {
    const result = positionsGameRegistrationEligibility(
      input({
        isGuestRegistration: true,
        hostCanSelfRegister: true,
        now: new Date('2026-06-10T12:00:00Z'),
      }),
    );
    assert.equal(result.canSelfRegister, true);
  });

  it('guest blocked by timing when host can self-register', () => {
    const result = positionsGameRegistrationEligibility(
      input({
        isGuestRegistration: true,
        hostCanSelfRegister: true,
        now: new Date('2026-06-01T12:00:00Z'),
      }),
    );
    assert.equal(result.canSelfRegister, false);
    assert.equal(result.blockReason, 'timing');
  });
});

describe('hostSelfRegistrationEligibility', () => {
  it('beginner host cannot self-register for guests', () => {
    const host = hostSelfRegistrationEligibility(
      input({ playerLevel: 'beginner' }),
    );
    assert.equal(host.canSelfRegister, false);
  });
});
