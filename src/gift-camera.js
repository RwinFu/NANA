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
// The film is not about the couple, and it is not about the castle: it is about the butterfly.
//
// She dives in over the roof with the box, she hovers in front of them while it opens, and then she circles
// them -- once, slowly, at head height -- before she climbs away. That circle *is* the movement of the shot, so
// the camera does not have to supply any: it takes itself out of the doorway, stands off in the garden, and
// watches her go round, with the couple in the lower part of the frame. Then, when the necklace leaves the box
// and comes down onto her neck, the camera comes in on the pendant for the one shot that has to be read.
//
// Positions here are measured from the couple along the *outward* axis -- the direction out of the castle door --
// not along her own nose. She can leave the doorway at any angle, or even walking backwards, and the film still
// has to stand somewhere that exists: the garden. That is also why it never orbits her at close range; the
// doorway is 3 m wide and the walls are 3.85 m either side, and a swing round her at 2 m is a path through
// masonry (measured: a sixth of the film was inside the wall, starting at 0.8 s).
const OUT = [[0, -4.93], [0.7, -3.6], [1.3, -0.2], [2.0, 2.6], [2.6, 3.9], [5.4, 3.7], [7.6, 3.3], [9.4, 2.9], [10.0, 1.7], [10.7, 0.62], [11.4, 0.9], [11.9, 2.2], [12.3, 2.2], [GIFT_SECONDS, -4.93]];
// Metres to the side of that axis (her right, when she is walking out).
const SIDE = [[0, 0], [0.7, 0.42], [1.3, 0.72], [2.0, 1.0], [2.6, 0.95], [2.6, 0.95], [5.4, 0.85], [7.6, 0.72], [9.4, 0.6], [10.7, 0.06], [11.3, 0.6], [11.8, 1.0], [12.2, 1.1], [GIFT_SECONDS, 0]];
// Height above her throat.
const HEIGHT = [[0, 2.56], [0.7, 1.3], [1.3, 0.8], [2.0, 0.95], [2.6, 1.2], [5.4, 1.08], [7.6, 0.95], [9.4, 0.8], [10.0, 0.5], [10.7, 0.1], [11.4, 0.35], [11.9, 1.2], [12.3, 2.0], [GIFT_SECONDS, 2.56]];
// How much of the frame belongs to the butterfly. Full through the open-the-box and the circle; dropped only at
// the end, when the necklace is what we are looking at.
const AIM_FAIRY = [[0, 0], [1.3, 0], [2.1, 0.85], [2.9, 1], [8.8, 1], [9.5, 0.2], [10.0, 0]];
// What it is pointed at when it is *not* the butterfly: her throat, sliding a little off dead centre once the
// camera is round in front of her.
const LOOK_AIM = [[0, 0], [9.6, 0], [10.4, 0.5], [11.0, 0.55], [GIFT_SECONDS, 0]];
const LOOK_ABOVE = [[0, 0.56], [9.4, 0.1], [10.0, 0.0], [10.7, 0.02], [11.4, 0.06], [GIFT_SECONDS, 0.56]];
// How close the shot is, for the vignette: 0 is the walking camera's own view.
const CLOSENESS = [[0, 0], [5.4, 0], [7.6, 0.35], [9.8, 0.7], [10.7, 0.95], [11.6, 0.8], [12.2, 0.1], [GIFT_SECONDS, 0]];
// A whisper of tilt for the close shot, in radians, eased to zero at both ends.
const ROLL = [[0, 0], [5.4, 0], [9.0, -0.015], [10.7, -0.05], [12.0, 0], [GIFT_SECONDS, 0]];

