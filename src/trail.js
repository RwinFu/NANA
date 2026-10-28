import * as THREE from 'three';

// Little hearts drift up from the couple's feet while they walk together.
// A fixed pool of meshes is reused, so nothing is allocated per frame.
const POOL_SIZE = 30;
const SPAWN_EVERY = 0.3; // seconds between hearts while moving
const LIFE = 1.8;
const COLORS = ['#ff8fab', '#ffd98a', '#ffb3c6'];

function heartGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.25);
  s.bezierCurveTo(-0.5, 0.05, -0.25, 0.45, 0, 0.2);
  s.bezierCurveTo(0.25, 0.45, 0.5, 0.05, 0, -0.25);
  return new THREE.ShapeGeometry(s, 8);
}

export function createTrail(scene) {
  const geometry = heartGeometry();
  const pool = [];
  for (let i = 0; i < POOL_SIZE; i += 1) {
    const material = new THREE.MeshBasicMaterial({
      color: COLORS[i % COLORS.length],
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false;
    mesh.scale.setScalar(0.22);
    scene.add(mesh);
    pool.push({ mesh, life: 0, vx: 0, vz: 0 });
  }

  let cursor = 0;
  let timer = 0;

  function spawn(origin) {
    const p = pool[cursor];
    cursor = (cursor + 1) % POOL_SIZE;
    p.life = LIFE;
    p.vx = (Math.random() - 0.5) * 0.25;
    p.vz = (Math.random() - 0.5) * 0.25;
    p.mesh.position.set(
      origin.x + (Math.random() - 0.5) * 0.7,
      0.3 + Math.random() * 0.2,
      origin.z + (Math.random() - 0.5) * 0.5,
    );
    p.mesh.visible = true;
  }

  // Called once per frame. `camera` is used to billboard the hearts.
  function update(dt, origin, moving, camera) {
    timer -= dt;
    if (moving && timer <= 0) {
      spawn(origin);
      timer = SPAWN_EVERY;
    }
    for (const p of pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        p.mesh.material.opacity = 0;
        continue;
      }
      const k = p.life / LIFE; // 1 at birth, 0 at the end
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.z += p.vz * dt;
      p.mesh.position.y += 0.35 * dt;
      p.mesh.material.opacity = Math.min(1, k * 2) * 0.9;
      p.mesh.scale.setScalar(0.22 * (0.7 + 0.5 * (1 - k)));
      p.mesh.quaternion.copy(camera.quaternion);
    }
  }

  return { update };
}
