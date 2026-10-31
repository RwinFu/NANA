// Extra decoration for the hall and the garden:
//   hall: dust in the candle light, soft light shafts under the chandeliers,
//         and a warm glow that draws the eye to the envelope at the end;
//   garden: a fountain that catches the moon, flower beds, and butterflies and
//         small birds that circle the princess;
//   princess: sparkles drifting from her hair while she walks, and petals when she jumps.
import * as THREE from 'three';
import { LAYOUT } from './world.js';

// A round stone fountain in the garden. controls.js treats it as solid so the couple walks around it.
export const FOUNTAIN = { x: -14, z: 8, r: 1.6 };

const LIGHT_SPOTS = [-8, -19, -30]; // the chandeliers, see world.js
const GOLD = '#d9a441';

function canvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// A soft round dot, used for dust, sparkles and glows
function dotTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  return canvasTexture(64, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, inner);
    g.addColorStop(0.35, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, outer);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

// A small petal: a pointed oval with a soft edge
function petalTexture() {
  return canvasTexture(64, 64, (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(32, 32, 26, 14, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

function additive(map, opacity, color = '#ffffff') {
  return new THREE.SpriteMaterial({
    map,
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
}

// ---------- coloured light on the hall floor, in front of the stained glass ----
// Four soft pools of light; decor's update gives each one a slowly shifting colour.
function buildHallBeams(scene) {
  const tex = dotTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
  const beams = [];
  [-2.4, -0.8, 0.8, 2.4].forEach((x, i) => {
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      color: '#ffffff',
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3.2), mat);
    beam.rotation.x = -Math.PI / 2;
    beam.position.set(x, 0.03, -36.4 - (i % 2) * 0.7);
    scene.add(beam);
    beams.push(beam);
  });
  return beams;
}

// ---------- heartbeat and falling hearts -------------------------------------
// A soft heartbeat (lub-dub) for the light behind the envelope
function heartbeat(t) {
  const x = t % 1.2;
  const beat = (a, w) => Math.exp(-(((x - a) / w) ** 2));
  return beat(0.08, 0.05) * 0.7 + beat(0.3, 0.06) * 0.45;
}

// Small pink hearts that fall over the envelope when it opens
function heartTexture() {
  return canvasTexture(64, 64, (ctx, w, h) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(w / 2, h * 0.82);
    ctx.bezierCurveTo(w * 0.05, h * 0.6, w * 0.1, h * 0.1, w / 2, h * 0.35);
    ctx.bezierCurveTo(w * 0.9, h * 0.1, w * 0.95, h * 0.6, w / 2, h * 0.82);
    ctx.fill();
  });
}

function buildHeartShower(scene) {
  const count = 40;
  const pos = new Float32Array(count * 3);
  const vel = new Float32Array(count * 3);
  const life = new Float32Array(count);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  for (let i = 0; i < count; i += 1) pos[i * 3 + 1] = -100;
  const mat = new THREE.PointsMaterial({
    size: 0.2,
    map: heartTexture(),
    color: '#ff8fc0',
    transparent: true,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
  let next = 0;
  return {
    burst(x, y, z, n) {
      for (let k = 0; k < n; k += 1) {
        const i = next;
        next = (next + 1) % count;
        pos[i * 3] = x + (Math.random() - 0.5) * 3.2;
        pos[i * 3 + 1] = y;
        pos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.6;
        vel[i * 3] = (Math.random() - 0.5) * 0.3;
        vel[i * 3 + 1] = -(0.8 + Math.random() * 0.6);
        life[i] = 4 + Math.random() * 2;
      }
    },
    update(dt) {
      for (let i = 0; i < count; i += 1) {
        if (life[i] <= 0) continue;
        life[i] -= dt;
        pos[i * 3] += vel[i * 3] * dt + Math.sin(life[i] * 2 + i) * 0.002;
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
        if (life[i] <= 0 || pos[i * 3 + 1] < 0.2) {
          life[i] = 0;
          pos[i * 3 + 1] = -100;
        }
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

// ---------- light shafts and dust -------------------------------------------
function buildShafts(scene) {
  const shaftMat = new THREE.ShaderMaterial({
    uniforms: { tint: { value: new THREE.Color('#ffd7a0') }, strength: { value: 0.085 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: `
      varying float vY;
      void main() {
        vY = position.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 tint;
      uniform float strength;
      varying float vY;
      void main() {
        // brightest just under the chandelier, fading out before the floor
        float a = smoothstep(-3.6, 3.4, vY) * strength;
        gl_FragColor = vec4(tint * a, 1.0);
      }`,
  });
  const geo = new THREE.CylinderGeometry(0.5, 2.7, 7.2, 28, 1, true);
  LIGHT_SPOTS.forEach((z) => {
    const shaft = new THREE.Mesh(geo, shaftMat);
    shaft.position.set(0, 3.6, z);
    scene.add(shaft);
  });
}

function buildDust(scene) {
  const count = 240;
  const base = [];
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const b = {
      x: (Math.random() * 2 - 1) * (LAYOUT.hallHalfWidth - 0.4),
      y: 0.6 + Math.random() * 8.2,
      z: -1.5 - Math.random() * (LAYOUT.hallLength - 3),
      phase: Math.random() * Math.PI * 2,
    };
    base.push(b);
    pos.set([b.x, b.y, b.z], i * 3);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.05,
    map: dotTexture(),
    color: '#ffe6b8',
    transparent: true,
    opacity: 0.75,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  scene.add(points);
  return { points, base, count };
}

// ---------- hall glow for the envelope ---------------------------------------
function buildEnvelopeGlow(scene) {
  const env = LAYOUT.envelope;
  const glow = new THREE.Sprite(additive(dotTexture('rgba(255,220,170,1)', 'rgba(255,200,150,0)'), 0.28));
  glow.scale.set(6.2, 4.2, 1);
  glow.position.set(env.x, env.y + env.h * 0.5, env.z + 0.5);
  scene.add(glow);
  return glow;
}

// ---------- fountain -----------------------------------------------------------
function buildFountain(scene) {
  const group = new THREE.Group();
  group.position.set(FOUNTAIN.x, 0, FOUNTAIN.z);
  scene.add(group);

  const stone = new THREE.MeshStandardMaterial({ color: '#e8dcea', roughness: 0.8, side: THREE.DoubleSide });
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(FOUNTAIN.r, FOUNTAIN.r, 0.5, 40, 1, true), stone);
  wall.position.y = 0.25;
  group.add(wall);
  const rim = new THREE.Mesh(new THREE.RingGeometry(FOUNTAIN.r - 0.14, FOUNTAIN.r, 40), stone);
  rim.rotation.x = -Math.PI / 2;
  rim.position.y = 0.5;
  group.add(rim);
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(FOUNTAIN.r - 0.02, 40), new THREE.MeshStandardMaterial({ color: '#2d2440', roughness: 0.9 }));
  bottom.rotation.x = -Math.PI / 2;
  bottom.position.y = 0.05;
  group.add(bottom);

  const waterMat = new THREE.MeshStandardMaterial({ color: '#24466a', roughness: 0.08, metalness: 0.2, emissive: '#0b1a2e', emissiveIntensity: 0.4 });
  const water = new THREE.Mesh(new THREE.CircleGeometry(FOUNTAIN.r - 0.14, 40), waterMat);
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.42;
  group.add(water);

  // the moon's reflection: a soft pale streak that shimmers on the water
  const moonTex = canvasTexture(128, 64, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,246,220,1)');
    g.addColorStop(0.5, 'rgba(255,240,210,0.35)');
    g.addColorStop(1, 'rgba(255,240,210,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  const moonMat = new THREE.MeshBasicMaterial({ map: moonTex, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const moonRef = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.5), moonMat);
  moonRef.rotation.x = -Math.PI / 2;
  moonRef.position.set(-0.2, 0.43, -0.25);
  group.add(moonRef);

  // the column with its upper bowl and a little gold finial
  const gold = new THREE.MeshStandardMaterial({ color: GOLD, metalness: 0.8, roughness: 0.3 });
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.17, 1.0, 14), stone);
  column.position.y = 0.95;
  group.add(column);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.14, 0.16, 24), stone);
  bowl.position.y = 1.5;
  group.add(bowl);
  const bowlWater = new THREE.Mesh(new THREE.CircleGeometry(0.36, 24), waterMat);
  bowlWater.rotation.x = -Math.PI / 2;
  bowlWater.position.y = 1.59;
  group.add(bowlWater);
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), gold);
  finial.position.y = 1.72;
  group.add(finial);

  // ripples that spread out from the middle of the basin
  const rippleGeo = new THREE.RingGeometry(0.92, 1, 40);
  const ripples = [0, 0.5, 1].map(() => {
    const mat = new THREE.MeshBasicMaterial({ color: '#dfe9ff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const ring = new THREE.Mesh(rippleGeo, mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, 0.44, 0);
    group.add(ring);
    return ring;
  });

  // the spray: droplets rising from the bowl and falling back into the basin
  const dropCount = 48;
  const dropPos = new Float32Array(dropCount * 3);
  const drops = [];
  for (let i = 0; i < dropCount; i += 1) {
    // each droplet leaves the bowl at vy and lands in the basin one second later
    const vy = 1.0 + Math.random() * 0.6;
    drops.push({ t: Math.random(), vx: (Math.random() - 0.5) * 0.8, vz: (Math.random() - 0.5) * 0.8, vy, g: 2 * (1.18 + vy) });
  }
  const dropGeo = new THREE.BufferGeometry();
  dropGeo.setAttribute('position', new THREE.BufferAttribute(dropPos, 3));
  const drop = new THREE.Points(
    dropGeo,
    new THREE.PointsMaterial({ size: 0.06, map: dotTexture(), color: '#dff4ff', transparent: true, opacity: 0.9, depthWrite: false, sizeAttenuation: true })
  );
  group.add(drop);

  return {
    update(t, dt) {
      ripples.forEach((ring, i) => {
        const k = ((t * 0.4 + i / 3) % 1);
        ring.scale.setScalar(0.25 + k * 1.1);
        ring.material.opacity = (1 - k) * 0.35;
      });
      moonMat.opacity = 0.5 + 0.1 * Math.sin(t * 1.3);
      drops.forEach((d, i) => {
        d.t = (d.t + dt * 0.9) % 1;
        const s = d.t;
        // a short arc from the bowl: up, then down into the water (s = 1 is the water)
        dropPos[i * 3] = d.vx * s * 0.5;
        dropPos[i * 3 + 1] = Math.max(0.42, 1.6 + d.vy * s - 0.5 * d.g * s * s);
        dropPos[i * 3 + 2] = d.vz * s * 0.5;
      });
      dropGeo.attributes.position.needsUpdate = true;
    },
  };
}

// ---------- flower beds ----------------------------------------------------------
function buildFlowers(scene) {
  const count = 170;
  const geo = new THREE.IcosahedronGeometry(0.09, 0);
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.8, flatShading: true });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const colours = ['#ff8fb8', '#c9a7ff', '#fff4fb', '#ffc2d9', '#ffe08a', '#e7a0b8'];
  const dummy = new THREE.Object3D();
  const c = new THREE.Color();
  for (let i = 0; i < count; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    // the beds sit between the path and the bushes, and never on the path itself
    const x = side * (1.6 + Math.random() * 2.6);
    const z = 2 + Math.random() * 20;
    const s = 0.8 + Math.random() * 0.6;
    dummy.position.set(x, 0.1 + Math.random() * 0.08, z);
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, c.set(colours[Math.floor(Math.random() * colours.length)]));
  }
  mesh.instanceColor.needsUpdate = true;
  scene.add(mesh);
  return mesh;
}

// ---------- creatures that circle the princess -------------------------------
// A wing is a soft shape that starts at the body and reaches out along +x.
function wingShape(length, width, curl) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(length * 0.5, width * 1.4, length, width * 0.9, length * 0.95, -width * 0.1 + curl);
  s.bezierCurveTo(length * 0.85, -width * 0.9, length * 0.4, -width * 0.6, 0, 0);
  return new THREE.ShapeGeometry(s, 8);
}

function buildCreature({ wingGeo, bodyGeo, bodyMat, wingMat, scale = 1 }) {
  const group = new THREE.Group();
  group.scale.setScalar(scale);
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  group.add(body);
  const pivots = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    const wing = new THREE.Mesh(wingGeo, wingMat);
    if (side < 0) wing.scale.x = -1; // the left wing is the right one, mirrored
    pivot.add(wing);
    group.add(pivot);
    return pivot;
  });
  return { group, pivots };
}

