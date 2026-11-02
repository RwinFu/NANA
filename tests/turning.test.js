import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCouple } from '../src/characters.js';
import { createControls } from '../src/controls.js';

// What went wrong before: the walk controls snapped `playerModel.rotation.y` at `dt * 12`, which is 18 degrees
// in the very first frame at 60 fps (36 at 30), at a constant rate, with the turn finished in 183 ms. Every
// change of direction looked like a turntable. These tests hold the rig to a bell curve instead: the first
// frame of a turn is the slowest, the peak is a fraction of what it was, and the whole turn takes long enough
// to read.
//
// They run the real `animate`, never a hand-built pose.

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
  const never = new Promise(() => {});
  globalThis.document = { createElement: () => stubCanvas(), fonts: { ready: never, load: () => never } };
  try { return fn(); } finally { globalThis.document = previous; }
}

const step = 1 / 60;
const deg = (rad) => (Math.abs(rad) * 180) / Math.PI;
const arc = (a, b) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

// Ask her to face a new way on frame `from` and record how far she is drawn turning on every frame
function turn(yaw, from = 10, frames = 120) {
  const hero = withCanvas(() => createCouple('#ff758f'));
  hero.root.position.set(0, 0, 0);
  const drawn = [];
  for (let i = 0; i < from + frames; i++) {
    hero.setFacing(i < from ? 0 : yaw);
    hero.animate(step, i * step, false, false);
    drawn.push(hero.drawnFacing());
  }
  const perFrame = drawn.slice(1).map((d, i) => deg(arc(drawn[i], d))).slice(from - 1);
  return { hero, drawn, perFrame, from };
}

test('a quarter turn is eased, not snapped: the first frame is the slowest', () => {
  const { perFrame } = turn(Math.PI / 2);
  const first = perFrame[0];
  const peak = Math.max(...perFrame);
  assert.ok(first < peak * 0.5, `the first frame of the turn is slow (${first.toFixed(1)} vs peak ${peak.toFixed(1)} deg)`);
  assert.ok(first < 4, `and no more than a few degrees: ${first.toFixed(1)}`);
  // it ramps up over the first few frames rather than jumping to full speed
  assert.ok(perFrame[1] > perFrame[0] && perFrame[2] > perFrame[1], 'the turn accelerates into itself');
});

test('no single frame turns more than about a tenth of a right angle', () => {
  const { perFrame } = turn(Math.PI / 2);
  const peak = Math.max(...perFrame);
  assert.ok(peak < 9, `peak is ${peak.toFixed(1)} deg/frame, was 18 before the rework`);
});

test('a quarter turn takes about a third of a second, long enough to read', () => {
  const { drawn, from } = turn(Math.PI / 2);
  const settled = drawn.findIndex((d, i) => i > from && deg(Math.PI / 2 - d) < 2);
  assert.ok(settled > from, 'it settles');
  const ms = (settled - from) * step * 1000;
  assert.ok(ms > 260 && ms < 520, `a ninety degree turn takes ${ms.toFixed(0)} ms, was 183`);
});

test('the drawn heading converges on the heading she is really walking', () => {
  const { hero, drawn, from } = turn(Math.PI / 2);
  // setFacing is the truth; once the turn is over the two agree exactly, so nothing accumulates error
  for (let i = from + 40; i < drawn.length; i++) {
    assert.ok(deg(arc(Math.PI / 2, drawn[i])) < 0.5, `frame ${i} is ${deg(arc(Math.PI / 2, drawn[i])).toFixed(2)} deg off`);
  }
  hero.setFacing(-Math.PI / 2);
  hero.animate(step, 99, false, false);
  assert.equal(hero.facing(), -Math.PI / 2);
});

test('the turn goes the short way round, and a hairpin is not a pirouette', () => {
  // facing almost straight back: the short way is a few degrees, the long way is a full spin
  const hero = withCanvas(() => createCouple('#ff758f'));
  hero.root.position.set(0, 0, 0);
  let worst = 0;
  for (let i = 0; i < 120; i++) {
    const yaw = i < 10 ? Math.PI / 2 : Math.PI / 2 + Math.PI - 0.2;
    hero.setFacing(yaw);
    hero.animate(step, i * step, false, false);
    const lag = deg(arc(yaw, hero.drawnFacing()));
    if (i > 10) worst = Math.max(worst, lag);
  }
  assert.ok(worst <= 180.5, `she never ends up more than half a turn away: ${worst.toFixed(1)} deg`);
  // and once settled she is on the new facing, not the old one plus a spin
  assert.ok(deg(arc(Math.PI / 2 + Math.PI - 0.2, hero.drawnFacing())) < 1, 'she ends on the requested facing');
});

