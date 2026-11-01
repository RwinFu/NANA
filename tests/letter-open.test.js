import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BEATS, BEAT_AT, OPEN_TIME, openingAt, openingAtTime } from '../src/letter-open.js';

// Opening the letter used to be two seconds of two things moving: the flap turned, a flat sheet rose,
// a dialog appeared. No seal broke, nothing was lit, and the camera never moved.
//
// The timing now lives in src/letter-open.js as one function, so the shape of the scene can be held
// without a clock or a renderer: the wax cracks before it splits, the flap opens before the paper
// rises, the paper is unfolded before the reader takes over, and the whole thing is short enough that
// nobody stands waiting and long enough to read as a moment.

test('the beats add up to the opening', () => {
  const sum = BEATS.wax + BEATS.flap + BEATS.paper + BEATS.settle;
  assert.ok(Math.abs(sum - OPEN_TIME) < 1e-9, 'OPEN_TIME must be the sum of the beats');
  assert.ok(OPEN_TIME > 2, `the opening is too quick to read as a scene: ${OPEN_TIME.toFixed(2)}s`);
  assert.ok(OPEN_TIME < 3.5, `the opening holds the player up too long: ${OPEN_TIME.toFixed(2)}s`);
});

test('the wax cracks first, then splits, and only then does the flap move', () => {
  // before the flap starts, the seal is already cracked...
  const cracked = openingAtTime(0.2);
  assert.ok(cracked.wax > 0.2 && cracked.wax < 0.6, 'the seal should be cracking early');
  assert.equal(cracked.flap, 0, 'the flap must not move while the wax is still whole');
  // ...and it is two halves before the flap is far open
  const splitting = openingAtTime(BEATS.wax * 0.85);
  assert.ok(splitting.split > 0.3, 'the seal should be broken by the time the flap lifts');
  const late = openingAtTime(BEATS.wax + BEATS.flap);
  assert.equal(late.split, 1, 'by the end of the flap beat the seal is fully apart');
});

test('the paper waits for the flap, and is unfolded before the reader takes over', () => {
  const beforePaper = openingAtTime(BEATS.wax + 0.1);
  assert.equal(beforePaper.paper, 0, 'the paper must not show before the flap is up');
  const paperStart = openingAtTime(BEATS.wax + BEATS.flap);
  assert.ok(paperStart.paper > 0 && paperStart.paper < 0.4, 'the paper starts to rise as the flap finishes');
  // folded while it is still in the envelope, flat by the time it is out
  assert.ok(openingAtTime(BEATS.wax + BEATS.flap + 0.1).unfold < 0.2, 'it comes out folded');
  const done = openingAtTime(OPEN_TIME);
  assert.equal(done.unfold, 1, 'the letter is flat when the reader opens');
  assert.equal(done.rise, 1, 'and fully out of the envelope');
});

test('every value stays in its range, and nothing goes backwards', () => {
  const keys = ['wax', 'split', 'flap', 'light', 'rise', 'unfold', 'paper'];
  let prev = openingAt(0);
  for (let i = 1; i <= 100; i += 1) {
    const now = openingAt(i / 100);
    for (const key of keys) {
      assert.ok(now[key] >= 0 && now[key] <= 1, `${key} left 0..1 at k=${(i / 100).toFixed(2)}: ${now[key]}`);
      assert.ok(now[key] >= prev[key] - 1e-9, `${key} went backwards at k=${(i / 100).toFixed(2)}`);
    }
    prev = now;
  }
  // clamped at both ends
  assert.equal(openingAt(-3).t, 0);
  assert.equal(openingAt(9).t, OPEN_TIME);
});

test('the light is up before the paper comes out, so the paper is lit', () => {
  const paperStart = BEATS.wax + BEATS.flap;
  assert.ok(openingAtTime(paperStart).light > 0.85, 'the inside of the envelope has to be lit first');
});

test('the beats are in order, and the envelope plays a sound at each of them', () => {
  const order = ['crack', 'break', 'flap', 'paper', 'open'];
  const times = order.map((b) => BEAT_AT[b]);
  for (let i = 1; i < times.length; i += 1) {
    assert.ok(times[i] > times[i - 1], `${order[i]} has to come after ${order[i - 1]}`);
  }
  assert.ok(Math.abs(BEAT_AT.open - OPEN_TIME) < 1e-9, 'the reader opens at the end of the opening');

  const env = fs.readFileSync(new URL('../src/envelope.js', import.meta.url), 'utf8');
  for (const sound of ['waxCrack', 'waxSnap', 'flap', 'paper']) {
    assert.match(env, new RegExp(`audio\\?\\.${sound}\\?\\.\\(\\)`), `the envelope never plays ${sound}`);
  }
  // and the sounds exist as effects
  const audio = fs.readFileSync(new URL('../src/audio.js', import.meta.url), 'utf8');
  for (const sound of ['waxCrack', 'waxSnap', 'flap', 'paper']) {
    assert.match(audio, new RegExp(`\\n    ${sound}\\(\\)`), `audio.js has no ${sound}()`);
  }
});
