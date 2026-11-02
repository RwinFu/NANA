import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import outline from '../src/sign-outline.js';
import { createSignGeometry, shapesFromOutline, SIGN_CAP_HEIGHT, SIGN_CENTRE_Y } from '../src/sign.js';

// The sign over the front door says "OUR HOUSE".
//
// It used to be a Persian line traced from a canvas, and at the rectangle count that was affordable the
// letterforms came out wrong -- an O rendered as a diamond. The sign is now cut from Lalezar's own outlines
// (see tools/make-sign.mjs), so the tests that matter are: the outlines are the right line in the right place,
// the counters are holes rather than filled blobs, and the geometry sits in the band above the arch where it
// can be seen from the garden.

test('the name is OUR HOUSE, in capitals', () => {
  assert.equal(outline.text, 'OUR HOUSE');
  assert.equal(outline.text, outline.text.toUpperCase());
  // Eight letters and a space; every cap has ink, and O, R and O have a counter each.
  assert.equal(outline.subpaths.length, 8 + 3, '8 letters plus the 3 counters of O, R and O');
});

test('the outline file records where it came from', () => {
  assert.match(outline.generated, /tools\/make-sign\.mjs/);
  // A rounded display face, not the condensed grotesque the sign started with: the owner's complaint about
  // that one was that it was stiff.
  assert.match(outline.font, /baloo-2/);
  assert.equal(outline.unitsPerEm, 1000);
  assert.ok(outline.capHeight > 400 && outline.capHeight < 800, `cap height ${outline.capHeight}`);
});

test('the counters of O, R and O are holes, not filled shapes', () => {
  const shapes = shapesFromOutline(outline);
  assert.equal(shapes.length, 8, 'one shape per letter');
  assert.equal(shapes.filter((s) => s.holes.length === 1).length, 3, 'O, R and O have a counter each');
});

test('the geometry is one merged mesh, capped at a readable triangle count', () => {
  const geometry = createSignGeometry(outline);
  assert.ok(geometry instanceof THREE.BufferGeometry);
  assert.ok(geometry.getIndex() === null || geometry.getIndex().count > 0);
  const triangles = (geometry.getIndex()?.count ?? geometry.getAttribute('position').count) / 3;
  // The traced version of the old sign was 3,050 triangles and still read as broken; real outlines buy exact
  // letterforms for a similar cost. Guard the order of magnitude, not the exact number.
  assert.ok(triangles > 1000 && triangles < 20000, `${triangles} triangles`);
});

test('the line is scaled to a real cap height and centred on the doorway', () => {
  const geometry = createSignGeometry(outline);
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const height = box.max.y - box.min.y;
  // Round letterforms overshoot the cap line and the line bounces and bows, so the ink is taller than one
  // capital: it has to stay inside the band without the letters growing out of it.
  assert.ok(height > SIGN_CAP_HEIGHT * 0.95 && height < SIGN_CAP_HEIGHT * 1.5, `ink height ${height}`);
  assert.ok(Math.abs(box.max.y + box.min.y) < 0.02, 'vertically centred on its own ink');
  assert.ok(Math.abs(box.max.x + box.min.x) < 0.02, 'horizontally centred on the door');
  // Wider than the 3 m doorway but well inside the 20 m front wall.
  const width = box.max.x - box.min.x;
  assert.ok(width > 3 && width < 11, `width ${width}`);
});

test('the letters stand proud of the wall, growing outwards', () => {
  const geometry = createSignGeometry(outline);
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  assert.ok(box.min.z >= -0.02, 'the back of the sheet is on the wall');
  assert.ok(box.max.z > 0.05 && box.max.z < 0.2, `the sheet is ${box.max.z} thick`);
});

test('the band sits above the arch crown and below the top of the front wall', () => {
  // The arch crown is doorHeight 4.9 + doorHalfWidth 1.5 = 6.4; the facade stops at 8.0.
  const half = SIGN_CAP_HEIGHT / 2;
  assert.ok(SIGN_CENTRE_Y - half > 6.5, 'below the band the moulding over the arch runs at 6.6');
  assert.ok(SIGN_CENTRE_Y + half < 8.0, 'above it there is no wall to mount to');
});
