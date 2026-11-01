import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STREET, STREET_EDGE, TOWN_WALL_Z, GATE, PLAZA, CLOCK_TOWER, TOWN_HOUSES, GATE_TRIGGER,
  inLane, inPlaza, clockHandAngles, clockText, gateGreeting,
  windowLitFraction, windowLevel, isWindowLit,
} from '../src/town-night.js';

// The castle's towers and keep, from castle.js: the lane must not run through them.
const TOWERS = [
  { x: -12.6, z: 0, r: 1.8 }, { x: 12.6, z: 0, r: 1.8 },
  { x: -6.8, z: -0.9, r: 1.5 }, { x: 6.8, z: -0.9, r: 1.5 },
  { x: 0, z: -0.6, r: 2.3 },
];
const PHOTO_ROOM = { ox0: -16.0, ox1: -3.85, oz0: -23.4, oz1: -16.6 };
const HALL_HALF_WIDTH = 3.85;
const HALL_END = -40;

const overlaps = (a0, a1, b0, b1) => a0 < b1 && b0 < a1;
// distance from a point to an axis-aligned rectangle
const rectDistance = (px, pz, x0, x1, z0, z1) =>
  Math.hypot(Math.max(x0 - px, 0, px - x1), Math.max(z0 - pz, 0, pz - z1));

test('the lane leaves the garden clear of the castle and the hall', () => {
  assert.ok(STREET_EDGE.min > PHOTO_ROOM.ox0 || STREET_EDGE.max < PHOTO_ROOM.ox1,
    'the lane must not cross the photo room');
  assert.ok(STREET_EDGE.max < -HALL_HALF_WIDTH - 1, 'the lane stays west of the hall');
  // no lane corner may sit inside a castle tower
  for (const t of TOWERS) {
    for (const x of [STREET_EDGE.min, STREET_EDGE.max]) {
      for (const z of [STREET.z0, STREET.z1]) {
        assert.ok(Math.hypot(x - t.x, z - t.z) > t.r + 0.5, `lane corner ${x},${z} is inside tower ${t.x},${t.z}`);
      }
    }
  }
  assert.ok(overlaps(STREET.z1, STREET.z0, TOWN_WALL_Z - 5, TOWN_WALL_Z + 5), 'the lane reaches the wall');
});

test('the gate stands on the lane, in front of the wall, and can be walked up to', () => {
  assert.equal(GATE.x, STREET.x, 'the gate is on the lane');
  assert.ok(GATE.z > TOWN_WALL_Z, 'the gate faces the garden, not the far side of the wall');
  assert.ok(inLane(GATE_RECESS_X, GATE_TRIGGER.z), 'the trigger stands on the lane');
  assert.ok(inLane(GATE.x, STREET.z1), 'the end of the lane is still walkable');
  assert.ok(inPlaza(PLAZA.x, PLAZA.z), 'the square in front of the gate is walkable');
  assert.ok(Math.hypot(GATE_TRIGGER.x - PLAZA.x, GATE_TRIGGER.z - PLAZA.z) < PLAZA.r,
    'the moment happens inside the square');
  assert.ok(inLane(STREET.x, STREET.z1 - 0.39), 'the lane floor extends to its far end');
});

// the gate sits a little back from the lane's end, inside the gatehouse
const GATE_RECESS_X = GATE.x;

test('the couple can walk the whole lane and stand on the square', () => {
  // the open stretch of the lane, from the garden to the gatehouse steps
  for (let z = STREET.z0; z >= GATE.z + 3.6; z -= 0.2) {
    assert.ok(inLane(STREET.x, z), `the lane is walkable at z=${z.toFixed(1)}`);
  }
  // The trigger stands in that open stretch: a circle the couple walks into before the gatehouse.
  // Its centre is on the lane, and its near edge is still on the lane, not inside the gatehouse.
  assert.ok(inLane(GATE_TRIGGER.x, GATE_TRIGGER.z) || inPlaza(GATE_TRIGGER.x, GATE_TRIGGER.z),
    'the trigger is on open ground');
  assert.ok(GATE_TRIGGER.z - GATE_TRIGGER.r > GATE.z + 3, 'the whole trigger circle is clear of the gatehouse');
  assert.ok(GATE_TRIGGER.z + GATE_TRIGGER.r > GATE.z + 3, 'and it is reachable walking up the lane');
  assert.ok(Math.hypot(GATE_TRIGGER.x - PLAZA.x, GATE_TRIGGER.z - PLAZA.z) < PLAZA.r,
    'the moment happens on the square, before the gate');
});

