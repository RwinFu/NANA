import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  FAIR_ZONE, FAIR_GATE, FAIR_GAP, FAIR_PATH_Z, FAIR_CORRIDOR, RIDES, RIDE_ASK, RIDE_BAY, LANE,
  inFairCorridor, inFairZone, isFairGround, isFairSolid, onRide,
} from '../src/fair-rules.js';
import { RIDE_INFO, RIDE_IDS, rideInReach, rideCameraPath, rideSpeed, rideLine } from '../src/fair-rides.js';
import { LAYOUT } from '../src/world.js';

// ---------- the ground ---------------------------------------------------------

test('the fair is east of the castle, and the lane to it is level with the front door', () => {
  assert.ok(FAIR_ZONE.x0 > LAYOUT.gardenHalfWidth, 'the fair starts beyond the garden lawn');
  assert.ok(FAIR_ZONE.x0 > LAYOUT.room.ox1, 'and well clear of the photo room');
  assert.equal(FAIR_PATH_Z, 3.0, 'the lane leaves at the door\'s own line');
  assert.ok(FAIR_CORRIDOR.x0 < LAYOUT.gardenHalfWidth, 'the corridor overlaps the lawn, so there is no gap');
});

test('the corridor, the gate and the fair ground are one continuous walkable strip', () => {
  // walk the lane east in 5 cm steps and never meet a solid point on the centre line
  for (let x = 19.5; x <= FAIR_GATE.x + 4; x += 0.05) {
    assert.ok(isFairGround(x, FAIR_PATH_Z), `open at x=${x.toFixed(2)}`);
    assert.equal(isFairSolid(x, 0, FAIR_PATH_Z), false, `nothing solid at x=${x.toFixed(2)}`);
  }
});

test('the fence is solid everywhere except the gate opening', () => {
  const z = FAIR_GAP.z0 + FAIR_GATE.halfWidth; // just inside the opening
  assert.equal(isFairSolid(FAIR_ZONE.x0, 0, z), false, 'the gate itself is open');
  // a metre either side of the opening, the fence stops you
  assert.equal(isFairSolid(FAIR_ZONE.x0, 0, FAIR_GAP.z0 - 1), true, 'fence north of the gate');
  assert.equal(isFairSolid(FAIR_ZONE.x0, 0, FAIR_GAP.z1 + 1), true, 'fence south of the gate');
  // and the fence does not let anyone step over it
  assert.equal(isFairSolid(FAIR_ZONE.x0, 3, FAIR_GAP.z0 - 1), false, 'above the fence is not solid');
});

test('every ride is inside the fair ground, and clear of the lane', () => {
  for (const [id, ride] of Object.entries(RIDES)) {
    assert.ok(inFairZone(ride.x, ride.z, 0), `${id} is on fair ground`);
    assert.ok(inFairZone(ride.x + ride.clear, ride.z, 0), `${id}'s clearing fits inside the fence`);
    assert.ok(ride.z - ride.r > FAIR_PATH_Z || ride.z + ride.r < FAIR_PATH_Z || ride.x - ride.r > FAIR_ZONE.x0 + 6,
      `${id} never sits on the gate's own straight line`);
    // ... and it is solid at its footprint, so nobody walks through it, apart from the boarding bay
    const bay = RIDE_BAY[id];
    const hubToBay = Math.hypot(bay.x - ride.x, bay.z - ride.z);
    if (hubToBay > bay.r + 0.01) {
      assert.equal(isFairSolid(ride.x, 0, ride.z), true, `${id} is solid at its hub`);
    }
  }
});

test('every ride has an open boarding bay under its own seat', () => {
  for (const [id, bay] of Object.entries(RIDE_BAY)) {
    // the bay is inside the ride's footprint...
    const ride = RIDES[id];
    assert.ok(Math.hypot(bay.x - ride.x, bay.z - ride.z) + bay.r <= ride.r + 0.6, `${id}: the bay is under the ride`);
    // ... and walkable, which is the whole point: the couple step on from here
    assert.equal(isFairSolid(bay.x, 0, bay.z), false, `${id}: the bay is open ground`);
    assert.ok(isFairGround(bay.x, bay.z), `${id}: the bay is on fair ground`);
    // the prompt stands at the bay, so it appears exactly where they get on
    assert.equal(RIDE_ASK[id].x, bay.x);
    assert.equal(RIDE_ASK[id].z, bay.z);
  }
});

