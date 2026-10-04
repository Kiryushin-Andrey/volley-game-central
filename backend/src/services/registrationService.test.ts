import { after, afterEach, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { inArray } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { pool, db } from '../db';
import { gameRegistrations, games, users } from '../db/schema';
import { REGISTRATION_OPEN_DAYS } from '../domain/gamePolicy';
import {
  capacityPromotions,
  mapRegistrationsWithWaitlist,
  placeRegistration,
  removeRegistration,
} from './registrationService';

const GAME_AT = new Date('2026-06-20T18:00:00Z');

describe('registration service', { concurrency: false }, () => {
  const userIds: number[] = [];
  const gameIds: number[] = [];

  before(async () => {
    await migrate(db, {
      migrationsFolder: path.join(__dirname, '../../drizzle'),
    });
  });

  after(async () => {
    await pool.end();
  });

  afterEach(async () => {
    if (gameIds.length > 0) {
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

  async function createUser(displayName: string) {
    const [user] = await db.insert(users).values({ displayName }).returning();
    userIds.push(user.id);
    return user;
  }

  async function createGame(createdById: number, maxPlayers: number, dateTime = GAME_AT) {
    const [game] = await db
      .insert(games)
      .values({
        dateTime,
        maxPlayers,
        paymentAmount: 0,
        createdById,
        gameFormat: 'recreational',
        unregisterDeadlineHours: 5,
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

  async function orderedRows(gameId: number) {
    return db
      .select()
      .from(gameRegistrations)
      .where(inArray(gameRegistrations.gameId, [gameId]))
      .orderBy(gameRegistrations.createdAt, gameRegistrations.id);
  }

  it('marks only stored seats past maxPlayers as waitlist', async () => {
    const host = await createUser('Waitlist Host');
    const game = await createGame(host.id, 3);
    const players = [];
    for (let i = 0; i < 4; i++) {
      players.push(await createUser(`Waitlist P${i}`));
    }
    for (let i = 0; i < 3; i++) {
      await seedRegistration(game.id, players[i].id, new Date(Date.UTC(2026, 5, 1, 10, i)));
    }

    const joined = await placeRegistration({
      game,
      userId: players[3].id,
      isPriorityPlayer: false,
      now: new Date('2026-06-18T12:00:00Z'),
    });
    assert.equal(joined.ok, true);
    if (joined.ok) {
      assert.equal(joined.position, 3);
      assert.equal(joined.isWaitlist, true);
    }

    const flagged = mapRegistrationsWithWaitlist(await orderedRows(game.id), 3);
    assert.deepEqual(
      flagged.map((row) => row.isWaitlist),
      [false, false, false, true],
    );
  });

  it('removes the matching guest row and reports a missing registration', async () => {
    const host = await createUser('Lookup Host');
    const game = await createGame(host.id, 10);
    const player = await createUser('Lookup Player');
    await seedRegistration(game.id, player.id, new Date('2026-06-01T10:00:00Z'));
    await seedRegistration(game.id, player.id, new Date('2026-06-01T10:01:00Z'), 'Pat');

    const removed = await removeRegistration({
      game,
      userId: player.id,
      guestName: 'Pat',
      now: new Date('2026-06-01T12:00:00Z'),
    });
    assert.equal(removed.ok, true);

    const remaining = await orderedRows(game.id);
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].guestName, null);

    const stranger = await createUser('Lookup Missing');
    const missing = await removeRegistration({
      game,
      userId: stranger.id,
      now: new Date('2026-06-01T12:00:00Z'),
    });
    assert.equal(missing.ok, false);
    if (!missing.ok) {
      assert.equal(missing.code, 'not_found');
    }
  });

  it('promotes the first stored waitlisted player when a roster spot frees', async () => {
    const host = await createUser('Promote Host');
    const game = await createGame(host.id, 3);
    const rosterA = await createUser('Promote A');
    const rosterB = await createUser('Promote B');
    const guestHost = await createUser('Promote Guest Host');
    const waitlisted = await createUser('Promote Waitlisted');
    await seedRegistration(game.id, rosterA.id, new Date('2026-06-01T10:00:00Z'));
    await seedRegistration(game.id, rosterB.id, new Date('2026-06-01T10:01:00Z'));
    await seedRegistration(game.id, guestHost.id, new Date('2026-06-01T10:02:00Z'), 'Pat');
    await seedRegistration(game.id, waitlisted.id, new Date('2026-06-01T10:03:00Z'));

    const removed = await removeRegistration({
      game,
      userId: rosterA.id,
      now: new Date('2026-06-01T12:00:00Z'),
    });
    assert.equal(removed.ok, true);
    if (removed.ok) {
      assert.equal(removed.removedWasOnRoster, true);
      assert.equal(removed.promoted?.userId, waitlisted.id);
    }
  });

  it('promotes nobody when the leaver was already on the waitlist', async () => {
    const host = await createUser('Waitlist Leave Host');
    const game = await createGame(host.id, 3);
    const players = [];
    for (let i = 0; i < 4; i++) {
      const user = await createUser(`Waitlist Leave ${i}`);
      players.push(user);
      await seedRegistration(game.id, user.id, new Date(Date.UTC(2026, 5, 1, 10, i)));
    }

    const removed = await removeRegistration({
      game,
      userId: players[3].id,
      now: new Date('2026-06-01T12:00:00Z'),
    });
    assert.equal(removed.ok, true);
    if (removed.ok) {
      assert.equal(removed.removedWasOnRoster, false);
      assert.equal(removed.promoted, null);
    }
  });

  it('promotes nobody when the waitlist is empty after a roster leave', async () => {
    const host = await createUser('Empty Waitlist Host');
    const game = await createGame(host.id, 3);
    const first = await createUser('Empty Waitlist First');
    const second = await createUser('Empty Waitlist Second');
    await seedRegistration(game.id, first.id, new Date('2026-06-01T10:00:00Z'));
    await seedRegistration(game.id, second.id, new Date('2026-06-01T10:01:00Z'));

    const removed = await removeRegistration({
      game,
      userId: first.id,
      now: new Date('2026-06-01T12:00:00Z'),
    });
    assert.equal(removed.ok, true);
    if (removed.ok) {
      assert.equal(removed.promoted, null);
    }
  });

  it('returns stored registrations that move onto the roster when capacity grows', async () => {
    const host = await createUser('Capacity Host');
    const game = await createGame(host.id, 2);
    const seeded = [];
    for (let i = 0; i < 4; i++) {
      const user = await createUser(`Capacity ${i}`);
      const row = await seedRegistration(
        game.id,
        user.id,
        new Date(Date.UTC(2026, 5, 1, 10, i)),
      );
      seeded.push(row);
    }
    const ordered = await orderedRows(game.id);

    assert.deepEqual(
      capacityPromotions(ordered, 2, 4).map((row) => row.id),
      [seeded[2].id, seeded[3].id],
    );
    assert.deepEqual(capacityPromotions(ordered, 3, 3), []);
    assert.deepEqual(capacityPromotions(ordered, 4, 2), []);
  });

  it('rejects self-registration before the base window and stores nothing', async () => {
    const host = await createUser('Closed Host');
    const player = await createUser('Closed Player');
    const game = await createGame(host.id, 10, GAME_AT);

    const decision = await placeRegistration({
      game,
      userId: player.id,
      isPriorityPlayer: false,
      now: new Date('2026-06-05T12:00:00Z'),
    });
    assert.equal(decision.ok, false);
    if (!decision.ok) {
      assert.equal(decision.code, 'closed_window');
      assert.equal(decision.registrationOpenDays, REGISTRATION_OPEN_DAYS);
    }
    assert.equal((await orderedRows(game.id)).length, 0);
  });

  it('rejects a guest before the guest window even if the host may join', async () => {
    const host = await createUser('Guest Window Host');
    const player = await createUser('Guest Window Player');
    const game = await createGame(host.id, 10, GAME_AT);
    const now = new Date('2026-06-14T12:00:00Z');

    const self = await placeRegistration({
      game,
      userId: player.id,
      isPriorityPlayer: false,
      now,
    });
    assert.equal(self.ok, true);

    const guest = await placeRegistration({
      game,
      userId: player.id,
      guestName: 'Pat',
      isPriorityPlayer: false,
      now,
    });
    assert.equal(guest.ok, false);
    if (!guest.ok) {
      assert.equal(guest.code, 'closed_window');
      assert.equal(guest.registrationOpenDays, 3);
    }
    const rows = await orderedRows(game.id);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].guestName, null);
  });

  it('stores a registration once the window is open', async () => {
    const host = await createUser('Open Host');
    const player = await createUser('Open Player');
    const game = await createGame(host.id, 10, GAME_AT);

    const decision = await placeRegistration({
      game,
      userId: player.id,
      isPriorityPlayer: false,
      now: new Date('2026-06-18T12:00:00Z'),
    });
    assert.equal(decision.ok, true);
    if (decision.ok) {
      assert.equal(decision.isWaitlist, false);
    }
    assert.equal((await orderedRows(game.id)).length, 1);
  });
});