function buildCreatures(scene) {
  const list = [];
  const butterflyWing = wingShape(0.16, 0.1, 0.02);
  const butterflyBody = new THREE.CapsuleGeometry(0.012, 0.09, 3, 6);
  butterflyBody.rotateX(Math.PI / 2); // along +z, the way the creature flies
  const bodyMat = new THREE.MeshStandardMaterial({ color: '#2a1f2e', roughness: 0.6 });
  const butterflyColours = ['#ff9ac1', '#ffd3e6', '#c9a7ff', '#fff3c4', '#ffb3d9', '#9fd8ff'];
  // three butterflies circle the princess (half as many as before)
  for (let i = 0; i < 3; i += 1) {
    const wingMat = new THREE.MeshBasicMaterial({ color: butterflyColours[i], side: THREE.DoubleSide, transparent: true, opacity: 0.92, depthWrite: false });
    const built = buildCreature({ wingGeo: butterflyWing, bodyGeo: butterflyBody, bodyMat, wingMat, scale: 0.9 });
    scene.add(built.group);
    list.push({
      ...built,
      kind: 'butterfly',
      radius: 2.4 + Math.random() * 1.4,
      omega: (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.25),
      angle: Math.random() * Math.PI * 2,
      height: 1.2 + Math.random() * 1.2,
      phase: Math.random() * Math.PI * 2,
      flapRate: 14 + Math.random() * 4,
    });
  }

  const birdWing = wingShape(0.42, 0.06, 0.02);
  const birdBody = new THREE.SphereGeometry(0.07, 10, 8);
  const birdMat = new THREE.MeshStandardMaterial({ color: '#3b3354', roughness: 0.8 });
  for (let i = 0; i < 5; i += 1) {
    const wingMat = new THREE.MeshStandardMaterial({ color: '#3b3354', roughness: 0.8, side: THREE.DoubleSide });
    const built = buildCreature({ wingGeo: birdWing, bodyGeo: birdBody, bodyMat: birdMat, wingMat, scale: 1.1 });
    scene.add(built.group);
    list.push({
      ...built,
      kind: 'bird',
      radius: 7 + Math.random() * 3,
      omega: 0.22 + Math.random() * 0.12,
      angle: Math.random() * Math.PI * 2,
      height: 6.5 + Math.random() * 2,
      phase: Math.random() * Math.PI * 2,
      flapRate: 5 + Math.random() * 1.5,
    });
  }
  return list;
}

