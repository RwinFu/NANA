import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceHallProgress, nextGuideTarget, roomGuideWaypoint } from '../src/house-reactivity.js';

const door = { z0: -21.3, z1: -18.7 };
const frames = [
  { index: 0, center: { x: -3.77, z: -12.1 } },
  { index: 1, center: { x: 3.77, z: -15.7 } },
  { index: 2, center: { x: -9, z: -18 } }, // photo room, across a wall
];

test('hall lights only advance after entering and stay lit when walking back', () => {
  assert.equal(advanceHallProgress(-1, { x: 0, z: 5 }, 3.85, 40), -1);
  assert.equal(advanceHallProgress(-1, { x: 0, z: -10 }, 3.85, 40), 10);
  assert.equal(advanceHallProgress(10, { x: 0, z: -2 }, 3.85, 40), 10);
  assert.equal(advanceHallProgress(10, { x: -8, z: -25 }, 3.85, 40), 10);
});

test('guides pick a nearby unvisited hall frame ahead, not a room frame', () => {
  const visited = new Set();
  assert.equal(nextGuideTarget({ x: 0, z: -8 }, frames, visited, 3.85, 40, door).key, 'frame-0');
  visited.add('frame-0');
  assert.equal(nextGuideTarget({ x: 0, z: -10 }, frames, visited, 3.85, 40, door).key, 'frame-1');
  assert.equal(nextGuideTarget({ x: -8, z: -15 }, frames, visited, 3.85, 40, door), null);
});

test('guides can indicate the room doorway without crossing its wall', () => {
  const goal = nextGuideTarget({ x: 0, z: -17 }, frames, new Set(), 3.85, 40, door);
  assert.equal(goal.key, 'room-door');
  assert.equal(goal.x, -1.45);
});


test('room guides stay a short distance ahead and stop at the doorway', () => {
  assert.equal(roomGuideWaypoint(2, -20), -1.5);
  assert.equal(roomGuideWaypoint(-4, -20), -7.5);
  assert.equal(roomGuideWaypoint(-18, -20), -20);
  assert.equal(roomGuideWaypoint(-24, -20), -20);
});
