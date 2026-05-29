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

export function isAssignedGameAdmin(game: { isAssignedAdmin?: boolean } | null | undefined): boolean {
  return Boolean(game?.isAssignedAdmin);
}

export function isGameAdminForGame(
  user: Pick<User, 'isAdmin'> | null | undefined,
  game: { isAssignedAdmin?: boolean } | null | undefined,
): boolean {
  return Boolean(user?.isAdmin || game?.isAssignedAdmin);
}

export function canOpenPlayerInfoOnGame(
  user: Pick<User, 'isAdmin' | 'isTc'> | null | undefined,
  game: { isAssignedAdmin?: boolean } | null | undefined,
): boolean {
  return isGameAdminForGame(user, game) || Boolean(user?.isTc);
}

export type PlayerInfoDialogViewer = 'globalAdmin' | 'tc' | 'assignedGameAdmin';

export function playerInfoDialogViewer(
  user: Pick<User, 'isAdmin' | 'isTc'> | null | undefined,
): PlayerInfoDialogViewer {
  if (user?.isAdmin) return 'globalAdmin';
  if (user?.isTc) return 'tc';
  return 'assignedGameAdmin';
}
