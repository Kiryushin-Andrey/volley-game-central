import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canManagePlayerLevels } from './userRoles';

describe('canManagePlayerLevels', () => {
  it('allows global admins', () => {
    assert.equal(canManagePlayerLevels({ isAdmin: true, isTc: false }), true);
  });

  it('allows TC users', () => {
    assert.equal(canManagePlayerLevels({ isAdmin: false, isTc: true }), true);
  });

  it('denies regular users', () => {
    assert.equal(canManagePlayerLevels({ isAdmin: false, isTc: false }), false);
  });
});
