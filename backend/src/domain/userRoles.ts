export type UserRoleFlags = {
  isAdmin: boolean;
  isTc: boolean;
};

export function canManagePlayerLevels(user: UserRoleFlags): boolean {
  return user.isAdmin || user.isTc;
}
