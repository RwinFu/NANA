import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The scene itself is tested in gift.test.js against the real props. This file is the *wiring* check: that
// main.js actually starts it, at the right moment, and does not leave the necklace in the world.
//
// It reads the source instead of importing it because main.js builds a renderer, a world and a couple the
// moment it loads. A regex check is blunter than a unit test, but it is the only way to prove the call is
// in the frame loop without a browser.

const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

test('the gift is checked and driven from the frame loop', () => {
  assert.match(main, /if \(started\) checkGift\(\)/, 'the trigger runs every frame');
  assert.match(main, /if \(started\) updateGift\(dt\)/, 'and the scene advances');
});

test('it is triggered by being inside the castle and then outside it', () => {
  assert.match(main, /function inHallNow\(\)/, 'there is an "is inside the hall" rule');
  assert.match(main, /function outOfHallNow\(\)/, 'and an "is back outside" rule');
  assert.match(main, /if \(inHallNow\(\)\) \{\n    wasInsideCastle = true;/, 'entering is remembered');
  assert.match(main, /giftReady\(\{ wasInside: wasInsideCastle, isOutside: outOfHallNow\(\)/,
    'and coming out is what fires the scene');
  // the doorway itself must not count as "inside", or the scene fires as they pass through it
  assert.match(main, /CASTLE_INSIDE_Z = -1\.5/, 'inside means well past the door');
  assert.match(main, /CASTLE_OUTSIDE_Z = 1\.2/, 'outside means clear of it');
});

test('the scene is offered once, and only when nothing else owns the screen', () => {
  assert.match(main, /if \(!started \|\| gift \|\| giftGiven \|\| !introFairy \|\| letterView \|\| anyDialogOpen\(\)\) return;/);
  assert.match(main, /giftGiven = true;/, 'and it cannot happen twice');
});

test('the fairy carries the box, and the box is what the necklace rises from', () => {
  assert.match(main, /giftBox = createGiftBox\(/, 'the box is built');
  assert.match(main, /introFairy\.attachGiftBox\(giftBox, giftBox\.setOpen\)/, 'and handed to the fairy');
  assert.match(main, /introFairy\.beginReturn\(/, 'the return flight is what starts the scene');
});

test('the necklace ends up on her body, and stays there', () => {
  assert.match(main, /necklace = createNecklace\(/, 'the necklace is built once');
  assert.match(main, /hero\.root\.add\(necklace\.worn\)/, 'it is a child of the couple, so it moves with her');
  // while it is in the air it is in the scene; once it settles it is moved back onto her, permanently
  assert.match(main, /if \(necklace\.group\.parent !== necklace\.worn\) necklace\.worn\.add\(necklace\.group\);/);
  assert.match(main, /necklace\.worn\.visible = true;/, 'and it is made visible, not left hidden');
  // the shimmer must keep running after the scene: this is the line that proves it does
  assert.match(main, /if \(giftGiven && necklace\) necklace\.update\(clock\.elapsedTime, dt, 1\);/);
});

test('the couple face the fairy while she presents, as they do for the letter', () => {
  assert.match(main, /if \(beat === 'present' && gift\.beat !== 'present'\) \{/);
  assert.match(main, /controls\.faceToward\(box\.x, box\.z\);/);
});

test('the scene does not add a light to the garden', () => {
  // it is a twelve-second moment in an already-lit scene; the box's glow is a sprite, not a point light
  const giftSources = ['src/gift.js', 'src/necklace.js', 'src/gift-box.js']
    .map((p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
  for (const source of giftSources) {
    assert.doesNotMatch(source, /new THREE\.PointLight|new THREE\.SpotLight|new THREE\.DirectionalLight/,
      'no new lights in the gift');
  }
});
