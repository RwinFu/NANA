// The timing of opening the letter, on its own so it can be checked without a clock or a renderer.
//
// The opening is a short piece of choreography in four beats:
//
//   0.00  the wax gives: cracks open across the seal                          (crackle, then a snap)
//   0.55  the plate is swapped for its two halves and the flap lifts; the light inside comes up
//   1.35  the folded paper rises out of the envelope and unfolds as it clears the lip
//   2.15  the letter is out and held in the light                             (onOpened fires)
//
// Everything below is a function of one number — how far through the opening we are, 0..1 — so the
// animation in envelope.js is a matter of reading these off, not of accumulating state.

export const BEATS = {
  wax: 0.55,
  flap: 0.8,
  paper: 0.8,
  settle: 0.15,
};

export const OPEN_TIME = BEATS.wax + BEATS.flap + BEATS.paper + BEATS.settle;

// The instant each beat starts, in seconds from the click.
export const BEAT_AT = {
  crack: 0,
  break: BEATS.wax * 0.45,
  flap: BEATS.wax,
  paper: BEATS.wax + BEATS.flap * 0.4,
  open: OPEN_TIME,
};

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (t) => t * t * (3 - 2 * t);

// Where everything is at `k` (0..1 through the opening).
export function openingAt(k) {
  const t = clamp01(k) * OPEN_TIME;
  const span = (from, to) => clamp01((t - from) / Math.max(1e-6, to - from));

  // the wax: cracks first, then it is two halves
  const wax = span(0, BEATS.wax);
  const split = clamp01((t - BEATS.wax * 0.55) / (BEATS.wax * 0.45));
  // the flap, turning back on its hinge
  const flap = smooth(span(BEATS.wax * 0.72, BEATS.wax + BEATS.flap));
  // the light inside, up a little before the flap is fully open
  const light = smooth(span(BEATS.wax * 0.5, BEATS.wax + BEATS.flap * 0.6));
  // the paper, out of the mouth of the envelope and then unfolding
  const rise = 1 - Math.pow(1 - span(BEATS.wax + BEATS.flap, BEATS.wax + BEATS.flap + BEATS.paper), 3);
  const unfold = smooth(span(BEATS.wax + BEATS.flap + BEATS.paper * 0.35, BEATS.wax + BEATS.flap + BEATS.paper));
  const paper = span(BEATS.wax + BEATS.flap * 0.6, OPEN_TIME);

  return {
    t,
    wax, // 0..1: how cracked the seal is
    split, // 0..1: how far past the break we are (0 while the wax is whole)
    flap, // 0..1: radians / PI of the flap's turn
    light, // 0..1: the light inside the envelope
    rise, // 0..1: how far the paper has come out
    unfold, // 0..1: 0 folded shut, 1 flat
    paper, // 0..1: how much of the paper is out at all
  };
}

// The same, from the clock: what envelope.js calls each frame.
export function openingAtTime(seconds) {
  return openingAt(seconds / OPEN_TIME);
}
