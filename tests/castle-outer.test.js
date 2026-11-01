import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildCastleOuter } from '../src/castle-outer.js';

// The hall's layout, as src/world.js defines it. (That module also pulls in the memories, which
// read import.meta.env, so the numbers are repeated here rather than imported.)
const LAYOUT = {
  hallHalfWidth: 3.85,
  hallSpring: 6.15,
  hallLength: 40,
  room: {
    height: 6.4,
    ox0: -16.34, ox1: -3.85, oz0: -23.74, oz1: -16.26,
    ix0: -16.0, ix1: -4.15, iz0: -23.4, iz1: -16.6,
    masonry: 0.34,
  },
};

// The maps are canvases; they only have to exist for this test, not to be readable.
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
  return { width: 1, height: 1, getContext: () => ctx, toDataURL: () => 'data:,' };
}

function buildShell() {
  const previous = globalThis.document;
  globalThis.document = { createElement: () => stubCanvas() };
  try {
    const scene = new THREE.Scene();
    const group = buildCastleOuter(scene, (o) => o, {
      hallHalfWidth: LAYOUT.hallHalfWidth,
      spring: LAYOUT.hallSpring,
      length: LAYOUT.hallLength,
      room: LAYOUT.room,
    });
    scene.updateMatrixWorld(true);
    return { scene, group };
  } finally {
    globalThis.document = previous;
  }
}

// The inside of the gallery hall: its walls, its floor and the space under the vault.
function insideHall(p) {
  return Math.abs(p.x) < LAYOUT.hallHalfWidth - 0.01
    && p.y > 0.03 && p.y < LAYOUT.hallSpring - 0.03
    && p.z < 0.02 && p.z > -LAYOUT.hallLength + 0.03;
}

// The inside of the photo room, under its ceiling.
function insideRoom(p) {
  const R = LAYOUT.room;
  return p.x > R.ix0 + 0.01 && p.x < R.ix1 - 0.01
    && p.z > R.iz0 + 0.01 && p.z < R.iz1 - 0.01
    && p.y > 0.03 && p.y < R.height - 0.01;
}

test('nothing on the castle\'s outside reaches into the hall or the photo room', () => {
  const { group } = buildShell();
  assert.ok(group.children.length > 100, 'the shell should be a lot of masonry');
  const v = new THREE.Vector3();
  const intruders = [];
  group.traverse((o) => {
    if (!o.isMesh || !o.geometry.attributes.position) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      if (insideHall(v) || insideRoom(v)) {
        intruders.push({ where: insideHall(v) ? 'hall' : 'room', at: v.toArray().map((n) => +n.toFixed(2)) });
        return;
      }
    }
  });
  // A wall built past the hall's own wall used to put brick columns, corner quoins and a roof
  // pyramid in the middle of the corridor, over the photo frames.
  assert.deepEqual(intruders, []);
});

test('the shell still reaches round the whole castle', () => {
  const { group } = buildShell();
  const box = new THREE.Box3().setFromObject(group);
  // walls both side of the hall, a roof over it, the annex to the west and the rear wall
  assert.ok(box.max.x > LAYOUT.hallHalfWidth + 0.2, 'the east wall is there');
  assert.ok(box.min.x < LAYOUT.room.ox0 - 0.2, 'the annex is there');
  assert.ok(box.max.y > LAYOUT.hallSpring + 3, 'the roof is there');
  assert.ok(box.min.z < -LAYOUT.hallLength - 0.3, 'the rear wall is there');
});
