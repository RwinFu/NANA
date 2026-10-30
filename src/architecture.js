// Normal maps for the castle: the cut-stone walls and the entrance door.
// Each map starts from a height field (brighter = higher), turned into surface directions by the
// same Sobel filter used for the cats' fur (see fur.js).
//   stone: ashlar blocks with bevelled edges, chisel grain, a few chips, and a small carved heart
//          on every fifth block. Its block layout uses the same seed and order as the castle's
//          colour stone, so the joints line up with the colour map.
//   door:  pink lacquer with quilted grooves and a lattice of raised hearts.
import * as THREE from 'three';
import { normalCanvas } from './fur.js';

const SIZE = 256;

// The same seeded generator as the castle's stone, so the block widths match
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

function canvas() {
  const c = document.createElement('canvas');
  c.width = SIZE;
  c.height = SIZE;
  return { c, g: c.getContext('2d') };
}

// A heart outline centred at (cx, cy), `s` pixels from tip to lobe, as a path
function heartPath(g, cx, cy, s) {
  g.beginPath();
  for (let i = 0; i <= 60; i += 1) {
    const t = (i / 60) * Math.PI * 2;
    const hx = 16 * Math.sin(t) ** 3;
    const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    const x = cx + (hx * s) / 16;
    const y = cy - (hy * s) / 16;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
}

// Blurs a height canvas a little, so slopes are soft and do not alias
function soften(src, px) {
  const { c, g } = canvas();
  g.filter = `blur(${px}px)`;
  g.drawImage(src, 0, 0);
  g.filter = 'none';
  return c;
}

function stoneHeight() {
  const { c, g } = canvas();
  const rand = seeded(7);
  const detail = seeded(99);
  g.fillStyle = '#3a3a3a'; // the mortar sits low
  g.fillRect(0, 0, SIZE, SIZE);
  const rows = 8;
  const rowH = SIZE / rows;
  let index = 0;
  for (let r = 0; r < rows; r += 1) {
    const y = r * rowH;
    let x = (r % 2) * -(SIZE / 8);
    while (x < SIZE) {
      const w = (SIZE / 4) * (0.8 + rand() * 0.5);
      rand(); // the colour map's tone, drawn here too so the layout stays in step
      const bx = x + 3;
      const by = y + 3;
      const bw = w - 6;
      const bh = rowH - 6;
      const level = 196 + Math.floor(detail() * 30);
      g.fillStyle = `rgb(${level},${level},${level})`;
      g.fillRect(bx, by, bw, bh);
      // bevel: bright on the top and left edges, dark on the bottom and right
      g.fillStyle = 'rgb(255,255,255)';
      g.fillRect(bx, by, bw, 3);
      g.fillRect(bx, by, 3, bh);
      g.fillStyle = 'rgb(70,70,70)';
      g.fillRect(bx, by + bh - 3, bw, 3);
      g.fillRect(bx + bw - 3, by, 3, bh);
      // chisel grain: short diagonal strokes across the face
      for (let k = 0; k < 12; k += 1) {
        const sx = bx + 4 + detail() * (bw - 8);
        const sy = by + 4 + detail() * (bh - 8);
        g.strokeStyle = detail() < 0.5 ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)';
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(sx, sy);
        g.lineTo(sx + 6 + detail() * 6, sy + 2);
        g.stroke();
      }
      // a few chips near the edges
      for (let k = 0; k < 2; k += 1) {
        g.fillStyle = 'rgb(120,120,120)';
        g.beginPath();
        g.ellipse(bx + 3 + detail() * (bw - 6), by + 3 + detail() * (bh - 6), 2 + detail() * 2, 1.5, 0, 0, Math.PI * 2);
        g.fill();
      }
      // a carved heart on every fifth block: raised, so it catches the light
      if (index % 5 === 2) {
        g.fillStyle = 'rgb(255,255,255)';
        heartPath(g, bx + bw / 2, by + bh / 2, 10);
        g.fill();
      }
      index += 1;
      x += w;
    }
  }
  return soften(c, 0.8);
}

