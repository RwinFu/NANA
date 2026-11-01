import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  GIFT_SECONDS, GIFT_BEATS, GIFT_LINES, NECK, NECK_POSE, NECK_WEAR_SCALE, giftBeat, giftProgress, giftBeatProgress,
  giftReady, necklacePose,
} from '../src/gift.js';
import { createNecklace } from '../src/necklace.js';
import { createGiftBox } from '../src/gift-box.js';
import { createFairy } from '../src/fairy.js';
import { createCouple } from '../src/characters.js';

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
  // worn at her own size: she is a small character and the necklace is parented to her scaled body, so the
  // flight has to arrive at exactly that scale or it pops bigger the instant it touches her neck
  assert.equal(landing.scale, NECK_WEAR_SCALE, 'her size, not the world\'s');
  assert.ok(Math.abs(necklacePose(9.79, { boxAt, holdAt, neckAt }).scale - NECK_WEAR_SCALE) < 0.02,
    'and it is already that size when it lands, so there is no pop');

  // Settled: it rides her breathing now, so it is *at* her neck rather than frozen on it. The motion is
  // a couple of millimetres, which is the point - a necklace glued in place looks glued on.
  const settled = necklacePose(GIFT_SECONDS + 5, { boxAt, holdAt, neckAt });
  assert.ok(Math.abs(settled.x - neckAt.x) < 1e-6);
  assert.ok(Math.abs(settled.y - neckAt.y) < 0.004, 'within a breath of her neck');
  assert.ok(Math.abs(settled.z - neckAt.z) < 0.004);
  assert.ok(Math.abs(settled.spin) < 0.05, 'and almost still');
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
    // 31 cm is a necklace for a character whose shoulders are about that wide; the heart will be ~4 cm
    assert.ok(size.x < 0.42 && size.z < 0.52, `it is ${size.x.toFixed(2)} m wide`);
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
  // her built-in choker is the torus at y = 1.68 in her body's frame; the necklace sits just under it and
  // just outside it, so the two read as two pieces rather than fighting for the same few millimetres
  assert.ok(NECK.y < 1.68 && NECK.y > 1.64, `the chain hangs a hair below her choker (y ${NECK.y})`);
  assert.ok(NECK.pendantY < NECK.y, 'the pendant hangs below the chain');
  // her throat is 0.113 at that height and her choker's outer edge is 0.137, so the chain has to be outside it
  assert.ok(NECK.chainRadius > 0.137 && NECK.chainRadius < 0.18,
    `a chain that clears her choker (radius ${NECK.chainRadius}), not one that sits inside her neck`);
  assert.equal(NECK_POSE.y, NECK.y, 'and the flight lands on the same height it is worn at');
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

// ---------- where it ends up ---------------------------------------------------
//
// The necklace is measured in her *body's* frame, the same frame the gold choker is built in, and that
// body is scaled to 0.68. Getting this wrong is invisible in a still and obvious on screen: mounted on her
// root instead, the necklace floats half a metre above her throat at the wrong size. So the test asks her
// rig, not the source, where her throat is.

test('the necklace sits on her own choker, in the world, at her size', () => {
  const hero = withCanvas(() => createCouple('#ff758f'));
  hero.root.position.set(0, 0, 10);
  hero.root.rotation.y = Math.PI;
  hero.animate(1 / 60, 0, false, false);
  hero.root.updateMatrixWorld(true);

  // the choker is the ring she already wears: find it by its place in her body
  let choker = null;
  hero.dressSpace.traverse((o) => {
    if (o.isMesh && o.geometry?.type === 'TorusGeometry' && Math.abs(o.position.y - 1.68) < 1e-6) choker = o;
  });
  assert.ok(choker, 'she wears a gold choker at 1.68 in her body frame');
  const chokerAt = new THREE.Vector3();
  choker.getWorldPosition(chokerAt);
  assert.ok(chokerAt.y < 1.3, `the choker is at her throat, not her root: world y ${chokerAt.y.toFixed(3)}`);

  const necklace = withCanvas(() => createNecklace((o) => o));
  hero.dressSpace.add(necklace.worn);
  necklace.group.position.set(0, NECK_POSE.y, NECK_POSE.z);
  hero.root.updateMatrixWorld(true);
  const wornAt = new THREE.Vector3();
  necklace.group.getWorldPosition(wornAt);
  // just under her choker, by about a centimetre: two necklaces on one neck, not one welded onto the other
  assert.ok(wornAt.y < chokerAt.y && chokerAt.y - wornAt.y < 0.02,
    `it hangs just below the choker: ${(chokerAt.y - wornAt.y).toFixed(4)} m under it`);
  // the pendant hangs below the chain, on the front of her throat, not inside her neck
  const box = new THREE.Box3().setFromObject(necklace.group);
  assert.ok(box.min.y < chokerAt.y - 0.05, 'the pendant hangs below the chain');
  assert.ok(box.max.y - box.min.y < 0.22, `and the whole thing is jewellery-sized: ${(box.max.y - box.min.y).toFixed(3)} m`);
});

