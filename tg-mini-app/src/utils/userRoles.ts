import type { User } from '../types';

export function canManagePlayerLevels(user: Pick<User, 'isAdmin' | 'isTc'>): boolean {
  return user.isAdmin || user.isTc;
}
