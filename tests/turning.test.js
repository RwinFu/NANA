import test from 'node:test';
import assert from 'node:assert/strict';
import { createCouple } from '../src/characters.js';

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
