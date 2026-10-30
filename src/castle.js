import * as THREE from 'three';
import { stoneNormal } from './architecture.js';

// The front of the house is a princess castle, in the spirit of a storybook castle:
// a tall central keep with a spire and a rose window, two tall flanking towers, two low outer
// towers, battlements, corbels, arched windows with gold frames, stone pilasters, hanging banners,
// lanterns, ivy and waving pennants.
const FLANK_Z = 0.4;
export const TOWERS = [
  { x: -12.6, z: 0, r: 1.8, h: 12 }, // outer left
  { x: 12.6, z: 0, r: 1.8, h: 12 }, // outer right
  { x: -6.8, z: FLANK_Z, r: 1.5, h: 15.5 }, // flank left
  { x: 6.8, z: FLANK_Z, r: 1.5, h: 15.5 }, // flank right
];
const KEEP = { x: 0, z: -0.6, r: 2.3, base: 8, top: 19 };

// Deterministic pseudo-random numbers, so the castle looks the same on every load
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

// Cut-stone wall (ashlar): staggered rows of blocks with mortar joints, a faint edge highlight,
// and a little weathering. Drawn on a canvas, so it needs no image file.
function makeStoneTexture() {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rand = seeded(7);
  ctx.fillStyle = '#d6c4af';
  ctx.fillRect(0, 0, size, size);
  const rows = 8;
  const rowH = size / rows;
  for (let r = 0; r < rows; r += 1) {
    const y = r * rowH;
    let x = (r % 2) * -(size / 8);
    while (x < size) {
      const w = (size / 4) * (0.8 + rand() * 0.5);
      const tone = 232 + Math.floor(rand() * 16 - 8);
      ctx.fillStyle = `rgb(${tone},${tone - 12},${tone - 24})`;
      ctx.fillRect(x + 3, y + 3, w - 6, rowH - 6);
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(x + 3, y + 3, w - 6, 3);
      ctx.fillStyle = 'rgba(120,90,70,0.10)';
      ctx.fillRect(x + 3, y + rowH - 6, w - 6, 3);
      x += w;
    }
  }
  for (let i = 0; i < 1600; i += 1) {
    ctx.fillStyle = `rgba(120,90,70,${rand() * 0.08})`;
    ctx.fillRect(rand() * size, rand() * size, 2, 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 4);
  texture.anisotropy = 8;
  return texture;
}

// Stained glass for the rose window: twelve petals of rose and gold around a medallion
function makeRoseWindowTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  const c = size / 2;
  const bg = g.createRadialGradient(c, c, 10, c, c, size / 2);
  bg.addColorStop(0, '#fff3d6');
  bg.addColorStop(0.6, '#ffb3c8');
  bg.addColorStop(1, '#7b5ea7');
  g.fillStyle = bg;
  g.fillRect(0, 0, size, size);
  const petals = 12;
  for (let i = 0; i < petals; i += 1) {
    g.save();
    g.translate(c, c);
    g.rotate((i / petals) * Math.PI * 2);
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(30, -30, 60, -10, 72, 0);
    g.bezierCurveTo(60, 10, 30, 30, 0, 0);
    g.fillStyle = i % 2 ? 'rgba(255,214,140,0.92)' : 'rgba(255,120,160,0.88)';
    g.fill();
    g.strokeStyle = '#f5c96a';
    g.lineWidth = 4;
    g.stroke();
    g.restore();
  }
  g.beginPath();
  g.arc(c, c, 26, 0, Math.PI * 2);
  g.fillStyle = '#fff6e0';
  g.fill();
  g.strokeStyle = '#f5c96a';
  g.lineWidth = 6;
  g.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function buildCastle(scene, track) {
  const stone = track(new THREE.MeshStandardMaterial({
    color: '#fbf3ea', map: makeStoneTexture(), normalMap: stoneNormal(5, 4), normalScale: new THREE.Vector2(1, 1), roughness: 0.85,
  }));
  const stoneLight = track(new THREE.MeshStandardMaterial({ color: '#fff8f1', roughness: 0.7 }));
  const roof = track(new THREE.MeshStandardMaterial({ color: '#e98fb1', roughness: 0.45 }));
  const roofDeep = track(new THREE.MeshStandardMaterial({ color: '#b5557a', roughness: 0.5 }));
  const gold = track(new THREE.MeshStandardMaterial({ color: '#f5c96a', metalness: 0.7, roughness: 0.3 }));
  const flagMat = track(new THREE.MeshStandardMaterial({ color: '#ff8fab', roughness: 0.6, side: THREE.DoubleSide }));
  const bannerMat = track(new THREE.MeshStandardMaterial({ color: '#c2456f', roughness: 0.7, side: THREE.DoubleSide }));
  const rose = track(new THREE.MeshStandardMaterial({ color: '#d8577f', roughness: 0.7 }));
  const leaf = track(new THREE.MeshStandardMaterial({ color: '#2c6b52', roughness: 0.9 }));
  const ivy = track(new THREE.MeshStandardMaterial({ color: '#3f8a5e', roughness: 0.9 }));
  const lanternGlow = track(new THREE.MeshBasicMaterial({ color: '#ffcf7a', fog: false }));
  const roseGlass = track(new THREE.MeshBasicMaterial({ map: makeRoseWindowTexture(), fog: false, side: THREE.DoubleSide }));

  const windows = [];
  const dimWin = new THREE.Color('#5b4a3a');
  const brightWin = new THREE.Color('#ffd38a');
  const add = (geometry, material, x, y, z) => {
    const mesh = track(new THREE.Mesh(geometry, material));
    mesh.position.set(x, y, z);
    scene.add(mesh);
    return mesh;
  };
  // A window: a glowing pane, a gold arch above it and a stone sill below it
  const addWindow = (w, h, x, y, z) => {
    const mat = track(new THREE.MeshBasicMaterial({ color: dimWin.clone(), fog: false, side: THREE.DoubleSide }));
    const pane = track(new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat));
    pane.position.set(x, y, z);
    scene.add(pane);
    windows.push(mat);
    add(new THREE.TorusGeometry(w / 2 + 0.04, 0.035, 8, 24, Math.PI), gold, x, y + h / 2, z + 0.02);
    add(new THREE.BoxGeometry(w + 0.28, 0.08, 0.2), stoneLight, x, y - h / 2 - 0.05, z + 0.08);
    return pane;
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

  // Instanced repeats (corbels, merlons, ivy) keep the draw calls low
  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const euler = new THREE.Euler();
  const up = new THREE.Vector3(0, 1, 0);
  const instanced = (geometry, material, items) => {
    const inst = track(new THREE.InstancedMesh(geometry, material, items.length));
    items.forEach((it, i) => {
      pos.set(it.x, it.y, it.z);
      if (it.rotY !== undefined) quat.setFromAxisAngle(up, it.rotY);
      else quat.identity();
      if (it.rot) {
        euler.set(it.rot[0], it.rot[1], it.rot[2]);
        quat.setFromEuler(euler);
      }
      scl.set(it.sx ?? 1, it.sy ?? 1, it.sz ?? 1);
      matrix.compose(pos, quat, scl);
      inst.setMatrixAt(i, matrix);
    });
    inst.instanceMatrix.needsUpdate = true;
    scene.add(inst);
    return inst;
  };

  // Round tower: a cone roof with an eave, a corbel row under the eave, a belt course,
  // a plinth, two windows, a gold tip and a pennant
  function tower({ x, z, r, h }, roofScale = 0.42) {
    add(new THREE.CylinderGeometry(r, r * 1.06, h, 28), stone, x, h / 2, z);
    const beltY = h * 0.72;
    const belt = add(new THREE.TorusGeometry(r * 1.03, 0.08, 8, 40), stoneLight, x, beltY, z);
    belt.rotation.x = Math.PI / 2;
    const roofH = h * roofScale;
    add(new THREE.ConeGeometry(r * 1.22, roofH, 28), roof, x, h + roofH / 2, z);
    const eave = add(new THREE.TorusGeometry(r * 1.22, 0.07, 8, 36), roofDeep, x, h, z);
    eave.rotation.x = Math.PI / 2;
    add(new THREE.SphereGeometry(0.12, 14, 12), gold, x, h + roofH + 0.04, z);
    const ring = add(new THREE.TorusGeometry(r * 1.02, 0.07, 8, 28), gold, x, h - 0.1, z);
    ring.rotation.x = Math.PI / 2;
    const corbels = [];
    const count = Math.round((2 * Math.PI * r) / 0.34);
    for (let i = 0; i < count; i += 1) {
      const a = (i / count) * Math.PI * 2;
      corbels.push({ x: x + Math.cos(a) * r * 1.04, y: h - 0.45, z: z + Math.sin(a) * r * 1.04, rotY: -a });
    }
    instanced(new THREE.BoxGeometry(0.16, 0.3, 0.2), stoneLight, corbels);
    addWindow(0.42, 0.95, x, h * 0.55, z + r + 0.01);
    addWindow(0.42, 0.95, x, h * 0.3, z + r + 0.01);
    addPennant(x, h + roofH, z);
  }

  TOWERS.forEach((t) => tower(t));

  // Central keep: stone drum on a plinth, an eave under the spire, a rose window and a spire with a pennant
  const keepH = KEEP.top - KEEP.base;
  add(new THREE.CylinderGeometry(KEEP.r, KEEP.r * 1.05, keepH, 28), stone, KEEP.x, KEEP.base + keepH / 2, KEEP.z);
  const keepBelt = add(new THREE.TorusGeometry(KEEP.r * 1.03, 0.1, 8, 40), stoneLight, KEEP.x, KEEP.base + keepH * 0.55, KEEP.z);
  keepBelt.rotation.x = Math.PI / 2;
  const keepRoofH = 6.5;
  add(new THREE.ConeGeometry(KEEP.r * 1.2, keepRoofH, 28), roofDeep, KEEP.x, KEEP.top + keepRoofH / 2, KEEP.z);
  const keepEave = add(new THREE.TorusGeometry(KEEP.r * 1.2, 0.09, 8, 40), gold, KEEP.x, KEEP.top, KEEP.z);
  keepEave.rotation.x = Math.PI / 2;
  add(new THREE.SphereGeometry(0.18, 14, 12), gold, KEEP.x, KEEP.top + keepRoofH + 0.1, KEEP.z);
  addPennant(KEEP.x, KEEP.top + keepRoofH, KEEP.z, 1.1);
  [-1.0, 0, 1.0].forEach((x) => addWindow(0.5, 1.1, x, 11.6, KEEP.z + KEEP.r + 0.02));
  [-1.0, 0, 1.0].forEach((x) => addWindow(0.5, 1.1, x, 15.6, KEEP.z + KEEP.r + 0.02));
  // Rose window between the two rows of windows, with a gold ring
  const roseZ = KEEP.z + KEEP.r + 0.03;
  add(new THREE.CircleGeometry(0.6, 48), roseGlass, 0, 13.6, roseZ);
  const roseRing = add(new THREE.TorusGeometry(0.64, 0.05, 10, 56), gold, 0, 13.6, roseZ + 0.01);
  roseRing.rotation.y = 0;

  // Battlement along the top of the facade (gaps over the keep), with a cornice under it
  const cornice = add(new THREE.BoxGeometry(19.6, 0.22, 0.85), stoneLight, 0, 7.95, 0.2);
  cornice.userData.skip = true;
  for (let x = -9.4; x <= 9.4; x += 1.1) {
    if (Math.abs(x) < 2.6) continue;
    add(new THREE.BoxGeometry(0.55, 0.6, 0.6), stone, x, 8.3, 0.2);
  }

  // Filler stone where the facade meets the outer towers, with a cap of cornice on top
  [-10.5, 10.5].forEach((x) => {
    add(new THREE.BoxGeometry(1.6, 8, 0.85), stone, x, 4, 0.2);
    add(new THREE.BoxGeometry(1.8, 0.25, 1.0), stoneLight, x, 8.1, 0.2);
  });

  // Side wings: stone walls that run back from the outer towers, with merlons along the top
  [-1, 1].forEach((side) => {
    const wx = side * TOWERS[0].x;
    add(new THREE.BoxGeometry(2.2, 8, 6), stone, wx, 4, -3);
    add(new THREE.BoxGeometry(2.5, 0.25, 6.2), stoneLight, wx, 8.1, -3);
    for (let z = -5.5; z <= -0.5; z += 1) {
      add(new THREE.BoxGeometry(0.6, 0.6, 0.55), stone, wx, 8.4, z);
    }
  });

  // Arched windows on the front wall, either side of the door
  [-8.2, -5.6, -3.4, 3.4, 5.6, 8.2].forEach((x) => {
    addWindow(0.85, 1.6, x, 4.9, 0.335);
    add(new THREE.BoxGeometry(1.05, 0.12, 0.18), roof, x, 4.0, 0.35);
  });

  // Stone pilasters between the windows, with a lantern and a hanging banner on each
  const banners = [];
  [-4.6, 4.6].forEach((x) => {
    add(new THREE.BoxGeometry(0.42, 8.0, 0.3), stoneLight, x, 4.0, 0.25);
    add(new THREE.BoxGeometry(0.5, 0.25, 0.4), stoneLight, x, 8.0, 0.35);

    // lantern on a gold bracket: a glowing glass body under a small gold roof
    add(new THREE.BoxGeometry(0.08, 0.08, 0.4), gold, x, 2.7, 0.45);
    add(new THREE.SphereGeometry(0.13, 14, 12), lanternGlow, x, 2.55, 0.66);
    add(new THREE.ConeGeometry(0.2, 0.14, 12), gold, x, 2.84, 0.66);

    // banner: rose cloth with a gold rod at the top and a gold star in the middle
    const cloth = track(new THREE.Mesh(new THREE.PlaneGeometry(0.85, 2.6, 6, 10), bannerMat));
    cloth.position.set(x, 5.5, 0.62);
    scene.add(cloth);
    add(new THREE.CylinderGeometry(0.03, 0.03, 1.0, 8), gold, x, 6.84, 0.66).rotation.z = Math.PI / 2;
    add(new THREE.OctahedronGeometry(0.16, 0), gold, x, 5.5, 0.66);
    banners.push({ mesh: cloth, phase: x * 0.7 });
  });

  // Gold-framed arches over the wall windows are already in addWindow; a belt course along the wall
  const wallBelt = add(new THREE.BoxGeometry(19.6, 0.14, 0.5), stoneLight, 0, 6.6, 0.25);
  wallBelt.userData.skip = true;

  // Rose bushes at the foot of the towers and the wall
  const roseSpots = [
    [-TOWERS[0].x + 1.6, 1.8], [TOWERS[0].x - 1.6, 1.8],
    [-6.5, 1.5], [6.5, 1.5], [-2.4, 2.0], [2.4, 2.0],
  ];
  roseSpots.forEach(([x, z]) => {
    add(new THREE.SphereGeometry(0.55, 18, 14), leaf, x, 0.35, z);
    for (let i = 0; i < 9; i += 1) {
      const a = (i / 9) * Math.PI * 2;
      add(new THREE.SphereGeometry(0.12, 12, 10), rose, x + Math.cos(a) * 0.38, 0.62 + (i % 2) * 0.12, z + Math.sin(a) * 0.38);
    }
  });

  // Ivy climbing the base of the walls and towers (instanced leaves, placed deterministically)
  const rand = seeded(19);
  const ivyLeaves = [];
  for (let i = 0; i < 170; i += 1) {
    const onWall = rand() < 0.6;
    if (onWall) {
      const x = (rand() * 2 - 1) * 9.3;
      if (Math.abs(x) < 2.2 || Math.abs(x) > 9.4) continue;
      ivyLeaves.push({ x, y: 0.25 + rand() * 1.1, z: 0.52 + rand() * 0.04, rot: [rand() * 3, rand() * 3, rand() * 3], sx: 0.7 + rand() * 0.5, sy: 0.7 + rand() * 0.5, sz: 0.3 });
    } else {
      const t = TOWERS[Math.floor(rand() * TOWERS.length)];
      const a = rand() * Math.PI * 2;
      ivyLeaves.push({ x: t.x + Math.cos(a) * t.r * 1.02, y: 0.3 + rand() * 3.4, z: t.z + Math.sin(a) * t.r * 1.02, rot: [rand() * 3, a, rand() * 3], sx: 0.7 + rand() * 0.5, sy: 0.7 + rand() * 0.5, sz: 0.3 });
    }
  }
  instanced(new THREE.SphereGeometry(0.16, 8, 6), ivy, ivyLeaves);

  // Windows light up one by one during the intro (0 dark, 1 lit)
  function setLit(amount) {
    const count = windows.length;
    windows.forEach((mat, i) => {
      const start = (i / count) * 0.7;
      const k = THREE.MathUtils.clamp((amount - start) / 0.2, 0, 1);
      mat.color.copy(dimWin).lerp(brightWin, k);
    });
  }

  // Pennants wave in the night breeze, and the banners sway gently
  function update(t) {
    pennants.forEach((p) => {
      p.mesh.rotation.y = Math.sin(t * 2.2 + p.phase) * 0.35;
    });
    banners.forEach((b) => {
      b.mesh.rotation.y = Math.sin(t * 1.6 + b.phase) * 0.12;
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