test('a turn on the spot steps her feet instead of pivoting like a statue', () => {
  const standing = withCanvas(() => createCouple('#ff758f'));
  const turning = withCanvas(() => createCouple('#ff758f'));
  for (const hero of [standing, turning]) hero.root.position.set(0, 0, 0);
  const legZ = hero => {
    let z = 0;
    hero.root.traverse((o) => { if (o.isMesh) z += Math.abs(o.rotation.z); });
    return z;
  };
  let stillSum = 0;
  let turnSum = 0;
  for (let i = 0; i < 40; i++) {
    standing.setFacing(0);
    standing.animate(step, i * step, false, false);
    turning.setFacing(i < 5 ? 0 : Math.PI / 2);
    turning.animate(step, i * step, false, false);
    if (i > 8) { stillSum += legZ(standing); turnSum += legZ(turning); }
  }
  assert.ok(turnSum > stillSum, 'the turn moves the rig: her skirt and arms swing through it');
});

test('the boy turns with the same ease, and still stands beside her', () => {
  const hero = withCanvas(() => createCouple('#ff758f'));
  hero.root.position.set(0, 0, 0);
  const boy = hero.root.getObjectByName('boy');
  assert.ok(boy, 'the boy is in the rig');
  let worst = 0;
  let prev = null;
  const at = new (boy.position.constructor)();
  for (let i = 0; i < 200; i++) {
    const yaw = i < 10 ? 0 : Math.PI;
    hero.setFacing(yaw);
    hero.animate(step, i * step, false, false);
    hero.root.updateMatrixWorld(true);
    const local = boy.position;
    at.copy(local);
    assert.ok(Number.isFinite(at.x) && Number.isFinite(at.z), 'he is placed');
    const d = Math.hypot(at.x, at.z);
    if (i > 20) assert.ok(d > 0.3 && d < 2.0, `he stands beside her: ${d.toFixed(2)} m away on frame ${i}`);
    if (prev !== null && i > 10) worst = Math.max(worst, deg(arc(prev, boy.rotation.y)));
    prev = boy.rotation.y;
  }
  assert.ok(worst < 12, `his own facing is eased too: peak ${worst.toFixed(1)} deg/frame`);
});

// The bug this catches: controls.js was handed hero.root as its model, so setFacing was never called and she
// was never turned at all -- she walked in the direction the sticks pointed with the model still facing the way
// it started. The guard clause made that silent, so it has to be tested by walking her, not by reading source.
test('the walk controls really turn her: setFacing is reached from the model they are given', () => {
  const hero = withCanvas(() => createCouple('#ff758f'));
  assert.equal(typeof hero.setFacing, 'function', 'the model object carries setFacing');
  assert.equal(typeof hero.root.setFacing, 'undefined', 'the bare Object3D does not -- passing it is the bug');
  // what the game passes as playerModel must be the object with the method, so drive her the way it does
  hero.root.position.set(0, 0, 0);
  for (let i = 0; i < 10; i++) { hero.setFacing(0); hero.animate(step, i * step, false, false); }
  for (let i = 0; i < 40; i++) { hero.setFacing(Math.PI); hero.animate(step, (10 + i) * step, false, false); }
  assert.ok(deg(arc(Math.PI, hero.root.rotation.y)) < 1,
    `after being handed a new facing her model is drawn on it: ${deg(arc(Math.PI, hero.root.rotation.y)).toFixed(1)} deg off`);
  assert.equal(hero.root.rotation.y.toFixed(3), hero.drawnFacing().toFixed(3), 'and the drawn object follows the rig');
});

