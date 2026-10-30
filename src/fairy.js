import * as THREE from 'three';

// A small fairy who flies through the castle intro, carrying a letter for her princess.
// She has a shaped bodice and layered tulle skirt, a face, a golden braid, a jewelled tiara,
// four iridescent wings, a star wand and a ribbon of light behind her.
// The letter is a lace-edged card with a bow and a wax seal. It always turns to face the camera.
// She loops in from high above the castle, settles in front of the camera at the end of the
// flight, and hovers there until the game starts. Then she zooms up and away.

const TRAIL_SAMPLES = 34;
const TRAIL_SPACING = 0.1;
const SPARKLE_COUNT = 120;
const LETTER_FONT = '"Vazirmatn Variable", Vazirmatn, sans-serif';
const LETTER_LINES = ['سالگردمون مبارک', 'خوشگلترین پرنسس دنیا'];
const LETTER_LOCAL = new THREE.Vector3(0.56, -0.06, 0.05); // where the card floats, relative to her
const LETTER_W = 1.05;
const LETTER_H = 0.71;

const FROM = new THREE.Vector3(-22, 30, 46);
const HOLD = new THREE.Vector3(0, 4.1, 4.2);

function easeInOutCubic(p) {
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}

function smoothstep(x) {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
}

// ---------- textures ----------

function radialTexture(stops, size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const h = size / 2;
  const grad = g.createRadialGradient(h, h, 0, h, h, h);
  stops.forEach(([o, col]) => grad.addColorStop(o, col));
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function glowTexture(inner, outer) {
  return radialTexture([[0, inner], [0.35, outer], [1, 'rgba(0,0,0,0)']]);
}

function ribbonTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 4;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 256, 0);
  grad.addColorStop(0, 'rgba(255,240,196,1)');
  grad.addColorStop(0.5, 'rgba(255,156,196,0.7)');
  grad.addColorStop(1, 'rgba(199,146,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 4);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Wings: a soft iridescent gradient with light veins radiating from the base
function wingTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(60, 128, 6, 128, 128, 170);
  grad.addColorStop(0, 'rgba(255,250,255,0.95)');
  grad.addColorStop(0.45, 'rgba(245,190,235,0.75)');
  grad.addColorStop(0.8, 'rgba(190,160,255,0.45)');
  grad.addColorStop(1, 'rgba(255,200,150,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = 'rgba(255,255,255,0.5)';
  g.lineWidth = 2;
  [-0.5, -0.25, 0, 0.25, 0.5].forEach((k) => {
    g.beginPath();
    g.moveTo(40, 128);
    g.lineTo(250, 128 + k * 200);
    g.stroke();
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------- geometry helpers ----------

// A wing: a petal shape along +x from the hinge, mirrored for the other side
function wingGeometry(len, width, side) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(len * 0.25, width * 1.05, len * 0.8, width * 1.1, len, width * 0.2);
  s.bezierCurveTo(len * 0.9, -width * 0.5, len * 0.4, -width * 0.4, 0, 0);
  const geo = new THREE.ShapeGeometry(s, 20);
  geo.scale(side, 1, 1);
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) - bb.min.x) / (bb.max.x - bb.min.x);
    uv[i * 2 + 1] = (pos.getY(i) - bb.min.y) / (bb.max.y - bb.min.y);
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

function starShape(outer, inner, points = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = Math.PI / 2 + (i * Math.PI) / points;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

// A straight limb from point a to point b
function limb(a, b, r, mat) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r, len, 10), mat);
  m.position.copy(a).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return m;
}

function place(mesh, x, y, z) {
  mesh.position.set(x, y, z);
  return mesh;
}

function drawHeart(g, x, y, s) {
  g.beginPath();
  g.moveTo(x, y + s * 0.3);
  g.bezierCurveTo(x - s, y - s * 0.5, x - s * 0.5, y - s * 1.1, x, y - s * 0.4);
  g.bezierCurveTo(x + s * 0.5, y - s * 1.1, x + s, y - s * 0.5, x, y + s * 0.3);
  g.fill();
}

