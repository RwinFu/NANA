import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The front door is the most expensive place in the game, and it was the gold piping that made it so.
//
// `piping()` built every pipe with `pts.length * 14` segments, and the glowing window's outline is handed in
// as 160 points from `getSpacedPoints(160)`. That is a 2240-segment tube for a gold line 2.5 cm across:
// 35,840 triangles, four of them on each leaf, eight counting the photo room's door. 286,720 triangles in
// total -- three quarters of every tube triangle in the scene, sitting exactly where the couple walk out.
//
// The fix is in two halves, and both are needed: a sane multiplier (6 per point) and a point count that
// matches the shape (48 instead of 160). This file holds the source to both, because the geometry cannot be
// built here without a browser.

const world = readFileSync(new URL('../src/world.js', import.meta.url), 'utf8');

test('door piping is not built at fourteen segments per point', () => {
  // the code, not the comment above it that describes the old bug
  assert.doesNotMatch(world, /new THREE\.TubeGeometry\(curve, pts\.length \*/, 'the old multiplier is gone');
  const piping = world.slice(world.indexOf('function piping('), world.indexOf('[-1, 1].forEach'));
  assert.match(piping, /const segments = pts\.length \* 6;/, 'six segments per point, which is still sub-centimetre');
  assert.match(piping, /new THREE\.TubeGeometry\(curve, segments, radius, 8, closed\)/, 'and the tube uses it');
});

test('the window outline is sampled to suit the shape, not to 160 points', () => {
  assert.match(world, /win\.getSpacedPoints\(48\)/, '48 points around a two-sided arch is a point every few mm');
  assert.doesNotMatch(world, /getSpacedPoints\(160\)/);
});

test('every piping call keeps its corners, so sharp corners stay sharp', () => {
  // the rectangle panel frame is built by densifying its four corners into straight runs; `straight` must
  // still be what it was, or its corners round off
  assert.match(world, /piping\(face, \[\[p0, q0\], \[p1, q0\], \[p1, q1\], \[p0, q1\]\], side, 0\.105, 0\.025, true, true\)/);
  // and the arch and window frame are still closed/open exactly as before
  assert.match(world, /piping\(face, arch, side, 0\.07, 0\.03, false\)/);
  assert.match(world, /piping\(face, winPts, side, 0\.1, 0\.025, true\)/);
});
