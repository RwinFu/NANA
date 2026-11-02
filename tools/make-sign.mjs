// Turn a text line into a three.js geometry, once, ahead of the game.
//
// The facade's sign is cut from real letter outlines, not traced from a bitmap. The outlines come from
// Lalezar's own glyph data, which is parsed here at build time (opentype.js is a dev-only tool -- nothing in
// src/ imports this script) and written out as a JSON file that src/sign.js extrudes at run time.
//
// Why not shape the text in the browser, the way a canvas would? The canvas API returns pixels, and turning
// pixels back into outlines gives you either a huge triangle count or a blocky silhouette (both were tried:
// a traced sign came out at 3,050 triangles for one line, and at a coarse enough trace the O's became
// diamonds). Real outlines are cheap -- this line is a few hundred triangles -- and they are exact.
//
// Usage: node tools/make-sign.mjs
// Reads node_modules/@fontsource/lalezar/files/lalezar-latin-400-normal.woff (already a dependency of the
// page, so the sign and the headings can never drift to different faces) and writes src/sign-outline.js.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FONT = path.join(root, 'node_modules/@fontsource/lalezar/files/lalezar-latin-400-normal.woff');
const OUT = path.join(root, 'src/sign-outline.js');

// The line on the front of the house. Caps only: Lalezar is a display face, and in caps it reads as a name.
export const SIGN_TEXT = 'OUR HOUSE';
// Extra space between letters, in font units (1000 to the em). Lalezar's caps sit tight; a sign in caps
// wants air, and this is the air.
const TRACKING = 40;

/** Read the glyph outlines of `text` out of the font, as flat polygons in font units. */
function outlines(text, font, tracking) {
  const glyphs = font.stringToGlyphs(text);
  const subs = [];
  let x = 0;
  for (let i = 0; i < glyphs.length; i += 1) {
    const glyph = glyphs[i];
    if (i > 0) x += (font.getKerningValue(glyphs[i - 1], glyph) || 0) + tracking;
    const pathData = glyph.getPath(x, 0, font.unitsPerEm, {});
    let current = null;
    for (const c of pathData.commands) {
      if (c.type === 'M') {
        current = { start: [c.x, c.y], curves: [] };
        subs.push(current);
      } else if (c.type === 'L') current.curves.push(['L', c.x, c.y]);
      else if (c.type === 'Q') current.curves.push(['Q', c.x1, c.y1, c.x, c.y]);
      else if (c.type === 'C') current.curves.push(['C', c.x1, c.y1, c.x2, c.y2, c.x, c.y]);
      else if (c.type === 'Z') current.closed = true;
    }
    x += glyph.advanceWidth;
  }
  // opentype gives outlines in y-down (canvas/SVG) coordinates: the baseline is y=0 and the tops of the
  // letters are at negative y. three.js is y-up, so every y is negated here, once, and the rest of the
  // pipeline never has to think about it again.
  // Each command is ['L', x, y] / ['Q', cx, cy, x, y] / ['C', c1x, c1y, c2x, c2y, x, y], so the y of every
  // point is the last of each pair: it is those that change sign, never the x.
  for (const s of subs) {
    s.start[1] = -s.start[1];
    for (const c of s.curves) {
      for (let i = 2; i < c.length; i += 2) c[i] = -c[i];
    }
  }
  // Round, so the file's numbers stay short and the geometry is reproducible.
  const r = (v) => Math.round(v * 100) / 100;
  // The file stores x first, y second for every point, plus the command letter. A quadratic is then
  // ['Q', cx, cy, x, y].
  return subs.map((s) => ({
    start: s.start.map(r),
    curves: s.curves.map((c) => c.map((v) => (typeof v === 'number' ? r(v) : v))),
  }));
}

const font = opentype.parse(fs.readFileSync(FONT).buffer);
const subpaths = outlines(SIGN_TEXT, font, TRACKING);
if (!subpaths.length) throw new Error('no outlines: is the font file there?');

// Signed area of each contour: positive is an outer shape, negative is a counter (the hole in an O). The file
// keeps the sign, and src/sign.js uses it to decide which contours are holes.
const signedArea = (s) => {
  const pts = [s.start.slice()];
  for (const c of s.curves) pts.push(c.slice(-2));
  let a = 0;
  for (let i = 0; i < pts.length; i += 1) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
};
for (const s of subpaths) s.area = signedArea(s);
// A space has no ink and leaves a contour with nothing in it; anything with real area is a piece of a letter.
const kept = subpaths.filter((s) => Math.abs(s.area) > 100);

const data = {
  // Where this came from, so a future edit knows the file is generated, not drawn by hand.
  generated: 'tools/make-sign.mjs',
  font: path.basename(FONT),
  text: SIGN_TEXT,
  unitsPerEm: font.unitsPerEm,
  capHeight: font.tables.os2.sCapHeight,
  subpaths: kept,
};
// A .js module rather than a .json file: it is a plain import everywhere (the dev server, the build, the
// tests) with no import attributes to negotiate.
fs.writeFileSync(OUT, `// Generated by tools/make-sign.mjs -- do not edit by hand.\n`
  + `// The letterforms of "${SIGN_TEXT}", as contours in font units (y up, baseline at 0).\n`
  + `export default ${JSON.stringify(data)};\n`);
const bytes = fs.statSync(OUT).size;
console.log(`${OUT}: ${SIGN_TEXT} -> ${kept.length} contours, ${kept.reduce((n, s) => n + s.curves.length, 0)} curves, ${bytes} bytes`);
