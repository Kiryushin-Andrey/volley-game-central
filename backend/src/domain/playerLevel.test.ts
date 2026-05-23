import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  compareUsersForPlayerLevelsList,
  parsePlayerLevel,
  PLAYER_LEVELS,
} from './playerLevel';

describe('parsePlayerLevel', () => {
  it('accepts valid levels', () => {
    for (const level of PLAYER_LEVELS) {
      assert.equal(parsePlayerLevel(level), level);
    }
  });

  it('rejects invalid values', () => {
    assert.equal(parsePlayerLevel(null), null);
    assert.equal(parsePlayerLevel('expert'), null);
    assert.equal(parsePlayerLevel(''), null);
  });
});

describe('compareUsersForPlayerLevelsList', () => {
  const sort = (rows: { displayName: string; playerLevel: 'beginner' | 'intermediate' | 'advanced' | null }[]) =>
    [...rows].sort(compareUsersForPlayerLevelsList);

  it('orders unassigned first, then advanced, intermediate, beginner', () => {
    const ordered = sort([
      { displayName: 'Zoe', playerLevel: 'beginner' },
      { displayName: 'Amy', playerLevel: null },
      { displayName: 'Bob', playerLevel: 'advanced' },
      { displayName: 'Cal', playerLevel: 'intermediate' },
    ]);
    assert.deepEqual(
      ordered.map((u) => u.displayName),
      ['Amy', 'Bob', 'Cal', 'Zoe'],
    );
  });

  it('sorts alphabetically within the same group', () => {
    const ordered = sort([
      { displayName: 'Zara', playerLevel: 'advanced' },
      { displayName: 'Anna', playerLevel: 'advanced' },
    ]);
    assert.deepEqual(ordered.map((u) => u.displayName), ['Anna', 'Zara']);
  });
});
