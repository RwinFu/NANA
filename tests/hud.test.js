import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Two things were taken out of the family's house: the «جشن سالگرد» chip in the bar, and the keyboard card that
// sat at the bottom of the screen. These tests keep them out -- of both pages, so the two stay one page -- and
// keep the things that are still reachable still reachable.

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('the anniversary chip and the keyboard card are not on either page', () => {
  for (const file of ['index.html', 'guest.html']) {
    const html = read(file);
    assert.doesNotMatch(html, /id="finale-btn"/, `${file} still has the anniversary chip`);
    assert.doesNotMatch(html, /classes?="chip"[^>]*>\s*جشن سالگرد/, `${file} still has the anniversary label`);
    assert.doesNotMatch(html, /controls-hint/, `${file} still has the keyboard card`);
    assert.doesNotMatch(html, /<kbd>W<\/kbd>/, `${file} still lists the walking keys on the screen`);
  }
  // ...and nothing in the game reads them any more: an element that is not there cannot be unhidden, and
  // `$('#controls-hint').hidden = ...` on null would take the whole start of the walk down with it.
  const main = read('src/main.js');
  assert.doesNotMatch(main, /controls-hint/, 'main.js still looks for the keyboard card');
  assert.doesNotMatch(main, /finale-btn/, 'main.js still looks for the anniversary chip');
});

test('what those two were for is still there', () => {
  // The anniversary note is a dialog, and the help card is where the keys are explained now.
  const html = read('index.html');
  assert.match(html, /id="finale-dialog"/, 'the anniversary dialog was removed as well');
  assert.match(html, /id="help-dialog"/, 'the help card was removed');
  assert.match(html, /<kbd>W A S D<\/kbd>/, 'the keys are no longer explained anywhere');
  // The postcard is reached from the anniversary card, and that card is still there.
  assert.match(html, /id="finale-photo"/, 'the postcard lost its way in');
  // Every button the bar still has is wired up.
  const main = read('src/main.js');
  for (const id of ['letter-btn', 'hold-btn', 'dance-btn', 'photo-btn', 'music-btn', 'help-btn']) {
    assert.match(html, new RegExp(`id="${id}"`), `the bar lost ${id}`);
  }
  assert.match(main, /addEventListener\('click'/, 'the bar has no handlers at all');
});
