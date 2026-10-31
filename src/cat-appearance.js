// Shared palette and proportions, based on the cats' reference photos.
// DSH describes Pastil's short coat, not a single prescribed body or colour.
export const CAT_APPEARANCE = {
  pastil: {
    base: '#a7a098', stripe: '#5b5249', eye: '#e8b64c',
    muzzle: '#e6d6c4', folded: false, collar: true,
    headWidth: 1, headHeight: 0.96, cheek: 0.052, bodyWidth: 1,
  },
  ani: {
    base: '#bd8150', stripe: '#56392a', eye: '#849489',
    muzzle: '#d6c8b8', folded: true, collar: false,
    headWidth: 1.11, headHeight: 1.02, cheek: 0.058, bodyWidth: 1.09,
  },
};

// Preserve Ani's relaxed forward fold even during listening and ear twitches.
export function catEarPose(appearance, side, twitch = 0, attentive = false) {
  const fold = appearance.folded;
  return {
    z: -side * ((fold ? 0.43 : 0.28) + twitch * (fold ? 0.35 : 1) + (attentive ? (fold ? 0.04 : 0.08) : 0)),
    x: (fold ? 0.52 : -0.12) + (attentive ? (fold ? -0.06 : 0.15) : 0),
  };
}
