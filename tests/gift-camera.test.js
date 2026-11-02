// The present's camera: one continuous move, no cuts.
//
// A twelve-second scene is easy to shoot as four shots with three cuts, and it would look like a bug in a
// game whose camera is otherwise always the same follow camera. So this camera travels, and the numbers
// below are the proof that it does: every shot's end pose is the next shot's start pose, the largest
// single-frame move is measured (not assumed), and the last frame is exactly where the walking camera
// stands so the hand-back travels nowhere.

import test from 'node:test';
import assert from 'node:assert/strict';

import { GIFT_SECONDS } from '../src/gift.js';
import { GIFT_SHOTS, giftCamera, giftCameraBlend, giftShot, keepCameraClear } from '../src/gift-camera.js';
import { createFairy } from '../src/fairy.js';
import * as THREE from 'three';

// The fairy draws her own textures on a canvas; a stub is enough for her geometry and her flight to exist.
function withCanvas(fn) {
  const previous = globalThis.document;
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
    set: (t, k, v) => { t[k] = v; return true; },
  });
  const never = new Promise(() => {});
  globalThis.document = {
    createElement: () => ({
      width: 1, height: 1, style: {}, getContext: () => ctx, toDataURL: () => 'data:,',
      addEventListener() {}, removeEventListener() {}, setAttribute() {},
    }),
    fonts: { ready: never, load: () => never },
  };
  try { return fn(); } finally { globalThis.document = previous; }
}

// the couple coming out of the castle, with the numbers the game really has: her throat is at 1.14 and the
// walking camera looks at 1.70 (it aims at her chest, above the gold), standing 4.93 back and 3.70 up
const FOLLOW = { x: 0, y: 3.70, z: 12.4 + 4.93 }; // behind her (she faces -z at yaw = PI)
const HERE = { x: 0, z: 12.4, yaw: Math.PI, outYaw: Math.PI, neckY: 1.14, focusY: 1.70, follow: FOLLOW };
const FAIRY = { x: 1.2, y: 6.4, z: 13.0 }; // high up, mid-descent
const NECK = { x: 0, y: 1.14, z: 12.3 };

const at = (t, couple = HERE, fairy = FAIRY, neck = NECK) => giftCamera(t, couple, fairy, neck, {});
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

test('the film is covered end to end by shots, in order, with no gaps', () => {
  assert.equal(GIFT_SHOTS[0].from, 0, 'it starts at the first frame');
  assert.ok(GIFT_SHOTS[GIFT_SHOTS.length - 1].to >= GIFT_SECONDS, 'and outlives the scene');
  for (let i = 1; i < GIFT_SHOTS.length; i++) {
    assert.equal(GIFT_SHOTS[i].from, GIFT_SHOTS[i - 1].to, `${GIFT_SHOTS[i].name} must start where the last ended`);
  }
  assert.equal(giftShot(0), 'find');
  assert.equal(giftShot(2.6), 'wide', 'a boundary belongs to the shot that begins there');
  assert.equal(giftShot(9.0), 'close');
  assert.equal(giftShot(GIFT_SECONDS + 1), 'out', 'and after the scene it has let go');
  assert.equal(giftShot(-3), 'find');
});

test('every shot hands over to the next without a jump', () => {
  for (let i = 1; i < GIFT_SHOTS.length; i++) {
    const t = GIFT_SHOTS[i].from;
    const before = at(t - 1 / 240);
    const after = at(t + 1 / 240);
    assert.ok(dist(before.position, after.position) < 0.03,
      `${GIFT_SHOTS[i - 1].name} -> ${GIFT_SHOTS[i].name}: camera jumps ${dist(before.position, after.position).toFixed(3)} m`);
    assert.ok(dist(before.look, after.look) < 0.12,
      `${GIFT_SHOTS[i - 1].name} -> ${GIFT_SHOTS[i].name}: the look jumps ${dist(before.look, after.look).toFixed(3)} m`);
  }
});

