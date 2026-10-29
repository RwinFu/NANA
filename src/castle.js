import * as THREE from 'three';

// The front of the house is a princess castle, in the spirit of a storybook castle:
// a tall central keep with a spire, two tall flanking towers, two low outer towers,
// battlements, arched glowing windows and waving pennants.
const FLANK_Z = 0.4;
export const TOWERS = [
  { x: -12.6, z: 0, r: 1.8, h: 12 }, // outer left
  { x: 12.6, z: 0, r: 1.8, h: 12 }, // outer right
  { x: -6.8, z: FLANK_Z, r: 1.5, h: 15.5 }, // flank left
  { x: 6.8, z: FLANK_Z, r: 1.5, h: 15.5 }, // flank right
];
const KEEP = { x: 0, z: -0.6, r: 2.3, base: 8, top: 19 };

export function buildCastle(scene, track) {
  const stone = track(new THREE.MeshStandardMaterial({ color: '#f1e4d6', roughness: 0.8 }));
  const roof = track(new THREE.MeshStandardMaterial({ color: '#e98fb1', roughness: 0.45 }));
  const roofDeep = track(new THREE.MeshStandardMaterial({ color: '#b5557a', roughness: 0.5 }));
  const gold = track(new THREE.MeshStandardMaterial({ color: '#f5c96a', metalness: 0.7, roughness: 0.3 }));
  const flagMat = track(new THREE.MeshStandardMaterial({ color: '#ff8fab', roughness: 0.6, side: THREE.DoubleSide }));
  const rose = track(new THREE.MeshStandardMaterial({ color: '#d8577f', roughness: 0.7 }));
  const leaf = track(new THREE.MeshStandardMaterial({ color: '#2c6b52', roughness: 0.9 }));

  const windows = [];
  const dimWin = new THREE.Color('#5b4a3a');
  const brightWin = new THREE.Color('#ffd38a');
  const addWindow = (w, h, x, y, z, rotY = 0) => {
    const mat = track(new THREE.MeshBasicMaterial({ color: dimWin.clone(), fog: false, side: THREE.DoubleSide }));
    const mesh = track(new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat));
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    scene.add(mesh);
    windows.push(mat);
    return mesh;
  };
  const add = (geometry, material, x, y, z) => {
    const mesh = track(new THREE.Mesh(geometry, material));
    mesh.position.set(x, y, z);
    scene.add(mesh);
    return mesh;
  };

  const pennants = [];
  const addPennant = (x, y, z, w = 0.75) => {
    const pole = add(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6), gold, x, y + 0.6, z);
    pole.userData.skip = true;
    const flag = track(new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.45, 6, 1), flagMat));
    flag.position.set(x + w / 2, y + 1.05, z);
    scene.add(flag);
    pennants.push({ mesh: flag, base: flag.position.clone(), phase: pennants.length * 0.9 });
  };

  // Round tower with a cone roof, a gold tip, a ring, windows and a pennant
  function tower({ x, z, r, h }, roofScale = 0.42) {
    add(new THREE.CylinderGeometry(r, r * 1.06, h, 24), stone, x, h / 2, z);
    const roofH = h * roofScale;
    add(new THREE.ConeGeometry(r * 1.22, roofH, 24), roof, x, h + roofH / 2, z);
    add(new THREE.SphereGeometry(0.12, 12, 10), gold, x, h + roofH + 0.04, z);
    const ring = add(new THREE.TorusGeometry(r * 1.02, 0.07, 8, 28), gold, x, h - 0.1, z);
    ring.rotation.x = Math.PI / 2;
    addWindow(0.42, 0.95, x, h * 0.55, z + r + 0.01);
    addWindow(0.42, 0.95, x, h * 0.3, z + r + 0.01);
    addPennant(x, h + roofH, z);
  }

  TOWERS.forEach((t) => tower(t));

  // Central keep with a tall spire above the door
  const keepH = KEEP.top - KEEP.base;
  add(new THREE.CylinderGeometry(KEEP.r, KEEP.r * 1.05, keepH, 24), stone, KEEP.x, KEEP.base + keepH / 2, KEEP.z);
  const keepRoofH = 6.5;
  add(new THREE.ConeGeometry(KEEP.r * 1.2, keepRoofH, 24), roofDeep, KEEP.x, KEEP.top + keepRoofH / 2, KEEP.z);
  add(new THREE.SphereGeometry(0.18, 12, 10), gold, KEEP.x, KEEP.top + keepRoofH + 0.1, KEEP.z);
  addPennant(KEEP.x, KEEP.top + keepRoofH, KEEP.z, 1.1);
  [-1.0, 0, 1.0].forEach((x) => addWindow(0.5, 1.1, x, 11.6, KEEP.z + KEEP.r + 0.02));
  [-1.0, 0, 1.0].forEach((x) => addWindow(0.5, 1.1, x, 15.6, KEEP.z + KEEP.r + 0.02));

  // Battlement along the top of the facade (gaps over the keep)
  for (let x = -9.4; x <= 9.4; x += 1.1) {
    if (Math.abs(x) < 2.6) continue;
    add(new THREE.BoxGeometry(0.55, 0.6, 0.6), stone, x, 8.3, 0.2);
  }

  // Arched windows on the front wall, either side of the door
  [-8.2, -5.6, -3.4, 3.4, 5.6, 8.2].forEach((x) => {
    addWindow(0.85, 1.6, x, 4.9, 0.335);
    add(new THREE.BoxGeometry(1.05, 0.12, 0.18), roof, x, 4.0, 0.35);
  });

  // Rose bushes at the foot of the towers and the wall
  const roseSpots = [
    [-TOWERS[0].x + 1.6, 1.8], [TOWERS[0].x - 1.6, 1.8],
    [-6.5, 1.5], [6.5, 1.5], [-2.4, 2.0], [2.4, 2.0],
  ];
  roseSpots.forEach(([x, z]) => {
    add(new THREE.SphereGeometry(0.55, 14, 10), leaf, x, 0.35, z);
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      add(new THREE.SphereGeometry(0.12, 10, 8), rose, x + Math.cos(a) * 0.38, 0.62 + (i % 2) * 0.12, z + Math.sin(a) * 0.38);
    }
  });

  // Windows light up one by one during the intro (0 dark, 1 lit)
  function setLit(amount) {
    const count = windows.length;
    windows.forEach((mat, i) => {
      const start = (i / count) * 0.7;
      const k = THREE.MathUtils.clamp((amount - start) / 0.2, 0, 1);
      mat.color.copy(dimWin).lerp(brightWin, k);
    });
  }

  // Pennants wave in the night breeze
  function update(t) {
    pennants.forEach((p) => {
      p.mesh.rotation.y = Math.sin(t * 2.2 + p.phase) * 0.35;
    });
  }

  setLit(1);
  return { setLit, update };
}

