import * as THREE from 'three';

// The front of the house becomes a princess castle: two round towers with pink cone roofs,
// a tall central keep above the door, a battlement along the top, arched glowing windows,
// pennants, and rose bushes at the foot of the walls.
export const CASTLE = { towerX: 11.2, towerR: 1.5, towerH: 12.5 };

export function buildCastle(scene, track) {
  const stone = track(new THREE.MeshStandardMaterial({ color: '#f1e4d6', roughness: 0.8 }));
  const roof = track(new THREE.MeshStandardMaterial({ color: '#e98fb1', roughness: 0.45 }));
  const roofDeep = track(new THREE.MeshStandardMaterial({ color: '#b5557a', roughness: 0.5 }));
  const gold = track(new THREE.MeshStandardMaterial({ color: '#f5c96a', metalness: 0.7, roughness: 0.3 }));
  const glow = track(new THREE.MeshBasicMaterial({ color: '#ffd38a', fog: false }));
  const flag = track(new THREE.MeshStandardMaterial({ color: '#ff8fab', roughness: 0.6, side: THREE.DoubleSide }));
  const rose = track(new THREE.MeshStandardMaterial({ color: '#d8577f', roughness: 0.7 }));
  const leaf = track(new THREE.MeshStandardMaterial({ color: '#2c6b52', roughness: 0.9 }));

  const add = (geometry, material, x, y, z) => {
    const mesh = track(new THREE.Mesh(geometry, material));
    mesh.position.set(x, y, z);
    scene.add(mesh);
    return mesh;
  };

  // Round tower with a cone roof, a gold tip, a window and a pennant
  function tower(x, z, h, r) {
    add(new THREE.CylinderGeometry(r, r * 1.06, h, 24), stone, x, h / 2, z);
    const roofH = h * 0.42;
    add(new THREE.ConeGeometry(r * 1.22, roofH, 24), roof, x, h + roofH / 2, z);
    add(new THREE.SphereGeometry(0.12, 12, 10), gold, x, h + roofH + 0.04, z);
    // a thin gold ring under the roof
    const ring = add(new THREE.TorusGeometry(r * 1.02, 0.07, 8, 28), gold, x, h - 0.1, z);
    ring.rotation.x = Math.PI / 2;
    // arched window facing the garden
    add(new THREE.PlaneGeometry(0.42, 0.9), glow, x, h * 0.55, z + r + 0.01);
    // flagpole and pennant
    add(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 6), gold, x, h + roofH + 0.8, z);
    const pennant = add(new THREE.PlaneGeometry(0.7, 0.32), flag, x + 0.36, h + roofH + 1.3, z);
    pennant.rotation.y = 0.0;
  }

  // Walls and towers
  tower(-CASTLE.towerX, 0, CASTLE.towerH, CASTLE.towerR);
  tower(CASTLE.towerX, 0, CASTLE.towerH, CASTLE.towerR);

  // Central keep above the door
  const keepH = 5.5;
  add(new THREE.BoxGeometry(5.2, keepH, 2.2), stone, 0, 8 + keepH / 2, -0.2);
  add(new THREE.ConeGeometry(2.9, 4.2, 4), roofDeep, 0, 8 + keepH + 2.1, -0.2).rotation.y = Math.PI / 4;
  add(new THREE.SphereGeometry(0.16, 12, 10), gold, 0, 8 + keepH + 4.3, -0.2);
  // keep windows, glowing
  [-1.4, 0, 1.4].forEach((x) => add(new THREE.PlaneGeometry(0.5, 1.1), glow, x, 10.4, 0.92));

  // Battlement along the top of the facade (gaps over the keep)
  for (let x = -9.4; x <= 9.4; x += 1.1) {
    if (Math.abs(x) < 2.6) continue;
    add(new THREE.BoxGeometry(0.55, 0.6, 0.6), stone, x, 8.3, 0.2);
  }

  // Arched windows on the front wall, either side of the door
  [-8.2, -5.6, -3.4, 3.4, 5.6, 8.2].forEach((x) => {
    add(new THREE.PlaneGeometry(0.85, 1.6), glow, x, 4.9, 0.335);
    // a small pink sill
    add(new THREE.BoxGeometry(1.05, 0.12, 0.18), roof, x, 4.0, 0.35);
  });

  // Rose bushes at the foot of the towers and the wall
  const roseSpots = [
    [-CASTLE.towerX + 1.6, 1.8], [CASTLE.towerX - 1.6, 1.8],
    [-6.5, 1.5], [6.5, 1.5], [-2.4, 2.0], [2.4, 2.0],
  ];
  roseSpots.forEach(([x, z]) => {
    add(new THREE.SphereGeometry(0.55, 14, 10), leaf, x, 0.35, z);
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      add(new THREE.SphereGeometry(0.12, 10, 8), rose, x + Math.cos(a) * 0.38, 0.62 + (i % 2) * 0.12, z + Math.sin(a) * 0.38);
    }
  });
}

// Solid parts of the castle, for the player and the camera: the towers
export function isCastleSolid(x, y, z, margin) {
  const d = Math.hypot(Math.abs(x) - CASTLE.towerX, z);
  return d < CASTLE.towerR + margin && y < CASTLE.towerH + 3;
}
