import test from 'node:test';
import assert from 'node:assert/strict';
import { skyLight, faceLuma } from '../src/night-light.js';
import {
  castleStone, hallInterior, townWalls, townRoofs, townStone, townTimber, townDoor, luminance,
} from '../src/palette.js';

// The walls were the problem: dark stone, a near-black house palette and a single moon from one
// side left every wall it did not face as a black slab. These tests hold the two things that fixed
// it — the light, and the colours — at numbers, so a later "make it moodier" edit fails here first.

const FACES = {
  north: [0, 0, 1],
  south: [0, 0, -1],
  east: [1, 0, 0],
  west: [-1, 0, 0],
};

test('no wall the moon misses is left unlit', () => {
  const lit = faceLuma(FACES.north);
  for (const [name, n] of Object.entries(FACES)) {
    const luma = faceLuma(n);
    assert.ok(luma > 0.9, `${name} face receives ${luma.toFixed(2)} — a wall must never be near-black`);
    assert.ok(luma > lit * 0.55, `${name} face is much darker than the moonlit one (${luma.toFixed(2)} vs ${lit.toFixed(2)})`);
  }
});

test('the fill and bounce are real but stay under the moon', () => {
  assert.ok(skyLight.fillIntensity > 0.2, 'a fill is needed, or the far side of every street goes flat');
  assert.ok(skyLight.fillIntensity < skyLight.keyIntensity, 'the fill must not become the key light');
  assert.ok(skyLight.bounceIntensity > 0 && skyLight.bounceIntensity < 0.35, 'the bounce is a hint, not a light');
  assert.ok(skyLight.intensity >= 1.2, 'the ambient dome carries the night: it was 1.05 and read as dusk');
});

test('the castle stone is cream, not shadow', () => {
  for (const [name, hex] of Object.entries(castleStone)) {
    assert.ok(luminance(hex) > 0.45, `castleStone.${name} (${hex}) is too dark for stone at night`);
  }
});

test('the hall the couple walk through is warm, not a black corridor', () => {
  assert.ok(luminance(hallInterior.wall) > 0.12, 'the hall wall was #3a2a3f — a near-black band');
  assert.ok(luminance(hallInterior.vault) > 0.035, 'the vault can be deep, but not a hole');
  assert.ok(luminance(hallInterior.floorLight) > luminance(hallInterior.floorDark), 'the parquet has two courses');
  assert.ok(luminance(hallInterior.floorLight) > 0.15, 'the floor is what the chandeliers light');
});

test('the town is a pastel street, not near-black boxes', () => {
  assert.equal(townWalls.length, 4, 'one limewash per house');
  for (const hex of townWalls) {
    assert.ok(luminance(hex) > 0.5, `house limewash ${hex} is too dark`);
  }
  // roofs stay saturated, and readable against the walls
  for (const hex of townRoofs) {
    assert.ok(luminance(hex) > 0.18 && luminance(hex) < 0.75, `roof tile ${hex} is out of range`);
  }
  for (const hex of townStone) {
    assert.ok(luminance(hex) > 0.2, `town stone ${hex} is too dark`);
  }
  // the timbering is a warm brown: dark enough to read as beams, light enough not to be black
  assert.ok(luminance(townTimber) > 0.05 && luminance(townTimber) < 0.3, 'half-timbering must read as brown, not black');
  assert.ok(luminance(townDoor) > 0.05, 'the doors are lit by their own lanterns');
});
