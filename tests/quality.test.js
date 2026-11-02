import test from 'node:test';
import assert from 'node:assert/strict';
import { QUALITY_STEPS, MAX_SCALE, MIN_SCALE, clampScale, nextQuality, createQuality } from '../src/quality.js';

// These tests hold the resolution to the one thing the player actually complained about: it went blurry.
// The ladder now stops at one device pixel per CSS pixel. A high-density display may be sharper than CSS
// pixels, never softer, and speed has to come from the scene instead.

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

test('it opens at 1 and never goes below it', () => {
  for (const dpr of [1, 2, 3]) {
    const q = createQuality(dpr);
    assert.equal(q.scale, 1, `opens sharp on a ${dpr}x display`);
  }
  assert.equal(MIN_SCALE, 1, 'the floor is one device pixel per CSS pixel');
  assert.equal(QUALITY_STEPS[0], MAX_SCALE, 'the ladder starts at the ceiling');
  assert.equal(QUALITY_STEPS[QUALITY_STEPS.length - 1], MIN_SCALE, 'and ends at the floor, not below it');
});

test('a struggling display keeps its pixels: the ladder has nothing below 1 to give', () => {
  // 30 fps for ten seconds on a 1x screen: it may not soften the picture at all
  const q = createQuality(1);
  for (let i = 0; i < 60 * 10; i++) q.update(1 / 30);
  assert.equal(q.scale, 1, 'it must not trade sharpness for frames');
  assert.equal(q.atFloor, true, 'and it reports that it is out of resolution to give');
});

test('the scale is never above the display, and never below one CSS pixel', () => {
  assert.equal(clampScale(2, 1), 1, 'a 1x screen cannot use 2 device pixels per CSS pixel');
  assert.equal(clampScale(2, 3), 2);
  assert.equal(clampScale(0.5, 3), MIN_SCALE, 'and it is never allowed below one CSS pixel');
  assert.equal(clampScale(0.1, 3), MIN_SCALE);
});

test('on a 2x display that cannot keep up, it steps down to 1 and stops there', () => {
  // start at 2, hold 30 fps: it gives back the extra pixels down to 1, then holds
  let state = { index: 0, slowFor: 0, fastFor: 0 };
  const changes = [];
  for (let i = 0; i < 60 * 4; i++) {
    const r = nextQuality({ frameMs: 1000 / 30, ...state, devicePixelRatio: 2 });
    state = { index: r.index, slowFor: r.slowFor, fastFor: r.fastFor };
    if (r.changed) changes.push(r.scale);
  }
  assert.ok(changes.length >= 1, 'it does trade the headroom away');
  assert.equal(Math.min(...changes), 1, 'but never below one device pixel per CSS pixel');
  assert.equal(state.index, QUALITY_STEPS.length - 1);
});

test('on a 1x display it never even tries to climb', () => {
  const q = createQuality(1);
  for (let i = 0; i < 60 * 10; i++) q.update(1 / 60);
  assert.equal(q.scale, 1, 'a 1x screen has no headroom, so a perfect frame rate changes nothing');
});

test('a 3x display at a steady 60 climbs into its headroom, up to 2', () => {
  const hd = createQuality(3);
  for (let i = 0; i < 60 * 10; i++) hd.update(1 / 60);
  assert.ok(hd.scale > 1, `it uses the pixels the display offers: ${hd.scale}`);
  assert.ok(hd.scale <= MAX_SCALE, 'but not past the ceiling');
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
