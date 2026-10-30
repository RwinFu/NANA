// Normal maps for the princess and the boy: the weave of her satin dress, the strands of her hair,
// the knit of his coat, and the curl of his hair. Each map is a height field (brighter = higher)
// turned into surface directions by the same Sobel filter used for the cats' fur (see fur.js).
// Every map is made once and shared; the repeat sets how many times the pattern covers a surface.
import * as THREE from 'three';
import { normalCanvas } from './fur.js';

const SIZE = 256;

// A seeded random generator, so every page load shows the same weave
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas() {
  const c = document.createElement('canvas');
  c.width = SIZE;
  c.height = SIZE;
  const g = c.getContext('2d');
  return { c, g };
}

// Satin: a jacquard of small raised diamonds on fine warp threads
function satinHeight() {
  const { c, g } = canvas();
  g.fillStyle = '#303030';
  g.fillRect(0, 0, SIZE, SIZE);
  const cell = 32;
  for (let y = 0; y < SIZE; y += cell) {
    for (let x = 0; x < SIZE; x += cell) {
      const cx = x + cell / 2;
      const cy = y + cell / 2;
      const r = cell * 0.42;
      g.fillStyle = '#c8c8c8';
      g.beginPath();
      g.moveTo(cx, cy - r);
      g.lineTo(cx + r, cy);
      g.lineTo(cx, cy + r);
      g.lineTo(cx - r, cy);
      g.closePath();
      g.fill();
    }
  }
  // fine threads running down the fabric
  for (let x = 0; x < SIZE; x += 2) {
    g.fillStyle = `rgba(255,255,255,${(0.05 + 0.06 * Math.abs(Math.sin(x * 0.7))).toFixed(3)})`;
    g.fillRect(x, 0, 1, SIZE);
  }
  return c;
}

// Hair: long strands that run from the crown down the hair
function strandHeight(r) {
  const { c, g } = canvas();
  g.fillStyle = '#404040';
  g.fillRect(0, 0, SIZE, SIZE);
  for (let i = 0; i < 260; i += 1) {
    const x = r() * SIZE;
    const lum = Math.round(90 + r() * 165);
    g.strokeStyle = `rgb(${lum},${lum},${lum})`;
    g.lineWidth = 0.8 + r() * 1.6;
    const wob = (r() - 0.5) * 6;
    g.beginPath();
    g.moveTo(x, 0);
    g.bezierCurveTo(x + wob, SIZE * 0.33, x - wob, SIZE * 0.66, x, SIZE);
    g.stroke();
  }
  return c;
}

// Knit: rows of small V stitches, as in a wool coat
function knitHeight() {
  const { c, g } = canvas();
  g.fillStyle = '#2a2a2a';
  g.fillRect(0, 0, SIZE, SIZE);
  const cell = 16;
  for (let y = 0; y < SIZE; y += cell) {
    for (let x = 0; x < SIZE; x += cell) {
      g.strokeStyle = '#d0d0d0';
      g.lineWidth = 4;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x + 2, y + 3);
      g.lineTo(x + cell / 2, y + cell - 3);
      g.lineTo(x + cell - 2, y + 3);
      g.stroke();
    }
  }
  return c;
}

// Curls: a dome with concentric rings, fading to flat at the edge so it tiles
function curlHeight() {
  const { c, g } = canvas();
  const img = g.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const dx = x / SIZE - 0.5;
      const dy = y / SIZE - 0.5;
      const d = Math.hypot(dx, dy);
      const rings = 0.5 + 0.5 * Math.cos(d * Math.PI * 2 * 4);
      const edge = Math.min(1, Math.max(0, (0.5 - d) / 0.15));
      const v = Math.round(rings * edge * 255);
      const k = (y * SIZE + x) * 4;
      img.data[k] = v;
      img.data[k + 1] = v;
      img.data[k + 2] = v;
      img.data[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

const KINDS = {
  satin: { height: () => satinHeight(), strength: 2.2 },
  strands: { height: () => strandHeight(rng(5)), strength: 2.4 },
  knit: { height: () => knitHeight(), strength: 3.2 },
  curl: { height: () => curlHeight(), strength: 2.8 },
};

const cache = new Map();

// A normal map of the given kind, repeated `repeat` times across the surface
export function surfaceNormal(kind, repeat = 1) {
  const key = `${kind}:${repeat}`;
  if (cache.has(key)) return cache.get(key);
  const spec = KINDS[kind];
  const tex = new THREE.CanvasTexture(normalCanvas(spec.height(), spec.strength));
  tex.colorSpace = THREE.NoColorSpace; // a normal map is data, not colour
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 4;
  cache.set(key, tex);
  return tex;
}
