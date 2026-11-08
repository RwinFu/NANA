import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { edition, defaults, memories, soloMemories, allMemories, letterParagraphs, soloVideo } from '../src/sale-content.js';
import { defaults as original, letterParagraphs as originalLetter } from '../src/memories.js';

const read = (path) => readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8');
const assetPath = (url) => url.slice(url.indexOf('sale/memories/'));
const local = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));

test('sale edition keeps the complete 18-frame hall and nine-frame room', () => {
  assert.equal(memories.length, 18);
  assert.equal(soloMemories.length, 9);
  assert.equal(allMemories.length, 27);
  assert.equal(new Set(allMemories.map((m) => m.id)).size, 27);
  assert.equal(new Set(allMemories.map((m) => m.image)).size, 27);
  for (const memory of allMemories) {
    assert.ok(memory.title && memory.caption && memory.chapter);
    assert.match(assetPath(memory.image), /^sale\/memories\//);
    assert.ok(existsSync(local(`sale-public/${assetPath(memory.image)}`)), memory.image);
    assert.match(memory.frame.color, /^#[0-9a-f]{6}$/i);
  }
});

test('sale names, letter and browser storage are independent of the personal edition', () => {
  assert.notEqual(defaults.fromName, original.fromName);
  assert.notEqual(defaults.toName, original.toNameJoint);
  assert.notDeepEqual(letterParagraphs, originalLetter);
  assert.notEqual(edition.storageKey, 'our-home-v10');
  assert.equal(edition.songUrl, null, 'the sale must not request the personal song');
  assert.ok(edition.music.chords.length >= 4);
  for (const name of [original.fromName, original.toName, original.toNameJoint]) {
    assert.ok(!JSON.stringify({ edition, defaults, letterParagraphs, memories, soloMemories }).includes(name));
  }
});

test('sale video and poster are synthetic-edition assets, not the personal clip', () => {
  assert.match(soloVideo.src, /sale\/memories\/motion-portrait\.mp4$/);
  const clip = local('sale-public/sale/memories/motion-portrait.mp4');
  assert.ok(existsSync(clip));
  assert.ok(statSync(clip).size < 1.6 * 1024 * 1024);
  const bytes = readFileSync(clip);
  assert.ok(bytes.indexOf('moov') < bytes.indexOf('mdat'), 'faststart');
  assert.ok(bytes.includes(Buffer.from('avc1')), 'H.264');
  assert.ok(!bytes.includes(Buffer.from('mp4a')), 'silent: no audio track');
  assert.ok(existsSync(local('sale-public/sale/memories/motion-portrait-poster.jpg')));
});

test('both sale pages preload exactly their own gallery and disclose fictional AI content', () => {
  for (const file of ['sale.html', 'sale-guest.html']) {
    const html = read(file);
    const preloaded = [...html.matchAll(/<link rel="preload" as="image" href="\/sale\/memories\/([^"]+)"/g)].map((m) => `sale/memories/${m[1]}`);
    assert.deepEqual(preloaded.sort(), [...allMemories.map((m) => assetPath(m.image)), assetPath(soloVideo.poster)].sort());
    assert.match(html, /تولیدشده با هوش مصنوعی/);
    assert.match(html, /خانه‌ی مهر/);
    assert.doesNotMatch(html, /آروین|فائق| OUR HOUSE|khooneye|href="\.\/memories/);
    for (const id of ['scene', 'setup', 'enter-btn', 'memory-dialog', 'letter-dialog', 'video-player', 'postcard-download', 'help-dialog']) {
      assert.ok(html.includes(`id="${id}"`), `${file} missing ${id}`);
    }
  }
});

test('sale build copies only sale-public and replaces the content and sign modules', () => {
  const config = read('vite.sale.config.js');
  assert.match(config, /publicDir: 'sale-public'/);
  assert.match(config, /src\/sale-content\.js/);
  assert.match(config, /src\/sale-sign-outline\.js/);
  assert.match(config, /outDir: 'dist-sale'/);
  assert.match(read('package.json'), /build:sale/);
  assert.match(read('scripts/check-sale.mjs'), /Personal asset directory/);
});

test('GitHub Pages builds the sale beside the personal house and both guest pages', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.scripts.build, /npm run build:sale/);
  assert.match(pkg.scripts.build, /scripts\/build-pages\.mjs/);
  const pages = read('scripts/build-pages.mjs');
  assert.match(pages, /cp\('dist-sale', join\(dist, 'sale'\), \{ recursive: true \}\)/);
  assert.match(pages, /dist\/sale\/guest\/index\.html/);
  const workflow = read('.github/workflows/deploy.yml');
  assert.match(workflow, /run: npm run build/);
  assert.match(workflow, /path: \.\/dist/);
  assert.match(workflow, /\/NANA\/sale\/guest\//);
});