test('the whole twelve seconds never moves more than a fifth of a metre in a frame', () => {
  let worstP = 0;
  let worstL = 0;
  let worstT = 0;
  let last = at(0);
  for (let t = 1 / 60; t <= GIFT_SECONDS; t += 1 / 60) {
    const now = at(t);
    const dp = dist(now.position, last.position);
    const dl = dist(now.look, last.look);
    if (dp > worstP) { worstP = dp; worstT = t; }
    worstL = Math.max(worstL, dl);
    last = now;
  }
  // the pull-back out to the walking camera is necessarily the quickest part of the film -- it covers three
  // metres in a second and a bit -- but it accelerates smoothly and never steps
  assert.ok(worstP < 0.25, `largest step is ${worstP.toFixed(3)} m at t=${worstT.toFixed(2)}`);
  assert.ok(worstL < 0.5, `largest look step is ${worstL.toFixed(3)} m`);
});

test('the film begins and ends exactly on the walking camera, wherever the player has it', () => {
  // the opening used to sweep six metres sideways, because it started from the follow camera and blended
  // towards a shot composed on the far side of her. Now the first and last frame *are* the follow camera.
  for (const follow of [
    FOLLOW,
    { x: 2.9, y: 2.8, z: 12.4 + 3.4 },
    { x: -3.6, y: 4.6, z: 12.4 + 5.9 },
    { x: 0, y: 2.2, z: 12.4 - 3.1 }, // orbited right round to her other side
  ]) {
    const couple = { ...HERE, follow };
    const first = giftCamera(0, couple, FAIRY, NECK, {});
    assert.ok(dist(first.position, follow) < 0.03, `opens ${dist(first.position, follow).toFixed(3)} m off the walking camera`);
    assert.ok(Math.abs(first.look.y - couple.focusY) < 0.03, 'and on its aim');
    const last = giftCamera(GIFT_SECONDS - 1 / 60, couple, FAIRY, NECK, {});
    assert.ok(dist(last.position, follow) < 0.06, `closes ${dist(last.position, follow).toFixed(3)} m off it`);
    assert.ok(Math.abs(last.look.y - couple.focusY) < 0.04, 'and on its aim');
    // and no cut at the boundary: the final frame and the hand-back land within a few centimetres
    const before = giftCamera(GIFT_SECONDS - 1 / 60, couple, FAIRY, NECK, {});
    const after = giftCamera(GIFT_SECONDS + 1 / 60, couple, FAIRY, NECK, {});
    assert.ok(dist(before.position, after.position) < 0.06, 'the hand-back is a move of centimetres, not a jump');
  }
});

test('the film leaves the doorway, watches the butterfly, then comes in for the pendant', () => {
  // The movement of this scene is the butterfly's: she circles the couple between 5.4 s and 9.6 s. So the camera
  // does not orbit them (it cannot: the doorway is 3 m wide and the walls are 3.85 m either side). It takes
  // itself out of the door, stands off in the garden and watches her go round -- then comes in on the necklace
  // for the one shot that has to be read. Three moves, and this checks each of them.
  const rel = (t) => {
    const p = at(t).position;
    // distance along the outward axis, whatever direction that is for this couple
    const out = (p.x - HERE.x) * Math.sin(HERE.outYaw) + (p.z - HERE.z) * Math.cos(HERE.outYaw);
    return { out, y: p.y };
  };
  // 1. it gets out of the hall and stands off
  const garden = rel(5.4);
  assert.ok(garden.out > 2.6, `it is out in the garden by the hold (${garden.out.toFixed(2)} m out)`);
  assert.ok(garden.y > 1.9 && garden.y < 3.4, `at head height for the butterfly (${garden.y.toFixed(2)} m)`);
  // 2. it comes in close for the pendant
  const close = rel(10.7);
  assert.ok(close.out > 0.45 && close.out < 1.6, `in close at the settle (${close.out.toFixed(2)} m out)`);
  assert.ok(close.y < 1.6, `down at her throat for the necklace (${close.y.toFixed(2)} m)`);
  // 3. and the pendant is the biggest thing in the frame at that moment
  const d = Math.hypot(at(10.7).position.x - HERE.x, at(10.7).position.z - HERE.z);
  assert.ok(d < 1.0, `the close-up is ${d.toFixed(2)} m from her, so the pendant reads`);
  // 4. it does not swing round her: the first frames are the walking camera's own (behind her, inside the hall,
  // where the hand-over happens), and from the moment the film owns the shot it is out in the garden and stays
  // out. It never goes back in, which is the move that used to cut through the wall.
  for (let t = 2.2; t <= 11.4; t += 1 / 30) {
    const r = rel(t);
    assert.ok(r.out > 0.2, `the camera is only ${r.out.toFixed(2)} m out at t=${t.toFixed(2)}, which is the hall`);
  }
});

