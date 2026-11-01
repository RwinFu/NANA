import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// The photo room sits behind the hall's west wall. Its own walls must stop at that wall's OUTER face.
//
// They did not: they ran on to the wall's inner face (x = -hallHalfWidth), so 0.30 m of the room's
// near-black plum velvet lay inside the hall's own wall and a further 0.44 m formed a band in exactly
// the plane of the stone. Seen from the corridor it was a black stripe down the wall — and where the
// velvet and the masonry were coplanar the two z-fought, which is what the black lines in the report
// were.
//
// This test reads the geometry, not the pixels: the room's surfaces are parsed out of the `block(...)`
// calls that build them, their x extents resolved to metres, and every one that is not the floor must
// leave the hall's wall thickness alone. Only the horizontal floor may cross it, and only to carry the
// doorway.

const src = fs.readFileSync(new URL('../src/world.js', import.meta.url), 'utf8');

// \b keeps `x0` from matching inside `ox0`
const num = (name) => Number(src.match(new RegExp(`\\b${name}: (-?[\\d.]+),`))[1]);
const hallHalfWidth = Number(src.match(/hallHalfWidth: ([\d.]+),/)[1]);
const wallThickness = Number(src.match(/const wallThickness = ([\d.]+);/)[1]);
const wallOuter = -(hallHalfWidth + wallThickness); // -4.15: the outer face of the hall's 0.30 m wall

const room = {
  x0: num('x0'), x1: num('x1'),
  ox0: num('ox0'), ox1: num('ox1'),
};
const symbols = {
  x0: room.x0,
  x1: room.x1,
  ox0: room.ox0,
  ox1: room.ox1,
  xWallOuter: wallOuter,
  hallHalfWidth,
  wallThickness,
};

// Resolve an x extent as written: `x0`, `x1 - 0.1`, `-LAYOUT.hallHalfWidth`, a plain number.
function resolve(expr) {
  const e = expr.replace(/LAYOUT\./g, '').trim();
  const m = e.match(/^(-?)([A-Za-z_$][\w$]*)(?:\s*([+-])\s*([\d.]+))?$/);
  if (m && m[2] in symbols) {
    const base = m[1] ? -symbols[m[2]] : symbols[m[2]];
    if (!m[3]) return base;
    return m[3] === '+' ? base + Number(m[4]) : base - Number(m[4]);
  }
  const n = Number(e);
  return Number.isFinite(n) ? n : NaN;
}

// Every block(...) call in the room section, with its x extents resolved.
const roomSection = src.slice(src.indexOf('const roomGroup = new THREE.Group();'));
const calls = [...roomSection.matchAll(/block\(([^;]*?)\);/g)]
  .map((m) => {
    const args = m[1].split(',').map((s) => s.trim());
    return { args, mat: args[6], x0: resolve(args[0]), x1: resolve(args[1]) };
  })
  // skip the function's own signature, whose arguments are names not numbers
  .filter((c) => Number.isFinite(c.x0) && Number.isFinite(c.x1) && c.args[2] !== 'y0');

test('the photo room is built from blocks whose extents can be resolved', () => {
  assert.ok(calls.length >= 12, `expected the room's walls and trims as block() calls, found ${calls.length}`);
  assert.ok(Number.isFinite(wallThickness) && wallThickness > 0.2, 'the hall wall has a real thickness');
  assert.equal(+wallOuter.toFixed(2), -4.15, 'the outer face of the hall\'s 0.30 m wall is x = -4.15');
});

test('the room stops at the outer face of the hall wall, not its inner face', () => {
  assert.match(src, /const xWallOuter = -LAYOUT\.hallHalfWidth - wallThickness;/,
    'the room needs the hall wall\'s outer face as its own edge');
  const atWall = calls.filter((c) => Math.abs(c.x1 - wallOuter) < 1e-9);
  assert.ok(atWall.length >= 3, `near wall, far wall and ceiling should end at the outer face (found ${atWall.length})`);
  // and none of them but the floor uses the inner face any more: a wall brought up to x = -3.85 is
  // a wall in the plane of the hall's stone, and that is the black stripe.
  const onInnerFace = calls
    .filter((c) => !(c.args[2] === '-0.1' && c.args[3] === '0.01'))
    .filter((c) => Math.abs(c.x1 - -hallHalfWidth) < 1e-9);
  assert.deepEqual(onInnerFace.map((c) => c.args.join(',')), [],
    'no wall of the room may be built in the plane of the hall\'s stone');
});

test('no vertical surface of the photo room reaches past the hall wall\'s outer face', () => {
  // A block spans x0..x1. Unless it is the floor, x1 is where it meets the hall, and that has to be the
  // outer face or short of it: anything further east is stone's or velvet's width of the hall's wall.
  const offenders = calls
    .filter((c) => !(c.args[2] === '-0.1' && c.args[3] === '0.01')) // the floor is horizontal
    .filter((c) => c.x1 > wallOuter + 1e-9)
    .map((c) => `${c.mat}: block(${c.args.join(', ')}) -> x1 = ${c.x1}`);
  assert.deepEqual(offenders, [], 'a room block still runs into the hall\'s wall');
});

test('only the floor crosses under the hall wall, and it stops at the inner face', () => {
  const floor = calls.filter((c) => c.args[2] === '-0.1' && c.args[3] === '0.01');
  assert.equal(floor.length, 1, 'the room floor is one slab');
  // the doorway passage needs the floor to reach the hall's inner face; further east it is in the hall
  assert.ok(Math.abs(floor[0].x1 - -hallHalfWidth) < 1e-9,
    `the floor runs to the hall wall's inner face (${-hallHalfWidth}) and no further, got ${floor[0].x1}`);
});
