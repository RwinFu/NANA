// The camera for the present: one continuous orbit around the couple, written as plain maths so the framing
// can be checked without a renderer.
//
// The rule is "no cuts, and never a flight". An earlier version listed each shot as an independent formula and
// then blended into the first one from wherever the walking camera happened to be: because the walking camera
// stands behind her and the film wanted to be in front of her, the opening frames swept six metres sideways,
// which is the "buggy" part. This version starts *on* the walking camera and turns around her once.
//
//   find   0.0 - 2.6  starts behind her at the walking camera's own place and swings round her left side,
//                     dropping low, until she and the descending fairy are both in frame
//   wide   2.6 - 5.4  settles low in front of her and pushes in a little: the box opens in this shot
//   rise   5.4 - 9.0  climbs with the gold, closing in as it rises
//   close  9.0 - 10.4 tight and low on her throat, for the moment the necklace settles
//   (out) 10.4 - 12.5 the orbit pulls out and round her back to exactly where the walking camera stands
//
// Everything is expressed in *her* frame -- angle around her, radius, height above her throat -- and anchored
// on the walking camera's pose, so it works wherever the player came out of the castle and however they had
// swung the camera. The turn is monotonic, so the camera never reverses and never crosses her.

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

// A value along a keyed path, eased between keys. Written as flat pairs of numbers, so a frame allocates
// nothing: this runs inside the render loop of a game that has already been optimised once for frame time.
function keyed(keys, t) {
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

// How much of the pose is "the walking camera's own" rather than the film's: 1 at both ends, 0 in between.
// This is what makes the hand-over and the hand-back free: at t = 0 and t = GIFT_SECONDS the values below are
// *exactly* the follow camera's, not an approximation of them.
const FOLLOW_WEIGHT = [[0, 1], [1.15, 0], [11.5, 0], [GIFT_SECONDS, 1]];
// How the orbit is shaped. It cannot be "turn 200 degrees": where her face is depends on where the player's
// camera happened to be pointing when they walked out, so the turn is computed from the follow camera's own
// angle, and it is aimed at one thing -- being in front of her face when the necklace lands.
//
// An earlier version used fixed turn counts and filmed the *back of her head* for the climactic close-up, which
// is exactly what it looked like.
const SETTLE_AT = 9.6; // the necklace is hers from 9.8; be in front of her before that
const TURN_FRONT_DEG = 8; // very slightly off dead-on: enough to keep a cheek, not enough to hide the gold
// the shape of the turn out to her front (0 = follow camera, 1 = in front of her)
const OUT_KEYS = [[0, 0], [0.28, 0.60], [0.55, 0.84], [1, 1]];
// ... and the shape of the rest of the move, back round to the walking camera. It holds her front until the
// necklace has finished settling (11.6), which is the moment the shot exists for.
const SETTLE_END = 10.6;
const BACK_KEYS = [[0, 0], [0.30, 0.14], [0.66, 0.62], [1, 1]];
// Metres out from her. The tightest point is at the settle (9.8 - 11.6), not after it: the close-up has to
// happen while the necklace is going on, which is the whole point of the shot.
const RADIUS = [[0, 5.6], [2.6, 5.6], [5.4, 4.1], [7.6, 2.9], [9.8, 1.5], [10.7, 0.9], [11.6, 1.9], [12.15, 3.9], [GIFT_SECONDS, 4.93]];
// Height above her throat: a low, looking-up opening, rising with the gold, then level with the gold itself.
const HEIGHT = [[0, -0.55], [2.6, -0.52], [5.4, -0.34], [7.6, -0.06], [9.8, 0.24], [10.7, 0.26], [11.6, 0.55], [12.15, 2.2], [GIFT_SECONDS, 2.56]];
// What it is pointed at, in the same terms: how far in front of her and how high above her throat.
const LOOK_FORWARD = [[0, 0.6], [2.6, 0.55], [5.4, 0.55], [7.6, 0.4], [9.8, 0.14], [10.7, 0.17], [11.6, 0.14], [GIFT_SECONDS, 0]];
const LOOK_ABOVE = [[0, 0.50], [2.6, 0.22], [5.4, 0.26], [7.6, 0.18], [9.8, -0.05], [10.7, -0.09], [11.6, 0.06], [GIFT_SECONDS, 0.56]];
// How close the shot is, for the vignette: 0 is the walking camera's own view.
const CLOSENESS = [[0, 0], [5.4, 0], [7.6, 0.35], [9.8, 0.7], [10.7, 0.95], [11.6, 0.8], [12.2, 0.1], [GIFT_SECONDS, 0]];
// A whisper of tilt for the close shot, in radians, eased to zero at both ends.
const ROLL = [[0, 0], [5.4, 0], [9.0, -0.015], [10.7, -0.05], [12.0, 0], [GIFT_SECONDS, 0]];

const mix = (a, b, w) => a + (b - a) * w;

// The couple's own frame: where she faces, and her right hand side.
function frameOf(couple) {
  const yaw = couple.yaw;
  const fx = Math.sin(yaw); // the model's +z, rotated
  const fz = Math.cos(yaw);
  return { x: couple.x, z: couple.z, fx, fz, rx: Math.cos(yaw), rz: -Math.sin(yaw) };
}

// One frame of the film.
//
// `couple` is { x, z, yaw, neckY, focusY, follow }: her throat's height, the walking camera's aim, and the
// walking camera's own position this frame (which the film starts and ends on). `fairy` is a world position or
// null; `neck` is unused (the aim is authored, not chased). Returns the camera position, the look target, a
// mild roll in radians, a 0..1 `closeness` for the caller's vignette, and the shot's name.
export function giftCamera(t, couple, fairy, neck, out = {}) {
  void neck;
  void fairy;
  const f = frameOf(couple);
  const shot = giftShot(t);
  const neckY = couple.neckY ?? 1.14;
  const follow = couple.follow ?? null;
  const focusY = couple.focusY ?? neckY + 0.56;

  // where the walking camera is, in her frame: how far round, how far out, how high
  let followAngle = Math.PI;
  let followRadius = 4.93;
  let followHeight = neckY + 1.0;
  if (follow) {
    const dx = follow.x - f.x;
    const dz = follow.z - f.z;
    followRadius = Math.hypot(dx, dz);
    followHeight = follow.y;
    // angle measured from her facing, turning the same way as the film's own TURN
    followAngle = Math.atan2(dx * f.rx + dz * f.rz, dx * f.fx + dz * f.fz);
  }

  const w = keyed(FOLLOW_WEIGHT, t);
  // Turn, in degrees, from where the walking camera is: out to her face, hold it for the settle, then one
  // continuous sweep back round to the walking camera's own angle. Monotonic, and exactly 360 in total.
  const front = TURN_FRONT_DEG - (followAngle * 180) / Math.PI;
  let toFront = ((front % 360) + 360) % 360;
  if (toFront > 180) toFront -= 360; // the short way round, whichever side the player's camera is on
  // Out to her face, then back the way it came: a crane move, not a full orbit. Both legs ease from and to a
  // standstill, so the turnaround at her face is a camera settling and starting again, never a whip-pan.
  const turn = t <= SETTLE_AT
    ? toFront * keyed(OUT_KEYS.map(([a, b]) => [a * SETTLE_AT, b]), t)
    : toFront * (1 - keyed(BACK_KEYS.map(([a, b]) => [SETTLE_END + a * (GIFT_SECONDS - SETTLE_END), b]), t));
  const angle = followAngle + (turn * Math.PI) / 180;
  const radius = mix(keyed(RADIUS, t), followRadius, w);
  const height = mix(neckY + keyed(HEIGHT, t), followHeight, w);
  const forward = Math.cos(angle) * radius;
  const side = Math.sin(angle) * radius;

  const P = {
    x: f.x + f.fx * forward + f.rx * side,
    y: height,
    z: f.z + f.fz * forward + f.rz * side,
  };
  const lookFwd = mix(keyed(LOOK_FORWARD, t), 0, w);
  const lookY = mix(neckY + keyed(LOOK_ABOVE, t), focusY, w);
  const L = {
    x: f.x + f.fx * lookFwd,
    y: lookY,
    z: f.z + f.fz * lookFwd,
  };

  // A whisper of handheld drift, so the frame is not mathematically still -- but faded out at both ends, so it
  // cannot fight the exact match with the walking camera where the film begins and ends.
  const drift = (0.010 + 0.018 * keyed(CLOSENESS, t)) * (1 - w);
  P.x += Math.sin(t * 1.7) * drift + Math.sin(t * 3.1 + 1.1) * drift * 0.4;
  P.y += Math.sin(t * 1.3 + 0.7) * drift * 0.8;
  P.z += Math.cos(t * 1.5 + 2.2) * drift;

  out.position = P;
  out.look = L;
  out.roll = keyed(ROLL, t) * (1 - w);
  out.closeness = keyed(CLOSENESS, t) * (1 - w);
  out.shot = shot;
  return out;
}

// How much of the film owns the camera: 0 is the walking camera, 1 is the film. Because the film's own pose is
// the walking camera's pose at both ends, this only has to be a smooth 0..1; it no longer has to hide travel.
export function giftCameraBlend(t) {
  const into = smooth(t / 0.5);
  const outOf = 1 - smooth((t - (GIFT_SECONDS - 0.6)) / 0.6);
  return Math.min(into, outOf);
}
