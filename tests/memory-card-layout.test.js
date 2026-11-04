import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The card that opens on a frame used to spend half of itself on words -- a name, then a sentence -- and
// capped the photograph at 58vh beside them. The house asked for the words to go and for the frame to be
// shown large, so the card is now the photograph and the pager and nothing else. These tests hold that,
// because it is the kind of thing that comes back: a heading here, a caption line there, and the picture is
// small again without anyone deciding to make it small.

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

const card = html.slice(html.indexOf('id="memory-dialog"'), html.indexOf('id="video-dialog"'));

test('the card carries no text of its own', () => {
  assert.doesNotMatch(card, /memory-title/, 'the card has a title element again');
  assert.doesNotMatch(card, /memory-line/, 'the card has a sentence element again');
  assert.doesNotMatch(card, /memory-caption|memory-chapter|memory-frame-name/, 'caption furniture is back');
  // The only text allowed in the card is the count and the two pager buttons.
  const texts = [...card.matchAll(/>([^<>]+)</g)].map((m) => m[1].trim()).filter(Boolean);
  // «×» is the close button's glyph, not a line of copy.
  for (const text of texts) {
    assert.match(text, /^(×|قبلی|بعدی|‹ قبلی|بعدی ›)$/, `the card shows the text «${text}»`);
  }
});

test('showMemory writes no words onto the card', () => {
  const start = main.indexOf('function showMemory(');
  const end = main.indexOf('\nfunction ', start + 10);
  const fn = main.slice(start, end);
  const writes = fn.match(/\$\('#[\w-]+'\)\.textContent/g) || [];
  assert.deepEqual(writes, ["$('#memory-count').textContent"], 'showMemory writes words, not just the count');
  assert.doesNotMatch(fn, /memoryText|textFor/, 'showMemory still looks up card text');
});

test('the card is sized to the window, and the photograph to the card', () => {
  const sheet = css.slice(css.indexOf('.memory-sheet[open] {'), css.indexOf('.memory-frame {'));
  // The card hugs the photograph rather than being a fixed panel with a small picture inside it.
  assert.match(sheet, /width:\s*fit-content/, 'the card no longer hugs the photograph');
  assert.match(sheet, /max-width:\s*calc\(100vw - 20px\)/, 'the card no longer grows with the window');
  assert.match(sheet, /max-height:\s*calc\(100dvh - 20px\)/, 'the card no longer fills the screen height');
  const img = css.slice(css.indexOf('.memory-frame img {'), css.indexOf('/* The pager, under the photograph.'));
  // The photograph keeps the window height less the card's paper, the frame's matting, the close button's
  // strip and the pager bar -- which is what "show the frame large" means in numbers.
  assert.match(img, /max-height:\s*calc\(100dvh - 2\d\dpx\)/, 'the photograph does not take the window height');
  // The old cap that kept the photo at little more than half the screen is gone.
  assert.doesNotMatch(img, /max-height:\s*58vh/, 'the 58vh cap is back on the photograph');
});

test('the pager sits under the photograph, not beside it', () => {
  assert.match(card, /class="memory-bar"/, 'the pager bar is gone');
  // A two-column sheet gives half the card to text that no longer exists.
  const sheet = css.slice(css.indexOf('.memory-sheet[open] {'), css.indexOf('.memory-frame {'));
  assert.doesNotMatch(sheet, /grid-template-columns:\s*minmax\(0, 1\.1fr\)/, 'the card is two columns again');
  assert.match(sheet, /grid-template-rows/, 'the card is not stacked photo-over-pager');
});

// The room's clip is shown the same way: no title, no caption, no «بی‌صدا» tag, and the clip as large as
// the window allows. It used to sit in the same two-column sheet as the photographs, capped at 58vh, with
// three lines of copy taking the other half of the card.
const videoCard = html.slice(html.indexOf('id="video-dialog"'), html.indexOf('</dialog>', html.indexOf('id="video-dialog"')));

test('the video card carries no text either', () => {
  assert.doesNotMatch(videoCard, /video-title|video-copy|memory-caption|memory-meta/, 'the clip has copy again');
  const texts = [...videoCard.matchAll(/>([^<>]+)</g)].map((m) => m[1].trim()).filter(Boolean);
  assert.deepEqual(texts, ['×'], `the clip card shows the text ${texts.join(', ')}`);
});

test('the clip is sized like the photographs', () => {
  const sheet = css.slice(css.indexOf('dialog.video-sheet[open] {'), css.indexOf('.video-media {'));
  assert.match(sheet, /width:\s*fit-content/, 'the video card no longer hugs the clip');
  assert.match(sheet, /max-height:\s*calc\(100dvh - 20px\)/, 'the video card no longer fills the screen height');
  assert.doesNotMatch(sheet, /grid-template-columns/, 'the video card is two columns again');
  const video = (css.match(/\.video-frame video \{([^}]*)\}/) || [, ''])[1];
  // The 1 before the digits was a literal «1», not part of the pattern: the rule is 196px.
  assert.match(video, /max-height:\s*calc\(100dvh - \d{3}px\)/, 'the clip does not take the window height');
  assert.doesNotMatch(video, /max-height:\s*58vh/, 'the 58vh cap is back on the clip');
});
