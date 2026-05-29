import type { User } from '../types';

export function canManagePlayerLevels(user: Pick<User, 'isAdmin' | 'isTc'> | null | undefined): boolean {
  return Boolean(user?.isAdmin || user?.isTc);
}

export function isTcOnly(user: Pick<User, 'isAdmin' | 'isTc'> | null | undefined): boolean {
  return Boolean(user?.isTc && !user?.isAdmin);
}

export function isGlobalAdmin(user: Pick<User, 'isAdmin'> | null | undefined): boolean {
  return Boolean(user?.isAdmin);
}