function doorHeight() {
  const { c, g } = canvas();
  g.fillStyle = 'rgb(128,128,128)';
  g.fillRect(0, 0, SIZE, SIZE);
  // Puffy quilted cushions on a 4 x 4 grid (cell 64 px, so the tile repeats cleanly).
  // Every cell is a round, rounded-up cushion. The checkerboard cells carry a raised heart.
  for (let j = 0; j < 4; j += 1) {
    for (let i = 0; i < 4; i += 1) {
      const cx = 32 + i * 64;
      const cy = 32 + j * 64;
      const grad = g.createRadialGradient(cx, cy, 0, cx, cy, 29);
      grad.addColorStop(0, 'rgb(255,255,255)');
      grad.addColorStop(0.55, 'rgb(226,226,226)');
      grad.addColorStop(0.86, 'rgb(150,150,150)');
      grad.addColorStop(1, 'rgb(128,128,128)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(cx, cy, 29, 0, Math.PI * 2);
      g.fill();
    }
  }
  // Raised hearts on the checkerboard cells, drawn with wrap-around so the tile stays seamless
  g.fillStyle = 'rgb(252,252,252)';
  for (let j = 0; j < 4; j += 1) {
    for (let i = 0; i < 4; i += 1) {
      if ((i + j) % 2 !== 0) continue;
      const cx = 32 + i * 64;
      const cy = 32 + j * 64;
      [-SIZE, 0, SIZE].forEach((dx) => [-SIZE, 0, SIZE].forEach((dy) => {
        heartPath(g, cx + dx, cy + dy + 2, 11);
        g.fill();
      }));
    }
  }
  return soften(c, 1);
}

// Gilt: rows of small raised beads, the engraved edge of gold mouldings (4 beads a tile)
function giltHeight() {
  const { c, g } = canvas();
  g.fillStyle = 'rgb(60,60,60)';
  g.fillRect(0, 0, SIZE, SIZE);
  for (let j = 0; j < 4; j += 1) {
    for (let i = 0; i < 4; i += 1) {
      const cx = 32 + i * 64 + (j % 2) * 32;
      const cy = 32 + j * 64;
      const grad = g.createRadialGradient(cx, cy, 2, cx, cy, 24);
      grad.addColorStop(0, 'rgb(255,255,255)');
      grad.addColorStop(0.7, 'rgb(180,180,180)');
      grad.addColorStop(1, 'rgb(60,60,60)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(cx, cy, 24, 0, Math.PI * 2);
      g.fill();
    }
  }
  return soften(c, 0.8);
}

// Candy stripes: diagonal raised bands, for the pink mouldings and the door jambs
function ribbonHeight() {
  const { c, g } = canvas();
  const img = g.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const v = Math.round((0.5 + 0.5 * Math.cos((2 * Math.PI * (x + y)) / 64)) * 255);
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

// Leaded glass: a diamond lattice. The lead lines are raised (height) and dark (colour).
// Lines run along x+y and x-y in steps of 128, so the 256 tile repeats cleanly.
function latticeLines(g, colour, width) {
  g.strokeStyle = colour;
  g.lineWidth = width;
  for (let k = -2; k <= 2; k += 1) {
    g.beginPath();
    g.moveTo(-SIZE, -SIZE + k * 128);
    g.lineTo(2 * SIZE, 2 * SIZE + k * 128);
    g.stroke();
  }
  for (let k = 0; k <= 4; k += 1) {
    g.beginPath();
    g.moveTo(-SIZE, SIZE + k * 128);
    g.lineTo(2 * SIZE, -2 * SIZE + k * 128);
    g.stroke();
  }
}

function leadHeight() {
  const { c, g } = canvas();
  g.fillStyle = 'rgb(110,110,110)';
  g.fillRect(0, 0, SIZE, SIZE);
  latticeLines(g, 'rgb(255,255,255)', 7);
  return soften(c, 1);
}

function leadColour() {
  const { c, g } = canvas();
  g.fillStyle = 'rgb(255,255,255)';
  g.fillRect(0, 0, SIZE, SIZE);
  latticeLines(g, 'rgb(50,40,40)', 7);
  return c;
}

const glassCache = new Map();

// The leaded glass of the windows: a normal map for the raised lead, and an emissive map that keeps
// the lead lines dark while the glass glows
export function leadedGlass(repeatX = 2, repeatY = 3) {
  const id = `${repeatX}x${repeatY}`;
  if (glassCache.has(id)) return glassCache.get(id);
  const normalMap = cachedNormal('lead', leadHeight, 2.2, repeatX, repeatY);
  const colour = new THREE.CanvasTexture(leadColour());
  colour.colorSpace = THREE.SRGBColorSpace;
  colour.wrapS = THREE.RepeatWrapping;
  colour.wrapT = THREE.RepeatWrapping;
  colour.repeat.set(repeatX, repeatY);
  colour.anisotropy = 8;
  const result = { normalMap, emissiveMap: colour };
  glassCache.set(id, result);
  return result;
}

// Heart-lead glass for the door windows: raised lead outlines of small hearts on the glass
function heartLeadHeight() {
  const { c, g } = canvas();
  g.fillStyle = 'rgb(110,110,110)';
  g.fillRect(0, 0, SIZE, SIZE);
  g.strokeStyle = 'rgb(255,255,255)';
  g.lineWidth = 6;
  [64, 192].forEach((cx) => [64, 192].forEach((cy) => {
    heartPath(g, cx, cy, 22);
    g.stroke();
  }));
  return soften(c, 1);
}

function heartLeadColour() {
  const { c, g } = canvas();
  g.fillStyle = 'rgb(255,255,255)';
  g.fillRect(0, 0, SIZE, SIZE);
  g.strokeStyle = 'rgb(120,60,90)';
  g.lineWidth = 6;
  [64, 192].forEach((cx) => [64, 192].forEach((cy) => {
    heartPath(g, cx, cy, 22);
    g.stroke();
  }));
  return c;
}

const heartGlassCache = new Map();

export function heartGlass(repeatX = 3, repeatY = 3) {
  const id = `${repeatX}x${repeatY}`;
  if (heartGlassCache.has(id)) return heartGlassCache.get(id);
  const normalMap = cachedNormal('heartlead', heartLeadHeight, 3.4, repeatX, repeatY);
  const colour = new THREE.CanvasTexture(heartLeadColour());
  colour.colorSpace = THREE.SRGBColorSpace;
  colour.wrapS = THREE.RepeatWrapping;
  colour.wrapT = THREE.RepeatWrapping;
  colour.repeat.set(repeatX, repeatY);
  colour.anisotropy = 8;
  const result = { normalMap, emissiveMap: colour };
  heartGlassCache.set(id, result);
  return result;
}

const cache = new Map();

// A tiling normal map from a height field, cached by kind and repeat
function cachedNormal(key, height, strength, repeatX, repeatY) {
  const id = `${key}:${repeatX}x${repeatY}`;
  if (cache.has(id)) return cache.get(id);
  const tex = new THREE.CanvasTexture(normalCanvas(height(), strength));
  tex.colorSpace = THREE.NoColorSpace; // a normal map is data, not colour
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 8;
  cache.set(id, tex);
  return tex;
}

// The cut-stone normal map, repeated as the castle's colour stone is
export function stoneNormal(repeatX = 5, repeatY = 4) {
  return cachedNormal('stone', stoneHeight, 2.6, repeatX, repeatY);
}

// The door's quilted pink lacquer, repeated over the leaf in world metres
export function doorNormal(repeatX = 2, repeatY = 2) {
  return cachedNormal('door', doorHeight, 3.6, repeatX, repeatY);
}

// Engraved gilt beads, for the gold mouldings, arches and door trim
export function giltNormal(repeatX = 4, repeatY = 1) {
  return cachedNormal('gilt', giltHeight, 2.4, repeatX, repeatY);
}

// Candy stripes, for the pink mouldings and the door jambs
export function ribbonNormal(repeatX = 8, repeatY = 1) {
  return cachedNormal('ribbon', ribbonHeight, 1.8, repeatX, repeatY);
}
