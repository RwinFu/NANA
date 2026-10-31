import test from 'node:test';
import assert from 'node:assert/strict';
import { followHero, princessPose } from '../src/princess-animation.js';

const princess = () => ({ x: 100, y: 430, state: 'freed', facing: 1, phase: 0, speed: 0, trail: [] });
const hero = () => ({ x: 118, y: 430, facing: 1, onGround: true, climb: false });

test('idle stops her walk cycle and captive pose stays distinct', () => {
  const pr = princess(), p = hero();
  for (let i = 1; i <= 60; i++) followHero(pr, p, i / 60, 1 / 60);
  assert.equal(princessPose(pr, 1).walking, false);
  const phase = pr.phase;
  followHero(pr, p, 61 / 60, 1 / 60);
  assert.equal(pr.phase, phase);
  pr.state = 'captive';
  assert.equal(princessPose(pr, 1).captive, true);
});

test('follows the actual delayed jump and climbing path', () => {
  const pr = princess(), p = hero();
  for (let i = 1; i <= 80; i++) {
    p.x += 2;
    p.onGround = i < 25 || i > 55;
    p.y = p.onGround ? 430 : 430 - 80 * Math.sin((i - 25) / 30 * Math.PI);
    p.climb = i >= 40 && i <= 48;
    followHero(pr, p, i / 60, 1 / 60);
    if (i === 50) {
      assert.ok(pr.y < 430, 'she follows the jump arc rather than sliding along the floor');
      assert.equal(princessPose(pr, i / 60).airborne, true);
    }
    if (i === 65) assert.equal(princessPose(pr, i / 60).climbing, true);
  }
  assert.equal(pr.y, 430);
  assert.ok(pr.x < p.x);
});

test('checkpoint teleport resets the trail instead of flying across the level', () => {
  const pr = princess(), p = hero();
  for (let i = 1; i <= 30; i++) followHero(pr, p, i / 60, 1 / 60);
  p.x = 905; p.y = 430; p.facing = -1;
  followHero(pr, p, 31 / 60, 1 / 60);
  assert.equal(pr.x, 923);
  assert.equal(pr.y, 430);
  assert.equal(pr.trail.length, 1);
  assert.equal(pr.facing, -1);
});

test('walk cycle tracks distance and faces left on the recorded path', () => {
  const pr = princess(), p = hero();
  for (let i = 1; i <= 80; i++) {
    p.x -= 2; p.facing = -1;
    followHero(pr, p, i / 60, 1 / 60);
  }
  assert.equal(pr.facing, -1);
  assert.ok(pr.phase > 0);
  assert.equal(princessPose(pr, 80 / 60).walking, true);
});
