import * as THREE from 'three';
import { memories as memoryList, soloMemories, soloVideo } from './memories.js';
import { buildCastle } from './castle.js';
import { createRugGlint, createStoneGlint } from './rugglint.js';
import { stoneNormal, doorNormal, giltNormal, ribbonNormal, heartGlass } from './architecture.js';
import { buildTown } from './town.js';
import { advanceHallProgress } from './house-reactivity.js';

// Layout (metres). The garden sits at z > 0, the house front is at z = 0,
// and the gallery hall runs from z = 0 to z = -40 with the finale at its end.
export const LAYOUT = {
  hallHalfWidth: 3.85,
  hallHeight: 10, // the crown of the round vault
  hallSpring: 6.15, // where the vault starts (hallHeight - hallHalfWidth)
  hallLength: 40,
  doorHalfWidth: 1.5,
  doorHeight: 4.9, // springline of the round top; the crown is 1.5 m higher
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

// A heart outline, centred on (x, y) with half-width `size`
function drawHeartPath(ctx, x, y, size) {
  ctx.beginPath();
  for (let i = 0; i <= 48; i += 1) {
    const t = (i / 48) * Math.PI * 2;
    const px = x + size * Math.sin(t) ** 3;
    const py = y - (size / 16) * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

// The plaque uses a playful display face; Lalezar is loaded in main.js
const PLAQUE_FONT = '"Lalezar", "Vazirmatn Variable", sans-serif';

function drawPlaque(ctx, w, h, text) {
  // A rose-cream card with a double gold border, gold hearts in the corners, and a plum title
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#fff8fb');
  grad.addColorStop(1, '#f5c2d8');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#d9a441';
  ctx.lineWidth = 12;
  ctx.strokeRect(24, 24, w - 48, h - 48);
  ctx.strokeStyle = '#f5d78e';
  ctx.lineWidth = 4;
  ctx.strokeRect(48, 48, w - 96, h - 96);
  ctx.fillStyle = '#e9b96a';
  [[74, 74], [w - 74, 74], [74, h - 74], [w - 74, h - 74]].forEach(([x, y]) => {
    drawHeartPath(ctx, x, y, 16);
    ctx.fill();
  });
  ctx.fillStyle = '#6b2d5c';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `400 96px ${PLAQUE_FONT}`;
  ctx.fillText('خانه‌ی ما', w / 2, h * 0.28);
  // A divider with a heart in the middle
  ctx.fillStyle = '#d9a441';
  ctx.fillRect(w / 2 - 190, h * 0.45, 140, 4);
  ctx.fillRect(w / 2 + 50, h * 0.45, 140, 4);
  ctx.fillStyle = '#ff7fae';
  drawHeartPath(ctx, w / 2, h * 0.45 + 2, 14);
  ctx.fill();
  ctx.fillStyle = '#7a3a63';
  ctx.font = `400 44px ${PLAQUE_FONT}`;
  const lines = wrapText(ctx, text, w - 240, 2);
  lines.forEach((line, i) => ctx.fillText(line, w / 2, h * 0.58 + i * 46));
}

// A rounded rectangle centred on the origin, as a Shape (used for the plaque frame)
function roundedRect(w, h, r) {
  const shape = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

// ---------- world ----------------------------------------------------------

// The castle doors: cream leaves with round tops, gold piping along the arch, a glowing arched window,
// a raised pink panel with a gold frame, a gold kick-plate, a pink heart on each leaf, and a gold knob
// with a pink jewel. They stand closed by default and swing open (90 degrees) once the couple comes near,
// then stay open. Closed, the leaves meet with no rail or seam between them.
// Local frame: x runs along the wall, y is up, and z points to the side the doors face.
function buildDoorPair({ scene, track, centre, rotY, halfWidth, spring, swing = 1 }) {
  const R = halfWidth;
  const group = new THREE.Group();
  group.position.copy(centre);
  group.rotation.y = rotY;
  scene.add(group);

  const leafMat = track(new THREE.MeshStandardMaterial({
    color: '#fde8f1', roughness: 0.45, side: THREE.DoubleSide, normalMap: doorNormal(2, 2), normalScale: new THREE.Vector2(0.9, 0.9),
  }));
  const panelMat = track(new THREE.MeshStandardMaterial({ color: '#f6c3d6', roughness: 0.4 }));
  const goldMat = track(new THREE.MeshStandardMaterial({ color: '#e9b96a', metalness: 0.7, roughness: 0.3, normalMap: giltNormal(4, 1), normalScale: new THREE.Vector2(0.8, 0.8) }));
  const hg = heartGlass(1.5, 1.5);
  const glassMat = track(
    new THREE.MeshStandardMaterial({
      color: '#ffe3ef',
      emissive: '#ff9fcb',
      emissiveIntensity: 0.55,
      emissiveMap: hg.emissiveMap,
      normalMap: hg.normalMap,
      normalScale: new THREE.Vector2(0.8, 0.8),
      roughness: 0.2,
      side: THREE.DoubleSide,
    })
  );
  const heartMat = track(new THREE.MeshStandardMaterial({ color: '#ff7fae', emissive: '#ff4f8f', emissiveIntensity: 0.25, roughness: 0.35 }));
  const bowMat = track(new THREE.MeshStandardMaterial({ color: '#ff8cba', emissive: '#ff5c9c', emissiveIntensity: 0.18, roughness: 0.3 }));
  const jewelMat = track(new THREE.MeshStandardMaterial({ color: '#ff9cc2', emissive: '#ff6fa6', emissiveIntensity: 0.3, roughness: 0.2 }));
  const boxGeo = track(new THREE.BoxGeometry(1, 1, 1));
  const ballGeo = track(new THREE.SphereGeometry(1, 14, 10));
  const leaves = [];

  // In a leaf's frame, s is the distance from its hinge (0 at the hinge, R at the centre) and v is the height.
  // The leaf's local x is -side * s, so it runs from its hinge towards the centre.
  const at = (side, s, v, z) => new THREE.Vector3(-side * s, v, z);
  // Height of the round top at distance s from the hinge: a half circle centred on the springline
  const archTop = (s) => spring + Math.sqrt(Math.max(0, R * R - (R - s) * (R - s)));

  // One heart outline, shared by both leaves
  const heartShape = new THREE.Shape();
  for (let i = 0; i <= 48; i += 1) {
    const t = (i / 48) * Math.PI * 2;
    const hx = 16 * Math.sin(t) ** 3;
    const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    if (i === 0) heartShape.moveTo(hx * 0.013, hy * 0.013);
    else heartShape.lineTo(hx * 0.013, hy * 0.013);
  }
  const heartGeo = track(new THREE.ExtrudeGeometry(heartShape, { depth: 0.04, bevelEnabled: false }));

  // A thin gold line that follows points given in the leaf's frame
  // straight: true gives straight edges with sharp corners (for the rectangle panel frame)
  function piping(hinge, pts, side, z, radius, closed, straight = false) {
    let run = pts;
    if (straight) {
      // Dense points along every edge keep the edges straight with sharp corners
      run = [];
      pts.forEach((a, i) => {
        const b = pts[(i + 1) % pts.length];
        if (!closed && i === pts.length - 1) return;
        for (let k = 0; k < 10; k += 1) {
          run.push([a[0] + ((b[0] - a[0]) * k) / 10, a[1] + ((b[1] - a[1]) * k) / 10]);
        }
      });
    }
    const curve = new THREE.CatmullRomCurve3(run.map(([s, v]) => at(side, s, v, z)), closed, 'centripetal');
    hinge.add(new THREE.Mesh(track(new THREE.TubeGeometry(curve, pts.length * 14, radius, 8, closed)), goldMat));
  }

  [-1, 1].forEach((side) => {
    const hinge = new THREE.Group();
    hinge.position.set(side * R, 0, 0);
    group.add(hinge);
    leaves.push({ hinge, side });

    // The leaf body, with its round top
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(R, 0);
    shape.lineTo(R, spring + R);
    for (let i = 0; i <= 24; i += 1) {
      const s = R - (i / 24) * R;
      shape.lineTo(s, archTop(s));
    }
    shape.closePath();
    const body = track(
      new THREE.ExtrudeGeometry(shape, {
        depth: 0.1,
        bevelEnabled: true,
        bevelThickness: 0.02,
        bevelSize: 0.02,
        bevelSegments: 2,
        curveSegments: 24,
      })
    );
    body.translate(0, 0, -0.05);
    body.scale(-side, 1, 1);
    hinge.add(new THREE.Mesh(body, leafMat));

    // The details are built once for the front (+z) and mirrored for the back (-z), so both faces are decorated
    [1, -1].forEach((zs) => {
      const face = new THREE.Group();
      face.scale.z = zs;
      hinge.add(face);

      // Gold piping along the round top
      const arch = [];
      for (let i = 0; i <= 30; i += 1) {
        const s = (i / 30) * R;
        arch.push([s, archTop(s) + 0.03]);
      }
      piping(face, arch, side, 0.07, 0.03, false);

      // A raised pink panel in a gold frame, low on the leaf
      const p0 = R * 0.18;
      const p1 = R * 0.82;
      const q0 = spring * 0.09;
      const q1 = spring * 0.47;
      const panel = new THREE.Mesh(boxGeo, panelMat);
      panel.scale.set(p1 - p0, q1 - q0, 0.04);
      panel.position.copy(at(side, (p0 + p1) / 2, (q0 + q1) / 2, 0.09));
      face.add(panel);
      piping(face, [[p0, q0], [p1, q0], [p1, q1], [p0, q1]], side, 0.105, 0.025, true, true);

      // An arched window that glows, with a gold frame and two gold bars
      const ww = R * 0.6;
      const wc = R * 0.5;
      const wv0 = spring * 0.56;
      const wv1 = spring * 0.9;
      const win = new THREE.Shape();
      win.moveTo(wc - ww / 2, wv0);
      win.lineTo(wc + ww / 2, wv0);
      win.lineTo(wc + ww / 2, wv1);
      win.absarc(wc, wv1, ww / 2, 0, Math.PI, false);
      win.lineTo(wc - ww / 2, wv0);
      const winGeo = track(new THREE.ShapeGeometry(win, 24));
      winGeo.scale(-side, 1, 1);
      winGeo.translate(0, 0, 0.09);
      face.add(new THREE.Mesh(winGeo, glassMat));
      // Evenly spaced points along the outline, so the gold frame follows the glass edge exactly (sharp bottom corners)
      const winPts = win.getSpacedPoints(160).map((p) => [p.x, p.y]);
      const first = winPts[0];
      const last = winPts[winPts.length - 1];
      if (Math.abs(last[0] - first[0]) < 1e-6 && Math.abs(last[1] - first[1]) < 1e-6) winPts.pop();
      piping(face, winPts, side, 0.1, 0.025, true);
      const mullion = new THREE.Mesh(boxGeo, goldMat);
      mullion.scale.set(0.035, wv1 - wv0, 0.03);
      mullion.position.copy(at(side, wc, (wv0 + wv1) / 2, 0.11));
      face.add(mullion);
      const transom = new THREE.Mesh(boxGeo, goldMat);
      transom.scale.set(ww, 0.035, 0.03);
      transom.position.copy(at(side, wc, wv0 + (wv1 - wv0) * 0.55, 0.11));
      face.add(transom);

      // A gold kick-plate along the bottom
      const kick = new THREE.Mesh(boxGeo, goldMat);
      kick.scale.set(R * 0.9, 0.2, 0.05);
      kick.position.copy(at(side, R * 0.5, 0.1, 0.085));
      face.add(kick);

      // A pink heart in the top of each leaf
      const heart = new THREE.Mesh(heartGeo, heartMat);
      heart.position.copy(at(side, R * 0.5, spring + R * 0.42, 0.07));
      face.add(heart);

      // A pink bow between the lower panel and the window: two loops, a knot and two tails
      const bowV = spring * 0.515;
      [-1, 1].forEach((k) => {
        const loop = new THREE.Mesh(ballGeo, bowMat);
        loop.scale.set(0.085, 0.06, 0.03);
        loop.position.copy(at(side, R * 0.5 + k * 0.085, bowV, 0.13));
        loop.rotation.z = k * 0.45;
        face.add(loop);
        const tail = new THREE.Mesh(boxGeo, bowMat);
        tail.scale.set(0.04, 0.2, 0.025);
        tail.position.copy(at(side, R * 0.5 + k * 0.05, bowV - 0.13, 0.13));
        tail.rotation.z = -k * 0.25;
        face.add(tail);
      });
      const knot = new THREE.Mesh(ballGeo, bowMat);
      knot.scale.setScalar(0.032);
      knot.position.copy(at(side, R * 0.5, bowV, 0.15));
      face.add(knot);

      // A gold knob with a pink jewel, near the meeting edge
      const knob = new THREE.Mesh(ballGeo, goldMat);
      knob.scale.setScalar(0.08);
      knob.position.copy(at(side, R - 0.2, spring * 0.36, 0.13));
      face.add(knob);
      const jewel = new THREE.Mesh(ballGeo, jewelMat);
      jewel.scale.setScalar(0.035);
      jewel.position.copy(at(side, R - 0.2, spring * 0.36, 0.2));
      face.add(jewel);
    });
  });

  // A gold finial with a pink jewel at the crown
  const finial = new THREE.Mesh(ballGeo, goldMat);
  finial.scale.setScalar(0.14);
  finial.position.set(0, spring + R + 0.14, 0.08);
  group.add(finial);
  const crownJewel = new THREE.Mesh(ballGeo, jewelMat);
  crownJewel.scale.setScalar(0.06);
  crownJewel.position.set(0, spring + R + 0.32, 0.08);
  group.add(crownJewel);

  let open = 0;
  let latched = false;
  // Closed by default. Once the couple comes within reach, the doors swing open and stay open.
  function update(dt, px, pz) {
    if (Math.hypot(px - centre.x, pz - centre.z) < 2.6) latched = true;
    const target = latched ? 1 : 0;
    open += THREE.MathUtils.clamp(target - open, -dt * 2.5, dt * 2.5);
    const k = open * open * (3 - 2 * open);
    leaves.forEach(({ hinge, side }) => {
      hinge.rotation.y = swing * side * (Math.PI / 2) * k;
    });
  }

  return { update };
}

export function buildWorld(scene) {
  const disposables = [];
  const track = (obj) => {
    disposables.push(obj);
    return obj;
  };

  // Sky: a night gradient dome that fades to a plum horizon behind the castle
  const HORIZON = '#2c1f4a';
  scene.background = new THREE.Color(HORIZON);
  scene.fog = new THREE.Fog(HORIZON, 34, 110);
  const domeMat = track(
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        topColor: { value: new THREE.Color('#05061a') },
        midColor: { value: new THREE.Color('#15133a') },
        horizonColor: { value: new THREE.Color(HORIZON) },
        glowColor: { value: new THREE.Color('#5a2a5e') },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 midColor;
        uniform vec3 horizonColor;
        uniform vec3 glowColor;
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y, 0.0, 1.0);
          vec3 c = mix(horizonColor, midColor, smoothstep(0.0, 0.3, h));
          c = mix(c, topColor, smoothstep(0.25, 0.85, h));
          // a soft rose glow low in the sky, behind the castle
          c += glowColor * exp(-h * 9.0) * 0.55;
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    })
  );
  const dome = new THREE.Mesh(track(new THREE.SphereGeometry(190, 40, 20)), domeMat);
  dome.renderOrder = -10;
  scene.add(dome);

  // Stars: a round soft sprite, in warm, cool and pink colours, in two sizes
  const starTex = canvasTexture(64, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.22, 'rgba(255,255,255,0.85)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  const starTints = [new THREE.Color('#fff4e0'), new THREE.Color('#cfe0ff'), new THREE.Color('#ffc2e0')];
  const addStarLayer = (count, size, opacity) => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(0.12 + Math.random() * 0.88);
      const r = 150 + Math.random() * 10;
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.cos(phi);
      pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      const tint = starTints[Math.random() < 0.6 ? 0 : Math.random() < 0.6 ? 1 : 2];
      const k = 0.7 + Math.random() * 0.3;
      col[i * 3] = tint.r * k;
      col[i * 3 + 1] = tint.g * k;
      col[i * 3 + 2] = tint.b * k;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const points = track(
      new THREE.Points(
        geo,
        new THREE.PointsMaterial({
          size,
          map: starTex,
          vertexColors: true,
          transparent: true,
          opacity,
          depthWrite: false,
          sizeAttenuation: true,
          fog: false,
        })
      )
    );
    scene.add(points);
    return points;
  };
  addStarLayer(900, 1.6, 0.95); // bright, larger stars
  addStarLayer(1400, 0.8, 0.7); // a fine field of smaller stars

  // Moon: a cratered disc with a soft halo
  const moonTex = canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#f3e3c3';
    ctx.fillRect(0, 0, w, h);
    const craters = [
      [0.32, 0.38, 0.12], [0.62, 0.3, 0.08], [0.55, 0.62, 0.14],
      [0.28, 0.7, 0.07], [0.74, 0.56, 0.06], [0.45, 0.2, 0.05],
    ];
    craters.forEach(([x, y, r]) => {
      const g = ctx.createRadialGradient(x * w, y * h, r * w * 0.2, x * w, y * h, r * w);
      g.addColorStop(0, 'rgba(170,140,110,0.55)');
      g.addColorStop(1, 'rgba(170,140,110,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x * w, y * h, r * w, 0, Math.PI * 2);
      ctx.fill();
    });
  });
  const moon = track(
    new THREE.Mesh(
      new THREE.SphereGeometry(5, 48, 32),
      new THREE.MeshBasicMaterial({ map: moonTex, fog: false, toneMapped: false })
    )
  );
  moon.position.set(-40, 62, -90);
  scene.add(moon);
  const haloTex = canvasTexture(256, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.12, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,236,200,0.9)');
    g.addColorStop(0.35, 'rgba(255,200,225,0.28)');
    g.addColorStop(1, 'rgba(255,200,225,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  const halo = new THREE.Sprite(
    track(new THREE.SpriteMaterial({ map: haloTex, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }))
  );
  halo.scale.set(40, 40, 1);
  halo.position.copy(moon.position);
  scene.add(halo);

  // A few soft clouds drifting low behind the castle
  const cloudTex = canvasTexture(256, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(190,150,200,0.9)');
    g.addColorStop(1, 'rgba(190,150,200,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  const cloudMat = track(
    new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.16, depthWrite: false, fog: false })
  );
  [
    [-70, 16, -120, 60, 14],
    [40, 12, -135, 80, 16],
    [-10, 22, -150, 100, 18],
    [95, 14, -95, 50, 12],
    [-110, 18, -100, 60, 13],
  ].forEach(([x, y, z, w, hgt]) => {
    const cloud = new THREE.Sprite(cloudMat);
    cloud.position.set(x, y, z);
    cloud.scale.set(w, hgt, 1);
    scene.add(cloud);
  });

  // Lights
  const hemi = new THREE.HemisphereLight('#ffe2ca', '#715046', 1.05);
  scene.add(hemi);
  const moonLight = new THREE.DirectionalLight('#ffdfbd', 0.95);
  moonLight.position.set(-30, 50, 20);
  scene.add(moonLight);

  const hallLights = [];
  [-8, -19, -30].forEach((z) => {
    const light = new THREE.PointLight('#ffb771', 22, 15, 1.6);
    light.position.set(0, CHANDELIER_Y - 0.5, z);
    scene.add(light);
    hallLights.push(light);
  });

  // One shared warm accent follows the selected frame, avoiding a light per photo.
  const frameAccent = new THREE.PointLight('#ffd6a0', 0, 4.8, 2);
  scene.add(frameAccent);
  const accentPosition = new THREE.Vector3();
  let accentFrameIndex = -1;

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

  // Hall floor: inlaid parquet planks with a gold border line on every tile
  const parquetTex = canvasTexture(256, 256, (ctx, w, h) => {
    const plank = 64;
    for (let row = 0; row < h / plank; row += 1) {
      ctx.fillStyle = row % 2 ? '#6b4330' : '#5a3726';
      ctx.fillRect(0, row * plank, w, plank);
      ctx.strokeStyle = 'rgba(30,15,10,0.65)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, row * plank);
      ctx.lineTo(w, row * plank);
      const offset = (row % 2) * 96;
      ctx.moveTo(offset, row * plank);
      ctx.lineTo(offset, row * plank + plank);
      ctx.stroke();
    }
    ctx.strokeStyle = '#d9a441';
    ctx.lineWidth = 5;
    ctx.strokeRect(8, 8, w - 16, h - 16);
  });
  parquetTex.wrapS = THREE.RepeatWrapping;
  parquetTex.wrapT = THREE.RepeatWrapping;
  parquetTex.repeat.set(2, 20);

  // Hall floor and rug
  const floor = track(
    new THREE.Mesh(
      new THREE.PlaneGeometry(LAYOUT.hallHalfWidth * 2, LAYOUT.hallLength),
      new THREE.MeshStandardMaterial({ map: parquetTex, roughness: 0.55, metalness: 0.05 })
    )
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0.01, -LAYOUT.hallLength / 2);
  scene.add(floor);

  // The runner: a rose-red carpet with gold borders and a diamond pattern, from the front door to the far end.
  // The texture is one square tile repeated along the length, so the pattern keeps its shape.
  const RUG = { z0: 0.3, z1: -37.6 };
  const RUG_W = 2.2;
  const RUG_LEN = RUG.z0 - RUG.z1;
  const rugTex = canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#7a1d36';
    ctx.fillRect(0, 0, w, h);
    // the gold borders along both edges, each with a thin dark line inside
    ctx.fillStyle = '#e6b660';
    ctx.fillRect(18, 0, 16, h);
    ctx.fillRect(w - 34, 0, 16, h);
    ctx.fillStyle = '#5a1126';
    ctx.fillRect(38, 0, 4, h);
    ctx.fillRect(w - 42, 0, 4, h);
    // a diamond motif down the middle, with a gold centre
    for (let row = 0; row < 2; row += 1) {
      const cy = (row + 0.5) * (h / 2);
      ctx.fillStyle = '#a33a5c';
      ctx.beginPath();
      ctx.moveTo(w / 2, cy - 150);
      ctx.lineTo(w / 2 + 90, cy);
      ctx.lineTo(w / 2, cy + 150);
      ctx.lineTo(w / 2 - 90, cy);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#e6b660';
      ctx.beginPath();
      ctx.arc(w / 2, cy, 14, 0, Math.PI * 2);
      ctx.fill();
    }
    // a gold line where the tiles meet, so the repeat is not seen
    ctx.fillStyle = '#e6b660';
    ctx.fillRect(0, 0, w, 6);
    ctx.fillRect(0, h - 6, w, 6);
  });
  rugTex.wrapS = THREE.RepeatWrapping;
  rugTex.wrapT = THREE.RepeatWrapping;
  rugTex.repeat.set(1, RUG_LEN / RUG_W);
  const rug = track(
    new THREE.Mesh(
      new THREE.PlaneGeometry(RUG_W, RUG_LEN),
      new THREE.MeshStandardMaterial({ map: rugTex, roughness: 0.85 })
    )
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.02, (RUG.z0 + RUG.z1) / 2);
  scene.add(rug);
  const rugGlint = createRugGlint(scene, rug, { x: 0, z: (RUG.z0 + RUG.z1) / 2, halfW: RUG_W / 2, halfD: RUG_LEN / 2 });


  // Hall walls and a round barrel vault: a half circle across the hall that springs from the wall tops
  const R_HALL = LAYOUT.hallHalfWidth;
  const SPRING = LAYOUT.hallSpring;
  const vaultMat = track(new THREE.MeshStandardMaterial({ color: '#2a1f3d', roughness: 0.9, side: THREE.DoubleSide }));
  const vaultGeo = track(new THREE.BufferGeometry());
  const VSEG = 36;
  const vPos = [];
  [0.2, -LAYOUT.hallLength].forEach((z) => {
    for (let i = 0; i <= VSEG; i += 1) {
      const t = (i / VSEG) * Math.PI;
      vPos.push(R_HALL * Math.cos(t), SPRING + R_HALL * Math.sin(t), z);
    }
  });
  const vIdx = [];
  for (let i = 0; i < VSEG; i += 1) {
    const a = i;
    const b = i + 1;
    const c = VSEG + 1 + i;
    const d = VSEG + 2 + i;
    vIdx.push(a, c, b, b, c, d);
  }
  vaultGeo.setAttribute('position', new THREE.Float32BufferAttribute(vPos, 3));
  vaultGeo.setIndex(vIdx);
  vaultGeo.computeVertexNormals();
  scene.add(new THREE.Mesh(vaultGeo, vaultMat));

  const wallMat = new THREE.MeshStandardMaterial({ color: '#3a2a3f', roughness: 0.85 });
  const wallThickness = 0.3;
  // Right wall: one solid piece up to the springline of the vault
  const sideWallGeo = track(new THREE.BoxGeometry(wallThickness, SPRING, LAYOUT.hallLength));
  const rightWall = new THREE.Mesh(sideWallGeo, wallMat);
  rightWall.position.set(LAYOUT.hallHalfWidth + wallThickness / 2, SPRING / 2, -LAYOUT.hallLength / 2);
  scene.add(rightWall);
  // Left wall: one shape with a round-topped doorway cut into it (the photo room)
  const DR = LAYOUT.room.door;
  const doorR = (DR.z1 - DR.z0) / 2;
  const doorZc = (DR.z0 + DR.z1) / 2;
  const doorSpring = DR.top - doorR;
  const leftX = -(LAYOUT.hallHalfWidth + wallThickness / 2);
  // Shape x is -z, so the extruded wall faces the hall after it is turned
  const wallShape = new THREE.Shape();
  wallShape.moveTo(-0.2, 0);
  wallShape.lineTo(-DR.z1, 0);
  wallShape.lineTo(-DR.z1, doorSpring);
  for (let i = 0; i <= 24; i += 1) {
    const a = (i / 24) * Math.PI;
    wallShape.lineTo(-(doorZc + doorR * Math.cos(a)), doorSpring + doorR * Math.sin(a));
  }
  wallShape.lineTo(-DR.z0, 0);
  wallShape.lineTo(LAYOUT.hallLength, 0);
  wallShape.lineTo(LAYOUT.hallLength, SPRING);
  wallShape.lineTo(-0.2, SPRING);
  wallShape.closePath();
  const leftWall = new THREE.Mesh(track(new THREE.ExtrudeGeometry(wallShape, { depth: wallThickness, bevelEnabled: false })), wallMat);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(leftX - wallThickness / 2, 0, 0);
  scene.add(leftWall);

  // Gold trim around the doorway: jambs up to the springline, and a round gold arch on top
  const doorTrimMat = track(new THREE.MeshStandardMaterial({ color: '#d9a441', metalness: 0.8, roughness: 0.3, normalMap: giltNormal(4, 1), normalScale: new THREE.Vector2(0.8, 0.8) }));
  [DR.z1, DR.z0].forEach((z) => {
    const jamb = new THREE.Mesh(track(new THREE.BoxGeometry(0.08, doorSpring, 0.14)), doorTrimMat);
    jamb.position.set(-3.89, doorSpring / 2, z);
    scene.add(jamb);
  });
  const doorArch = new THREE.Mesh(track(new THREE.TorusGeometry(doorR, 0.07, 8, 32, Math.PI)), doorTrimMat);
  doorArch.rotation.y = Math.PI / 2;
  doorArch.position.set(-3.89, doorSpring, doorZc);
  scene.add(doorArch);
  const doorCrest = new THREE.Mesh(track(new THREE.SphereGeometry(0.13, 12, 10)), doorTrimMat);
  doorCrest.position.set(-3.89, DR.top + 0.12, doorZc);
  scene.add(doorCrest);
  // Photo room door: closed by default, opens as the couple comes near
  const roomDoor = buildDoorPair({
    scene,
    track,
    centre: new THREE.Vector3(-3.9, 0, doorZc),
    rotY: -Math.PI / 2,
    halfWidth: (DR.z1 - DR.z0) / 2,
    spring: doorSpring,
  });

  // Royal hall decoration: gold ribs across the vault and a gold cornice where the walls meet it
  const hallGold = track(new THREE.MeshStandardMaterial({ color: '#d9a441', metalness: 0.8, roughness: 0.3 }));
  const ribRadius = LAYOUT.hallHalfWidth - 0.06;
  for (let k = 0; k < 8; k += 1) {
    const rib = new THREE.Mesh(track(new THREE.TorusGeometry(ribRadius, 0.1, 8, 40, Math.PI)), hallGold);
    rib.position.set(0, LAYOUT.hallSpring, -2.5 - k * 5);
    scene.add(rib);
  }
  const cornice = track(new THREE.BoxGeometry(0.22, 0.4, LAYOUT.hallLength));
  [-1, 1].forEach((side) => {
    const piece = new THREE.Mesh(cornice, hallGold);
    piece.position.set(side * (LAYOUT.hallHalfWidth - 0.11), LAYOUT.hallSpring - 0.2, -LAYOUT.hallLength / 2);
    scene.add(piece);
  });

  // Crystal chandeliers: a gold chain, two tiers of candle bulbs and pink crystal drops
  const chandBulbMaterials = [];
  const chandBulbColor = new THREE.Color('#ffe2a8');
  const crystalMat = track(new THREE.MeshStandardMaterial({ color: '#ffd6ea', emissive: '#c77aa6', emissiveIntensity: 0.6, roughness: 0.15, metalness: 0.1 }));
  const chainGeo = track(new THREE.CylinderGeometry(0.025, 0.025, 1, 6));
  const ringGeo = track(new THREE.TorusGeometry(1, 0.045, 8, 40));
  const bulbGeo = track(new THREE.SphereGeometry(0.075, 10, 8));
  const dropGeo = track(new THREE.ConeGeometry(0.06, 0.22, 8));
  const hubGeo = track(new THREE.SphereGeometry(0.32, 16, 12));
  const canopyGeo = track(new THREE.CylinderGeometry(0.22, 0.3, 0.22, 16));
  const addChandelier = (z) => {
    const chandBulbMat = track(new THREE.MeshBasicMaterial({ color: chandBulbColor.clone().multiplyScalar(0.12), fog: false }));
    chandBulbMaterials.push(chandBulbMat);
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
  // The back wall is a round-topped window with the same cross-section as the hall
  const WR = LAYOUT.hallHalfWidth;
  const windowShape = new THREE.Shape();
  windowShape.moveTo(-WR, 0);
  windowShape.lineTo(WR, 0);
  windowShape.lineTo(WR, LAYOUT.hallSpring);
  for (let i = 0; i <= 36; i += 1) {
    const a = (i / 36) * Math.PI;
    windowShape.lineTo(WR * Math.cos(a), LAYOUT.hallSpring + WR * Math.sin(a));
  }
  windowShape.closePath();
  const windowGeo = track(new THREE.ShapeGeometry(windowShape, 36));
  const wpos = windowGeo.attributes.position;
  const wuv = windowGeo.attributes.uv;
  for (let i = 0; i < wpos.count; i += 1) {
    wuv.setXY(i, (wpos.getX(i) + WR) / (2 * WR), wpos.getY(i) / (LAYOUT.hallSpring + WR));
  }
  const heartWindow = track(
    new THREE.Mesh(
      windowGeo,
      new THREE.MeshBasicMaterial({
        map: canvasTexture(1024, 820, (ctx, w, h) => {
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
  heartWindow.position.set(0, 0, -LAYOUT.hallLength + 0.16);
  heartWindow.rotation.y = 0;
  scene.add(heartWindow);

  // Outer skins: the outside of the hall is stone, not the dark interior colour, and the back is closed.
  // Each skin sits just outside the hall's own surface, and is double-sided, so from inside the hall
  // it is hidden behind the walls, vault and heart window.
  const skinMat = track(new THREE.MeshStandardMaterial({ color: '#cfc0b4', roughness: 0.9, side: THREE.DoubleSide }));
  const SKIN_R = R_HALL + 0.22;
  const skinPos = [];
  [0.2, -LAYOUT.hallLength].forEach((z) => {
    for (let i = 0; i <= VSEG; i += 1) {
      const t = (i / VSEG) * Math.PI;
      skinPos.push(SKIN_R * Math.cos(t), SPRING + SKIN_R * Math.sin(t), z);
    }
  });
  const skinVaultGeo = track(new THREE.BufferGeometry());
  skinVaultGeo.setAttribute('position', new THREE.Float32BufferAttribute(skinPos, 3));
  skinVaultGeo.setIndex(vIdx);
  skinVaultGeo.computeVertexNormals();
  scene.add(new THREE.Mesh(skinVaultGeo, skinMat));

  // Right side: just outside the right wall (its outside face is at x = 4.15)
  const rightSkin = new THREE.Mesh(track(new THREE.PlaneGeometry(LAYOUT.hallLength + 0.4, SPRING)), skinMat);
  rightSkin.rotation.y = Math.PI / 2;
  rightSkin.position.set(4.18, SPRING / 2, -LAYOUT.hallLength / 2 + 0.1);
  scene.add(rightSkin);

  // Left side: outside the left wall, in two pieces that leave out the photo room's span and its doorway (z -23.4 to -16.6)
  [[0.2, -16.6], [-23.4, -LAYOUT.hallLength]].forEach(([za, zb]) => {
    const piece = new THREE.Mesh(track(new THREE.PlaneGeometry(za - zb, SPRING)), skinMat);
    piece.rotation.y = -Math.PI / 2;
    piece.position.set(-4.18, SPRING / 2, (za + zb) / 2);
    scene.add(piece);
  });

  // Back: a round-topped stone wall behind the heart window, with the same cross-section
  const backShape = new THREE.Shape();
  backShape.moveTo(-SKIN_R, 0);
  backShape.lineTo(SKIN_R, 0);
  backShape.lineTo(SKIN_R, SPRING);
  for (let i = 0; i <= 36; i += 1) {
    const a = (i / 36) * Math.PI;
    backShape.lineTo(SKIN_R * Math.cos(a), SPRING + SKIN_R * Math.sin(a));
  }
  backShape.closePath();
  const back = new THREE.Mesh(track(new THREE.ShapeGeometry(backShape, 36)), skinMat);
  back.position.set(0, 0, -LAYOUT.hallLength - 0.04);
  scene.add(back);

  // House front (facade) with the door opening
  const facadeMat = new THREE.MeshStandardMaterial({ color: '#e9dccb', roughness: 0.8, normalMap: stoneNormal(3, 4), normalScale: new THREE.Vector2(1, 1) });
  const facadeHeight = 8;
  const halfW = 10;
  const dw = LAYOUT.doorHalfWidth;
  const dh = LAYOUT.doorHeight;
  const facadeParts = [
    [-(halfW + dw) / 2, facadeHeight / 2, halfW - dw, facadeHeight],
    [(halfW + dw) / 2, facadeHeight / 2, halfW - dw, facadeHeight],
  ];
  facadeParts.forEach(([x, y, w, h]) => {
    const part = track(new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.6), facadeMat));
    part.position.set(x, y, 0);
    scene.add(part);
  });

  // Round-topped doorway: the solid facade above the door is cut with a half circle
  const facadeTop = new THREE.Shape();
  facadeTop.moveTo(-dw, dh);
  facadeTop.lineTo(-dw, facadeHeight);
  facadeTop.lineTo(dw, facadeHeight);
  facadeTop.lineTo(dw, dh);
  for (let i = 0; i <= 24; i += 1) {
    const a = (i / 24) * Math.PI;
    facadeTop.lineTo(Math.cos(a) * dw, dh + Math.sin(a) * dw);
  }
  const facadeArch = new THREE.Mesh(track(new THREE.ExtrudeGeometry(facadeTop, { depth: 0.6, bevelEnabled: false })), facadeMat);
  facadeArch.position.set(0, 0, -0.3);
  scene.add(facadeArch);
  // Pink moulding and gold piping over the doors, with a rosette at each springline and a crown on top
  const archPinkMat = track(new THREE.MeshStandardMaterial({ color: '#f6c3d6', roughness: 0.45, normalMap: ribbonNormal(12, 1), normalScale: new THREE.Vector2(0.8, 0.8) }));
  const archGoldMat = track(new THREE.MeshStandardMaterial({ color: '#d9a441', metalness: 0.8, roughness: 0.3, normalMap: giltNormal(4, 1), normalScale: new THREE.Vector2(0.8, 0.8) }));
  const archJewelMat = track(new THREE.MeshStandardMaterial({ color: '#ff9cc2', emissive: '#ff6fa6', emissiveIntensity: 0.3, roughness: 0.2 }));
  const archRadius = dw + 0.2;
  const pinkArch = new THREE.Mesh(track(new THREE.TorusGeometry(archRadius, 0.12, 10, 48, Math.PI)), archPinkMat);
  pinkArch.position.set(0, dh, 0.3);
  scene.add(pinkArch);
  const goldArch = new THREE.Mesh(track(new THREE.TorusGeometry(archRadius, 0.035, 8, 48, Math.PI)), archGoldMat);
  goldArch.position.set(0, dh, 0.42);
  scene.add(goldArch);
  const surroundBallGeo = track(new THREE.SphereGeometry(1, 14, 10));
  [-1, 1].forEach((side) => {
    const rosette = new THREE.Mesh(surroundBallGeo, archGoldMat);
    rosette.scale.setScalar(0.2);
    rosette.position.set(side * archRadius, dh, 0.42);
    scene.add(rosette);
    const rosetteJewel = new THREE.Mesh(surroundBallGeo, archJewelMat);
    rosetteJewel.scale.setScalar(0.1);
    rosetteJewel.position.set(side * archRadius, dh, 0.56);
    scene.add(rosetteJewel);
  });
  const crown = new THREE.Mesh(surroundBallGeo, archGoldMat);
  crown.scale.setScalar(0.16);
  crown.position.set(0, dh + archRadius, 0.42);
  scene.add(crown);

  // A thin stone threshold across the doorway. It is only 4 cm high, so the couple walk on top of it
  // without their feet sinking into it (a taller step hid their lower bodies).
  const sillMat = track(new THREE.MeshStandardMaterial({ color: '#e9dccb', roughness: 0.8 }));
  const sill = track(new THREE.Mesh(new THREE.BoxGeometry(dw * 2 + 0.8, 0.04, 1.0), sillMat));
  sill.position.set(0, 0.0, 0.5);
  scene.add(sill);

  // The house front becomes a princess castle
  const castle = buildCastle(scene, track);

  // Castle entrance: closed by default, opens as the couple comes near
  const frontDoor = buildDoorPair({
    scene,
    track,
    centre: new THREE.Vector3(0, 0, 0.12),
    rotY: 0,
    halfWidth: dw,
    spring: dh,
    swing: -1, // swings into the hall, away from the garden path
  });
  const doors = [frontDoor, roomDoor];

  // Door panels (open) and warm light spilling from the door: cream pillars with gold plinths and bands
  const jambMat = track(new THREE.MeshStandardMaterial({ color: '#fbf1f5', roughness: 0.5, normalMap: ribbonNormal(8, 1), normalScale: new THREE.Vector2(0.7, 0.7) }));
  [-1, 1].forEach((side) => {
    const jamb = new THREE.Mesh(track(new THREE.BoxGeometry(0.18, dh, 0.5)), jambMat);
    jamb.position.set(side * dw, dh / 2, 0.02);
    scene.add(jamb);
    const plinth = new THREE.Mesh(track(new THREE.BoxGeometry(0.3, 0.4, 0.6)), archGoldMat);
    plinth.position.set(side * dw, 0.2, 0.02);
    scene.add(plinth);
    const band = new THREE.Mesh(track(new THREE.BoxGeometry(0.24, 0.1, 0.56)), archGoldMat);
    band.position.set(side * dw, dh * 0.6, 0.02);
    scene.add(band);
  });

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

  // Plaque above the door with the dedication text (redrawn when text changes), in a raised gold frame
  const plaqueCanvas = document.createElement('canvas');
  plaqueCanvas.width = 1024;
  plaqueCanvas.height = 300;
  const plaqueTex = new THREE.CanvasTexture(plaqueCanvas);
  plaqueTex.colorSpace = THREE.SRGBColorSpace;
  const plaque = track(
    new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, 1.0),
      new THREE.MeshBasicMaterial({ map: plaqueTex, toneMapped: false })
    )
  );
  plaque.position.set(0, 7.38, 0.4);
  scene.add(plaque);
  const plaqueFrameShape = roundedRect(3.6, 1.2, 0.2);
  plaqueFrameShape.holes.push(roundedRect(3.4, 1.0, 0.1));
  const plaqueFrame = new THREE.Mesh(
    track(
      new THREE.ExtrudeGeometry(plaqueFrameShape, {
        depth: 0.05,
        bevelEnabled: true,
        bevelThickness: 0.02,
        bevelSize: 0.02,
        bevelSegments: 2,
        curveSegments: 12,
      })
    ),
    archGoldMat
  );
  plaqueFrame.position.set(0, 7.38, 0.31);
  scene.add(plaqueFrame);

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
  const swayingLeaves = [];
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
      swayingLeaves.push({ leaf, phase: i * 1.3 + dx, baseX: dx });
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
  // Placed wide of the path so the tour start camera never sits beside a bulb
  [[-9, 3], [9, 3], [-9, 14], [9, 14]].forEach(([x, z]) => {
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

  // Floor medallions beside the rug
  const medallionGold = track(new THREE.MeshStandardMaterial({ color: '#d9a441', metalness: 0.8, roughness: 0.3 }));
  const medallionInner = track(new THREE.MeshStandardMaterial({ color: '#7a1f3d', roughness: 0.7 }));
  const medallionRing = track(new THREE.RingGeometry(0.42, 0.55, 40));
  const medallionDisc = track(new THREE.CircleGeometry(0.42, 40));
  [-5, -14, -26, -35].forEach((z) => {
    [-2.5, 2.5].forEach((x) => {
      const ring = new THREE.Mesh(medallionRing, medallionGold);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 0.03, z);
      scene.add(ring);
      const disc = new THREE.Mesh(medallionDisc, medallionInner);
      disc.rotation.x = -Math.PI / 2;
      disc.position.set(x, 0.025, z);
      scene.add(disc);
    });
  });
  // The town beyond the castle, with its skyline, landmarks and drifting lanterns
  const town = buildTown(scene, track);

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
  // Tiny repeated corner details are shared across frames to keep the gallery light.
  const frameJewelGeo = track(new THREE.OctahedronGeometry(0.045, 0));
  const frameBeadGeo = track(new THREE.SphereGeometry(0.038, 8, 6));
  function buildFrames(list, startIndex, placeAt, maxW, maxH) {
    return list.map((memory, i) => {
      const index = startIndex + i;
      const spot = placeAt(i);
      const group = new THREE.Group();
      group.position.set(spot.x, spot.y, spot.z);
      group.rotation.y = spot.rotY; // face into the hall or the room

      const frameMat = new THREE.MeshStandardMaterial({
        color: memory.frame.color,
        roughness: 0.48,
        metalness: 0.38,
        normalMap: giltNormal(2, 2),
        normalScale: new THREE.Vector2(0.22, 0.22),
      });
      const frameMesh = new THREE.Mesh(frameGeo, frameMat);
      frameMesh.position.z = -0.02;
      group.add(frameMesh);
      const ornamentMat = track(new THREE.MeshStandardMaterial({
        color: memory.frame.glow, metalness: 0.5, roughness: 0.42,
        emissive: memory.frame.glow, emissiveIntensity: 0.08,
      }));
      const ornamentGeo = index % 2 ? frameBeadGeo : frameJewelGeo;
      const corners = index % 3 === 0 ? [[-0.44, 0.44], [0.44, 0.44], [-0.44, -0.44], [0.44, -0.44]] : [[-0.44, 0.44], [0.44, 0.44]];
      corners.forEach(([x, y]) => {
        const jewel = new THREE.Mesh(ornamentGeo, ornamentMat);
        jewel.position.set(x, y, 0.57);
        frameMesh.add(jewel);
      });

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
      const warmGlow = new THREE.Color(memory.frame.glow).lerp(new THREE.Color('#ffd7a6'), 0.8);
      const wash = new THREE.Sprite(glowAdd(warmGlow, 0.20));
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
        lampHead,
        ornamentMat,
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
  // Stone skins on the outside faces, so the room reads as part of the castle from outside, not a black box
  const roomStone = track(new THREE.MeshStandardMaterial({ color: '#cfc0b4', roughness: 0.9 }));
  const skinW = oz1 - oz0;
  const skinWide = ox1 - ox0;
  const westSkin = new THREE.Mesh(track(new THREE.PlaneGeometry(skinW, H)), roomStone);
  westSkin.rotation.y = -Math.PI / 2;
  westSkin.position.set(ox0 - 0.03, H / 2, (oz0 + oz1) / 2);
  roomGroup.add(westSkin);
  const southSkin = new THREE.Mesh(track(new THREE.PlaneGeometry(skinWide, H)), roomStone);
  southSkin.rotation.y = Math.PI;
  southSkin.position.set((ox0 + ox1) / 2, H / 2, oz0 - 0.03);
  roomGroup.add(southSkin);
  const northSkin = new THREE.Mesh(track(new THREE.PlaneGeometry(skinWide, H)), roomStone);
  northSkin.position.set((ox0 + ox1) / 2, H / 2, oz1 + 0.03);
  roomGroup.add(northSkin);
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
  // The video fits inside a box of at most 2.8 m wide and 3.0 m high, keeping its own proportions
  const fitW = 2.8;
  const fitH = 3.0;
  let screenW = fitW;
  let screenH = fitH;
  const videoY = 2.6;
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

  let hallProgress = -1;
  const hallLightLevels = hallLights.map(() => 0.12);

  function update(t, dt, highlightIndex, playerPosition = null) {
    hallProgress = advanceHallProgress(hallProgress, playerPosition, LAYOUT.hallHalfWidth, LAYOUT.hallLength);
    castle.update(t);
    town.update(t);
    // Slow, subtle movement shared across the garden canopy and chandeliers.
    swayingLeaves.forEach(({ leaf, phase, baseX }) => {
      leaf.position.x = baseX + Math.sin(t * 0.45 + phase) * 0.025;
      leaf.rotation.z = Math.sin(t * 0.55 + phase) * 0.025;
    });
    crystalMat.emissiveIntensity = 0.48 + 0.08 * Math.sin(t * 0.75);
    // Lanterns bob gently
    for (let i = 0; i < lanternCount; i += 1) {
      const d = lanternData[i];
      dummy.position.set(d.x, d.y + Math.sin(t * 0.8 + d.phase) * 0.12, d.z);
      const lit = hallProgress >= 0 && -d.z <= hallProgress + 4;
      d.level = THREE.MathUtils.lerp(d.level ?? 0.16, lit ? 1 : 0.16, Math.min(1, dt * 1.8));
      dummy.scale.setScalar(0.45 + d.level * 0.55);
      tint.set(palette[i % palette.length]).multiplyScalar(d.level);
      lanterns.setColorAt(i, tint);
      dummy.updateMatrix();
      lanterns.setMatrixAt(i, dummy.matrix);
    }
    lanterns.instanceMatrix.needsUpdate = true;
    lanterns.instanceColor.needsUpdate = true;

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

    // Gentle warm light: ease independently on each frame, without a sharp halo.
    const frameEase = 1 - Math.exp(-dt * 1.5);
    frames.forEach((frame) => {
      const active = frame.index === highlightIndex;
      const target = active ? 0.32 : 0.18;
      frame.wash.material.opacity += (target - frame.wash.material.opacity) * frameEase;
      const glow = active ? 0.15 : 0.08;
      frame.ornamentMat.emissiveIntensity += (glow - frame.ornamentMat.emissiveIntensity) * frameEase;
      const pulse = 1 + 0.02 * Math.sin(t * 1.1 + frame.index * 1.7);
      frame.lampHead.scale.setScalar(pulse);
    });
    const selectedFrame = frames.find((frame) => frame.index === highlightIndex);
    // Fade out before moving the shared light, so switching frames never makes it jump.
    const sameFrame = selectedFrame && selectedFrame.index === accentFrameIndex;
    const targetIntensity = sameFrame ? 1.6 : 0;
    frameAccent.intensity += (targetIntensity - frameAccent.intensity) * (1 - Math.exp(-dt * 2));
    if (selectedFrame && !sameFrame && frameAccent.intensity < 0.04) {
      accentPosition.set(0, 0.4, 0.9);
      selectedFrame.group.localToWorld(accentPosition);
      frameAccent.position.copy(accentPosition);
      frameAccent.color.set('#ffd6a0');
      accentFrameIndex = selectedFrame.index;
    }

    // Hall lights flicker very slightly, like candles
    // The lamp nearest the envelope is a little dimmer, so the envelope's own glow stands out
    hallLights.forEach((light, i) => {
      const dim = i === 2 ? 0.62 : 1;
      const lit = hallProgress >= 0 && hallProgress >= Math.max(0, -light.position.z - 8);
      hallLightLevels[i] += ((lit ? 1 : 0.12) - hallLightLevels[i]) * Math.min(1, dt * 1.4);
      chandBulbMaterials[i].color.copy(chandBulbColor).multiplyScalar(hallLightLevels[i]);
      light.intensity = (22 + Math.sin(t * 2.1 + i * 1.7) * 0.9 + Math.sin(t * 5.3 + i) * 0.4) * dim * hallLightLevels[i];
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
    updateDoors(dt, px, pz) {
      doors.forEach((d) => d.update(dt, px, pz));
    },
  };
}
