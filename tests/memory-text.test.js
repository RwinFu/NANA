import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { allMemories } from '../src/memories.js';
import { memoryText, textFor } from '../src/memory-text.js';

// The memory card names the frame and stops. There is no caption under the photograph any more -- that was
// the part of this dialog that never read right -- so these tests hold three things: every photo is named,
// the names are short enough to sit on one or two lines, and the dialog really has no caption left in it.

test('every memory has a title, wherever it comes from', () => {
  for (const memory of allMemories) {
    const { title } = textFor(memory);
    assert.ok(title && title.trim(), `no title for ${memory.id}`);
  }
});

test('the written names cover every photo in the house', () => {
  const written = Object.keys(memoryText).sort();
  const ids = allMemories.map((m) => m.id).sort();
  assert.deepEqual(written, ids, 'memory-text.js and memories.js list different photos');
});

test('a name is a name, not a sentence', () => {
  for (const [id, { title }] of Object.entries(memoryText)) {
    // Four words at most: the title line is Lalezar at up to 46 px and has one line to spend.
    assert.ok(title.split(/\s+/).length <= 4, `${id} runs to ${title.split(/\s+/).length} words: ${title}`);
    assert.ok(title.length <= 24, `${id} is ${title.length} characters: ${title}`);
    assert.ok(!/[.،؛]$/.test(title), `${id} ends like a sentence: ${title}`);
  }
});

test('the names are about the two of them', () => {
  // The house is theirs: «دونفره», «کنار هم», «همیشه». Not «من» narrating at «تو».
  const joined = Object.values(memoryText).map((t) => t.title).join(' ');
  assert.ok(/دونفره|کنار هم|با هم|همیشه|ما/.test(joined), 'not one name speaks for the pair');
});

test('the memory card has no caption left in the document or the dialog', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const memoryDialog = html.slice(html.indexOf('id="memory-dialog"'), html.indexOf('id="video-dialog"'));
  assert.match(memoryDialog, /id="memory-title"/, 'the title is still there');
  assert.doesNotMatch(memoryDialog, /memory-caption/, 'the photograph still has a caption element');
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.doesNotMatch(main, /memory-caption/, 'main.js still writes a caption');
});

test('an unknown memory falls back to the text it carries', () => {
  assert.deepEqual(textFor({ id: 'not-written-yet', title: 'T' }), { title: 'T' });
});
