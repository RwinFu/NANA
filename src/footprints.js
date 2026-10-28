import * as THREE from 'three';

// Soft golden footprints that stay on the floor behind the princess and fade out.
// A fixed pool is reused, so nothing is allocated per step.
const POOL_SIZE = 36;
const LIFE = 6.5; // seconds a print lasts
const FADE = 2.5; // the last seconds of a print fade out
const PEAK_OPACITY = 0.95;
const COLOR = '#ffe7a3';

// A sole outline: rounded toe at +y, narrower heel at -y. Rotated flat, toe toward +z.
function soleGeometry() {
  const shape = new THREE.Shape();
  const steps = 28;
  for (let i = 0; i <= steps; i += 1) {
    const t = (i / steps) * Math.PI * 2;
    const y = 0.16 * Math.cos(t);
    let x = 0.095 * Math.sin(t);
    if (y < 0) x *= 0.85;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  const geometry = new THREE.ShapeGeometry(shape, 12);
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

export function createFootprints(scene) {
  const geometry = soleGeometry();
  const pool = [];
  for (let i = 0; i < POOL_SIZE; i += 1) {
    const material = new THREE.MeshBasicMaterial({
      color: COLOR,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide, // the flat sole faces down after rotation, so draw both sides
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false;
    scene.add(mesh);
    pool.push({ mesh, life: 0 });
  }

  let cursor = 0;
  let lastStep = -1;
  const worldPos = new THREE.Vector3();

  function spawn(position, heading) {
    const p = pool[cursor];
    cursor = (cursor + 1) % POOL_SIZE;
    p.life = LIFE;
    p.mesh.position.set(position.x, 0.035, position.z);
    p.mesh.rotation.y = heading;
    p.mesh.visible = true;
  }

  // Each half-stride of the walk cycle leaves one print, alternating feet
  function update(dt, hero, moving) {
    if (moving) {
      const index = Math.floor(hero.stride() / Math.PI);
      if (index !== lastStep) {
        if (lastStep !== -1) {
          hero.feet[index % 2].getWorldPosition(worldPos);
          spawn(worldPos, hero.root.rotation.y);
        }
        lastStep = index;
      }
    }
    for (const p of pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        p.mesh.material.opacity = 0;
        continue;
      }
      p.mesh.material.opacity = PEAK_OPACITY * Math.min(1, p.life / FADE);
    }
  }

  // number of prints still on the floor (used by checks)
  function active() {
    return pool.filter((p) => p.life > 0).length;
  }

  return { update, active };
}