test('the film ends on the walking camera, wherever the player happens to be standing it', () => {
  // it cannot be a guessed pose: the player's orbit angle, pitch and window shape all move the follow camera,
  // so the film is handed the real one and has to land on it
  for (const follow of [
    FOLLOW,
    { x: 2.9, y: 2.8, z: 12.4 + 3.4 },   // orbited round her right shoulder
    { x: -3.6, y: 4.6, z: 12.4 + 5.9 },  // a portrait window: further back and higher
  ]) {
    const couple = { ...HERE, follow };
    const end = giftCamera(GIFT_SECONDS - 1 / 60, couple, FAIRY, NECK, {});
    assert.ok(dist(end.position, follow) < 0.06, `ends ${dist(end.position, follow).toFixed(3)} m from the follow camera`);
    assert.ok(Math.abs(end.look.y - couple.focusY) < 0.03, 'and on its aim');
  }
  // without a follow camera it still has a sensible place to stop
  const alone = giftCamera(GIFT_SECONDS - 1 / 60, { ...HERE, follow: null }, FAIRY, NECK, {});
  assert.ok(Number.isFinite(alone.position.y));
});

test('it blends in and out, and is off at both ends', () => {
  assert.equal(giftCameraBlend(0), 0, 'the walking camera owns the first frame');
  assert.ok(giftCameraBlend(0.25) < 0.6, 'and is handed over within a beat');
  assert.equal(giftCameraBlend(1.2), 1, 'the film owns the middle');
  assert.equal(giftCameraBlend(9.5), 1);
  assert.equal(giftCameraBlend(GIFT_SECONDS), 0, 'and gives it back before the scene ends');
  assert.equal(giftCameraBlend(GIFT_SECONDS + 2), 0);
  // monotone in, monotone out: no flicker
  let previous = 0;
  for (let t = 0; t <= 0.75; t += 0.05) {
    const b = giftCameraBlend(t);
    assert.ok(b >= previous - 1e-9, 'the way in never goes backwards');
    previous = b;
  }
  previous = 1;
  for (let t = GIFT_SECONDS - 1; t <= GIFT_SECONDS + 0.2; t += 0.05) {
    const b = giftCameraBlend(t);
    assert.ok(b <= previous + 1e-9, 'nor does the way out');
    previous = b;
  }
});

test('closeness is a 0..1 dial for the vignette, and it is shut at both ends', () => {
  assert.equal(at(0).closeness, 0);
  assert.equal(at(GIFT_SECONDS).closeness, 0);
  let peak = 0;
  for (let t = 0; t <= GIFT_SECONDS; t += 1 / 30) {
    const c = at(t).closeness;
    assert.ok(c >= 0 && c <= 1, `closeness ${c} out of range at t=${t.toFixed(2)}`);
    peak = Math.max(peak, c);
  }
  assert.ok(peak > 0.9, 'and it does get close for the settle');
});

test('the camera never passes through her, and never loses her', () => {
  for (let t = 0; t <= GIFT_SECONDS; t += 1 / 30) {
    const shot = at(t);
    const fromHer = Math.hypot(shot.position.x - HERE.x, shot.position.z - HERE.z);
    // the tightest is 0.70 m from her spine, but her chest reaches 0.35 m out, so it is 0.35 m clear of her
    // clothes: a tight neck-and-shoulder shot, still well outside her body
    assert.ok(fromHer > 0.55, `the camera is ${fromHer.toFixed(2)} m from her at t=${t.toFixed(2)}`);
    const height = shot.position.y;
    // low enough to feel like a hand-held shot of a small character, never underground
    assert.ok(height > 0.25 && height < 5, `camera height ${height.toFixed(2)} at t=${t.toFixed(2)}`);
    // she is in frame: the look target is near her, never a metre away from her head
    // her head tops out at about 1.40, so an aim between her waist and just over her head is on her
    // (while she is circling, the aim follows her instead of the couple -- that is the point of the shot)
    const toLook = Math.hypot(shot.look.x - HERE.x, shot.look.z - HERE.z);
    const onFairy = Math.hypot(shot.look.x - FAIRY.x, shot.look.z - FAIRY.z) < 0.6 || shot.look.y > 1.9;
    if (!onFairy) assert.ok(toLook < 1.1, `the camera looks ${toLook.toFixed(2)} m to the side of her at t=${t.toFixed(2)}`);
    // the opening frames tilt up to include the fairy, but never so far that she leaves her own shot
    // (allowed a little higher while it is holding the butterfly in the top of the frame)
    assert.ok(shot.look.y > 0.85 && shot.look.y < 2.1, `aim height ${shot.look.y.toFixed(2)} at t=${t.toFixed(2)}`);
  }
});

