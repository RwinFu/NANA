// Turn a line of text into letter outlines, once, ahead of the game.
//
// The sign over the front door is cut from real letter outlines, not traced from a bitmap. The outlines come
// from a font file, parsed here at build time (opentype.js is a dev-only tool -- nothing in src/ imports this
// script), and written out as a module that src/sign.js extrudes at run time.
//
// Why not shape the text in the browser, the way a canvas would? The canvas API returns pixels, and turning
// pixels back into outlines gives you either a huge triangle count or a blocky silhouette. Both were tried:
// a traced sign came out at 3,050 triangles for one line, and at a coarse enough trace the O's became
// diamonds. Real outlines are cheap -- this line is a few hundred curves -- and they are exact.
//
// Usage: node tools/make-sign.mjs
// Reads node_modules/@fontsource/baloo-2/files/baloo-2-latin-800-normal.woff and writes src/sign-outline.js.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Baloo 2 at 800: a rounded, plump display face. The bowls of the O and the U are near-circles and the stems
// have soft ends, so the whole line reads warm; it still keeps real counters and a straight baseline, so the
// sign reads as a sign rather than as a sticker. (Lalezar, the face before it, is a Persian display face: in
// Latin it is a condensed grotesque, which is exactly the "dry" the owner objected to.)
const FONT = path.join(root, 'node_modules/@fontsource/baloo-2/files/baloo-2-latin-800-normal.woff');
const OUT = path.join(root, 'src/sign-outline.js');

// The line on the front of the house.
export const SIGN_TEXT = 'OUR HOUSE';
// Extra space between letters, in font units (1000 to the em). A rounded face wants a little more air between
// its letters than it ships with, or the bowls touch.
const TRACKING = 40;
// Letters rise and fall a few units each, like hand lettering: even letters up, odd letters down. At this size
// the eye reads it as bouncy rather than as misregistered, and it is what stops a line of caps looking stencilled.
const BOUNCE = 44;
// The whole line also bows up in the middle, the way lettering on an awning does. In font units, at the ends.
const ARCH = 64;

/** The vertical offset of each letter: the bow, plus the alternation. */
function lift(glyphs, widths, tracking) {
  const total = widths.reduce((n, w) => n + w, 0) + tracking * (glyphs.length - 1);
  const out = [];
  let x = 0;
  glyphs.forEach((glyph, i) => {
    if (i > 0) x += tracking;
    const centre = x + widths[i] / 2;
    // -1 at the left end of the line and +1 at the right, so the bow is a parabola that returns to the
    // baseline at both ends and lifts most in the middle.
    const t = total ? (centre / total) * 2 - 1 : 0;
    // The space has no ink to lift, and lifting it would put a gap in the bow.
    const bounce = glyph.name === 'space' ? 0 : (i % 2 === 0 ? BOUNCE : -BOUNCE);
    out.push(Math.round(-ARCH * (1 - t * t) + bounce));
    x += widths[i];
  });
  return out;
}

/**
 * Read the glyph outlines of `text` out of the font.
 *
 * Each contour comes out as its start point plus a list of commands, in the same ['Q', cx, cy, x, y] shape
 * opentype uses -- only the offsets and the flip are already applied, so the file's numbers are final and
 * src/sign.js only has to draw them.
 */
function outlines(text, font, tracking) {
  const glyphs = font.stringToGlyphs(text);
  const widths = glyphs.map((g) => g.advanceWidth);
  const dy = lift(glyphs, widths, tracking);
  const r = (v) => Math.round(v * 100) / 100;
  // opentype hands out outlines in y-down (canvas/SVG) coordinates: the baseline is y = 0 and the tops of the
  // letters are negative. three.js is y-up, so every y is negated here, once.
  const P = (x, y, d) => [r(x), r(-y + d)];

  const subs = [];
  let x = 0;
  for (let i = 0; i < glyphs.length; i += 1) {
    const glyph = glyphs[i];
    if (i > 0) x += (font.getKerningValue(glyphs[i - 1], glyph) || 0) + tracking;
    const d = dy[i];
    let current = null;
    for (const c of glyph.getPath(0, 0, font.unitsPerEm, {}).commands) {
      if (c.type === 'M') {
        current = { start: P(c.x + x, c.y, d), curves: [] };
        subs.push(current);
      } else if (!current) {
        // Nothing to add to.
      } else if (c.type === 'L') current.curves.push(['L', ...P(c.x + x, c.y, d)]);
      else if (c.type === 'Q') current.curves.push(['Q', ...P(c.x1 + x, c.y1, d), ...P(c.x + x, c.y, d)]);
      else if (c.type === 'C') current.curves.push(['C', ...P(c.x1 + x, c.y1, d), ...P(c.x2 + x, c.y2, d), ...P(c.x + x, c.y, d)]);
      // Z: the contour is closed by being a closed path; three.js does that for us.
    }
    x += widths[i];
  }
  // A space contributes an empty contour; anything with no curves is not a piece of a letter.
  return subs.filter((s) => s.curves.length > 1);
}

const font = opentype.parse(fs.readFileSync(FONT).buffer);
const subpaths = outlines(SIGN_TEXT, font, TRACKING);
if (!subpaths.length) throw new Error('no outlines: is the font file there?');

// Signed area of each contour: positive is an outer shape, negative is a counter (the hole in an O). The file
// keeps the sign, and src/sign.js uses it to decide which contours are holes.
const signedArea = (s) => {
  const pts = [s.start];
  for (const c of s.curves) pts.push(c.slice(-2));
  let a = 0;
  for (let i = 0; i < pts.length; i += 1) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
};
for (const s of subpaths) s.area = Math.round(signedArea(s));

const data = {
  // Where this came from, so a future edit knows the file is generated, not drawn by hand.
  generated: 'tools/make-sign.mjs',
  font: path.basename(FONT),
  text: SIGN_TEXT,
  unitsPerEm: font.unitsPerEm,
  // The cap height of the face, upright and unshifted: the sign is scaled by this, not by the ink of the
  // bowed line (which is taller than the letters by however much the bow lifts them).
  capHeight: font.tables.os2.sCapHeight,
  subpaths,
};
// A .js module rather than a .json file: it is a plain import everywhere (the dev server, the build, the
// tests) with no import attributes to negotiate.
fs.writeFileSync(OUT, `// Generated by tools/make-sign.mjs -- do not edit by hand.\n`
  + `// The letterforms of "${SIGN_TEXT}", as contours in font units (y up, baseline at 0).\n`
  + `export default ${JSON.stringify(data)};\n`);
const bytes = fs.statSync(OUT).size;
console.log(`${OUT}: ${SIGN_TEXT} -> ${subpaths.length} contours, ${subpaths.reduce((n, s) => n + s.curves.length, 0)} curves, ${bytes} bytes`);
