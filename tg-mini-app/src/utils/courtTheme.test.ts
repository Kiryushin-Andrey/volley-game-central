import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  benchOverflow,
  capacityRatio,
  formatCardClass,
  formatPillLabel,
  listCapacity,
  usesSpotDots,
} from './courtTheme';

test('format pills and card classes follow game format', () => {
  assert.equal(formatPillLabel('recreational'), 'Recreational');
  assert.equal(formatPillLabel('positions'), 'Positions');
  assert.equal(formatPillLabel('priority_players'), 'Priority');
  assert.match(formatCardClass('positions'), /with-positions/);
  assert.match(formatCardClass('recreational'), /without-positions/);
  assert.equal(formatCardClass('priority_players').includes('without-positions'), false);
});

test('capacity ratio clamps and spot dots stay within a side of six', () => {
  assert.equal(capacityRatio(3, 12), 0.25);
  assert.equal(capacityRatio(14, 12), 1);
  assert.equal(capacityRatio(1, 0), 0);
  assert.equal(usesSpotDots(6, 'roster'), true);
  assert.equal(usesSpotDots(7, 'roster'), false);
  assert.equal(usesSpotDots(4, 'payments'), false);
  assert.equal(benchOverflow(8, 6), 2);
  assert.equal(benchOverflow(4, 6), 0);
});

test('list capacity picks paid, registered, or total counts', () => {
  assert.deepEqual(
    listCapacity({ paidCount: 2, totalRegisteredCount: 5, maxPlayers: 12, readonly: false }),
    { count: 2, max: 5, kind: 'payments' },
  );
  assert.deepEqual(
    listCapacity({ registeredCount: 4, totalRegisteredCount: 4, maxPlayers: 12, readonly: false }),
    { count: 4, max: 12, kind: 'roster' },
  );
  assert.equal(
    listCapacity({ totalRegisteredCount: 0, maxPlayers: 12, readonly: true }),
    null,
  );
});