test('the roll is a whisper, never a dutch angle', () => {
  for (let t = 0; t <= GIFT_SECONDS; t += 0.1) {
    assert.ok(Math.abs(at(t).roll) < 0.07, `roll ${at(t).roll.toFixed(3)} at t=${t.toFixed(1)}`);
  }
});

test('it works wherever they come out of the castle and whichever way they face', () => {
  const yaws = [0, 0.9, Math.PI, -2.4, 7.1];
  const base = at(6.0, { x: 0, z: 0, yaw: 0, outYaw: 0 }, { x: 1.2, y: 6.4, z: 0.6 });
  for (const yaw of yaws) {
    for (const x of [-14, 0, 9]) {
      // the film stands off along the outward axis, so a couple out in the open has one: their facing
      const couple = { x, z: 21, yaw, outYaw: yaw };
      // the butterfly's flight is built from where the couple are standing (see fairy.js beginReturn), so she is
      // always the same distance from them: that is what makes this framing rigid
      const nearFairy = { x: x + 1.2, y: 6.4, z: 21 + 0.6 };
      const p = at(6.0, couple, nearFairy);
      // the framing is rigid: distance from her is the same everywhere, only rotated
      const d = Math.hypot(p.position.x - x, p.position.z - 21);
      const dBase = Math.hypot(base.position.x, base.position.z);
      assert.ok(Math.abs(d - dBase) < 0.02, `framing at yaw=${yaw} x=${x} is ${d.toFixed(2)} vs ${dBase.toFixed(2)}`);
      assert.ok(Number.isFinite(p.position.y) && Number.isFinite(p.look.x), 'no NaN out here');
    }
  }
});

test('it survives a missing fairy and a necklace still in the box', () => {
  for (let t = 0; t <= GIFT_SECONDS; t += 0.25) {
    const shot = giftCamera(t, HERE, null, null, {});
    for (const v of [shot.position.x, shot.position.y, shot.position.z, shot.look.x, shot.look.y, shot.look.z, shot.roll, shot.closeness]) {
      assert.ok(Number.isFinite(v), `finite at t=${t.toFixed(2)}`);
    }
  }
});

test('it writes into the object it is handed, so the loop allocates nothing', () => {
  const out = { position: { x: 9, y: 9, z: 9 } };
  const same = giftCamera(4.0, HERE, FAIRY, NECK, out);
  assert.equal(same, out, 'the same object comes back');
  assert.notEqual(out.position.x, 9, 'and it was filled in');
});