test('the boy leans into his own turn and leads it with his head', () => {
  const hero = withCanvas(() => createCouple('#ff758f'));
  hero.root.position.set(0, 0, 0);
  const boy = hero.root.getObjectByName('boy');
  // his body group is the one the head sphere is parented to
  let boyBody = null;
  boy.traverse((o) => { if (o.isMesh && Math.abs(o.position.y - 1.75) < 1e-6) boyBody = o.parent; });
  assert.ok(boyBody && boyBody.isGroup, 'found the boy body group');
  const head = boyBody.children.find((o) => o.isMesh && o.geometry?.type === 'SphereGeometry');
  assert.ok(head, 'and his head');

  let lean = 0;
  let headMax = 0;
  for (let i = 0; i < 100; i++) {
    hero.setFacing(i < 10 ? 0 : Math.PI);
    hero.animate(step, i * step, false, false);
    if (i > 10) {
      lean = Math.max(lean, Math.abs(boyBody.rotation.z));
      headMax = Math.max(headMax, Math.abs(head.rotation.y));
    }
    assert.ok(Number.isFinite(boyBody.rotation.z) && Number.isFinite(head.rotation.y), `frame ${i} is finite`);
  }
  assert.ok(lean > 0.01, `he leans into the turn: ${lean.toFixed(3)} rad`);
  assert.ok(lean < 0.2, `and not over: ${lean.toFixed(3)} rad`);
  assert.ok(headMax > 0.02, `his head leads it: ${headMax.toFixed(3)} rad`);
});

// End to end, through the real walk controls and the real rig, wired exactly as main.js wires them. Written
// because the first attempt at the turn shipped with `playerModel: hero.root`: setFacing lives on the model
// object, not on its root, so the guard clause swallowed it and she was never turned at all.
function wired() {
  const hero = withCanvas(() => createCouple('#ff758f'));
  // the controls walk her from the level's spawn, so displacement is measured from wherever she starts
  const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.05, 400);
  camera.position.set(0, 3, 12);
  const canvas = {
    addEventListener() {}, removeEventListener() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1600, height: 900 }),
    setPointerCapture() {}, releasePointerCapture() {}, style: {},
  };
  // the controls listen on window for the keyboard
  const previousWindow = globalThis.window;
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  let controls;
  try {
    controls = createControls({
      camera, canvas, player: hero.root, playerModel: hero, isBlocked: () => false, onTapFrame: () => {},
    });
  } finally {
    globalThis.window = previousWindow;
  }
  const run = (frames, from, moving = true) => {
    for (let i = 0; i < frames; i++) {
      controls.update(step);
      hero.animate(step, (from + i) * step, moving && controls.moving, controls.airborne);
    }
  };
  return { hero, controls, run };
}

test('given the model object, the walk controls turn her and she goes where the stick points', () => {
  const { hero, controls, run } = wired();
  controls.setJoystick(0, 0, false);
  run(1, 0);                       // one frame first: the controls place her at the level's spawn
  const start = hero.root.position.clone();
  controls.setJoystick(1, 1, true);
  run(90, 1);
  assert.ok(controls.moving, 'she is walking');
  const walkedBy = hero.root.position.clone().sub(start);
  const heading = hero.facing();
  // the true heading, what the object is drawn at, and what the game reads for the camera must agree
  assert.ok(deg(arc(heading, hero.root.rotation.y)) < 1, 'the drawn facing is the true heading');
  // she walked, and she walked the way she is facing: the displacement and the heading agree
  const walked = Math.hypot(walkedBy.x, walkedBy.z);
  assert.ok(walked > 3, `she walked ${walked.toFixed(1)} m`);
  const alongHeading = walkedBy.x * Math.sin(heading) + walkedBy.z * Math.cos(heading);
  assert.ok(alongHeading / walked > 0.95,
    `her path is along her heading, not sideways: ${(alongHeading / walked).toFixed(3)}`);
  assert.equal(hero.root.rotation.y.toFixed(3), hero.drawnFacing().toFixed(3));
});

test('the film lock freezes her, and a stick held through it is not replayed at her', () => {
  const { hero, controls, run } = wired();
  controls.setJoystick(1, 1, true);
  run(60, 0);
  controls.setJoystick(0, 0, false);
  const at = hero.root.position.clone();

  controls.setFilmRunning(true);
  controls.setJoystick(1, 1, true); // pushed during the film
  run(60, 60);
  assert.ok(hero.root.position.distanceTo(at) < 1e-6, 'she does not move during the film');

  controls.setFilmRunning(false);
  run(30, 120);
  assert.ok(hero.root.position.distanceTo(at) < 1e-6, 'and the stale stick is not replayed when it ends');

  controls.setJoystick(0, 0, false);
  controls.setJoystick(1, 1, true); // a fresh push
  run(40, 150);
  assert.ok(hero.root.position.distanceTo(at) > 0.5, `a fresh push walks her again: ${hero.root.position.distanceTo(at).toFixed(2)} m`);
});
