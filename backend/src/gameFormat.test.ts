import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  gameFormatFromLegacy,
  isPositionsGame,
  usesPriorityPlayerWindows,
  isGameFormat,
  gameFormatToAdminWithPositions,
} from './gameFormat';

test('gameFormatFromLegacy maps boolean pairs', () => {
  assert.equal(gameFormatFromLegacy(false, false), 'recreational');
  assert.equal(gameFormatFromLegacy(true, false), 'positions');
  assert.equal(gameFormatFromLegacy(false, true), 'priority_players');
  assert.equal(gameFormatFromLegacy(true, true), 'recreational');
});

test('isPositionsGame', () => {
  assert.equal(isPositionsGame('positions'), true);
  assert.equal(isPositionsGame('recreational'), false);
  assert.equal(isPositionsGame('priority_players'), false);
});

test('usesPriorityPlayerWindows', () => {
  assert.equal(usesPriorityPlayerWindows('priority_players'), true);
  assert.equal(usesPriorityPlayerWindows('positions'), false);
  assert.equal(usesPriorityPlayerWindows('recreational'), false);
});

test('gameFormatToAdminWithPositions', () => {
  assert.equal(gameFormatToAdminWithPositions('positions'), true);
  assert.equal(gameFormatToAdminWithPositions('recreational'), false);
  assert.equal(gameFormatToAdminWithPositions('priority_players'), false);
});

test('isGameFormat validates known values', () => {
  assert.equal(isGameFormat('recreational'), true);
  assert.equal(isGameFormat('positions'), true);
  assert.equal(isGameFormat('priority_players'), true);
  assert.equal(isGameFormat('invalid'), false);
});
