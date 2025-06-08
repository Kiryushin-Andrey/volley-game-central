import { pgTable, serial, varchar, timestamp, boolean } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  telegramId: varchar('telegram_id', { length: 255 }).notNull().unique(),
  username: varchar('username', { length: 255 }).notNull(),
  avatarUrl: varchar('avatar_url', { length: 500 }),
  isAdmin: boolean('is_admin').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

export const games = pgTable('games', {
  id: serial('id').primaryKey(),
  dateTime: timestamp('date_time').notNull(),
  maxPlayers: serial('max_players').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  createdById: serial('created_by_id').references(() => users.id),
});

export const gameRegistrations = pgTable('game_registrations', {
  id: serial('id').primaryKey(),
  gameId: serial('game_id').references(() => games.id),
  userId: serial('user_id').references(() => users.id),
  paid: boolean('paid').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
});
