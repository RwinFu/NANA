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

// Strands are drawn again one tile away on each side, so the edges match when the texture repeats
function drawStrand(g, x, y, len, bend, width) {
  g.beginPath();
  g.moveTo(x, y);
  g.quadraticCurveTo(x + bend * 0.5, y + len * 0.5, x + bend, y + len);
  g.lineWidth = width;
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
  for (let i = 0; i < 1600; i += 1) {
    const x = r() * SIZE;
    const y = r() * SIZE;
    const len = 6 + r() * 11;
    const bend = (r() - 0.5) * 4;
    const width = 1.1 + r() * 1.3;
    const lum = Math.round(85 + r() * 170);
    g.strokeStyle = `rgb(${lum},${lum},${lum})`;
    for (const dx of [-SIZE, 0, SIZE]) {
      for (const dy of [-SIZE, 0, SIZE]) {
        drawStrand(g, x + dx, y + dy, len, bend, width);
      }
    }
  }
  return c;
}

// Sobel filter: the slope of the height field becomes a surface normal (OpenGL convention, +Y up)
export function normalCanvas(heightC, strength) {
  const src = heightC.getContext('2d').getImageData(0, 0, SIZE, SIZE).data;
  const h = new Float32Array(SIZE * SIZE);
  for (let i = 0; i < h.length; i += 1) h[i] = src[i * 4] / 255;
  const at = (x, y) => h[((y + SIZE) % SIZE) * SIZE + ((x + SIZE) % SIZE)];

  const c = document.createElement('canvas');
  c.width = SIZE;
  c.height = SIZE;
  const g = c.getContext('2d');
  const out = g.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const dX = at(x + 1, y) - at(x - 1, y);
      // image rows run down while the texture's V runs up (flipY), so the Y slope is flipped
      const dY = at(x, y + 1) - at(x, y - 1);
      let nx = -dX * strength;
      let ny = dY * strength;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      nz /= len;
      const k = (y * SIZE + x) * 4;
      out.data[k] = Math.round((nx * 0.5 + 0.5) * 255);
      out.data[k + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      out.data[k + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      out.data[k + 3] = 255;
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
