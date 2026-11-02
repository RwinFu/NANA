// Adaptive resolution.
//
// The game aims at 60 fps and trades pixels for it. Three rules, and they were all wrong before:
//
// 1. It STARTED at 1.5 device pixels per CSS pixel. On a 3x phone that is 2.25x the pixels of scale 1, and
//    at 30 fps the loop then needed two seconds of slow frames before it stepped down *once*, to 1.25.
//    It now starts at 1 and only climbs above it on a display that can spare it.
// 2. It never actually went above 1.5, because the scale is clamped by the device pixel ratio in
//    `Math.min(dpr, scale)` -- so 1.5 was a ceiling as well as a floor. The ceiling is now 2, and the floor
//    is 0.5, because a phone that is struggling should be allowed to draw fewer pixels than CSS pixels.
// 3. It decided on `dt > 1/40`, a single threshold, so a display sitting at 45 fps was "fine" and never
//    improved; and a genuinely slow one waited two full seconds per step. It now targets a band around
//    60 fps, steps down in half a second when the frames are far off, and steps one notch at a time.

// Coarse steps, because changing the pixel ratio reallocates the drawing buffer and costs a hitch. The set
// reaches well below 1 so a struggling phone can get to 0.5, which is a quarter of the pixels of 1.
export const QUALITY_STEPS = [2, 1.5, 1.25, 1, 0.85, 0.7, 0.6, 0.5];
export const MAX_SCALE = 2;
export const MIN_SCALE = 0.5;

// The canvas never draws at a scale no display can use, and never above what the device asks for.
export function clampScale(scale, devicePixelRatio = 1) {
  return Math.max(MIN_SCALE, Math.min(scale, devicePixelRatio || 1, MAX_SCALE));
}

// How long a slow stretch has to last before one step down, and a fast stretch before one step up.
const SLOW_WINDOW = 0.6;
const FAST_WINDOW = 2.5;
// A single frame longer than this is a hitch (a tab switch, a decode, a shader compiling), not a slow GPU.
const HITCH = 0.25;

// What the loop should do, given the frame time. Pure: the caller applies the answer.
// frameMs: the frame time in milliseconds; slowFor/fastFor: how long each stretch has lasted, in seconds.
export function nextQuality({ frameMs, slowFor, fastFor, index, devicePixelRatio = 1 }) {
  const steps = QUALITY_STEPS;
  const at = Math.max(0, Math.min(index, steps.length - 1));
  if (!(frameMs > 0) || frameMs > HITCH * 1000) return { index: at, slowFor: 0, fastFor: 0, changed: false };
  const fps = 1000 / frameMs;
  // 51 fps or better is close enough to 60 that moving would only cost a hitch
  if (fps >= 51) {
    const nextFast = fastFor + frameMs / 1000;
    if (nextFast >= FAST_WINDOW && at > 0) {
      const up = at - 1;
      return { index: up, slowFor: 0, fastFor: 0, changed: true, scale: clampScale(steps[up], devicePixelRatio) };
    }
    return { index: at, slowFor: 0, fastFor: nextFast, changed: false };
  }
  const nextSlow = slowFor + frameMs / 1000;
  if (nextSlow >= SLOW_WINDOW && at < steps.length - 1) {
    // far below target: take the step that gets closest to it without overshooting, but only one rung
    const down = at + 1;
    return { index: down, slowFor: 0, fastFor: 0, changed: true, scale: clampScale(steps[down], devicePixelRatio) };
  }
  return { index: at, slowFor: nextSlow, fastFor: 0, changed: false };
}

// A ready-made controller for the frame loop: keeps its own counters and tells the caller when to resize.
export function createQuality(devicePixelRatio = 1) {
  // start at 1: the old start of 1.5 was the single biggest cost in the game, and nothing is learnt by
  // opening at a scale the GPU has not earned yet
  let index = Math.max(0, QUALITY_STEPS.indexOf(1));
  let slowFor = 0;
  let fastFor = 0;
  let scale = clampScale(QUALITY_STEPS[index], devicePixelRatio);
  let cooldown = 0;
  return {
    get scale() { return scale; },
    get index() { return index; },
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
