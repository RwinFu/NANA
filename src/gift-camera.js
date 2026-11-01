// The camera for the present: one continuous four-shot move, written as plain maths so the framing can be
// checked without a renderer.
//
// The rule this obeys is "no cuts". A twelve-second scene can afford two hard cuts and they would look
// like a glitch in a game where the camera is otherwise always the same follow camera; so the camera
// *travels*, and every shot's end pose is the next shot's start pose. The beats:
//
//   find   0.0 - 2.6  wide and low in front of the couple, tilted up: the fairy comes down into the frame
//   wide   2.6 - 5.4  push in a little, level: the couple, the fairy and the open box in one shot
//   rise   5.4 - 9.0  closer and climbing with the gold, so the rise is felt rather than watched
//   close  9.0 - 12.5 tight on her throat for the settle, then a slow orbit round her that ends exactly
//                     where the walking camera stands, so the hand-back has nothing to travel
//
// Positions are rebuilt every frame from the couple's current place and heading, so the film works
// wherever they happen to come out of the castle.

import { GIFT_SECONDS } from './gift.js';

export const GIFT_SHOTS = [
  { name: 'find', from: 0.0, to: 2.6 },
  { name: 'wide', from: 2.6, to: 5.4 },
  { name: 'rise', from: 5.4, to: 9.0 },
  { name: 'close', from: 9.0, to: GIFT_SECONDS },
];

export function giftShot(t) {
  const time = Math.max(0, t);
  for (const shot of GIFT_SHOTS) {
    if (time < shot.to) return shot.name;
  }
  return 'out';
}

const smooth = (x) => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};
const clamp01 = (x) => Math.min(1, Math.max(0, x));

// The couple's own frame: where she faces, and her right hand side.
function frameOf(couple) {
  const yaw = couple.yaw;
  const fx = Math.sin(yaw); // the model's +z, rotated
  const fz = Math.cos(yaw);
  return { x: couple.x, z: couple.z, fx, fz, rx: Math.cos(yaw), rz: -Math.sin(yaw) };
}

// A value along a keyed path, eased between keys. The look target and the vignette dial are written this
// way, rather than as one formula per shot, because a formula per shot is what produces jumps at the
// boundaries: two shots can agree about where the camera stands and disagree about what it is pointed at.
function path(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, v0] = keys[i - 1];
      const [t1, v1] = keys[i];
      const k = t1 === t0 ? 1 : smooth((t - t0) / (t1 - t0));
      return v0 + (v1 - v0) * k;
    }
  }
  return keys[keys.length - 1][1];
}

// What the film is looking at: how far in front of her, and how high. Keyed on the shot boundaries, so
// find's last value *is* wide's first value, and so on to the follow camera's own aim at the end.
const LOOK_FORWARD = [[0, 0.35], [2.6, 0.6], [5.4, 0.6], [9.0, 0.45], [10.3, 0.10], [GIFT_SECONDS, 0]];
const LOOK_HEIGHT = [[0, 1.55], [2.6, 1.55], [5.4, 1.67], [9.0, 1.89], [10.3, 1.47], [11.3, 1.55], [GIFT_SECONDS, 1.45]];
// How close the shot is, for the vignette: 0 is the walking camera's own view.
const CLOSENESS = [[0, 0], [5.4, 0], [7.2, 0.4], [9.0, 0.45], [10.2, 0.95], [11.1, 0.9], [12.0, 0.12], [GIFT_SECONDS, 0]];

// A point `forward` metres out and `side` metres to her right, `y` off the ground.
function beside(f, forward, side, y) {
  return {
    x: f.x + f.fx * forward + f.rx * side,
    y,
    z: f.z + f.fz * forward + f.rz * side,
  };
}

