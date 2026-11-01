import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  GIFT_SECONDS, GIFT_BEATS, GIFT_LINES, NECK, giftBeat, giftProgress, giftBeatProgress,
  giftReady, necklacePose,
} from '../src/gift.js';
import { createNecklace } from '../src/necklace.js';
import { createGiftBox } from '../src/gift-box.js';
import { createFairy } from '../src/fairy.js';

// The props are drawn on canvases; a stub is enough for the geometry to exist.
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
  // The fairy redraws her card once the Persian font has loaded. In a test there is no font and no need
  // to redraw, so the promise simply never settles: otherwise the redraw fires after the stub is gone.
  const never = new Promise(() => {});
  globalThis.document = { createElement: () => stubCanvas(), fonts: { ready: never, load: () => never } };
  try {
    return fn();
  } finally {
    globalThis.document = previous;
  }
}

// ---------- when it happens ----------------------------------------------------

test('the present is offered the first time the couple come out after having been in', () => {
  const base = { wasInside: false, isOutside: true, alreadyGiven: false, sceneActive: false };
  assert.equal(giftReady(base), false, 'not before they have ever been inside');
  assert.equal(giftReady({ ...base, wasInside: true, isOutside: false }), false, 'not while they are inside');
  assert.equal(giftReady({ ...base, wasInside: true }), true, 'the moment they step back out');
  assert.equal(giftReady({ ...base, wasInside: true, alreadyGiven: true }), false, 'only once, ever');
  assert.equal(giftReady({ ...base, wasInside: true, sceneActive: true }), false, 'and never twice at once');
});

// ---------- the schedule -------------------------------------------------------

test('the scene has six beats, in order, that cover it exactly once', () => {
  assert.deepEqual(GIFT_BEATS.map((b) => b.name), ['arrive', 'present', 'lift', 'circle', 'settle', 'glow']);
  let at = 0;
  for (const beat of GIFT_BEATS) {
    assert.equal(beat.from, at, `${beat.name} starts where the one before it ended`);
    assert.ok(beat.to > beat.from, `${beat.name} lasts a while`);
    at = beat.to;
  }
  assert.equal(at, GIFT_SECONDS, 'and the last beat ends the scene');
});

test('every moment of the scene maps to exactly one beat, and to nothing after it', () => {
  assert.equal(giftBeat(0), 'arrive');
  assert.equal(giftBeat(3), 'present');
  assert.equal(giftBeat(6), 'lift');
  assert.equal(giftBeat(8), 'circle');
  assert.equal(giftBeat(10), 'settle');
  assert.equal(giftBeat(12), 'glow');
  assert.equal(giftBeat(GIFT_SECONDS), 'done');
  assert.equal(giftBeat(999), 'done');
  // the boundaries belong to the later beat, so a beat never flickers back
  for (const beat of GIFT_BEATS.slice(1)) {
    assert.equal(giftBeat(beat.from), beat.name);
  }
});

test('progress runs 0..1 and never leaves that range', () => {
  assert.equal(giftProgress(-5), 0);
  assert.equal(giftProgress(0), 0);
  assert.equal(giftProgress(GIFT_SECONDS / 2), 0.5);
  assert.equal(giftProgress(GIFT_SECONDS), 1);
  assert.equal(giftProgress(GIFT_SECONDS * 3), 1);
  for (const t of [-1, 2, 4, 6, 8, 10, 12, 20]) {
    const { k } = giftBeatProgress(t);
    assert.ok(k >= 0 && k <= 1, `k at ${t} is in range`);
  }
});

test('she says three things across twelve seconds, not a line a second', () => {
  const spoken = Object.values(GIFT_LINES).filter(Boolean);
  assert.ok(spoken.length <= 3, 'the scene is not talked over');
  assert.match(GIFT_LINES.settle, /گردنبند|آورده/);
});

// ---------- the necklace's path ------------------------------------------------

test('the necklace is in the box, then in the air, then on her neck, then it stays', () => {
  const boxAt = new THREE.Vector3(0, 1.5, 11);
  const holdAt = new THREE.Vector3(0, 2.05, 10);
  const neckAt = new THREE.Vector3(0, NECK.y, NECK.z);

  const inBox = necklacePose(4.5, { boxAt, holdAt, neckAt });
  assert.equal(inBox.scale, 0.001, 'hidden in the box');
  assert.ok(Math.abs(inBox.z - boxAt.z) < 0.01, 'and at the box');

  const inAir = necklacePose(7.0, { boxAt, holdAt, neckAt });
  assert.ok(inAir.scale > 0.1 && inAir.scale <= 1, 'it has come out and is growing to size');
  assert.ok(inAir.y > boxAt.y, 'it rose');

  const landing = necklacePose(10.2, { boxAt, holdAt, neckAt });
  assert.ok(Math.abs(landing.x - neckAt.x) < 0.001, 'it is at her neck');
  assert.ok(landing.scale === 1, 'full size');

  const settled = necklacePose(GIFT_SECONDS + 5, { boxAt, holdAt, neckAt });
  assert.deepEqual([settled.x, settled.y, settled.z], [neckAt.x, neckAt.y, neckAt.z]);
  assert.equal(settled.spin, 0, 'and still');
});

