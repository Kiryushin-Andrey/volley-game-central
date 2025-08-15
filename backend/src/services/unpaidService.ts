import { db } from '../db';
import { games, gameRegistrations, paymentRequests } from '../db/schema';
import { and, eq, inArray, sql } from 'drizzle-orm';

export interface UnpaidItem {
  gameId: number;
  dateTime: Date;
  locationName: string | null;
  totalAmountCents: number | null;
  paymentLink: string | null; // latest (if exists)
}

// Aggregates unpaid payment requests for a user, grouped by game.
export async function getUserUnpaidItems(userId: number): Promise<UnpaidItem[]> {
  // Source of truth: unpaid payment requests filtered by userId
  const prRows = await db
    .select({
      gameRegistrationId: paymentRequests.gameRegistrationId,
      paymentLink: paymentRequests.paymentLink,
      createdAt: paymentRequests.createdAt,
      amountCents: paymentRequests.amountCents,
      paymentRequestId: paymentRequests.paymentRequestId,
      gameId: gameRegistrations.gameId,
    })
    .from(paymentRequests)
    .innerJoin(
      gameRegistrations,
      eq(paymentRequests.gameRegistrationId, gameRegistrations.id)
    )
    .where(and(eq(paymentRequests.paid, false), eq(paymentRequests.userId, userId)))
    .orderBy(sql`${paymentRequests.createdAt} desc`);

  if (prRows.length === 0) return [];

  // For each game, keep ONLY the latest unpaid payment request (by createdAt desc)
  // and use its link and amount. If there are multiple rows for that same request,
  // take the first non-null amount among them.
  type LatestByGame = {
    paymentRequestId: string | null;
    paymentLink: string | null;
    amountCents: number | null;
  };
  const latestByGame = new Map<number, LatestByGame>();
  for (const row of prRows) {
    const existing = latestByGame.get(row.gameId);
    if (!existing) {
      latestByGame.set(row.gameId, {
        paymentRequestId: (row.paymentRequestId as string) ?? null,
        paymentLink: row.paymentLink ?? null,
        amountCents: (row.amountCents as number | null) ?? null,
      });
      continue;
    }
    // If we already selected the latest PR for this game, only update amount if
    // this row belongs to the same PR and we still don't have an amount.
    if (
      existing.paymentRequestId &&
      existing.amountCents == null &&
      existing.paymentRequestId === (row.paymentRequestId as string)
    ) {
      if (row.amountCents != null) existing.amountCents = row.amountCents as number;
    }
  }

  const gameIds = Array.from(latestByGame.keys());

  // Load game details
  const gamesRows = await db.select().from(games).where(inArray(games.id, gameIds));
  const gameById = new Map(gamesRows.map((g) => [g.id, g]));

  const result: UnpaidItem[] = [];

  for (const gameId of gameIds) {
    const game = gameById.get(gameId);
    if (!game) continue;

    const latest = latestByGame.get(gameId)!;
    result.push({
      gameId: game.id,
      dateTime: new Date(game.dateTime),
      locationName: game.locationName ?? null,
      totalAmountCents: latest.amountCents ?? null,
      paymentLink: latest.paymentLink ?? null,
    });
  }

  // Sort oldest first
  result.sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());
  return result;
}
