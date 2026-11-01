import * as THREE from 'three';

// The necklace the fairy brings back: a present for the princess, given the first time the couple come
// out of the castle after having been inside it.
//
// This file is the *story* of that scene, as plain numbers, so the beats can be reasoned about (and
// tested) without a renderer. The gold itself is built in necklace.js; the flight is in fairy.js; the
// trigger and the prompts are in main.js. Everything time-related here is measured from the moment the
// scene starts, in seconds.

// How long the whole scene runs, from the fairy's first approach to the necklace settling on her neck.
// Long enough to be a present, short enough that it is not a cutscene.
export const GIFT_SECONDS = 12.5;

// The beats, in order. Each name is what the scene is doing at that moment.
export const GIFT_BEATS = [
  { name: 'arrive', from: 0.0, to: 2.6 }, // she flies in from high over the garden, carrying the box
  { name: 'present', from: 2.6, to: 5.4 }, // she stops in front of the princess and the box opens
  { name: 'lift', from: 5.4, to: 7.6 }, // the necklace rises out of the box, turning in the air
  { name: 'circle', from: 7.6, to: 9.8 }, // the fairy circles the couple once; the necklace follows
  { name: 'settle', from: 9.8, to: 11.6 }, // the chain closes on her neck, the pendant finds its place
  { name: 'glow', from: 11.6, to: GIFT_SECONDS }, // the whole garden answers, then the fairy leaves
];

// Which beat a given time is in.
export function giftBeat(t) {
  const time = Math.max(0, t);
  for (const beat of GIFT_BEATS) {
    if (time < beat.to) return beat.name;
  }
  return 'done';
}

// 0..1 progress through the whole scene, for the parts that just need a number.
export function giftProgress(t) {
  return Math.min(1, Math.max(0, t / GIFT_SECONDS));
}

// 0..1 ease inside the current beat, for the parts that need to move within one beat.
export function giftBeatProgress(t) {
  const time = Math.max(0, t);
  for (const beat of GIFT_BEATS) {
    if (time < beat.to) {
      const k = (time - beat.from) / (beat.to - beat.from);
      return { beat: beat.name, k: Math.min(1, Math.max(0, k)) };
    }
  }
  return { beat: 'done', k: 1 };
}

// The trigger. The scene belongs to the first time the couple step out of the castle after they have
// been in it: "you went in, you came back out, and something is waiting for you".
//
// `wasInside` means they have been in the hall at some point since the game started;
// `cameOut` means they are outside the hall's footprint now.
export function giftReady({ wasInside, isOutside, alreadyGiven, sceneActive }) {
  return !!wasInside && !!isOutside && !alreadyGiven && !sceneActive;
}

// Where the necklace ends up on her neck, in the princess's own frame: the gold choker sits at
// y = 1.68 and the body is scaled as a whole (see characters.js), so the pendant hangs a little under
// that, on the front of her throat. The chain's own centre is the choker's height. main.js holds the same
// two numbers as NECK_Y / NECK_Z for placing the group; tests/gift.test.js keeps them in step.
// Measured off her rig, not guessed. Her neck is a short cone: radius 0.113 at y 1.68 (which is exactly where
// her built-in gold choker sits, outer edge 0.137) and already 0.21 by y 1.66, where the bodice and its pearl
// collar begin. So the necklace has to be *just* outside the choker and a hair below it, and the pendant has
// to hang forward of the bodice's front face (z ~0.21) or it ends up inside her dress.
export const NECK = { y: 1.666, pendantY: 1.53, z: 0.15, chainRadius: 0.145 };
// Where the whole necklace goes when she wears it: the chain's centre, in her *body's* frame (the frame
// the gold choker is built in, characters.js y = 1.68). One number, used by the flight's landing point and
// by the code that mounts it, so the two cannot disagree.
export const NECK_POSE = { y: NECK.y, z: 0.0 };
// She wears the necklace at her own size: it is parented to her body, which is scaled by this. The flight has
// to shrink to exactly this before it lands, or the necklace pops 32% bigger the instant it touches her neck.
export const NECK_WEAR_SCALE = 0.68;

