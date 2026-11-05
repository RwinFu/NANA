import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isGuest, joinAsset, GUEST_HAS, MAIN_HAS, GUEST_LOOK, GUEST_AS, GUEST_AS_LABEL, GUEST_AS_DEFAULT } from '../src/guest.js';

// `/guest` is the house sent to friends: no 2-D rescue game, no letter, no present, and two plainly dressed
// characters instead of the princess and her boy. These tests hold the three things that could quietly go
// wrong: the path matching, the file paths (the guest page sits one folder deeper than the main one), and the
// flags that switch the flow.

test('the guest house is the /guest path, and only that', () => {
  const yes = ['/NANA/guest', '/NANA/guest/', '/guest', '/guest/', '/NANA/guest/index.html'];
  const no = ['/', '/NANA/', '/NANA', '/NANA/guestbook', '/NANA/house', '/NANA/guest-house'];
  for (const pathname of yes) assert.equal(isGuest({ pathname }), true, `${pathname} should be the guest house`);
  for (const pathname of no) assert.equal(isGuest({ pathname }), false, `${pathname} should not be the guest house`);
});

test('the main house keeps everything the guest house leaves out', () => {
  // The main link must not change. Its own flags are a constant that never reads the guest switch, so a bug
  // in the guest house cannot take the letter or the present out of the family's house -- which is exactly
  // what happened once, when these were one set of constants read by both pages.
  for (const key of ['rescue', 'form', 'letter', 'present']) {
    assert.equal(MAIN_HAS[key], true, `the main house lost «${key}»`);
    assert.equal(GUEST_HAS[key], false, `the guest house gained «${key}»`);
  }
  const source = readFileSync(new URL('../src/guest.js', import.meta.url), 'utf8');
  const mainFlags = source.slice(source.indexOf('export const MAIN_HAS'), source.indexOf('};', source.indexOf('export const MAIN_HAS')));
  assert.doesNotMatch(mainFlags, /guest/, 'the main house’s flags depend on the guest switch');
  assert.doesNotMatch(source, /guest\s*=\s*(true|!)/, 'the guest flag is being written to');
});

test('the two guests are dressed plainly, and differently from the family', async () => {
  const { CHAR } = await import('../src/charpalette.js');
  // Her dress is not the family's rose, and his suit is not the family's coat colour.
  assert.notEqual(GUEST_LOOK.her.dress.toLowerCase(), CHAR.dress.toLowerCase());
  assert.notEqual(GUEST_LOOK.him.suit.toLowerCase(), CHAR.coat.toLowerCase());
  // A suit is one cloth: jacket and trousers are the same colour.
  assert.equal(GUEST_LOOK.him.suit, GUEST_LOOK.him.suit);
  assert.equal(GUEST_LOOK.him.tie.toLowerCase() === CHAR.bowTie.toLowerCase(), false, 'a guest wears a tie, not a bow tie');
});

