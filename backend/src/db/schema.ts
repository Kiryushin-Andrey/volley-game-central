import { pgTable, serial, varchar, timestamp, boolean, integer, text, uuid } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  telegramId: varchar('telegram_id', { length: 255 }).unique(),
  telegramUsername: varchar('telegram_username', { length: 255 }),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  blockReason: text('block_reason'),
  isAdmin: boolean('is_admin').notNull().default(false),
  phoneNumber: varchar('phone_number', { length: 50 }),
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
  withPositions: boolean('with_positions').notNull().default(false),
  locationName: varchar('location_name', { length: 255 }),
  locationLink: varchar('location_link', { length: 1000 }),
  createdAt: timestamp('created_at').defaultNow(),
  createdById: serial('created_by_id').references(() => users.id),
});

export const gameRegistrations = pgTable('game_registrations', {
  id: serial('id').primaryKey(),
  gameId: serial('game_id').references(() => games.id),
  userId: serial('user_id').references(() => users.id),
  guestName: varchar('guest_name', { length: 255 }),
  paid: boolean('paid').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const bunqCredentials = pgTable('bunq_credentials', {
  userId: integer('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  
  // Monetary Account ID (unencrypted)
  monetaryAccountId: integer('monetary_account_id'),
  
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
  paid: boolean('paid').notNull().default(false)
});

// Authentication sessions for phone-based login
export const authSessions = pgTable('auth_sessions', {
  id: uuid('id').primaryKey(),
  phoneNumber: varchar('phone_number', { length: 50 }).notNull().unique(),
  authCode: varchar('auth_code', { length: 10 }).notNull(),
  creatingNewUser: boolean('creating_new_user').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});
