import * as THREE from 'three';

// The hall's red runner glints while the couple stands on it: a warm sheen pulses through the
// fabric and little stars spray up from their feet as they walk.
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

// rug: the runner mesh. The rect is its footprint on the floor.
export function createRugGlint(scene, rug, { x = 0, z = -19, halfW = 1.1, halfD = 18 } = {}) {
  const tex = starTexture();
  const rugMat = rug.material;
  const sparks = [];
  for (let i = 0; i < POOL; i++) {
    const mat = new THREE.SpriteMaterial({
      map: tex,
      color: '#ffffff',
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.visible = false;
    scene.add(sprite);
    sparks.push({ sprite, life: 0, max: 1, size: 0.2, x: 0, y: 0, z: 0, vy: 0, ph: 0 });
  }
  let level = 0; // 0 off the rug, 1 standing on it
  let acc = 0;
  let next = 0;
  let prev = null;

  function inside(p) {
    return Math.abs(p.x - x) < halfW && Math.abs(p.z - z) < halfD;
  }

  function spawn(p, walking) {
    // find a free spark, round-robin so the pool is reused evenly
    for (let i = 0; i < POOL; i++) {
      const s = sparks[(next + i) % POOL];
      if (s.life > 0) continue;
      next = (next + i + 1) % POOL;
      const r = Math.random;
      s.max = 0.7 + r() * 0.6;
      s.life = s.max;
      s.size = 0.1 + r() * 0.2;
      s.x = p.x + (r() - 0.5) * 0.9;
      s.z = p.z + (r() - 0.5) * 0.7;
      s.y = 0.1 + r() * 0.3;
      s.vy = walking ? 0.6 + r() * 0.9 : 0.2 + r() * 0.3;
      s.ph = r() * Math.PI * 2;
      s.sprite.material.color.set(COLORS[Math.floor(r() * COLORS.length)]);
      s.sprite.visible = true;
      return;
    }
  }

  function update(dt, t, pos, moving) {
    const on = inside(pos) ? 1 : 0;
    level += (on - level) * Math.min(1, dt * 3);
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
      spawn(pos, walking);
    }

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
    tex.dispose();
  }

  return { update, dispose };
}
