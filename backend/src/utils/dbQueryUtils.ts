import { users } from '../db/schema';

/**
 * Creates a user selection object for use in Drizzle ORM queries.
 * This is commonly used when joining users with other tables.
 * 
 * @returns An object that can be used in drizzle's `.select()` method
 */
export function getUserSelectFields() {
  return {
    id: users.id,
    telegramId: users.telegramId,
    displayName: users.displayName,
    telegramUsername: users.telegramUsername,
    avatarUrl: users.avatarUrl,
    isAdmin: users.isAdmin,
    createdAt: users.createdAt,
    blockReason: users.blockReason,
    phoneNumber: users.phoneNumber,
  };
}

