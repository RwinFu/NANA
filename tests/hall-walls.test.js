import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';

// The hall's own surfaces have to look like one room.
//
// They did not. The right wall was a BoxGeometry (three.js gives a box UVs of 0..1 per face), so a
// single texture tile was stretched over all 40 m of corridor: huge, blurred blocks. The left wall
// was an ExtrudeGeometry, whose UVs are in shape units (metres here): tiny blocks, ~1 m per tile.
// And the vault had no map at all. Walking down the corridor, the two walls either side of you were
// not the same stone at the same scale.
//
// These tests read world.js as text and check the three things that keep them together: one shared
// stone map, metric UVs on every piece, and no piece left without the map.

const src = fs.readFileSync(new URL('../src/world.js', import.meta.url), 'utf8');

test('the walls and the vault share one stone map, at one tile size', () => {
  // a single tile constant, used by every piece
  assert.match(src, /const HALL_TILE = 1\.6;/, 'the hall needs one tile size, in metres');

  // one map instance: the walls borrow the vault's, rather than each building its own
  assert.match(src, /map: track\(masonryMap\(\{ tone: 208, seed: 79, rows: 8 \}\)\)/, 'one masonry map is built');
  assert.match(src, /map: vaultMat\.map/, 'the side walls must use the same map as the vault');
  assert.match(src, /bumpMap: vaultMat\.bumpMap/, 'and the same bump');
});

test('every piece of the hall envelope has metric UVs', () => {
  // the right wall: a box whose UVs are rewritten to metres, not the default 0..1
  const rightWall = src.split('\n').find((l) => l.includes('sideWallGeo') && l.includes('BoxGeometry'));
  assert.ok(rightWall, 'the right wall is built from a box');
  assert.match(rightWall, /boxUV\(/, 'the right wall must get boxUV, not the default 0..1 box UVs');
  assert.match(rightWall, /HALL_TILE/, 'and at the hall\'s own tile size');
  // the left wall: extrude UVs are in metres, so they are divided down to tiles
  assert.match(src, /uv\.setXY\(i, uv\.getX\(i\) \/ HALL_TILE, uv\.getY\(i\) \/ HALL_TILE\)/, 'the left wall must be brought to tiles');
  // the vault: its own UVs, by arc length
  assert.match(src, /vUv\.push\(\(R_HALL \* t\) \/ HALL_TILE/, 'the vault needs UVs along its arc');
  assert.match(src, /vaultGeo\.setAttribute\('uv'/, 'the vault must carry those UVs');
});

// A direct check on the geometry three.js itself produces, so a future geometry swap is caught even
// if the code still *looks* right.
test('a box left at its default UVs really is one tile, which is what went wrong', () => {
  const plain = new THREE.BoxGeometry(0.3, 6.2, 40);
  const uv = plain.attributes.uv;
  let max = 0;
  for (let i = 0; i < uv.count; i += 1) max = Math.max(max, uv.getX(i), uv.getY(i));
  assert.equal(max, 1, 'three.js gives a box 0..1 UVs: 40 m of wall in one tile');
});

test('the hall palette is one family of colour', () => {
  // The wall and the vault are both violets: same hue family, vault a step deeper. A corridor whose
  // ceiling is a different colour family from its walls reads as "not one hall".
  const hex = (h) => {
    const n = parseInt(h.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  };
  const hue = ({ r, g, b }) => {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max === min) return 0;
    const d = max - min;
    let h;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    return ((h * 60) + 360) % 360;
  };
  const palette = fs.readFileSync(new URL('../src/palette.js', import.meta.url), 'utf8');
  // scope to the hall's own block: `castleStone` also has a `wall`, and matching that one first was
  // a false alarm in this very test
  const block = palette.slice(palette.indexOf('export const hallInterior'), palette.indexOf('export const townWalls'));
  assert.ok(block.includes('vault'), 'the hall palette block moved; update this test');
  const wall = hex(block.match(/wall: '(#[0-9a-f]{6})'/)[1]);
  const vault = hex(block.match(/vault: '(#[0-9a-f]{6})'/)[1]);
  const dh = Math.abs(hue(wall) - hue(vault));
  assert.ok(Math.min(dh, 360 - dh) < 60, `wall and vault are different colours (${hue(wall).toFixed(0)}° vs ${hue(vault).toFixed(0)}°)`);
  const ratio = (vault.r + vault.g + vault.b) / (wall.r + wall.g + wall.b);
  assert.ok(ratio > 0.7 && ratio < 1.05, `vault and wall are too far apart in value (${ratio.toFixed(2)})`);
});
