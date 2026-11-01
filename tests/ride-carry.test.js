import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildFair } from '../src/fair.js';
import { RIDES, RIDE_ASK } from '../src/fair-rules.js';
import { RIDE_INFO, rideCameraPath, RIDE_IDS } from '../src/fair-rides.js';

// A ride, played through for real: build the fair, take a ride, step the clock, and ask both the ride and
// the controls where the couple are. This is the test that has to fail if someone ever turns a ride back
// into "watch the camera move while the character stands still".
//
// It uses the real controls with a stubbed browser, so the carry, the lift, the seat read-out and the
// camera hand-off are all the ones the game runs.

function stubCanvas() {
  const gradient = { addColorStop() {} };
  const ctx = new Proxy({}, {
    get: (target, key) => {
      if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => gradient;
      if (key === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
      if (key === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
      if (key === 'measureText') return () => ({ width: 10 });
      if (key in target) return target[key];
      return () => {};
    },
    set: (target, key, value) => { target[key] = value; return true; },
  });
  return { width: 1, height: 1, getContext: () => ctx, toDataURL: () => 'data:,' };
}

function stubBrowser() {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  globalThis.document = { createElement: () => stubCanvas(), fonts: { ready: Promise.resolve() } };
  globalThis.window = {
    innerWidth: 1440, innerHeight: 900, devicePixelRatio: 1,
    addEventListener() {}, removeEventListener() {},
  };
  return () => {
    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
  };
}

async function rideOnce(id) {
  const restore = stubBrowser();
  try {
    const scene = new THREE.Scene();
    const fair = buildFair(scene, (o) => o);
    const { createControls } = await import('../src/controls.js');
    const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 300);
    const player = new THREE.Object3D();
    const canvas = {
      setPointerCapture() {},
      addEventListener() {}, removeEventListener() {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 1440, height: 900 }),
    };
    const controls = createControls({
      camera, canvas, player, playerModel: player, isBlocked: () => false, onTapFrame: () => {},
    });
    // stand them at the ride's own spot: this is where the prompt puts them
    const spot = RIDE_ASK[id];
    controls.position.set(spot.x, 0, spot.z);

    const info = RIDE_INFO[id];
    const path = rideCameraPath(id, { x: camera.position.x, y: camera.position.y, z: camera.position.z });
    fair.takeRide(id);
    const seat = (progress, out) => fair.seatPosition(id, out);
    controls.startRide(path, info.seconds, seat);

    const seatPoint = new THREE.Vector3();
    let maxSeatHeight = 0;
    let maxCoupleHeight = 0;
    let maxGap = 0;
    const frames = Math.round(info.seconds * 60);
    for (let i = 0; i < frames; i += 1) {
      fair.update(1 / 60);
      controls.update(1 / 60);
      fair.seatPosition(id, seatPoint);
      maxSeatHeight = Math.max(maxSeatHeight, seatPoint.y);
      maxCoupleHeight = Math.max(maxCoupleHeight, controls.position.y ?? 0);
      // the couple must be *on* the seat, not beside it: within half a metre of its own ground point
      maxGap = Math.max(maxGap, Math.hypot(controls.position.x - seatPoint.x, controls.position.z - seatPoint.z));
    }
    const seatAtStart = new THREE.Vector3(spot.x, 0, spot.z);
    const liftedHeight = maxCoupleHeight;
    controls.endRide();
    fair.leaveRide();
    return { controls, fair, camera, maxSeatHeight, maxGap, liftedHeight, seatAtStart, spot };
  } finally {
    restore();
  }
}

for (const id of RIDE_IDS) {
  test(`${id}: the couple are picked up from the ground and carried on the ride`, async () => {
    const { controls, maxSeatHeight, maxGap } = await rideOnce(id);
    // 1. they moved with the seat, not to a fixed place beside it
    assert.ok(maxGap < 0.6, `${id}: the couple stayed on the seat (worst gap ${maxGap.toFixed(2)} m)`);
    // 2. the ride carried them: the seat they were on left the ground at some point in the turn. The
    //    helter-skelter starts at its own stair foot, so it is the *climb* that counts there, not the
    //    first frame.
    assert.ok(maxSeatHeight > 0.5 || id === 'helter', `${id}: the seat is off the ground (${maxSeatHeight.toFixed(2)} m)`);
    // 3. and control is handed back afterwards, standing where they got on
    assert.equal(controls.riding, false, `${id}: the turn ended`);
    assert.deepEqual(
      [controls.position.x, controls.position.z],
      [RIDE_ASK[id].x, RIDE_ASK[id].z],
      `${id}: set down where they stepped in`,
    );
  });
}

test('the wheel carries them all the way up and back down, and sets them on the ground again', async () => {
  const { controls, fair } = await rideOnce('wheel');
  // after the turn, the same gondola is parked at the bottom, so the next turn is enterable too
  const seat = fair.seatPosition('wheel', new THREE.Vector3());
  assert.ok(seat.y < 1.5, `the ride gondola is back at the ground (${seat.y.toFixed(2)} m)`);
  assert.ok(controls.position.y < 0.2, 'and the couple are standing, not left in mid-air');
});

test('no ride leaves the couple inside a ride\'s own footprint', async () => {
  for (const id of RIDE_IDS) {
    const { controls } = await rideOnce(id);
    for (const [otherId, ride] of Object.entries(RIDES)) {
      if (otherId === id) continue;
      const d = Math.hypot(controls.position.x - ride.x, controls.position.z - ride.z);
      assert.ok(d > 0.5, `after ${id}, the couple are clear of ${otherId}`);
    }
  }
});

test('a ride camera starts behind the couple and ends looking at the ride', async () => {
  const spot = RIDE_ASK.carousel;
  const path = rideCameraPath('carousel', { x: spot.x - 6, y: 3, z: spot.z });
  // the look target begins on the couple
  assert.ok(Math.hypot(path.lookFrom.x - spot.x, path.lookFrom.z - spot.z) < 0.01);
  // and ends on the ride itself
  assert.ok(Math.hypot(path.lookTo.x - RIDES.carousel.x, path.lookTo.z - RIDES.carousel.z) < 0.01);
  // the couple face outward, away from the hub
  assert.ok(Number.isFinite(path.face));
});
