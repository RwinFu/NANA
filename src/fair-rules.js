// The funfair east of the castle: the ground you can walk on, the gate in its fence, and the rides.
//
// Everything two-sided lives here as plain numbers and plain functions, so the walk rules, the
// fence builder and the tests can all agree without a renderer:
//
//   * `FAIR_CORRIDOR`  the ground between the garden's east limit and the fair's fence: short grass
//                      the couple can cross, so the fair is reached on foot from the castle's front door.
//   * `FAIR_ZONE`      the fair's own ground, behind the fence, with one opening at the gate.
//   * `RIDES`          the four rides, as discs, so nothing else is ever built on top of them.
//   * `isFairWalkable` the one answer the collision code asks for: is this point fair ground?
//
// The fair is deliberately *not* a maze: the gate is straight east of the front door, the wheel is
// straight ahead of it, and the rest of the rides sit around the outside, so nothing has to be found.

export const FAIR_PATH_Z = 3.0; // the lane to the fair runs east along this line, level with the door

// The corridor from the garden to the fence. Its west edge sits inside the garden's own east wall
// (|x| < 22), so walking east from the door meets neither a gap nor an invisible step.
export const FAIR_CORRIDOR = { x0: 19.5, x1: 37.0, z0: -6.0, z1: 11.0 };

// The fair's ground: fence, gate, rides.
export const FAIR = { x: 55, z: 3, r: 22 };
export const FAIR_ZONE = { x0: 37.0, x1: 73.0, z0: -15.0, z1: 21.0 };

// The gate, in the middle of the fence's west side, on the lane's own line.
export const FAIR_GATE = { x: 37.0, z: FAIR_PATH_Z, halfWidth: 3.0, height: 4.6 };
// How far either side of the gate the walk between garden and fair is open.
export const FAIR_GAP = { z0: FAIR_PATH_Z - FAIR_GATE.halfWidth, z1: FAIR_PATH_Z + FAIR_GATE.halfWidth };

// The fence: a rail fence with a picket top, so it reads as a fair's boundary and not a wall.
export const FENCE = { height: 1.45, postEvery: 3.0, thickness: 0.16 };

// The rides, as discs on the ground. `clear` is the radius kept free around each one.
// The lane itself (z = FAIR_PATH_Z) is kept clear from the gate to the far fence: the wheel stands to
// one side of it, not across it, so walking in is never a detour around a ride.
export const RIDES = {
  wheel: { x: 58.0, z: 12.0, r: 7.5, clear: 8.0 },    // the big wheel, the fair's landmark
  carousel: { x: 45.0, z: -6.5, r: 4.0, clear: 5.4 }, // the horses, on the south side
  swings: { x: 66.0, z: -5.0, r: 3.2, clear: 4.4 },   // the swing boats, by the far fence
  helter: { x: 46.0, z: 14.4, r: 3.6, clear: 4.8 },   // the helter-skelter, on the north side
};

// The stall row: four little booths along the far fence, facing back down the lane.
export const STALLS = [
  { x: 52.0, z: -12.6, rotY: Math.PI, tint: 0 },
  { x: 56.5, z: -12.6, rotY: Math.PI, tint: 1 },
  { x: 61.5, z: -12.6, rotY: Math.PI, tint: 2 },
  { x: 66.5, z: -12.6, rotY: Math.PI, tint: 1 },
];

// Where the couple stands to ask, per ride. In front of the gate a little signpost says who is where.
// Where the couple stand to get on, and the radius of the boarding bay around it.
//
// This is the single most delicate number in the fair: a ride's own footprint is solid, so the couple
// would otherwise be stopped two metres short of the thing they came to ride and the seat would have to
// glide out to meet them, which reads as a bug. Each ride therefore has a *boarding bay*: a small disc
// cut out of its footprint, right under the seat it parks, so they walk in under the wheel or up to the
// deck's edge and step on from there.
// Each bay is placed where the ride's *own seat* can reach it: at the bottom of the wheel's turn (under
// its axle), at the near edge of the carousel's deck, at the low point of a swing boat, and at the foot
// of the helter-skelter's stair. The rides are measured against these numbers by tests/fair.test.js.
export const RIDE_BAY = {
  // under the wheel's own axle: the bottom of a wheel is the only place you can get in
  wheel: { x: 58.0, z: 12.0, r: 2.2 },
  // at the near edge of the carousel's deck, on the lane side
  carousel: { x: 47.5, z: -6.6, r: 1.6 },
  // under the near boat's own pivot: the boat hangs at z = ride.z - 1.1, so the bay is there
  swings: { x: 66.0, z: -6.1, r: 1.3 },
  // at the foot of the helter-skelter's spiral stair
  helter: { x: 46.0, z: 14.4, r: 1.6 },
};

// The open approach from the lane to each bay. A bay at a hub is useless if the ride's own footprint
// rings it, so each bay may have a corridor back to the lane's line. `w` is the corridor's half width.
export const RIDE_LINK = {
  wheel: { x: 58.0, z: FAIR_PATH_Z, halfWidth: 1.6 },
  carousel: { x: 47.5, z: FAIR_PATH_Z, halfWidth: 1.3 },
  swings: { x: 66.0, z: FAIR_PATH_Z, halfWidth: 1.3 },
  helter: { x: 46.0, z: FAIR_PATH_Z, halfWidth: 1.3 },
};