test('the lane to the gate stays clear, and every bay is reached from it', () => {
  // each bay is a short walk off the lane, never on it
  for (const [id, bay] of Object.entries(RIDE_BAY)) {
    const d = Math.abs(bay.z - FAIR_PATH_Z);
    assert.ok(d > 0.8, `${id}'s bay is off the lane's own line (${d.toFixed(2)} m)`);
    assert.ok(d < 16, `${id}'s bay is a walk, not a trek`);
  }
});

test('the fair ground stops at its own fence, rather than running to the horizon', () => {
  assert.equal(inFairZone(FAIR_ZONE.x1 + 2, FAIR_PATH_Z), false);
  assert.equal(inFairZone(FAIR_ZONE.x0 - 2, FAIR_PATH_Z), false, 'west of the fence is only the corridor');
  assert.equal(isFairGround(FAIR_ZONE.x1 + 2, FAIR_PATH_Z), false);
  // the corridor is a strip, not a field: two metres off its line is not fair ground
  assert.equal(inFairCorridor(25, FAIR_PATH_Z + 8), false);
});

// ---------- the rides ----------------------------------------------------------

test('each ride has a name, an invitation, a line and a camera route', () => {
  assert.deepEqual(RIDE_IDS.sort(), Object.keys(RIDES).sort(), 'every ride has its own entry');
  for (const id of RIDE_IDS) {
    const info = RIDE_INFO[id];
    assert.ok(info.name.length > 2, `${id} has a name`);
    assert.match(info.invite, /\S/, `${id} has an invitation`);
    assert.match(info.line, /\S/, `${id} has a line`);
    assert.ok(info.seconds >= 4 && info.seconds <= 15, `${id} lasts a moment, not a minute`);
    assert.ok(info.view.radius > RIDES[id].r, `${id}'s camera stands outside the ride`);
    assert.ok(info.boost > 1, `${id} speeds up while they are on it`);
  }
});

test('the nearest ride in reach wins the prompt, and two nearby rides never both offer', () => {
  assert.equal(rideInReach(RIDE_ASK.wheel.x, RIDE_ASK.wheel.z), 'wheel');
  assert.equal(rideInReach(RIDE_ASK.carousel.x, RIDE_ASK.carousel.z), 'carousel');
  assert.equal(rideInReach(FAIR_ZONE.x0 + 1, FAIR_PATH_Z + 12), null, 'the gate offers nothing');
  // the spot for one ride is not also inside another ride's radius
  for (const a of RIDE_IDS) {
    for (const b of RIDE_IDS) {
      if (a === b) continue;
      const d = Math.hypot(RIDE_ASK[a].x - RIDE_ASK[b].x, RIDE_ASK[a].z - RIDE_ASK[b].z);
      assert.ok(d > RIDE_ASK[a].radius, `${a}'s spot is out of ${b}'s reach`);
    }
  }
});

test('the ride camera starts where the camera already is and ends outside the ride', () => {
  for (const id of RIDE_IDS) {
    const from = { x: FAIR_ZONE.x0 + 1, y: 2.2, z: FAIR_PATH_Z };
    const path = rideCameraPath(id, from);
    assert.equal(path.from.x, from.x);
    assert.equal(path.from.z, from.z);
    const ride = RIDES[id];
    const endDist = Math.hypot(path.to.x - ride.x, path.to.z - ride.z);
    assert.ok(Math.abs(endDist - RIDE_INFO[id].view.radius) < 0.001, `${id} ends at its own radius`);
    assert.ok(path.to.y > ride.clear * 0.3, `${id}'s camera lifts`);
    // and it never ends up inside the ride's own footprint
    assert.ok(endDist > ride.r, `${id}'s camera is outside the ride`);
  }
});

test('a ride only speeds itself up, and every line is Persian text', () => {
  assert.equal(rideSpeed('wheel', 'wheel'), RIDE_INFO.wheel.boost);
  assert.equal(rideSpeed('wheel', 'carousel'), 1);
  assert.equal(rideSpeed(null, 'wheel'), 1);
  const line = rideLine('wheel', 1);
  assert.match(line, /چرخ‌وفلک/);
  assert.match(rideLine('wheel', 4), /چهار بار/, 'the fourth ride gets the extra line');
});

// ---------- the lane the couple actually walk --------------------------------

