import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { stoneMaterial, boxUV, gableRoof, TILE } from '../src/castle-stone.js';

// A 2D canvas context is enough for the maps: they only need to exist, not to be read back.
function stubCanvas() {
  const gradient = { addColorStop() {} };
  const ctx = new Proxy({}, {
    get: (target, key) => {
      if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => gradient;
      if (key === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
      if (key === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
      if (key === 'measureText') return () => ({ width: 10 });
      if (key in target) return target[key];
      return () => {};
    },
    set: (target, key, value) => { target[key] = value; return true; },
  });
  const canvas = { width: 1, height: 1, getContext: () => ctx, toDataURL: () => 'data:,' };
  return canvas;
}

test('the castle stone carries a colour map, a bump and a normal map', () => {
  const previous = globalThis.document;
  globalThis.document = { createElement: () => stubCanvas() };
  try {
    const mat = stoneMaterial({ color: '#f0e4d6' });
    assert.ok(mat.map, 'the wall needs a colour map: a flat colour is the look we are fixing');
    assert.ok(mat.normalMap, 'the wall needs a normal map so the blocks read in glancing light');
    assert.ok(mat.bumpMap, 'the joints should sink');
    assert.equal(mat.map.colorSpace, THREE.SRGBColorSpace);
    // one tile per TILE metres means the map repeats instead of stretching
    assert.equal(mat.map.wrapS, THREE.RepeatWrapping);
    assert.equal(mat.toneMapped, true);
  } finally {
    globalThis.document = previous;
  }
});

test('stone boxes are unwrapped in metres, so a big wall and a small pier match', () => {
  const big = boxUV(new THREE.BoxGeometry(12, 8, 0.34), 12, 8, 0.34);
  const small = boxUV(new THREE.BoxGeometry(0.6, 0.6, 0.55), 0.6, 0.6, 0.55);
  // +z face of each box: u runs across the width, v up the height
  const span = (geo) => {
    const uv = geo.attributes.uv;
    let uMin = Infinity; let uMax = -Infinity; let vMin = Infinity; let vMax = -Infinity;
    for (let i = 16; i < 20; i += 1) {
      uMin = Math.min(uMin, uv.getX(i)); uMax = Math.max(uMax, uv.getX(i));
      vMin = Math.min(vMin, uv.getY(i)); vMax = Math.max(vMax, uv.getY(i));
    }
    return [uMax - uMin, vMax - vMin];
  };
  assert.deepEqual(span(big).map((n) => Math.round(n * 100) / 100), [12 / TILE, 8 / TILE]);
  assert.deepEqual(span(small).map((n) => Math.round(n * 100) / 100), [0.38, 0.38]);
  // the same block size on both, i.e. the 1 m of the small pier is as many tiles as 1 m of the wall
  assert.equal(Math.round((span(small)[0] * TILE / 0.6) * 100) / 100, 1);
});

test('a gable roof sits over its wall and is closed by stone gables', () => {
  const parent = new THREE.Group();
  const tiles = new THREE.MeshStandardMaterial();
  const stone = new THREE.MeshStandardMaterial();
  const roof = gableRoof({ parent, tiles, stone, w: 8, d: 5, rise: 1.2, x: 1, y: 6, z: -2, along: 'x' });
  assert.equal(roof.position.x, 1);
  assert.equal(roof.position.y, 6);
  assert.equal(roof.position.z, -2);
  const slopes = roof.children.filter((c) => c.material === tiles);
  const gables = roof.children.filter((c) => c.material === stone);
  assert.equal(slopes.length, 2, 'two slopes');
  assert.ok(gables.length >= 3, 'two gable ends and a ridge cap');
  slopes.forEach((s) => assert.ok(s.geometry.attributes.uv, 'the tiles need to follow the slope'));
});