// The three poses the necklace passes through, as a function of the scene's time:
//   in the box   (before 'lift')   — small, still, hidden inside the lid
//   in the air   (lift .. settle)  — turning slowly in front of the couple
//   on her neck  (settle .. end)   — settled, with the pendant swinging to rest
//
// It returns a point in world space plus a scale and a spin, so the caller only has to apply them.
export function necklacePose(t, { boxAt, neckAt, holdAt }) {
  const p = giftProgress(t);
  const inAir = giftBeatProgress(t);
  const at = { x: 0, y: 0, z: 0, scale: 1, spin: 0, swing: 0 };
  if (t < 5.4) {
    // still inside the box: a glint of gold in the dark, so the box reads as "something is in here"
    at.x = boxAt.x;
    at.y = boxAt.y;
    at.z = boxAt.z;
    at.scale = 0.001;
    return at;
  }
  if (t < 9.8) {
    // out of the box and into the air: up, then a slow circle in front of the princess
    const k = (t - 5.4) / 4.4;
    const rise = Math.min(1, k / 0.45);
    const e = rise * rise * (3 - 2 * rise);
    const circle = Math.max(0, (k - 0.35) / 0.65);
    const angle = circle * Math.PI * 2;
    const radius = 0.42;
    const ring = Math.min(1, circle * 3);
    at.x = boxAt.x + (holdAt.x - boxAt.x) * e + Math.cos(angle) * radius * ring * 0;
    at.y = boxAt.y + (holdAt.y - boxAt.y) * e + Math.sin(angle) * 0.06 * ring;
    at.z = boxAt.z + (holdAt.z - boxAt.z) * e;
    // ... and it drifts over her head as it turns, so the settling has somewhere to land
    const toNeck = Math.min(1, Math.max(0, (k - 0.62) / 0.38));
    const n = toNeck * toNeck * (3 - 2 * toNeck);
    at.x += (neckAt.x - holdAt.x) * n;
    at.y += (neckAt.y - holdAt.y) * n;
    at.z += (neckAt.z - holdAt.z) * n;
    at.scale = Math.min(NECK_WEAR_SCALE, 0.15 + k * 2.4);
    at.spin = t * 2.4;
    return at;
  }
  if (t < 11.6) {
    // Landing on her neck. The chain arrives from above, settles, and the *pendant* is the thing that
    // moves after that: it swings forward and back twice, smaller each time, and stops. Sitting the chain
    // and swinging the pendant is what makes it read as weight rather than as a sprite finding a socket.
    const k = Math.min(1, (t - 9.8) / 1.8);
    const e = k * k * (3 - 2 * k);
    at.x = neckAt.x;
    at.y = neckAt.y + (1 - e) * 0.05;
    at.z = neckAt.z;
    at.scale = NECK_WEAR_SCALE;
    // a damped swing, in radians, on the pendant's own axis
    const damp = Math.exp(-k * 3.4);
    at.spin = Math.sin(k * 9.2) * 0.48 * damp;
    at.swing = at.spin;
    return at;
  }
  // Settled. It is hers now, so it moves the way a necklace moves on someone standing still: a breath in
  // the chain, and the pendant finding its rest.
  at.x = neckAt.x;
  at.y = neckAt.y + Math.sin(t * 1.35) * 0.0018;
  at.z = neckAt.z + Math.sin(t * 1.1 + 0.6) * 0.0012;
  at.scale = NECK_WEAR_SCALE;
  at.spin = Math.sin(t * 1.15) * 0.02;
  at.swing = at.spin;
  void inAir;
  void p;
  return at;
}

// What to say, and when. The couple say nothing during the flight: the fairy's own presence is the
// event. Two lines only, so the moment is not talked over.
export const GIFT_LINES = {
  arrive: null,
  present: 'پری برگشته… با یه جعبه.',
  lift: null,
  circle: null,
  settle: 'این رو برای تو آورده.',
  glow: 'گردنبندت مبارک، پرنسسِ من.',
};

// A line for the first time she wears it and walks: the small, afterwards beat.
export const GIFT_AFTER = 'آویزِ قلبت رو دیدم؛ هر بار برق می‌زنه، یادم می‌افته.';
