import * as THREE from 'three';
import { LAYOUT } from './world.js';

const PLAYER_RADIUS = 0.3;
const WALK_SPEED = 3.6;
const RUN_SPEED = 6.0;
const MOVE_KEYS = {
  KeyW: [0, 1], ArrowUp: [0, 1],
  KeyS: [0, -1], ArrowDown: [0, -1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};

// Solid geometry, shared by the player and the camera.
// Walls are thin boxes; the door is an opening in the facade.
export function isSolid(x, y, z, margin = PLAYER_RADIUS) {
  const hall = LAYOUT.hallHalfWidth;
  const len = LAYOUT.hallLength;
  // House facade with a door opening at x in [-1.5, 1.5]
  if (Math.abs(z) < 0.5 + margin && Math.abs(x) > LAYOUT.doorHalfWidth - margin && Math.abs(x) < 10.5 && y < 8) {
    return true;
  }
  // Hall side walls and ceiling
  if (z <= 0.2 && z > -len - margin && Math.abs(x) > hall - margin && y < 6) return true;
  if (z <= 0.2 && z > -len && y >= 6) return true;
  // Hall end wall
  if (z <= -len + margin) return true;
  // The big envelope at the end of the hall
  const env = LAYOUT.envelope;
  if (Math.abs(x) < env.w / 2 + margin && Math.abs(z - env.z) < 0.1 + margin && y < env.y + env.h + 0.3) {
    return true;
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
  let distance = 5.4;
  let targetDistance = distance;
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
      yaw -= dx * 0.0056;
      pitch = THREE.MathUtils.clamp(pitch + dy * 0.0037, 0.12, 1.2);
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
    targetDistance = distance = 5.4;
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
