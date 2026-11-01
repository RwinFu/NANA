import * as THREE from 'three';
import {
  STREET, STREET_HALF_WIDTH, TOWN_WALL_Z, TOWN_WALL_LEN, TOWN_WALL_HEIGHT, GATE_HALF_WIDTH,
  PLAZA, GATE, CLOCK_TOWER, TOWN_HOUSES,
  clockHandAngles, isWindowLit, WINDOW_UPDATE_MS, WINDOWS_PER_UPDATE,
} from './town-night.js';

// The town beyond the castle: a walled old town of stone houses, round towers and a clock tower,
// with the castle's stone and rose-and-gold roofs. Warm windows glow in the night, and paper
// lanterns drift up over the castle. Everything is seeded, so it looks the same on every visit.
//
// The town is also a place to walk to now: a paved lane leaves the west side of the garden, past
// houses, to a square in front of the closed town gate. The clock tower stands just beyond the
// wall, close enough to read, and its hands follow the visitor's own clock.

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

// A 4 x 4 grid of windows on black, on the house's own little canvas. Repainting the same canvas
// and flagging the texture is how the town's evening moves on: no new textures, no allocation in
// the game loop, and no GPU uploads while nothing changes.
function makeWindowTexture(seed) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  const house = { tex, canvas, ctx: canvas.getContext('2d'), seed };
  paintWindows(house, new Date().getHours());
  return house;
}

// Which of the sixteen windows are lit right now: an even share for the hour, chosen per window
// by its own seed so neighbours never line up.
function paintWindows(house, hour, t = 0) {
  const { ctx, seed } = house;
  const rand = mulberry32(seed);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 128, 128);
  const warm = ['#ffd58a', '#ffb866', '#fff0c2', '#ffc27a'];
  for (let i = 0; i < 16; i += 1) {
    const windowSeed = mulberry32(seed + i * 37)();
    if (!isWindowLit(windowSeed, t, hour)) continue;
    const r = Math.floor(i / 4);
    const c = i % 4;
    ctx.fillStyle = warm[Math.floor(rand() * warm.length)];
    ctx.fillRect(c * 32 + 9, r * 32 + 8, 14, 16);
  }
  house.tex.needsUpdate = true;
}

