// The princess's dress, in more detail: a pleated bell skirt with a flower embroidery, three lace
// ruffles, rows of small crystals, a pearl hem, and a front bodice with lacing, buttons, a pearl
// necklace and a small bow. Everything is shape or colour detail; nothing here carries text.
import * as THREE from 'three';
import { physMat, place } from './charmats.js';

const SKIRT_H = 1.1; // height of the skirt (its own space, before the body scale)
const PLEATS = 30; // how many folds run around the skirt
const LATHE_SEGS = 168;

// Radius of the skirt at height y: a bell, wide at the hem and narrow at the waist
export function skirtR(y) {
  if (y <= 0.55) return 0.72 + (0.58 - 0.72) * (y / 0.55);
  if (y <= 0.98) return 0.58 + (0.38 - 0.58) * ((y - 0.55) / 0.43);
  return 0.38 + (0.3 - 0.38) * Math.min(1, (y - 0.98) / 0.12);
}

// Folds are deeper toward the hem, where the fabric hangs loose
const foldAmt = (y) => 0.012 + 0.03 * (1 - y / SKIRT_H);
// Scale of the radius at angle theta (around the skirt) and height y: 1 is smooth, above and below is a fold
export function pleat(theta, y) {
  return 1 + foldAmt(y) * Math.cos(theta * PLEATS);
}

// Profile of the skirt for a lathe: a flat hem disc, then the bell from the hem up to the waist
function skirtProfile() {
  const pts = [new THREE.Vector2(0, 0), new THREE.Vector2(0.72, 0)];
  const N = 42;
  for (let i = 1; i <= N; i += 1) {
    const y = (i / N) * SKIRT_H;
    pts.push(new THREE.Vector2(skirtR(y), y));
  }
  return pts;
}

