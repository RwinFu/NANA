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
import { GIFT_SHOTS, giftCamera, giftCameraBlend, giftShot } from '../src/gift-camera.js';

const HERE = { x: 0, z: 12.4, yaw: Math.PI }; // the couple coming out of the castle, facing the camera
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
  assert.ok(worstP < 0.2, `largest step is ${worstP.toFixed(3)} m at t=${worstT.toFixed(2)}`);
  assert.ok(worstL < 0.5, `largest look step is ${worstL.toFixed(3)} m`);
});

test('the film ends exactly where the walking camera stands, so handing back travels nowhere', () => {
  const yaw = Math.PI;
  // the follow camera: 4.3 m behind her, 2.6 m up, looking at her chest
  const end = at(GIFT_SECONDS + 0.5);
  const follow = { x: 0, y: 2.6, z: 12.4 + 4.3 };
  assert.ok(dist(end.position, follow) < 0.05, `ends ${dist(end.position, follow).toFixed(3)} m from the follow camera`);
  assert.ok(Math.abs(end.look.y - 1.45) < 0.02, 'looking at her chest, as the follow camera does');
  // and the very last frame of the scene is already there, not on its way there
  const last = at(GIFT_SECONDS);
  assert.ok(dist(last.position, follow) < 0.12, `the last frame is ${dist(last.position, follow).toFixed(3)} m off`);
  void yaw;
});

test('it blends in and out, and is off at both ends', () => {
  assert.equal(giftCameraBlend(0), 0, 'the walking camera owns the first frame');
  assert.equal(giftCameraBlend(0.3) < 0.5, true, 'and is handed over within a beat');
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
    assert.ok(fromHer > 0.9, `the camera is ${fromHer.toFixed(2)} m from her at t=${t.toFixed(2)}`);
    const height = shot.position.y;
    assert.ok(height > 0.8 && height < 5, `camera height ${height.toFixed(2)} at t=${t.toFixed(2)}`);
    // she is in frame: the look target is near her, never a metre away from her head
    const toLook = Math.hypot(shot.look.x - HERE.x, shot.look.y - 1.5, shot.look.z - HERE.z);
    assert.ok(toLook < 1.4, `the camera looks ${toLook.toFixed(2)} m off her at t=${t.toFixed(2)}`);
  }
});

test('the roll is a whisper, never a dutch angle', () => {
  for (let t = 0; t <= GIFT_SECONDS; t += 0.1) {
    assert.ok(Math.abs(at(t).roll) < 0.07, `roll ${at(t).roll.toFixed(3)} at t=${t.toFixed(1)}`);
  }
});

test('it works wherever they come out of the castle and whichever way they face', () => {
  const yaws = [0, 0.9, Math.PI, -2.4, 7.1];
  const base = at(6.0, { x: 0, z: 0, yaw: 0 });
  for (const yaw of yaws) {
    for (const x of [-14, 0, 9]) {
      const couple = { x, z: 21, yaw };
      const p = at(6.0, couple);
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
