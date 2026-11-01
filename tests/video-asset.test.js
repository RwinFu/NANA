import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// The room's clip is shipped as a web-safe, lightweight file. A phone-sized screen shows it
// about 2.8 m wide, so a bigger file buys no visible detail, only stutter and slow starts.
const clip = fileURLToPath(new URL('../public/memories/solo-video.mp4', import.meta.url));
const poster = fileURLToPath(new URL('../public/memories/solo-video-poster.jpg', import.meta.url));

// Minimal MP4 reader: find the boxes this test cares about.
function boxes(buffer, start, end) {
  const out = [];
  let offset = start;
  while (offset + 8 <= end) {
    const size = buffer.readUInt32BE(offset);
    const type = buffer.toString('latin1', offset + 4, offset + 8);
    if (size < 8) break;
    out.push({ type, start: offset, body: offset + 8, end: Math.min(offset + size, end) });
    offset += size;
  }
  return out;
}
function find(buffer, start, end, path) {
  let from = start;
  for (const type of path) {
    const next = boxes(buffer, from, end).find((b) => b.type === type);
    if (!next) return null;
    from = next.body;
    end = next.end;
    if (type === path[path.length - 1]) return next;
  }
  return null;
}

test('the clip is light enough to start quickly on a phone', () => {
  assert.ok(existsSync(clip), 'the video is in public/memories');
  const bytes = statSync(clip).size;
  assert.ok(bytes < 1.6 * 1024 * 1024, `clip is ${(bytes / 1024 / 1024).toFixed(2)} MB, expected under 1.6 MB`);
});

function readMovie(path) {
  const buffer = readFileSync(path);
  const moov = buffer.indexOf('moov');
  const mdat = buffer.indexOf('mdat');
  assert.ok(moov > 0 && mdat > 0, `${path} is an MP4`);
  const moovBox = boxes(buffer, moov - 4, buffer.length)[0];
  const tracks = boxes(buffer, moovBox.body, moovBox.end).filter((b) => b.type === 'trak');
  const info = tracks.map((track) => {
    const stbl = find(buffer, track.body, track.end, ['mdia', 'minf', 'stbl']);
    const stsd = boxes(buffer, stbl.body, stbl.end).find((b) => b.type === 'stsd');
    const entry = boxes(buffer, stsd.body + 8, stsd.end)[0];
    return {
      codec: entry.type,
      width: entry.type === 'avc1' ? buffer.readUInt16BE(entry.body + 24) : 0,
      height: entry.type === 'avc1' ? buffer.readUInt16BE(entry.body + 26) : 0,
    };
  });
  return { faststart: moov < mdat, tracks: info };
}

test('the in-world clip is a light, silent H.264 file (a phone only autoplays muted video)', () => {
  const { faststart, tracks } = readMovie(clip);
  assert.ok(faststart, 'the index comes before the media, so playback starts before the download ends');
  assert.deepEqual(tracks.map((t) => t.codec), ['avc1'], 'one H.264 video track and no audio');
  const [{ width, height }] = tracks;
  assert.ok(height >= width, 'keeps the portrait framing');
  assert.ok(height <= 1280 && width <= 720, `frames are ${width}x${height}, expected at most 720x1280`);
});

test('the wildcard: nothing in the game can play video sound', () => {
  // The clip has no sound track, and neither the panel nor the wall screen may unmute it.
  const main = readFileSync(fileURLToPath(new URL('../src/main.js', import.meta.url)), 'utf8');
  const world = readFileSync(fileURLToPath(new URL('../src/world.js', import.meta.url)), 'utf8');
  assert.ok(!/player\.muted\s*=\s*false/.test(main), 'the panel never unmutes the clip');
  assert.ok(!/soundSrc/.test(main) && !/soundSrc/.test(world), 'no second, louder copy is wired in');
  assert.ok(!existsSync(fileURLToPath(new URL('../public/memories/solo-video-full.mp4', import.meta.url))),
    'the copy with sound is not shipped');

  const { tracks } = readMovie(clip);
  assert.ok(!tracks.some((t) => t.codec === 'mp4a'), 'the shipped clip has no audio track');
});

test('the poster frame ships next to the clip', () => {
  assert.ok(existsSync(poster));
  const bytes = statSync(poster).size;
  assert.ok(bytes < 200 * 1024, `poster is ${(bytes / 1024).toFixed(0)} KB, expected under 200 KB`);
  const head = readFileSync(poster).subarray(0, 2);
  assert.deepEqual([...head], [0xff, 0xd8], 'a JPEG');

});
