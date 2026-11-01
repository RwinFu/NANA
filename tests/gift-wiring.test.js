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
  // Its frame matters: NECK_POSE is measured in her *body* (the frame the gold choker is built in, which
  // is scaled 0.68), so mounting it on the root would leave it unscaled and half a metre too high.
  assert.match(main, /hero\.dressSpace\.add\(necklace\.worn\)/, 'it is a child of her body, so it moves with her');
  assert.doesNotMatch(main, /hero\.root\.add\(necklace\.worn\)/, 'and not of her root, which is 1/0.68 too big');
  assert.match(main, /outNeck\.set\(0, NECK_POSE\.y, NECK_POSE\.z\);\n  hero\.dressSpace\.localToWorld\(outNeck\);/,
    'the flight lands in the same frame it is mounted in');
  assert.doesNotMatch(main, /NECK_Y|NECK_Z/, 'one neck constant, so the flight and the mount cannot drift apart');
  // while it is in the air it is in the scene; once it settles it is moved back onto her, permanently
  assert.match(main, /if \(necklace\.group\.parent !== necklace\.worn\) necklace\.worn\.add\(necklace\.group\);/);
  assert.match(main, /if \(necklace\.worn\.parent !== hero\.dressSpace\) hero\.dressSpace\.add\(necklace\.worn\);/,
    'the mount is re-checked, so it can never be left orphaned mid-scene');
  assert.match(main, /necklace\.worn\.visible = true;/, 'and it is made visible, not left hidden');
  // the shimmer must keep running after the scene: this is the line that proves it does
  assert.match(main, /if \(giftGiven && necklace\) necklace\.update\(clock\.elapsedTime, dt, 1, null\);/);
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

test('the film owns the camera while it runs, and hands it back untouched', () => {
  assert.match(main, /import \{ giftCamera, giftCameraBlend \} from '\/src\/gift-camera\.js'|import \{ giftCamera, giftCameraBlend \} from '\.\/gift-camera\.js'/,
    'the film camera is the one in gift-camera.js');
  assert.match(main, /\n    placeGiftCamera\(dt\);/, 'it is driven from the frame loop');
  // it must run after the walking camera has moved, or the blend starts from last frame's pose
  // the walking camera is placed by controls.update(...), which has a guard on it; the film must come
  // after that line, or its blend would start from last frame's pose
  const loopAt = main.search(/controls\.update\(dt\)/);
  const placeAt = main.search(/^\s+placeGiftCamera\(dt\);$/m);
  assert.ok(loopAt > 0 && placeAt > loopAt, 'and after the walking camera, not before');
  // the pose it blends *from* is captured once, so the blend cannot chase itself
  assert.match(main, /if \(!gift\.fromCaptured\) \{/, 'the starting pose is captured once...');
  assert.match(main, /gift\.fromCaptured = true;/, '...and marked as captured, so the blend cannot chase itself');
  // the diorama vignette is a gradient in the DOM, not a light in the garden
  assert.match(main, /setGiftVignette\(/, 'the vignette is driven by the film');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /id="gift-vignette"/, 'and it exists in the page');
  const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
  assert.match(css, /\.gift-vignette\s*\{/, 'with a rule of its own');
  // below the dialogs and the curtain: this is scenery, not UI
  assert.match(css, /\.gift-vignette[\s\S]{0,400}z-index:\s*\d/, 'and a place in the stack');
});
test('the film does not cut in from the far side of the garden', () => {
  // the follow camera is 4.3 m behind her; the film's first frame is composed in front of her. A straight
  // lerp between the two at a fixed 0.75 s would put a three-metre step in the first frames, so the blend
  // is eased exponentially against the frame time: the first frame is a turn of the head.
  assert.match(main, /const glide = 1 - Math\.exp\(-dt \* 6\.5\);/);
  assert.match(main, /const blend = giftCameraBlend\(gift\.t\) \* glide;/);
  assert.match(main, /shot: 'find' \}/, 'the frame buffer it fills is allocated once, not per frame');
});
