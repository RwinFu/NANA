import * as THREE from 'three';

// The town beyond the castle: a skyline with lit windows, three landmarks
// (a clock tower, a domed church and a ferris wheel) and paper lanterns
// that drift up into the night. Everything is seeded, so it looks the same
// on every visit.

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

// A 4 x 4 grid of windows: black where the wall stays dark, warm or cool where a window is lit
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
      ctx.fillStyle = rand() < 0.12 ? '#8fb0ff' : warm[Math.floor(rand() * warm.length)];
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
  const baseWindows = windowTexture(rand);
  track(baseWindows);

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

  // ---- Buildings -------------------------------------------------------
  const PALETTE = ['#3a3366', '#463b72', '#2e3d62', '#55467a', '#3b4a6e', '#6b4f7d'];
  const LANDMARKS = [
    { x: 34, z: -26, r: 9 }, // clock tower
    { x: -22, z: -56, r: 10 }, // domed church
    { x: -34, z: -22, r: 12 }, // ferris wheel
  ];
  const clear = (x, z) => LANDMARKS.every((m) => Math.hypot(x - m.x, z - m.z) > m.r);

  const spots = [];
  // A band of towers behind the castle, out past the back of the hall
  for (let i = 0; i < 46; i += 1) {
    const x = range(-70, 70);
    const z = range(-70, -48);
    if (clear(x, z)) spots.push({ x, z });
  }
  // Clusters on both sides, beyond the garden
  for (let i = 0; i < 42; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const x = side * range(26, 62);
    const z = range(-48, -6);
    if (clear(x, z)) spots.push({ x, z });
  }

  spots.forEach(({ x, z }) => {
    const w = range(3, 6.5);
    const d = range(3, 6);
    const tall = rand() < 0.12;
    const h = tall ? range(14, 24) : range(5, 12);
    const color = PALETTE[Math.floor(rand() * PALETTE.length)];
    const tex = baseWindows.clone();
    tex.repeat.set(w / 6, h / 6);
    tex.needsUpdate = true;
    track(tex);
    const mat = track(
      new THREE.MeshStandardMaterial({
        color,
        roughness: 0.9,
        emissive: '#ffffff',
        emissiveMap: tex,
        emissiveIntensity: 1.1,
      })
    );
    const body = new THREE.Mesh(track(new THREE.BoxGeometry(w, h, d)), mat);
    body.position.set(x, h / 2, z);
    scene.add(body);

    // Some blocks have a pointed roof
    if (rand() < 0.3) {
      const roof = new THREE.Mesh(
        track(new THREE.ConeGeometry(Math.max(w, d) * 0.62, range(2, 3.5), 4)),
        track(new THREE.MeshStandardMaterial({ color: '#2a2146', roughness: 0.9 }))
      );
      roof.rotation.y = Math.PI / 4;
      roof.position.set(x, h + 1.4, z);
      scene.add(roof);
    }
  });

  // ---- Landmarks -------------------------------------------------------
  const goldMat = track(new THREE.MeshStandardMaterial({ color: '#d9a441', metalness: 0.7, roughness: 0.35 }));
  const stoneMat = track(new THREE.MeshStandardMaterial({ color: '#4a3d6e', roughness: 0.9 }));

  // Clock tower facing the garden, with a glowing clock face
  {
    const tower = { x: 34, z: -26 };
    const body = new THREE.Mesh(track(new THREE.BoxGeometry(4, 22, 4)), stoneMat);
    body.position.set(tower.x, 11, tower.z);
    scene.add(body);
    const roof = new THREE.Mesh(track(new THREE.ConeGeometry(3.2, 7, 4)), goldMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.set(tower.x, 25.5, tower.z);
    scene.add(roof);
    const faceMat = track(new THREE.MeshBasicMaterial({ color: '#ffe2a8', fog: false }));
    const face = new THREE.Mesh(track(new THREE.CircleGeometry(1.1, 24)), faceMat);
    face.position.set(tower.x, 18, tower.z + 2.02);
    scene.add(face);
    const hand = new THREE.Mesh(track(new THREE.BoxGeometry(0.1, 0.8, 0.05)), goldMat);
    hand.position.set(tower.x, 18.35, tower.z + 2.06);
    scene.add(hand);
  }

  // Domed church: a drum, a gold dome and a spire
  {
    const c = { x: -22, z: -56 };
    const drum = new THREE.Mesh(track(new THREE.CylinderGeometry(7, 7.5, 6, 24)), stoneMat);
    drum.position.set(c.x, 3, c.z);
    scene.add(drum);
    const dome = new THREE.Mesh(
      track(new THREE.SphereGeometry(7, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2)),
      goldMat
    );
    dome.position.set(c.x, 6, c.z);
    scene.add(dome);
    const spire = new THREE.Mesh(track(new THREE.ConeGeometry(0.4, 6, 8)), goldMat);
    spire.position.set(c.x, 16, c.z);
    scene.add(spire);
  }

  // Ferris wheel: a pink-lit ring on two legs, with gondolas that stay upright as it turns
  const wheel = new THREE.Group();
  const wheelPivot = { x: -34, y: 12, z: -22, r: 9 };
  wheel.position.set(wheelPivot.x, wheelPivot.y, wheelPivot.z);
  scene.add(wheel);
  const ring = new THREE.Mesh(track(new THREE.TorusGeometry(wheelPivot.r, 0.22, 6, 48)), goldMat);
  wheel.add(ring);
  const spokeGeo = track(new THREE.BoxGeometry(0.14, wheelPivot.r * 2, 0.14));
  for (let k = 0; k < 8; k += 1) {
    const spoke = new THREE.Mesh(spokeGeo, goldMat);
    spoke.rotation.z = (k * Math.PI) / 8;
    wheel.add(spoke);
  }
  const gondolaGeo = track(new THREE.BoxGeometry(0.9, 0.7, 0.7));
  const gondolaMat = track(
    new THREE.MeshStandardMaterial({ color: '#ff8fb8', emissive: '#ff6fa0', emissiveIntensity: 0.7, roughness: 0.6 })
  );
  const gondolas = [];
  for (let k = 0; k < 12; k += 1) {
    const angle = (k / 12) * Math.PI * 2;
    const g = new THREE.Mesh(gondolaGeo, gondolaMat);
    g.position.set(Math.cos(angle) * wheelPivot.r, Math.sin(angle) * wheelPivot.r, 0);
    wheel.add(g);
    gondolas.push(g);
  }
  // Two legs holding the hub
  const legGeo = track(new THREE.CylinderGeometry(0.22, 0.35, 12, 6));
  [-3.5, 3.5].forEach((dx) => {
    const leg = new THREE.Mesh(legGeo, stoneMat);
    leg.position.set(wheelPivot.x + dx, 6, wheelPivot.z);
    leg.rotation.z = dx > 0 ? 0.22 : -0.22;
    scene.add(leg);
  });

  // ---- Paper lanterns drifting up over the castle -----------------------
  const lanternBulbGeo = track(new THREE.SphereGeometry(0.16, 10, 8));
  const lanternMat = track(new THREE.MeshBasicMaterial({ color: '#ffd58a', fog: false }));
  const lanternGlow = track(
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
    const glow = new THREE.Sprite(lanternGlow.clone());
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
    wheel.rotation.z = t * 0.08;
    gondolas.forEach((g) => {
      g.rotation.z = -wheel.rotation.z;
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