// ---------- princess effects -------------------------------------------------
function buildHairSparkles(scene) {
  const count = 90;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const life = new Float32Array(count);
  const vel = new Float32Array(count * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.07,
    map: dotTexture(),
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
  let next = 0;
  const hide = (i) => {
    pos[i * 3 + 1] = -100;
  };
  for (let i = 0; i < count; i += 1) hide(i);
  return {
    emit(x, y, z) {
      const i = next;
      next = (next + 1) % count;
      pos[i * 3] = x + (Math.random() - 0.5) * 0.22;
      pos[i * 3 + 1] = y + (Math.random() - 0.5) * 0.06;
      pos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.22;
      vel[i * 3] = (Math.random() - 0.5) * 0.12;
      vel[i * 3 + 1] = 0.25 + Math.random() * 0.25;
      vel[i * 3 + 2] = (Math.random() - 0.5) * 0.12;
      life[i] = 0.9;
    },
    update(dt) {
      for (let i = 0; i < count; i += 1) {
        if (life[i] <= 0) {
          col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0;
          continue;
        }
        life[i] -= dt;
        pos[i * 3] += vel[i * 3] * dt;
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
        pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        // gold-pink, fading to black (black adds nothing when blending is additive)
        const k = Math.max(0, life[i] / 0.9);
        col[i * 3] = 1.0 * k;
        col[i * 3 + 1] = 0.78 * k;
        col[i * 3 + 2] = 0.9 * k;
        if (life[i] <= 0) hide(i);
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
  };
}

function buildPetals(scene) {
  const count = 60;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const life = new Float32Array(count);
  const vel = new Float32Array(count * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.13,
    map: petalTexture(),
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending, // fading to black then adds nothing, so a fading petal vanishes cleanly
    sizeAttenuation: true,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
  const tints = [[1, 0.6, 0.78], [1, 0.8, 0.9], [0.85, 0.7, 1]];
  const tint = new Float32Array(count * 3);
  let next = 0;
  for (let i = 0; i < count; i += 1) pos[i * 3 + 1] = -100;
  return {
    burst(x, y, z, n) {
      for (let k = 0; k < n; k += 1) {
        const i = next;
        next = (next + 1) % count;
        const a = Math.random() * Math.PI * 2;
        pos[i * 3] = x + Math.cos(a) * 0.3;
        pos[i * 3 + 1] = y;
        pos[i * 3 + 2] = z + Math.sin(a) * 0.3;
        vel[i * 3] = Math.cos(a) * (0.4 + Math.random() * 0.5);
        vel[i * 3 + 1] = 0.6 + Math.random() * 0.6;
        vel[i * 3 + 2] = Math.sin(a) * (0.4 + Math.random() * 0.5);
        const pick = tints[Math.floor(Math.random() * tints.length)];
        tint.set(pick, i * 3);
        life[i] = 1.8 + Math.random() * 0.6;
      }
    },
    update(dt, t) {
      for (let i = 0; i < count; i += 1) {
        if (life[i] <= 0) continue;
        life[i] -= dt;
        // petals float: they slow down, drift and sway, then drop
        vel[i * 3] *= 1 - dt * 1.6;
        vel[i * 3 + 2] *= 1 - dt * 1.6;
        vel[i * 3 + 1] = vel[i * 3 + 1] * (1 - dt * 1.4) - dt * 0.7;
        pos[i * 3] += (vel[i * 3] + Math.sin(t * 2 + i) * 0.15) * dt;
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
        pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        // the last half second, they fade (a dark petal adds nothing to the scene)
        const k = Math.max(0, Math.min(1, life[i] / 0.5));
        col[i * 3] = tint[i * 3] * k;
        col[i * 3 + 1] = tint[i * 3 + 1] * k;
        col[i * 3 + 2] = tint[i * 3 + 2] * k;
        if (life[i] <= 0) pos[i * 3 + 1] = -100;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
    },
  };
}

// ---------- the whole decoration --------------------------------------------
export function buildDecor(scene, { hero }) {
  const shower = buildHeartShower(scene);
  buildShafts(scene);
  const dust = buildDust(scene);
  const envelopeGlow = buildEnvelopeGlow(scene);
  const beams = buildHallBeams(scene);
  const heartWin = scene.getObjectByName('heartWindow');
  const fountain = buildFountain(scene);
  buildFlowers(scene);
  const creatures = buildCreatures(scene);
  const sparkles = buildHairSparkles(scene);
  const petals = buildPetals(scene);

  // the top of the princess's head, measured once while she stands at rest
  const headY = hero.measure().princessTop - 0.04;
  const centre = { x: 0, z: 0, ready: false };
  let wasAirborne = false;
  const emitTimer = { acc: 0 };

  return {
    // the butterflies, so the cats can chase them
    butterflies: creatures.filter((c) => c.kind === 'butterfly').map((c) => c.group),
    // called when the envelope opens: a shower of hearts falls over the envelope
    celebrate() {
      shower.burst(LAYOUT.envelope.x, 5.6, LAYOUT.envelope.z + 0.6, 36);
    },
    update(t, dt, pos, moving, airborne) {
      // dust drifts slowly through the light
      const dp = dust.points.geometry.attributes.position;
      for (let i = 0; i < dust.count; i += 1) {
        const b = dust.base[i];
        dp.setXYZ(
          i,
          b.x + Math.sin(t * 0.25 + b.phase) * 0.25,
          b.y + Math.sin(t * 0.18 + b.phase * 1.7) * 0.2,
          b.z + Math.cos(t * 0.21 + b.phase) * 0.25
        );
      }
      dp.needsUpdate = true;
      envelopeGlow.material.opacity = 0.22 + 0.16 * heartbeat(t);
      beams.forEach((b, i) => b.material.color.setHSL((t * 0.04 + i * 0.22) % 1, 0.9, 0.6));
      if (heartWin) heartWin.material.uniforms.hue.value = t * 0.18;
      shower.update(dt);

      fountain.update(t, dt);

      // circling creatures: they follow the princess, a little behind her position
      if (!centre.ready) {
        centre.x = pos.x;
        centre.z = pos.z;
        centre.ready = true;
      }
      centre.x += (pos.x - centre.x) * Math.min(1, dt * 2);
      centre.z += (pos.z - centre.z) * Math.min(1, dt * 2);
      creatures.forEach((c) => {
        c.angle += c.omega * dt;
        const x = centre.x + Math.cos(c.angle) * c.radius;
        const z = centre.z + Math.sin(c.angle) * c.radius;
        const y = c.height + Math.sin(t * 0.9 + c.phase) * 0.3;
        const vx = -Math.sin(c.angle) * c.omega;
        const vz = Math.cos(c.angle) * c.omega;
        c.group.position.set(x, y, z);
        // the body points along the flight direction
        c.group.rotation.set(0, Math.atan2(vx, vz), 0);
        const flap = c.kind === 'bird'
          ? 0.12 + Math.sin(t * c.flapRate + c.phase) * 0.35
          : Math.sin(t * c.flapRate + c.phase) * 0.9;
        c.pivots[0].rotation.z = -flap;
        c.pivots[1].rotation.z = flap;
      });

      // hair sparkles while she walks, petals when she leaves the ground
      if (moving) {
        emitTimer.acc += dt * 22;
        while (emitTimer.acc >= 1) {
          emitTimer.acc -= 1;
          sparkles.emit(pos.x, headY, pos.z);
        }
      } else {
        emitTimer.acc = 0;
      }
      sparkles.update(dt);
      if (airborne && !wasAirborne) petals.burst(pos.x, 0.12, pos.z, 14);
      wasAirborne = airborne;
      petals.update(dt, t);
    },
  };
}
