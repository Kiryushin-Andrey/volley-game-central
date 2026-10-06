import { after, afterEach, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { eq, inArray, and, isNull } from 'drizzle-orm';
import { pool, db } from '../db';
import { migrateTestDatabase } from '../db/migrateForTests';
import {
  gameRegistrations,
  games,
  paymentRequests,
  spotOfferInvites,
  spotOffers,
  users,
} from '../db/schema';
import {
  acceptSpotOffer,
  abortOffersDemotedByCapacity,
  cancelMySpotOffer,
  createSpotOffer,
} from './spotOfferService';
import {
  abortOpenOffersForGame,
  processSpotOfferJobs,
} from './spotOfferJobs';
import {
  resetSyntheticTelegramMessageIds,
  resolveLateSignoutTopicId,
} from './telegramService';

const GAME_AT = new Date('2026-06-20T18:00:00Z');
// After 24h leave deadline (T−24h = 2026-06-19T18:00Z)
const AFTER_DEADLINE = new Date('2026-06-19T19:00:00Z');
const BEFORE_DEADLINE = new Date('2026-06-19T12:00:00Z');
// Within 5h public window (T−5h = 2026-06-20T13:00Z)
const WITHIN_PUBLIC = new Date('2026-06-20T14:00:00Z');

describe('spot offer service', { concurrency: false }, () => {
  const userIds: number[] = [];
  const gameIds: number[] = [];
  const prevDevMode = process.env.DEV_MODE;
  const prevSpacing = process.env.SPOT_OFFER_INVITE_SPACING_MS;

  before(async () => {
    process.env.DEV_MODE = 'true';
    process.env.SPOT_OFFER_INVITE_SPACING_MS = '1000';
    process.env.TELEGRAM_LATE_SIGNOUT_TOPIC_ID_POSITIONS = '111';
    process.env.TELEGRAM_LATE_SIGNOUT_TOPIC_ID_NON_POSITIONS = '222';
    resetSyntheticTelegramMessageIds();
    await migrateTestDatabase();
  });

  after(async () => {
    if (prevDevMode === undefined) delete process.env.DEV_MODE;
    else process.env.DEV_MODE = prevDevMode;
    if (prevSpacing === undefined) delete process.env.SPOT_OFFER_INVITE_SPACING_MS;
    else process.env.SPOT_OFFER_INVITE_SPACING_MS = prevSpacing;
    await pool.end();
  });

  afterEach(async () => {
    if (gameIds.length > 0) {
      const regs = await db
        .select({ id: gameRegistrations.id })
        .from(gameRegistrations)
        .where(inArray(gameRegistrations.gameId, gameIds));
      const regIds = regs.map((r) => r.id);
      await db.delete(spotOfferInvites);
      await db.delete(spotOffers).where(inArray(spotOffers.gameId, gameIds));
      if (regIds.length > 0) {
        await db
          .delete(paymentRequests)
          .where(inArray(paymentRequests.gameRegistrationId, regIds));
      }
      await db
        .delete(gameRegistrations)
        .where(inArray(gameRegistrations.gameId, gameIds));
      await db.delete(games).where(inArray(games.id, gameIds));
      gameIds.length = 0;
    }
    if (userIds.length > 0) {
      await db.delete(users).where(inArray(users.id, userIds));
      userIds.length = 0;
    }
  });

  async function createUser(
    displayName: string,
    telegramId?: string,
    playerLevel?: string,
  ) {
    const [user] = await db
      .insert(users)
      .values({
        displayName,
        telegramId: telegramId ?? null,
        playerLevel: playerLevel ?? null,
      })
      .returning();
    userIds.push(user.id);
    return user;
  }

  async function createGame(
    createdById: number,
    maxPlayers: number,
    opts: {
      dateTime?: Date;
      unregisterDeadlineHours?: number;
      gameFormat?: string;
    } = {},
  ) {
    const [game] = await db
      .insert(games)
      .values({
        dateTime: opts.dateTime ?? GAME_AT,
        maxPlayers,
        paymentAmount: 0,
        createdById,
        gameFormat: opts.gameFormat ?? 'positions',
        unregisterDeadlineHours: opts.unregisterDeadlineHours ?? 24,
      })
      .returning();
    gameIds.push(game.id);
    return game;
  }

  async function seedRegistration(
    gameId: number,
    userId: number,
    createdAt: Date,
    guestName: string | null = null,
  ) {
    const [row] = await db
      .insert(gameRegistrations)
      .values({ gameId, userId, guestName, createdAt, bringingTheBall: false })
      .returning();
    return row;
  }

  it('rejects create before leave deadline and accepts after', async () => {
    const host = await createUser('Offer Host', 'tg-host');
    const game = await createGame(host.id, 2);
    await seedRegistration(game.id, host.id, new Date('2026-06-01T10:00:00Z'));

    const before = await createSpotOffer({
      game,
      userId: host.id,
      now: BEFORE_DEADLINE,
    });
    assert.equal(before.ok, false);
    if (!before.ok) assert.equal(before.code, 'before_deadline');

    const after = await createSpotOffer({
      game,
      userId: host.id,
      now: AFTER_DEADLINE,
    });
    assert.equal(after.ok, true);
  });

  it('enters public immediately when within 5h of game', async () => {
    const host = await createUser('Public Host', 'tg-pub-host');
    const wait = await createUser('Wait One', 'tg-wait-1');
    const game = await createGame(host.id, 1);
    await seedRegistration(game.id, host.id, new Date('2026-06-01T10:00:00Z'));
    await seedRegistration(game.id, wait.id, new Date('2026-06-01T11:00:00Z'));

    const result = await createSpotOffer({
      game,
      userId: host.id,
      now: WITHIN_PUBLIC,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.enteredPublic, true);
      assert.ok(result.offer.publicAnnouncedAt);
      assert.equal(result.offer.nextActionAt, null);
      assert.ok(result.offer.publicTelegramMessageId != null);
    }
  });

  it('walks waitlist with spacing, skips no-telegram, invite not required for accept', async () => {
    const host = await createUser('Walk Host', 'tg-walk-host');
    const noTg = await createUser('No Telegram');
    const first = await createUser('First Wait', 'tg-first');
    const second = await createUser('Second Wait', 'tg-second');
    const outsider = await createUser('Outsider', 'tg-out');
    const game = await createGame(host.id, 1);
    const hostReg = await seedRegistration(
      game.id,
      host.id,
      new Date('2026-06-01T10:00:00Z'),
    );
    await seedRegistration(game.id, noTg.id, new Date('2026-06-01T10:30:00Z'));
    await seedRegistration(game.id, first.id, new Date('2026-06-01T11:00:00Z'));
    await seedRegistration(game.id, second.id, new Date('2026-06-01T12:00:00Z'));

    const created = await createSpotOffer({
      game,
      userId: host.id,
      now: AFTER_DEADLINE,
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;

    // First invite should skip noTg and DM first
    const invites1 = await db
      .select()
      .from(spotOfferInvites)
      .where(eq(spotOfferInvites.spotOfferId, created.offer.id));
    assert.equal(invites1.length, 1);
    assert.equal(invites1[0].inviteeUserId, first.id);
    assert.ok(invites1[0].telegramMessageId != null);

    // Advance past spacing and process next invite
    const afterSpacing = new Date(AFTER_DEADLINE.getTime() + 2000);
    await processSpotOfferJobs(afterSpacing);

    const invites2 = await db
      .select()
      .from(spotOfferInvites)
      .where(eq(spotOfferInvites.spotOfferId, created.offer.id));
    assert.equal(invites2.length, 2);

    // Eligible non-invitee (outsider) can accept during waitlist walk
    const accepted = await acceptSpotOffer({
      game,
      offerId: created.offer.id,
      acceptorUserId: outsider.id,
      now: afterSpacing,
    });
    assert.equal(accepted.ok, true);
    if (!accepted.ok) return;

    assert.equal(accepted.offer.offererUserId, host.id);
    assert.equal(accepted.offer.fulfilledByUserId, outsider.id);

    const [reg] = await db
      .select()
      .from(gameRegistrations)
      .where(eq(gameRegistrations.id, hostReg.id));
    assert.equal(reg.userId, outsider.id);
    assert.equal(reg.guestName, null);
    assert.equal(reg.bringingTheBall, false);
    assert.equal(reg.paid, false);
    assert.equal(
      new Date(reg.createdAt!).toISOString(),
      new Date(hostReg.createdAt!).toISOString(),
    );

    // Invite rows deleted; offer kept
    const invitesAfter = await db
      .select()
      .from(spotOfferInvites)
      .where(eq(spotOfferInvites.spotOfferId, created.offer.id));
    assert.equal(invitesAfter.length, 0);

    const secondAccept = await acceptSpotOffer({
      game,
      offerId: created.offer.id,
      acceptorUserId: first.id,
      now: afterSpacing,
    });
    assert.equal(secondAccept.ok, false);
  });

  it('rejects accept when level restrictions block self-registration', async (t) => {
    if (process.env.POSITIONS_GAME_LEVEL_RESTRICTIONS_ENABLED !== 'true') {
      t.skip('requires POSITIONS_GAME_LEVEL_RESTRICTIONS_ENABLED=true');
    }
    const host = await createUser('Level Host', 'tg-level-host');
    const beginner = await createUser('Level Beginner', 'tg-level-beginner', 'beginner');
    const game = await createGame(host.id, 2);
    await seedRegistration(game.id, host.id, new Date('2026-06-01T10:00:00Z'));

    const created = await createSpotOffer({
      game,
      userId: host.id,
      now: AFTER_DEADLINE,
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const blocked = await acceptSpotOffer({
      game,
      offerId: created.offer.id,
      acceptorUserId: beginner.id,
      now: AFTER_DEADLINE,
    });
    assert.equal(blocked.ok, false);
    if (!blocked.ok) assert.equal(blocked.code, 'ineligible');
  });

  it('rejects self-accept and already-on-roster accept', async () => {
    const host = await createUser('Self Host', 'tg-self-host');
    const rosterMate = await createUser('Roster Mate', 'tg-mate');
    const game = await createGame(host.id, 2);
    await seedRegistration(game.id, host.id, new Date('2026-06-01T10:00:00Z'));
    await seedRegistration(game.id, rosterMate.id, new Date('2026-06-01T11:00:00Z'));

    const created = await createSpotOffer({
      game,
      userId: host.id,
      now: AFTER_DEADLINE,
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const self = await acceptSpotOffer({
      game,
      offerId: created.offer.id,
      acceptorUserId: host.id,
      now: AFTER_DEADLINE,
    });
    assert.equal(self.ok, false);
    if (!self.ok) assert.equal(self.code, 'self_accept');

    const mate = await acceptSpotOffer({
      game,
      offerId: created.offer.id,
      acceptorUserId: rosterMate.id,
      now: AFTER_DEADLINE,
    });
    assert.equal(mate.ok, false);
    if (!mate.ok) assert.equal(mate.code, 'already_roster');
  });

  it('rejects second open offer on same registration via unique constraint', async () => {
    const host = await createUser('Dup Host', 'tg-dup');
    const game = await createGame(host.id, 1);
    await seedRegistration(game.id, host.id, new Date('2026-06-01T10:00:00Z'));

    const first = await createSpotOffer({
      game,
      userId: host.id,
      now: AFTER_DEADLINE,
    });
    assert.equal(first.ok, true);

    const second = await createSpotOffer({
      game,
      userId: host.id,
      now: AFTER_DEADLINE,
    });
    assert.equal(second.ok, false);
    if (!second.ok) assert.equal(second.code, 'duplicate_open');
  });

  it('abortOpenOffersForGame clears all open offers', async () => {
    const host = await createUser('Abort Host', 'tg-abort-all');
    const game = await createGame(host.id, 1);
    await seedRegistration(game.id, host.id, new Date('2026-06-01T10:00:00Z'));

    const created = await createSpotOffer({
      game,
      userId: host.id,
      now: AFTER_DEADLINE,
    });
    assert.equal(created.ok, true);

    await abortOpenOffersForGame(game.id);
    const open = await db.select().from(spotOffers).where(andOpen(game.id));
    assert.equal(open.length, 0);
  });

  it('supports guest offer create/cancel with guestName matching', async () => {
    const host = await createUser('Guest Host', 'tg-g-host');
    const claimer = await createUser('Claimer', 'tg-claim');
    const game = await createGame(host.id, 2);
    await seedRegistration(game.id, host.id, new Date('2026-06-01T10:00:00Z'));
    await seedRegistration(
      game.id,
      host.id,
      new Date('2026-06-01T10:30:00Z'),
      'Alex',
    );

    const selfOffer = await createSpotOffer({
      game,
      userId: host.id,
      now: AFTER_DEADLINE,
    });
    assert.equal(selfOffer.ok, true);

    const guestOffer = await createSpotOffer({
      game,
      userId: host.id,
      guestName: 'Alex',
      now: AFTER_DEADLINE,
    });
    assert.equal(guestOffer.ok, true);

    // Cancel guest only — self remains
    const cancelGuest = await cancelMySpotOffer({
      gameId: game.id,
      userId: host.id,
      guestName: 'Alex',
    });
    assert.equal(cancelGuest.ok, true);

    const remaining = await db
      .select()
      .from(spotOffers)
      .where(andOpen(game.id));
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].offererUserId, host.id);

    // Host cannot accept own remaining self offer
    if (!selfOffer.ok) return;
    const selfAccept = await acceptSpotOffer({
      game,
      offerId: selfOffer.offer.id,
      acceptorUserId: host.id,
      now: AFTER_DEADLINE,
    });
    assert.equal(selfAccept.ok, false);

    const ok = await acceptSpotOffer({
      game,
      offerId: selfOffer.offer.id,
      acceptorUserId: claimer.id,
      now: AFTER_DEADLINE,
    });
    assert.equal(ok.ok, true);
  });

  it('aborts demoted offers when capacity shrinks', async () => {
    const a = await createUser('Cap A', 'tg-a');
    const b = await createUser('Cap B', 'tg-b');
    const game = await createGame(a.id, 2);
    await seedRegistration(game.id, a.id, new Date('2026-06-01T10:00:00Z'));
    await seedRegistration(game.id, b.id, new Date('2026-06-01T11:00:00Z'));

    const offerB = await createSpotOffer({
      game,
      userId: b.id,
      now: AFTER_DEADLINE,
    });
    assert.equal(offerB.ok, true);

    const cancelled = await abortOffersDemotedByCapacity(game.id, 1);
    assert.equal(cancelled, 1);
    const open = await db.select().from(spotOffers).where(andOpen(game.id));
    assert.equal(open.length, 0);
  });

  it('clears next_action_at on public transition so poller does not re-select', async () => {
    const host = await createUser('Poll Host', 'tg-poll');
    const game = await createGame(host.id, 1);
    await seedRegistration(game.id, host.id, new Date('2026-06-01T10:00:00Z'));

    const created = await createSpotOffer({
      game,
      userId: host.id,
      now: WITHIN_PUBLIC,
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal(created.offer.nextActionAt, null);

    await processSpotOfferJobs(WITHIN_PUBLIC);
    const [row] = await db
      .select()
      .from(spotOffers)
      .where(eq(spotOffers.id, created.offer.id));
    assert.ok(row.publicAnnouncedAt);
    assert.equal(row.nextActionAt, null);
  });

  it('resolves late-signout topics by format', () => {
    assert.equal(resolveLateSignoutTopicId('positions'), 111);
    assert.equal(resolveLateSignoutTopicId('recreational'), 222);
    assert.equal(resolveLateSignoutTopicId('priority_players'), 222);
  });
});

function andOpen(gameId: number) {
  return and(eq(spotOffers.gameId, gameId), isNull(spotOffers.fulfilledByUserId));
}
