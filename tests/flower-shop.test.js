import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCouple } from '../src/characters.js';
import { createBouquet, flowerArmPose, bouquetSlot, buyRose, nextRoseIndex, SHOP, shopClearsEnvelope, buyLine } from '../src/flower-shop.js';

// The couple and the bouquet are built from canvases; a stub is enough, they only have to exist.
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

function withCanvas(fn) {
  const previous = globalThis.document;
  globalThis.document = { createElement: () => stubCanvas() };
  try {
    return fn();
  } finally {
    globalThis.document = previous;
  }
}

// The princess's dress, as a rough volume: the skirt is a bell of radius ~0.72 at the hem, narrowing
// to the bodice at 1.4 m. Anything she holds must stay outside this with a margin.
const SKIRT = [
  { y: 0.0, r: 0.72 },
  { y: 0.55, r: 0.58 },
  { y: 0.98, r: 0.38 },
  { y: 1.1, r: 0.3 },
  { y: 1.38, r: 0.31 },
  { y: 1.66, r: 0.26 },
];
function dressRadius(y) {
  if (y <= SKIRT[0].y) return SKIRT[0].r;
  for (let i = 1; i < SKIRT.length; i += 1) {
    if (y <= SKIRT[i].y) {
      const a = SKIRT[i - 1];
      const b = SKIRT[i];
      const t = (y - a.y) / (b.y - a.y || 1);
      return a.r + (b.r - a.r) * t;
    }
  }
  return SKIRT[SKIRT.length - 1].r;
}

test('buying takes the next rose in the row, then says the shop is empty', () => {
  let sold = [false, false, false, false, false];
  assert.equal(nextRoseIndex(sold), 0);
  const order = [];
  for (let i = 0; i < 5; i += 1) {
    const result = buyRose(sold);
    order.push(result.index);
    sold = result.sold;
  }
  assert.deepEqual(order, [0, 1, 2, 3, 4]);
  assert.deepEqual(sold, [true, true, true, true, true]);
  assert.equal(nextRoseIndex(sold), -1);
  assert.deepEqual(buyRose(sold), { index: -1, sold });
  assert.match(buyLine(1), /مالِ تو/);
  assert.match(buyLine(5), /پنج/);
});

test('the stall stands clear of the envelope and inside the hall', () => {
  // the envelope's own footprint, from src/world.js
  assert.equal(shopClearsEnvelope({ x: 0, y: 0.6, z: -38.9, w: 3.4, h: 2.2 }), true);
  // and the counter is inside the hall's last metres
  assert.ok(SHOP.z > -38.9, 'in front of the envelope');
  assert.ok(SHOP.z < -34, 'but right at the end, so the walk down the hall leads somewhere');
  assert.ok(SHOP.halfWidth * 2 < 3.85 * 2, 'the stall fits between the hall walls');
  // She has to be able to stand at the counter. The hall leaves the boy 1.5 m beside her, so the
  // corridor's middle is |x| < 3.85 - 0.3 - 1.5 = 2.05; the buy spot must be inside that.
  assert.ok(Math.abs(SHOP.buySpot.x) < 2.0, 'the counter can be reached from the walkable middle');
  assert.ok(SHOP.buySpot.z > SHOP.z, 'and from the front of it');
});

test('a bought rose hangs in her hand and never enters her dress', () => {
  withCanvas(() => {
    const hero = createCouple('#d98cb4');
    const bouquet = createBouquet(hero.bouquetGroup);
    const scene = new THREE.Scene();
    scene.add(hero.root);
    // She walks (the arm swings) and then stands still; both have to be safe.
    const poses = [0, 1, 2, 3, 4, 5];

    let worst = Infinity;
    for (const bought of poses) {
      while (bouquet.count < bought) bouquet.add({ petalColor: '#ff5f8f' });
      hero.setFlowerPose(Math.min(1, bought / 3));
      for (let frame = 0; frame < 24; frame += 1) {
        hero.animate(1 / 30, frame / 10, frame % 2 === 0, false);
        scene.updateMatrixWorld(true);
        // every vertex of every rose, in the dress's own frame (her body is scaled as a whole)
        // (her own rose is in this group too, so it is checked as well)
        bouquet.group.traverse((o) => {
          if (!o.isMesh) return;
          const pos = o.geometry.attributes.position;
          const v = new THREE.Vector3();
          const step = Math.max(1, Math.floor(pos.count / 12));
          for (let i = 0; i < pos.count; i += step) {
            v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
            hero.dressSpace.worldToLocal(v);
            const reach = Math.hypot(v.x, v.z);
            worst = Math.min(worst, reach - dressRadius(v.y));
            // and always on her far side from the boy, never across her front
            assert.ok(v.x > 0.12, `a rose crossed to her other side (x = ${v.x.toFixed(2)})`);
          }
        });
      }
    }
    // A clear gap, not a hair's width: the bouquet stands off her skirt.
    assert.ok(worst > 0.06, `the closest rose came ${worst.toFixed(3)} m from the dress surface`);
    assert.ok(bouquet.count === 5);
  });
});

test('the bouquet fans away from her side and the arm swings out as it fills', () => {
  const one = flowerArmPose(1);
  const five = flowerArmPose(5);
  assert.ok(one.z > 0.3, 'even one rose swings the arm out of her side');
  assert.ok(five.z > one.z, 'a full bouquet needs a little more room');
  assert.ok(five.z < 0.8, 'but not a raised arm');
  // the fan is symmetric and stays narrow
  const slots = Array.from({ length: 5 }, (_, i) => bouquetSlot(i, 5));
  assert.ok(slots[2].x === 0);
  assert.ok(Math.abs(slots[0].x) < 0.03 && Math.abs(slots[4].x) < 0.03);
  assert.ok(slots[4].y > slots[0].y, 'the fan rises from the first rose to the last');
});
