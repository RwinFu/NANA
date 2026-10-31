import test from 'node:test';
import assert from 'node:assert/strict';
import { roomFrameSlot } from '../src/room-frame-layout.js';

test('similar portraits are on opposite walls, swapping only the bouquet frame', () => {
  const slots = Array.from({ length: 9 }, (_, i) => roomFrameSlot(i));
  assert.deepEqual(slots, [0, 1, 2, 3, 5, 4, 6, 7, 8]);
  assert.equal(new Set(slots).size, 9);
  assert.ok(roomFrameSlot(3) < 5); // floral-shirt
  assert.ok(roomFrameSlot(4) >= 5); // red-necklace
  assert.equal(roomFrameSlot(5), 4); // bouquet
});