test('no house stands on the lane, the square or the castle', () => {
  for (const h of TOWN_HOUSES) {
    const x0 = h.x - h.w / 2;
    const x1 = h.x + h.w / 2;
    const z0 = h.z - h.d / 2;
    const z1 = h.z + h.d / 2;
    const hitsLane = overlaps(x0, x1, STREET_EDGE.min - 0.5, STREET_EDGE.max + 0.5);
    const inSquare = rectDistance(PLAZA.x, PLAZA.z, x0, x1, z0, z1) < PLAZA.r + 0.5;
    assert.ok(!hitsLane, `house at ${h.x},${h.z} stands on the lane`);
    assert.ok(!inSquare, `house at ${h.x},${h.z} stands in the square`);
    const hitsPhotoRoom = overlaps(x0, x1, PHOTO_ROOM.ox0, PHOTO_ROOM.ox1) && overlaps(z0, z1, PHOTO_ROOM.oz0, PHOTO_ROOM.oz1);
    assert.ok(!hitsPhotoRoom, `house at ${h.x},${h.z} stands in the photo room`);
    const insideHall = Math.abs(h.x) < HALL_HALF_WIDTH + h.w / 2 && z0 < 0 && z1 > HALL_END;
    assert.ok(!insideHall, `house at ${h.x},${h.z} stands in the hall`);
  }
});

test('the clock hands point where the time says', () => {
  const at = (h, m, s = 0) => {
    const d = new Date(2026, 0, 1, h, m, s);
    return clockHandAngles(d);
  };
  const noon = at(12, 0);
  assert.ok(Math.abs(noon.hourAngle) < 1e-9, 'noon: the hour hand is at 12');
  assert.ok(Math.abs(noon.minuteAngle) < 1e-9, 'noon: the minute hand is at 12');

  const quarterPast = at(3, 15);
  assert.ok(Math.abs(quarterPast.minuteAngle - Math.PI / 2) < 1e-9, 'quarter past: the minute hand is at 3');
  assert.ok(Math.abs(quarterPast.hourAngle - (3.25 / 12) * Math.PI * 2) < 1e-9, 'the hour hand moves with the minutes');

  const halfPastNine = at(21, 30);
  assert.ok(Math.abs(halfPastNine.minuteAngle - Math.PI) < 1e-9, 'half past: the minute hand is at 6');
  assert.ok(Math.abs(halfPastNine.hourAngle - (9.5 / 12) * Math.PI * 2) < 1e-9, 'the hour hand sits between 9 and 10');

  // it is a clock: it reads the local time, and wraps at midnight
  assert.equal(clockText(new Date(2026, 0, 1, 7, 5)), '07:05');
  assert.ok(Math.abs(at(0, 0).hourAngle - at(12, 0).hourAngle) < 1e-9, 'midnight looks like noon on the dial');
});

test('the gate greets with the town clock', () => {
  const night = gateGreeting(new Date(2026, 0, 1, 22, 40));
  assert.match(night, /22:40/);
  assert.match(night, /خونه‌مون اون‌جاست/);
  const morning = gateGreeting(new Date(2026, 0, 1, 7, 15));
  assert.match(morning, /07:15/);
  assert.notEqual(morning, night, 'the greeting depends on the hour');
});

test('windows follow the hour: evenings lit, small hours dark', () => {
  assert.ok(windowLitFraction(21) > windowLitFraction(3), 'evening is livelier than 3am');
  assert.ok(windowLitFraction(13) < windowLitFraction(20), 'afternoon is quieter than evening');
  for (let h = 0; h < 24; h += 0.5) {
    const f = windowLitFraction(h);
    assert.ok(f >= 0 && f <= 1, `a fraction at ${h}`);
  }
  // and they breathe, without ever flickering every frame
  const levels = [0, 1, 2, 3, 4].map((i) => windowLevel(0.3, i));
  assert.equal(new Set(levels.map((l) => l.toFixed(3))).size, 5, 'the level changes over time');
  assert.ok(windowLevel(0.3, 10) !== windowLevel(0.31, 10), 'neighbouring windows differ');
  const litAt21 = Array.from({ length: 200 }, (_, i) => isWindowLit(i / 200, 100, 21)).filter(Boolean).length / 200;
  const litAt3 = Array.from({ length: 200 }, (_, i) => isWindowLit(i / 200, 100, 3)).filter(Boolean).length / 200;
  assert.ok(litAt21 > litAt3, 'more windows are lit in the evening');
  assert.ok(litAt21 > 0.4 && litAt21 < 0.9, `a believable share is lit at 21:00 (got ${litAt21})`);
});