// One frame of the film.
//
// `couple` is { x, z, yaw }; `fairy` is a world position or null; `neck` is where the necklace is at this
// instant (a world point, or null while it is still in the box). Returns the camera position, the look
// target, a mild roll in radians, a 0..1 `closeness` for the caller's vignette, and the shot's name.
export function giftCamera(t, couple, fairy, neck, out = {}) {
  void neck; // the aim is authored, not tracked: chasing a moving target puts a jump in the frame
  const f = frameOf(couple);
  const shot = giftShot(t);
  let P;
  let L;
  let roll = 0;
  let closeness = 0;

  // Each shot's start pose is the pose the shot before it ended at. That is the whole trick to a cut-free
  // film: the numbers below line up on purpose, and tests/gift-camera.test.js proves they do.
  if (shot === 'find') {
    // Wide and low, in front of her, looking up: her and the fairy in the same frame, the fairy above.
    const k = smooth(t / 2.6);
    P = beside(f, 5.8 - 0.6 * k, -1.5 + 0.3 * k, 1.35 + 0.5 * k);
    // the look starts high with the fairy's descent and levels out, ending exactly on the wide shot's line
    // the look starts high with the fairy's descent and levels out; this term is exactly zero by 2.6, so it
    // cannot fight the keyed aim it hands over to
    const up = fairy ? clamp01((fairy.y - 2.2) / 8) : 0.4;
    const lift = up * 2.0 * (1 - smooth(t / 2.6));
    L = beside(f, path(LOOK_FORWARD, t), 0, path(LOOK_HEIGHT, t) + lift);
    roll = 0.03 * (1 - k);
  } else if (shot === 'wide') {
    // Push in to the couple, level with her chest: the shot that says "look at what is happening".
    const k = smooth((t - 2.6) / 2.8);
    P = beside(f, 5.2 - 1.1 * k, -1.2 + 1.85 * k, 1.85 + 0.12 * k);
    L = beside(f, path(LOOK_FORWARD, t), 0, path(LOOK_HEIGHT, t));
    roll = 0.03 * (1 - k);
  } else if (shot === 'rise') {
    // In, and climbing with the necklace. The gold leaves the top of the frame if the camera stays put, so
    // the camera goes with it.
    const k = smooth((t - 5.4) / 3.6);
    P = beside(f, 4.1 - 1.55 * k, 0.65 + 0.15 * k, 1.97 + 0.73 * k);
    L = beside(f, path(LOOK_FORWARD, t), 0, path(LOOK_HEIGHT, t));
    closeness = path(CLOSENESS, t);
    roll = -0.02 * k;
  } else if (shot === 'close') {
    // Two moves in one shot: a push in to her throat for the settle (the necklace's close-up), then a slow
    // orbit round her that lands exactly where the walking camera stands, so the hand-back is seamless.
    const push = smooth((t - 9.0) / 1.3);
    const orbit = smooth((t - 10.3) / 2.0);
    // the push-in: from the rise's last pose to a tight shot on her neck
    const nearF = 2.55 + (1.15 - 2.55) * push;
    const nearS = 0.80 + (0.16 - 0.80) * push;
    const nearY = 2.70 + (1.68 - 2.70) * push;
    // the orbit: from that tight shot round the back, out to the walking camera's distance
    const r = Math.hypot(nearF, nearS) + (4.3 - Math.hypot(nearF, nearS)) * orbit;
    const startAngle = Math.atan2(nearS / 1, nearF);
    const angle = startAngle + (Math.PI - startAngle) * orbit;
    const forward = Math.cos(angle) * r;
    const side = Math.sin(angle) * r;
    const height = nearY + (2.60 - nearY) * orbit;
    P = beside(f, forward, side, height);
    L = beside(f, path(LOOK_FORWARD, t), 0, path(LOOK_HEIGHT, t));
    closeness = path(CLOSENESS, t);
    // starts where the rise shot's roll ended (-0.02), so the tilt is inherited rather than snapped on
    roll = -0.02 * (1 - smooth((t - 9.0) / 1.2)) * (1 - orbit);
  } else {
    // 'out': exactly where the follow camera stands, one step and a half behind her.
    P = beside(f, -4.3, 0, 2.6);
    L = beside(f, path(LOOK_FORWARD, t), 0, path(LOOK_HEIGHT, t));
  }

  // A whisper of handheld drift, so the frame is not mathematically still. Small enough that it reads as
  // a steady hand and never as wobble: about a centimetre at arm's length.
  const drift = 0.012 + 0.02 * closeness;
  P.x += Math.sin(t * 1.7) * drift + Math.sin(t * 3.1 + 1.1) * drift * 0.4;
  P.y += Math.sin(t * 1.3 + 0.7) * drift * 0.8;
  P.z += Math.cos(t * 1.5 + 2.2) * drift;

  out.position = P;
  out.look = L;
  out.roll = roll;
  out.closeness = closeness;
  out.shot = shot;
  return out;
}

// How much of the film owns the camera: 0 is the walking camera, 1 is the film. On at the start over a
// beat, off at the end over the last second, so entering and leaving are moves and not cuts.
export function giftCameraBlend(t) {
  const into = smooth(t / 0.75);
  const outOf = 1 - smooth((t - (GIFT_SECONDS - 1.0)) / 1.0);
  return Math.min(into, outOf);
}