// Scalar and 3-D mixes, plus a flat ground distance: the film works in the horizontal plane and only ever
// lifts or drops, so nothing here needs a full vector class.
const mix = (a, b, w) => a + (b - a) * w;
const mix3 = (a, b, w) => ({ x: mix(a.x, b.x, w), y: mix(a.y, b.y, w), z: mix(a.z, b.z, w) });
const dist2 = (a, b) => Math.hypot(a.x - b.y * 0 - b.x, a.z - b.z);

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
  const f = frameOf(couple);
  // The close-up stands *outside* the castle, and that is not the same as in front of her nose: a player can
  // leave the doorway at an angle, or even walking back towards the facade. `outYaw` is the direction that is
  // actually out of the building (the door faces +z); it defaults to her facing for anywhere in the open.
  const outYaw = couple.outYaw ?? couple.yaw;
  const ox = Math.sin(outYaw);
  const oz = Math.cos(outYaw);
  // the side axis of that outward frame
  const rx0 = Math.cos(outYaw);
  const rz0 = -Math.sin(outYaw);
  const shot = giftShot(t);
  const neckY = couple.neckY ?? 1.14;
  const follow = couple.follow ?? null;
  const focusY = couple.focusY ?? neckY + 0.56;

  // where the walking camera is, in her frame: how far round, how far out, how high
  // Where the walking camera stands, in her frame: how far along her facing, how far to her right, how high.
  const toFrame = (p) => {
    const dx = p.x - f.x;
    const dz = p.z - f.z;
    return { fwd: dx * f.fx + dz * f.fz, side: dx * f.rx + dz * f.rz, y: p.y };
  };
  const followFrame = follow ? toFrame(follow) : { fwd: -4.93, side: 0, y: neckY + 2.56 };

  // The move is authored on the outward axis; the walking camera's own pose is mixed into it at both ends, so
  // the film begins and ends *exactly* on it (measured: 0.0000 m) and never has to travel to get there or back.
  const w = keyed(FOLLOW_WEIGHT, t);
  const outDist = mix(keyed(OUT, t), followFrame.fwd, w);
  const lat = mix(keyed(SIDE, t), followFrame.side, w);
  const height = mix(neckY + keyed(HEIGHT, t), followFrame.y, w);
  const P = {
    x: f.x + ox * outDist + rx0 * lat,
    y: height,
    z: f.z + oz * outDist + rz0 * lat,
  };

  // ---- what it is pointed at -------------------------------------------------
  // Her throat, with the butterfly's weight on top of it. `fairy` is her world position (main.js passes it while
  // she is returning, null once she has gone); if it is missing the film simply behaves as it did before.
  const aimAtFairy = keyed(AIM_FAIRY, t) * (fairy ? 1 : 0) * (1 - w);
  const aim = keyed(LOOK_AIM, t);
  const lookY = mix(neckY + keyed(LOOK_ABOVE, t), focusY, w);
  const neckAim = {
    x: mix(f.x, f.x + f.fx * 0.16, aim),
    y: lookY,
    z: mix(f.z, f.z + f.fz * 0.16, aim),
  };
  // She dives in from above the roof, so the aim has to be allowed to rise with her -- but only so far. The
  // frame must keep the couple's heads in it, so the butterfly comes *down into the top of the shot* rather than
  // dragging the camera up after her and leaving them out of the bottom of it.
  const fairyAimY = Math.min(Math.max(fairy ? fairy.y : neckY, neckY + 0.45), neckY + 0.86);
  const fairyAim = fairy ? { x: fairy.x, y: fairyAimY, z: fairy.z } : neckAim;
  // Aim *between* them rather than at either: she circles at 2 m to the couple's side, and a camera that simply
  // points at her drops them out of the bottom of the frame -- which is what it looked like.
  const mid = {
    x: mix(neckAim.x, fairyAim.x, 0.5),
    y: mix(neckAim.y, fairyAim.y, 0.5),
    z: mix(neckAim.z, fairyAim.z, 0.5),
  };
  const L = mix3(neckAim, mid, aimAtFairy);

  // And stand back far enough that both of them fit: a 55-degree lens sees 0.5 m of half-width per metre, so the
  // distance needed is the widest offset from the aim point divided by tan(24 deg), with room to breathe.
  if (fairy && aimAtFairy > 0.001) {
    const off = Math.max(dist2(L, neckAim), dist2(L, fairyAim)) + 0.45;
    const want = off / Math.tan(0.42);
    const dir = { x: P.x - L.x, y: P.y - L.y, z: P.z - L.z };
    const len = Math.hypot(dir.x, dir.z) || 1;
    const have = len;
    if (want > have) {
      const k = (want - have) * aimAtFairy;
      P.x += (dir.x / len) * k;
      P.z += (dir.z / len) * k;
    }
  }
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

// Keep the film's camera out of the walls.
//
// The composition already avoids the masonry: it stands off on the outward axis, and it is measured clear for
// the whole film from the doorway, the steps, the garden and while walking back towards the facade. But the
// couple can leave the door at an odd angle, and then the walking camera the film hands over from may itself be
// standing in a wall (it is inside the hall, and its own distance is resolved against the ray it casts from the
// player). So the same test is applied to the film's pose: cast from what it is looking at out to where it wants
// to stand, and stop just before the first obstacle -- never in front of it.
//
// This shortens, it never teleports: the free distance varies continuously along the corridor, so the shot can
// only ease in closer. It is the same rule as controls.js uses for the walking camera, which is why the film
// and the game agree about where a camera may stand.
export function keepCameraClear(pos, look, solid, out = {}) {
  out.x = pos.x;
  out.y = pos.y;
  out.z = pos.z;
  if (!solid) return out;
  const dx = pos.x - look.x;
  const dy = pos.y - look.y;
  const dz = pos.z - look.z;
  const len = Math.hypot(dx, dy, dz);
  if (len < 0.05) return out;
  const MIN = 0.9; // never closer than this: the pendant has to stay readable
  let free = len;
  for (let d = MIN; d <= len; d += 0.1) {
    if (solid(look.x + (dx / len) * d, look.y + (dy / len) * d, look.z + (dz / len) * d)) {
      free = Math.max(MIN, d - 0.12);
      break;
    }
  }
  if (free === len) return out;
  const k = free / len;
  out.x = look.x + dx * k;
  out.y = look.y + dy * k;
  out.z = look.z + dz * k;
  return out;
}

export function giftCameraBlend(t) {
  const into = smooth(t / 0.5);
  const outOf = 1 - smooth((t - (GIFT_SECONDS - 0.6)) / 0.6);
  return Math.min(into, outOf);
}