function drawFlower(g, x, y, r, petal, center) {
  g.fillStyle = petal;
  for (let k = 0; k < 5; k++) {
    const a = (k * 2 * Math.PI) / 5;
    g.beginPath();
    g.ellipse(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, r * 0.55, r * 0.4, a, 0, 2 * Math.PI);
    g.fill();
  }
  g.fillStyle = center;
  g.beginPath();
  g.arc(x, y, r * 0.32, 0, 2 * Math.PI);
  g.fill();
}

function roundRectPath(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// The letter: pastel paper, lace edge, a pink bow, flowers, a gold frame and a wax seal
function letterCanvas() {
  const W = 1024;
  const H = 692;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');

  const paper = g.createLinearGradient(0, 0, W, H);
  paper.addColorStop(0, '#fff9fc');
  paper.addColorStop(0.55, '#ffeaf4');
  paper.addColorStop(1, '#f3e4ff');
  roundRectPath(g, 0, 0, W, H, 48);
  g.fillStyle = paper;
  g.fill();

  // Scattered hearts for a soft pattern
  g.fillStyle = '#ff9cc0';
  g.globalAlpha = 0.16;
  for (let i = 0; i < 40; i++) {
    drawHeart(g, (i * 197) % W, (i * 331) % H, 8 + (i % 3) * 4);
  }
  g.globalAlpha = 1;

  // Lace edge: overlapping white scallops around all four sides
  const lace = (x, y) => {
    g.beginPath();
    g.arc(x, y, 24, 0, 2 * Math.PI);
    g.fillStyle = '#ffffff';
    g.fill();
    g.strokeStyle = '#ffb3cc';
    g.lineWidth = 3;
    g.stroke();
  };
  for (let x = 24; x <= W - 24; x += 46) {
    lace(x, 24);
    lace(x, H - 24);
  }
  for (let y = 70; y <= H - 70; y += 46) {
    lace(24, y);
    lace(W - 24, y);
  }

  // Gold dashed frame
  roundRectPath(g, 66, 66, W - 132, H - 132, 34);
  g.strokeStyle = '#e8b86a';
  g.lineWidth = 4;
  g.setLineDash([14, 10]);
  g.stroke();
  g.setLineDash([]);

  // A pink bow at the top
  const bow = (dir) => {
    g.beginPath();
    g.moveTo(W / 2, 66);
    g.bezierCurveTo(W / 2 + dir * 40, 10, W / 2 + dir * 170, 0, W / 2 + dir * 150, 96);
    g.bezierCurveTo(W / 2 + dir * 120, 156, W / 2 + dir * 60, 116, W / 2, 66);
    g.closePath();
    g.fillStyle = '#ff8fb1';
    g.fill();
    g.strokeStyle = '#e0557f';
    g.lineWidth = 3;
    g.stroke();
  };
  bow(-1);
  bow(1);
  g.beginPath();
  g.arc(W / 2, 66, 22, 0, 2 * Math.PI);
  g.fillStyle = '#ff5f8f';
  g.fill();

  // Text
  g.direction = 'rtl';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#d63a72';
  g.font = `800 100px ${LETTER_FONT}`;
  g.fillText(LETTER_LINES[0], W / 2, H * 0.45);
  g.fillStyle = '#9b2a5e';
  g.font = `800 78px ${LETTER_FONT}`;
  g.fillText(LETTER_LINES[1], W / 2, H * 0.63);

  // A gold divider with a small heart
  g.strokeStyle = '#e8b86a';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(W / 2 - 180, H * 0.76);
  g.lineTo(W / 2 - 50, H * 0.76);
  g.moveTo(W / 2 + 50, H * 0.76);
  g.lineTo(W / 2 + 180, H * 0.76);
  g.stroke();
  g.fillStyle = '#ff7aa8';
  drawHeart(g, W / 2, H * 0.76 + 4, 16);

  // Flowers in the corners
  drawFlower(g, 150, 150, 46, '#ffb3cf', '#ffd27a');
  drawFlower(g, W - 150, 150, 40, '#c9b6ff', '#ffe27a');
  drawFlower(g, 150, H - 150, 40, '#ffb3cf', '#ffd27a');

  // Wax seal in the bottom right
  g.beginPath();
  g.arc(W - 170, H - 150, 54, 0, 2 * Math.PI);
  g.fillStyle = '#c8325c';
  g.fill();
  g.strokeStyle = '#ffd27a';
  g.lineWidth = 5;
  g.stroke();
  g.fillStyle = '#ffd27a';
  drawHeart(g, W - 170, H - 150 + 4, 22);

  return c;
}

// ---------- the fairy ----------

export function createFairy(scene) {
  // group: her place in the world, her heading and her visibility
  // figure: her body, scaled and bobbed inside the group
  const group = new THREE.Group();
  const figure = new THREE.Group();
  group.add(figure);

  const satin = new THREE.MeshPhysicalMaterial({
    color: '#ff8fb1', roughness: 0.32, emissive: '#ff4f86', emissiveIntensity: 0.12,
    sheen: 1, sheenRoughness: 0.35, sheenColor: new THREE.Color('#ffd0e6'),
    clearcoat: 0.4, clearcoatRoughness: 0.2, side: THREE.DoubleSide,
  });
  const tulle = new THREE.MeshPhysicalMaterial({
    color: '#ffd6ea', transparent: true, opacity: 0.5, roughness: 0.85,
    sheen: 1, sheenRoughness: 0.6, sheenColor: new THREE.Color('#ffffff'),
    side: THREE.DoubleSide, depthWrite: false,
  });
  const gold = new THREE.MeshStandardMaterial({ color: '#ffd27a', metalness: 0.8, roughness: 0.25, emissive: '#ffb347', emissiveIntensity: 0.35 });
  const gem = new THREE.MeshPhysicalMaterial({ color: '#ff7aa8', roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05, emissive: '#ff3d7f', emissiveIntensity: 0.55 });
  const skin = new THREE.MeshStandardMaterial({ color: '#ffe0cc', roughness: 0.55 });
  const hairMat = new THREE.MeshStandardMaterial({ color: '#ffcf6b', roughness: 0.35, metalness: 0.25 });
  const ink = new THREE.MeshStandardMaterial({ color: '#2b1b3a', roughness: 0.2 });
  const shine = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const blush = new THREE.MeshBasicMaterial({ color: '#ff7fa6', transparent: true, opacity: 0.5, depthWrite: false });
  const smileMat = new THREE.MeshBasicMaterial({ color: '#c8325c' });

  // Bodice: a lathe, so the waist and shoulders are smooth
  const bodice = new THREE.Mesh(
    new THREE.LatheGeometry([
      new THREE.Vector2(0.03, 0.25),
      new THREE.Vector2(0.08, 0.23),
      new THREE.Vector2(0.092, 0.19),
      new THREE.Vector2(0.078, 0.12),
      new THREE.Vector2(0.082, 0.07),
      new THREE.Vector2(0.1, 0.04),
    ], 48),
    satin,
  );
  figure.add(bodice);

  // Skirt: a satin underskirt and a wider tulle layer that flares to the hem
  const skirtPoints = [[0.27, -0.2], [0.22, -0.12], [0.16, -0.04], [0.1, 0.04]];
  figure.add(new THREE.Mesh(new THREE.LatheGeometry(skirtPoints.map(([r, y]) => new THREE.Vector2(r, y)), 48), satin));
  const tulleLayer = new THREE.Mesh(
    new THREE.LatheGeometry([[0.3, -0.22], [0.25, -0.13], [0.185, -0.05], [0.12, 0.04]].map(([r, y]) => new THREE.Vector2(r, y)), 56),
    tulle,
  );
  figure.add(tulleLayer);

  // Sparkling gems down the bodice
  [[0, 0.14, 0.094], [-0.035, 0.18, 0.09], [0.035, 0.18, 0.09]].forEach(([x, y, z]) => {
    figure.add(place(new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), gem), x, y, z));
  });

  // Neck and head
  figure.add(place(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.05, 12), skin), 0, 0.27, 0));
  const head = new THREE.Group();
  head.position.set(0, 0.36, 0);
  figure.add(head);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.1, 40, 30), skin);
  face.scale.set(1, 1.06, 1);
  head.add(face);

  // Pointed fairy ears
  [-1, 1].forEach((side) => {
    const ear = place(new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.06, 10), skin), side * 0.1, -0.005, -0.01);
    ear.rotation.z = -side * (Math.PI / 2 - 0.35);
    head.add(ear);
  });

  // Big shiny eyes with highlights, blush and a smile
  [-1, 1].forEach((side) => {
    const eye = place(new THREE.Mesh(new THREE.SphereGeometry(0.019, 20, 14), ink), side * 0.036, -0.01, 0.088);
    eye.scale.set(0.85, 1.25, 0.5);
    const glint = place(new THREE.Mesh(new THREE.SphereGeometry(0.0055, 8, 6), shine), 0.006, 0.007, 0.008);
    eye.add(glint);
    head.add(eye);
    head.add(place(new THREE.Mesh(new THREE.CircleGeometry(0.018, 14), blush), side * 0.062, -0.035, 0.091));
  });
  const smile = place(new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.0032, 6, 14, Math.PI), smileMat), 0, -0.042, 0.094);
  smile.rotation.z = Math.PI;
  head.add(smile);

  // Golden hair: a cap, a fringe of bangs, a braid that sways, and a satin bow
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.108, 36, 24, 0, Math.PI * 2, 0, Math.PI * 0.6), hairMat);
  cap.position.set(0, 0.01, -0.012);
  head.add(cap);
  [[-0.045, 0.07, 0.085], [0, 0.08, 0.095], [0.045, 0.07, 0.085]].forEach(([x, y, z]) => {
    const bang = place(new THREE.Mesh(new THREE.SphereGeometry(0.04, 14, 10), hairMat), x, y, z);
    bang.scale.set(1.2, 0.55, 0.6);
    head.add(bang);
  });
  const braid = [];
  for (let i = 0; i < 6; i++) {
    const r = 0.034 - i * 0.0028;
    const seg = place(new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), hairMat), 0, 0.03 - i * 0.05, -0.09 - i * 0.012);
    head.add(seg);
    braid.push(seg);
  }
  const bowMat = satin;
  [-1, 1].forEach((side) => {
    const loop = place(new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8), bowMat), side * 0.072, 0.1, -0.03);
    loop.scale.set(1.4, 1, 0.6);
    loop.rotation.z = side * 0.5;
    head.add(loop);
  });
  head.add(place(new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), gem), 0.075, 0.095, -0.02));

  // Tiara: a gold band, five spikes with gems, and a big gem at the front
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.008, 8, 36), gold);
  band.rotation.x = Math.PI / 2;
  band.position.set(0, 0.078, 0);
  head.add(band);
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * 0.07;
    const z = Math.sin(a) * 0.07;
    head.add(place(new THREE.Mesh(new THREE.ConeGeometry(0.01, 0.035, 6), gold), x, 0.1, z));
    head.add(place(new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), gem), x, 0.122, z));
  }
  head.add(place(new THREE.Mesh(new THREE.SphereGeometry(0.016, 14, 10), gem), 0, 0.085, 0.072));

  // Arms: one extended to the wand, one reaching to hold the letter
  const leftShoulder = new THREE.Vector3(-0.085, 0.215, 0);
  const leftElbow = new THREE.Vector3(-0.18, 0.16, 0.05);
  const leftHand = new THREE.Vector3(-0.13, 0.2, 0.16);
  const rightShoulder = new THREE.Vector3(0.085, 0.215, 0);
  const rightElbow = new THREE.Vector3(0.2, 0.14, 0.06);
  const rightHand = new THREE.Vector3(0.14, 0.02, 0.08);
  figure.add(limb(leftShoulder, leftElbow, 0.024, satin), limb(leftElbow, leftHand, 0.02, skin));
  figure.add(limb(rightShoulder, rightElbow, 0.024, satin), limb(rightElbow, rightHand, 0.02, skin));
  figure.add(place(new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), satin), -0.085, 0.215, 0));
  figure.add(place(new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), satin), 0.085, 0.215, 0));
  figure.add(place(new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), skin), leftHand.x, leftHand.y, leftHand.z));
  figure.add(place(new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), skin), rightHand.x, rightHand.y, rightHand.z));

  // Star wand
  const wandTip = new THREE.Vector3(-0.2, 0.44, 0.22);
  figure.add(limb(leftHand, wandTip, 0.007, gold));
  const star = new THREE.Mesh(
    new THREE.ExtrudeGeometry(starShape(0.05, 0.022), { depth: 0.006, bevelEnabled: false }),
    gold,
  );
  star.position.copy(wandTip);
  figure.add(star);

  // Wings: four petals, two pairs, flapping on hinges at her back
  const wingTex = wingTexture();
  const wingMat = new THREE.MeshBasicMaterial({
    map: wingTex,
    color: '#ffffff',
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const wingRoot = new THREE.Group();
  wingRoot.position.set(0, 0.2, -0.06);
  figure.add(wingRoot);
  const wings = [];
  [-1, 1].forEach((side) => {
    const upper = new THREE.Group();
    upper.position.set(0, 0.02, 0);
    upper.add(new THREE.Mesh(wingGeometry(0.5, 0.32, side), wingMat));
    wingRoot.add(upper);
    const lower = new THREE.Group();
    lower.position.set(0, -0.06, -0.02);
    lower.add(new THREE.Mesh(wingGeometry(0.32, 0.22, side), wingMat));
    wingRoot.add(lower);
    wings.push({ upper, lower, side });
  });

  // Sparkles that orbit her
  const sparklePos = new Float32Array(SPARKLE_COUNT * 3);
  const sparkleGeo = new THREE.BufferGeometry();
  sparkleGeo.setAttribute('position', new THREE.BufferAttribute(sparklePos, 3).setUsage(THREE.DynamicDrawUsage));
  const sparkleTex = glowTexture('rgba(255,255,255,1)', 'rgba(255,200,230,0.6)');
  const sparkles = new THREE.Points(
    sparkleGeo,
    new THREE.PointsMaterial({
      map: sparkleTex,
      color: '#fff0c8',
      size: 0.075,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  sparkles.frustumCulled = false;
  group.add(sparkles);

  // Soft aura around her
  const aura = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('rgba(255,200,230,0.9)', 'rgba(255,140,190,0.35)'),
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.8,
  }));
  aura.scale.setScalar(1.1);
  aura.position.set(0, 0.2, 0);
  group.add(aura);

  // Ribbon of light that streams behind her, in world space
  const ribbonVerts = (TRAIL_SAMPLES + 1) * 2;
  const ribbonPos = new Float32Array(ribbonVerts * 3);
  const ribbonUv = new Float32Array(ribbonVerts * 2);
  const ribbonIdx = [];
  for (let i = 0; i < TRAIL_SAMPLES; i++) {
    const a = i * 2;
    ribbonIdx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  for (let i = 0; i <= TRAIL_SAMPLES; i++) {
    ribbonUv[i * 4] = i / TRAIL_SAMPLES;
    ribbonUv[i * 4 + 1] = 0;
    ribbonUv[i * 4 + 2] = i / TRAIL_SAMPLES;
    ribbonUv[i * 4 + 3] = 1;
  }
  const ribbonGeo = new THREE.BufferGeometry();
  ribbonGeo.setAttribute('position', new THREE.BufferAttribute(ribbonPos, 3).setUsage(THREE.DynamicDrawUsage));
  ribbonGeo.setAttribute('uv', new THREE.BufferAttribute(ribbonUv, 2));
  ribbonGeo.setIndex(ribbonIdx);
  const ribbonMat = new THREE.MeshBasicMaterial({
    map: ribbonTexture(),
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
  ribbon.frustumCulled = false;
  scene.add(ribbon);

  // The letter: a canvas texture on a card that always faces the camera, with a soft glow behind it
  const letterTex = new THREE.CanvasTexture(letterCanvas());
  letterTex.colorSpace = THREE.SRGBColorSpace;
  letterTex.anisotropy = 4;
  const letter = new THREE.Mesh(
    new THREE.PlaneGeometry(LETTER_W, LETTER_H),
    new THREE.MeshBasicMaterial({ map: letterTex, transparent: true, side: THREE.DoubleSide, toneMapped: false }),
  );
  scene.add(letter);
  const letterGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('rgba(255,225,240,0.9)', 'rgba(255,150,200,0.3)'),
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.8,
  }));
  scene.add(letterGlow);

  // Redraw once the Persian font is loaded, so the text is not drawn with a fallback
  if (document.fonts?.load) {
    document.fonts.load(`800 100px ${LETTER_FONT}`).then(() => {
      letterTex.image = letterCanvas();
      letterTex.needsUpdate = true;
    }, () => {});
  }

  scene.add(group);
  // a soft pink light she casts on the room around her, so she lights the castle as she flies
  const glow = new THREE.PointLight('#ffc6e4', 0, 4, 1.6);
  scene.add(glow);
  group.visible = false;
  letter.visible = false;
  letterGlow.visible = false;
  ribbon.visible = false;

  let vis = 0;
  let leave = 0;
  const pos = FROM.clone();
  const next = new THREE.Vector3();
  const samples = [];
  const tmpCam = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const side = new THREE.Vector3();
  const chain = Array.from({ length: TRAIL_SAMPLES + 1 }, () => new THREE.Vector3());
  const aimM = new THREE.Matrix4();
  const aimQ = new THREE.Quaternion();
  const UP = new THREE.Vector3(0, 1, 0);
  const velocity = new THREE.Vector3();
  const lastPos = FROM.clone();
  const tmpRight = new THREE.Vector3();
  const letterPos = new THREE.Vector3();
  let bank = 0;

  // Where the fairy is on her path at intro time t; p = flight progress 0..1
  function pathAt(t, p, out) {
    const e = easeInOutCubic(Math.min(1, Math.max(0, p)));
    const a = t * 0.9;
    // a curvier path: the orbit swells and tightens, and the flight weaves side to side
    const r = THREE.MathUtils.lerp(7, 1.1, e) * (1 + 0.22 * Math.sin(a * 1.5));
    out.set(
      THREE.MathUtils.lerp(FROM.x, HOLD.x, e) + Math.cos(a) * r,
      THREE.MathUtils.lerp(FROM.y, HOLD.y, e) + Math.sin(a * 2) * 0.55 * (1 - e * 0.6),
      THREE.MathUtils.lerp(FROM.z, HOLD.z, e) + Math.sin(a) * r * 0.5 + Math.sin(a * 2 + 0.8) * 0.6 * (1 - e * 0.5),
    );
    // organic wander on top of the orbit: strongest on the way in, calmer at the hold
    const wander = 1 - e * 0.6;
    out.x += (Math.sin(t * 0.73) * 0.55 + Math.sin(t * 1.31 + 1.7) * 0.3) * wander;
    out.y += (Math.sin(t * 0.97 + 0.4) * 0.25 + Math.sin(t * 2.3) * 0.08) * wander;
    out.z += Math.sin(t * 0.58 + 2.1) * 0.35 * wander;
    return out;
  }

  // Stardust: glints she leaves behind on her path, fading out after a moment
  const TRAIL_COUNT = 70;
  const trailPos = new Float32Array(TRAIL_COUNT * 3);
  const trailLife = new Float32Array(TRAIL_COUNT);
  for (let i = 0; i < TRAIL_COUNT; i += 1) trailPos[i * 3 + 1] = -100;
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3).setUsage(THREE.DynamicDrawUsage));
  const trailPts = new THREE.Points(
    trailGeo,
    new THREE.PointsMaterial({
      size: 0.09,
      map: glowTexture('rgba(255,255,255,1)', 'rgba(255,200,230,0)'),
      color: '#ffe6f4',
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    })
  );
  trailPts.frustumCulled = false;
  scene.add(trailPts);
  let trailNext = 0;
  let trailAcc = 0;

  function updateTrail(dt, show) {
    if (show) {
      trailAcc += dt * 30;
      while (trailAcc >= 1) {
        trailAcc -= 1;
        const i = trailNext;
        trailNext = (trailNext + 1) % TRAIL_COUNT;
        trailPos[i * 3] = pos.x + (Math.random() - 0.5) * 0.3;
        trailPos[i * 3 + 1] = pos.y + (Math.random() - 0.5) * 0.3;
        trailPos[i * 3 + 2] = pos.z + (Math.random() - 0.5) * 0.3;
        trailLife[i] = 1.2;
      }
    }
    for (let i = 0; i < TRAIL_COUNT; i += 1) {
      if (trailLife[i] <= 0) continue;
      trailLife[i] -= dt;
      if (trailLife[i] <= 0) trailPos[i * 3 + 1] = -100;
    }
    trailGeo.attributes.position.needsUpdate = true;
  }

  function updateSparkles(t) {
    for (let i = 0; i < SPARKLE_COUNT; i++) {
      const a = t * (0.5 + (i % 4) * 0.15) + i * 2.39996;
      const r = 0.2 + (i % 5) * 0.025;
      sparklePos[i * 3] = Math.cos(a) * r * 1.1;
      sparklePos[i * 3 + 1] = 0.25 + Math.sin(a * 1.3 + i) * 0.18;
      sparklePos[i * 3 + 2] = Math.sin(a) * r * 0.6;
    }
    sparkleGeo.attributes.position.needsUpdate = true;
  }

  function updateRibbon(camera, s) {
    // Samples of where she has been, newest first, spaced out along the path
    if (samples.length === 0 || pos.distanceTo(samples[0]) > TRAIL_SPACING) {
      samples.unshift(pos.clone());
      if (samples.length > TRAIL_SAMPLES) samples.length = TRAIL_SAMPLES;
    }
    for (let i = 0; i <= TRAIL_SAMPLES; i++) {
      const src = i === 0 ? pos : samples[i - 1] || samples[samples.length - 1] || pos;
      chain[i].copy(src);
    }
    for (let i = 0; i <= TRAIL_SAMPLES; i++) {
      const prev = chain[Math.max(0, i - 1)];
      const nxt = chain[Math.min(TRAIL_SAMPLES, i + 1)];
      tangent.subVectors(prev, nxt);
      tmpCam.subVectors(camera.position, chain[i]);
      side.crossVectors(tangent, tmpCam);
      if (side.lengthSq() < 1e-8) side.set(1, 0, 0);
      side.normalize();
      const w = 0.06 * Math.pow(1 - i / TRAIL_SAMPLES, 0.7) * s + 0.003 * s;
      const c = chain[i];
      ribbonPos[i * 6] = c.x - side.x * w;
      ribbonPos[i * 6 + 1] = c.y - side.y * w;
      ribbonPos[i * 6 + 2] = c.z - side.z * w;
      ribbonPos[i * 6 + 3] = c.x + side.x * w;
      ribbonPos[i * 6 + 4] = c.y + side.y * w;
      ribbonPos[i * 6 + 5] = c.z + side.z * w;
    }
    ribbonGeo.attributes.position.needsUpdate = true;
    ribbonMat.opacity = 0.7 * s;
  }

  // Called every frame. p is the castle flight progress; started means the game has begun.
  function update(t, dt, p, started, camera) {
    const target = started ? 0 : smoothstep(p * 2.2);
    vis += (target - vis) * Math.min(1, dt * 2.5);
    if (started) leave += dt;
    const rise = leave * leave * 6; // zoom up and away after the game starts

    pathAt(t, p, pos);
    pos.y += rise;
    pathAt(t + 0.05, p, next);
    next.y += rise;

    const show = vis > 0.01;
    glow.intensity = show ? 1.1 * Math.max(0.001, vis) * (0.9 + 0.1 * Math.sin(t * 3)) : 0;
    glow.position.copy(pos).add(new THREE.Vector3(0, 0.15, 0));
    group.visible = show;
    letter.visible = show;
    letterGlow.visible = show;
    ribbon.visible = show;
    updateTrail(dt, show);
    if (!show) return;

    const s = Math.max(0.001, vis);
    group.position.copy(pos);
    group.scale.setScalar(s);
    // turn smoothly toward where she is going, instead of snapping
    aimM.lookAt(next, pos, UP);
    aimQ.setFromRotationMatrix(aimM);
    group.quaternion.slerp(aimQ, Math.min(1, dt * 5));
    // bank into the turn: sideways speed tilts her body
    velocity.subVectors(pos, lastPos).divideScalar(Math.max(dt, 1e-4));
    lastPos.copy(pos);
    const rightAxis = tmpRight.set(1, 0, 0).applyQuaternion(group.quaternion);
    const wantBank = THREE.MathUtils.clamp(rightAxis.dot(velocity) * 0.08, -0.35, 0.35);
    bank += (wantBank - bank) * Math.min(1, dt * 4);

    // Body motion: a gentle bob and a little bank
    figure.position.y = Math.sin(t * 2.2) * 0.015;
    figure.rotation.z = Math.sin(t * 1.1) * 0.05 - bank;

    // Wings flap, the lower pair a beat behind the upper pair
    const flap = 0.5 + 0.5 * Math.sin(t * 13);
    const flapLow = 0.5 + 0.5 * Math.sin(t * 13 - 0.8);
    wings.forEach(({ upper, lower, side: sd }) => {
      upper.rotation.z = sd * (0.2 + 0.45 * flap);
      lower.rotation.z = sd * (0.12 + 0.3 * flapLow);
      upper.rotation.y = sd * 0.12 * flap; // the tips sweep forward on the downstroke
      lower.rotation.y = sd * 0.08 * flapLow;
    });

    // Wand star spins and pulses; braid sways; sparkles orbit
    star.rotation.z = t * 2.4;
    star.scale.setScalar(1 + 0.12 * Math.sin(t * 5));
    braid.forEach((seg, i) => {
      seg.position.x = Math.sin(t * 2.6 + i * 0.7) * 0.01 * (i + 1) - velocity.x * 0.002 * (i + 1);
    });
    updateSparkles(t);
    aura.material.opacity = 0.6 + 0.2 * Math.sin(t * 3);

    // The letter floats at her side, in her frame, turned to face the camera
    group.updateMatrixWorld(true);
    const letterTarget = group.localToWorld(LETTER_LOCAL.clone());
    letterTarget.y += Math.sin(t * 1.7) * 0.025 * s;
    if (vis < 0.05) letterPos.copy(letterTarget);
    letterPos.lerp(letterTarget, Math.min(1, dt * 6));
    letter.position.copy(letterPos);
    letter.scale.setScalar(s);
    letter.lookAt(camera.position);
    letter.rotateZ(Math.sin(t * 1.3) * 0.05);
    letterGlow.position.copy(letter.position);
    letterGlow.position.z -= 0.06 * s;
    letterGlow.scale.setScalar(2.0 * s);

    updateRibbon(camera, s);
  }

  return { update, group, letter };
}
