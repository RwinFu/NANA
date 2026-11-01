// The town's small, shared rules: where it sits around the garden, what its clock says, and
// which windows happen to be lit at any moment.
//
// Kept out of the scene code so they can be reasoned about (and tested) without a renderer:
// everything here is plain numbers.

// ---------- layout -----------------------------------------------------------

// The lane to town leaves the garden on its west side, clear of the castle (|x| < 13), the hall
// (|x| < 3.85) and the photo room (x -16 .. -4.15, z -23.4 .. -16.6), and runs south to the town
// gate. Walkable, so the gate has to be somewhere the couple can actually stand in front of.
export const STREET = { x: -19, z0: 22, z1: -43.6, halfWidth: 1.9 };
export const STREET_HALF_WIDTH = STREET.halfWidth;
export const STREET_EDGE = { min: STREET.x - STREET.halfWidth, max: STREET.x + STREET.halfWidth };

// The town wall stands across the lane, behind the castle; the gatehouse is set into it, closed.
export const TOWN_WALL_Z = -46;
export const TOWN_WALL_LEN = 150;
export const GATE = { x: STREET.x, z: TOWN_WALL_Z + 4.6 };
// A square in front of the gate, where the walk ends
export const PLAZA = { x: STREET.x, z: -33.5, r: 6.5 };
// The clock tower, inside the town and just past the gate: tall enough to read from the square
export const CLOCK_TOWER = { x: -4.5, z: -52.5, dialY: 15.5, dialR: 1.9 };

// The houses that frame the lane, and the few behind the wall that make the skyline. Checked
// against the castle, hall and photo room in the tests.
export const TOWN_HOUSES = [
  // Two terraces along the lane's west side, then a few houses framing the square.
  { x: -25.6, z: -12, w: 5, d: 4.5, h: 6 },
  { x: -25.5, z: -18, w: 5, d: 4.5, h: 7.2 },
  { x: -25.7, z: -24, w: 4.6, d: 4.2, h: 6.6 },
  { x: -30.5, z: -35, w: 7, d: 9, h: 5.8 },
  { x: -30.5, z: -45.5, w: 7, d: 9.5, h: 7 },
  { x: -30, z: -53, w: 5, d: 4, h: 6 },
  // east of the lane, between the photo room and the wall
  { x: -12.4, z: -41.5, w: 4.4, d: 5, h: 6.4 },
  { x: -10.5, z: -46.4, w: 4.4, d: 3, h: 5.4 },
  // behind the wall, for the skyline
  { x: -8.5, z: -54.5, w: 5, d: 4.5, h: 7 },
  { x: 2, z: -50, w: 5, d: 4, h: 6.5 },
];

// Solid boxes for the walk: a house is solid up to its roof, the gatehouse is solid, and the
// wall is solid apart from the gate's own opening (which is closed by the gatehouse).
export const TOWN_WALL_THICKNESS = 1.2;
export const TOWN_WALL_HEIGHT = 6;
export const GATE_HALF_WIDTH = 3;

// Where the "you reached town" moment happens: on the square, at the gatehouse doorstep.
export const GATE_TRIGGER = { x: GATE.x, z: GATE.z + 6.4, r: 2.6 };

// Is this point inside the lane's walkable corridor? Used to keep the rest of the world solid
// south of the castle while the lane stays open.
export function inLane(x, z, margin = 0.3) {
  return Math.abs(x - STREET.x) <= STREET.halfWidth - margin && z <= STREET.z0 + 2 && z >= STREET.z1 - 0.4;
}

// Is this point inside the square in front of the gate?
export function inPlaza(x, z, margin = 0.3) {
  return Math.hypot(x - PLAZA.x, z - PLAZA.z) <= PLAZA.r - margin;
}

// ---------- the clock ---------------------------------------------------------

// Where the clock's two hands point, in radians measured clockwise from 12 o'clock.
export function clockHandAngles(date) {
  const seconds = date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
  const hourAngle = ((seconds % 43200) / 43200) * Math.PI * 2;
  const minuteAngle = ((seconds % 3600) / 3600) * Math.PI * 2;
  return { hourAngle, minuteAngle };
}

// "چهار و نیم" style readout, without a library.
export function clockText(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// A Persian sentence for the moment the couple reaches the gate.
export function gateGreeting(date) {
  const hour = date.getHours();
  const time = clockText(date);
  if (hour >= 20 || hour < 4) return `ساعتِ شهر ${time} است؛ چراغ‌های شهر روشن‌اند، ولی خونه‌مون اون‌جاست.`;
  if (hour >= 4 && hour < 11) return `ساعتِ شهر ${time} است؛ شهر تازه بیدار شده، ولی خونه‌مون اون‌جاست.`;
  return `ساعتِ شهر ${time} است؛ شهر مالِ ماست، ولی خونه‌مون اون‌جاست.`;
}

// ---------- windows ------------------------------------------------------------

// How many of the town's windows are lit at a given hour. Late evening is the liveliest; the
// small hours are nearly dark. `hour` is 0-23 (fractions allowed).
export function windowLitFraction(hour) {
  const h = ((hour % 24) + 24) % 24;
  if (h < 5) return 0.14; // deep night: only night owls
  if (h < 7) return 0.3; // early morning
  if (h < 9) return 0.2; // people leave for work
  if (h < 17) return 0.16; // daytime: windows are not what you notice
  if (h < 19) return 0.38; // home again
  if (h < 22) return 0.74; // the evening: lamps and suppers
  if (h < 24) return 0.56; // late, but not empty
  return 0.14;
}

// A window's on/off rhythm: two slow waves of different lengths, so a window does not blink on a
// fixed beat and neighbours never switch together. `seed` is 0..1 per window, `t` in seconds.
export function windowLevel(seed, t) {
  const slow = Math.sin(t * 0.035 + seed * Math.PI * 2);
  const fast = Math.sin(t * 0.11 + seed * Math.PI * 4.3);
  return Math.min(1, Math.max(0, 0.5 + slow * 0.38 + fast * 0.18));
}

// Which windows are lit: a window is on when its level is under the hour's threshold.
export function isWindowLit(seed, t, hour) {
  return windowLevel(seed, t) < windowLitFraction(hour);
}

// How often a few houses redraw their windows, and how many at a time. Small, so the town changes
// quietly while nobody is staring at it, and nothing stalls a frame.
export const WINDOW_UPDATE_MS = 7000;
export const WINDOWS_PER_UPDATE = 3;
