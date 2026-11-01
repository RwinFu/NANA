import * as THREE from 'three';
import { isCastleSolid } from './castle.js';
import { LAYOUT } from './world.js';
import { FOUNTAIN, GARDEN_BENCH } from './decor.js';
import { inLane, inPlaza, STREET, PLAZA, TOWN_HOUSES, GATE, TOWN_WALL_Z, GATE_HALF_WIDTH, TOWN_WALL_HEIGHT } from './town-night.js';
import { behindCastleBlocked } from './walk-rules.js';
import { SHOP, stallCorners } from './flower-shop.js';
import { isFairGround, isFairSolid } from './fair-rules.js';

const PLAYER_RADIUS = 0.3;
// The boy walks beside the princess, so the hall walls keep this extra distance
const BOY_REACH = 1.5;
const WALK_SPEED = 3.6;
const RUN_SPEED = 6.0;
// Orbit sensitivity: a finger drags the camera faster than a mouse, so touch gets its own rates
const MOUSE_YAW = 0.0056;
const MOUSE_PITCH = 0.0037;
const TOUCH_YAW = 0.0085;
const TOUCH_PITCH = 0.0048;
// Portrait screens are narrow, so the camera sits a little farther back to fit the couple
function baseDistance() {
  return window.innerWidth / Math.max(1, window.innerHeight) < 0.8 ? 6.3 : 5.4;
}
// Jump: about 1 m high, about 0.8 s in the air
const JUMP_SPEED = 5.0;
const JUMP_GRAVITY = 12.5;
const JUMP_BUFFER = 0.12; // a press just before landing still jumps
const MOVE_KEYS = {
  KeyW: [0, 1], ArrowUp: [0, 1],
  KeyS: [0, -1], ArrowDown: [0, -1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};

// Solid geometry, shared by the player and the camera.
// Walls are thin boxes; the door is an opening in the facade.
export function isSolid(x, y, z, margin = PLAYER_RADIUS) {
  if (isCastleSolid(x, y, z, margin)) return true;
  const hall = LAYOUT.hallHalfWidth;
  const len = LAYOUT.hallLength;
  // House facade with a door opening at x in [-1.5, 1.5]
  if (Math.abs(z) < 0.5 + margin && Math.abs(x) > LAYOUT.doorHalfWidth - margin && Math.abs(x) < 10.5 && y < 8) {
    return true;
  }
  // Hall side walls and ceiling. The west wall has a doorway into the photo room.
  const R = LAYOUT.room;
  const throughDoor = x < 0 && z <= R.door.z1 - margin && z >= R.door.z0 + margin && y < R.door.top;
  // This band only applies inside the hall (|x| < hall); the photo room beyond the wall has its own walls below.
  const inHall = Math.abs(x) < hall + 0.3;
  if (inHall && z <= 0.2 && z > -len - margin && Math.abs(x) > hall - margin - BOY_REACH && !throughDoor && y < LAYOUT.hallSpring) return true;
  if (z <= 0.2 && z > -len && y >= LAYOUT.hallHeight) return true;
  // Hall end wall
  if (z <= -len + margin) return true;
  // The fountain in the garden: the couple walks around its basin
  if (Math.hypot(x - FOUNTAIN.x, z - FOUNTAIN.z) < FOUNTAIN.r + margin && y < 1.8) return true;
  // Keep the bench solid without changing the route along the central path.
  if (Math.abs(x - GARDEN_BENCH.x) < GARDEN_BENCH.halfWidth + margin &&
      Math.abs(z - GARDEN_BENCH.z) < GARDEN_BENCH.halfDepth + margin && y < 1.4) return true;
  // The flower shop's counter on the square: solid, so the couple buy from the front of it rather
  // than walking through it. Checked against the stall's own footprint, because it is turned to
  // face the walk rather than lined up with the axes.
  if (y < 2.6) {
    const corners = stallCorners();
    const hw = SHOP.halfWidth + 0.12 + margin;
    const dz = SHOP.counterDepth + 0.12 + margin;
    // to the stall's own frame: turn the point back by -rotY and compare with the counter box
    const dx = x - SHOP.x;
    const dzz = z - SHOP.z;
    const c = Math.cos(SHOP.rotY);
    const s = Math.sin(SHOP.rotY);
    const localX = dx * c - dzz * s;
    const localZ = dx * s + dzz * c;
    if (corners && Math.abs(localX) < hw && localZ > -dz && localZ < dz) return true;
  }
  // The big envelope at the end of the hall
  const env = LAYOUT.envelope;
  if (Math.abs(x) < env.w / 2 + margin && Math.abs(z - env.z) < 0.1 + margin && y < env.y + env.h + 0.3) {
    return true;
  }
  // The photo room: its walls, and the doorway in the hall's west wall
  const inBox = x >= R.ox0 - margin && x <= R.ox1 + margin && z >= R.oz0 - margin && z <= R.oz1 + margin;
  if (y < R.height) {
    const inside = x >= R.x0 + margin && x <= R.x1 - margin && z >= R.z0 + margin && z <= R.z1 - margin;
    const doorway = x >= R.x1 - margin && z >= R.door.z0 + margin && z <= R.door.z1 - margin;
    if (inBox && !inside && !doorway) return true;
  }
  // The room's ceiling: the camera must not rise above it and look in from the top
  if (inBox && y >= R.height - margin && y < R.height + 0.3) return true;
  // The lane to town and the square in front of its gate are outside the garden's own limits
  const onLane = inLane(x, z, margin) || inPlaza(x, z, margin);
  // The funfair east of the castle: its lane and its own ground are open, so the garden's east limit
  // (and the "nothing behind the castle" rule below) must yield to them. Its fence, rides and booths
  // are solid in their own right.
  const onFair = isFairGround(x, z, margin);
  if (onFair && isFairSolid(x, y, z, margin)) return true;
  // Garden limits
  if (!onLane && !onFair && Math.abs(x) > LAYOUT.gardenHalfWidth) return true;
  if (!onLane && !onFair && z > LAYOUT.gardenDepth) return true;
  // Past the castle, only the lane and the square are open ground: the castle's own service yards
  // behind the facade are not. This has to stay *under* the roof (the wall's own top is 7 m, the
  // vault's crown 10.3 m): when it reached up to 12 m, the camera could not rise above the castle
  // to look at it, so its walls were only ever seen from the grass.
  //
  // It also has to leave the hall alone: the zone starts at z = -1, a step past the doorway, so an
  // exception for the hall is what keeps the front door usable. See src/walk-rules.js.
  const throughFrontDoor = Math.abs(x) < hall + 0.2 && z > -len - margin;
  if (behindCastleBlocked({ z, y, onLane: onLane || onFair, inHall: throughFrontDoor, inRoom: inBox })) return true;
  // A couple of metres either side of the lane are a soft shoulder, nothing more
  if (onLane && y < 2) {
    // ... and the houses that frame it are solid
    const inHouse = TOWN_HOUSES.some(
      (h) => Math.abs(x - h.x) < h.w / 2 + margin && Math.abs(z - h.z) < h.d / 2 + margin
    );
    if (inHouse) return true;
  }
  // The low garden wall that runs along the lane, so the couple stays on the stones
  if (onLane && y < 0.9) {
    const laneEdge = STREET.halfWidth - margin;
    if (Math.abs(Math.abs(x - STREET.x) - (STREET.halfWidth + 0.85)) < 0.2 + margin && z < 16 && z > -34) return true;
    if (Math.abs(x - STREET.x) > laneEdge + 0.7) return true;
  }
  // The town wall, apart from the gatehouse's own opening, and the gatehouse itself
  if (Math.abs(z - TOWN_WALL_Z) < 0.7 + margin && y < TOWN_WALL_HEIGHT && Math.abs(x - GATE.x) > GATE_HALF_WIDTH - margin) {
    return true;
  }
  // The gatehouse itself: 10 m wide, its face at GATE.z + 3, its back against the wall. The lane
  // ends at its steps.
  if (Math.abs(x - GATE.x) < 5 + margin && z < GATE.z + 3 + margin && z > GATE.z - 5 && y < 13) return true;
  return false;
}

export function createControls({ camera, canvas, player, playerModel, isBlocked, onTapFrame }) {
  const keys = new Set();
  const joystick = { x: 0, y: 0, active: false };
  const pos = LAYOUT.spawn.clone();
  let heading = Math.PI; // facing the house
  let yaw = 0; // camera orbit angle around the player
  let pitch = 0.42;
  let distance = baseDistance();
  let targetDistance = distance;
  let camDist = distance; // the distance the camera is really at, after walls
  let spin = { yaw: 0, pitch: 0 }; // touch flick momentum, in radians per frame
  let lastDragAt = 0;
  let dragKind = 'mouse';
  const lookAt = pos.clone();
  let moving = false;
  let running = false;
  const pointers = new Map();
  let dragging = null;
  let pinchStart = 0;
  let pinchDistance = 0;
  let downAt = null;
  let benchSeated = false;
  const benchSeat = new THREE.Vector3(GARDEN_BENCH.x - 0.43, 0, GARDEN_BENCH.z);
  let jumpY = 0; // height above the ground
  let jumpVy = 0;
  let jumpBuf = 0;

  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const move = new THREE.Vector3();

  function onKeyDown(event) {
    if (isBlocked() || benchSeated) return;
    if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable]')) return;
    if (MOVE_KEYS[event.code]) {
      keys.add(event.code);
      if (event.code.startsWith('Arrow')) event.preventDefault();
    }
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') running = true;
    if (event.code === 'Space') {
      event.preventDefault();
      if (!event.repeat) jumpBuf = JUMP_BUFFER;
    }
  }
  function onKeyUp(event) {
    keys.delete(event.code);
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') running = false;
  }
  function onBlur() {
    keys.clear();
    running = false;
    joystick.x = 0;
    joystick.y = 0;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  // Canvas: drag to orbit, wheel / pinch to zoom, tap a frame to open it
  function onPointerDown(event) {
    if (event.button !== undefined && event.button !== 0 && event.pointerType === 'mouse') return;
    canvas.setPointerCapture?.(event.pointerId);
    dragKind = event.pointerType || 'mouse';
    spin = { yaw: 0, pitch: 0 };
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    downAt = { x: event.clientX, y: event.clientY, time: performance.now(), id: event.pointerId };
    if (pointers.size === 1) {
      dragging = { x: event.clientX, y: event.clientY };
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
      pinchStart = targetDistance;
      dragging = null;
    }
  }
  function onPointerMove(event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDistance > 0) targetDistance = clampDistance(pinchStart * (pinchDistance / Math.max(d, 1)));
      return;
    }
    if (dragging && pointers.size === 1) {
      const dx = event.clientX - dragging.x;
      const dy = event.clientY - dragging.y;
      dragging = { x: event.clientX, y: event.clientY };
      const touch = dragKind === 'touch' || dragKind === 'pen';
      const dYaw = -dx * (touch ? TOUCH_YAW : MOUSE_YAW);
      const dPitch = dy * (touch ? TOUCH_PITCH : MOUSE_PITCH);
      yaw += dYaw;
      pitch = THREE.MathUtils.clamp(pitch + dPitch, 0.12, 1.2);
      lastDragAt = performance.now();
      spin = touch ? { yaw: dYaw, pitch: dPitch } : { yaw: 0, pitch: 0 };
    }
  }
  function onPointerUp(event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    if (downAt && downAt.id === event.pointerId && pointers.size === 0) {
      const moved = Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y);
      const quick = performance.now() - downAt.time < 450;
      if (moved < 8 && quick && onTapFrame) {
        const rect = canvas.getBoundingClientRect();
        const ndc = new THREE.Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
        onTapFrame(ndc);
      }
    }
    if (pointers.size === 0) {
      dragging = null;
      downAt = null;
      // A quick flick keeps the camera turning briefly, then it eases to a stop
      if (performance.now() - lastDragAt > 90) spin = { yaw: 0, pitch: 0 };
    }
    if (pointers.size === 1) {
      const [only] = pointers.values();
      dragging = { x: only.x, y: only.y };
    }
  }
  function onWheel(event) {
    if (isBlocked()) return;
    event.preventDefault();
    targetDistance = clampDistance(targetDistance + event.deltaY * 0.0045);
  }
  function clampDistance(d) {
    return THREE.MathUtils.clamp(d, 2.6, 10);
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  function computeMoveInput() {
    let ix = joystick.x;
    let iy = joystick.y;
    keys.forEach((code) => {
      const [kx, ky] = MOVE_KEYS[code];
      ix += kx;
      iy += ky;
    });
    const len = Math.hypot(ix, iy);
    if (len > 1) {
      ix /= len;
      iy /= len;
    }
    return [ix, iy];
  }

  function tryMove(nx, nz) {
    // Axis-separated collision keeps you sliding along walls.
    if (!isSolid(nx, 0, pos.z)) pos.x = nx;
    if (!isSolid(pos.x, 0, nz)) pos.z = nz;
  }

  function jump() {
    if (isBlocked() || benchSeated) return;
    jumpBuf = JUMP_BUFFER;
  }

  function updateJump(dt) {
    if (jumpBuf > 0 && jumpY === 0) {
      jumpVy = JUMP_SPEED;
      jumpBuf = 0;
    }
    jumpBuf = Math.max(0, jumpBuf - dt);
    if (jumpY > 0 || jumpVy > 0) {
      jumpVy -= JUMP_GRAVITY * dt;
      jumpY += jumpVy * dt;
      if (jumpY <= 0) {
        jumpY = 0;
        jumpVy = 0;
      }
    }
  }

  // ---------- riding: the camera is handed to the ride -------------------------
  // While a ride is on, the couple stand at the foot of it and the camera arcs around the ride. The
  // walk keys are ignored, so nobody walks off mid-turn, and the camera is placed here rather than by
  // the follow rig: it lerps in and out through the same placeCamera easing, so there is no cut.
  let ride = null; // { path, t, duration }
  // The ride's share of the camera: 0 is the follow rig, 1 is the ride. It eases in when a turn starts
  // and back out when it ends, so neither the cut into the ride nor the return to walking snaps. The
  // last frame of the arc is kept so the fade out has something to ease from.
  let rideShare = 0;
  const ridePos = new THREE.Vector3();
  const rideLook = new THREE.Vector3();

  // `seat` answers "where are we sitting right now?" from the ride's progress. The couple are carried
  // there: their ground position is eased onto the seat's own, and the seat's height is what lifts them
  // off the grass, so a wheel carries them up and a slide carries them down without any special case.
  function startRide(path, seconds, seat = null) {
    ride = { path, t: 0, duration: Math.max(0.2, seconds), seat, boarded: false, boardTime: 0 };
    rideCancelled = false;
    rideStand.set(pos.x, 0, pos.z);
    keys.clear();
    joystick.x = joystick.y = 0;
  }
  function endRide() {
    if (ride) {
      // set down where they stepped in, so nobody is left in mid-air or inside a ride
      pos.x = rideStand.x;
      pos.z = rideStand.z;
      jumpY = 0;
      jumpVy = 0;
    }
    ride = null;
    rideCancelled = false;
    camDist = distance;
  }
  const rideStand = new THREE.Vector3();
  const seatPoint = new THREE.Vector3();

  // Where the couple are, on the ride.
  //
  // Two phases, because they are two different motions:
  //   * boarding — a short step from where they stand onto the seat, eased, so nobody teleports;
  //   * riding   — from then on they are *fixed* to the seat. A gondola or a horse moves every frame,
  //                and easing toward a moving point is exactly how a character ends up trailing behind
  //                the thing they are supposedly sitting on.
  function carryToSeat(dt) {
    if (!ride || !ride.seat) return;
    const seat = ride.seat(rideProgress(), seatPoint, rideProgress());
    if (!seat) return;
    if (ride.boarded) {
      pos.x = seat.x;
      pos.z = seat.z;
      jumpY = Math.max(0, seat.y);
    } else {
      const k = Math.min(1, dt * 8);
      pos.x += (seat.x - pos.x) * k;
      pos.z += (seat.z - pos.z) * k;
      jumpY += (Math.max(0, seat.y) - jumpY) * Math.min(1, dt * 5);
      // Close enough to be seated, or long enough trying: from now on, they ride. The time-out matters
      // for a ride that leaves the ground immediately (the helter-skelter's stair): its seat rises
      // faster than anyone could be eased onto it, and without this the couple would trail the stair.
      ride.boardTime += dt;
      const close = Math.hypot(seat.x - pos.x, seat.z - pos.z) < 0.25 && Math.abs(seat.y - jumpY) < 0.3;
      if (close || ride.boardTime > 0.55) ride.boarded = true;
    }
    jumpVy = 0;
    jumpBuf = 0;
  }
  function rideProgress() {
    return ride ? Math.min(1, ride.t / ride.duration) : 0;
  }

  let rideCancelled = false;
  function update(dt) {
    if (ride) ride.t += dt;
    // A pressed walk key during a ride is not swallowed: it means "let me walk", so the turn is flagged
    // as interrupted and the caller ends it on the same frame.
    if (ride && !isBlocked() && !benchSeated) {
      const [rx, ry] = computeMoveInput();
      if (Math.hypot(rx, ry) > 0.05) rideCancelled = true;
    }
    const [ix, iy] = isBlocked() || benchSeated || ride ? [0, 0] : computeMoveInput();
    if (benchSeated) {
      pos.lerp(benchSeat, 1 - Math.exp(-dt * 5));
      heading = lerpAngle(heading, Math.PI, 1 - Math.exp(-dt * 5));
    }
    if (ride) carryToSeat(dt);
    else updateJump(dt);

    // Camera-relative directions on the ground plane
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
    forward.normalize();
    right.set(-forward.z, 0, forward.x);

    move.set(0, 0, 0).addScaledVector(right, ix).addScaledVector(forward, iy);
    moving = move.lengthSq() > 1e-4;
    if (moving) {
      const speed = (running ? RUN_SPEED : WALK_SPEED) * Math.min(1, move.length());
      move.normalize().multiplyScalar(speed * dt);
      tryMove(pos.x + move.x, pos.z + move.z);
      const targetHeading = Math.atan2(move.x, move.z);
      heading = lerpAngle(heading, targetHeading, Math.min(1, dt * 12));
    }

    if (ride) {
      // facing out from the ride's centre, so they look over the fence rather than at the hub
      if (ride.path && ride.path.face) heading = lerpAngle(heading, ride.path.face, Math.min(1, dt * 2));
    }
    player.position.set(pos.x, jumpY, pos.z);
    playerModel.rotation.y = heading;

    // Touch flick momentum eases out; a new drag cancels it
    if (!dragging && (spin.yaw || spin.pitch)) {
      const k = dt * 60;
      yaw += spin.yaw * k;
      pitch = THREE.MathUtils.clamp(pitch + spin.pitch * k, 0.12, 1.2);
      const decay = Math.exp(-dt * 5);
      spin.yaw *= decay;
      spin.pitch *= decay;
      if (Math.abs(spin.yaw) < 1e-4) spin.yaw = 0;
      if (Math.abs(spin.pitch) < 1e-4) spin.pitch = 0;
    }

    // Camera follows smoothly and never passes through walls
    distance += (targetDistance - distance) * Math.min(1, dt * 8);
    lookAt.lerp(new THREE.Vector3(pos.x, 1.5 + jumpY * 0.35, pos.z), Math.min(1, dt * 10));
    placeCamera(dt);
    // the ride's share eases in and out; below a hair it is the follow camera, untouched
    const wanted = ride ? 1 : 0;
    rideShare += (wanted - rideShare) * Math.min(1, dt * (ride ? 5 : 4));
    if (Math.abs(wanted - rideShare) < 0.002) rideShare = wanted;
    if (rideShare > 0.002) placeRideCamera();
  }

  // The ride's own camera: an arc from where the camera was when the turn began to the ride's own
  // viewpoint, mixed over the follow camera by `rideShare`. While the share eases back to zero after a
  // turn, the arc's last frame is what it eases from, so leaving a ride is as smooth as entering it.
  function placeRideCamera() {
    if (ride) {
      const k = rideProgress();
      const e = k * k * (3 - 2 * k);
      const { path } = ride;
      ridePos.set(
        path.from.x + (path.to.x - path.from.x) * e,
        path.from.y + (path.to.y - path.from.y) * e,
        path.from.z + (path.to.z - path.from.z) * e,
      );
      // The camera watches the ride, but the look target rises with the couple: when the wheel takes
      // them up, the camera lifts its gaze instead of staring at the hub.
      const seatY = jumpY;
      rideLook.set(
        path.lookFrom.x + (path.lookTo.x - path.lookFrom.x) * e,
        (path.lookFrom.y + (path.lookTo.y - path.lookFrom.y) * e) * 0.55 + seatY * 0.6 + 0.9,
        path.lookFrom.z + (path.lookTo.z - path.lookFrom.z) * e,
      );
    }
    camera.position.lerp(ridePos, rideShare);
    // the look target eases the same way, from the follow rig's own target to the ride's
    const tx = lookAt.x + (rideLook.x - lookAt.x) * rideShare;
    const ty = (lookAt.y + 0.2) + (rideLook.y - lookAt.y - 0.2) * rideShare;
    const tz = lookAt.z + (rideLook.z - lookAt.z) * rideShare;
    camera.lookAt(tx, ty, tz);
  }

  const MIN_CAM_DISTANCE = 1.0;
  function placeCamera(dt = 0) {
    const cosP = Math.cos(pitch);
    const dirX = cosP * Math.sin(yaw);
    const dirY = Math.sin(pitch);
    const dirZ = cosP * Math.cos(yaw);
    const blocked = (d) => isSolid(lookAt.x + d * dirX, lookAt.y + d * dirY, lookAt.z + d * dirZ, 0.25);
    // The ray from the player out to the camera must be clear all the way, so the camera
    // never lands on the far side of a thin wall. Stop just before the first obstacle.
    let free = distance;
    for (let d = MIN_CAM_DISTANCE; d <= distance; d += 0.1) {
      if (blocked(d)) {
        free = Math.max(MIN_CAM_DISTANCE, d - 0.1);
        break;
      }
    }
    // Walls pull the camera in quickly and let it out slowly, so it never snaps around a corner
    const rate = free < camDist ? 12 : 6;
    camDist += (free - camDist) * Math.min(1, dt * rate);
    if (blocked(camDist)) camDist = free;
    camera.position.set(
      lookAt.x + camDist * dirX,
      Math.max(0.5, lookAt.y + camDist * dirY),
      lookAt.z + camDist * dirZ,
    );
    camera.lookAt(lookAt.x, lookAt.y + 0.2, lookAt.z);
  }

  function lerpAngle(a, b, t) {
    let diff = b - a;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return a + diff * t;
  }

  function reset() {
    pos.copy(LAYOUT.spawn);
    heading = Math.PI;
    yaw = 0;
    lookAt.set(pos.x, 1.5, pos.z);
    targetDistance = distance = baseDistance();
    spin = { yaw: 0, pitch: 0 };
    keys.clear();
    joystick.x = 0;
    joystick.y = 0;
    jumpY = 0;
    jumpVy = 0;
    jumpBuf = 0;
    camDist = distance;
    placeCamera(0);
  }

  function setJoystick(x, y, active) {
    joystick.x = x;
    joystick.y = y;
    joystick.active = active;
  }

  function dispose() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('blur', onBlur);
  }

  reset();

  return {
    update,
    reset,
    jump,
    // The point the camera looks at, for smooth hand-offs from other camera views
    get focus() {
      return new THREE.Vector3(lookAt.x, lookAt.y + 0.2, lookAt.z);
    },
    setJoystick,
    // Riding a fairground ride: the camera is handed over until `endRide` is called.
    startRide,
    endRide,
    get riding() {
      return !!ride;
    },
    get rideSeatY() {
      return jumpY;
    },
    get rideProgress() {
      return rideProgress();
    },
    get rideCancelled() {
      return rideCancelled;
    },
    setBenchSeated(value) {
      benchSeated = value;
      keys.clear();
      running = false;
      joystick.x = joystick.y = 0;
      jumpY = jumpVy = jumpBuf = 0;
      if (!value) {
        // Stand up in front of the seat, safely outside its collision box and the fountain.
        pos.set(GARDEN_BENCH.x - 0.43, 0, GARDEN_BENCH.z - 1.05);
      }
    },
    dispose,
    get position() {
      return pos;
    },
    get moving() {
      return moving;
    },
    get airborne() {
      return jumpY > 0;
    },
    get jumpHeight() {
      return jumpY;
    },
    get running() {
      return running;
    },
    isNear(x, z, radius) {
      return Math.hypot(pos.x - x, pos.z - z) <= radius;
    },
    faceToward(x, z) {
      heading = Math.atan2(x - pos.x, z - pos.z);
    },
  };
}
