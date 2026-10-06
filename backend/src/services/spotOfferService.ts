import { and, eq, inArray, isNull, lte, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  gameRegistrations,
  games,
  spotOfferInvites,
  spotOffers,
  users,
} from '../db/schema';
import {
  evaluateSpotOfferCreateGate,
  isWaitlistAtIndex,
  publicAnnounceAt,
  spotOfferInviteSpacingMs,
} from '../domain/gamePolicy';
import {
  findRegistrationIndex,
  mapRegistrationsWithWaitlist,
} from './registrationService';
import { notifyUser } from './notificationService';
import {
  deleteTelegramMessage,
  getTelegramGroupId,
  sendTelegramNotification,
  sendSpotOfferPublicAnnouncement,
} from './telegramService';
import { formatGameDate } from '../utils/dateUtils';
import { evaluateSpotOfferAcceptEligibility } from '../utils/registrationEligibility';

type GameRow = typeof games.$inferSelect;
type SpotOfferRow = typeof spotOffers.$inferSelect;

export type SpotOfferErrorCode =
  | 'readonly'
  | 'past'
  | 'before_deadline'
  | 'not_roster'
  | 'not_found'
  | 'duplicate_open'
  | 'self_accept'
  | 'already_roster'
  | 'offer_closed'
  | 'ineligible'
  | 'forbidden';

export type SpotOfferFail = {
  ok: false;
  code: SpotOfferErrorCode;
  status: number;
  error: string;
};

export type SpotOfferOk<T> = { ok: true } & T;

async function loadOrderedRegistrations(gameId: number) {
  return db
    .select()
    .from(gameRegistrations)
    .where(eq(gameRegistrations.gameId, gameId))
    .orderBy(gameRegistrations.createdAt, gameRegistrations.id);
}

function matchGuestName(
  guestName: string | null | undefined,
): string | null {
  if (guestName === undefined || guestName === null || guestName === '') {
    return null;
  }
  return guestName;
}

export type ActiveSpotOfferDto = {
  id: number;
  offererUserId: number;
  guestName: string | null;
  offererDisplayName: string | null;
};

async function toActiveSpotOfferDto(
  offer: SpotOfferRow,
): Promise<ActiveSpotOfferDto | null> {
  const [registration] = await db
    .select({
      guestName: gameRegistrations.guestName,
    })
    .from(gameRegistrations)
    .where(eq(gameRegistrations.id, offer.registrationId))
    .limit(1);

  const [offerer] = await db
    .select({ displayName: users.displayName })
    .from(users)
    .where(eq(users.id, offer.offererUserId))
    .limit(1);

  return {
    id: offer.id,
    offererUserId: offer.offererUserId,
    guestName: registration?.guestName ?? null,
    offererDisplayName: offerer?.displayName ?? null,
  };
}

export async function listOpenOffersForGame(
  gameId: number,
): Promise<SpotOfferRow[]> {
  return db
    .select()
    .from(spotOffers)
    .where(
      and(eq(spotOffers.gameId, gameId), isNull(spotOffers.fulfilledByUserId)),
    );
}

export async function getSpotOfferDetailFields(
  gameId: number,
  callerUserId: number,
): Promise<{
  activeSpotOffers: ActiveSpotOfferDto[];
  myOffers: ActiveSpotOfferDto[];
}> {
  const open = await listOpenOffersForGame(gameId);
  const activeSpotOffers: ActiveSpotOfferDto[] = [];
  for (const offer of open) {
    const dto = await toActiveSpotOfferDto(offer);
    if (dto) activeSpotOffers.push(dto);
  }

  const myOffers = activeSpotOffers.filter(
    (o) => o.offererUserId === callerUserId,
  );

  return { activeSpotOffers, myOffers };
}

type TelegramCleanupTarget = {
  chatId: string;
  messageId: number;
};

