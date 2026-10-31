import test from 'node:test';
import assert from 'node:assert/strict';
import { catPlayPhase } from '../src/cat-play.js';

test('bench play progresses from stalking to pouncing, chasing and rest', () => {
  assert.equal(catPlayPhase(0).name, 'stalk');
  assert.equal(catPlayPhase(2).name, 'pounce');
  assert.equal(catPlayPhase(3).name, 'butterfly');
  assert.equal(catPlayPhase(8).name, 'chase');
  assert.equal(catPlayPhase(14).name, 'rest');
});

test('play repeats and alternates the chase leader by cycle', () => {
  assert.deepEqual(catPlayPhase(20), { name: 'stalk', progress: 0, cycle: 1 });
  assert.equal(catPlayPhase(28).cycle % 2, 1);
  assert.equal(catPlayPhase(48).cycle % 2, 0);
  assert.equal(catPlayPhase(-1).name, 'stalk');
});
