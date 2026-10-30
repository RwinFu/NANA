import * as THREE from 'three';
import { memories as memoryList, soloMemories, soloVideo } from './memories.js';
import { buildCastle } from './castle.js';
import { createRugGlint, createStoneGlint } from './rugglint.js';

// Layout (metres). The garden sits at z > 0, the house front is at z = 0,
// and the gallery hall runs from z = 0 to z = -40 with the finale at its end.
export const LAYOUT = {
  hallHalfWidth: 3.85,
  hallHeight: 10,
  hallLength: 40,
  doorHalfWidth: 1.5,
  doorHeight: 6.4,
  gardenHalfWidth: 22,
  gardenDepth: 26,
  spawn: new THREE.Vector3(0, 0, 19),
  // The big envelope standing in front of the heart window at the end of the hall
  envelope: { x: 0, y: 0.6, z: -38.9, w: 3.4, h: 2.2 },
  // The photo room: a bigger chamber west of the gallery hall, in the middle of the hall, entered through a doorway in its west wall.
  room: {
    height: 6.4,
    ox0: -16.0, ox1: -3.85, oz0: -23.4, oz1: -16.6, // outside faces (the hall wall is its east side)
    x0: -15.6, x1: -4.15, z0: -23.0, z1: -17.0, // inside faces: 11.5 m long, 6 m wide
    door: { z0: -21.3, z1: -18.7, top: 6.0 }, // doorway in the hall's west wall, centred on the hall's middle (z0 is the far edge)
  },
};

// Chandeliers hang at this height; the hall lights sit just under them
const CHANDELIER_Y = 7.7;
const FRAME_Z_STEP = 3.6;
const FRAME_Z_START = -8.5;
const MAX_FRAME_H = 1.9;
const MAX_FRAME_W = 2.6;

// ---------- canvas helpers -------------------------------------------------

function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  draw(ctx, width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function heartPath(ctx, x, y, size) {
  ctx.beginPath();
  ctx.moveTo(x, y + size * 0.35);
  ctx.bezierCurveTo(x, y, x - size * 0.5, y - size * 0.1, x - size * 0.5, y + size * 0.2);
  ctx.bezierCurveTo(x - size * 0.5, y + size * 0.55, x, y + size * 0.7, x, y + size);
  ctx.bezierCurveTo(x, y + size * 0.7, x + size * 0.5, y + size * 0.55, x + size * 0.5, y + size * 0.2);
  ctx.bezierCurveTo(x + size * 0.5, y - size * 0.1, x, y, x, y + size * 0.35);
  ctx.closePath();
}

// Wrap Persian text on word boundaries. Returns the lines that fit.
export function wrapText(ctx, text, maxWidth, maxLines) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth || !line) {
      line = test;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1]}…`;
    return kept;
  }
  return lines;
}

const FONT = '"Vazirmatn Variable", Vazirmatn, sans-serif';

function drawPlaque(ctx, w, h, text) {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#2a1d35');
  grad.addColorStop(1, '#17111f');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#ffcf8a';
  ctx.lineWidth = 10;
  ctx.strokeRect(22, 22, w - 44, h - 44);
  ctx.fillStyle = '#ffcf8a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 96px ${FONT}`;
  ctx.fillText('خانه‌ی ما', w / 2, h * 0.3);
  ctx.fillStyle = '#fff1e1';
  ctx.font = `500 46px ${FONT}`;
  const lines = wrapText(ctx, text, w - 220, 2);
  lines.forEach((line, i) => ctx.fillText(line, w / 2, h * 0.66 + i * 62));
}

// ---------- world ----------------------------------------------------------

