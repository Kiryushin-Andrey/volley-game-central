import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GUEST_REGISTRATION_OPEN_DAYS,
  REGISTRATION_OPEN_DAYS,
  REGULAR_PLAYER_REGISTRATION_OPEN_DAYS,
  baseRegistrationOpensAt,
  classifyGame,
  evaluateRegistrationEligibility,
  guestRegistrationOpensAt,
  isBaseRegistrationOpen,
  isGuestRegistrationOpen,
  registrationOpenDaysFor,
  registrationOpensAt,
} from './gamePolicy';
import { INTERMEDIATE_LEVEL_REGISTRATION_OPEN_DAYS } from './positionsGameRegistrationEligibility';

describe('registrationOpenDaysFor', () => {
  it('returns guest window for guests', () => {
    assert.equal(
      registrationOpenDaysFor({
        isGuest: true,
        gameFormat: 'recreational',
        isPriorityPlayer: false,
      }),
      GUEST_REGISTRATION_OPEN_DAYS,
    );
  });

  it('returns base 10 days for recreational / positions self-registration', () => {
    assert.equal(
      registrationOpenDaysFor({
        isGuest: false,
        gameFormat: 'recreational',
        isPriorityPlayer: false,
      }),
      REGISTRATION_OPEN_DAYS,
    );
    assert.equal(
      registrationOpenDaysFor({
        isGuest: false,
        gameFormat: 'positions',
        isPriorityPlayer: false,
      }),
      REGISTRATION_OPEN_DAYS,
    );
  });

  it('returns 10 vs 3 days for priority-window games', () => {
    assert.equal(
      registrationOpenDaysFor({
        isGuest: false,
        gameFormat: 'priority_players',
        isPriorityPlayer: true,
      }),
      REGISTRATION_OPEN_DAYS,
    );
    assert.equal(
      registrationOpenDaysFor({
        isGuest: false,
        gameFormat: 'priority_players',
        isPriorityPlayer: false,
      }),
      REGULAR_PLAYER_REGISTRATION_OPEN_DAYS,
    );
  });
});

describe('registration window helpers', () => {
  const gameDate = new Date('2026-06-20T18:00:00Z');

  it('computes base and guest open instants', () => {
    const base = baseRegistrationOpensAt(gameDate);
    const guest = guestRegistrationOpensAt(gameDate);
    assert.equal(base.toISOString(), registrationOpensAt(gameDate, 10).toISOString());
    assert.equal(guest.toISOString(), registrationOpensAt(gameDate, 3).toISOString());
  });

  it('isBaseRegistrationOpen / isGuestRegistrationOpen respect day counts', () => {
    const beforeBase = new Date('2026-06-09T17:00:00Z'); // 11 days before
    const afterBase = new Date('2026-06-10T19:00:00Z'); // within 10 days
    const beforeGuest = new Date('2026-06-16T17:00:00Z'); // 4 days before
    const afterGuest = new Date('2026-06-17T19:00:00Z'); // within 3 days

    assert.equal(isBaseRegistrationOpen(gameDate, beforeBase), false);
    assert.equal(isBaseRegistrationOpen(gameDate, afterBase), true);
    assert.equal(isGuestRegistrationOpen(gameDate, beforeGuest), false);
    assert.equal(isGuestRegistrationOpen(gameDate, afterGuest), true);
  });
});

describe('classifyGame', () => {
  it('classifies Thursday positions as thursday-5-1', () => {
    // 2026-06-18 is a Thursday
    assert.equal(
      classifyGame({ dateTime: '2026-06-18T18:00:00Z', gameFormat: 'positions' }),
      'thursday-5-1',
    );
  });

  it('classifies Thursday non-positions as other', () => {
    assert.equal(
      classifyGame({ dateTime: '2026-06-18T18:00:00Z', gameFormat: 'recreational' }),
      'other',
    );
  });

  it('classifies Sunday recreational as sunday', () => {
    // 2026-06-21 is a Sunday
    assert.equal(
      classifyGame({ dateTime: '2026-06-21T18:00:00Z', gameFormat: 'recreational' }),
      'sunday',
    );
  });

  it('classifies Sunday positions as other', () => {
    assert.equal(
      classifyGame({ dateTime: '2026-06-21T18:00:00Z', gameFormat: 'positions' }),
      'other',
    );
  });

  it('classifies other weekdays as other', () => {
    // 2026-06-17 is a Wednesday
    assert.equal(
      classifyGame({ dateTime: '2026-06-17T18:00:00Z', gameFormat: 'recreational' }),
      'other',
    );
  });
});

describe('evaluateRegistrationEligibility (positions cases via policy)', () => {
  const gameDate = new Date('2026-06-10T18:00:00Z');
  const baseOpens = baseRegistrationOpensAt(gameDate);

  it('blocks beginners on restricted positions games', () => {
    const result = evaluateRegistrationEligibility({
      gameFormat: 'positions',
      playerLevel: 'beginner',
      restrictionsEnabled: true,
      gameDateTime: gameDate,
      now: new Date('2026-06-05T12:00:00Z'),
      isGuestRegistration: false,
      hostCanSelfRegister: true,
      hasExistingSelfRegistration: false,
      baseRegistrationOpensAt: baseOpens,
    });
    assert.equal(result.canSelfRegister, false);
    assert.equal(result.blockReason, 'level');
  });

  it('uses intermediate window on restricted positions games', () => {
    const tooEarly = evaluateRegistrationEligibility({
      gameFormat: 'positions',
      playerLevel: 'intermediate',
      restrictionsEnabled: true,
      gameDateTime: gameDate,
      now: new Date('2026-06-06T12:00:00Z'), // 4 days before
      isGuestRegistration: false,
      hostCanSelfRegister: true,
      hasExistingSelfRegistration: false,
      baseRegistrationOpensAt: baseOpens,
    });
    assert.equal(tooEarly.canSelfRegister, false);
    const expected = new Date(gameDate);
    expected.setDate(expected.getDate() - INTERMEDIATE_LEVEL_REGISTRATION_OPEN_DAYS);
    assert.equal(tooEarly.registrationOpensAt.getTime(), expected.getTime());
  });
});