// Where the prompt appears: at the boarding bay, with a wide enough radius that a phone can stand a
// little off it. The two numbers are separate because the prompt is forgiving and the bay is not.
export const RIDE_ASK = {
  wheel: { x: RIDE_BAY.wheel.x, z: RIDE_BAY.wheel.z, radius: 3.0 },
  carousel: { x: RIDE_BAY.carousel.x, z: RIDE_BAY.carousel.z, radius: 2.6 },
  swings: { x: RIDE_BAY.swings.x, z: RIDE_BAY.swings.z, radius: 2.6 },
  helter: { x: RIDE_BAY.helter.x, z: RIDE_BAY.helter.z, radius: 2.6 },
};

// The parked pose of each ride: the rotation that brings its boarding seat exactly over the bay.
//   wheel    their gondola at the bottom of the turn (the only place they can step in)
//   carousel one horse standing at the near edge of the deck
//   swings   the near boat at the bottom of its arc
//   helter   the foot of the stair (the climb is part of the ride)
export const RIDE_PARK = {
  wheel: { angle: -Math.PI / 2 },
  carousel: { angle: Math.PI / 2 },
  swings: { phase: 0 },
  helter: { angle: 0 },
};

// The gate is a doorway in a fence, not a building: the couple walk through it, so it must not be
// solid. Everything else the fence encloses is fair ground.

export function inFairCorridor(x, z, margin = 0.3) {
  return x >= FAIR_CORRIDOR.x0 - margin && x <= FAIR_CORRIDOR.x1 + margin
    && z >= FAIR_CORRIDOR.z0 + margin && z <= FAIR_CORRIDOR.z1 - margin;
}

export function inFairZone(x, z, margin = 0.3) {
  return x >= FAIR_ZONE.x0 + margin && x <= FAIR_ZONE.x1 - margin
    && z >= FAIR_ZONE.z0 + margin && z <= FAIR_ZONE.z1 - margin;
}

// Inside the fair's own ring but not on its ground: the fence, and the grass behind the booths.
export function inFairRing(x, z, margin = 0.0) {
  return Math.hypot(x - FAIR.x, z - FAIR.z) <= FAIR.r + margin;
}

// Is this point in the open approach from the lane to a ride's boarding bay?
export function inLink(id, x, z) {
  const link = RIDE_LINK[id];
  const bay = RIDE_BAY[id];
  if (!link || !bay) return false;
  if (Math.abs(x - link.x) > link.halfWidth) return false;
  const z0 = Math.min(link.z, bay.z);
  const z1 = Math.max(link.z, bay.z);
  return z >= z0 && z <= z1;
}

// Is this point inside a ride's disc (plus its clearing)?
export function onRide(x, z, margin = 0.0) {
  return Object.values(RIDES).some((r) => Math.hypot(x - r.x, z - r.z) <= r.clear + margin);
}

// The one call the collision code makes. `true` when the point is on fair ground the couple can stand
// on: the corridor, or inside the fence through the gate.
export function isFairGround(x, z, margin = 0.3) {
  if (inFairCorridor(x, z, margin)) return true;
  if (!inFairZone(x, z, margin)) return false;
  // inside the zone, but the entrance is the only way in and out of the fence line
  if (x <= FAIR_ZONE.x0 + 1.0) return z >= FAIR_GAP.z0 - 1.6 && z <= FAIR_GAP.z1 + 1.6;
  return true;
}

// Anything on fair ground that is solid: the fence, the rides, the stalls. The gate's own opening is
// the exception that keeps the fair enterable (see isFairGround above and the walk rules).
export function isFairSolid(x, y, z, margin = 0.3) {
  // the fence line itself, apart from the gate's opening
  const nearWestFence = Math.abs(x - FAIR_ZONE.x0) < FENCE.thickness + margin;
  const nearEastFence = Math.abs(x - FAIR_ZONE.x1) < FENCE.thickness + margin;
  const nearNorthFence = Math.abs(z - FAIR_ZONE.z0) < FENCE.thickness + margin;
  const nearSouthFence = Math.abs(z - FAIR_ZONE.z1) < FENCE.thickness + margin;
  if (y < FENCE.height + 0.4) {
    const inGate = z >= FAIR_GAP.z0 + margin && z <= FAIR_GAP.z1 - margin;
    if (nearWestFence && !inGate) return true;
    if ((nearEastFence || nearNorthFence || nearSouthFence) && inFairZone(x, z, -margin)) return true;
  }
  // The rides and the booths are solid at their own footprint, *except* each ride's boarding bay: that
  // is where the couple stand to get on, so it has to be open ground.
  if (y < 7) {
    // The bay is a disc cut out of the ride's footprint, right where its seat parks. It has to be at the
    // hub for a wheel (the bottom of a wheel is under its own axle) and at the edge for a deck, so the
    // rule is simply "inside the bay is open", with no extra shape in it.
    const inBay = Object.entries(RIDE_BAY).some(
      ([id, bay]) => Math.hypot(x - bay.x, z - bay.z) <= bay.r || inLink(id, x, z),
    );
    const onAnyRide = Object.values(RIDES).some((r) => Math.hypot(x - r.x, z - r.z) <= r.r + margin);
    if (onAnyRide && !inBay) return true;
    if (STALLS.some((s) => Math.abs(x - s.x) < 1.25 + margin && Math.abs(z - s.z) < 1.0 + margin)) return true;
  }
  return false;
}

// The lane's paving, as a strip: used by the builder and by the tests that keep the couple out of the
// rides' clearing while still on it.
export const LANE = { x0: 20.0, x1: FAIR_ZONE.x0 + 0.6, halfWidth: 1.9 };
