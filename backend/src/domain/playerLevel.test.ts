import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  compareUsersForPlayerLevelsList,
  isValidPlayerLevel,
  playerLevelSortGroup,
} from './playerLevel';

describe('playerLevelSortGroup', () => {
  it('orders unassigned before assigned tiers', () => {
    assert.ok(playerLevelSortGroup(null) < playerLevelSortGroup('advanced'));
    assert.ok(playerLevelSortGroup('advanced') < playerLevelSortGroup('intermediate'));
    assert.ok(playerLevelSortGroup('intermediate') < playerLevelSortGroup('beginner'));
  });
});

describe('compareUsersForPlayerLevelsList', () => {
  it('sorts by group then display name', () => {
    const users = [
      { displayName: 'Zara', playerLevel: 'beginner' as const },
      { displayName: 'Amy', playerLevel: null },
      { displayName: 'Bob', playerLevel: 'advanced' as const },
      { displayName: 'Ann', playerLevel: null },
    ];
    users.sort(compareUsersForPlayerLevelsList);
    assert.deepEqual(
      users.map((u) => u.displayName),
      ['Amy', 'Ann', 'Bob', 'Zara']
    );
  });
});

describe('isValidPlayerLevel', () => {
  it('accepts known levels', () => {
    assert.equal(isValidPlayerLevel('beginner'), true);
    assert.equal(isValidPlayerLevel('intermediate'), true);
    assert.equal(isValidPlayerLevel('advanced'), true);
  });

  it('rejects null and unknown values', () => {
    assert.equal(isValidPlayerLevel(null), false);
    assert.equal(isValidPlayerLevel('expert'), false);
  });
});
