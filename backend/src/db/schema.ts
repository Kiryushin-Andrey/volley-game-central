import { pgTable, serial, varchar, timestamp, boolean, integer, text, uuid, unique, bigint, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  telegramId: varchar('telegram_id', { length: 255 }).unique(),
  telegramUsername: varchar('telegram_username', { length: 255 }),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  prevDisplayNames: text('prev_display_names'),
  blockReason: text('block_reason'),
  blockedById: integer('blocked_by_id').references((): any => users.id, { onDelete: 'set null' }),
  isAdmin: boolean('is_admin').notNull().default(false),
  isTc: boolean('is_tc').notNull().default(false),
  phoneNumber: varchar('phone_number', { length: 50 }),
  playerLevel: varchar('player_level', { length: 32 }),
  playerLevelSetById: integer('player_level_set_by_id').references((): any => users.id, { onDelete: 'set null' }),
  playerLevelSetAt: timestamp('player_level_set_at'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const games = pgTable('games', {
  id: serial('id').primaryKey(),
  dateTime: timestamp('date_time').notNull(),
  maxPlayers: serial('max_players').notNull(),
  unregisterDeadlineHours: serial('unregister_deadline_hours').notNull().default(5),
  paymentAmount: integer('payment_amount').notNull(),
  pricingMode: varchar('pricing_mode', { length: 20 }).notNull().default('per_participant'), // 'per_participant' or 'total_cost'
  fullyPaid: boolean('fully_paid').notNull().default(false),
  gameFormat: varchar('game_format', { length: 32 }).notNull().default('recreational'),
  readonly: boolean('readonly').notNull().default(false),
  locationName: varchar('location_name', { length: 255 }),
  locationLink: varchar('location_link', { length: 1000 }),
  tag: varchar('tag', { length: 50 }),
  title: varchar('title', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow(),
  createdById: serial('created_by_id').references(() => users.id),
  collectorUserId: integer('collector_user_id').references(() => users.id),
});

export const gameRegistrations = pgTable('game_registrations', {
  id: serial('id').primaryKey(),
  gameId: serial('game_id').references(() => games.id),
  userId: serial('user_id').references(() => users.id),
  guestName: varchar('guest_name', { length: 255 }),
  paid: boolean('paid').notNull().default(false),
  bringingTheBall: boolean('bringing_the_ball').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const bunqCredentials = pgTable('bunq_credentials', {
  userId: integer('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  
  // Monetary Account ID (unencrypted)
  monetaryAccountId: integer('monetary_account_id'),
  
  // API Key Name (unencrypted, used as User-Agent in Bunq API requests)
  apiKeyName: varchar('api_key_name', { length: 255 }),
  
  // API Key (encrypted)
  apiKeyEncrypted: text('api_key_encrypted').notNull(),
  apiKeyIv: text('api_key_iv').notNull(),
  apiKeyAuthTag: text('api_key_auth_tag').notNull(),
  apiKeySalt: text('api_key_salt').notNull(),
  
  // Installation Token (encrypted, can be null)
  installationTokenEncrypted: text('installation_token_encrypted'),
  installationTokenIv: text('installation_token_iv'),
  installationTokenAuthTag: text('installation_token_auth_tag'),
  installationTokenSalt: text('installation_token_salt'),
  
  // Private Key (encrypted, can be null)
  privateKeyEncrypted: text('private_key_encrypted'),
  privateKeyIv: text('private_key_iv'),
  privateKeyAuthTag: text('private_key_auth_tag'),
  privateKeySalt: text('private_key_salt'),
  
  // Session Token (encrypted, can be null)
  sessionTokenEncrypted: text('session_token_encrypted'),
  sessionTokenIv: text('session_token_iv'),
  sessionTokenAuthTag: text('session_token_auth_tag'),
  sessionTokenSalt: text('session_token_salt'),
  
  // Timestamps for each credential type
  apiKeyUpdatedAt: timestamp('api_key_updated_at').defaultNow(),
  installationTokenUpdatedAt: timestamp('installation_token_updated_at'),
  privateKeyUpdatedAt: timestamp('private_key_updated_at'),
  sessionTokenUpdatedAt: timestamp('session_token_updated_at'),
});

export const paymentRequests = pgTable('payment_requests', {
  id: serial('id').primaryKey(),
  gameRegistrationId: serial('game_registration_id').references(() => gameRegistrations.id, { onDelete: 'cascade' }),
  userId: integer('user_id'),
  amountCents: integer('amount_cents'),
  paymentRequestId: varchar('payment_request_id', { length: 255 }).notNull(),
  paymentLink: varchar('payment_link', { length: 500 }).notNull(),
  monetaryAccountId: integer('monetary_account_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastCheckedAt: timestamp('last_checked_at').defaultNow().notNull(),
  paid: boolean('paid').notNull().default(false),
  webhookReceived: boolean('webhook_received').notNull().default(false)
});

// Authentication sessions for phone-based login
export const authSessions = pgTable('auth_sessions', {
  id: uuid('id').primaryKey(),
  phoneNumber: varchar('phone_number', { length: 50 }).notNull(),
  authCode: varchar('auth_code', { length: 10 }),
  creatingNewUser: boolean('creating_new_user').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// Game administrators assigned per day of week and 5-1 mark
export const gameAdministrators = pgTable('game_administrators', {
  id: serial('id').primaryKey(),
  dayOfWeek: integer('day_of_week').notNull(), // 0 = Monday, 1 = Tuesday, ..., 6 = Sunday
  withPositions: boolean('with_positions').notNull().default(false), // true for 5-1 games, false for regular games
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  uniqueDayPosition: unique().on(table.dayOfWeek, table.withPositions),
}));

// Priority players assigned per day of week and 5-1 mark
export const priorityPlayers = pgTable('priority_players', {
  id: serial('id').primaryKey(),
  gameAdministratorId: integer('game_administrator_id').notNull().references(() => gameAdministrators.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  uniqueAdministratorUser: unique().on(table.gameAdministratorId, table.userId),
}));

/**
 * Post-deadline roster spot transfer offers.
 * Row existence = offer still relevant. Open = fulfilled_by_user_id IS NULL.
 * Cancel deletes the row (after Telegram cleanup). Fulfill sets fulfilled_by_user_id.
 */
export const spotOffers = pgTable('spot_offers', {
  id: serial('id').primaryKey(),
  gameId: integer('game_id').notNull().references(() => games.id, { onDelete: 'cascade' }),
  /** Offered registration row; stays after fulfill (user_id becomes replacer). ON DELETE RESTRICT. */
  registrationId: integer('registration_id').notNull().references(() => gameRegistrations.id, { onDelete: 'restrict' }),
  /** Who offered; kept after fulfill even though registration.user_id changes. */
  offererUserId: integer('offerer_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  publicAnnouncedAt: timestamp('public_announced_at'),
  publicTelegramMessageId: bigint('public_telegram_message_id', { mode: 'number' }),
  fulfilledByUserId: integer('fulfilled_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  /** Poller due time for next invite DM or public transition; NULL once public or fulfilled. */
  nextActionAt: timestamp('next_action_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  gameIdIdx: index('spot_offers_game_id_idx').on(table.gameId),
  openByGameIdx: index('spot_offers_open_by_game_idx')
    .on(table.gameId)
    .where(sql`${table.fulfilledByUserId} IS NULL`),
  dueNextActionIdx: index('spot_offers_due_next_action_idx')
    .on(table.nextActionAt)
    .where(sql`${table.fulfilledByUserId} IS NULL AND ${table.nextActionAt} IS NOT NULL`),
  oneOpenPerRegistration: uniqueIndex('spot_offers_one_open_per_registration_uidx')
    .on(table.registrationId)
    .where(sql`${table.fulfilledByUserId} IS NULL`),
}));

/** Private waitlist invite DMs for spacing/dedupe/deleteMessage. Never an accept gate. */
export const spotOfferInvites = pgTable('spot_offer_invites', {
  id: serial('id').primaryKey(),
  spotOfferId: integer('spot_offer_id').notNull().references(() => spotOffers.id, { onDelete: 'cascade' }),
  inviteeUserId: integer('invitee_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  invitedAt: timestamp('invited_at').defaultNow().notNull(),
  telegramChatId: varchar('telegram_chat_id', { length: 255 }),
  telegramMessageId: bigint('telegram_message_id', { mode: 'number' }),
}, (table) => ({
  uniqueOfferInvitee: unique().on(table.spotOfferId, table.inviteeUserId),
}));
