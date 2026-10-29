import * as THREE from 'three';
import { isCastleSolid } from './castle.js';
import { LAYOUT } from './world.js';

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
  if (z <= 0.2 && z > -len - margin && Math.abs(x) > hall - margin - BOY_REACH && !throughDoor && y < 6) return true;
  if (z <= 0.2 && z > -len && y >= 6) return true;
  // Hall end wall
  if (z <= -len + margin) return true;
  // The big envelope at the end of the hall
  const env = LAYOUT.envelope;
  if (Math.abs(x) < env.w / 2 + margin && Math.abs(z - env.z) < 0.1 + margin && y < env.y + env.h + 0.3) {
    return true;
  }
  // The photo room (inside the castle): its walls, and the doorway in the hall's west wall
  if (y < R.height) {
    const inBox = x >= R.ox0 - margin && x <= R.ox1 + margin && z >= R.oz0 - margin && z <= R.oz1 + margin;
    const inside = x >= R.x0 + margin && x <= R.x1 - margin && z >= R.z0 + margin && z <= R.z1 - margin;
    const doorway = x >= R.x1 - margin && z >= R.door.z0 + margin && z <= R.door.z1 - margin;
    if (inBox && !inside && !doorway) return true;
  }
  // Garden limits
  if (Math.abs(x) > LAYOUT.gardenHalfWidth) return true;
  if (z > LAYOUT.gardenDepth) return true;
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

  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const move = new THREE.Vector3();

  function onKeyDown(event) {
    if (isBlocked()) return;
    if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable]')) return;
    if (MOVE_KEYS[event.code]) {
      keys.add(event.code);
      if (event.code.startsWith('Arrow')) event.preventDefault();
    }
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') running = true;
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

  function update(dt) {
    const [ix, iy] = isBlocked() ? [0, 0] : computeMoveInput();

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

    player.position.set(pos.x, 0, pos.z);
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
    lookAt.lerp(new THREE.Vector3(pos.x, 1.5, pos.z), Math.min(1, dt * 10));
    placeCamera();
  }

  function placeCamera() {
    const cosP = Math.cos(pitch);
    for (let d = distance; d >= 1.0; d -= 0.4) {
      const x = lookAt.x + d * cosP * Math.sin(yaw);
      const y = lookAt.y + d * Math.sin(pitch);
      const z = lookAt.z + d * cosP * Math.cos(yaw);
      if (!isSolid(x, y, z, 0.25) || d <= 1.0) {
        camera.position.set(x, Math.max(0.5, y), z);
        break;
      }
    }
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
    placeCamera();
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
    setJoystick,
    dispose,
    get position() {
      return pos;
    },
    get moving() {
      return moving;
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
