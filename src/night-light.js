// The world's night light, in one place.
//
// It is a moonlit night, not a black one. What went wrong before: one warm hemisphere at 1.05 and
// a single warm moon at 0.95 sitting to the north-west. Every wall the moon did not face — the whole
// lane side of the town, most of the castle's flanks, the square's west wall — got nothing but the
// hemisphere's *ground* colour, which is the colour of earth seen from below. Those walls rendered
// as near-black slabs, and the town's own wall palette (a near-black plum) finished the job.
//
// So: a higher, warmer hemisphere for the ambient, the moon kept as the key, and two extra
// directions — a cool fill from the opposite side (moonlight scattered by the sky) and a weak warm
// bounce from below (light coming back off the ground). Two cheap directional lights buy every
// shadowed face a shape and a colour, without touching the night.
//
// Kept as plain numbers so tests/night-light.test.js can hold the balance: shadowed faces must get
// a real fraction of what lit faces get, and no direction may dominate to the point of flattening.

export const skyLight = {
  // ambient dome: warm from above, warm stone from below
  color: '#ffe6d2',
  groundColor: '#8a6455',
  intensity: 1.5,
  // the moon itself
  keyColor: '#ffe2c2',
  keyIntensity: 1.15,
  // cool fill from the far side, and a small warm bounce from the ground
  fillColor: '#9fb6ff',
  fillIntensity: 0.42,
  bounceColor: '#ffcf9e',
  bounceIntensity: 0.18,
};

// What a surface receives, 0..1 per channel, for a given world-ish normal. This is the model the
// shader uses (Lambert, hemisphere for the dome), written out so the balance can be reasoned about
// and tested instead of guessed at from screenshots.
export function irradiance(normal, cfg = skyLight, { keyDir = [-0.48, 0.8, 0.32], fillDir = [0.55, 0.38, -0.72], bounceDir = [0, -0.6, 0.8] } = {}) {
  const [nx, ny, nz] = normal;
  const dot = (d) => {
    const len = Math.hypot(d[0], d[1], d[2]) || 1;
    return Math.max(0, (nx * d[0] + ny * d[1] + nz * d[2]) / len);
  };
  // three.js blends the dome's sky and ground colours by (0.5 + 0.5 * ny), so a vertical wall gets
  // half of each — not nothing, which is what a naive max(0, ny) would suggest
  const up = 0.5 + 0.5 * ny;
  const down = 1 - up;
  const hex = (h) => {
    const n = parseInt(h.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  };
  const add = (out, colour, k) => {
    const c = hex(colour);
    out[0] += c[0] * k;
    out[1] += c[1] * k;
    out[2] += c[2] * k;
  };
  const out = [0, 0, 0];
  add(out, cfg.color, up * cfg.intensity);
  add(out, cfg.groundColor, down * cfg.intensity);
  add(out, cfg.keyColor, dot(keyDir) * cfg.keyIntensity);
  add(out, cfg.fillColor, dot(fillDir) * cfg.fillIntensity);
  add(out, cfg.bounceColor, dot(bounceDir) * cfg.bounceIntensity);
  return out;
}

// Luminance of what a face receives: the number that used to sit near zero for a wall facing away
// from the moon.
export function faceLuma(normal, cfg = skyLight) {
  const [r, g, b] = irradiance(normal, cfg);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// The horizon colour the sky and the fog share.
export const horizonColor = '#372a58';