test('the camera never goes inside the castle walls, and the wall check can only pull it in', async () => {
  // The scene starts in the castle's mouth, so a move composed purely "around her" is a move through stone:
  // measured, a sixth of the film was inside the walls, starting at 0.8 s. Two things keep it out -- the
  // composition stands off on the outward axis, and the pose is then checked against the game's own collision
  // function and shortened along its own aim if it is not clear. This checks both.
  const { isSolid } = await import('../src/controls.js');
  const solid = (x, y, z) => isSolid(x, y, z, 0.22);
  const cases = [
    { name: 'out of the door', x: 0, z: 1.6, yaw: 0, outYaw: 0, follow: { x: 0, y: 3.70, z: -3.33 } },
    { name: 'on the steps', x: 0, z: 3.0, yaw: 0, outYaw: 0, follow: { x: 0, y: 4.6, z: -0.9 } },
    { name: 'out at an angle (left)', x: -1.2, z: 2.2, yaw: 0.2, outYaw: 0, follow: { x: -5.5, y: 3.2, z: -1.0 } },
    { name: 'out at an angle (right)', x: 1.1, z: 2.4, yaw: -0.3, outYaw: 0, follow: { x: 6.0, y: 3.3, z: -0.4 } },
    { name: 'out in the garden', x: 0, z: 12, yaw: 0, outYaw: 0, follow: { x: 0, y: 3.7, z: 7.07 } },
    { name: 'facing the castle, walking back', x: 0, z: 8, yaw: Math.PI, outYaw: Math.PI, follow: { x: 0, y: 3.7, z: 12.9 } },
  ];
  for (const c of cases) {
    const couple = { x: c.x, z: c.z, yaw: c.yaw, outYaw: c.outYaw, neckY: 1.14, focusY: 1.70, follow: c.follow };
    for (let i = 0; i <= 60 * GIFT_SECONDS; i += 1) {
      const t = i / 60;
      // the ends are the walking camera's own pose, which lives inside the hall and is the game's own camera
      if (t < 1.2 || t > GIFT_SECONDS - 0.6) continue;
      const frame = giftCamera(t, couple, null, null, {});
      const clear = keepCameraClear(frame.position, frame.look, solid, {});
      assert.ok(!solid(clear.x, clear.y, clear.z),
        `the camera is inside stone at t=${t.toFixed(2)} in "${c.name}" (x ${clear.x.toFixed(2)}, z ${clear.z.toFixed(2)})`);
      // it may shorten the shot, but it may never move it somewhere else: the cleared pose is on the same
      // line, between the aim point and where the shot wanted to stand
      const d0 = Math.hypot(frame.position.x - frame.look.x, frame.position.y - frame.look.y, frame.position.z - frame.look.z);
      const d1 = Math.hypot(clear.x - frame.look.x, clear.y - frame.look.y, clear.z - frame.look.z);
      assert.ok(d1 <= d0 + 1e-6, `the wall check pushed the camera out at t=${t.toFixed(2)}`);
      const cross = (frame.position.x - frame.look.x) * (clear.z - frame.look.z) - (frame.position.z - frame.look.z) * (clear.x - frame.look.x);
      assert.ok(Math.abs(cross) < 0.02 * Math.max(1, d0), `the wall check swung the camera sideways at t=${t.toFixed(2)}`);
    }
  }
});

test('the butterfly is in the frame while she is the subject, and the couple never leave it', () => {
  // The shot is *about* the butterfly, so she has to be in the picture while she presents the box and circles --
  // and the couple have to stay in it too, or the film is of two people's backs. The camera cannot simply point
  // at her: she circles 2 m to their side, which is what put them out of the bottom of the frame.
  const cam = { x: 0, y: 3.70, z: 12.4 + 4.93 };
  const couple = { ...HERE, follow: cam };
  const v = new THREE.Vector3();
  const ndc = (p) => {
    v.set(p.x, p.y, p.z).project(proj);
    return { x: v.x, y: v.y, z: v.z };
  };
  const proj = new THREE.PerspectiveCamera(55, 16 / 9, 0.05, 400);
  const inFrame = (p) => {
    const n = ndc(p);
    return n.z > 0 && n.z < 1 && Math.abs(n.x) <= 1 && Math.abs(n.y) <= 1;
  };
  // her real flight, so the framing is tested against what she actually does
  const scene = new THREE.Scene();
  const fairy = withCanvas(() => createFairy(scene));
  fairy.beginReturn({ x: HERE.x, z: HERE.z + 0.2 });
  const dt = 1 / 60;
  let clock = 0;
  for (let t = 0; t <= GIFT_SECONDS; t += 0.5) {
    while (clock < t) { clock += dt; fairy.update(clock, dt, 1, true, proj); }
    const frame = giftCamera(t, couple, fairy.returning ? fairy.position : null, null, {});
    proj.position.set(frame.position.x, frame.position.y, frame.position.z);
    proj.lookAt(frame.look.x, frame.look.y, frame.look.z);
    proj.updateMatrixWorld(true);
    if (t >= 2.6 && t <= 9.2) {
      assert.ok(inFrame(fairy.position), `the butterfly is out of frame at t=${t.toFixed(1)}`);
      assert.ok(inFrame({ x: HERE.x, y: HERE.neckY + 0.2, z: HERE.z }), `the couple are out of frame at t=${t.toFixed(1)}`);
    }
  }
});