async function loadCleanupTargets(
  offer: SpotOfferRow,
): Promise<TelegramCleanupTarget[]> {
  const targets: TelegramCleanupTarget[] = [];
  const invites = await db
    .select({
      telegramChatId: spotOfferInvites.telegramChatId,
      telegramMessageId: spotOfferInvites.telegramMessageId,
    })
    .from(spotOfferInvites)
    .where(eq(spotOfferInvites.spotOfferId, offer.id));

  for (const invite of invites) {
    if (invite.telegramChatId && invite.telegramMessageId != null) {
      targets.push({
        chatId: invite.telegramChatId,
        messageId: invite.telegramMessageId,
      });
    }
  }

  const groupId = getTelegramGroupId();
  if (groupId && offer.publicTelegramMessageId != null) {
    targets.push({
      chatId: groupId,
      messageId: offer.publicTelegramMessageId,
    });
  }

  return targets;
}

async function bestEffortDeleteMessages(
  targets: TelegramCleanupTarget[],
): Promise<void> {
  for (const target of targets) {
    try {
      await deleteTelegramMessage(target.chatId, target.messageId);
    } catch (err) {
      console.error(
        `Failed to delete Telegram message ${target.messageId} in ${target.chatId}:`,
        err,
      );
    }
  }
}

/**
 * Cancel an open offer: delete Telegram messages (best-effort), invite rows, offer row.
 */
export async function cancelSpotOfferById(
  offerId: number,
): Promise<SpotOfferOk<{ cancelled: true }> | SpotOfferFail> {
  const [offer] = await db
    .select()
    .from(spotOffers)
    .where(and(eq(spotOffers.id, offerId), isNull(spotOffers.fulfilledByUserId)))
    .limit(1);

  if (!offer) {
    return {
      ok: false,
      code: 'not_found',
      status: 404,
      error: 'Open spot offer not found',
    };
  }

  const targets = await loadCleanupTargets(offer);
  await db.delete(spotOfferInvites).where(eq(spotOfferInvites.spotOfferId, offer.id));
  await db.delete(spotOffers).where(eq(spotOffers.id, offer.id));
  await bestEffortDeleteMessages(targets);

  return { ok: true, cancelled: true };
}

/** Abort open offer(s) for a specific registration (admin remove / capacity demote). */
export async function abortOpenOfferForRegistration(
  registrationId: number,
): Promise<boolean> {
  const [offer] = await db
    .select()
    .from(spotOffers)
    .where(
      and(
        eq(spotOffers.registrationId, registrationId),
        isNull(spotOffers.fulfilledByUserId),
      ),
    )
    .limit(1);
  if (!offer) return false;
  const result = await cancelSpotOfferById(offer.id);
  return result.ok;
}

/**
 * After capacity shrink: abort offers whose registration is now waitlisted.
 */
export async function abortOffersDemotedByCapacity(
  gameId: number,
  newMaxPlayers: number,
): Promise<number> {
  const ordered = await loadOrderedRegistrations(gameId);
  const open = await listOpenOffersForGame(gameId);
  let cancelled = 0;
  for (const offer of open) {
    const index = findRegistrationIndex(ordered, { id: offer.registrationId });
    if (index === -1 || isWaitlistAtIndex(index, newMaxPlayers)) {
      const result = await cancelSpotOfferById(offer.id);
      if (result.ok) cancelled += 1;
    }
  }
  return cancelled;
}

export type CreateSpotOfferInput = {
  game: GameRow;
  userId: number;
  guestName?: string | null;
  now?: Date;
};

export async function createSpotOffer(
  input: CreateSpotOfferInput,
): Promise<
  SpotOfferOk<{ offer: SpotOfferRow; enteredPublic: boolean }> | SpotOfferFail