test('the flight lands exactly where the necklace is mounted', () => {
  const hero = withCanvas(() => createCouple('#ff758f'));
  hero.root.position.set(-3, 0, 6);
  hero.root.rotation.y = 0.8;
  hero.animate(1 / 60, 0, false, false);
  hero.root.updateMatrixWorld(true);
  // the landing point main.js computes, in her body's frame, converted to the world...
  const landing = new THREE.Vector3(0, NECK_POSE.y, NECK_POSE.z);
  hero.dressSpace.localToWorld(landing);
  // ...must be where the pose puts the necklace at the moment it becomes hers
  const boxAt = new THREE.Vector3(landing.x, 1.5, landing.z + 1.35);
  const holdAt = new THREE.Vector3(landing.x, 2.05, landing.z + 0.75);
  for (const t of [9.8, 10.4, 11.0, 11.6, 12.2]) {
    const pose = necklacePose(t, { boxAt, holdAt, neckAt: landing });
    // the chain is hers from the first landing frame; only its breathing moves it (a millimetre or so)
    assert.ok(Math.hypot(pose.x - landing.x, pose.z - landing.z) < 0.004, `no sideways drift at t=${t}`);
    assert.ok(Math.abs(pose.y - landing.y) < 0.051, `and it is on her throat at t=${t}, not passing through it`);
  }
  // after it lands the chain does not move again: only the pendant is allowed to swing
  const settled = necklacePose(11.7, { boxAt, holdAt, neckAt: landing });
  assert.ok(Math.abs(settled.spin) < 0.05, 'the chain is still: a chain that spins is a hoop turning over');
});

test('the pendant swings out of her throat, never into it', () => {
  const hero = withCanvas(() => createCouple('#ff758f'));
  hero.root.position.set(0, 0, 10);
  hero.animate(1 / 60, 0, false, false);
  hero.root.updateMatrixWorld(true);
  const necklace = withCanvas(() => createNecklace((o) => o));
  hero.dressSpace.add(necklace.worn);
  necklace.group.position.set(0, NECK_POSE.y, NECK_POSE.z);
  necklace.worn.visible = true;

  const neck = new THREE.Vector3(0, NECK_POSE.y, NECK_POSE.z);
  hero.dressSpace.localToWorld(neck);
  const heartAt = new THREE.Vector3();
  let closest = Infinity;
  // drive the landing's own swing, including its inward half, frame by frame
  for (let i = 0; i < 60 * 3; i++) {
    const t = 9.8 + i / 60;
    const pose = necklacePose(t, { boxAt: neck, holdAt: neck, neckAt: neck });
    necklace.update(t, 1 / 60, 1, pose.swing);
    hero.root.updateMatrixWorld(true);
    necklace.worn.updateMatrixWorld(true);
    necklace.heart.getWorldPosition(heartAt);
    closest = Math.min(closest, Math.abs(heartAt.z - neck.z));
  }
  assert.ok(closest > 0.05, `the pendant stays ${closest.toFixed(3)} m in front of her throat, so it cannot clip through`);
});

test('the pendant hangs outside her bodice, not inside her dress', () => {
  // This is the bug the close-up exposed: her bodice flares out below the neck (front face z ~0.19 where the
  // chain sits at 0.145), so a pendant hung straight down the chain's own line is buried in the fabric. It has
  // to hang outside the chain, and be tipped only slightly, or it reads as a U rather than a heart.
  const hero = withCanvas(() => createCouple('#ff758f'));
  hero.root.position.set(0, 0, 0);
  hero.animate(1 / 60, 0, false, false);
  hero.root.updateMatrixWorld(true);
  const n = withCanvas(() => createNecklace((o) => o));
  hero.dressSpace.add(n.worn);
  n.group.position.set(0, NECK_POSE.y, NECK_POSE.z);
  n.worn.visible = true;
  hero.root.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(n.heart);
  const midY = (box.min.y + box.max.y) / 2;
  const ray = new THREE.Raycaster();
  const targets = [];
  hero.dressSpace.traverse((o) => { if (o.isMesh && o.visible && !n.worn.getObjectById(o.id)) targets.push(o); });
  const y = hero.dressSpace.worldToLocal(new THREE.Vector3(0, midY, 0)).y;
  const from = new THREE.Vector3(0, y, 0);
  hero.dressSpace.localToWorld(from);
  ray.set(from, new THREE.Vector3(0, 0, 1).transformDirection(hero.dressSpace.matrixWorld));
  ray.far = 2;
  const hit = ray.intersectObjects(targets, false)[0];
  const surface = hit ? hit.distance / 0.68 : NaN;
  const rear = hero.dressSpace.worldToLocal(new THREE.Vector3(0, 0, box.min.z)).z;
  assert.ok(Number.isFinite(surface), 'her bodice is in front of her spine, as expected');
  assert.ok(rear - surface > 0.02,
    `the pendant must clear her dress: it is ${((rear - surface) * 1000).toFixed(0)} mm in front of it`);
  // and it faces the front: a heart tipped flat onto a cone is a U from the front
  assert.ok(Math.abs(n.heart.rotation.x) < 0.5, `it is tipped ${n.heart.rotation.x} rad, which foreshortens the heart`);
  assert.ok(box.min.y < NECK_POSE.y * 0.68, 'and it still hangs below the chain');
});
