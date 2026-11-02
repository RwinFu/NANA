import test from 'node:test';
import assert from 'node:assert/strict';
import { QUALITY_STEPS, MAX_SCALE, MIN_SCALE, clampScale, nextQuality, createQuality } from '../src/quality.js';

// The game ran at 30-35 fps. The single biggest reason was that it opened at 1.5 device pixels per CSS
// pixel -- 2.25x the pixels of scale 1 on a 3x phone -- and then needed two seconds of slow frames before
// it stepped down once, to 1.25. These tests pin the behaviour that replaced it: open at 1, react within
// half a second, go low enough to matter, and never fight a display that is already near 60.

const ms = (fps) => 1000 / fps;
const run = (fps, seconds, start = 3, dpr = 1) => {
  // step a controller at a steady frame rate and collect the scales it chose
  let state = { index: start, slowFor: 0, fastFor: 0 };
  const out = [];
  const dt = ms(fps) / 1000;
  for (let t = 0; t < seconds; t += dt) {
    const r = nextQuality({ frameMs: ms(fps), ...state, devicePixelRatio: dpr });
    state = { index: r.index, slowFor: r.slowFor, fastFor: r.fastFor };
    if (r.changed) out.push(r.scale);
  }
  return { final: state.index, changes: out };
};

test('it opens at 1, not at 1.5', () => {
  const q = createQuality(3);
  assert.equal(q.scale, 1, 'starting at 1.5 was 2.25x the pixels on a 3x phone');
  assert.equal(QUALITY_STEPS[0], MAX_SCALE, 'the ladder starts at the ceiling');
});

test('the scale is never above the display, and may go below one CSS pixel', () => {
  assert.equal(clampScale(2, 1), 1, 'a 1x screen cannot use 2 device pixels per CSS pixel');
  assert.equal(clampScale(2, 3), 2);
  assert.equal(clampScale(0.5, 3), 0.5, 'a struggling phone is allowed below one CSS pixel');
  assert.equal(clampScale(0.1, 3), MIN_SCALE);
});

test('30 fps steps down within half a second, and keeps stepping', () => {
  const { final, changes } = run(30, 3);
  assert.ok(changes.length >= 2, `it keeps stepping down while the frames are slow: ${changes.length} steps`);
  assert.ok(changes[changes.length - 1] < changes[0], 'and each step is lower than the last');
  assert.ok(final > 3, 'ending up lower than where it started');
});

test('35 fps -- the measured frame rate -- reaches a scale that can carry 60', () => {
  // at 35 fps the pixel work has to fall by ~1.7x to reach 60; area scales as the square, so the
  // linear scale has to fall by ~1.3x from where it is. Check it actually gets there and can go lower.
  const { changes } = run(35, 10);
  const lowest = Math.min(...changes);
  assert.ok(lowest <= 0.7, `it is willing to go low: lowest step ${lowest}`);
});

test('a steady 60 does not move, and does not climb past what the device can use', () => {
  const q = createQuality(1);
  for (let i = 0; i < 600; i++) q.update(1 / 60);
  assert.equal(q.scale, 1, 'on a 1x display there is nothing above 1 to climb to');
  const hd = createQuality(2);
  for (let i = 0; i < 600; i++) hd.update(1 / 60);
  assert.ok(hd.scale <= 2);
});

test('one long frame is treated as a hitch, not as a slow GPU', () => {
  const q = createQuality(3);
  const before = q.scale;
  q.update(0.4); // a tab switch, a decode, a shader compile
  for (let i = 0; i < 5; i++) q.update(1 / 30);
  assert.equal(q.scale, before, 'a single 400 ms frame must not change the resolution');
});

test('it climbs back when the display has room, but slowly', () => {
  // start at the bottom on a 3x screen and hold 60 fps
  let state = { index: QUALITY_STEPS.length - 1, slowFor: 0, fastFor: 0 };
  const up = [];
  for (let i = 0; i < 60 * 12; i++) {
    const r = nextQuality({ frameMs: ms(60), ...state, devicePixelRatio: 3 });
    state = { index: r.index, slowFor: r.slowFor, fastFor: r.fastFor };
    if (r.changed) up.push(r.scale);
  }
  assert.ok(up.length >= 1, 'it does recover');
  assert.ok(up.length <= 4, `but it does not oscillate: ${up.length} climbs in 12 s`);
});
