// Procedural fur for the home cats, with no image files.
//
// Three maps are made once and shared by every cat:
//   1. a height field: many short fur strands on a dark base (brighter = higher);
//   2. a normal map: the height field turned into surface directions with a Sobel filter,
//      so the strands catch the light even though the mesh is smooth;
//   3. a colour map: the coat colour with tabby stripes running along the body.
//
// Normal map basics (Three.js): the normal map holds data, not colour, so it stays in
// NoColorSpace; normalScale sets how strong the relief looks. The texture is tiled, so the
// strands and stripes repeat without a seam.
import * as THREE from 'three';

const SIZE = 256;

// A small seeded random generator, so every page load makes the same fur
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

// Strands are drawn again one tile away on each side, so the edges match when the texture repeats.
// All the strands of one length and width share a single path and a single stroke — 1600 strokes per
// tile used to be 14 400 canvas calls for the fur alone.
function drawStrandPath(g, strands) {
  g.beginPath();
  for (const { x, y, len, bend } of strands) {
    g.moveTo(x, y);
    g.quadraticCurveTo(x + bend * 0.5, y + len * 0.5, x + bend, y + len);
  }
  g.stroke();
}

function heightCanvas(r) {
  const c = document.createElement('canvas');
  c.width = SIZE;
  c.height = SIZE;
  const g = c.getContext('2d');
  g.fillStyle = '#3a3a3a';
  g.fillRect(0, 0, SIZE, SIZE);
  g.lineCap = 'round';
  // Strands are batched by (brightness, width): same picture, a fraction of the drawing calls.
  const batches = new Map();
  for (let i = 0; i < 1600; i += 1) {
    const x = r() * SIZE;
    const y = r() * SIZE;
    const len = 6 + r() * 11;
    const bend = (r() - 0.5) * 4;
    const width = 1.1 + r() * 1.3;
    const lum = Math.round(85 + r() * 170);
    const key = `${lum}:${width.toFixed(1)}`;
    if (!batches.has(key)) batches.set(key, { lum, width, strands: [] });
    const strands = batches.get(key).strands;
    for (const dx of [-SIZE, 0, SIZE]) {
      for (const dy of [-SIZE, 0, SIZE]) {
        strands.push({ x: x + dx, y: y + dy, len, bend });
      }
    }
  }
  for (const { lum, width, strands } of batches.values()) {
    g.strokeStyle = `rgb(${lum},${lum},${lum})`;
    g.lineWidth = width;
    drawStrandPath(g, strands);
  }
  return c;
}

// Sobel filter: the slope of the height field becomes a surface normal (OpenGL convention, +Y up).
//
// This is one of the most expensive things in the start-up: every stone, bark, velvet and fur surface
// asks for one, and each is 65 536 pixels. Two changes make it quicker without touching what it
// produces: the neighbours are read by index (the old version called a modulo closure four times per
// pixel) and the length uses Math.sqrt instead of the three-argument Math.hypot, which is variadic and
// guarded against overflow. tests/fur-normal.test.js compares this with the original, pixel for pixel.
export function normalCanvas(heightC, strength) {
  const src = heightC.getContext('2d').getImageData(0, 0, SIZE, SIZE).data;
  const h = new Float32Array(SIZE * SIZE);
  for (let i = 0; i < h.length; i += 1) h[i] = src[i * 4] / 255;

  const c = document.createElement('canvas');
  c.width = SIZE;
  c.height = SIZE;
  const g = c.getContext('2d');
  const out = g.createImageData(SIZE, SIZE);
  const px = out.data;

  for (let y = 0; y < SIZE; y += 1) {
    const up = (y === 0 ? SIZE - 1 : y - 1) * SIZE;
    const row = y * SIZE;
    const down = (y === SIZE - 1 ? 0 : y + 1) * SIZE;
    for (let x = 0; x < SIZE; x += 1) {
      const xr = x === SIZE - 1 ? 0 : x + 1;
      const xl = x === 0 ? SIZE - 1 : x - 1;
      const dX = h[row + xr] - h[row + xl];
      // image rows run down while the texture's V runs up (flipY), so the Y slope is flipped
      const dY = h[down + x] - h[up + x];
      const nx = -dX * strength;
      const ny = dY * strength;
      const len = Math.sqrt(nx * nx + ny * ny + 1);
      const k = (row + x) * 4;
      px[k] = Math.round(((nx / len) * 0.5 + 0.5) * 255);
      px[k + 1] = Math.round(((ny / len) * 0.5 + 0.5) * 255);
      px[k + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255);
      px[k + 3] = 255;
    }
  }
  g.putImageData(out, 0, 0);
  return c;
}

// The coat: a base colour, tabby bands that run along the body, and a few darker mottles
function colourCanvas(base, stripe, r) {
  const c = document.createElement('canvas');
  c.width = SIZE;
  c.height = SIZE;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, SIZE, SIZE);
  // four bands around the body, each wavy and a little narrower at its ends
  g.fillStyle = stripe;
  for (let k = 0; k < 4; k += 1) {
    const x0 = k * (SIZE / 4) + 18;
    g.beginPath();
    for (let y = 0; y <= SIZE; y += 4) {
      g.lineTo(x0 + Math.sin(y * 0.03 + k * 1.3) * 3, y);
    }
    for (let y = SIZE; y >= 0; y -= 4) {
      const w = 13 + Math.sin(y * 0.09 + k) * 3;
      g.lineTo(x0 + w + Math.sin(y * 0.03 + k * 1.3) * 3, y);
    }
    g.closePath();
    g.fill();
  }
  // mottles: soft darker dots, so the coat is not flat
  for (let i = 0; i < 120; i += 1) {
    g.globalAlpha = 0.12 + r() * 0.12;
    g.fillStyle = stripe;
    g.beginPath();
    g.arc(r() * SIZE, r() * SIZE, 1.5 + r() * 3, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  return c;
}

function repeatTexture(tex) {
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

// Build the shared normal map once, and a colour map for each coat
let shared = null;

export function furMaps(base, stripe) {
  if (!shared) {
    const r = rng(7);
    const height = heightCanvas(r);
    const normal = new THREE.CanvasTexture(normalCanvas(height, 2.4));
    normal.colorSpace = THREE.NoColorSpace; // data, not colour
    shared = { normal: repeatTexture(normal) };
  }
  const colour = new THREE.CanvasTexture(colourCanvas(base, stripe, rng(base.length * 31 + stripe.length)));
  colour.colorSpace = THREE.SRGBColorSpace;
  return { map: repeatTexture(colour), normal: shared.normal };
}
