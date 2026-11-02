import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// the real level layout, so the path rules are checked against the castle rather than against numbers
const world = await import('../src/world.js');

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

test('the trigger is a walk out of the front door, not "somewhere past the walls"', () => {
  // What went wrong: the exit was `z > 1.2 || |x| > hallHalfWidth + 2` -- "out the front door, or past the
  // walls". The hall's west wall has a doorway into the photo room, so coming back out of that room put her at
  // x -4.15, past the walls, and the film played in the middle of the castle.
  assert.doesNotMatch(main, /\|\| Math\.abs\(hero\.root\.position\.x\) > LAYOUT\.hallHalfWidth \+ 2/,
    'the "past the walls" escape is gone');
  assert.match(main, /function updateFrontDoor\(\)/, 'the front door is tracked as a crossing');
  assert.match(main, /leftThroughFrontDoor = true;/, 'walking out arms it');
  assert.match(main, /leftThroughFrontDoor = false;/, 'and walking back in disarms it');
  assert.match(main, /const outThroughTheFrontDoor = leftThroughFrontDoor && outOfHallNow\(\);/,
    'and the scene needs that crossing, not a position');
  assert.match(main, /if \(Math\.abs\(x\) > FRONT_DOOR_REACH\) \{ frontDoorSide = null; return; \}/,
    'and only in front of the facade: there is no other way out of the castle');
  assert.match(main, /leftThroughFrontDoor = false;\n    return;/, 'a skipped check does not leave the exit armed');
});

test('the front-door rules, run against the paths a player can actually walk', () => {
  // The rules are in main.js, which cannot be imported here, so they are re-stated and checked against the
  // geometry. If main.js and this disagree the source assertions above fail first.
  const { LAYOUT } = world;
  const DOOR_Z = 0.12;
  const REACH = LAYOUT.doorHalfWidth + 2.5;
  const inHall = (p) => Math.abs(p.x) < LAYOUT.hallHalfWidth + 0.6 && p.z < -1.5 && p.z > -LAYOUT.hallLength;
  const outside = (p) => p.z >= 1.2 && Math.abs(p.x) <= REACH;
  const line = (x0, z0, x1, z1, n = 400) => Array.from({ length: n }, (_, i) => ({ x: x0 + (x1 - x0) * i / (n - 1), z: z0 + (z1 - z0) * i / (n - 1) }));
  const walk = (path) => {
    let inside = false, side = null, left = false, fired = false;
    for (const p of path) {
      if (Math.abs(p.x) > REACH) side = null;
      else {
        const s = p.z >= DOOR_Z ? 1 : -1;
        if (side === -1 && s === 1) left = true; else if (side === 1 && s === -1) left = false;
        side = s;
      }
      if (fired) continue;
      if (inHall(p)) inside = true;
      else if (inside && left && outside(p)) fired = true;
    }
    return fired;
  };
  assert.equal(walk(line(0, -10, 0, 4)), true, 'in and straight back out the front door fires');
  assert.equal(walk(line(0, 4, 0, -10)), false, 'walking in alone does not');
  assert.equal(walk([...line(-10, -20, -4.2, -20), ...line(-4.2, -20, -2, -20), ...line(-2, -20, -2, -10)]), false,
    'coming out of the photo room does not -- this is the bug that was reported');
  assert.equal(walk(line(-4.3, -22, -4.3, -10)), false, 'nor does standing in the room\'s doorway');
  assert.equal(walk([...line(0, -10, 0, -34), ...line(0, -34, 0, -10)]), false, 'nor a walk to the far end of the hall');
  assert.equal(walk([...line(0, -10, 0, 4), ...line(0, 4, 0, -10)]), true, 'out is what fires, not the walk back in');
  assert.equal(walk(line(-3, -2, -3, 4)), true, 'out through the front door a little to one side also fires');
  assert.equal(walk(line(-5.2, 1.6, -5.2, -3)), false, 'walking round the outside of the facade never fires');
});

test('the scene is offered once, and only when nothing else owns the screen', () => {
  assert.match(main, /if \(!started \|\| gift \|\| giftGiven \|\| !introFairy \|\| letterView \|\| anyDialogOpen\(\)\) \{/);
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
  assert.match(main, /import \{[^}]*\bgiftCamera\b[^}]*\} from '(\.\/|\/src\/)gift-camera\.js'/,
    'the film camera is the one in gift-camera.js');
  // and it is checked against the castle the same way the walking camera is, rather than trusted
  assert.match(main, /keepCameraClear\(/, 'the film pose is cleared against the walls before it is used');
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
test('the film opens on the walking camera, not on a flight to the other side of her', () => {
  // It reads the walking camera's pose straight after controls.update, so the first frame of the film and the
  // last frame of the walking camera are the same view; and it reads it *before* it writes its own output,
  // or the film would feed itself back through its own follow pose.
  assert.match(main, /if \(gift\) recordWalkPose\(\);/, 'the walking pose is recorded each frame');
  const walkAt = main.search(/if \(gift\) recordWalkPose\(\);/);
  const placeAt = main.search(/^\s+placeGiftCamera\(dt\);$/m);
  assert.ok(walkAt > 0 && placeAt > walkAt, 'and recorded before the film is placed');
  assert.match(main, /follow: giftWalkPose/, 'the film is handed that pose, not its own last frame');
  assert.match(main, /if \(blend <= 0\) return;/, 'and once it has handed back it stops writing to the camera');
});

// The film is framed against her throat and her front, frame by frame, and it cannot survive the player
// walking out of it. So for its length the controls ignore movement -- the same gate the bench already uses.
test('the player\'s movement is ignored for the length of the film', () => {
  const controls = readFileSync(new URL('../src/controls.js', import.meta.url), 'utf8');
  assert.match(main, /controls\?\.setFilmRunning\?\.\(true\)/, 'beginning the film locks movement');
  assert.match(main, /controls\?\.setFilmRunning\?\.\(false\)/, 'and finishing it gives movement back');
  // the lock is checked where the movement input is read, not only in the API
  assert.match(controls, /isBlocked\(\) \|\| benchSeated \|\| filmRunning \? \[0, 0\] : computeMoveInput\(\)/,
    'the movement input is zeroed behind the lock');
  // and held keys do not survive it: she must not lurch off when the film ends
  const setter = controls.slice(controls.indexOf('setFilmRunning(value)'));
  assert.match(setter.slice(0, 400), /keys\.clear\(\)/, 'held keys are dropped');
  assert.match(setter.slice(0, 400), /joystick\.x = joystick\.y = 0/, 'and so is the joystick');
});
