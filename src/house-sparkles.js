import * as THREE from 'three';
import { LAYOUT } from './world.js';

// A tiny, reusable pool of warm firefly-like glints, separate from the heart trail.
export function createHouseSparkles(scene) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const glow = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  glow.addColorStop(0, 'rgba(255,255,240,1)');
  glow.addColorStop(0.25, 'rgba(255,219,170,.8)');
  glow.addColorStop(1, 'rgba(255,170,200,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 32, 32);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const pool = Array.from({ length: 24 }, () => {
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const sprite = new THREE.Sprite(material);
    sprite.visible = false;
    scene.add(sprite);
    return { sprite, life: 0, driftX: 0, driftZ: 0 };
  });
  let cursor = 0;
  let timer = 0;
  const lifetime = 2.2;

  function update(dt, position, moving) {
    const inHall = Math.abs(position.x) < LAYOUT.hallHalfWidth && position.z < 0 && position.z > -LAYOUT.hallLength;
    timer -= dt;
    if (moving && inHall && timer <= 0) {
      timer = 0.18;
      const p = pool[cursor];
      cursor = (cursor + 1) % pool.length;
      p.life = lifetime;
      p.driftX = (Math.random() - 0.5) * 0.22;
      p.driftZ = (Math.random() - 0.5) * 0.22;
      p.sprite.position.set(position.x + (Math.random() - 0.5) * 1.5, 0.3 + Math.random() * 1.3, position.z + (Math.random() - 0.5) * 1.2);
      p.sprite.scale.setScalar(0.12 + Math.random() * 0.12);
      p.sprite.visible = true;
    }
    for (const p of pool) {
      if (p.life <= 0) continue;
      p.life = Math.max(0, p.life - dt);
      p.sprite.visible = p.life > 0;
      p.sprite.position.x += p.driftX * dt;
      p.sprite.position.z += p.driftZ * dt;
      p.sprite.position.y += 0.18 * dt;
      p.sprite.material.opacity = Math.sin((1 - p.life / lifetime) * Math.PI) * 0.6;
    }
  }
  return { update };
}