export function buildTown(scene, track) {
  const rand = mulberry32(2026);
  const range = (a, b) => a + (b - a) * rand();

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
  // It stands behind the castle, with the gatehouse set into it where the lane ends.
  add(new THREE.BoxGeometry(TOWN_WALL_LEN, TOWN_WALL_HEIGHT, 1.2), stoneMats[0], 0, TOWN_WALL_HEIGHT / 2, TOWN_WALL_Z);
  const merlonGeo = track(new THREE.BoxGeometry(0.6, 0.9, 1.3));
  const merlonCount = Math.floor(TOWN_WALL_LEN / 1.2);
  const merlons = new THREE.InstancedMesh(merlonGeo, stoneLight, merlonCount);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < merlonCount; i += 1) {
    dummy.position.set(-TOWN_WALL_LEN / 2 + 0.6 + i * 1.2, TOWN_WALL_HEIGHT + 0.45, TOWN_WALL_Z);
    dummy.updateMatrix();
    merlons.setMatrixAt(i, dummy.matrix);
  }
  scene.add(merlons);
  for (let x = -70; x <= 70; x += 16) {
    if (Math.abs(x - GATE.x) < GATE_HALF_WIDTH + 4) continue; // leave the gateway free
    add(new THREE.CylinderGeometry(2.2, 2.4, 12, 16), stoneMats[1], x, 6, TOWN_WALL_Z);
    add(new THREE.ConeGeometry(2.7, 4.5, 16), roofMats[0], x, 14.25, TOWN_WALL_Z);
    add(new THREE.SphereGeometry(0.16, 10, 8), gold, x, 16.6, TOWN_WALL_Z);
  }

  // ---- Houses ------------------------------------------------------------
  // Each house's window grid is one of a few shared textures. Every few seconds a couple of houses
  // are redrawn, so the town lights up and settles down while the couple wanders through it.
  const houses = [];

  const addHouse = (spot, far = false) => {
    const { x, z, w, d, h } = spot;
    const house = makeWindowTexture(Math.floor(rand() * 1e6));
    house.tex.repeat.set(Math.max(1, w / 6), Math.max(1, h / 6));
    track(house.tex);
    const wallMat = track(
      new THREE.MeshStandardMaterial({
        color: pick(['#7d6b78', '#8a7a86', '#6f6178', '#9a8478']),
        roughness: 0.9,
        emissive: '#ffffff',
        emissiveMap: house.tex,
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
    if (!far && rand() < 0.45 && Math.abs(x - STREET.x) > 4) {
      add(new THREE.CylinderGeometry(0.22, 0.28, 1.2, 8), stoneMats[4], x + w * 0.28, h + 1.4, z + d * 0.2);
    }
    houses.push({ ...house, mat: wallMat, horizon: h });
  };

  TOWN_HOUSES.forEach(addHouse);

  // The rest of the town, further out: only ever seen from a distance, so it stays cheap
  for (let i = 0; i < 36; i += 1) {
    const x = range(-64, 64);
    const z = range(-92, TOWN_WALL_Z - 6);
    if (Math.abs(x - GATE.x) < 8 && z > -64) continue; // keep the gate's own row clear
    addHouse({
      x, z,
      w: range(3.5, 5.5),
      d: range(3.5, 5),
      h: rand() < 0.15 ? range(9, 13) : range(4.5, 8),
    }, true);
  }

  // ---- The clock tower ---------------------------------------------------
  // Behind the wall, just past the gate, and close enough to the square that the hands can be read.
  const hands = [];
  {
    const t = CLOCK_TOWER;
    add(new THREE.CylinderGeometry(2.4, 2.7, CLOCK_TOWER.dialY + 4, 20), stoneMats[2], t.x, (CLOCK_TOWER.dialY + 4) / 2, t.z);
    add(new THREE.CylinderGeometry(2.6, 2.6, 0.5, 20), stoneLight, t.x, CLOCK_TOWER.dialY + 4.3, t.z);
    add(new THREE.ConeGeometry(3.0, 7, 20), roofMats[0], t.x, CLOCK_TOWER.dialY + 8.2, t.z);
    add(new THREE.SphereGeometry(0.2, 12, 10), gold, t.x, CLOCK_TOWER.dialY + 11.9, t.z);

    // The face looks down the lane, toward the castle, so the hands are read from the square
    const faceZ = t.z + 2.44;
    const face = new THREE.Mesh(track(new THREE.CircleGeometry(CLOCK_TOWER.dialR, 32)), faceMat);
    face.position.set(t.x, CLOCK_TOWER.dialY, faceZ);
    scene.add(face);
    const rim = new THREE.Mesh(track(new THREE.TorusGeometry(CLOCK_TOWER.dialR + 0.12, 0.09, 8, 28)), gold);
    rim.position.set(t.x, CLOCK_TOWER.dialY, faceZ + 0.02);
    scene.add(rim);
    // Twelve gold marks, so the hands mean something
    for (let k = 0; k < 12; k += 1) {
      const a = (k / 12) * Math.PI * 2;
      const mark = new THREE.Mesh(track(new THREE.BoxGeometry(0.05, k % 3 === 0 ? 0.26 : 0.15, 0.04)), gold);
      const r = CLOCK_TOWER.dialR - 0.2;
      mark.position.set(t.x + Math.sin(a) * r, CLOCK_TOWER.dialY + Math.cos(a) * r, faceZ + 0.04);
      mark.rotation.z = -a;
      scene.add(mark);
    }
    // Hands: each geometry hangs down from its pivot, so rotation is measured from 12 o'clock
    const makeHand = (length, width, z) => {
      const geo = new THREE.BoxGeometry(width, length, 0.05);
      geo.translate(0, -length / 2 + 0.08, 0);
      const hand = new THREE.Mesh(track(geo), gold);
      hand.position.set(t.x, CLOCK_TOWER.dialY, faceZ + z);
      scene.add(hand);
      return hand;
    };
    hands.push(
      { mesh: makeHand(CLOCK_TOWER.dialR * 0.6, 0.12, 0.06), key: 'hourAngle' },
      { mesh: makeHand(CLOCK_TOWER.dialR * 0.92, 0.08, 0.08), key: 'minuteAngle' }
    );
    const cap = new THREE.Mesh(track(new THREE.SphereGeometry(0.11, 10, 8)), gold);
    cap.position.set(t.x, CLOCK_TOWER.dialY, faceZ + 0.12);
    scene.add(cap);
  }

  // ---- The gatehouse -----------------------------------------------------
  // Set into the wall where the lane ends: closed, with a dark arch and gold jambs, so the walk has
  // an ending and a reason to turn back.
  {
    const c = GATE;
    add(new THREE.BoxGeometry(10, 13, 8), stoneMats[3], c.x, 6.5, c.z - 1);
    add(new THREE.ConeGeometry(7, 8, 4), roofMats[1], c.x, 17, c.z - 1).rotation.y = Math.PI / 4;
    add(new THREE.SphereGeometry(0.22, 12, 10), gold, c.x, 21.4, c.z - 1);
    // the gate itself: a tall dark arch, gold jambs, a gold lintel band
    const arch = new THREE.Mesh(
      track(new THREE.PlaneGeometry(3.6, 5.4)),
      track(new THREE.MeshBasicMaterial({ color: '#140d1a', fog: false }))
    );
    arch.position.set(c.x, 2.7, c.z + 2.72);
    scene.add(arch);
    [-1, 1].forEach((s) => {
      const jamb = new THREE.Mesh(track(new THREE.BoxGeometry(0.26, 5.4, 0.26)), gold);
      jamb.position.set(c.x + s * 1.93, 2.7, c.z + 2.74);
      scene.add(jamb);
    });
    const lintel = new THREE.Mesh(track(new THREE.BoxGeometry(4.4, 0.28, 0.28)), gold);
    lintel.position.set(c.x, 5.55, c.z + 2.74);
    scene.add(lintel);
    // two lanterns on the gate, so it is visible from the lane
    [-1, 1].forEach((s) => {
      const glow = new THREE.Sprite(
        track(new THREE.SpriteMaterial({
          map: glowTex, color: '#ffcf96', transparent: true, opacity: 0.9,
          depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
        }))
      );
      glow.position.set(c.x + s * 2.6, 4.4, c.z + 2.8);
      glow.scale.setScalar(2);
      scene.add(glow);
      const bulb = new THREE.Mesh(track(new THREE.SphereGeometry(0.1, 8, 6)), faceMat);
      bulb.position.set(c.x + s * 2.6, 4.4, c.z + 2.8);
      scene.add(bulb);
    });
  }

  // A watch tower off the lane, for the skyline
  {
    const c = { x: -38, z: -50 };
    add(new THREE.CylinderGeometry(2.0, 2.2, 14, 18), stoneMats[4], c.x, 7, c.z);
    add(new THREE.ConeGeometry(2.6, 5, 18), roofMats[2], c.x, 16.5, c.z);
    add(new THREE.SphereGeometry(0.16, 10, 8), gold, c.x, 19.2, c.z);
  }

  // Pennants on the roofs, waving in the breeze
  const pennants = [];
  const addPennant = (x, y, z) => {
    const flag = new THREE.Mesh(track(new THREE.PlaneGeometry(1.1, 0.5, 6, 1)), flagMat);
    flag.position.set(x + 0.55, y, z);
    scene.add(flag);
    pennants.push({ mesh: flag, phase: pennants.length * 0.9 });
  };
  addPennant(CLOCK_TOWER.x, CLOCK_TOWER.dialY + 12.2, CLOCK_TOWER.z);
  addPennant(-38, 19.4, -50);
  addPennant(GATE.x, 21.6, GATE.z - 1);

  // ---- The lane and the square -------------------------------------------
  {
    const laneTex = (() => {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 512;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#463b49';
      ctx.fillRect(0, 0, 256, 512);
      const r = mulberry32(77);
      const rowH = 42;
      for (let row = 0; row * rowH < 512; row += 1) {
        const offset = row % 2 ? 42 : 0;
        for (let x = -84; x < 256; x += 84) {
          const shade = 66 + Math.floor(r() * 26);
          ctx.fillStyle = `rgb(${shade + 8}, ${shade}, ${shade + 16})`;
          ctx.fillRect(x + offset + 2, row * rowH + 2, 80, rowH - 4);
          if (r() < 0.16) {
            ctx.strokeStyle = 'rgba(20,12,20,0.45)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(x + offset + 12, row * rowH + 8);
            ctx.lineTo(x + offset + 30, row * rowH + rowH - 8);
            ctx.stroke();
          }
        }
      }
      // warm inlaid lines down both edges
      ctx.fillStyle = 'rgba(217,164,65,0.5)';
      ctx.fillRect(8, 0, 5, 512);
      ctx.fillRect(243, 0, 5, 512);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(1, (STREET.z0 - STREET.z1) / 9);
      return track(tex);
    })();
    const length = STREET.z0 - STREET.z1;
    const lane = new THREE.Mesh(
      track(new THREE.PlaneGeometry(STREET_HALF_WIDTH * 2, length)),
      track(new THREE.MeshStandardMaterial({ map: laneTex, roughness: 0.86 }))
    );
    lane.rotation.x = -Math.PI / 2;
    lane.position.set(STREET.x, 0.06, (STREET.z0 + STREET.z1) / 2);
    scene.add(lane);
    // kerb stones give the lane an edge instead of a painted stripe
    const kerbMat = track(new THREE.MeshStandardMaterial({ color: '#8a8090', roughness: 0.9 }));
    [-1, 1].forEach((side) => {
      const kerb = new THREE.Mesh(track(new THREE.BoxGeometry(0.3, 0.22, length)), kerbMat);
      kerb.position.set(STREET.x + side * (STREET_HALF_WIDTH + 0.15), 0.11, (STREET.z0 + STREET.z1) / 2);
      scene.add(kerb);
    });
    // the square in front of the gate
    const plaza = new THREE.Mesh(
      track(new THREE.CircleGeometry(PLAZA.r, 40)),
      track(new THREE.MeshStandardMaterial({ color: '#4c4054', roughness: 0.88 }))
    );
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.set(PLAZA.x, 0.055, PLAZA.z);
    scene.add(plaza);
    // a low rim of stones around the square
    const rimGeo = track(new THREE.BoxGeometry(0.5, 0.24, 0.5));
    for (let k = 0; k < 26; k += 1) {
      const a = (k / 26) * Math.PI * 2;
      const x = PLAZA.x + Math.cos(a) * (PLAZA.r + 0.2);
      const z = PLAZA.z + Math.sin(a) * (PLAZA.r + 0.2);
      const stone = new THREE.Mesh(rimGeo, stoneMats[1]);
      stone.position.set(x, 0.12, z);
      stone.rotation.y = -a;
      scene.add(stone);
    }
  }

  // ---- Lamps down the lane -----------------------------------------------
  // Three real lights only, so the lane glows without costing a light per lamp.
  const lampParts = [];
  const lampGlowMat = track(
    new THREE.SpriteMaterial({
      map: glowTex, color: '#ffcf96', transparent: true, opacity: 0.85,
      depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    })
  );
  [-6, -20, -34].forEach((z, i) => {
    [-1, 1].forEach((side) => {
      const x = STREET.x + side * (STREET_HALF_WIDTH + 1.15);
      const post = new THREE.Mesh(track(new THREE.CylinderGeometry(0.07, 0.1, 3.1, 8)), stoneMats[2]);
      post.position.set(x, 1.55, z);
      scene.add(post);
      const head = new THREE.Mesh(track(new THREE.SphereGeometry(0.16, 10, 8)), faceMat);
      head.position.set(x, 3.25, z);
      scene.add(head);
      const glow = new THREE.Sprite(lampGlowMat.clone());
      track(glow.material);
      glow.position.set(x, 3.25, z);
      glow.scale.setScalar(1.7);
      scene.add(glow);
      lampParts.push({ glow, phase: i * 0.7 + (side > 0 ? 0.35 : 0) });
    });
  });
  [-12, -28, -40].forEach((z) => {
    const light = new THREE.PointLight('#ffb771', 8, 13, 1.8);
    light.position.set(STREET.x, 3.4, z);
    scene.add(light);
  });
  const plazaLight = new THREE.PointLight('#ffd0a0', 10, 16, 1.8);
  plazaLight.position.set(PLAZA.x, 4.2, PLAZA.z);
  scene.add(plazaLight);

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
  for (let i = 0; i < 16; i += 1) {
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
      baseX: range(-40, 20),
      baseZ: range(-50, -8),
      phase: rand(),
      speed: range(0.03, 0.05),
      drift: range(0.3, 0.6),
    });
  }

  // ---- Windows and the clock --------------------------------------------
  let lastClockMinute = -1;
  let windowClock = WINDOW_UPDATE_MS / 1000;
  let nextHouse = 0;

  function refreshClock(now) {
    const minute = now.getMinutes();
    if (minute === lastClockMinute) return;
    lastClockMinute = minute;
    const angles = clockHandAngles(now);
    hands.forEach(({ mesh, key }) => {
      mesh.rotation.z = -angles[key]; // clockwise from 12, seen from the square
    });
  }

  refreshClock(new Date());

  function update(t, dt) {
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
    // street lamps breathe very slightly, like candles
    lampParts.forEach(({ glow, phase }) => {
      glow.material.opacity = 0.72 + 0.13 * Math.sin(t * 1.7 + phase);
    });
    if (dt <= 0) return;
    // the clock keeps real time
    refreshClock(new Date());
    // and the town's windows move on, a few houses at a time. Only the houses whose share of lit
    // windows would really change are repainted, so most updates touch nothing.
    windowClock -= dt;
    if (windowClock <= 0) {
      windowClock = WINDOW_UPDATE_MS / 1000;
      const now = new Date();
      const hour = now.getHours() + now.getMinutes() / 60;
      let painted = 0;
      for (let n = 0; n < houses.length && painted < WINDOWS_PER_UPDATE; n += 1) {
        const house = houses[nextHouse % houses.length];
        nextHouse += 1;
        if (house.hour !== undefined && Math.abs(house.hour - hour) < 3) continue; // already matches
        house.hour = hour;
        paintWindows(house, hour, t);
        painted += 1;
      }
    }
  }

  return { update };
}
