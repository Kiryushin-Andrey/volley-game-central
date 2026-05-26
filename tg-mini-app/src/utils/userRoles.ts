import type { User } from '../types';

export function canManagePlayerLevels(user: Pick<User, 'isAdmin' | 'isTc'>): boolean {
  return user.isAdmin || user.isTc;
}

export function isTcOnly(user: Pick<User, 'isAdmin' | 'isTc'>): boolean {
  return user.isTc && !user.isAdmin;
}

/** Global admins use the Players hub; TC-only users go straight to player levels. */
export function playersManagementPath(user: Pick<User, 'isAdmin' | 'isTc'>): '/players' | '/player-levels' {
  return user.isAdmin ? '/players' : '/player-levels';
}
