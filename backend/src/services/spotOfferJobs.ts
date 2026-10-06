import { and, eq, isNull, lte, sql } from 'drizzle-orm';
import { db } from '../db';
import { games, spotOffers } from '../db/schema';
import { publicAnnounceAt } from '../domain/gamePolicy';
import {
  cancelSpotOfferById,
  listOpenOffersForGame,
  processSingleOfferInviteStep,
  transitionOfferToPublic,
} from './spotOfferService';

/** Abort all open offers for a game (game past/readonly, etc.). */
export async function abortOpenOffersForGame(gameId: number): Promise<number> {
  const open = await listOpenOffersForGame(gameId);
  let cancelled = 0;
  for (const offer of open) {
    const result = await cancelSpotOfferById(offer.id);
    if (result.ok) cancelled += 1;
  }
  return cancelled;
}

async function listDueSpotOfferIds(now: Date = new Date()): Promise<number[]> {
  const rows = await db
    .select({ id: spotOffers.id })
    .from(spotOffers)
    .where(
      and(
        isNull(spotOffers.fulfilledByUserId),
        sql`${spotOffers.nextActionAt} IS NOT NULL`,
        lte(spotOffers.nextActionAt, now),
      ),
    );
  return rows.map((r) => r.id);
}

/**
 * Poller entry point: process due waitlist invites / public transitions,
 * and abort offers on past/readonly games.
 */
export async function processSpotOfferJobs(now: Date = new Date()): Promise<void> {
  try {
    // Abort open offers for past or readonly games
    const openOffers = await db
      .select({
        id: spotOffers.id,
        gameId: spotOffers.gameId,
        gameDateTime: games.dateTime,
        readonly: games.readonly,
        publicAnnouncedAt: spotOffers.publicAnnouncedAt,
        nextActionAt: spotOffers.nextActionAt,
      })
      .from(spotOffers)
      .innerJoin(games, eq(spotOffers.gameId, games.id))
      .where(isNull(spotOffers.fulfilledByUserId));

    const gameIdsToAbort = new Set<number>();
    for (const row of openOffers) {
      if (row.readonly || now >= new Date(row.gameDateTime)) {
        gameIdsToAbort.add(row.gameId);
      }
    }
    for (const gameId of gameIdsToAbort) {
      await abortOpenOffersForGame(gameId);
    }

    // Public-phase shortcut: open offers past T−5h that still have next_action_at
    for (const row of openOffers) {
      if (gameIdsToAbort.has(row.gameId)) continue;
      if (row.publicAnnouncedAt) continue;
      if (
        row.nextActionAt != null &&
        now >= publicAnnounceAt(row.gameDateTime)
      ) {
        const [game] = await db
          .select()
          .from(games)
          .where(eq(games.id, row.gameId))
          .limit(1);
        if (game) {
          await transitionOfferToPublic(row.id, game, now);
        }
      }
    }

    const dueIds = await listDueSpotOfferIds(now);
    for (const offerId of dueIds) {
      await processSingleOfferInviteStep(offerId, now);
    }
  } catch (err) {
    console.error('processSpotOfferJobs error:', err);
  }
}
