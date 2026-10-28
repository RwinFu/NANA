import * as THREE from 'three';
import { memories as memoryList } from './memories.js';

// Layout (metres). The garden sits at z > 0, the house front is at z = 0,
// and the gallery hall runs from z = 0 to z = -40 with the finale at its end.
export const LAYOUT = {
  hallHalfWidth: 3.85,
  hallLength: 40,
  doorHalfWidth: 1.5,
  doorHeight: 4.4,
  gardenHalfWidth: 22,
  gardenDepth: 26,
  spawn: new THREE.Vector3(0, 0, 19),
  // The big envelope standing in front of the heart window at the end of the hall
  envelope: { x: 0, y: 0.6, z: -38.9, w: 3.4, h: 2.2 },
};

const FRAME_Z_STEP = 4.6;
const FRAME_Z_START = -5;
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
    light.position.set(0, 4.6, z);
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


  // Hall ceiling and walls
  const ceiling = track(
    new THREE.Mesh(
      new THREE.PlaneGeometry(LAYOUT.hallHalfWidth * 2, LAYOUT.hallLength),
      new THREE.MeshStandardMaterial({ color: '#211a2e', roughness: 0.9, side: THREE.DoubleSide })
    )
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, 6, -LAYOUT.hallLength / 2);
  scene.add(ceiling);

  const wallMat = new THREE.MeshStandardMaterial({ color: '#3a2a3f', roughness: 0.85 });
  const wallThickness = 0.3;
  const sideWallGeo = track(new THREE.BoxGeometry(wallThickness, 6, LAYOUT.hallLength));
  [-1, 1].forEach((side) => {
    const wall = new THREE.Mesh(sideWallGeo, wallMat);
    wall.position.set(side * (LAYOUT.hallHalfWidth + wallThickness / 2), 3, -LAYOUT.hallLength / 2);
    scene.add(wall);
  });

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
  plaque.position.set(0, 6.6, 0.33);
  scene.add(plaque);

  function setDedication(text) {
    const ctx = plaqueCanvas.getContext('2d');
    drawPlaque(ctx, plaqueCanvas.width, plaqueCanvas.height, text);
    plaqueTex.needsUpdate = true;
  }

  // Garden: path, trees, bushes, lamps, flowers
  const stoneGeo = track(new THREE.CylinderGeometry(0.5, 0.55, 0.08, 10));
  const stoneMat = new THREE.MeshStandardMaterial({ color: '#c9bfd1', roughness: 0.9 });
  for (let i = 0; i < 16; i += 1) {
    const stone = new THREE.Mesh(stoneGeo, stoneMat);
    stone.position.set((Math.random() - 0.5) * 0.6, 0.04, 1.5 + i * 1.45);
    stone.scale.set(1, 1, 0.8 + Math.random() * 0.4);
    scene.add(stone);
  }

  const trunkGeo = track(new THREE.CylinderGeometry(0.18, 0.28, 2.2, 7));
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#4a3323', roughness: 1 });
  const leafGeo = track(new THREE.IcosahedronGeometry(1, 0));
  const leafGreen = new THREE.MeshStandardMaterial({ color: '#3e7a5c', roughness: 0.9, flatShading: true });
  const leafBlossom = new THREE.MeshStandardMaterial({ color: '#e7a0b8', roughness: 0.9, flatShading: true });
  const treeSpots = [
    [-11, 3], [-14, 9], [-9, 14], [-17, 18], [-12, 22],
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

  // Frames
  const frameGeo = track(new THREE.BoxGeometry(1, 1, 0.08));
  const photoGeo = track(new THREE.PlaneGeometry(1, 1));
  const frames = memoryList.map((memory, index) => {
    const side = index % 2 === 0 ? -1 : 1; // alternate walls
    const row = Math.floor(index / 2);
    const z = FRAME_Z_START - row * FRAME_Z_STEP;
    const group = new THREE.Group();
    group.position.set(side * (LAYOUT.hallHalfWidth - 0.08), 2.7, z);
    group.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2; // face into the hall

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

    const frame = {
      index,
      memory,
      group,
      photo,
      wash,
      frameMesh,
      // world-space point the player walks toward, and where the wall is
      center: group.position.clone(),
      loaded: false,
    };
    return frame;
  });

  function applyPhoto(frame, texture) {
    const previous = frame.photo.material.map;
    const aspect = texture.image.width / texture.image.height || 1.4;
    let h = Math.min(MAX_FRAME_H, MAX_FRAME_W / aspect);
    let w = h * aspect;
    if (w > MAX_FRAME_W) {
      w = MAX_FRAME_W;
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
  }

  return {
    frames,
    setDedication,
    burstHearts,
    update,
    dispose,
    hallLights,
    heartWindow,
  };
}
