import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

// A walk from the castle's front door to the funfair, using the real controls: the same collision, the
// same camera rig and the same ride hand-off the browser runs. There is no headless browser here, so
// this is the closest thing to "clicked it and walked there" that can run in CI — and it is what caught
// the lane being blocked by the wheel's own clearing while the layout was being drawn.

function browserStubs() {
  const listeners = new Map();
  const target = {
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      listeners.get(type)?.delete(fn);
    },
  };
  return {
    window: { innerWidth: 1440, innerHeight: 900, devicePixelRatio: 1, ...target },
    canvas: {
      ...target,
      setPointerCapture() {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 1440, height: 900 }),
      style: {},
    },
    emit(type, event) {
      (listeners.get(type) || []).forEach((fn) => fn(event));
    },
  };
}

async function makeControls() {
  const stubs = browserStubs();
  globalThis.window = stubs.window;
  const { createControls } = await import('../src/controls.js');
  const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 300);
  const player = new THREE.Object3D();
  const controls = createControls({
    camera,
    canvas: stubs.canvas,
    player,
    playerModel: player,
    isBlocked: () => false,
    onTapFrame: () => {},
  });
  return { controls, camera, stubs };
}

// One second of walking, at 60 frames: the same integration the game loop does.
function walk(controls, seconds, stick) {
  controls.setJoystick(stick[0], stick[1], true);
  const dt = 1 / 60;
  for (let i = 0; i < seconds * 60; i += 1) controls.update(dt);
  controls.setJoystick(0, 0, false);
}

// The walk from the front door to the fair's gate and in, as in the first test.
function walkToFair(controls) {
  walk(controls, 4.6, [0, 1]);
  walk(controls, 22, [1, 0]);
}

test('the couple can walk from the front door to the fair, and onto its ground', async () => {
  const { controls } = await makeControls();
  assert.ok(controls.position.x < 1, 'the spawn is in front of the door');

  // The follow camera starts behind the couple facing the castle (-z), so forward on the stick is
  // "up the path" and right is the garden's east. They start at z = 19, so the walk to the fair is
  // north up their own path to the door's line (z = 3), then east along the paved lane.
  walk(controls, 4.6, [0, 1]);
  assert.ok(controls.position.z < 6, `up the path to z=${controls.position.z.toFixed(1)}`);
  walk(controls, 6, [1, 0]);
  assert.ok(controls.position.x > 20, `walked to x=${controls.position.x.toFixed(1)}`);
  assert.ok(Math.abs(controls.position.z - 3) < 4.5, 'and stayed on the lane, not off across the lawn');

  // keep going: through the gate
  walk(controls, 10, [1, 0]);
  assert.ok(controls.position.x > 40, `through the gate, at x=${controls.position.x.toFixed(1)}`);
  assert.ok(Math.abs(controls.position.z - 3) < 4, 'the gate let them in on the lane\'s own line');
});

test('they cannot walk through the fair\'s fence, or through a ride', async () => {
  const { controls } = await makeControls();
  walkToFair(controls);
  assert.ok(controls.position.x > 40, `inside the fair, at x=${controls.position.x.toFixed(1)}`);

  // now push away from the lane, straight at the fair's south fence: it must hold
  walk(controls, 8, [0.6, -1]);
  const zAfter = controls.position.z;
  walk(controls, 8, [1, 0]);
  assert.ok(controls.position.x < 73, 'the east fence held');
  assert.ok(zAfter < 21, 'the south fence held');
  // and a ride is solid: walking straight at the wheel never puts them inside its footprint
  assert.ok(
    Math.hypot(controls.position.x - 58, controls.position.z - 12) > 7.0,
    'the wheel kept its footprint free',
  );
});

test('a ride hands the camera over, moves it, and gives it back', async () => {
  const { controls, camera } = await makeControls();
  walkToFair(controls);
  const before = camera.position.clone();

  const path = {
    from: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
    to: { x: 70, y: 9, z: 3 },
    lookFrom: { x: 58, y: 4, z: 12 },
    lookTo: { x: 58, y: 7, z: 12 },
  };
  controls.startRide(path, 2);
  assert.equal(controls.riding, true);

  // half the turn: the camera is on its way, and the couple have not walked off
  const startPos = controls.position.clone();
  for (let i = 0; i < 60; i += 1) controls.update(1 / 60);
  assert.ok(controls.position.distanceTo(startPos) < 0.001, 'nobody walks during a turn');
  assert.ok(camera.position.distanceTo(before) > 1, 'and the camera really moved');
  assert.ok(controls.rideProgress > 0.4 && controls.rideProgress < 0.7, 'halfway through');

  // a walk key ends the turn rather than being swallowed
  controls.setJoystick(0, 1, true);
  controls.update(1 / 60);
  assert.equal(controls.rideCancelled, true, 'the press was noticed');
  controls.endRide();
  assert.equal(controls.riding, false);
  assert.equal(controls.rideCancelled, false, 'and the flag is cleared for the next ride');

  // With the turn over, walking resumes. The follow camera has been looking around the ride, so
  // "forward" is no longer north: what matters is that pushing the stick moves them again.
  walk(controls, 2, [1, 0]);
  assert.ok(controls.position.distanceTo(startPos) > 1.5, 'walking resumed');
});

test('the fair is not in the way of the rest of the game', async () => {
  const { controls } = await makeControls();
  // the hall, the town lane and the flower shop still behave: a step west from the door is free
  walk(controls, 6, [0, -1]);
  assert.ok(controls.position.z > 6, 'walked back toward the house, not through it');
  assert.ok(Math.abs(controls.position.x) < 12, 'stayed on the garden path');
});