// Embroidery: a lattice of fine lines, with a small five-petal flower in each cell and a pearl dot
// at each crossing. It is drawn in greys, so the dress colour tints it. The tile repeats seamlessly.
let embroidery = null;
function embroideryMap() {
  if (embroidery) return embroidery;
  const S = 256;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#f0f0f0';
  g.fillRect(0, 0, S, S);
  // diagonal lattice lines; spacing 128 so the pattern repeats every 256
  g.strokeStyle = '#d3d3d3';
  g.lineWidth = 2;
  // lines y = x + c (slope +1) and y = -x + c (slope -1), with c in steps of 128 covering the tile
  for (let k = -2; k <= 2; k += 1) {
    g.beginPath();
    g.moveTo(-S, -S + k * 128);
    g.lineTo(2 * S, 2 * S + k * 128);
    g.stroke();
  }
  for (let k = 0; k <= 4; k += 1) {
    g.beginPath();
    g.moveTo(-S, S + k * 128);
    g.lineTo(2 * S, -2 * S + k * 128);
    g.stroke();
  }
  // pearl dots at the crossings inside the tile
  g.fillStyle = '#e2e2e2';
  for (let cx = 0; cx <= S; cx += 64) {
    for (let cy = 0; cy <= S; cy += 64) {
      if ((cx / 64 + cy / 64) % 2 === 0) {
        g.beginPath();
        g.arc(cx, cy, 2.6, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  // flowers, one in each cell between the lattice dots
  [[128, 64], [64, 128], [192, 128], [128, 192]].forEach(([fx, fy]) => {
    for (let p = 0; p < 5; p += 1) {
      const a = (p / 5) * Math.PI * 2 - Math.PI / 2;
      g.save();
      g.translate(fx + Math.cos(a) * 8, fy + Math.sin(a) * 8);
      g.rotate(a);
      g.beginPath();
      g.ellipse(0, 0, 8, 5.2, 0, 0, Math.PI * 2);
      g.fillStyle = '#ffffff';
      g.fill();
      g.strokeStyle = '#c9c9c9';
      g.lineWidth = 1.1;
      g.stroke();
      g.restore();
    }
    g.beginPath();
    g.arc(fx, fy, 3.6, 0, Math.PI * 2);
    g.fillStyle = '#cfcfcf';
    g.fill();
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 3);
  tex.anisotropy = 4;
  embroidery = tex;
  return tex;
}

// The pleated skirt. Its vertices are pushed out and in around the circle, so it has folds, and
// it carries the embroidery as its colour map. Lace ruffles and crystals are children of it, so they
// move with the skirt.
export function createSkirt(dressMat, laceMat) {
  const geo = new THREE.LatheGeometry(skirtProfile(), LATHE_SEGS);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const f = pleat(Math.atan2(x, z), y);
    pos.setX(i, x * f);
    pos.setZ(i, z * f);
  }
  geo.computeVertexNormals();
  dressMat.map = embroideryMap();
  dressMat.needsUpdate = true;
  const skirt = new THREE.Mesh(geo, dressMat);

  // Three lace ruffles, each a wavy ring that follows the folds just outside the skirt
  [0.3, 0.62, 0.9].forEach((y) => {
    const pts = [];
    const N = 96;
    for (let k = 0; k < N; k += 1) {
      const th = (k / N) * Math.PI * 2;
      const r = skirtR(y) * pleat(th, y) + 0.03;
      pts.push(new THREE.Vector3(r * Math.sin(th), y, r * Math.cos(th)));
    }
    const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
    skirt.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 240, 0.013, 6, true), laceMat));
  });

  // Crystals in rows on the skirt, each tilted to match the skirt's slope
  const gemPink = physMat({ color: '#ff8fb3', roughness: 0.08, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.02, emissive: '#2a0b16' });
  const gemClear = physMat({ color: '#fff8fb', roughness: 0.05, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.02 });
  const gemGold = physMat({ color: '#ffe08a', roughness: 0.1, metalness: 0.8, clearcoat: 0.8, clearcoatRoughness: 0.05 });
  const gemGeo = new THREE.OctahedronGeometry(0.014, 0);
  const rows = [
    { y: 0.22, n: 18, mat: gemClear },
    { y: 0.46, n: 20, mat: gemPink },
    { y: 0.7, n: 20, mat: gemGold },
    { y: 0.95, n: 16, mat: gemClear },
  ];
  const up = new THREE.Vector3(0, 1, 0);
  const n = new THREE.Vector3();
  const q = new THREE.Quaternion();
  rows.forEach((row, ri) => {
    for (let k = 0; k < row.n; k += 1) {
      const th = ((k + (ri % 2) * 0.5) / row.n) * Math.PI * 2;
      const y = row.y;
      const r = skirtR(y) * pleat(th, y);
      // the skirt's outward normal at this height: the profile slope turned 90 degrees
      const dR = (skirtR(y + 0.01) - skirtR(y - 0.01)) / 0.02;
      const nr = 1;
      const ny = -dR;
      const len = Math.hypot(nr, ny);
      n.set((nr / len) * Math.sin(th), ny / len, (nr / len) * Math.cos(th));
      const gem = new THREE.Mesh(gemGeo, row.mat);
      gem.position.set(r * Math.sin(th), y, r * Math.cos(th)).addScaledVector(n, 0.004);
      q.setFromUnitVectors(up, n);
      gem.quaternion.copy(q);
      gem.scale.set(1, 1.3, 1);
      skirt.add(gem);
    }
  });
  return skirt;
}

// The front of the bodice: a pink satin panel, lacing and buttons in pearls, a pearl necklace on
// the neckline, a lace trim along the top edge, and a small bow at the waist.
// The bodice cylinder is 0.26 wide at the top and 0.31 at the bottom, squashed to 0.8 in depth.
export function addBodiceDetail(body, mats) {
  const topY = 1.655;
  const bottomY = 1.105;
  const radiusAt = (y) => 0.26 + 0.05 * ((topY - y) / (topY - bottomY));
  // the bodice front surface at height y and sideways offset x
  const frontAt = (x, y) => {
    const r = radiusAt(y);
    return 0.8 * Math.sqrt(Math.max(0, r * r - x * x)) + 0.006;
  };
  const pearl = mats.pearl;

  // lace trim along the top edge of the bodice
  const trim = place(new THREE.Mesh(new THREE.TorusGeometry(0.262, 0.011, 8, 56), mats.lace), body, 0, 1.652, 0);
  trim.rotation.x = Math.PI / 2;
  trim.scale.set(1, 0.8, 1);

  // pink satin panel down the front
  const panelY = 1.36;
  const panel = place(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.02), mats.satin), body, 0, panelY, frontAt(0, panelY) + 0.002);
  panel.rotation.x = -0.02;

  // pearl buttons down the centre, and eyelets on either side with pearls laced between them
  const pearlGeo = new THREE.SphereGeometry(0.0095, 10, 8);
  [1.2, 1.28, 1.36, 1.44, 1.52].forEach((y) => {
    place(new THREE.Mesh(pearlGeo, pearl), body, 0, y, frontAt(0, y) + 0.004);
  });
  [1.16, 1.24, 1.32, 1.4, 1.48, 1.56].forEach((y, i) => {
    const x = i % 2 === 0 ? -0.034 : 0.034;
    place(new THREE.Mesh(pearlGeo, pearl), body, x, y, frontAt(x, y) + 0.004);
  });

  // a pearl necklace resting on the neckline, a bead every step around the front
  const beadGeo = new THREE.SphereGeometry(0.0105, 10, 8);
  for (let k = -5; k <= 5; k += 1) {
    const a = k * 0.22;
    place(new THREE.Mesh(beadGeo, pearl), body, 0.2 * Math.sin(a), 1.672, 0.16 * Math.cos(a));
  }

  // a small bow at the waist, on the front
  const bowY = 1.19;
  const bowZ = frontAt(0, bowY) + 0.012;
  [-1, 1].forEach((side) => {
    const loop = place(new THREE.Mesh(new THREE.SphereGeometry(0.034, 12, 10), mats.satin), body, side * 0.04, bowY, bowZ);
    loop.scale.set(1, 0.7, 0.45);
    loop.rotation.z = side * 0.4;
  });
  place(new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), mats.satin), body, 0, bowY, bowZ + 0.004);
}

// Pearls along the hem of the petticoat's lace edge
export function addHemPearls(body, pearlMat) {
  const geo = new THREE.SphereGeometry(0.0105, 8, 6);
  const N = 56;
  for (let k = 0; k < N; k += 1) {
    const th = (k / N) * Math.PI * 2;
    const r = 0.72 + 0.006;
    place(new THREE.Mesh(geo, pearlMat), body, r * Math.sin(th), 0.13, r * Math.cos(th));
  }
}

// Materials used only by the dress details (the body keeps its own dress and skin materials)
export function dressMaterials() {
  return {
    satin: physMat({
      color: '#ff8fb8', roughness: 0.3, sheen: 0.8, sheenColor: new THREE.Color('#ffd0e2'), sheenRoughness: 0.4,
    }),
    lace: physMat({
      color: '#fff7fb', roughness: 0.6, sheen: 1, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.5,
    }),
    pearl: physMat({ color: '#fff6ee', roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
  };
}