test('a guest is dressed by branch, not by colour alone', () => {
  // A tiara, a hair bow, a waistcoat and epaulettes are geometry: the colours cannot remove them, so
  // characters.js has to branch. Three of those four are guarded; this is the test that keeps them guarded.
  const src = readFileSync(new URL('../src/characters.js', import.meta.url), 'utf8');
  assert.match(src, /if \(!guest\) addTiara\(head, goldMat\);/, 'the guest wears a tiara');
  assert.match(src, /if \(!guest\) \{[\s\S]{0,400}?bowMat/, 'the guest wears the hair bow');
  assert.match(src, /if \(!guest\) \{[\s\S]{0,600}?vestMat/, 'the guest wears the waistcoat');
  // (the comment sits above the guard, so the window starts before it)
  assert.match(src, /\/\/ shoulder epaulettes[\s\S]{0,500}?if \(!guest\)/, 'the guest wears epaulettes');
  assert.match(src, /if \(guest\) \{[\s\S]{0,400}?tieMat/, 'the guest has no tie');
});

test('the guest page sits one folder deeper and its files still resolve', () => {
  // Vite's base is './', so the main page at /NANA/ finds ./assets/x. The guest page is at /NANA/guest/,
  // where ./assets/x would be /NANA/guest/assets/x -- so the build rewrites the page's own URLs to ../, and
  // everything the app loads at run time goes through joinAsset with Vite's BASE_URL.
  assert.equal(joinAsset('./', 'memories/a.jpg'), './memories/a.jpg');
  assert.equal(joinAsset('../', 'memories/a.jpg'), '../memories/a.jpg');
  assert.equal(joinAsset('/NANA/', 'music/song.mp3'), '/NANA/music/song.mp3');
  assert.equal(joinAsset('/', 'cats/pastil.jpg'), '/cats/pastil.jpg');
  assert.equal(joinAsset('', 'x.jpg'), 'x.jpg');
  assert.equal(joinAsset('./', '/memories/a.jpg'), './memories/a.jpg', 'a leading slash must not become a site path');

  // Every runtime-loaded file goes through it, not through a bare BASE_URL.
  for (const file of ['src/memories.js', 'src/audio.js', 'src/rescue.js']) {
    const src = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /\$\{[^}]*BASE_URL[^}]*\}(memories|music|cats)/, `${file} still builds a path from BASE_URL`);
    assert.match(src, /assetUrl\(/, `${file} does not use assetUrl`);
  }
});

test('the guest page is its own entry point, and the main one is untouched', () => {
  const guest = readFileSync(new URL('../guest.html', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  // The guest page does not show the start screen: it opens at the gate.
  assert.match(guest, /id="intro"[^>]*hidden/, 'the guest page shows the start screen');
  assert.doesNotMatch(main, /id="intro"[^>]*hidden/, 'the main start screen is hidden');
  // Both load the same app; only the guest one sends the absolute asset paths its deeper folder needs.
  assert.match(guest, /src="\/src\/main\.js"/);
  assert.match(main, /src="\/src\/main\.js"/);
  // The build emits both pages.
  const vite = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');
  assert.match(vite, /guest: resolve\(__dirname, 'guest\.html'\)/, 'the guest page is not in the build');
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.match(pkg.scripts.build, /scripts\/build-pages\.mjs/, 'the build does not place the guest page');
});

test('her dress is the guest’s own, whatever the visitor’s browser remembers', () => {
  // The first run of the guest page painted the family's stored pink over the guest's plain dress. Two things
  // stop that: `setDress` ignores an empty colour, and main.js passes nothing for a house with no colour form.
  const chars = readFileSync(new URL('../src/characters.js', import.meta.url), 'utf8');
  assert.match(chars, /function setDress\(color\) \{\s*\n\s*if \(!color\) return;/, 'setDress accepts an empty colour');
  assert.match(chars, /const herDress = guest \? GUEST_LOOK\.her\.dress : dressColor;/, 'her dress is not chosen from the guest flag');

  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.doesNotMatch(main, /hero\??\.setDress\(store/, 'main.js still paints the stored colour directly');
  assert.doesNotMatch(main, /hero\??\.setDress\(state/, 'main.js still paints the form colour directly');
  assert.doesNotMatch(main, /hero\??\.setDress\(color\)/, 'the swatches still paint directly');
  assert.match(main, /hero\.setDress\(house\.form \? color : undefined\)/, 'setHerDress no longer withholds the colour');
});

test('the guest is asked which of the two they are, where the family’s house asks for a colour', async () => {
  // One question, in the same box: a guest is never asked for her dress colour, and the family's house is
  // never asked which of the two the visitor is.
  // (the module is imported here without a window, where `guest` is false and `house` is the family's -- so the
  // guest's own flags are what is checked)
  assert.equal(GUEST_HAS.form, false, 'a guest is asked for a dress colour');
  assert.equal(GUEST_HAS.person, true, 'a guest is not asked who they are');
  assert.equal(MAIN_HAS.form, true, 'the family house lost its dress colours');
  assert.equal(MAIN_HAS.person, false, 'the family house was given a character choice');
  assert.deepEqual([...GUEST_AS], ['him', 'her']);
  assert.equal(GUEST_AS_LABEL.him, 'پسر');
  assert.equal(GUEST_AS_LABEL.her, 'دختر');
  assert.ok(GUEST_AS.includes(GUEST_AS_DEFAULT), 'the screen opens with one of them already chosen');

  const guest = readFileSync(new URL('../guest.html', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  // The guest page has the two cards; the family's page does not have them at all.
  assert.match(guest, /id="people"[\s\S]{0,200}id="person-row"/, 'the guest page has no choice of characters');
  assert.doesNotMatch(main, /person-row/, 'the family start screen grew a character choice');
  assert.match(guest, /id="swatches"[^>]*hidden/, 'a guest is still asked for a dress colour');
  assert.doesNotMatch(main, /id="swatches"[^>]*hidden/, 'the family dress colours are hidden');
});

test('the guest opens on that screen, and the family house opens on its 2-D game', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  // The first frame reaches beginRescue(); only a guest is turned into the start screen from there.
  assert.match(main, /if \(!house\.rescue\) \{\s*openIntro\(\);\s*return;/,
    'a guest is sent somewhere other than the start screen');
  // openIntro shows it: the page starts hidden (so the castle is drawn first) and is unhidden here.
  assert.match(main, /function openIntro\(\)[\s\S]{0,700}?dom\.intro\.hidden = false;/,
    'the guest start screen is never shown');
  assert.match(main, /if \(house\.rescue\) \{\s*showHowTo\(/, 'the family\'s house no longer shows its instructions');
});

test('the guest walks the house alone: the one they did not choose is not there', () => {
  const chars = readFileSync(new URL('../src/characters.js', import.meta.url), 'utf8');
  // The one that matters: the second character is hidden, and its place beside her is emptied.
  assert.match(chars, /function setSwap\(asHim\) \{[\s\S]{0,300}?alone = true;/, 'the swap does not leave them alone');
  assert.match(chars, /boy\.visible = asHim;/, 'the character the guest did not choose is still drawn');
  assert.match(chars, /body\.scale\.set\(\(asHim \? -1 : 1\) \* PRINCESS_SCALE/, 'her own body is not turned to face out alone');
  // And the two things that need a second person are refused by the model itself, not only by the HUD.
  assert.match(chars, /function toggleHolding\(\) \{\s*if \(alone\) return false;/, 'a lone guest can take nobody by the hand');
  assert.match(chars, /function nextDance\(\) \{\s*if \(alone\) return null;/, 'a lone guest can dance alone');
  // The family's house never sets it. Its two calls are both guarded by `house.person`, and the third (the tap
  // on a card) is built inside a block that only a guest page has.
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const guarded = [...main.matchAll(/if \(house\.person\) setSceneSwap\(/g)].length;
  assert.equal(guarded, 2, "the guest's choice is not applied where the two are built and where the walk starts");
  const calls = [...main.matchAll(/setSceneSwap\(/g)].length - 1; // minus the definition
  assert.equal(calls, guarded + 1, 'a call to setSceneSwap is not guarded by house.person');
  // The two buttons are not offered either.
  assert.match(main, /'#finale-btn', '#letter-btn', '#hold-btn', '#dance-btn'/, 'the hand and the dance are still offered');
});

test('the guest page answers at /guest in development too', () => {
  // In production it is dist/guest/index.html; in development Vite serves the same entry for every path, but
  // it does not know `/guest` means the guest page -- and the page decides what it is from the path, not a
  // query, because that is the link that goes into a story.
  const vite = readFileSync(new URL('../vite.config.js', import.meta.url), 'utf8');
  assert.match(vite, /req\.url = '\/guest\.html'/, 'development does not route /guest to the guest page');
  assert.match(vite, /plugins: \[guestPageInDev\(\)\]/, 'the dev route is not installed');
});