// Blocks walking through the towers (the player and the camera)
export function isCastleSolid(x, y, z, margin) {
  if (y > 20) return false;
  return TOWERS.some((t) => Math.hypot(x - t.x, z - t.z) < t.r + margin);
}

// Golden fairy-dust that drifts around the castle during the intro
export function createSparkles(scene) {
  const count = 280;
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count * 2);
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const r = 6 + Math.random() * 16;
    positions[i * 3] = Math.cos(a) * r;
    positions[i * 3 + 1] = Math.random() * 24;
    positions[i * 3 + 2] = Math.sin(a) * r * 0.6 + 2;
    seeds[i * 2] = Math.random();
    seeds[i * 2 + 1] = 0.2 + Math.random() * 0.6;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  // Soft round glow for each speck of dust
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const grd = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,240,200,0.8)');
  grd.addColorStop(1, 'rgba(255,220,160,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 64, 64);
  const glow = new THREE.CanvasTexture(canvas);
  const material = new THREE.PointsMaterial({
    map: glow,
    color: '#ffe3a6',
    size: 0.42,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);

  // opacity: 0..1 while the intro plays, then fades away at the start of the game
  function update(t, dt, opacity) {
    points.visible = opacity > 0.01;
    if (!points.visible) return;
    material.opacity = opacity * (0.7 + 0.3 * Math.sin(t * 3));
    const arr = geometry.attributes.position.array;
    for (let i = 0; i < count; i += 1) {
      arr[i * 3 + 1] += seeds[i * 2 + 1] * dt * 2;
      arr[i * 3] += Math.sin(t * 0.6 + seeds[i * 2] * 10) * dt * 0.8;
      if (arr[i * 3 + 1] > 26) arr[i * 3 + 1] = 0;
    }
    geometry.attributes.position.needsUpdate = true;
  }

  return { update, dispose: () => { geometry.dispose(); material.dispose(); glow.dispose(); } };
}
