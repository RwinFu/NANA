import * as THREE from 'three';

// The town beyond the castle: a walled old town of stone houses, round towers and a clock tower,
// with the castle's stone and rose-and-gold roofs. Warm windows glow in the night, and paper
// lanterns drift up over the castle. Everything is seeded, so it looks the same on every visit.

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A 4 x 4 grid of windows: black where the wall stays dark, warm where a window is lit
function windowTexture(rand) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 128, 128);
  const warm = ['#ffd58a', '#ffb866', '#fff0c2', '#ffc27a'];
  for (let r = 0; r < 4; r += 1) {
    for (let c = 0; c < 4; c += 1) {
      if (rand() < 0.5) continue;
      ctx.fillStyle = warm[Math.floor(rand() * warm.length)];
      ctx.fillRect(c * 32 + 9, r * 32 + 8, 14, 16);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function buildTown(scene, track) {
  const rand = mulberry32(2026);
  const range = (a, b) => a + (b - a) * rand();
  const baseWindows = track(windowTexture(rand));

  const glowTex = (() => {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,220,160,1)');
    g.addColorStop(0.35, 'rgba(255,190,120,0.35)');
    g.addColorStop(1, 'rgba(255,190,120,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.NoColorSpace;
    return track(tex);
  })();

  const add = (geometry, material, x, y, z) => {
    const mesh = new THREE.Mesh(track(geometry), material);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    return mesh;
  };

  const stoneMats = ['#7d6b78', '#8a7a86', '#6f6178', '#9a8478', '#837070'].map((c) =>
    track(new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }))
  );
  const stoneLight = track(new THREE.MeshStandardMaterial({ color: '#a89aa8', roughness: 0.85 }));
  const roofMats = ['#b5557a', '#8e4a78', '#c46a8c'].map((c) =>
    track(new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 }))
  );
  const gold = track(new THREE.MeshStandardMaterial({ color: '#d9a441', metalness: 0.7, roughness: 0.35 }));
  const flagMat = track(new THREE.MeshStandardMaterial({ color: '#ff8fab', roughness: 0.6, side: THREE.DoubleSide }));
  const faceMat = track(new THREE.MeshBasicMaterial({ color: '#ffe2a8', fog: false }));
  const pick = (list) => list[Math.floor(rand() * list.length)];

  // ---- The town wall, with merlons and round towers -----------------------
  const WALL_Z = -72;
  const WALL_LEN = 150;
  add(new THREE.BoxGeometry(WALL_LEN, 6, 1.2), stoneMats[0], 0, 3, WALL_Z);
  const merlonGeo = track(new THREE.BoxGeometry(0.6, 0.9, 1.3));
  const merlonCount = Math.floor(WALL_LEN / 1.2);
  const merlons = new THREE.InstancedMesh(merlonGeo, stoneLight, merlonCount);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < merlonCount; i += 1) {
    dummy.position.set(-WALL_LEN / 2 + 0.6 + i * 1.2, 6.45, WALL_Z);
    dummy.updateMatrix();
    merlons.setMatrixAt(i, dummy.matrix);
  }
  scene.add(merlons);
  for (let x = -70; x <= 70; x += 16) {
    add(new THREE.CylinderGeometry(2.2, 2.4, 12, 16), stoneMats[1], x, 6, WALL_Z);
    add(new THREE.ConeGeometry(2.7, 4.5, 16), roofMats[0], x, 14.25, WALL_Z);
    add(new THREE.SphereGeometry(0.16, 10, 8), gold, x, 16.6, WALL_Z);
  }

  // ---- Houses -----------------------------------------------------------
  const LANDMARKS = [
    { x: 34, z: -26, r: 9 }, // clock tower
    { x: -22, z: -56, r: 10 }, // gatehouse
    { x: -34, z: -22, r: 8 }, // watch tower
  ];
  const clear = (x, z) => LANDMARKS.every((m) => Math.hypot(x - m.x, z - m.z) > m.r);

  const spots = [];
  // Rows of houses between the castle and the town wall
  for (let i = 0; i < 52; i += 1) {
    const x = range(-68, 68);
    const z = range(-66, -50);
    if (clear(x, z)) spots.push({ x, z });
  }
  // Clusters on both sides, beyond the garden
  for (let i = 0; i < 40; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const x = side * range(26, 60);
    const z = range(-46, -6);
    if (clear(x, z)) spots.push({ x, z });
  }

  spots.forEach(({ x, z }) => {
    const w = range(3, 5.5);
    const d = range(3, 5);
    const tall = rand() < 0.15;
    const h = tall ? range(9, 13) : range(4, 8);
    const tex = baseWindows.clone();
    tex.repeat.set(w / 6, h / 6);
    tex.needsUpdate = true;
    track(tex);
    const wallMat = track(
      new THREE.MeshStandardMaterial({
        color: pick(['#7d6b78', '#8a7a86', '#6f6178', '#9a8478']),
        roughness: 0.9,
        emissive: '#ffffff',
        emissiveMap: tex,
        emissiveIntensity: 1.1,
      })
    );
    add(new THREE.BoxGeometry(w, h, d), wallMat, x, h / 2, z);

    // Steep roof: a pyramid on square houses, a cone on round turrets
    const roofH = range(2.5, 4.5);
    const round = rand() < 0.4;
    const roof = add(
      new THREE.ConeGeometry(Math.max(w, d) * 0.7, roofH, round ? 10 : 4),
      pick(roofMats),
      x,
      h + roofH / 2,
      z
    );
    roof.rotation.y = round ? 0 : Math.PI / 4;
  });

  // ---- Landmarks -------------------------------------------------------
  // Clock tower facing the garden, with a glowing clock face and a pennant
  {
    const t = { x: 34, z: -26 };
    add(new THREE.CylinderGeometry(2.6, 2.9, 22, 20), stoneMats[2], t.x, 11, t.z);
    add(new THREE.CylinderGeometry(2.8, 2.8, 0.5, 20), stoneLight, t.x, 21.5, t.z);
    add(new THREE.ConeGeometry(3.2, 7, 20), roofMats[0], t.x, 25.5, t.z);
    add(new THREE.SphereGeometry(0.2, 12, 10), gold, t.x, 29.2, t.z);
    const face = new THREE.Mesh(track(new THREE.CircleGeometry(1.0, 24)), faceMat);
    face.position.set(t.x, 17, t.z + 2.63);
    scene.add(face);
    add(new THREE.BoxGeometry(0.1, 0.8, 0.05), gold, t.x, 17.4, t.z + 2.68);
  }

  // Gatehouse: a square tower with a pointed roof and a gold finial
  {
    const c = { x: -22, z: -56 };
    add(new THREE.BoxGeometry(6, 9, 5), stoneMats[3], c.x, 4.5, c.z);
    add(new THREE.ConeGeometry(4.2, 7, 4), roofMats[1], c.x, 12.5, c.z).rotation.y = Math.PI / 4;
    add(new THREE.SphereGeometry(0.2, 12, 10), gold, c.x, 16.5, c.z);
  }

  // Watch tower: a round stone tower with a pink cone roof
  {
    const c = { x: -34, z: -22 };
    add(new THREE.CylinderGeometry(2.0, 2.2, 14, 18), stoneMats[4], c.x, 7, c.z);
    add(new THREE.ConeGeometry(2.6, 5, 18), roofMats[2], c.x, 16.5, c.z);
    add(new THREE.SphereGeometry(0.16, 10, 8), gold, c.x, 19.2, c.z);
  }

  // Pennants on the landmark roofs, waving in the breeze
  const pennants = [];
  const addPennant = (x, y, z) => {
    const flag = new THREE.Mesh(track(new THREE.PlaneGeometry(1.1, 0.5, 6, 1)), flagMat);
    flag.position.set(x + 0.55, y, z);
    scene.add(flag);
    pennants.push({ mesh: flag, phase: pennants.length * 0.9 });
  };
  addPennant(34, 29.4, -26);
  addPennant(-34, 19.4, -22);

  // ---- Paper lanterns drifting up over the castle -----------------------
  const lanternBulbGeo = track(new THREE.SphereGeometry(0.16, 10, 8));
  const lanternMat = track(new THREE.MeshBasicMaterial({ color: '#ffd58a', fog: false }));
  const lanternGlowMat = track(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: '#ffcf96',
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    })
  );
  const lanterns = [];
  for (let i = 0; i < 14; i += 1) {
    const group = new THREE.Group();
    group.add(new THREE.Mesh(lanternBulbGeo, lanternMat));
    const glow = new THREE.Sprite(lanternGlowMat.clone());
    track(glow.material);
    glow.scale.setScalar(1.3);
    group.add(glow);
    scene.add(group);
    lanterns.push({
      group,
      glow,
      baseX: range(-34, 34),
      baseZ: range(-35, -12),
      phase: rand(),
      speed: range(0.03, 0.05),
      drift: range(0.3, 0.6),
    });
  }

  function update(t) {
    pennants.forEach((p) => {
      p.mesh.rotation.y = Math.sin(t * 2.2 + p.phase) * 0.35;
    });
    lanterns.forEach((l) => {
      const k = (l.phase + t * l.speed) % 1;
      // Fade in at the bottom and out at the top, so a lantern never pops
      const env = Math.min(1, k * 6) * Math.min(1, (1 - k) * 6);
      l.group.position.set(l.baseX + Math.sin(t * l.drift + l.phase * 6) * 1.5, 4 + k * 24, l.baseZ);
      l.glow.material.opacity = 0.9 * env;
      l.group.visible = env > 0.01;
    });
  }

  return { update };
}
