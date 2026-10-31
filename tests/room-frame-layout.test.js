import test from 'node:test';
import assert from 'node:assert/strict';
import { roomFrameSlot, hallFrameSlot } from '../src/room-frame-layout.js';

test('similar portraits are on opposite walls, swapping only the bouquet frame', () => {
  const slots = Array.from({ length: 9 }, (_, i) => roomFrameSlot(i));
  assert.deepEqual(slots, [0, 1, 2, 3, 5, 4, 6, 7, 8]);
  assert.equal(new Set(slots).size, 9);
  assert.ok(roomFrameSlot(3) < 5); // floral-shirt
  assert.ok(roomFrameSlot(4) >= 5); // red-necklace
  assert.equal(roomFrameSlot(5), 4); // bouquet
});

test('hall selfies exchange positions without changing other slots', () => {
  const slots = Array.from({ length: 18 }, (_, i) => hallFrameSlot(i));
  assert.deepEqual(slots, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 15, 14, 16, 17]);
  assert.equal(new Set(slots).size, 18);
});
