import * as THREE from 'three';

// Sparkle effects for the hall's red runner and the garden stones.
// Two layers: a steady twinkle that is always there (across the whole runner and on each
// stone), and sparks that spray up from the couple's feet while they walk over the surface.

const POOL = 90;
const COLORS = ['#fff4cf', '#ffd66b', '#ffb8d4', '#ffffff', '#ff9ac0'];

function starTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.18, 'rgba(255,255,255,0.85)');
  grd.addColorStop(0.45, 'rgba(255,255,255,0.18)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  // four thin rays make it read as a sparkle, not a blob
  g.strokeStyle = 'rgba(255,255,255,0.9)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(32, 4);
  g.lineTo(32, 60);
  g.moveTo(4, 32);
  g.lineTo(60, 32);
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeSprite(scene, tex, color) {
  const mat = new THREE.SpriteMaterial({
    map: tex,
    color,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    opacity: 0,
  });
  const sprite = new THREE.Sprite(mat);
  scene.add(sprite);
  return sprite;
}

// Sparks that fly up from a point. Round-robin pool, so it never grows.
function createSparkPool(scene, tex) {
  const sparks = [];
  for (let i = 0; i < POOL; i++) {
    const sprite = makeSprite(scene, tex, '#ffffff');
    sprite.visible = false;
    sparks.push({ sprite, life: 0, max: 1, size: 0.2, x: 0, y: 0, z: 0, vy: 0, ph: 0 });
  }
  let next = 0;

  function spawn(px, pz, walking, spread) {
    for (let i = 0; i < POOL; i++) {
      const s = sparks[(next + i) % POOL];
      if (s.life > 0) continue;
      next = (next + i + 1) % POOL;
      const r = Math.random;
      s.max = 0.7 + r() * 0.6;
      s.life = s.max;
      s.size = 0.1 + r() * 0.2;
      s.x = px + (r() - 0.5) * spread;
      s.z = pz + (r() - 0.5) * spread;
      s.y = 0.1 + r() * 0.3;
      s.vy = walking ? 0.6 + r() * 0.9 : 0.2 + r() * 0.3;
      s.ph = r() * Math.PI * 2;
      s.sprite.material.color.set(COLORS[Math.floor(r() * COLORS.length)]);
      s.sprite.visible = true;
      return;
    }
  }

  function tick(dt, t, level) {
    for (const s of sparks) {
      if (s.life <= 0) {
        if (s.sprite.visible) s.sprite.visible = false;
        continue;
      }
      s.life -= dt;
      const age = 1 - Math.max(0, s.life) / s.max; // 0 -> 1
      const swell = Math.sin(Math.PI * age); // grows, then fades
      const pulse = 0.75 + 0.25 * Math.sin(t * 16 + s.ph);
      const size = s.size * swell * pulse;
      s.sprite.scale.set(size, size, 1);
      s.sprite.material.opacity = swell * 0.95 * level;
      s.sprite.position.set(s.x, s.y + s.vy * age * s.max, s.z);
    }
  }

  function dispose() {
    for (const s of sparks) {
      scene.remove(s.sprite);
      s.sprite.material.dispose();
    }
  }

  return { spawn, tick, dispose };
}

// Steady twinkles at fixed points: each one breathes on its own rhythm.
function createTwinkles(scene, tex, points) {
  return points.map((pt, i) => {
    const sprite = makeSprite(scene, tex, COLORS[i % COLORS.length]);
    sprite.position.set(pt.x, pt.y, pt.z);
    return { sprite, size: pt.size, ph: Math.random() * Math.PI * 2, rate: 1.2 + Math.random() * 1.8 };
  });
}

function tickTwinkles(list, t, boost) {
  for (const k of list) {
    const s = 0.5 + 0.5 * Math.sin(t * k.rate * 3 + k.ph);
    const size = k.size * (0.3 + 0.7 * s) * (1 + 0.25 * boost);
    k.sprite.scale.set(size, size, 1);
    k.sprite.material.opacity = s * (0.55 + 0.45 * boost);
  }
}

// rug: the runner mesh. The rect is its footprint on the floor.
export function createRugGlint(scene, rug, { x = 0, z = -19, halfW = 1.1, halfD = 18 } = {}) {
  const tex = starTexture();
  const rugMat = rug.material;
  const pool = createSparkPool(scene, tex);
  // twinkles across the whole length of the runner, so it sparkles however far they go
  const points = [];
  for (let i = 0; i < 36; i++) {
    points.push({
      x: x + (Math.random() * 2 - 1) * (halfW - 0.2),
      y: 0.07,
      z: z + (Math.random() * 2 - 1) * (halfD - 0.5),
      size: 0.16 + Math.random() * 0.2,
    });
  }
  const twinkles = createTwinkles(scene, tex, points);
  let level = 0; // 0 off the rug, 1 standing on it
  let acc = 0;
  let prev = null;

  function inside(p) {
    return Math.abs(p.x - x) < halfW && Math.abs(p.z - z) < halfD;
  }

  function update(dt, t, pos, moving) {
    const on = inside(pos) ? 1 : 0;
    level += (on - level) * Math.min(1, dt * (on > level ? 6 : 1.2));
    const speed = prev ? Math.hypot(pos.x - prev.x, pos.z - prev.z) / Math.max(dt, 1e-4) : 0;
    if (!prev) prev = new THREE.Vector3();
    prev.copy(pos);

    if (rugMat && rugMat.emissive) {
      rugMat.emissive.set('#ff3f6e');
      rugMat.emissiveIntensity = level * (0.09 + 0.05 * Math.sin(t * 2.4));
    }

    const walking = moving && speed > 0.2 && level > 0.5;
    const rate = walking ? 34 : level > 0.5 ? 4 : 0;
    acc += rate * dt;
    while (acc >= 1) {
      acc -= 1;
      pool.spawn(pos.x, pos.z, walking, 0.9);
    }
    pool.tick(dt, t, level);
    tickTwinkles(twinkles, t, level);
  }

  function dispose() {
    pool.dispose();
    for (const k of twinkles) {
      scene.remove(k.sprite);
      k.sprite.material.dispose();
    }
    tex.dispose();
  }

  return { update, dispose };
}

// stones: the garden stepping stones, each a mesh with its own material.
export function createStoneGlint(scene, stones) {
  const tex = starTexture();
  const pool = createSparkPool(scene, tex);
  const points = stones.map((m) => ({ x: m.position.x, y: 0.14, z: m.position.z, size: 0.22 }));
  const twinkles = createTwinkles(scene, tex, points);
  const weights = stones.map(() => 0);

  function update(dt, t, pos, moving) {
    let near = 0;
    stones.forEach((m, i) => {
      const d = Math.hypot(pos.x - m.position.x, pos.z - m.position.z);
      const target = Math.max(0, Math.min(1, 1 - (d - 0.5) / 0.7));
      weights[i] += (target - weights[i]) * Math.min(1, dt * (target > weights[i] ? 6 : 1.2));
      const w = weights[i];
      if (w > near) near = w;
      const mat = m.material;
      if (mat && mat.emissive) {
        mat.emissive.set('#b58cff');
        mat.emissiveIntensity = w * (0.3 + 0.12 * Math.sin(t * 2.6 + i));
      }
    });

    const walking = moving && near > 0.4;
    const rate = walking ? 30 : near > 0.4 ? 3 : 0;
    stoneAcc += rate * dt;
    while (stoneAcc >= 1) {
      stoneAcc -= 1;
      pool.spawn(pos.x, pos.z, walking, 0.6);
    }
    pool.tick(dt, t, near);
    tickTwinkles(twinkles, t, near);
  }
  let stoneAcc = 0;

  function dispose() {
    pool.dispose();
    for (const k of twinkles) {
      scene.remove(k.sprite);
      k.sprite.material.dispose();
    }
    tex.dispose();
  }

  return { update, dispose };
}
