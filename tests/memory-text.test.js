import test from 'node:test';
import assert from 'node:assert/strict';
import { allMemories } from '../src/memories.js';
import { memoryText, textFor } from '../src/memory-text.js';

// Every memory carries a title and a sentence, and since the copy was rewritten those live in
// src/memory-text.js (keyed by photo id) rather than inline in src/memories.js. These tests hold the two in
// step: a photo with no entry is a photo that still shows its old line.

test('every memory has a title and a caption, wherever they come from', () => {
  for (const memory of allMemories) {
    const { title, caption } = textFor(memory);
    assert.ok(title && title.trim(), `no title for ${memory.id}`);
    assert.ok(caption && caption.trim(), `no caption for ${memory.id}`);
  }
});

test('the written copy covers every photo in the house', () => {
  const written = Object.keys(memoryText).sort();
  const ids = allMemories.map((m) => m.id).sort();
  assert.deepEqual(written, ids, 'memory-text.js and memories.js list different photos');
});

test('no caption is a run-on: one idea, and it ends', () => {
  for (const [id, { caption }] of Object.entries(memoryText)) {
    // Two semicolons was how the old captions stacked clause on clause and then explained the feeling.
    assert.ok((caption.match(/؛/g) || []).length <= 1, `${id} has more than one ;`);
    assert.ok(caption.length <= 80, `${id} is ${caption.length} characters: it will run three lines`);
  }
});

test('the copy speaks to her, and does not narrate at her', () => {
  // The old captions were written from a distance: «نماد عشقی که هر روز پررنگ‌تر میشه», «تنها آرزوی من».
  // The house now talks in the first person singular only when it owns something (دلم، قاب محبوب دلم) and
  // addresses her directly (چشمات، خنده‌ات) -- it never sets «من» and «تو» opposite each other in one clause.
  for (const [id, { caption }] of Object.entries(memoryText)) {
    assert.ok(!/من و تو|من با تو|برای من/.test(caption), `${id} puts the two of them apart: ${caption}`);
  }
});

test('a title fits the card', () => {
  for (const [id, { title }] of Object.entries(memoryText)) {
    assert.ok(title.length <= 26, `${id} title is ${title.length} characters: ${title}`);
  }
});

test('an unknown memory falls back to its own text', () => {
  const lone = { id: 'not-written-yet', title: 'T', caption: 'C' };
  assert.deepEqual(textFor(lone), { title: 'T', caption: 'C' });
});