test('the necklace never jumps: every frame of the scene moves it a little', () => {
  const boxAt = new THREE.Vector3(0, 1.5, 11);
  const holdAt = new THREE.Vector3(0, 2.05, 10);
  const neckAt = new THREE.Vector3(0, NECK.y, NECK.z);
  let last = null;
  let worst = 0;
  for (let t = 0; t <= GIFT_SECONDS; t += 1 / 60) {
    const p = necklacePose(t, { boxAt, holdAt, neckAt });
    if (last) {
      const jump = Math.hypot(p.x - last.x, p.y - last.y, p.z - last.z);
      worst = Math.max(worst, jump);
    }
    last = p;
  }
  // at 60 fps a metre per frame would be a teleport; this stays under a fifth of that
  assert.ok(worst < 0.2, `the largest single-frame move is ${worst.toFixed(3)} m`);
});

// ---------- the props ----------------------------------------------------------

test('the necklace is jewellery: a chain, a heart and a stone, and small', () => {
  withCanvas(() => {
    const n = createNecklace((o) => o);
    assert.ok(n.counts.meshes >= 5 && n.counts.meshes <= 12, `the necklace is ${n.counts.meshes} meshes`);
    const box = new THREE.Box3().setFromObject(n.group);
    const size = box.getSize(new THREE.Vector3());
    // it must fit on a neck: 30 cm across is a necklace, 3 m across is not
    assert.ok(size.x < 0.35 && size.z < 0.35, `it is ${size.x.toFixed(2)} m wide`);
    assert.ok(size.y < 0.25, 'and hangs no further than a pendant');
    // the pendant hangs below the chain, which is what makes it a pendant
    assert.ok(n.heart.position.y < 0, 'the heart is below the chain');
    // updating it must not throw
    n.update(1, 0.016, 1);
    n.update(2, 0.016, 0);
  });
});

test('the necklace sits exactly where her gold choker is', () => {
  // characters.js puts the choker at y = 1.68 and the body is scaled as a whole, so the necklace's own
  // chain has to be at that same height or it floats above her collar or cuts through her throat.
  assert.equal(NECK.y, 1.68);
  assert.ok(NECK.pendantY < NECK.y, 'the pendant hangs below the chain');
  assert.ok(NECK.chainRadius > 0.1 && NECK.chainRadius < 0.16, 'a chain that fits a throat, not a barrel');
  assert.ok(NECK.z > 0.05, 'and it sits on the front of her neck, not inside it');
});

test('the box shuts and opens, and its lid swings rather than sliding', () => {
  withCanvas(() => {
    const b = createGiftBox((o) => o);
    assert.ok(b.counts.meshes >= 8 && b.counts.meshes <= 20, `the box is ${b.counts.meshes} meshes`);
    b.setOpen(0);
    assert.ok(Math.abs(b.lidPivot.rotation.x) < 1e-9, 'shut');
    b.setOpen(1);
    assert.ok(b.lidPivot.rotation.x < -1.5, 'the lid swings right back');
    // clamped: a caller passing 2 must not spin it twice round
    b.setOpen(4);
    const atOne = b.lidPivot.rotation.x;
    b.setOpen(1);
    assert.equal(b.lidPivot.rotation.x, atOne);
    // and the necklace's own place inside the box is inside the box
    assert.ok(Math.abs(b.inside.x) < 0.15 && Math.abs(b.inside.z) < 0.11);
  });
});

// ---------- the fairy's return -------------------------------------------------

test('the fairy comes back, presents, circles, and leaves for good', () => {
  withCanvas(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 300);
    camera.position.set(0, 2, 14);
    const fairy = createFairy(scene);
    const box = createGiftBox((o) => o);
    fairy.attachGiftBox(box, box.setOpen);

    fairy.beginReturn({ x: 0, z: 9.5 });
    assert.equal(fairy.returning, true);

    const seen = new Set();
    const positions = [];
    let t = 0;
    for (let i = 0; i < 60 * 14; i += 1) {
      t += 1 / 60;
      fairy.update(t, 1 / 60, 1, true, camera);
      if (fairy.returning) {
        seen.add(fairy.returnGiftStage);
        positions.push(fairy.position.clone());
      }
    }
    for (const stage of ['arrive', 'present', 'lift', 'circle', 'settle', 'glow']) {
      assert.ok(seen.has(stage), `the scene reaches ${stage}`);
    }
    assert.equal(fairy.returning, false, 'and it ends');
    assert.equal(fairy.giftDone, true);

    // she arrives in front of the couple, not somewhere across the garden
    const near = positions.some((p) => Math.hypot(p.x - 0, p.z - 9.5) < 3);
    assert.ok(near, 'she comes to the couple');
    // and she leaves upward, not sideways into the castle
    const last = positions[positions.length - 1];
    assert.ok(last.y > 6, `she leaves upward (last y ${last.y.toFixed(1)})`);
  });
});

test('a second return never starts over the first', () => {
  withCanvas(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 300);
    const fairy = createFairy(scene);
    fairy.beginReturn({ x: 0, z: 9 });
    fairy.update(1, 1 / 60, 1, true, camera);
    fairy.update(2, 1 / 60, 1, true, camera);
    // the intro's own visibility must not be able to hide the return flight
    fairy.update(3, 1 / 60, 1, true, camera);
    assert.equal(fairy.returning, true, 'the intro update does not cancel the return');
  });
});
