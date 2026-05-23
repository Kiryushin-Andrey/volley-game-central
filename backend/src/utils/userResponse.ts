import type { InferSelectModel } from 'drizzle-orm';
import { users } from '../db/schema';

type UserRow = InferSelectModel<typeof users>;

/** Strip internal fields (e.g. player level) from user rows returned to non-admin clients. */
export function toPublicAuthUser(user: UserRow) {
  const { playerLevel: _playerLevel, ...rest } = user;
  return rest;
}