export function buildWorld(scene) {
  const disposables = [];
  const track = (obj) => {
    disposables.push(obj);
    return obj;
  };

  // Sky, stars, moon, fog
  scene.background = new THREE.Color('#0b0c1c');
  scene.fog = new THREE.Fog('#0b0c1c', 34, 110);

  const starGeo = new THREE.BufferGeometry();
  const starCount = 700;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i += 1) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(0.15 + Math.random() * 0.85);
    const r = 150;
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.cos(phi);
    starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const stars = track(
    new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: '#fff4e0', size: 0.9, sizeAttenuation: true, fog: false })
    )
  );
  scene.add(stars);

  const moon = track(
    new THREE.Mesh(
      new THREE.SphereGeometry(5, 32, 24),
      new THREE.MeshBasicMaterial({ color: '#f6e7c8', fog: false })
    )
  );
  moon.position.set(-40, 62, -90);
  scene.add(moon);

  // Lights
  const hemi = new THREE.HemisphereLight('#a9b8f0', '#3a2a30', 1.25);
  scene.add(hemi);
  const moonLight = new THREE.DirectionalLight('#c9d4ff', 1.1);
  moonLight.position.set(-30, 50, 20);
  scene.add(moonLight);

  const hallLights = [];
  [-8, -19, -30].forEach((z) => {
    const light = new THREE.PointLight('#ffb771', 22, 15, 1.6);
    light.position.set(0, CHANDELIER_Y - 0.5, z);
    scene.add(light);
    hallLights.push(light);
  });

  // Ground
  const grass = track(
    new THREE.Mesh(
      new THREE.PlaneGeometry(160, 120),
      new THREE.MeshStandardMaterial({ color: '#2f5244', roughness: 1 })
    )
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(0, 0, -20);
  scene.add(grass);

  // Hall floor and rug
  const floor = track(
    new THREE.Mesh(
      new THREE.PlaneGeometry(LAYOUT.hallHalfWidth * 2, LAYOUT.hallLength),
      new THREE.MeshStandardMaterial({ color: '#5b3b2b', roughness: 0.55, metalness: 0.05 })
    )
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0.01, -LAYOUT.hallLength / 2);
  scene.add(floor);

  const rug = track(
    new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 36),
      new THREE.MeshStandardMaterial({ color: '#6e1f37', roughness: 0.9 })
    )
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.02, -19);
  scene.add(rug);
  const rugGlint = createRugGlint(scene, rug, { x: 0, z: -19, halfW: 1.1, halfD: 18 });


  // Hall ceiling and walls
  const ceiling = track(
    new THREE.Mesh(
      new THREE.PlaneGeometry(LAYOUT.hallHalfWidth * 2, LAYOUT.hallLength),
      new THREE.MeshStandardMaterial({ color: '#2a1f3d', roughness: 0.9, side: THREE.DoubleSide })
    )
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, LAYOUT.hallHeight, -LAYOUT.hallLength / 2);
  scene.add(ceiling);

  const wallMat = new THREE.MeshStandardMaterial({ color: '#3a2a3f', roughness: 0.85 });
  const wallThickness = 0.3;
  // Right wall: one solid piece. Left wall: split around the doorway into the chamber.
  const sideWallGeo = track(new THREE.BoxGeometry(wallThickness, LAYOUT.hallHeight, LAYOUT.hallLength));
  const rightWall = new THREE.Mesh(sideWallGeo, wallMat);
  rightWall.position.set(LAYOUT.hallHalfWidth + wallThickness / 2, LAYOUT.hallHeight / 2, -LAYOUT.hallLength / 2);
  scene.add(rightWall);
  const DR = LAYOUT.room.door;
  const leftX = -(LAYOUT.hallHalfWidth + wallThickness / 2);
  const wallPiece = (zFront, zBack, y0, y1) => {
    const piece = new THREE.Mesh(track(new THREE.BoxGeometry(wallThickness, y1 - y0, zFront - zBack)), wallMat);
    piece.position.set(leftX, (y0 + y1) / 2, (zFront + zBack) / 2);
    scene.add(piece);
  };
  wallPiece(0.2, DR.z1, 0, LAYOUT.hallHeight); // solid, up to the doorway
  wallPiece(DR.z1, DR.z0, DR.top, LAYOUT.hallHeight); // lintel over the doorway
  wallPiece(DR.z0, -LAYOUT.hallLength, 0, LAYOUT.hallHeight); // the rest of the wall
  // Gold trim around the doorway
  const doorTrimMat = track(new THREE.MeshStandardMaterial({ color: '#d9a441', metalness: 0.8, roughness: 0.3 }));
  [DR.z1, DR.z0].forEach((z) => {
    const jamb = new THREE.Mesh(track(new THREE.BoxGeometry(0.08, DR.top, 0.14)), doorTrimMat);
    jamb.position.set(-3.89, DR.top / 2, z);
    scene.add(jamb);
  });
  const doorTop = new THREE.Mesh(track(new THREE.BoxGeometry(0.08, 0.14, DR.z1 - DR.z0 + 0.14)), doorTrimMat);
  doorTop.position.set(-3.89, DR.top + 0.07, (DR.z0 + DR.z1) / 2);
  scene.add(doorTop);

  // Royal arch over the photo-room doorway, with a crest at its top
  const doorZc = (DR.z0 + DR.z1) / 2;
  const doorArch = new THREE.Mesh(track(new THREE.TorusGeometry((DR.z1 - DR.z0) / 2, 0.07, 8, 32, Math.PI)), doorTrimMat);
  doorArch.rotation.y = Math.PI / 2;
  doorArch.position.set(-3.89, DR.top - (DR.z1 - DR.z0) / 2, doorZc);
  scene.add(doorArch);
  const doorCrest = new THREE.Mesh(track(new THREE.SphereGeometry(0.13, 12, 10)), doorTrimMat);
  doorCrest.position.set(-3.89, DR.top + 0.12, doorZc);
  scene.add(doorCrest);

  // Royal hall decoration: gold ribs under the high ceiling and a gold cornice where the walls meet it
  const hallGold = track(new THREE.MeshStandardMaterial({ color: '#d9a441', metalness: 0.8, roughness: 0.3 }));
  const ribAlong = track(new THREE.BoxGeometry(0.16, 0.22, LAYOUT.hallLength));
  [-1.9, 0, 1.9].forEach((x) => {
    const rib = new THREE.Mesh(ribAlong, hallGold);
    rib.position.set(x, LAYOUT.hallHeight - 0.11, -LAYOUT.hallLength / 2);
    scene.add(rib);
  });
  const ribAcross = track(new THREE.BoxGeometry(LAYOUT.hallHalfWidth * 2, 0.22, 0.16));
  for (let k = 0; k < 8; k += 1) {
    const rib = new THREE.Mesh(ribAcross, hallGold);
    rib.position.set(0, LAYOUT.hallHeight - 0.11, -2.5 - k * 5);
    scene.add(rib);
  }
  const cornice = track(new THREE.BoxGeometry(0.22, 0.4, LAYOUT.hallLength));
  [-1, 1].forEach((side) => {
    const piece = new THREE.Mesh(cornice, hallGold);
    piece.position.set(side * (LAYOUT.hallHalfWidth - 0.11), LAYOUT.hallHeight - 0.2, -LAYOUT.hallLength / 2);
    scene.add(piece);
  });

  // Crystal chandeliers: a gold chain, two tiers of candle bulbs and pink crystal drops
  const chandBulbMat = track(new THREE.MeshBasicMaterial({ color: '#ffe2a8', fog: false }));
  const crystalMat = track(new THREE.MeshStandardMaterial({ color: '#ffd6ea', emissive: '#c77aa6', emissiveIntensity: 0.6, roughness: 0.15, metalness: 0.1 }));
  const chainGeo = track(new THREE.CylinderGeometry(0.025, 0.025, 1, 6));
  const ringGeo = track(new THREE.TorusGeometry(1, 0.045, 8, 40));
  const bulbGeo = track(new THREE.SphereGeometry(0.075, 10, 8));
  const dropGeo = track(new THREE.ConeGeometry(0.06, 0.22, 8));
  const hubGeo = track(new THREE.SphereGeometry(0.32, 16, 12));
  const canopyGeo = track(new THREE.CylinderGeometry(0.22, 0.3, 0.22, 16));
  const addChandelier = (z) => {
    const group = new THREE.Group();
    group.position.set(0, CHANDELIER_Y, z);
    scene.add(group);
    const drop = LAYOUT.hallHeight - CHANDELIER_Y; // from the chandelier up to the ceiling
    const chain = new THREE.Mesh(chainGeo, hallGold);
    chain.scale.y = drop;
    chain.position.y = drop / 2;
    group.add(chain);
    const canopy = new THREE.Mesh(canopyGeo, hallGold);
    canopy.position.y = drop - 0.1;
    group.add(canopy);
    group.add(new THREE.Mesh(hubGeo, hallGold));
    const tiers = [
      { r: 1.15, y: -0.55, bulbs: 12 },
      { r: 0.75, y: -1.1, bulbs: 8 },
    ];
    tiers.forEach((tier) => {
      const ring = new THREE.Mesh(ringGeo, hallGold);
      ring.scale.setScalar(tier.r);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = tier.y;
      group.add(ring);
      for (let k = 0; k < tier.bulbs; k += 1) {
        const a = (k / tier.bulbs) * Math.PI * 2;
        const bulb = new THREE.Mesh(bulbGeo, chandBulbMat);
        bulb.position.set(Math.cos(a) * tier.r, tier.y + 0.08, Math.sin(a) * tier.r);
        group.add(bulb);
        if (tier.bulbs === 12) {
          const crystal = new THREE.Mesh(dropGeo, crystalMat);
          crystal.rotation.x = Math.PI;
          crystal.position.set(Math.cos(a) * tier.r, tier.y - 0.16, Math.sin(a) * tier.r);
          group.add(crystal);
        }
      }
    });
    const pear = new THREE.Mesh(dropGeo, crystalMat);
    pear.scale.setScalar(1.8);
    pear.rotation.x = Math.PI;
    pear.position.y = -1.55;
    group.add(pear);
  };
  [-8, -19, -30].forEach(addChandelier);

  // Back wall of the hall: a glowing heart window with a night sky
  const heartWindow = track(
    new THREE.Mesh(
      new THREE.PlaneGeometry(LAYOUT.hallHalfWidth * 2, LAYOUT.hallHalfWidth * 2 * 0.75),
      new THREE.MeshBasicMaterial({
        map: canvasTexture(1024, 768, (ctx, w, h) => {
          const g = ctx.createRadialGradient(w / 2, h * 0.55, 40, w / 2, h / 2, w * 0.7);
          g.addColorStop(0, '#5a2350');
          g.addColorStop(0.6, '#1d1433');
          g.addColorStop(1, '#0b0c1c');
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
          for (let i = 0; i < 160; i += 1) {
            ctx.fillStyle = `rgba(255,244,224,${0.3 + Math.random() * 0.7})`;
            ctx.beginPath();
            ctx.arc(Math.random() * w, Math.random() * h * 0.75, Math.random() * 2.2 + 0.4, 0, Math.PI * 2);
            ctx.fill();
          }
          const glow = ctx.createRadialGradient(w / 2, h * 0.42, 10, w / 2, h * 0.42, 340);
          glow.addColorStop(0, 'rgba(255,120,150,0.55)');
          glow.addColorStop(1, 'rgba(255,120,150,0)');
          ctx.fillStyle = glow;
          ctx.fillRect(0, 0, w, h);
          ctx.strokeStyle = '#ffcf8a';
          ctx.lineWidth = 8;
          heartPath(ctx, w / 2 - 230, h * 0.12, 460);
          ctx.stroke();
        }),
        fog: false,
      })
    )
  );
  heartWindow.position.set(0, 2.9, -LAYOUT.hallLength + 0.16);
  heartWindow.rotation.y = 0;
  scene.add(heartWindow);

  // House front (facade) with the door opening
  const facadeMat = new THREE.MeshStandardMaterial({ color: '#e9dccb', roughness: 0.8 });
  const facadeHeight = 8;
  const halfW = 10;
  const dw = LAYOUT.doorHalfWidth;
  const dh = LAYOUT.doorHeight;
  const facadeParts = [
    [-(halfW + dw) / 2, facadeHeight / 2, halfW - dw, facadeHeight],
    [(halfW + dw) / 2, facadeHeight / 2, halfW - dw, facadeHeight],
    [0, (dh + facadeHeight) / 2, dw * 2, facadeHeight - dh],
  ];
  facadeParts.forEach(([x, y, w, h]) => {
    const part = track(new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.6), facadeMat));
    part.position.set(x, y, 0);
    scene.add(part);
  });

  // The house front becomes a princess castle
  const castle = buildCastle(scene, track);

  // Door panels (open) and warm light spilling from the door
  const doorFrameMat = new THREE.MeshStandardMaterial({ color: '#7a4a2e', roughness: 0.6 });
  [-1, 1].forEach((side) => {
    const jamb = track(new THREE.Mesh(new THREE.BoxGeometry(0.18, dh, 0.5), doorFrameMat));
    jamb.position.set(side * dw, dh / 2, 0.02);
    scene.add(jamb);
  });
  const lintel = track(new THREE.Mesh(new THREE.BoxGeometry(dw * 2 + 0.36, 0.18, 0.5), doorFrameMat));
  lintel.position.set(0, dh + 0.09, 0.02);
  scene.add(lintel);

  const lightShaftMat = new THREE.MeshBasicMaterial({
    color: '#ffc57a',
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
  });
  const shaft = track(new THREE.Mesh(new THREE.PlaneGeometry(dw * 2, dh), lightShaftMat));
  shaft.position.set(0, dh / 2, 0.05);
  scene.add(shaft);
  const spill = track(new THREE.Mesh(new THREE.PlaneGeometry(dw * 2.6, 4.5), lightShaftMat));
  spill.rotation.x = -Math.PI / 2;
  spill.position.set(0, 0.03, 2.2);
  scene.add(spill);

  // Plaque above the door with the dedication text (redrawn when text changes)
  const plaqueCanvas = document.createElement('canvas');
  plaqueCanvas.width = 1024;
  plaqueCanvas.height = 300;
  const plaqueTex = new THREE.CanvasTexture(plaqueCanvas);
  plaqueTex.colorSpace = THREE.SRGBColorSpace;
  const plaque = track(
    new THREE.Mesh(
      new THREE.PlaneGeometry(4.2, 1.23),
      new THREE.MeshBasicMaterial({ map: plaqueTex, toneMapped: false })
    )
  );
  plaque.position.set(0, 7.25, 0.33);
  scene.add(plaque);

  function setDedication(text) {
    const ctx = plaqueCanvas.getContext('2d');
    drawPlaque(ctx, plaqueCanvas.width, plaqueCanvas.height, text);
    plaqueTex.needsUpdate = true;
  }

  // Garden: path, trees, bushes, lamps, flowers
  const stoneGeo = track(new THREE.CylinderGeometry(0.5, 0.55, 0.08, 10));
  const stoneMat = new THREE.MeshStandardMaterial({ color: '#c9bfd1', roughness: 0.9 });
  const stoneMeshes = [];
  for (let i = 0; i < 16; i += 1) {
    // each stone has its own material so it can glow on its own
    const stone = new THREE.Mesh(stoneGeo, stoneMat.clone());
    stone.position.set((Math.random() - 0.5) * 0.6, 0.04, 1.5 + i * 1.45);
    stone.scale.set(1, 1, 0.8 + Math.random() * 0.4);
    scene.add(stone);
    stoneMeshes.push(stone);
  }
  const stoneGlint = createStoneGlint(scene, stoneMeshes);

  const trunkGeo = track(new THREE.CylinderGeometry(0.18, 0.28, 2.2, 7));
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#4a3323', roughness: 1 });
  const leafGeo = track(new THREE.IcosahedronGeometry(1, 0));
  const leafGreen = new THREE.MeshStandardMaterial({ color: '#3e7a5c', roughness: 0.9, flatShading: true });
  const leafBlossom = new THREE.MeshStandardMaterial({ color: '#e7a0b8', roughness: 0.9, flatShading: true });
  const treeSpots = [
    [-11, 3], [-21, 11], [-6, 22], [-17, 18], [-12, 22],
    [11, 4], [15, 10], [9, 15], [16, 20], [12, 24],
    [-19, 2], [20, 1],
  ];
  treeSpots.forEach(([x, z], i) => {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1.1;
    tree.add(trunk);
    const mat = i % 2 === 0 ? leafBlossom : leafGreen;
    [[0, 3.1, 0, 1.5], [0.9, 2.6, 0.3, 1.0], [-0.8, 2.8, -0.2, 1.1]].forEach(([dx, dy, dz, s]) => {
      const leaf = new THREE.Mesh(leafGeo, mat);
      leaf.position.set(dx, dy, dz);
      leaf.scale.setScalar(s * 1.2);
      tree.add(leaf);
    });
    tree.position.set(x, 0, z);
    tree.rotation.y = Math.random() * Math.PI;
    scene.add(tree);
  });

  const bushGeo = track(new THREE.IcosahedronGeometry(0.9, 0));
  const bushMat = new THREE.MeshStandardMaterial({ color: '#3a6b55', roughness: 1, flatShading: true });
  for (let i = 0; i < 18; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const bush = new THREE.Mesh(bushGeo, bushMat);
    bush.position.set(side * (4.6 + Math.random() * 1.6), 0.5, 1 + Math.random() * 20);
    bush.scale.set(1.2, 0.8 + Math.random() * 0.3, 1.1);
    scene.add(bush);
  }
  // Bushes beside the facade
  [-5.6, 5.6].forEach((x) => {
    const bush = new THREE.Mesh(bushGeo, bushMat);
    bush.position.set(x, 0.7, 1.4);
    bush.scale.set(1.5, 1.1, 1.3);
    scene.add(bush);
  });

  // Garden lamps
  const poleMat = new THREE.MeshStandardMaterial({ color: '#15121c', roughness: 0.6, metalness: 0.4 });
  const poleGeo = track(new THREE.CylinderGeometry(0.05, 0.07, 3, 6));
  const lampGeo = track(new THREE.SphereGeometry(0.22, 12, 10));
  const lampMat = new THREE.MeshBasicMaterial({ color: '#ffd9a0', fog: false });
  const glowTex = canvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,220,160,1)');
    g.addColorStop(0.35, 'rgba(255,190,120,0.35)');
    g.addColorStop(1, 'rgba(255,190,120,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  glowTex.colorSpace = THREE.NoColorSpace;
  track(glowTex);
  const glowAdd = (color, opacity) =>
    new THREE.SpriteMaterial({
      map: glowTex,
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
  [[-4.4, 3], [4.4, 3], [-4.4, 14], [4.4, 14]].forEach(([x, z]) => {
    const lamp = new THREE.Group();
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.y = 1.5;
    lamp.add(pole);
    const bulb = new THREE.Mesh(lampGeo, lampMat);
    bulb.position.y = 3.1;
    lamp.add(bulb);
    const halo = new THREE.Sprite(glowAdd('#ffcf96', 0.9));
    halo.scale.setScalar(3.2);
    halo.position.y = 3.1;
    lamp.add(halo);
    lamp.position.set(x, 0, z);
    scene.add(lamp);
  });

  // Fireflies in the garden
  const fireflyCount = 46;
  const fireflyGeo = track(new THREE.SphereGeometry(0.06, 6, 5));
  const fireflyMat = new THREE.MeshBasicMaterial({ color: '#fff2a8', fog: false });
  const fireflies = new THREE.InstancedMesh(fireflyGeo, fireflyMat, fireflyCount);
  const fireflyData = [];
  const dummy = new THREE.Object3D();
  for (let i = 0; i < fireflyCount; i += 1) {
    fireflyData.push({
      base: new THREE.Vector3((Math.random() - 0.5) * 36, 0.8 + Math.random() * 3.5, 2 + Math.random() * 22),
      phase: Math.random() * Math.PI * 2,
      speed: 0.3 + Math.random() * 0.5,
    });
    dummy.position.copy(fireflyData[i].base);
    dummy.updateMatrix();
    fireflies.setMatrixAt(i, dummy.matrix);
  }
  scene.add(fireflies);

  // Hanging lanterns in the hall
  const lanternCount = 64;
  const lanternGeo = track(new THREE.SphereGeometry(0.13, 10, 8));
  const lanternMat = new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false });
  const lanterns = new THREE.InstancedMesh(lanternGeo, lanternMat, lanternCount);
  const lanternData = [];
  const palette = ['#ffb771', '#ff8fab', '#ffd98a', '#f7a4ff', '#ffc2a1'];
  const tint = new THREE.Color();
  for (let i = 0; i < lanternCount; i += 1) {
    lanternData.push({
      x: (Math.random() - 0.5) * (LAYOUT.hallHalfWidth * 1.8),
      z: -2 - Math.random() * (LAYOUT.hallLength - 4),
      y: 4.8 + Math.random() * 0.8,
      phase: Math.random() * Math.PI * 2,
    });
    lanterns.setColorAt(i, tint.set(palette[i % palette.length]));
  }
  lanterns.instanceColor.needsUpdate = true;
  scene.add(lanterns);

  // Frames: the hall's photos on its walls, and the room's photos on its walls
  const frameGeo = track(new THREE.BoxGeometry(1, 1, 0.08));
  const photoGeo = track(new THREE.PlaneGeometry(1, 1));
  function buildFrames(list, startIndex, placeAt, maxW, maxH) {
    return list.map((memory, i) => {
      const index = startIndex + i;
      const spot = placeAt(i);
      const group = new THREE.Group();
      group.position.set(spot.x, spot.y, spot.z);
      group.rotation.y = spot.rotY; // face into the hall or the room

      const frameMat = new THREE.MeshStandardMaterial({
        color: memory.frame.color,
        roughness: 0.35,
        metalness: 0.55,
      });
      const frameMesh = new THREE.Mesh(frameGeo, frameMat);
      frameMesh.position.z = -0.02;
      group.add(frameMesh);

      const placeholder = canvasTexture(256, 256, (ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, memory.frame.glow);
        g.addColorStop(1, memory.frame.color);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.font = `600 22px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText('در حال بارگذاری', w / 2, h / 2);
      });
      const photoMat = new THREE.MeshStandardMaterial({
        map: placeholder,
        roughness: 0.7,
        metalness: 0,
        emissive: new THREE.Color(memory.frame.glow),
        emissiveMap: null,
        emissiveIntensity: 0.12,
      });
      const photo = new THREE.Mesh(photoGeo, photoMat);
      photo.position.z = 0.045;
      group.add(photo);

      // Lamp above the frame, and a soft wash of light on the wall
      const lampArm = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.5, 0.05),
        new THREE.MeshStandardMaterial({ color: '#15121c', metalness: 0.6, roughness: 0.4 })
      );
      lampArm.position.set(0, 1.25, 0.25);
      group.add(lampArm);
      const lampHead = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 12, 10),
        new THREE.MeshBasicMaterial({ color: memory.frame.glow, fog: false })
      );
      lampHead.position.set(0, 1.55, 0.3);
      group.add(lampHead);
      const wash = new THREE.Sprite(glowAdd(memory.frame.glow, 0.28));
      wash.scale.set(4.6, 3.6, 1);
      wash.position.set(0, 0.2, 0.15);
      group.add(wash);

      scene.add(group);

      return {
        index,
        memory,
        group,
        photo,
        wash,
        frameMesh,
        maxW,
        maxH,
        // world-space point the player walks toward, and where the wall is
        center: group.position.clone(),
        loaded: false,
      };
    });
  }

  // West-wall photos skip the spots beside the photo room's doorway, so the doorway stays clear
  const westCount = Math.ceil(memoryList.length / 2);
  const westZ = [];
  for (let z = FRAME_Z_START + FRAME_Z_STEP; westZ.length < westCount; z -= FRAME_Z_STEP) {
    const beside = z <= DR.z1 + 1.5 && z >= DR.z0 - 1.5;
    if (!beside) westZ.push(z);
  }

  const hallFrames = buildFrames(memoryList, 0, (i) => {
    const side = i % 2 === 0 ? -1 : 1; // alternate walls
    const row = Math.floor(i / 2);
    return {
      x: side * (LAYOUT.hallHalfWidth - 0.08),
      y: 2.7,
      z: side < 0 ? westZ[row] : FRAME_Z_START - row * FRAME_Z_STEP,
      rotY: side < 0 ? Math.PI / 2 : -Math.PI / 2,
    };
  }, MAX_FRAME_W, MAX_FRAME_H);

  const R = LAYOUT.room;
  const roomFrames = buildFrames(soloMemories, memoryList.length, (i) => {
    if (i < 5) return { x: [-5.9, -7.9, -9.9, -11.9, -13.9][i], y: 2.1, z: R.z0 + 0.06, rotY: 0 }; // far wall
    return { x: [-6.6, -9.0, -11.4, -13.8][i - 5], y: 2.1, z: R.z1 - 0.06, rotY: Math.PI }; // near wall
  }, 1.6, 1.4);

  const frames = [...hallFrames, ...roomFrames];

  function applyPhoto(frame, texture) {
    const previous = frame.photo.material.map;
    const aspect = texture.image.width / texture.image.height || 1.4;
    let h = Math.min(frame.maxH, frame.maxW / aspect);
    let w = h * aspect;
    if (w > frame.maxW) {
      w = frame.maxW;
      h = w / aspect;
    }
    frame.photo.scale.set(w, h, 1);
    frame.frameMesh.scale.set(w + 0.26, h + 0.26, 1);
    frame.wash.scale.set(w + 2.2, h + 1.6, 1);
    frame.photo.material.map = texture;
    previous?.dispose();
    frame.photo.material.emissiveIntensity = 0.04;
    frame.photo.material.needsUpdate = true;
    frame.loaded = true;
  }

  function fallbackPhoto(frame) {
    frame.photo.material.map = canvasTexture(512, 384, (ctx, w, h) => {
      ctx.fillStyle = frame.memory.frame.color;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.textAlign = 'center';
      ctx.font = `700 40px ${FONT}`;
      ctx.fillText('این عکس پیدا نشد', w / 2, h / 2);
    });
    frame.photo.material.needsUpdate = true;
  }

  // Load all photos; each frame updates itself as soon as its image is ready.
  const loader = new THREE.TextureLoader();
  frames.forEach((frame) => {
    loader.load(
      frame.memory.image,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        applyPhoto(frame, tex);
      },
      undefined,
      () => fallbackPhoto(frame)
    );
  });

  // The photo room, a corridor inside the castle: plum velvet walls, gold trim, a chandelier,
  // nine photos along the walls, and the video in a gold frame at the far end.
  const roomGroup = new THREE.Group();
  scene.add(roomGroup);
  const velvet = track(new THREE.MeshStandardMaterial({ color: '#3b1c36', roughness: 0.95 }));
  const roomFloor = track(new THREE.MeshStandardMaterial({ color: '#2a1426', roughness: 0.6 }));
  const roomCeil = track(new THREE.MeshStandardMaterial({ color: '#1f0f1d', roughness: 0.9 }));
  const gold = track(new THREE.MeshStandardMaterial({ color: '#d9a441', metalness: 0.8, roughness: 0.3, emissive: '#5a3a10', emissiveIntensity: 0.2 }));
  const unitBox = track(new THREE.BoxGeometry(1, 1, 1));
  function block(x0, x1, y0, y1, z0, z1, mat) {
    const m = new THREE.Mesh(unitBox, mat);
    m.scale.set(x1 - x0, y1 - y0, z1 - z0);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    roomGroup.add(m);
    return m;
  }
  const H = R.height;
  const { x0, x1, z0, z1, ox0, ox1, oz0, oz1 } = R;
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  // Walls: west (back), far (south), near (north). The east side is the hall's west wall, which has the doorway.
  block(ox0, x0, 0, H, oz0, oz1, velvet);
  block(ox0, ox1, 0, H, oz0, z0, velvet);
  block(ox0, ox1, 0, H, z1, oz1, velvet);
  block(ox0, ox1, -0.1, 0.01, oz0, oz1, roomFloor);
  block(ox0, ox1, H, H + 0.2, oz0, oz1, roomCeil);
  // Gold trim along the top and the base of the inside walls (broken at the doorway)
  const trimTop = H - 0.25;
  block(x0, x1, trimTop, trimTop + 0.12, z0, z0 + 0.1, gold);
  block(x0, x1, trimTop, trimTop + 0.12, z1 - 0.1, z1, gold);
  block(x0, x0 + 0.1, trimTop, trimTop + 0.12, z0, z1, gold);
  block(x1 - 0.1, x1, trimTop, trimTop + 0.12, z0, R.door.z0, gold);
  block(x1 - 0.1, x1, trimTop, trimTop + 0.12, R.door.z1, z1, gold);
  block(x0, x1, 0, 0.18, z0, z0 + 0.06, gold);
  block(x0, x1, 0, 0.18, z1 - 0.06, z1, gold);
  block(x0, x0 + 0.06, 0, 0.18, z0, z1, gold);
  block(x1 - 0.06, x1, 0, 0.18, z0, R.door.z0, gold);
  block(x1 - 0.06, x1, 0, 0.18, R.door.z1, z1, gold);

  // Runner rug down the middle of the corridor
  const runnerTex = canvasTexture(1024, 256, (ctx, w, h) => {
    ctx.fillStyle = '#7a2650';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#e0b060';
    ctx.lineWidth = 12;
    ctx.strokeRect(20, 20, w - 40, h - 40);
    ctx.strokeStyle = '#f2a7c3';
    ctx.lineWidth = 4;
    ctx.strokeRect(50, 50, w - 100, h - 100);
    for (let k = 0; k < 9; k += 1) {
      ctx.fillStyle = '#e0b060';
      ctx.beginPath();
      const x = 90 + k * 100;
      ctx.moveTo(x, h / 2 - 34); ctx.lineTo(x + 26, h / 2); ctx.lineTo(x, h / 2 + 34); ctx.lineTo(x - 26, h / 2);
      ctx.closePath();
      ctx.fill();
    }
  });
  runnerTex.colorSpace = THREE.SRGBColorSpace;
  const roomRug = new THREE.Mesh(
    track(new THREE.PlaneGeometry(x1 - x0 - 0.8, z1 - z0 - 1.0)),
    new THREE.MeshStandardMaterial({ map: runnerTex, roughness: 0.9 })
  );
  roomRug.rotation.x = -Math.PI / 2;
  roomRug.position.set(cx, 0.02, cz);
  roomGroup.add(roomRug);

  // Chandelier: a gold ring hung from the ceiling, with pink lights
  const chandelier = new THREE.Group();
  chandelier.position.set(cx, H - 0.9, cz);
  roomGroup.add(chandelier);
  const ring = new THREE.Mesh(track(new THREE.TorusGeometry(0.9, 0.05, 10, 36)), gold);
  ring.rotation.x = Math.PI / 2;
  chandelier.add(ring);
  const rod = new THREE.Mesh(track(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 8)), gold);
  rod.position.y = 0.45;
  chandelier.add(rod);
  const bulbMat = track(new THREE.MeshBasicMaterial({ color: '#ffd6ea' }));
  for (let k = 0; k < 8; k += 1) {
    const a = (k / 8) * Math.PI * 2;
    const bulb = new THREE.Mesh(track(new THREE.SphereGeometry(0.07, 10, 8)), bulbMat);
    bulb.position.set(Math.cos(a) * 0.9, -0.05, Math.sin(a) * 0.9);
    chandelier.add(bulb);
  }
  const chandLight = new THREE.PointLight('#ffd0e6', 6, 14, 2);
  chandLight.position.set(cx, H - 1.4, cz);
  roomGroup.add(chandLight);
  // A second light over the far half, so the longer room is lit evenly
  const chandLight2 = new THREE.PointLight('#ffd0e6', 5, 12, 2);
  chandLight2.position.set(x0 + 3.5, H - 1.4, cz);
  roomGroup.add(chandLight2);

  // The video frame at the end of the corridor: a little bigger than the photos. It keeps the video's proportions.
  const roomVideo = document.createElement('video');
  roomVideo.src = soloVideo.src;
  roomVideo.loop = true;
  roomVideo.muted = true;
  roomVideo.playsInline = true;
  roomVideo.preload = 'auto';
  const videoTex = track(new THREE.VideoTexture(roomVideo));
  videoTex.colorSpace = THREE.SRGBColorSpace;
  // The video fits inside a box of at most 2.2 m wide and 2.4 m high, keeping its own proportions
  const fitW = 2.2;
  const fitH = 2.4;
  let screenW = fitW;
  let screenH = fitH;
  const videoY = 2.35;
  const screen = new THREE.Mesh(
    track(new THREE.PlaneGeometry(1, 1)),
    new THREE.MeshBasicMaterial({ map: videoTex, toneMapped: false })
  );
  const screenFrame = new THREE.Mesh(unitBox, gold);
  screen.position.set(x0 + 0.12, videoY, cz); // in front of its frame
  screen.rotation.y = Math.PI / 2; // face into the room
  roomGroup.add(screen, screenFrame);
  const sizeScreen = (aspect) => {
    if (aspect >= fitW / fitH) {
      screenW = fitW;
      screenH = fitW / aspect;
    } else {
      screenH = fitH;
      screenW = fitH * aspect;
    }
    screen.scale.set(screenW, screenH, 1);
    screenFrame.position.set(x0 + 0.07, videoY, cz);
    screenFrame.scale.set(0.04, screenH + 0.3, screenW + 0.3);
  };
  sizeScreen(16 / 9);
  roomVideo.addEventListener('loadedmetadata', () => {
    sizeScreen(roomVideo.videoWidth / roomVideo.videoHeight || 16 / 9);
  });
  roomVideo.play().catch(() => {});

  // Two small sconces beside the video frame
  const sconceMat = track(new THREE.MeshBasicMaterial({ color: '#ffd6ea' }));
  const sconceGeo = track(new THREE.SphereGeometry(0.1, 12, 10));
  const armGeo = track(new THREE.BoxGeometry(0.1, 0.5, 0.1));
  [-1, 1].forEach((s) => {
    const glow = new THREE.Mesh(sconceGeo, sconceMat);
    glow.position.set(x0 + 0.15, 3.55, cz + s * 1.75);
    roomGroup.add(glow);
    const arm = new THREE.Mesh(armGeo, gold);
    arm.position.set(x0 + 0.1, 3.3, cz + s * 1.75);
    roomGroup.add(arm);
  });

  // Rising hearts (pooled sprites) used when the love button is pressed
  const heartTex = canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = '#ff8fab';
    heartPath(ctx, 64, 30, 72);
    ctx.fill();
  });
  heartTex.colorSpace = THREE.NoColorSpace;
  track(heartTex);
  const hearts = [];
  for (let i = 0; i < 36; i += 1) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: heartTex, transparent: true, depthWrite: false, fog: false })
    );
    sprite.visible = false;
    scene.add(sprite);
    hearts.push({ sprite, life: 0, maxLife: 1, vx: 0, vy: 0, vz: 0 });
  }
  let heartCursor = 0;

  function burstHearts(origin, count = 8) {
    for (let i = 0; i < count; i += 1) {
      const h = hearts[heartCursor];
      heartCursor = (heartCursor + 1) % hearts.length;
      h.sprite.visible = true;
      h.sprite.position.set(
        origin.x + (Math.random() - 0.5) * 0.6,
        origin.y + Math.random() * 0.3,
        origin.z + (Math.random() - 0.5) * 0.6
      );
      h.life = 0;
      h.maxLife = 1.6 + Math.random() * 0.8;
      h.vx = (Math.random() - 0.5) * 0.4;
      h.vy = 1.2 + Math.random() * 0.8;
      h.vz = (Math.random() - 0.5) * 0.4;
      h.sprite.material.color.set(i % 2 ? '#ff8fab' : '#ffd1dc');
      h.sprite.material.opacity = 1;
    }
  }

  function updateHearts(dt) {
    hearts.forEach((h) => {
      if (!h.sprite.visible) return;
      h.life += dt;
      if (h.life >= h.maxLife) {
        h.sprite.visible = false;
        return;
      }
      const k = h.life / h.maxLife;
      h.sprite.position.x += h.vx * dt;
      h.sprite.position.y += h.vy * dt;
      h.sprite.position.z += h.vz * dt;
      h.sprite.scale.setScalar(0.35 + Math.sin(Math.min(1, k) * Math.PI) * 0.35);
      h.sprite.material.opacity = 1 - k * k;
    });
  }

  function update(t, dt, highlightIndex) {
    castle.update(t);
    // Lanterns bob gently
    for (let i = 0; i < lanternCount; i += 1) {
      const d = lanternData[i];
      dummy.position.set(d.x, d.y + Math.sin(t * 0.8 + d.phase) * 0.12, d.z);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      lanterns.setMatrixAt(i, dummy.matrix);
    }
    lanterns.instanceMatrix.needsUpdate = true;

    // Fireflies drift
    for (let i = 0; i < fireflyCount; i += 1) {
      const d = fireflyData[i];
      const s = d.speed;
      dummy.position.set(
        d.base.x + Math.sin(t * s + d.phase) * 1.2,
        d.base.y + Math.sin(t * s * 1.7 + d.phase) * 0.4,
        d.base.z + Math.cos(t * s * 0.8 + d.phase) * 1.2
      );
      const blink = 0.6 + 0.4 * Math.sin(t * 3 + d.phase * 4);
      dummy.scale.setScalar(blink);
      dummy.updateMatrix();
      fireflies.setMatrixAt(i, dummy.matrix);
    }
    fireflies.instanceMatrix.needsUpdate = true;

    // Frame wash brightens for the frame the player is close to
    frames.forEach((frame) => {
      const target = frame.index === highlightIndex ? 0.5 : 0.24;
      frame.wash.material.opacity += (target - frame.wash.material.opacity) * Math.min(1, dt * 6);
    });

    // Hall lights flicker very slightly, like candles
    hallLights.forEach((light, i) => {
      light.intensity = 22 + Math.sin(t * 2.1 + i * 1.7) * 0.9 + Math.sin(t * 5.3 + i) * 0.4;
    });

    updateHearts(dt);
  }

  function dispose() {
    disposables.forEach((obj) => {
      if (obj.dispose) obj.dispose();
    });
    frames.forEach((frame) => {
      frame.photo.material.map?.dispose();
      frame.photo.material.dispose();
    });
    plaqueTex.dispose();
    roomVideo.pause();
    roomVideo.removeAttribute('src');
    roomVideo.load();
  }

  return {
    frames,
    castle,
    setDedication,
    burstHearts,
    update,
    dispose,
    hallLights,
    heartWindow,
    rugGlint,
    stoneGlint,
  };
}
