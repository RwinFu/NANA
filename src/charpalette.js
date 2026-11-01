// The colours of the two characters, in one place.
//
// They used to be literals spread through characters.js, faces.js, dress.js and hairdetail.js, and the
// spread showed: a skin that read as tan under one light next to a hair that read as black, a coat of
// navy so dark it was a silhouette, and two rose-reds that fought each other. These are chosen as one
// family — a warm, lit, storybook palette that still sits under the hall's violet at night:
//
//   * skin is light and rosy rather than tan, so a face reads at three metres;
//   * the dress is a deep rose, not a fire-engine red: it holds its folds in shadow;
//   * its trim is champagne, its sash a warmer pink, so the details separate from the cloth;
//   * the boy is slate blue and cocoa brown with cream — three tones that are distinct at a distance,
//     where navy trousers and a navy coat used to merge into one dark mass.
export const CHAR = {
  // skin, shared by both so they read as the same painter's work
  skin: '#efc09c',
  skinShade: '#d79a78',
  skinBlush: '#f29bb0',

  // the princess
  hair: '#4a2c26',
  hairSheen: '#6d4436',
  dress: '#e0446b',
  dressDeep: '#b32c53',
  dressLight: '#f27b9b',
  petticoat: '#ffdfe9',
  lace: '#fff6fa',
  sash: '#ff9ec2',
  gold: '#f2c777',
  pearl: '#fffaf2',
  shoe: '#4a2b38',
  lip: '#d94a6e',

  // the boy
  coat: '#3c4a75',
  coatLight: '#55679a',
  vest: '#2f3a60',
  trousers: '#2b3048',
  shirt: '#fbf7f0',
  belt: '#6b4429',
  boyHair: '#2c1c17',
  boyHairLight: '#5a3626',
  boyShoe: '#241f2b',
  bowTie: '#e8607e',
};

// The character colours as [r, g, b], 0..1, for the tests that check they are far enough apart.
export function channels(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// Relative luminance, for "are these two colours distinguishable at a distance".
export function luma(hex) {
  const [r, g, b] = channels(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
