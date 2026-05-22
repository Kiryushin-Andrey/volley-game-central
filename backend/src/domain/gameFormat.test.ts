import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  gameFormatFromLegacy,
  isPositionsGame,
  usesPriorityPlayerWindows,
  withPositionsForAdminAssignment,
  isValidGameFormat,
} from './gameFormat';

describe('gameFormatFromLegacy', () => {
  it('maps false/false to recreational', () => {
    assert.equal(gameFormatFromLegacy(false, false), 'recreational');
  });
  it('maps true/false to positions', () => {
    assert.equal(gameFormatFromLegacy(true, false), 'positions');
  });
  it('maps false/true to priority_players', () => {
    assert.equal(gameFormatFromLegacy(false, true), 'priority_players');
  });
  it('maps true/true to recreational', () => {
    assert.equal(gameFormatFromLegacy(true, true), 'recreational');
  });
});

describe('format helpers', () => {
  it('isPositionsGame is true only for positions', () => {
    assert.equal(isPositionsGame('positions'), true);
    assert.equal(isPositionsGame('recreational'), false);
    assert.equal(isPositionsGame('priority_players'), false);
  });
  it('usesPriorityPlayerWindows is true only for priority_players', () => {
    assert.equal(usesPriorityPlayerWindows('priority_players'), true);
    assert.equal(usesPriorityPlayerWindows('recreational'), false);
    assert.equal(usesPriorityPlayerWindows('positions'), false);
  });
  it('withPositionsForAdminAssignment matches positions games', () => {
    assert.equal(withPositionsForAdminAssignment('positions'), true);
    assert.equal(withPositionsForAdminAssignment('recreational'), false);
    assert.equal(withPositionsForAdminAssignment('priority_players'), false);
  });
});

describe('isValidGameFormat', () => {
  it('accepts known formats', () => {
    assert.equal(isValidGameFormat('recreational'), true);
    assert.equal(isValidGameFormat('positions'), true);
    assert.equal(isValidGameFormat('priority_players'), true);
  });
  it('rejects unknown values', () => {
    assert.equal(isValidGameFormat('regular'), false);
    assert.equal(isValidGameFormat(null), false);
  });
});
