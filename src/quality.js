// Adaptive resolution.
//
// The game aims at 60 fps. The first attempt at this made everything blurry, and it was right to: it traded
// resolution for frames and took the resolution all the way down to 0.5, which on a phone is a quarter of
// the pixels and looks like a smeared photograph. Frames are not worth that. On a 2x or 3x display the extra
// pixels are the whole reason the game looks like it does.
//
// So the rules are now:
//
// 1. The floor is ONE device pixel per CSS pixel. A high-density display may be sharper than CSS pixels
//    (there is headroom up to 2), but it is never softer. The scene itself stays crisp.
// 2. It opens at that same floor: sharp from the first frame, and it only earns its way up.
// 3. Anything that is not sharp enough to look right does not belong in the ladder, so the sub-1 steps are
//    gone. Speed now comes from the scene (fewer draw calls, fewer lights), not from a soft image.
//
// The remaining job is the *ceiling*: on a display that can carry more than one device pixel per CSS pixel
// the game may climb, and come back down again when it cannot. That is what the controller does.

export const MIN_SCALE = 1; // never softer than one device pixel per CSS pixel
export const MAX_SCALE = 2; // ...and never more than two, whatever the display offers
// Coarse steps, because changing the pixel ratio reallocates the drawing buffer and costs a hitch.
export const QUALITY_STEPS = [2, 1.5, 1.25, 1];

// The canvas never draws at a scale no display can use, and never below CSS pixels.
export function clampScale(scale, devicePixelRatio = 1) {
  return Math.max(MIN_SCALE, Math.min(scale, devicePixelRatio || 1, MAX_SCALE));
}

// How long a slow stretch has to last before one step down, and a fast stretch before one step up.
const SLOW_WINDOW = 0.6;
const FAST_WINDOW = 2.5;
// A single frame longer than this is a hitch (a tab switch, a decode, a shader compiling), not a slow GPU.
const HITCH = 0.25;
// What "smooth enough" means. Below this it gives resolution back; above it, it does not ask for more.
const GOOD_FPS = 52;

// What the loop should do, given the frame time. Pure: the caller applies the answer.
// index: position in QUALITY_STEPS; slowFor/fastFor: how long each stretch has lasted, in seconds.
export function nextQuality({ frameMs, slowFor, fastFor, index, devicePixelRatio = 1 }) {
  const steps = QUALITY_STEPS;
  const at = Math.max(0, Math.min(index, steps.length - 1));
  if (!(frameMs > 0) || frameMs > HITCH * 1000) return { index: at, slowFor: 0, fastFor: 0, changed: false };
  const fps = 1000 / frameMs;
  if (fps >= GOOD_FPS) {
    const nextFast = fastFor + frameMs / 1000;
    // climb only if the display can actually show the result: no point going to 2 on a 1x screen
    const up = at > 0 ? at - 1 : at;
    const canClimb = up !== at && clampScale(steps[up], devicePixelRatio) > clampScale(steps[at], devicePixelRatio);
    if (nextFast >= FAST_WINDOW && canClimb) {
      return { index: up, slowFor: 0, fastFor: 0, changed: true, scale: clampScale(steps[up], devicePixelRatio) };
    }
    return { index: at, slowFor: 0, fastFor: nextFast, changed: false };
  }
  const nextSlow = slowFor + frameMs / 1000;
  if (nextSlow >= SLOW_WINDOW && at < steps.length - 1) {
    const down = at + 1;
    return { index: down, slowFor: 0, fastFor: 0, changed: true, scale: clampScale(steps[down], devicePixelRatio) };
  }
  return { index: at, slowFor: nextSlow, fastFor: 0, changed: false };
}

// A ready-made controller for the frame loop: keeps its own counters and tells the caller when to resize.
export function createQuality(devicePixelRatio = 1) {
  // start at the floor: sharp, and the display has to earn the extra pixels
  const start = Math.max(0, QUALITY_STEPS.indexOf(1));
  let index = start;
  let slowFor = 0;
  let fastFor = 0;
  let scale = clampScale(QUALITY_STEPS[start], devicePixelRatio);
  let cooldown = 0;
  return {
    get scale() { return scale; },
    get index() { return index; },
    // true when the ladder has nowhere lower to go and the frames are still slow: the scene must give, not
    // the picture. main.js uses this to trim the render distance rather than the resolution.
    get atFloor() { return index >= QUALITY_STEPS.length - 1; },
    update(dt) {
      if (cooldown > 0) { cooldown = Math.max(0, cooldown - dt); return null; }
      const r = nextQuality({ frameMs: dt * 1000, slowFor, fastFor, index, devicePixelRatio });
      slowFor = r.slowFor;
      fastFor = r.fastFor;
      if (!r.changed) return null;
      index = r.index;
      scale = r.scale;
      cooldown = 1.2; // let the new buffer show up in the timings before judging it
      return scale;
    },
  };
}
