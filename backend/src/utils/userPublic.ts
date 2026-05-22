/** Strip internal player level from user payloads exposed outside global-admin player-levels routes. */
export function omitPlayerLevel<T extends Record<string, unknown>>(user: T): Omit<T, 'playerLevel'> {
  const { playerLevel: _removed, ...rest } = user;
  return rest;
}
