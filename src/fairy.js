import * as THREE from 'three';

// A delicate butterfly carries the anniversary card through the castle intro.
// The existing flight and reveal interface is retained; only the messenger changes.

const TRAIL_SAMPLES = 34;
const TRAIL_SPACING = 0.1;
const SPARKLE_COUNT = 28;
const LETTER_FONT = '"Vazirmatn Variable", Vazirmatn, sans-serif';
const LETTER_LINES = ['سالگردمون مبارک', 'خوشگلترین پرنسس دنیا'];
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

// Painted butterfly wings: rosy scales, a darker scalloped edge, pale spots,
// and curved veins. Both sides use the same design, mirrored by the UVs.
function wingTexture(kind) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  const upper = kind === 'upper';
  const grad = g.createLinearGradient(0, 0, 512, 80);
  grad.addColorStop(0, '#f4d2df');
  grad.addColorStop(0.35, upper ? '#e9a6c6' : '#e9b7d3');
  grad.addColorStop(0.7, upper ? '#ce8eb9' : '#c69ac7');
  grad.addColorStop(1, '#76547d');
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 512);

  // A broad, gently curved outer margin, like the dark border of a butterfly wing.
  g.fillStyle = upper ? 'rgba(102,63,104,0.75)' : 'rgba(100,66,112,0.72)';
  g.beginPath();
  g.moveTo(350, 0);
  g.bezierCurveTo(390, 90, 400, 185, 393, 260);
  g.bezierCurveTo(390, 350, 420, 430, 380, 512);
  g.lineTo(512, 512); g.lineTo(512, 0); g.closePath(); g.fill();

  // Flowing veins radiate from the hinge and stay visible through the pastel scales.
  g.strokeStyle = 'rgba(111,68,104,0.50)';
  g.lineWidth = upper ? 5 : 4;
  g.lineCap = 'round';
  for (const end of [35, 105, 185, 270, 355, 435, 495]) {
    g.beginPath();
    g.moveTo(5, 290);
    g.bezierCurveTo(125, 290 + (end - 290) * 0.23, 255, end * 0.86 + 25, 450, end);
    g.stroke();
  }
  g.strokeStyle = 'rgba(255,235,244,0.40)';
  g.lineWidth = 2;
  for (const end of [72, 147, 230, 310, 395, 470]) {
    g.beginPath(); g.moveTo(25, 290);
    g.quadraticCurveTo(210, (end + 290) * 0.5, 375, end); g.stroke();
  }

  // Tiny pearly markings along the margin and a quiet eyespot on the hindwing.
  for (let i = 0; i < 8; i += 1) {
    const y = 46 + i * 60;
    const x = 436 + Math.sin(i * 0.85) * 9;
    g.fillStyle = 'rgba(255,235,243,0.85)';
    g.beginPath(); g.ellipse(x, y, 6 + (i % 2) * 2, 10, -0.2, 0, Math.PI * 2); g.fill();
  }
  if (!upper) {
    g.fillStyle = 'rgba(108,65,105,0.62)';
    g.beginPath(); g.ellipse(305, 280, 35, 42, -0.2, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#f4c8d8';
    g.beginPath(); g.ellipse(305, 280, 23, 29, -0.2, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#a77caa';
    g.beginPath(); g.ellipse(305, 280, 12, 16, -0.2, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff4f7';
    g.beginPath(); g.arc(310, 271, 4, 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// Butterfly wing silhouettes, mirrored without mirroring their painted patterns.
function wingShape(len, width, kind) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  if (kind === 'upper') {
    shape.bezierCurveTo(len * 0.18, width * 0.65, len * 0.63, width * 1.13, len * 0.86, width * 0.97);
    shape.bezierCurveTo(len * 1.05, width * 0.83, len * 1.04, width * 0.40, len * 0.92, width * 0.10);
    shape.bezierCurveTo(len * 0.78, -width * 0.24, len * 0.36, -width * 0.28, 0, 0);
  } else {
    shape.bezierCurveTo(len * 0.22, width * 0.48, len * 0.78, width * 0.82, len * 0.95, width * 0.42);
    shape.bezierCurveTo(len * 1.05, width * 0.12, len * 0.96, -width * 0.28, len * 0.79, -width * 0.36);
    shape.bezierCurveTo(len * 0.65, -width * 0.51, len * 0.26, -width * 0.32, 0, 0);
  }
  shape.closePath();
  return shape;
}

function wingGeometry(shape, side) {
  const geo = new THREE.ShapeGeometry(shape, 32);
  geo.scale(side, 1, 1);
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = (pos.getX(i) - bb.min.x) / (bb.max.x - bb.min.x);
    uv[i * 2] = side < 0 ? 1 - x : x;
    uv[i * 2 + 1] = (pos.getY(i) - bb.min.y) / (bb.max.y - bb.min.y);
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
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

function roundRectPath(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// A simple pastel card with the original anniversary message.
function letterCanvas() {
  const W = 1024, H = 692;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const paper = g.createLinearGradient(0, 0, 0, H);
  paper.addColorStop(0, '#fff9fb');
  paper.addColorStop(1, '#f8eaf4');
  roundRectPath(g, 4, 4, W - 8, H - 8, 52);
  g.fillStyle = paper; g.fill();
  g.strokeStyle = '#e5bfd2'; g.lineWidth = 5; g.stroke();
  roundRectPath(g, 34, 34, W - 68, H - 68, 32);
  g.strokeStyle = 'rgba(181,125,157,0.35)'; g.lineWidth = 2; g.stroke();

  // A small ribbon and a few restrained details leave the lettering room to breathe.
  g.strokeStyle = '#d58eae'; g.lineWidth = 7; g.lineCap = 'round';
  g.beginPath();
  g.moveTo(W / 2, 73); g.bezierCurveTo(W / 2 - 42, 25, W / 2 - 88, 38, W / 2 - 65, 75);
  g.bezierCurveTo(W / 2 - 50, 95, W / 2 - 20, 90, W / 2, 73);
  g.moveTo(W / 2, 73); g.bezierCurveTo(W / 2 + 42, 25, W / 2 + 88, 38, W / 2 + 65, 75);
  g.bezierCurveTo(W / 2 + 50, 95, W / 2 + 20, 90, W / 2, 73);
  g.stroke();
  g.fillStyle = '#d58eae'; g.beginPath(); g.arc(W / 2, 73, 8, 0, 2 * Math.PI); g.fill();

  g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#9a456e'; g.font = `800 100px ${LETTER_FONT}`;
  g.fillText(LETTER_LINES[0], W / 2, H * 0.43);
  g.fillStyle = '#795071'; g.font = `800 78px ${LETTER_FONT}`;
  g.fillText(LETTER_LINES[1], W / 2, H * 0.61);
  g.fillStyle = '#dfa2bc'; drawHeart(g, W / 2, H * 0.77, 22);
  return c;
}

// ---------- the fairy ----------

export function createFairy(scene) {
  // group: her place in the world, her heading and her visibility
  // figure: her body, scaled and bobbed inside the group
  const group = new THREE.Group();
  const figure = new THREE.Group();
  group.add(figure);

  figure.name = 'butterfly';
  // A butterfly's slim, segmented body: no human-like face or round doll head.
  // The slightly lighter thorax and tapered abdomen keep a readable silhouette
  // without competing with the patterned wings.
  const bodyMat = new THREE.MeshStandardMaterial({
    color: '#80617a', roughness: 0.86, emissive: '#6c425b', emissiveIntensity: 0.08,
  });
  const thoraxMat = new THREE.MeshStandardMaterial({
    color: '#a77d98', roughness: 0.84, emissive: '#8a5674', emissiveIntensity: 0.06,
  });
  const detailMat = new THREE.MeshStandardMaterial({ color: '#c6a2b4', roughness: 0.8 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: '#514254', roughness: 0.48 });
  const glint = new THREE.MeshBasicMaterial({ color: '#fff5f8' });

  const thorax = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), thoraxMat);
  thorax.name = 'butterfly-thorax';
  thorax.position.y = 0.035;
  thorax.scale.set(0.044, 0.080, 0.037);
  figure.add(thorax);

  const abdomen = new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(0, -0.195), new THREE.Vector2(0.016, -0.184),
    new THREE.Vector2(0.027, -0.155), new THREE.Vector2(0.035, -0.112),
    new THREE.Vector2(0.038, -0.070), new THREE.Vector2(0.035, -0.025),
    new THREE.Vector2(0.027, 0.010), new THREE.Vector2(0, 0.020),
  ], 32), bodyMat);
  abdomen.name = 'butterfly-abdomen';
  figure.add(abdomen);
  for (const [y, radius] of [[-0.065, 0.037], [-0.096, 0.037], [-0.127, 0.032], [-0.155, 0.025]]) {
    const segment = place(new THREE.Mesh(new THREE.TorusGeometry(radius, 0.0016, 6, 32), detailMat), 0, y, 0);
    segment.rotation.x = Math.PI / 2;
    figure.add(segment);
  }

  const head = place(new THREE.Mesh(new THREE.SphereGeometry(0.033, 24, 16), thoraxMat), 0, 0.136, 0.004);
  head.name = 'butterfly-head';
  head.scale.set(1, 0.92, 0.9);
  figure.add(head);
  for (const side of [-1, 1]) {
    // Small eyes nestle against the head instead of sitting on a separate face.
    const eye = place(new THREE.Mesh(new THREE.SphereGeometry(0.012, 16, 12), eyeMat), side * 0.024, 0.138, 0.019);
    eye.scale.set(0.72, 1.05, 0.68);
    figure.add(eye);
    figure.add(place(new THREE.Mesh(new THREE.SphereGeometry(0.0022, 8, 6), glint), side * 0.026, 0.142, 0.027));

    // Fine, curved clubbed antennae and three discreet pairs of legs.
    const antenna = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(side * 0.014, 0.161, 0),
      new THREE.Vector3(side * 0.034, 0.239, 0.006),
      new THREE.Vector3(side * 0.072, 0.251, 0.002),
    );
    figure.add(new THREE.Mesh(new THREE.TubeGeometry(antenna, 16, 0.0022, 6, false), bodyMat));
    figure.add(place(new THREE.Mesh(new THREE.SphereGeometry(0.0045, 10, 8), detailMat), side * 0.072, 0.251, 0.002));
    for (let i = 0; i < 3; i += 1) {
      const y = 0.045 - i * 0.028;
      const leg = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(side * 0.025, y, 0.012),
        new THREE.Vector3(side * (0.060 + i * 0.006), y - 0.01, 0.025),
        new THREE.Vector3(side * (0.063 + i * 0.009), y - 0.035, 0.02),
      );
      figure.add(new THREE.Mesh(new THREE.TubeGeometry(leg, 10, 0.0016, 5, false), bodyMat));
    }
  }

  // Each wing has a softly outlined silhouette, and matching mirrored markings.
  const upperShape = wingShape(0.50, 0.31, 'upper');
  const lowerShape = wingShape(0.35, 0.23, 'lower');
  const upperMat = new THREE.MeshBasicMaterial({
    map: wingTexture('upper'), transparent: true, opacity: 0.92,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const lowerMat = new THREE.MeshBasicMaterial({
    map: wingTexture('lower'), transparent: true, opacity: 0.92,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const edgeMat = new THREE.LineBasicMaterial({ color: '#805879', transparent: true, opacity: 0.65, depthWrite: false });
  const wingRoot = new THREE.Group();
  wingRoot.position.set(0, 0.04, -0.035);
  figure.add(wingRoot);
  const wings = [];
  [-1, 1].forEach((side) => {
    const makeWing = (shape, mat, name) => {
      const hinge = new THREE.Group();
      const wing = new THREE.Mesh(wingGeometry(shape, side), mat);
      wing.name = `${name}-${side < 0 ? 'left' : 'right'}`;
      hinge.add(wing);
      const points = shape.getPoints(48).map((p) => new THREE.Vector3(p.x * side, p.y, 0.001));
      hinge.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), edgeMat));
      wingRoot.add(hinge);
      return hinge;
    };
    const upper = makeWing(upperShape, upperMat, 'upper-wing');
    const lower = makeWing(lowerShape, lowerMat, 'lower-wing');
    lower.position.y = -0.07;
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
    opacity: 0.25,
  }));
  aura.scale.setScalar(0.8);
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
  letter.name = 'anniversary-letter';
  scene.add(letter);
  const letterGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('rgba(255,225,240,0.9)', 'rgba(255,150,200,0.3)'),
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.23,
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
  const faceQ = new THREE.Quaternion();
  const cameraRight = new THREE.Vector3();
  const cameraUp = new THREE.Vector3();
  const cordPositions = new Float32Array(2 * 12 * 3);
  const cordGeo = new THREE.BufferGeometry();
  cordGeo.setAttribute('position', new THREE.BufferAttribute(cordPositions, 3).setUsage(THREE.DynamicDrawUsage));
  const cords = new THREE.LineSegments(cordGeo, new THREE.LineBasicMaterial({ color: '#d9b7cd', transparent: true, opacity: 0.8, depthWrite: false }));
  cords.name = 'letter-threads';
  cords.frustumCulled = false;
  scene.add(cords);
  cords.visible = false;

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
  const TRAIL_COUNT = 35;
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
      trailAcc += dt * 14;
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
    ribbonMat.opacity = 0.3 * s;
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
    glow.intensity = show ? 0.35 * Math.max(0.001, vis) * (0.9 + 0.1 * Math.sin(t * 3)) : 0;
    glow.position.copy(pos).add(new THREE.Vector3(0, 0.15, 0));
    group.visible = show;
    letter.visible = show;
    letterGlow.visible = show;
    ribbon.visible = show;
    cords.visible = show;
    updateTrail(dt, show);
    if (!show) return;

    const s = Math.max(0.001, vis);
    group.position.copy(pos);
    group.scale.setScalar(s);
    // turn smoothly toward where she is going, instead of snapping
    aimM.lookAt(next, pos, UP);
    aimQ.setFromRotationMatrix(aimM);
    // The butterfly gradually faces the viewer when she presents the card.
    aimM.lookAt(camera.position, pos, UP);
    faceQ.setFromRotationMatrix(aimM);
    aimQ.slerp(faceQ, smoothstep((p - 0.65) / 0.3));
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

    // Flap around the wing hinges, with a small delayed lower-wing motion.
    const flap = Math.sin(t * 8.5);
    const flapLow = Math.sin(t * 8.5 - 0.5);
    wings.forEach(({ upper, lower, side: sd }) => {
      upper.rotation.z = sd * (0.36 + 0.04 * flap);
      lower.rotation.z = -sd * (0.65 + 0.04 * flapLow);
      upper.rotation.y = sd * (0.28 + 0.48 * (0.5 + 0.5 * flap));
      lower.rotation.y = sd * (0.25 + 0.4 * (0.5 + 0.5 * flapLow));
    });
    updateSparkles(t);
    aura.material.opacity = 0.16 + 0.05 * Math.sin(t * 2);

    // The card stays below the butterfly in the camera plane. Two fine silk
    // threads always connect its upper edge to her body, including in flight.
    cameraRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
    cameraUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
    letterPos.copy(pos).addScaledVector(cameraUp, -0.5 * s);
    letter.position.copy(letterPos);
    letter.scale.setScalar(s);
    letter.quaternion.copy(camera.quaternion);
    letterGlow.position.copy(letter.position).addScaledVector(camera.getWorldDirection(tmpCam), 0.06 * s);
    letterGlow.scale.setScalar(1.6 * s);
    const start = pos.clone().addScaledVector(cameraUp, -0.09 * s);
    for (let sideIndex = 0; sideIndex < 2; sideIndex += 1) {
      const end = letterPos.clone().addScaledVector(cameraUp, LETTER_H * 0.5 * s)
        .addScaledVector(cameraRight, (sideIndex ? 0.29 : -0.29) * s);
      for (let j = 0; j < 6; j += 1) {
        for (let k = 0; k < 2; k += 1) {
          const u = (j + k) / 6;
          const offset = (sideIndex * 12 + j * 2 + k) * 3;
          cordPositions[offset] = THREE.MathUtils.lerp(start.x, end.x, u);
          cordPositions[offset + 1] = THREE.MathUtils.lerp(start.y, end.y, u) - Math.sin(u * Math.PI) * 0.018 * s;
          cordPositions[offset + 2] = THREE.MathUtils.lerp(start.z, end.z, u);
        }
      }
    }
    cordGeo.attributes.position.needsUpdate = true;
    cords.material.opacity = 0.7 * s;

    updateRibbon(camera, s);
  }

  return { update, group, letter };
}