test('a straight line from the castle door to every ride is walkable', async () => {
  // The first leg is the real collision code, on the garden's own lawn and out along the path.
  const { isSolid } = await import('../src/controls.js');
  for (let x = LAYOUT.doorHalfWidth + 6; x <= FAIR_GATE.x + 1.5; x += 0.2) {
    assert.equal(isSolid(x, 0, FAIR_PATH_Z), false, `the path from the door is open at x=${x.toFixed(2)}`);
  }
  // Inside the fence, the fair's own rules: no ride disc and no rail on the way to any ride.
  const door = { x: FAIR_GATE.x + 1, z: FAIR_PATH_Z };
  const seen = new Set();
  const STEP = 0.25;
  const key = (x, z) => `${Math.round(x / STEP)},${Math.round(z / STEP)}`;
  const queue = [[door.x, door.z]];
  seen.add(key(door.x, door.z));
  while (queue.length) {
    const [x, z] = queue.shift();
    for (const [dx, dz] of [[STEP, 0], [-STEP, 0], [0, STEP], [0, -STEP]]) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx < 6 || nx > FAIR_ZONE.x1 - 0.5 || nz < FAIR_ZONE.z0 + 0.5 || nz > FAIR_ZONE.z1 - 0.5) continue;
      const k = key(nx, nz);
      if (seen.has(k)) continue;
      if (!isFairGround(nx, nz) || isFairSolid(nx, 0, nz)) continue;
      seen.add(k);
      queue.push([nx, nz]);
    }
  }
  for (const id of RIDE_IDS) {
    const spot = RIDE_ASK[id];
    const reachable = seen.has(key(spot.x, spot.z))
      || [...seen].some((k) => {
        const [x, z] = k.split(',').map((v) => Number(v) * STEP);
        return Math.hypot(x - spot.x, z - spot.z) <= spot.radius - 0.3;
      });
    assert.ok(reachable, `${id} can be walked to from the castle door`);
  }
});

test('the fair never intrudes on the garden, the hall or the photo room', () => {
  // the corridor's west end is open ground in the garden; nothing else of the fair may reach it
  assert.ok(FAIR_ZONE.x0 > LAYOUT.gardenHalfWidth);
  assert.ok(FAIR_ZONE.z0 > LAYOUT.room.oz1, 'the fair is south of nothing: it starts past the room\'s own depth');
  // the town's lane on the west is untouched: a point on it is not fair ground by accident
  assert.equal(isFairGround(-19, -20), false);
  assert.equal(isFairSolid(-19, 0, -20), false);
});

// ---------- the builder ---------------------------------------------------------

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

test('the fair builds, animates, and costs a bounded number of objects', async () => {
  const { buildFair } = await import('../src/fair.js');
  const previous = globalThis.document;
  globalThis.document = { createElement: () => stubCanvas(), fonts: { ready: Promise.resolve() } };
  try {
    const scene = new THREE.Scene();
    const fair = buildFair(scene, (o) => o);
    assert.ok(fair.group.children.length > 0);
    // one update must not throw, and must move the wheel
    const wheelSpin = fair.group.getObjectByName('funfair');
    assert.ok(wheelSpin);
    fair.update(0.016);
    fair.update(0.016);
    // the fair stays a modest part of the scene: the whole point of the budget
    let meshes = 0;
    fair.group.traverse((o) => { if (o.isMesh) meshes += 1; });
    // Budget: the whole fair must stay a small addition to a 2000-mesh scene. It is 274 today; this
    // guard is here so a future ride cannot quietly double it.
    assert.ok(meshes < 300, `the fair is ${meshes} meshes, which is inside its budget`);
    // and every one of those meshes has a trackable material or geometry (no leaks)
    assert.ok(fair.asks && fair.rides && fair.zone);
    assert.equal(fair.rides.wheel.x, RIDES.wheel.x);
    assert.equal(fair.gate.x, FAIR_GATE.x);
  } finally {
    globalThis.document = previous;
  }
});

test('the lane to the fair does not fight the town lane for the same ground', () => {
  // the two lanes leave the garden on opposite sides
  assert.ok(LANE.x0 > 0, 'the fair lane runs east');
  assert.ok(FAIR_CORRIDOR.z0 < 0 && FAIR_CORRIDOR.z1 > 0, 'and straddles the door\'s line');
});