> {
  const { game, userId } = input;
  const guestName = matchGuestName(input.guestName);
  const now = input.now ?? new Date();

  const ordered = await loadOrderedRegistrations(game.id);
  const index = findRegistrationIndex(ordered, { userId, guestName });

  if (index === -1) {
    return {
      ok: false,
      code: 'not_found',
      status: 404,
      error: guestName
        ? 'Guest registration not found'
        : 'Registration not found',
    };
  }

  const registration = ordered[index];
  const gate = evaluateSpotOfferCreateGate({ now, game, index });

  if (!gate.ok) {
    const status =
      gate.code === 'before_deadline' ||
      gate.code === 'readonly' ||
      gate.code === 'past'
        ? 403
        : 400;
    return { ok: false, code: gate.code, status, error: gate.error };
  }

  const enterPublic = now >= publicAnnounceAt(game.dateTime);

  let inserted: SpotOfferRow;
  try {
    const rows = await db
      .insert(spotOffers)
      .values({
        gameId: game.id,
        registrationId: registration.id!,
        offererUserId: userId,
        publicAnnouncedAt: null,
        publicTelegramMessageId: null,
        fulfilledByUserId: null,
        nextActionAt: enterPublic ? null : now,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    inserted = rows[0];
  } catch (err: any) {
    if (err?.code === '23505') {
      return {
        ok: false,
        code: 'duplicate_open',
        status: 409,
        error: 'An open offer already exists for this registration',
      };
    }
    throw err;
  }

  if (enterPublic) {
    await transitionOfferToPublic(inserted.id, game, now);
    const [reloaded] = await db
      .select()
      .from(spotOffers)
      .where(eq(spotOffers.id, inserted.id))
      .limit(1);
    return { ok: true, offer: reloaded ?? inserted, enteredPublic: true };
  }

  // Kick waitlist walk immediately for the first invite.
  await processSingleOfferInviteStep(inserted.id, now);
  const [reloaded] = await db
    .select()
    .from(spotOffers)
    .where(eq(spotOffers.id, inserted.id))
    .limit(1);

  return {
    ok: true,
    offer: reloaded ?? inserted,
    enteredPublic: Boolean(reloaded?.publicAnnouncedAt),
  };
}

export type CancelMineInput = {
  gameId: number;
  userId: number;
  guestName?: string | null;
};

export async function cancelMySpotOffer(
  input: CancelMineInput,
): Promise<SpotOfferOk<{ cancelled: true }> | SpotOfferFail> {
  const guestName = matchGuestName(input.guestName);

  const ordered = await loadOrderedRegistrations(input.gameId);
  const index = findRegistrationIndex(ordered, {
    userId: input.userId,
    guestName,
  });
  if (index === -1) {
    return {
      ok: false,
      code: 'not_found',
      status: 404,
      error: 'Registration not found',
    };
  }

  const registration = ordered[index];
  const [offer] = await db
    .select()
    .from(spotOffers)
    .where(
      and(
        eq(spotOffers.registrationId, registration.id!),
        eq(spotOffers.offererUserId, input.userId),
        isNull(spotOffers.fulfilledByUserId),
      ),
    )
    .limit(1);

  if (!offer) {
    return {
      ok: false,
      code: 'not_found',
      status: 404,
      error: 'Open spot offer not found',
    };
  }

  return cancelSpotOfferById(offer.id);
}

export type AcceptSpotOfferInput = {
  game: GameRow;
  offerId: number;
  acceptorUserId: number;
  now?: Date;
};

export async function acceptSpotOffer(
  input: AcceptSpotOfferInput,
): Promise<
  SpotOfferOk<{
    offer: SpotOfferRow;
    registrationId: number;
    preservedCreatedAt: Date | string | null;
  }> | SpotOfferFail
> {
  const { game, offerId, acceptorUserId } = input;
  const now = input.now ?? new Date();

  const acceptEligibility = await evaluateSpotOfferAcceptEligibility({
    game,
    acceptorUserId,
  });
  if (!acceptEligibility.ok) {
    return acceptEligibility;
  }

  return db.transaction(async (tx) => {
    const locked = await tx.execute(
      sql`SELECT * FROM spot_offers WHERE id = ${offerId} AND fulfilled_by_user_id IS NULL FOR UPDATE`,
    );
    const offerRows = (locked as any).rows as Array<Record<string, any>>;
    if (!offerRows.length) {
      return {
        ok: false as const,
        code: 'offer_closed' as const,
        status: 409,
        error: 'Spot offer is no longer open',
      };
    }

    const offerRaw = offerRows[0];
    const offer: SpotOfferRow = {
      id: offerRaw.id,
      gameId: offerRaw.game_id,
      registrationId: offerRaw.registration_id,
      offererUserId: offerRaw.offerer_user_id,
      publicAnnouncedAt: offerRaw.public_announced_at,
      publicTelegramMessageId: offerRaw.public_telegram_message_id != null
        ? Number(offerRaw.public_telegram_message_id)
        : null,
      fulfilledByUserId: offerRaw.fulfilled_by_user_id,
      nextActionAt: offerRaw.next_action_at,
      createdAt: offerRaw.created_at,
      updatedAt: offerRaw.updated_at,
    };

    if (offer.gameId !== game.id) {
      return {
        ok: false as const,
        code: 'not_found' as const,
        status: 404,
        error: 'Spot offer not found for this game',
      };
    }

    if (acceptorUserId === offer.offererUserId) {
      return {
        ok: false as const,
        code: 'self_accept' as const,
        status: 403,
        error: 'You cannot accept your own spot offer',
      };
    }

    if (game.readonly || now >= new Date(game.dateTime)) {
      return {
        ok: false as const,
        code: 'past' as const,
        status: 403,
        error: 'Cannot accept a spot for a readonly or past game',
      };
    }

    const ordered = await tx
      .select()
      .from(gameRegistrations)
      .where(eq(gameRegistrations.gameId, game.id))
      .orderBy(gameRegistrations.createdAt, gameRegistrations.id);

    const offeredIndex = findRegistrationIndex(ordered, {
      id: offer.registrationId,
    });
    if (offeredIndex === -1 || isWaitlistAtIndex(offeredIndex, game.maxPlayers)) {
      return {
        ok: false as const,
        code: 'not_roster' as const,
        status: 409,
        error: 'This offered spot is no longer available',
      };
    }

    const offeredReg = ordered[offeredIndex];

    // Reject if acceptor already has any roster registration (self or guest).
    const acceptorRegs = mapRegistrationsWithWaitlist(ordered, game.maxPlayers).filter(
      (r) => r.userId === acceptorUserId,
    );
    const onRoster = acceptorRegs.some((r) => !r.isWaitlist);
    if (onRoster) {
      return {
        ok: false as const,
        code: 'already_roster' as const,
        status: 403,
        error: 'You already have a spot for this game',
      };
    }

    // Delete acceptor's waitlist (or other) rows on this game.
    const acceptorRowIds = acceptorRegs.map((r) => r.id!).filter(Boolean);
    if (acceptorRowIds.length > 0) {
      await tx
        .delete(gameRegistrations)
        .where(inArray(gameRegistrations.id, acceptorRowIds));
    }

    const preservedCreatedAt = offeredReg.createdAt ?? null;

    await tx
      .update(gameRegistrations)
      .set({
        userId: acceptorUserId,
        guestName: null,
        bringingTheBall: false,
        paid: false,
      })
      .where(eq(gameRegistrations.id, offer.registrationId));

    // Verify createdAt was preserved (UPDATE must not touch it).
    const [updatedReg] = await tx
      .select()
      .from(gameRegistrations)
      .where(eq(gameRegistrations.id, offer.registrationId))
      .limit(1);

    const inviteTargets = await tx
      .select({
        telegramChatId: spotOfferInvites.telegramChatId,
        telegramMessageId: spotOfferInvites.telegramMessageId,
      })
      .from(spotOfferInvites)
      .where(eq(spotOfferInvites.spotOfferId, offer.id));

    await tx
      .delete(spotOfferInvites)
      .where(eq(spotOfferInvites.spotOfferId, offer.id));

    const [fulfilled] = await tx
      .update(spotOffers)
      .set({
        fulfilledByUserId: acceptorUserId,
        nextActionAt: null,
        updatedAt: now,
      })
      .where(eq(spotOffers.id, offer.id))
      .returning();

    // Schedule best-effort Telegram cleanup after commit via return payload.
    const cleanup: TelegramCleanupTarget[] = [];
    for (const invite of inviteTargets) {
      if (invite.telegramChatId && invite.telegramMessageId != null) {
        cleanup.push({
          chatId: invite.telegramChatId,
          messageId: invite.telegramMessageId,
        });
      }
    }
    const groupId = getTelegramGroupId();
    if (groupId && offer.publicTelegramMessageId != null) {
      cleanup.push({
        chatId: groupId,
        messageId: offer.publicTelegramMessageId,
      });
    }

    // Attach cleanup for after-transaction (drizzle tx callback can't easily defer).
    (fulfillCleanupQueue as TelegramCleanupTarget[]).push(...cleanup);

    return {
      ok: true as const,
      offer: fulfilled,
      registrationId: offer.registrationId,
      preservedCreatedAt: updatedReg?.createdAt ?? preservedCreatedAt,
    };
  }).then(async (result) => {
    // Drain cleanup queue for this accept (best-effort; never roll back fulfill).
    const pending = fulfillCleanupQueue.splice(0, fulfillCleanupQueue.length);
    await bestEffortDeleteMessages(pending);

    if (result.ok) {
      try {
        const formattedDate = formatGameDate(new Date(game.dateTime));
        const [offerer] = await db
          .select()
          .from(users)
          .where(eq(users.id, result.offer.offererUserId))
          .limit(1);
        const [replacer] = await db
          .select()
          .from(users)
          .where(eq(users.id, acceptorUserId))
          .limit(1);
        if (offerer) {
          await notifyUser(
            offerer,
            `✅ Your offered spot for the volleyball game on <b>${formattedDate}</b> was taken. Thanks!`,
            game.id,
            false,
          );
        }
        if (replacer) {
          await notifyUser(
            replacer,
            `🎉 You took an offered spot for the volleyball game on <b>${formattedDate}</b>. See you there! 🏐`,
            game.id,
            false,
          );
        }
      } catch (err) {
        console.error('Fulfill notifications failed:', err);
      }
    }

    return result;
  });
}

/** Module-level queue drained after accept transaction commits. */
const fulfillCleanupQueue: TelegramCleanupTarget[] = [];

export async function transitionOfferToPublic(
  offerId: number,
  game: GameRow,
  now: Date = new Date(),
): Promise<void> {
  // Claim: only if still open and not yet public.
  const claimed = await db
    .update(spotOffers)
    .set({
      publicAnnouncedAt: now,
      nextActionAt: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(spotOffers.id, offerId),
        isNull(spotOffers.fulfilledByUserId),
        isNull(spotOffers.publicAnnouncedAt),
      ),
    )
    .returning();

  if (!claimed.length) {
    return;
  }

  const offer = claimed[0];
  try {
    const sent = await sendSpotOfferPublicAnnouncement({
      gameDate: new Date(game.dateTime),
      gameId: game.id,
      gameFormat: String(game.gameFormat),
    });
    if (sent?.messageId != null) {
      await db
        .update(spotOffers)
        .set({
          publicTelegramMessageId: sent.messageId,
          updatedAt: new Date(),
        })
        .where(eq(spotOffers.id, offer.id));
    }
  } catch (err) {
    console.error(`Failed to announce spot offer ${offerId} publicly:`, err);
  }
}

/**
 * One invite-walk step for an open offer.
 * Advances next_action_at atomically when claiming due work.
 */
export async function processSingleOfferInviteStep(
  offerId: number,
  now: Date = new Date(),
): Promise<'invited' | 'public' | 'skipped' | 'done'> {
  // Claim due row: open, next_action_at set and <= now, not yet public.
  const claimed = await db
    .update(spotOffers)
    .set({
      // Temporarily push next_action_at forward to avoid double-claim by concurrent pollers.
      nextActionAt: new Date(now.getTime() + spotOfferInviteSpacingMs()),
      updatedAt: now,
    })
    .where(
      and(
        eq(spotOffers.id, offerId),
        isNull(spotOffers.fulfilledByUserId),
        isNull(spotOffers.publicAnnouncedAt),
        sql`${spotOffers.nextActionAt} IS NOT NULL`,
        lte(spotOffers.nextActionAt, now),
      ),
    )
    .returning();

  if (!claimed.length) {
    return 'skipped';
  }

  const offer = claimed[0];
  const [game] = await db.select().from(games).where(eq(games.id, offer.gameId)).limit(1);
  if (!game) {
    await cancelSpotOfferById(offer.id);
    return 'done';
  }

  if (game.readonly || now >= new Date(game.dateTime)) {
    await cancelSpotOfferById(offer.id);
    return 'done';
  }

  if (now >= publicAnnounceAt(game.dateTime)) {
    await transitionOfferToPublic(offer.id, game, now);
    return 'public';
  }

  const nextInvitee = await findNextInviteCandidate(offer, game);
  if (!nextInvitee) {
    await transitionOfferToPublic(offer.id, game, now);
    return 'public';
  }

  const formattedDate = formatGameDate(new Date(game.dateTime));
  const message = `📣 A spot for the volleyball game on <b>${formattedDate}</b> is being offered.`;

  const sent = await sendTelegramNotification(
    nextInvitee.telegramId!,
    message,
    game.id,
  );

  if (sent) {
    await db.insert(spotOfferInvites).values({
      spotOfferId: offer.id,
      inviteeUserId: nextInvitee.id,
      invitedAt: now,
      telegramChatId: sent.chatId,
      telegramMessageId: sent.messageId,
    });
    // next_action_at already advanced on claim
    return 'invited';
  }

  // DM failed — leave advanced next_action_at so we retry later / move on.
  return 'skipped';
}

async function findNextInviteCandidate(
  offer: SpotOfferRow,
  game: GameRow,
): Promise<{ id: number; telegramId: string | null } | null> {
  const ordered = await db
    .select({
      id: gameRegistrations.id,
      userId: gameRegistrations.userId,
      guestName: gameRegistrations.guestName,
      createdAt: gameRegistrations.createdAt,
      telegramId: users.telegramId,
    })
    .from(gameRegistrations)
    .innerJoin(users, eq(gameRegistrations.userId, users.id))
    .where(eq(gameRegistrations.gameId, game.id))
    .orderBy(gameRegistrations.createdAt, gameRegistrations.id);

  const waitlisted = mapRegistrationsWithWaitlist(ordered, game.maxPlayers).filter(
    (r) => r.isWaitlist && !r.guestName,
  );

  // Users already invited on this or any other open offer
  const alreadyInvited = await db
    .select({ inviteeUserId: spotOfferInvites.inviteeUserId })
    .from(spotOfferInvites)
    .innerJoin(spotOffers, eq(spotOfferInvites.spotOfferId, spotOffers.id))
    .where(isNull(spotOffers.fulfilledByUserId));
  const alreadyInvitedSet = new Set(
    alreadyInvited.map((r) => r.inviteeUserId),
  );

  for (const candidate of waitlisted) {
    if (candidate.userId === offer.offererUserId) continue;
    if (alreadyInvitedSet.has(candidate.userId)) continue;
    if (!candidate.telegramId) continue; // invite is Telegram DM only; no invite row for skipped users
    return { id: candidate.userId, telegramId: candidate.telegramId };
  }

  return null;
}
