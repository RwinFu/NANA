import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// The clip is the only film in the house, and it has to be ready when it is asked for — both on the
// wall screen in the photo room and in the big panel. It used to wait: `preload = 'none'`, downloaded
// only when the couple walked up to the screen, and the panel dropped its stream on close so every
// second tap started the 1.08 MB download again. What a player saw was the poster, then a pause.
//
// It is now downloaded with the page (the two-minute gate is the cover), and only its *playing* waits
// for the couple to come near — so nothing decodes for a screen nobody is looking at, and nothing has
// to be fetched when the screen is opened.

const read = (name) => fs.readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');

test('the wall screen downloads the clip from the start and plays it near the couple', () => {
  const world = read('world.js');
  assert.match(world, /roomVideo\.preload = 'auto'/);
  // started while the world is built, not from a trigger on the walk
  assert.match(world, /startRoomVideo\(\);/);
  // and never autoplaying: that is a live decoder through the whole gate
  assert.match(world, /roomVideo\.autoplay = false/);
  // playback is decided by the distance rule that already existed
  assert.match(world, /videoPlayback\.sync\(shouldPlayVideo\(/);
});

test('the big panel has the clip already, so a tap plays it', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const player = html.match(/<video id="video-player"[^>]*>/);
  assert.ok(player, 'the panel player is in index.html');
  assert.match(player[0], /preload="auto"/, 'the panel must not start its download on the tap');
  assert.match(player[0], /muted/, 'the clip is silent');
  assert.match(player[0], /playsinline/);

  const main = read('main.js');
  // opening the panel sets the source only if something cleared it, and plays the copy that is there
  assert.match(main, /if \(!player\.getAttribute\('src'\)\) player\.src = VIDEO_SRC;/);
  // closing it no longer throws the download away (the postcard image may still be cleared; the clip
  // may not)
  const closePanel = main.slice(main.indexOf('function closeVideoPanel'), main.indexOf('function closeVideoPanel') + 500);
  assert.equal(/removeAttribute\('src'\)/.test(closePanel), false, 'closing the panel must not drop the clip');
  // the clip is still muted when it plays, on any phone
  assert.match(main, /player\.muted = true/);
  assert.equal(/player\.muted\s*=\s*false/.test(main), false, 'nothing may unmute the clip');
});

test('only one copy of the clip is ever decoded', () => {
  const main = read('main.js');
  const world = read('world.js');
  // the panel and the wall screen each have one element; while the panel is open the world pauses the
  // wall screen (it is behind a dialog), and neither element is created twice
  assert.equal((world.match(/document\.createElement\('video'\)/g) || []).length, 1);
  assert.match(main, /function closeVideoPanel/);
  assert.match(main, /player\.pause\(\)/);
});

test('the clip file itself is small, silent and fast-start', () => {
  const size = fs.statSync(new URL('../public/memories/solo-video.mp4', import.meta.url)).size;
  assert.ok(size < 1.4 * 1024 * 1024, `the clip is ${(size / 1048576).toFixed(2)} MB`);
  // the poster is what is on the screen until the first frame decodes
  const poster = fs.statSync(new URL('../public/memories/solo-video-poster.jpg', import.meta.url)).size;
  assert.ok(poster < 120 * 1024, `the poster is ${(poster / 1024).toFixed(0)} KB`);
});
