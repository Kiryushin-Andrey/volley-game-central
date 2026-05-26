import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mapPlayerLevelMetadata } from './playerLevelUser';

describe('mapPlayerLevelMetadata', () => {
  it('maps setter and timestamp when present', () => {
    const result = mapPlayerLevelMetadata({
      playerLevel: 'intermediate',
      playerLevelSetAt: new Date('2026-05-20T10:00:00.000Z'),
      setterId: 7,
      setterDisplayName: 'Coach Ada',
    });
    assert.equal(result.playerLevel, 'intermediate');
    assert.deepEqual(result.playerLevelSetBy, { id: 7, displayName: 'Coach Ada' });
    assert.equal(result.playerLevelSetAt, '2026-05-20T10:00:00.000Z');
  });

  it('returns null metadata when level unset', () => {
    const result = mapPlayerLevelMetadata({
      playerLevel: null,
      playerLevelSetAt: null,
      setterId: null,
      setterDisplayName: null,
    });
    assert.equal(result.playerLevel, null);
    assert.equal(result.playerLevelSetBy, null);
    assert.equal(result.playerLevelSetAt, null);
  });
});
