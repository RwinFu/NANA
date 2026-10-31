import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('gate starts the song without a static burst', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const audio = readFileSync(new URL('../src/audio.js', import.meta.url), 'utf8');
  assert.match(main, /onGate:\s*\(\)\s*=>\s*\{\s*audio\.startSong\(\);\s*\}/);
  assert.doesNotMatch(main, /audio\.static\(/);
  assert.doesNotMatch(audio, /static\(duration/);
});
