/** Strip player level metadata from user payloads for non-manager viewers. */
export function omitPlayerLevel<T extends Record<string, unknown>>(user: T) {
  const {
    playerLevel: _playerLevel,
    playerLevelSetBy: _playerLevelSetBy,
    playerLevelSetAt: _playerLevelSetAt,
    playerLevelSetById: _playerLevelSetById,
    ...rest
  } = user;
  return rest;
}
