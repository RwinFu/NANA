import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// The photos are the visit: they must be downloading from the first moment the page can ask, and the
// whole set of them (both walls of the hall, every picture in the photo room) at that.
//
// They used to start inside buildWorld, after half a second of assembling the scene on the main
// thread — the network sat idle through exactly the moment it was free. And each frame made its own
// request through three.js, so nothing could ask for a photo without also building the frame.
//
// Now: one cache (src/photo-cache.js) with one request per photo, started by src/preload-photos.js as
// the first of the app's modules, and the frames attach the pictures as they land. A frame shows the
// "در حال بارگذاری" card it was born with until its own photo is decoded, so a photo still arriving is
// never an empty frame.

const read = (name) => fs.readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');

test('the photos are the first thing the app does', () => {
  const main = read('main.js');
  const imports = main.split('\n').filter((line) => line.startsWith('import '));
  const appModules = imports.filter((line) => line.includes("'./"));
  // the preload is the first of the app's own imports, before the world, the characters, anything
  assert.ok(appModules[0].includes('./preload-photos.js'), `first app import is ${appModules[0]}`);
  // and it is next to the top of the file, not buried
  assert.ok(main.split('\n').indexOf(appModules[0]) < 10, 'the preload must sit at the top of main.js');
});

test('every photo is asked for at once, and once only', () => {
  const preload = read('preload-photos.js');
  // every memory and the poster, not a subset
  assert.match(preload, /allMemories\.map\(\(memory\) => memory\.image\)/);
  assert.match(preload, /soloVideo\.poster/);
  assert.match(preload, /startPhotos\(/);

  const cache = read('photo-cache.js');
  // one request per URL, shared by everyone who wants it
  assert.match(cache, /const images = new Map\(\)/);
  assert.match(cache, /if \(!pending\)/);
  assert.match(cache, /images\.set\(url, pending\)/);
  // and it never re-downloads: there is no "start it later" for a picture
  assert.equal(/delete images/.test(cache), false, 'a photo must never be dropped and fetched again');
});

test('the frames take their photo from the cache, they do not fetch their own', () => {
  const world = read('world.js');
  // both walls, together, as soon as the frames exist
  assert.match(world, /loadPhotos\(frames\);/);
  assert.equal(/new THREE\.TextureLoader\(\)/.test(world), false, 'the world must not make its own image requests');
  // a frame that has its photo already, or is waiting, is not asked for a second time
  assert.match(world, /if \(frame\.loaded \|\| frame\.requested\) return;/);
  // and the poster rides the same cache
  assert.match(world, /photoImage\(soloVideo\.poster\)/);
});

test('nothing in the photo path unloads a picture once it has arrived', () => {
  const world = read('world.js');
  // the fallback is for a photo that failed, not for one that is late: applyPhoto scales the card that
  // was already there, so an empty frame is never shown
  assert.match(world, /const placeholder = canvasTexture\(/);
  assert.match(world, /applyPhoto\(frame, tex\)/);
  // and the clip downloads with the page too; it is its *playing* that waits for the couple
  assert.match(world, /roomVideo\.preload = 'auto'/);
  assert.match(world, /startRoomVideo\(\);/);
  assert.match(world, /videoPlayback\.sync\(/);
});

test('the page tells the browser about every photo before the app is parsed', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const memories = read('memories.js');
  const files = [...memories.matchAll(/memoryImage\('([^']+)'\)/g)].map((m) => m[1]);
  assert.ok(files.length >= 27, `only ${files.length} photos in memories.js`);
  const preloaded = [...html.matchAll(/<link rel="preload" as="image" href="\.\/memories\/([^"]+)" \/>/g)].map((m) => m[1]);
  // every photo the app shows is preloaded, and nothing else is
  assert.deepEqual([...preloaded].sort(), [...files].sort());
});
