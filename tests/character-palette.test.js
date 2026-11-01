import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CHAR, luma } from '../src/charpalette.js';

// The characters' colours, held to the same standard as the hall's: one family, and enough
// separation that no part of either of them disappears.
//
// What went wrong before: a tan skin beside almost-black hair, a coat of navy so dark that on a
// moonlit night it and the trousers were one silhouette, and a dress of pure red that clipped to
// orange under the warm chandeliers. None of that is visible in a source diff, so it is checked here.

const channels = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

test('every character colour is a plain hex, and the palette has no duplicates', () => {
  const values = Object.values(CHAR);
  values.forEach((c) => assert.match(c, /^#[0-9a-f]{6}$/, `${c} is not a hex colour`));
  // the skin, hair, dress, coat and trousers are all distinct
  const key = ['skin', 'hair', 'dress', 'coat', 'trousers', 'shirt', 'gold'];
  assert.equal(new Set(key.map((k) => CHAR[k])).size, key.length, 'two key surfaces share a colour');
});

test('the boy is not one dark mass: coat, trousers, shirt and gold are far apart', () => {
  // luminance alone is not enough (navy and brown can match), so compare the channel spread too
  const spread = (a, b) => {
    const [x, y] = [channels(a), channels(b)];
    return Math.max(Math.abs(x[0] - y[0]), Math.abs(x[1] - y[1]), Math.abs(x[2] - y[2]));
  };
  const pairs = [
    ['coat', 'trousers'],
    ['coat', 'shirt'],
    ['coat', 'gold'],
    ['trousers', 'shirt'],
    ['coat', 'belt'],
    ['vest', 'coat'],
  ];
  for (const [a, b] of pairs) {
    assert.ok(spread(CHAR[a], CHAR[b]) > 18,
      `${a} (${CHAR[a]}) and ${b} (${CHAR[b]}) are too close: ${spread(CHAR[a], CHAR[b])}`);
  }
  // and the coat itself is a real colour, not a near-black
  assert.ok(luma(CHAR.coat) > 0.09, `the coat is a silhouette: luma ${luma(CHAR.coat).toFixed(3)}`);
  assert.ok(luma(CHAR.trousers) > 0.05, 'the trousers are black');
});

test('the princess reads against her own dress', () => {
  // sash, lace and pearls have to separate from the dress; a pink sash on a pink dress did not
  const spread = (a, b) => {
    const [x, y] = [channels(a), channels(b)];
    return Math.max(Math.abs(x[0] - y[0]), Math.abs(x[1] - y[1]), Math.abs(x[2] - y[2]));
  };
  assert.ok(spread(CHAR.sash, CHAR.dress) > 25, `the sash vanishes into the dress (${spread(CHAR.sash, CHAR.dress)})`);
  assert.ok(spread(CHAR.lace, CHAR.dress) > 60, 'the lace has to be nearly white against the dress');
  assert.ok(spread(CHAR.petticoat, CHAR.dress) > 45, 'the petticoat has to be lighter than the dress');
  // her hair is a warm brown, not a black cap
  assert.ok(luma(CHAR.hair) > 0.02, 'the hair is black');
  assert.ok(channels(CHAR.hair)[0] > channels(CHAR.hair)[2] + 8, 'her hair should be warm, red-brown over blue');
});

test('skin is light enough to carry a face at three metres', () => {
  // a face under this game's night light: the skin has to come out well above the dark hall walls
  assert.ok(luma(CHAR.skin) > 0.5, `skin is too dark to read: ${luma(CHAR.skin).toFixed(2)}`);
  assert.ok(luma(CHAR.skin) > luma(CHAR.skinShade) + 0.1, 'the skin shade should be a shade, not a second skin');
});

test('the two of them do not wear the same colours', () => {
  const [a, b] = [channels(CHAR.coat), channels(CHAR.dress)];
  // a warm dress against a cool coat: the red channel wins on one, the blue on the other
  assert.ok(a[2] > a[0], 'the coat should be the cool one');
  assert.ok(b[0] > b[2] + 40, 'the dress should be the warm one');
});

test('materials are built from the palette, not from literals scattered through the files', () => {
  const src = fs.readFileSync(new URL('../src/characters.js', import.meta.url), 'utf8');
  assert.match(src, /import \{ CHAR \} from '\.\/charpalette\.js';/, 'characters.js must read the palette');
  // the surfaces that have to stay in the family come from it
  for (const key of ['skin', 'hair', 'coat', 'trousers', 'shoe', 'shirt', 'gold', 'sash', 'lace', 'petticoat', 'belt', 'vest', 'bowTie']) {
    assert.match(src, new RegExp(`CHAR\\.${key}\\b`), `characters.js does not use CHAR.${key}`);
  }
});
