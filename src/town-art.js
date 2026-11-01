import * as THREE from 'three';

// Colour maps for the town: cut stone, roof tiles and cobbles, drawn on canvases so the town needs
// no image files. Each returns a canvas; `town.js` keeps one texture per tone and repeats it per
// house, so a whole street of buildings shares a handful of textures.
//
// They are deliberately low contrast: the town is lit by lamps and moonlight, and a busy map would
// fight the glowing windows.

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

function canvasOf(size) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  return { canvas, ctx: canvas.getContext('2d') };
}

// A block's face: a flat tone, a light top edge, a dark bottom edge, a little grain.
function block(ctx, x, y, w, h, tone, rand) {
  ctx.fillStyle = `rgb(${tone},${tone},${tone + 4})`;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(x, y, w, 2);
  ctx.fillRect(x, y, 2, h);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(x, y + h - 2, w, 2);
  ctx.fillRect(x + w - 2, y, 2, h);
  for (let k = 0; k < 5; k += 1) {
    ctx.fillStyle = rand() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(x + 3 + rand() * (w - 8), y + 3 + rand() * (h - 8), 2 + rand() * 6, 1 + rand() * 2);
  }
}

// Ashlar: staggered courses of cut stone, with mortar lines and a little weathering. The result is
// greyscale-on-tone, so one map works for every stone colour the town uses.
export function stoneCanvas({ seed = 1, size = 256, rows = 6, tone = 150 } = {}) {
  const rand = rng(seed);
  const { canvas, ctx } = canvasOf(size);
  ctx.fillStyle = `rgb(${tone - 62},${tone - 64},${tone - 58})`; // mortar, in shadow
  ctx.fillRect(0, 0, size, size);
  const rowH = size / rows;
  for (let r = 0; r < rows; r += 1) {
    const y = r * rowH;
    let x = (r % 2) * -(size / 8);
    while (x < size) {
      const w = (size / 3.2) * (0.75 + rand() * 0.6);
      const shade = tone - 14 + Math.floor(rand() * 28);
      block(ctx, x + 2, y + 2, w - 4, rowH - 4, shade, rand);
      x += w;
    }
  }
  // a few darker streaks running down the stones, like rain stains
  for (let k = 0; k < 6; k += 1) {
    const x = rand() * size;
    const g = ctx.createLinearGradient(x, 0, x, size);
    g.addColorStop(0, 'rgba(20,14,24,0.12)');
    g.addColorStop(1, 'rgba(20,14,24,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, 3 + rand() * 10, size);
  }
  return canvas;
}

// Roof tiles: overlapping rows, each tile catching a little moonlight on its lower lip.
export function roofCanvas({ seed = 2, size = 256, rows = 8, tone = 120 } = {}) {
  const rand = rng(seed);
  const { canvas, ctx } = canvasOf(size);
  ctx.fillStyle = `rgb(${tone - 40},${tone - 46},${tone - 38})`;
  ctx.fillRect(0, 0, size, size);
  const rowH = size / rows;
  const tileW = size / 8;
  for (let r = 0; r < rows; r += 1) {
    const y = r * rowH;
    const offset = (r % 2) * tileW * 0.5;
    for (let x = -tileW; x < size + tileW; x += tileW) {
      const shade = tone - 10 + Math.floor(rand() * 24);
      ctx.fillStyle = `rgb(${shade},${shade - 6},${shade + 2})`;
      ctx.beginPath();
      ctx.moveTo(x + offset, y);
      ctx.lineTo(x + offset + tileW - 2, y);
      ctx.lineTo(x + offset + tileW - 2, y + rowH - 3);
      ctx.quadraticCurveTo(x + offset + tileW / 2, y + rowH + 3, x + offset, y + rowH - 3);
      ctx.closePath();
      ctx.fill();
      // the lip of the tile above catches the light
      ctx.strokeStyle = 'rgba(255,235,220,0.2)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + offset + 1, y + rowH - 4);
      ctx.quadraticCurveTo(x + offset + tileW / 2, y + rowH + 1, x + offset + tileW - 3, y + rowH - 4);
      ctx.stroke();
    }
  }
  return canvas;
}

// Cobbles for the lane: flat, irregular setts packed tight, with fine dark joints. Real paving
// stones are blocks, not pebbles, so each one is a rounded rectangle with its own tilt.
export function cobbleCanvas({ seed = 3, size = 512, tone = 132 } = {}) {
  const rand = rng(seed);
  const { canvas, ctx } = canvasOf(size);
  // the joint: dark, but not black, so the lane does not read as a grid
  ctx.fillStyle = `rgb(${tone - 74},${tone - 76},${tone - 68})`;
  ctx.fillRect(0, 0, size, size);
  const cols = 9;
  const rows = 14;
  const cw = size / cols;
  const ch = size / rows;
  const corner = (x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };
  for (let r = 0; r < rows; r += 1) {
    let x = (r % 2) * -cw * 0.35;
    while (x < size) {
      const w = cw * (0.82 + rand() * 0.3);
      const h = ch * (0.88 + rand() * 0.1);
      const jx = (rand() - 0.5) * 2.2;
      const jy = (rand() - 0.5) * 1.6;
      const shade = tone - 12 + Math.floor(rand() * 26);
      ctx.fillStyle = `rgb(${shade},${shade - 3},${shade + 6})`;
      corner(x + 1.6 + jx, r * ch + 1.4 + jy, w - 3.2, h - 2.8, 3.2);
      ctx.fill();
      // a worn, lighter top edge, and a shadow where the next stone overlaps
      ctx.strokeStyle = 'rgba(255,244,236,0.13)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x + 4 + jx, r * ch + 3 + jy);
      ctx.lineTo(x + w - 4 + jx, r * ch + 3 + jy);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.moveTo(x + 4 + jx, r * ch + h - 2.6 + jy);
      ctx.lineTo(x + w - 4 + jx, r * ch + h - 2.6 + jy);
      ctx.stroke();
      // a little grain on the face
      for (let k = 0; k < 3; k += 1) {
        ctx.fillStyle = rand() < 0.5 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.06)';
        ctx.fillRect(x + 3 + rand() * (w - 8), r * ch + 3 + rand() * (h - 8), 2 + rand() * 5, 1 + rand() * 2);
      }
      x += w;
    }
  }
  return canvas;
}

// Wraps a canvas as a repeating colour texture in sRGB.
export function toTexture(canvas, repeatX = 1, repeatY = 1) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  return tex;
}
