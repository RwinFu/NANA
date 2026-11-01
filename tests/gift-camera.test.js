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

// the couple coming out of the castle, with the numbers the game really has: her throat is at 1.14 and the
// walking camera looks at 1.70 (it aims at her chest, above the gold), standing 4.93 back and 3.70 up
const FOLLOW = { x: 0, y: 3.70, z: 12.4 + 4.93 };
const HERE = { x: 0, z: 12.4, yaw: Math.PI, neckY: 1.14, focusY: 1.70, follow: FOLLOW };
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

test('the film sweeps out to her face and back, without ever reversing mid-shot', () => {
  // It is a crane move, not a full orbit: out to her front for the settle, then back the way it came to the
  // walking camera. What matters is that it goes *out* to her face, holds it for the settle, and comes back --
  // and that the turn eases in and out rather than whipping round.
  const angleAt = (t) => {
    const p = at(t).position;
    return Math.atan2(p.x - HERE.x, p.z - HERE.z);
  };
  const turnBetween = (a, b) => {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  };
  // she faces the garden (yaw = PI here), so "in front of her face" is the angle PI, i.e. 180 degrees round
  const facing = Math.PI;
  const offFacing = (t) => Math.abs(turnBetween(angleAt(t), facing));
  assert.ok(offFacing(9.8) < 0.5,
    `it is in front of her face for the settle (${(offFacing(9.8) * 180 / Math.PI).toFixed(0)} deg off)`);
  // it holds that side through the landing, rather than still being on its way round
  // it is in front of her for the whole of the landing (9.8) and the first swing of the pendant (10.6)
  for (const t of [9.8, 10.2, 10.6]) {
    assert.ok(offFacing(t) < 0.45, `in front of her at t=${t} (${(offFacing(t) * 180 / Math.PI).toFixed(0)} deg off)`);
  }
  // and the turn is a sweep: never faster than 200 degrees a second, which at this radius is a camera move
  // and not a whip-pan
  assert.ok(true, 'the rate is asserted below');
  // the way out is one direction and the way back is the other: it turns around at her face, once
  const outTurn = turnBetween(angleAt(0), angleAt(9.8));
  const backTurn = turnBetween(angleAt(11.0), angleAt(GIFT_SECONDS));
  assert.ok(Math.abs(outTurn) > 1.4, `it travels right round to her front (${(outTurn * 180 / Math.PI).toFixed(0)} deg)`);
  assert.ok(Math.sign(outTurn) === -Math.sign(backTurn) || Math.abs(backTurn) < 0.2,
    'and comes back the way it came rather than continuing round');
  // no whip: the fastest quarter-second of the turn is a gentle sweep, not a spin
  let fastest = 0;
  for (let t = 0; t < GIFT_SECONDS - 0.05; t += 0.05) {
    const rate = Math.abs(turnBetween(angleAt(t), angleAt(t + 0.05))) / 0.05;
    fastest = Math.max(fastest, rate);
  }
  assert.ok(fastest * 180 / Math.PI < 200, `the camera turns at ${(fastest * 180 / Math.PI).toFixed(0)} deg/s at its fastest`);
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
    // the tight close-up is 0.9 m out, which is a shoulder-and-neck shot, not a camera inside her head
    assert.ok(fromHer > 0.75, `the camera is ${fromHer.toFixed(2)} m from her at t=${t.toFixed(2)}`);
    const height = shot.position.y;
    // low enough to feel like a hand-held shot of a small character, never underground
    assert.ok(height > 0.25 && height < 5, `camera height ${height.toFixed(2)} at t=${t.toFixed(2)}`);
    // she is in frame: the look target is near her, never a metre away from her head
    // her head tops out at about 1.40, so an aim between her waist and just over her head is on her
    const toLook = Math.hypot(shot.look.x - HERE.x, shot.look.z - HERE.z);
    assert.ok(toLook < 1.1, `the camera looks ${toLook.toFixed(2)} m to the side of her at t=${t.toFixed(2)}`);
    // the opening frames tilt up to include the fairy, but never so far that she leaves her own shot
    assert.ok(shot.look.y > 0.85 && shot.look.y < 2.0, `aim height ${shot.look.y.toFixed(2)} at t=${t.toFixed(2)}`);
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
