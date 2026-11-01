import * as THREE from 'three';
import { stoneNormal, giltNormal, leadedGlass } from './architecture.js';
import { stoneMaterial, tileMaterial, boxUV, cylinderUV, coneUV } from './castle-stone.js';
import { LAYOUT } from './world.js';

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
export const KEEP = { x: 0, z: -0.6, r: 2.3, base: 8, top: 19 };
// Where the front wall of the facade is, so bunting can be hung across it from world.js
export const FACADE_Z = 0.335;
export const FACADE_HALF_WIDTH = 9.4;

// Deterministic pseudo-random numbers, so the castle looks the same on every load
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

// A soft round sprite texture, for glow and for drifting petals
function makeGlowTexture(inner, outer) {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.45, outer);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A heart, extruded, for the finial on top of the keep and for little pink ornaments
export function heartShape(size = 1) {
  const shape = new THREE.Shape();
  const s = size;
  shape.moveTo(0, -s * 0.75);
  shape.bezierCurveTo(-s * 1.25, s * 0.05, -s * 0.6, s * 0.95, 0, s * 0.35);
  shape.bezierCurveTo(s * 0.6, s * 0.95, s * 1.25, s * 0.05, 0, -s * 0.75);
  return shape;
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
  // The stone carries its map in metres (see castle-stone.js), so a tower and a wall show the same
  // size blocks. The tiled roofs reuse the town's roof map, tinted.
  const stone = track(stoneMaterial({ color: '#f2e7db', tone: 178, seed: 71, rows: 7, normal: 0.5 }));
  const stoneLight = track(new THREE.MeshStandardMaterial({ color: '#fff8f1', roughness: 0.7, normalMap: stoneNormal(2, 1), normalScale: new THREE.Vector2(0.45, 0.45) }));
  const stoneDark = track(stoneMaterial({ color: '#c9bcb1', tone: 150, seed: 77, rows: 5, normal: 0.65 }));
  const roof = track(tileMaterial({ color: '#e98fb1', tone: 124, seed: 81, roughness: 0.5 }));
  const roofDeep = track(tileMaterial({ color: '#b5557a', tone: 108, seed: 85, roughness: 0.55 }));
  const gold = track(new THREE.MeshStandardMaterial({ color: '#f5c96a', metalness: 0.7, roughness: 0.3, normalMap: giltNormal(4, 1), normalScale: new THREE.Vector2(0.8, 0.8) }));
  const flagMat = track(new THREE.MeshStandardMaterial({ color: '#ff8fab', roughness: 0.6, side: THREE.DoubleSide }));
  // The cute layer: candy stripes, blossom, and a warmer gold for the ornaments
  const candyMat = track(new THREE.MeshStandardMaterial({ color: '#fff1f7', roughness: 0.45, emissive: '#3a2030', emissiveIntensity: 0.35 }));
  const petalMat = track(new THREE.MeshStandardMaterial({ color: '#ffb6cf', roughness: 0.6, side: THREE.DoubleSide }));
  const leafPink = track(new THREE.MeshStandardMaterial({ color: '#5fa87c', roughness: 0.85, flatShading: true }));
  const heartMat = track(new THREE.MeshStandardMaterial({ color: '#ff6fa0', emissive: '#c0335f', emissiveIntensity: 0.35, roughness: 0.35 }));
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
    // A stone box's UVs are rewritten to metres, so a merlon and a wall show the same size blocks
    const p = geometry.parameters;
    if (p && geometry.type === 'BoxGeometry' && (material === stone || material === stoneDark)) {
      boxUV(geometry, p.width, p.height, p.depth);
    }
    const mesh = track(new THREE.Mesh(geometry, material));
    mesh.position.set(x, y, z);
    scene.add(mesh);
    return mesh;
  };
  // A window: a glowing pane, a gold arch above it and a stone sill below it. The frame is built
  // around the origin and turned, so a window can also sit on the side of a round tower.
  const addWindow = (w, h, x, y, z, rotY = 0) => {
    const glass = leadedGlass(2, 3);
    const mat = track(new THREE.MeshStandardMaterial({
      color: '#120e0c', emissive: dimWin.clone(), emissiveIntensity: 1, emissiveMap: glass.emissiveMap,
      normalMap: glass.normalMap, normalScale: new THREE.Vector2(0.7, 0.7), roughness: 0.35, fog: false, side: THREE.DoubleSide,
    }));
    const group = new THREE.Group();
    group.position.set(x, y, z);
    group.rotation.y = rotY;
    scene.add(group);
    const pane = track(new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat));
    group.add(pane);
    windows.push(mat);
    const arch = new THREE.Mesh(track(new THREE.TorusGeometry(w / 2 + 0.04, 0.035, 8, 24, Math.PI)), gold);
    arch.position.set(0, h / 2, 0.02);
    group.add(arch);
    const sill = new THREE.Mesh(track(new THREE.BoxGeometry(w + 0.28, 0.08, 0.2)), stoneLight);
    sill.position.set(0, -h / 2 - 0.05, 0.08);
    group.add(sill);
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
  // Cylinder and cone UVs in metres, so the ashlar courses run round a tower at the same size as
  // the blocks in the walls, and the roof tiles keep their scale on a cone.
  const drum = (geo, r, h) => cylinderUV(geo, r, h);
  const cone = (geo, r, h) => coneUV(geo, r, h);

  function tower({ x, z, r, h }, roofScale = 0.42) {
    // the drum, with a battered plinth at the foot and a string course under the corbels
    add(drum(new THREE.CylinderGeometry(r, r * 1.06, h, 32), r, h), stone, x, h / 2, z);
    add(drum(new THREE.CylinderGeometry(r * 1.09, r * 1.15, 1.0, 32), r, 1.0), stoneDark, x, 0.5, z);
    const collar = add(new THREE.TorusGeometry(r * 1.1, 0.09, 8, 44), stoneLight, x, 1.02, z);
    collar.rotation.x = Math.PI / 2;
    const beltY = h * 0.72;
    const belt = add(new THREE.TorusGeometry(r * 1.03, 0.08, 8, 40), stoneLight, x, beltY, z);
    belt.rotation.x = Math.PI / 2;
    const roofH = h * roofScale;
    add(cone(new THREE.ConeGeometry(r * 1.22, roofH, 32), r * 1.22, roofH), roof, x, h + roofH / 2, z);
    // a spiral of candy stripe wound round the spire: what makes it read as a storybook tower
    {
      const turns = 4.5;
      const steps = 60;
      const pts = [];
      for (let i = 0; i <= steps; i += 1) {
        const t = i / steps;
        const a = t * Math.PI * 2 * turns;
        const rr = r * 1.22 * (1 - t) + 0.03;
        pts.push(new THREE.Vector3(x + Math.cos(a) * rr, h + t * roofH, z + Math.sin(a) * rr));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 90, 0.08, 6, false), candyMat);
      tube.userData.noShadow = true;
      scene.add(tube);
    }
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
    // windows round the drum, not just the one that happens to face the garden
    [0.3, 0.62, 0.95, 1.35, 2.0].forEach((frac, i) => {
      const a = frac * Math.PI * 2;
      addWindow(0.42, 0.95, x + Math.sin(a) * (r + 0.02), i % 2 ? h * 0.55 : h * 0.3, z + Math.cos(a) * (r + 0.02), a);
    });
    addPennant(x, h + roofH, z);
  }

  TOWERS.forEach((t) => tower(t));

  // Central keep: stone drum on a plinth, an eave under the spire, a rose window and a spire with a pennant
  const keepH = KEEP.top - KEEP.base;
  add(drum(new THREE.CylinderGeometry(KEEP.r, KEEP.r * 1.05, keepH, 32), KEEP.r, keepH), stone, KEEP.x, KEEP.base + keepH / 2, KEEP.z);
  add(drum(new THREE.CylinderGeometry(KEEP.r * 1.08, KEEP.r * 1.12, 0.8, 32), KEEP.r, 0.8), stoneDark, KEEP.x, KEEP.base + 0.4, KEEP.z);
  const keepBelt = add(new THREE.TorusGeometry(KEEP.r * 1.03, 0.1, 8, 40), stoneLight, KEEP.x, KEEP.base + keepH * 0.55, KEEP.z);
  keepBelt.rotation.x = Math.PI / 2;
  const keepRoofH = 6.5;
  add(cone(new THREE.ConeGeometry(KEEP.r * 1.2, keepRoofH, 28), KEEP.r * 1.2, keepRoofH), roofDeep, KEEP.x, KEEP.top + keepRoofH / 2, KEEP.z);
  {
    const steps = 80;
    const pts = [];
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const a = t * Math.PI * 2 * 5;
      const rr = KEEP.r * 1.2 * (1 - t) + 0.04;
      pts.push(new THREE.Vector3(KEEP.x + Math.cos(a) * rr, KEEP.top + t * keepRoofH, KEEP.z + Math.sin(a) * rr));
    }
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.1, 6, false), candyMat);
    tube.userData.noShadow = true;
    scene.add(tube);
  }
  const keepEave = add(new THREE.TorusGeometry(KEEP.r * 1.2, 0.09, 8, 40), gold, KEEP.x, KEEP.top, KEEP.z);
  keepEave.rotation.x = Math.PI / 2;
  add(new THREE.SphereGeometry(0.18, 14, 12), gold, KEEP.x, KEEP.top + keepRoofH + 0.1, KEEP.z);
  // a rose heart on top of the keep, glowing a little, with a gold band under it
  {
    const heartMag = 1.15;
    const geo = new THREE.ExtrudeGeometry(heartShape(heartMag), { depth: 0.3, bevelEnabled: true, bevelThickness: 0.09, bevelSize: 0.09, bevelSegments: 2 });
    geo.center();
    const finial = new THREE.Mesh(geo, heartMat);
    finial.position.set(KEEP.x, KEEP.top + keepRoofH + 1.15, KEEP.z);
    finial.rotation.y = 0.35;
    scene.add(finial);
    add(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 8), gold, KEEP.x, KEEP.top + keepRoofH + 0.42, KEEP.z);
  }
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

  // Side wings: massive stone arms that run back from the outer towers to the hall's roof. They used
  // to stop dead in mid-air and leave a grey skin behind them; now they meet the tiled barrel roof,
  // with a plinth, buttresses, and merlons stepping up along the outer edge.
  [-1, 1].forEach((side) => {
    const wx = side * TOWERS[0].x;
    const w = 2.2;
    const wingH = 8.6;
    const back = -7.0;
    const span = 6.0; // from z = -1 to z = -7
    add(boxUV(new THREE.BoxGeometry(w, wingH, span), w, wingH, span), stone, wx, wingH / 2, back / 2 - 0.5);
    add(boxUV(new THREE.BoxGeometry(w + 0.18, 1.0, span + 0.18), w, 1.0, span), stoneDark, wx, 0.5, back / 2 - 0.5);
    add(new THREE.BoxGeometry(w + 0.26, 0.12, span + 0.2), stoneLight, wx, 1.02, back / 2 - 0.5);
    // a weathered cap, and merlons stepping up to the hall roof
    add(new THREE.BoxGeometry(w + 0.34, 0.22, span + 0.3), stoneLight, wx, wingH + 0.05, back / 2 - 0.5);
    for (let z = -1.2; z > back; z -= 1.05) {
      const lift = Math.max(0, (-z) / -back) * 1.5;
      add(boxUV(new THREE.BoxGeometry(0.62, 0.66 + lift, 0.56), 0.62, 0.66 + lift, 0.56), stone, wx + side * 0.5, wingH + 0.5 + lift, z);
    }
    // a lean-to roof over the wing, tiled, running back to the hall
    const slope = add(boxUV(new THREE.BoxGeometry(w + 0.5, 0.14, span + 0.4), w + 0.5, 0.14, span + 0.4), roofDeep, wx, wingH + 0.2, back / 2 - 0.5);
    slope.rotation.x = 0.16;
    // one narrow window, so the wing is not a monolith
    addWindow(0.36, 0.9, wx + side * (w / 2 + 0.01), 5.2, -3.4, side * Math.PI / 2);
    // a buttress on the garden side, where the wing meets the front wall
    add(boxUV(new THREE.BoxGeometry(0.7, 6.2, 0.9), 0.7, 6.2, 0.9), stoneDark, wx - side * 0.2, 3.1, -0.6);
    add(new THREE.BoxGeometry(0.9, 0.24, 1.1), stoneLight, wx - side * 0.2, 6.3, -0.6);
  });

  // Arched windows on the front wall, either side of the door, each with a flower box on its sill
  // and a pair of little shutters that swing now and then
  const shutters = [];
  [-8.2, -5.6, -3.4, 3.4, 5.6, 8.2].forEach((x, i) => {
    addWindow(0.85, 1.6, x, 4.9, 0.335);
    add(new THREE.BoxGeometry(1.05, 0.12, 0.18), roof, x, 4.0, 0.35);
    // a box of pansies standing on the sill: a wooden trough and a few pink and white blooms
    const trough = add(new THREE.BoxGeometry(0.96, 0.2, 0.22), leafPink, x, 4.14, 0.44);
    trough.material = leafPink;
    add(new THREE.BoxGeometry(1.0, 0.05, 0.24), stoneLight, x, 4.03, 0.44);
    // greenery spilling over the front, then pink and white blooms on top of it
    for (let k = 0; k < 7; k += 1) {
      const bx = x - 0.42 + k * 0.14;
      add(new THREE.SphereGeometry(0.08, 7, 5), ivy, bx, 4.2 + ((k * 5) % 3) * 0.02, 0.5 + ((k * 3) % 2) * 0.03);
    }
    for (let k = 0; k < 7; k += 1) {
      const bx = x - 0.38 + k * 0.13;
      const bloom = k % 3 === 0 ? candyMat : k % 2 ? heartMat : flagMat;
      add(new THREE.SphereGeometry(0.055 + ((k * 7) % 3) * 0.012, 8, 6), bloom, bx, 4.29 + ((k * 3) % 3) * 0.03, 0.5);
    }
    // shutters, hinged at the edges of the window
    [-1, 1].forEach((side) => {
      const pivot = new THREE.Group();
      pivot.position.set(x + side * 0.52, 4.9, 0.34);
      scene.add(pivot);
      const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.36, 1.5, 0.06), candyMat);
      leaf.position.set(side * 0.18, 0, 0);
      pivot.add(leaf);
      // a pink heart on each shutter, and a little gold knob
      const heart = new THREE.Mesh(new THREE.ExtrudeGeometry(heartShape(0.09), { depth: 0.02, bevelEnabled: false }), heartMat);
      heart.position.set(side * 0.18, 0.12, 0.04);
      pivot.add(heart);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), gold);
      knob.position.set(side * 0.34, -0.55, 0.05);
      pivot.add(knob);
      shutters.push({ pivot, side, phase: i * 0.8 + (side > 0 ? 0.5 : 0) });
    });
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

  // A garland of foliage and roses round the door arch, tied at both ends with a gold ribbon bow
  {
    const archR = LAYOUT.doorHalfWidth + 0.2; // the pink arch's radius, from world.js
    const leafRand = seeded(29);
    for (let i = 0; i <= 26; i += 1) {
      const a = (i / 26) * Math.PI;
      const rr = archR + (i % 2 ? 0.14 : -0.02) + leafRand() * 0.05;
      const x = Math.cos(a) * rr;
      const y = LAYOUT.doorHeight + Math.sin(a) * rr;
      add(new THREE.SphereGeometry(0.1 + leafRand() * 0.05, 7, 5), ivy, x, y, 0.5 + leafRand() * 0.04);
      if (i % 2 === 0) {
        add(new THREE.SphereGeometry(0.075, 8, 6), i % 4 === 0 ? heartMat : flagMat, x * 1.02, y + 0.02, 0.55);
      }
    }
    // ribbon bows where the garland starts and ends
    [-1, 1].forEach((side) => {
      const bow = add(new THREE.TorusGeometry(0.11, 0.035, 6, 12), flagMat, side * archR, LAYOUT.doorHeight, 0.55);
      bow.rotation.y = side * 0.4;
      const tail = add(new THREE.BoxGeometry(0.05, 0.34, 0.02), flagMat, side * (archR + 0.03), LAYOUT.doorHeight - 0.2, 0.55);
      tail.rotation.z = side * 0.18;
    });
  }

  // Bunting: strings of little triangular flags across the garden front, hanging in a curve. They
  // are kept off the middle, so they frame the door and the plaque above it instead of crossing them.
  const BUNTING_ROWS = [
    { y: 7.35, sag: 0.45, from: -9.4, to: -2.6, z: 0.62 },
    { y: 7.35, sag: 0.45, from: 2.6, to: 9.4, z: 0.62 },
    // the lower swags sit above the window arches, so they frame the windows instead of crossing them
    { y: 6.55, sag: 0.28, from: -9.0, to: -2.4, z: 0.6 },
    { y: 6.55, sag: 0.28, from: 2.4, to: 9.0, z: 0.6 },
  ];
  const bunting = [];
  const flagGeo = new THREE.BufferGeometry();
  flagGeo.setAttribute('position', new THREE.Float32BufferAttribute([-0.2, -0.02, 0, 0.2, -0.02, 0, 0, -0.42, 0], 3));
  flagGeo.computeVertexNormals();
  const flagMats = ['#ff6fa0', '#ff8fab', '#ffe6f0'].map((color) => track(
    new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.6, emissive: color, emissiveIntensity: 0.12 })
  ));
  BUNTING_ROWS.forEach((row, rowIndex) => {
    const count = Math.max(8, Math.round(Math.abs(row.to - row.from) * 1.09));
    const flags = [];
    for (let i = 1; i < count; i += 1) {
      const t = i / count;
      const x = row.from + (row.to - row.from) * t;
      const y = row.y - Math.sin(Math.PI * t) * row.sag;
      // three shared materials and one shared triangle, so a whole row of bunting costs little
      const flag = new THREE.Mesh(flagGeo, flagMats[i % 3]);
      flag.position.set(x, y, row.z);
      scene.add(flag);
      flags.push({ mesh: flag, baseY: y, phase: rowIndex * 1.3 + i * 0.5 });
    }
    bunting.push(flags);
    // the string itself, a thin gold line along the same curve
    const pts = [];
    for (let i = 0; i <= 24; i += 1) {
      const t = i / 24;
      pts.push(new THREE.Vector3(row.from + (row.to - row.from) * t, row.y - Math.sin(Math.PI * t) * row.sag, row.z));
    }
    const string = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.012, 4, false), gold);
    scene.add(string);
  });

  // Fairy lights along the bunting: warm beads on the same curves, so the front twinkles at night
  const bulbs = [];
  {
    const bulbGeo = new THREE.SphereGeometry(0.045, 8, 6);
    const bulbMat = track(new THREE.MeshBasicMaterial({ color: '#ffdca8', toneMapped: false }));
    BUNTING_ROWS.forEach((row) => {
      const n = Math.round(Math.abs(row.to - row.from) * 2.4);
      for (let i = 1; i < n; i += 1) {
        const t = i / n;
        const bulb = new THREE.Mesh(bulbGeo, bulbMat);
        bulb.position.set(row.from + (row.to - row.from) * t, row.y - Math.sin(Math.PI * t) * row.sag - 0.07, row.z);
        scene.add(bulb);
        bulbs.push({ mesh: bulb, baseY: bulb.position.y, phase: i * 0.7 });
      }
    });
  }

  // A wreath of blossom round the foot of every tower, and two topiary hearts either side of the path
  {
    const bloomGeo = new THREE.SphereGeometry(0.11, 8, 6);
    const blooms = [];
    TOWERS.forEach((tw) => {
      const n = Math.round((2 * Math.PI * tw.r * 1.12) / 0.34);
      for (let i = 0; i < n; i += 1) {
        const a = (i / n) * Math.PI * 2;
        blooms.push({ x: tw.x + Math.cos(a) * tw.r * 1.12, y: 1.12 + (i % 3) * 0.05, z: tw.z + Math.sin(a) * tw.r * 1.12 });
      }
    });
    instanced(bloomGeo, petalMat, blooms);
    [-1, 1].forEach((side) => {
      const heart = new THREE.Mesh(
        new THREE.ExtrudeGeometry(heartShape(0.42), { depth: 0.22, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2 }),
        leaf,
      );
      heart.position.set(side * 3.3, 0.62, 3.4);
      heart.rotation.y = side * 0.25;
      scene.add(heart);
      add(new THREE.CylinderGeometry(0.5, 0.62, 0.28, 12), stoneDark, side * 3.3, 0.14, 3.4);
      // a few pink blossoms tucked into each topiary
      for (let k = 0; k < 7; k += 1) {
        const a = k * 1.7;
        add(new THREE.SphereGeometry(0.07, 8, 6), petalMat, side * 3.3 + Math.cos(a) * 0.28, 0.72 + Math.sin(a * 1.3) * 0.22, 3.28 + Math.abs(Math.sin(a)) * 0.12);
      }
    });
  }

  // Balloons tied to the front of the castle: a bunch either side of the door, bobbing
  const balloons = [];
  const balloonGeo = new THREE.SphereGeometry(0.28, 16, 14);
  [
    [-2.05, 2.0, 0.9, '#ff8fab'], [-2.25, 2.45, 0.85, '#ffd9e6'], [-1.8, 2.6, 0.95, '#c8a2ff'],
    [2.05, 2.0, 0.9, '#ffd9e6'], [2.25, 2.45, 0.85, '#ff8fab'], [1.8, 2.6, 0.95, '#9fd6ff'],
  ].forEach(([x, y, z, color], i) => {
    const mat = track(new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.05 }));
    const balloon = new THREE.Mesh(balloonGeo, mat);
    balloon.scale.set(1, 1.18, 1);
    balloon.position.set(x, y, z);
    scene.add(balloon);
    const knot = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.1, 8), mat);
    knot.position.set(x, y - 0.34, z);
    scene.add(knot);
    balloons.push({ mesh: balloon, knot, base: new THREE.Vector3(x, y, z), phase: i * 0.9 });
  });

  // Fireflies drifting round the base of the towers: warm sparks that make the place feel alive
  const glowTex = makeGlowTexture('rgba(255,244,214,1)', 'rgba(255,208,140,0.65)');
  const flyMat = track(new THREE.PointsMaterial({
    map: glowTex, color: '#ffe6b8', size: 0.26, sizeAttenuation: true, transparent: true,
    opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  }));
  const flyCount = 90;
  const flyPos = new Float32Array(flyCount * 3);
  const flySeed = [];
  const flyRand = seeded(23);
  for (let i = 0; i < flyCount; i += 1) {
    flySeed.push({ a: flyRand() * Math.PI * 2, r: 4 + flyRand() * 10, y: 0.4 + flyRand() * 4.5, sp: 0.15 + flyRand() * 0.35, ph: flyRand() * 10 });
    flyPos[i * 3] = 0; flyPos[i * 3 + 1] = 0; flyPos[i * 3 + 2] = 2.4;
  }
  const flyGeo = new THREE.BufferGeometry();
  flyGeo.setAttribute('position', new THREE.BufferAttribute(flyPos, 3));
  const flies = new THREE.Points(flyGeo, flyMat);
  flies.frustumCulled = false;
  scene.add(flies);

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
      mat.emissive.copy(dimWin).lerp(brightWin, k);
    });
  }

  // Pennants wave in the night breeze, and the banners sway gently
  function update(t, dt = 0.016) {
    pennants.forEach((p) => {
      p.mesh.rotation.y = Math.sin(t * 2.2 + p.phase) * 0.35;
    });
    banners.forEach((b) => {
      b.mesh.rotation.y = Math.sin(t * 1.6 + b.phase) * 0.12;
    });
    // bunting: each flag lifts a little, out of step with its neighbours
    bunting.forEach((row) => {
      row.forEach((f) => {
        f.mesh.rotation.x = Math.sin(t * 1.9 + f.phase) * 0.22;
        f.mesh.position.y = f.baseY + Math.sin(t * 1.9 + f.phase) * 0.02;
      });
    });
    // shutters drift open and shut, slowly, like someone upstairs is airing the rooms
    shutters.forEach((sh) => {
      const swing = (Math.sin(t * 0.6 + sh.phase) * 0.5 + 0.5) * 0.9 + 0.05;
      sh.pivot.rotation.y = sh.side * swing;
    });
    // fairy lights twinkle, slightly out of step along the string
    bulbs.forEach((b) => {
      const k = 0.65 + Math.sin(t * 2.1 + b.phase) * 0.35;
      b.mesh.scale.setScalar(0.7 + k * 0.6);
    });
    // balloons bob and lean on their knots
    balloons.forEach((b) => {
      const bob = Math.sin(t * 1.1 + b.phase) * 0.06;
      b.mesh.position.set(b.base.x + Math.sin(t * 0.7 + b.phase) * 0.05, b.base.y + bob, b.base.z);
      b.knot.position.set(b.mesh.position.x, b.mesh.position.y - 0.34, b.mesh.position.z);
    });
    // fireflies: a slow drift round the front of the castle, each on its own little orbit
    const arr = flyGeo.attributes.position.array;
    for (let i = 0; i < flyCount; i += 1) {
      const f = flySeed[i];
      const a = f.a + t * f.sp;
      arr[i * 3] = Math.cos(a) * f.r + Math.sin(t * 0.9 + f.ph) * 0.6;
      arr[i * 3 + 1] = f.y + Math.sin(t * 1.3 + f.ph) * 0.45;
      arr[i * 3 + 2] = 2.4 + Math.sin(a) * f.r * 0.35 + Math.cos(t * 0.8 + f.ph) * 0.5;
    }
    flyGeo.attributes.position.needsUpdate = true;
    flyMat.opacity = 0.55 + Math.sin(t * 1.6) * 0.25;
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
