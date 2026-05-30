import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  adminAssignmentWithPositionsForGameFormat,
  gameFormatFromLegacy,
  isPositionsGame,
  parseGameFormat,
  usesPriorityPlayerWindows,
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
    assert.equal(usesPriorityPlayerWindows('positions'), false);
    assert.equal(usesPriorityPlayerWindows('recreational'), false);
  });

  it('adminAssignmentWithPositionsForGameFormat matches positions slot', () => {
    assert.equal(adminAssignmentWithPositionsForGameFormat('positions'), true);
    assert.equal(adminAssignmentWithPositionsForGameFormat('recreational'), false);
    assert.equal(adminAssignmentWithPositionsForGameFormat('priority_players'), false);
  });
});

describe('parseGameFormat', () => {
  it('accepts valid formats', () => {
    assert.equal(parseGameFormat('recreational'), 'recreational');
    assert.equal(parseGameFormat('positions'), 'positions');
    assert.equal(parseGameFormat('priority_players'), 'priority_players');
  });

  it('rejects invalid values', () => {
    assert.equal(parseGameFormat('invalid'), null);
    assert.equal(parseGameFormat(true), null);
  });
});
