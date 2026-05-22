import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  compareUsersForPlayerLevelsList,
  isValidPlayerLevel,
  playerLevelListGroupKey,
} from './playerLevel';

describe('isValidPlayerLevel', () => {
  it('accepts beginner, intermediate, advanced', () => {
    assert.equal(isValidPlayerLevel('beginner'), true);
    assert.equal(isValidPlayerLevel('intermediate'), true);
    assert.equal(isValidPlayerLevel('advanced'), true);
  });
  it('rejects null, empty, and unknown values', () => {
    assert.equal(isValidPlayerLevel(null), false);
    assert.equal(isValidPlayerLevel(''), false);
    assert.equal(isValidPlayerLevel('expert'), false);
  });
});

describe('playerLevelListGroupKey', () => {
  it('maps null to unassigned', () => {
    assert.equal(playerLevelListGroupKey(null), 'unassigned');
  });
});

describe('compareUsersForPlayerLevelsList', () => {
  it('orders unassigned before assigned levels', () => {
    const users = [
      { displayName: 'Zara', playerLevel: 'beginner' as const },
      { displayName: 'Amy', playerLevel: null },
      { displayName: 'Bob', playerLevel: 'advanced' as const },
    ];
    users.sort(compareUsersForPlayerLevelsList);
    assert.deepEqual(
      users.map((u) => u.displayName),
      ['Amy', 'Bob', 'Zara'],
    );
  });

  it('orders advanced before intermediate before beginner within assigned', () => {
    const users = [
      { displayName: 'C', playerLevel: 'beginner' as const },
      { displayName: 'A', playerLevel: 'intermediate' as const },
      { displayName: 'B', playerLevel: 'advanced' as const },
    ];
    users.sort(compareUsersForPlayerLevelsList);
    assert.deepEqual(
      users.map((u) => u.displayName),
      ['B', 'A', 'C'],
    );
  });

  it('sorts alphabetically within the same group', () => {
    const users = [
      { displayName: 'Zoe', playerLevel: null },
      { displayName: 'Ann', playerLevel: null },
    ];
    users.sort(compareUsersForPlayerLevelsList);
    assert.deepEqual(users.map((u) => u.displayName), ['Ann', 'Zoe']);
  });
});
