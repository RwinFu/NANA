import * as THREE from 'three';
import { normalCanvas } from './fur.js';

// Seamless procedural height fields keep the outdoor relief subtle and lightweight.
const cache = new Map();
export function outdoorNormal(kind, repeatX = 1, repeatY = 1) {
  const key = `${kind}:${repeatX}:${repeatY}`;
  if (cache.has(key)) return cache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(256, 256);
  for (let y = 0; y < 256; y += 1) {
    for (let x = 0; x < 256; x += 1) {
      const u = x * Math.PI * 2 / 256;
      const v = y * Math.PI * 2 / 256;
      let h;
      if (kind === 'bark') {
        h = 128 + 35 * Math.sin(14 * u + Math.sin(2 * v) * 0.8) + 13 * Math.sin(27 * u + 3 * v);
      } else if (kind === 'water') {
        h = 128 + 20 * Math.sin(4 * u + 3 * v) + 16 * Math.sin(7 * u - 5 * v);
      } else {
        h = 128 + 15 * Math.sin(5 * u + 2 * v) * Math.sin(4 * v - u) + 7 * Math.sin(17 * u + 13 * v);
      }
      const i = (y * 256 + x) * 4;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = Math.max(0, Math.min(255, h));
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(normalCanvas(canvas, kind === 'bark' ? 1.8 : 1.3));
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  cache.set(key, texture);
  return texture;
}
