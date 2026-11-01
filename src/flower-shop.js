import * as THREE from 'three';
import { surfaceNormal } from './surface.js';
import { outdoorNormal } from './outdoor-textures.js';

// The flower shop at the far end of the paved walk: the square in front of the town gate, on its
// west (left) side as you come down the lane.
//
// It is a wooden stall under a striped awning, with five roses in a row on the counter, a lantern,
// a bucket of spares and a shopkeeper in a straw hat. Walk up to it and press E (or tap the prompt)
// to buy the next rose. Each one is a different colour — red, yellow, white, lilac, coral — and the
// rose she buys is the colour she keeps, standing in her left hand, the arm on the side away from
// the boy, so it never crosses her dress.
//
// The stall faces the walk: it stands west of the lane's own corridor, so the walk to the gate is
// never blocked, and the couple step aside to the counter.

// One rose per colour, so the bunch she ends up with is mixed rather than five pinks.
export const ROSE_COLOURS = [
  { petal: '#e0384f', ribbon: '#ffe0e6' }, // red
  { petal: '#ffc93c', ribbon: '#fff2c9' }, // yellow
  { petal: '#fbf1f4', ribbon: '#ffd9e6' }, // white
  { petal: '#a97cf0', ribbon: '#ece0ff' }, // lilac
  { petal: '#ff9a5c', ribbon: '#ffe3d2' }, // coral
];

export const AWNING_TILT = 0.18; // the awning's own lean, used by both the build and the sway

export const SHOP = {
  // The square in front of the gate is centred at (-19, -33.5) with a 6.5 m radius; the stall stands
  // in its western half, its back to the low garden wall side, so the lane keeps its own line.
  x: -22.35,
  z: -35.7,
  // Facing north-east: the couple come down the lane from the north, so they see the front of the
  // stall as they arrive, and the counter turns away from the gatehouse behind it.
  rotY: 1.2,
  // How far in front of the counter she stands to buy.
  reach: 1.7,
  counterY: 1.05,
  counterDepth: 0.36,
  halfWidth: 1.12,
  // Each rose's own spot on the counter, relative to the stall: five in a row, all in reach.
  roses: [
    { x: -0.66, y: 1.13, z: 0, colour: 0 },
    { x: -0.33, y: 1.13, z: 0, colour: 1 },
    { x: 0, y: 1.13, z: 0, colour: 2 },
    { x: 0.33, y: 1.13, z: 0, colour: 3 },
    { x: 0.66, y: 1.13, z: 0, colour: 4 },
  ],
  // How close she has to be to the counter to buy one.
  radius: 2.0,
  // Where the seller stands, behind the counter (relative to the stall).
  seller: { x: 0.3, z: -0.75 },
};

// Which way the stall faces, in world space (its local +z).
export function shopFront() {
  return { x: Math.sin(SHOP.rotY), z: Math.cos(SHOP.rotY) };
}

// Where she stands to buy: straight out from the counter, along that facing.
SHOP.buySpot = (() => {
  const front = shopFront();
  return { x: SHOP.x + front.x * SHOP.reach, z: SHOP.z + front.z * SHOP.reach };
})();

// The colour of the rose that is the i-th in the row.
export function roseColour(i) {
  return ROSE_COLOURS[SHOP.roses[i] ? SHOP.roses[i].colour : 0];
}

// A world-space point, from a point in the stall's own frame (x along the counter, z out of its front)
export function shopToWorld(x, z) {
  const c = Math.cos(SHOP.rotY);
  const s = Math.sin(SHOP.rotY);
  return { x: SHOP.x + x * c + z * s, z: SHOP.z - x * s + z * c };
}

// The counter's four corners on the ground, in world space. Used by the walk rules (it is solid) and
// by the tests that keep it out of the lane.
export function stallCorners() {
  const hw = SHOP.halfWidth + 0.12; // the top overhangs the box a little
  const z0 = -SHOP.counterDepth;
  const z1 = SHOP.counterDepth + 0.12;
  return [
    shopToWorld(-hw, z0), shopToWorld(hw, z0), shopToWorld(hw, z1), shopToWorld(-hw, z1),
  ];
}

// The stall has to leave the lane's own corridor clear: the walk down to the gate is the main path,
// and a counter standing in it would close the town off. `halfWidth` is the lane's walkable half
// width (see src/town-night.js), plus the room the couple need beside it.
export function shopClearsLane(streetX = -19, halfWidth = 2.3) {
  return stallCorners().every((p) => Math.abs(p.x - streetX) > halfWidth);
}

// Which rose is next: the first one still on the counter.
export function nextRoseIndex(sold) {
  for (let i = 0; i < SHOP.roses.length; i += 1) {
    if (!sold[i]) return i;
  }
  return -1;
}

// Buying a rose: she takes the first one left. Nothing changes if the row is empty.
export function buyRose(sold) {
  const index = nextRoseIndex(sold);
  if (index < 0) return { index: -1, sold };
  const next = sold.slice();
  next[index] = true;
  return { index, sold: next };
}

export const SHOP_EMPTY_LINE = 'همه‌ی گل‌ها فروش رفت؛ فردا صبح گل تازه می‌آید 🌷';
export const SHOP_BUY_LINES = [
  'این یکی مالِ توست 🌹',
  'گلِ دوم هم برداشتی، دستت پرِ گل شد 🌹',
  'سه‌تا شد؛ عطرش کل میدان را برداشته 🌹',
  'چهارمی هم مالِ تو؛ باز هم بخواهی هست 🌹',
  'پنج گل، پنج تا برای پنج سالِ ما 🌹',
];

export function buyLine(count) {
  if (count <= 0) return SHOP_BUY_LINES[0];
  return SHOP_BUY_LINES[Math.min(count, SHOP_BUY_LINES.length) - 1];
}

// ---------------------------------------------------------------------------
// The bought roses, as geometry that hangs off her hand
// ---------------------------------------------------------------------------

// One rose: a bud, a few petals, a stem, a leaf and a ribbon. Built around the origin, standing up
// the +y axis, so the group can be tipped into her hand.
function makeRose({ petalColor = '#ff5f8f', leafColor = '#2f7a4a', ribbon = '#ffe6f0', scale = 1 } = {}) {
  const group = new THREE.Group();
  // satin, so a physical material: `sheen` does not exist on MeshStandardMaterial, and it warned
  // (and drew nothing) every time a rose was built
  const petalMat = new THREE.MeshPhysicalMaterial({
    color: petalColor, roughness: 0.42, sheen: 0.4, sheenColor: new THREE.Color('#ffd6e6'),
    sheenRoughness: 0.4, normalMap: surfaceNormal('satin', 2), normalScale: new THREE.Vector2(0.15, 0.15),
  });
  const leafMat = new THREE.MeshStandardMaterial({ color: leafColor, roughness: 0.75, side: THREE.DoubleSide });
  const ribbonMat = new THREE.MeshStandardMaterial({ color: ribbon, roughness: 0.5 });
  const stemMat = new THREE.MeshStandardMaterial({ color: '#356b45', roughness: 0.8 });

  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.013, 0.42, 6), stemMat);
  stem.position.y = 0.21;
  group.add(stem);
  // a leaf, tilted out from the stem
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), leafMat);
  leaf.scale.set(0.5, 0.16, 1.25);
  leaf.position.set(0.045, 0.24, 0.01);
  leaf.rotation.z = -0.5;
  group.add(leaf);
  // the bud: a tight ball of petals
  const bud = new THREE.Mesh(new THREE.SphereGeometry(0.052, 12, 10), petalMat);
  bud.scale.set(1, 1.15, 1);
  bud.position.y = 0.44;
  group.add(bud);
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2;
    const petal = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), petalMat);
    petal.scale.set(1, 0.55, 1.3);
    petal.position.set(Math.cos(a) * 0.04, 0.45 + (i % 2) * 0.014, Math.sin(a) * 0.04);
    petal.rotation.y = a;
    group.add(petal);
  }
  // a ribbon tied at the stem
  const knot = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.009, 6, 10), ribbonMat);
  knot.rotation.x = Math.PI / 2;
  knot.position.y = 0.055;
  group.add(knot);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.012), ribbonMat);
  tail.position.set(0.03, 0.03, 0.012);
  tail.rotation.z = 0.5;
  group.add(tail);

  group.scale.setScalar(scale);
  return group;
}

// The holder that keeps the bought roses out of her dress.
//
// Her arm is a pivot at the shoulder that swings; the hand sits 0.5 m down it. The bouquet is
// parented to the hand (so it travels with the arm) but it is turned *outward* — away from the
// skirt — and it is tilted forward and up, so the buds rise in front of her shoulder rather than
// lying against her bodice. The reach is deliberately short: the lowest bud stays well inside the
// arm's own radius.
export const BOUQUET = {
  // the hand sits at (0, -0.5, 0.03) in her arm's frame; the bouquet hangs from a little above it
  handPoint: { x: 0, y: -0.5, z: 0.03 },
  // how far out from her side the hand is pushed when she is holding roses
  armOut: 0.74,
  // the bouquet's own tilt: up, forward, and out to her side. A negative tiltZ leans the blooms
  // away from her; the opposite sign lays them against her bodice, which is exactly what not to do.
  tiltX: -0.3,
  tiltZ: -0.36,
  // how many roses she can carry before the row is empty (the shop has five)
  max: 5,
};

// The pose her flower arm takes for a given number of roses: further out and a little steadier as
// the bouquet fills up, so the stems never touch the skirt.
export function flowerArmPose(count) {
  const t = Math.min(1, Math.max(0, count / BOUQUET.max));
  return {
    // rotation.z on her flower arm (the one at +x); a positive z swings it away from her side
    z: BOUQUET.armOut * (0.55 + 0.45 * t),
    // a small forward lift, so the bouquet is in front of her, not beside her
    x: 0.12 + 0.06 * t,
    sway: 0.05 * t,
  };
}

// Where each bought rose sits in her hand: a tight fan, fanning away from the skirt.
export function bouquetSlot(i, count) {
  const n = Math.max(1, count);
  const spread = 0.34; // radians of fan across the bouquet
  const a = n === 1 ? 0 : (i / (n - 1) - 0.5) * spread;
  return {
    // fanned sideways and forward, each rose a little higher than the last
    x: Math.sin(a) * 0.05,
    y: 0.02 + i * 0.012,
    z: Math.cos(a) * 0.02,
    rotZ: -a * 1.6,
    rotX: -0.2,
    // a slight scale-down for the outer roses, so the fan reads as a bouquet
    scale: 0.92 + 0.08 * (i / Math.max(1, n - 1)),
  };
}

// ---------------------------------------------------------------------------
// The stall itself
// ---------------------------------------------------------------------------

function stripeCanvas(a = '#ffd9e6', b = '#ff9dbd') {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = a;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = b;
  for (let x = 0; x < size; x += 32) ctx.fillRect(x, 0, 16, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function labelCanvas() {
  const w = 256;
  const h = 96;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  // The plaque's own face is a display face that may still be loading when the world is built, so
  // the sign draws once now and once more when the font is ready.
  if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { drawLabel(ctx, w, h); }).catch(() => {});
  }
  drawLabel(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// The sign's lettering, drawn on its own so it can be redrawn once the font has loaded.
function drawLabel(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#fff6fa');
  g.addColorStop(1, '#ffd3e4');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // a little scallop of roses along the bottom of the sign
  ctx.fillStyle = '#ffb6cf';
  for (let i = 0; i < 9; i += 1) {
    ctx.beginPath();
    ctx.arc(18 + i * 28, h - 14, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#d9a441';
  ctx.lineWidth = 5;
  ctx.strokeRect(6, 6, w - 12, h - 12);
  ctx.fillStyle = '#6b2d5c';
  ctx.font = '600 42px "Lalezar", "Vazirmatn Variable", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('گل‌فروشی', w / 2, h / 2 - 8);
}

// A small shopkeeper behind the counter: a body, a head, an apron and a straw hat.
function makeSeller(track) {
  const group = new THREE.Group();
  const dress = track(new THREE.MeshStandardMaterial({ color: '#6f8f6a', roughness: 0.85 }));
  const apron = track(new THREE.MeshStandardMaterial({ color: '#f6eee2', roughness: 0.9 }));
  const skin = track(new THREE.MeshStandardMaterial({ color: '#f0c9a8', roughness: 0.6 }));
  const straw = track(new THREE.MeshStandardMaterial({ color: '#e8cf9a', roughness: 0.85 }));

  const skirt = new THREE.Mesh(track(new THREE.CylinderGeometry(0.2, 0.34, 0.95, 14)), dress);
  skirt.position.y = 0.48;
  group.add(skirt);
  const top = new THREE.Mesh(track(new THREE.CylinderGeometry(0.16, 0.2, 0.5, 12)), dress);
  top.position.y = 1.2;
  group.add(top);
  const bib = new THREE.Mesh(track(new THREE.BoxGeometry(0.28, 0.5, 0.06)), apron);
  bib.position.set(0, 1.16, 0.17);
  group.add(bib);
  const head = new THREE.Mesh(track(new THREE.SphereGeometry(0.17, 20, 16)), skin);
  head.position.y = 1.62;
  group.add(head);
  // a face: two eyes and a small smile, or she reads as a blank balloon behind the counter
  const eyeMat = track(new THREE.MeshStandardMaterial({ color: '#3a2a2a', roughness: 0.4 }));
  const blushMat = track(new THREE.MeshStandardMaterial({ color: '#f0a79a', roughness: 0.8 }));
  [-1, 1].forEach((side) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.023, 10, 8), eyeMat);
    eye.position.set(side * 0.062, 1.65, 0.152);
    group.add(eye);
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), blushMat);
    cheek.scale.set(1, 0.7, 0.4);
    cheek.position.set(side * 0.105, 1.6, 0.128);
    group.add(cheek);
  });
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 12, Math.PI), eyeMat);
  smile.rotation.set(0, 0, Math.PI);
  smile.position.set(0, 1.6, 0.155);
  group.add(smile);
  const brim = new THREE.Mesh(track(new THREE.CylinderGeometry(0.34, 0.36, 0.035, 18)), straw);
  brim.position.y = 1.72;
  group.add(brim);
  const crown = new THREE.Mesh(track(new THREE.CylinderGeometry(0.17, 0.19, 0.14, 14)), straw);
  crown.position.y = 1.8;
  group.add(crown);
  // a rose on the hat, because it is a flower shop
  const hatRose = makeRose({ petalColor: '#ff7fa8', scale: 0.9 });
  hatRose.position.set(0.2, 1.74, 0.1);
  hatRose.rotation.z = 1.2;
  group.add(hatRose);
  return { group, head };
}

// Build the stall. Returns what the rest of the game needs: where to stand to buy, the roses still
// on the counter, and a per-frame update for the little motions (the awning, the lantern, the seller).
export function buildFlowerShop(scene, track) {
  const group = new THREE.Group();
  group.position.set(SHOP.x, 0, SHOP.z);
  // turned to face the walk, so the couple see the counter as they come down the lane
  group.rotation.y = SHOP.rotY;
  group.name = 'flower-shop';
  scene.add(group);

  const wood = track(new THREE.MeshStandardMaterial({
    color: '#6b4630', roughness: 0.8, normalMap: outdoorNormal('bark', 2, 1), normalScale: new THREE.Vector2(0.4, 0.4),
  }));
  const woodDark = track(new THREE.MeshStandardMaterial({ color: '#4a3021', roughness: 0.85 }));
  const counterTop = track(new THREE.MeshStandardMaterial({
    color: '#8a5a3c', roughness: 0.55, normalMap: outdoorNormal('bark', 3, 1), normalScale: new THREE.Vector2(0.5, 0.5),
  }));
  const gold = track(new THREE.MeshStandardMaterial({ color: '#e9b96a', metalness: 0.7, roughness: 0.3 }));
  const awningMat = track(new THREE.MeshStandardMaterial({ map: stripeCanvas(), roughness: 0.7, side: THREE.DoubleSide }));
  const leafMat = track(new THREE.MeshStandardMaterial({ color: '#3f7a55', roughness: 0.85, side: THREE.DoubleSide }));
  const bucketMat = track(new THREE.MeshStandardMaterial({ color: '#9aa6b2', metalness: 0.4, roughness: 0.45 }));

  const half = SHOP.halfWidth;

  // counter: a box of planks with a lip and two braces
  const counter = new THREE.Mesh(new THREE.BoxGeometry(half * 2, 1.03, 0.5), wood);
  counter.position.set(0, 0.515, 0);
  group.add(counter);
  const top = new THREE.Mesh(new THREE.BoxGeometry(half * 2 + 0.12, 0.08, 0.62), counterTop);
  top.position.set(0, SHOP.counterY, 0);
  group.add(top);
  const lip = new THREE.Mesh(new THREE.BoxGeometry(half * 2 + 0.16, 0.06, 0.06), woodDark);
  lip.position.set(0, SHOP.counterY - 0.07, 0.3);
  group.add(lip);
  [-1, 1].forEach((side) => {
    const brace = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.9, 0.54), woodDark);
    brace.position.set(side * (half - 0.06), 0.45, 0);
    group.add(brace);
  });

  // two posts and a striped awning over the counter, with a scalloped edge
  const posts = [];
  [-1, 1].forEach((side) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 3.0, 10), wood);
    post.position.set(side * (half - 0.02), 1.5, -0.12);
    group.add(post);
    posts.push(post);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10), gold);
    cap.position.set(side * (half - 0.02), 3.05, -0.12);
    group.add(cap);
  });
  const awning = new THREE.Mesh(new THREE.BoxGeometry(half * 2 + 0.3, 0.05, 1.2), awningMat);
  awning.position.set(0, 3.0, 0.22);
  awning.rotation.x = AWNING_TILT;
  group.add(awning);
  // the scalloped fringe, one little half-cylinder per stripe
  const fringe = new THREE.Group();
  fringe.position.set(0, 2.86, 0.8);
  group.add(fringe);
  for (let i = 0; i < 12; i += 1) {
    const scallop = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 12, 1, false, 0, Math.PI), awningMat);
    scallop.rotation.z = Math.PI / 2;
    scallop.rotation.y = Math.PI / 2;
    scallop.position.set(-half - 0.1 + (i + 0.5) * ((half * 2 + 0.2) / 12), -0.03, 0);
    fringe.add(scallop);
  }

  // the sign over the counter
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.15, 0.42),
    new THREE.MeshBasicMaterial({ map: labelCanvas(), toneMapped: false }),
  );
  sign.position.set(0, 2.56, 0.7);
  sign.rotation.x = -0.06;
  group.add(sign);
  const signBack = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.5, 0.05), woodDark);
  signBack.position.set(0, 2.56, 0.66);
  group.add(signBack);
  [-1, 1].forEach((side) => {
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 10), gold);
    hook.position.set(side * 0.5, 2.8, 0.68);
    group.add(hook);
  });

  // a lantern on each post, so the stall reads as an open, lit shop on a dark square
  const lanternGlow = track(new THREE.MeshBasicMaterial({ color: '#ffd79a', toneMapped: false }));
  const lanterns = [];
  [-1, 1].forEach((side) => {
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), lanternGlow);
    lantern.position.set(side * (half + 0.07), 2.42, 0.06);
    group.add(lantern);
    lanterns.push(lantern);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.11, 10), gold);
    roof.position.set(side * (half + 0.07), 2.54, 0.06);
    group.add(roof);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 6, 10), gold);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(side * (half + 0.07), 2.51, 0.06);
    group.add(ring);
  });
  // one warm light of its own: the square's lamps are a few metres away and the shop is the thing
  // people walk to, so it gets a small, short-reach light rather than being a dark silhouette
  // Kept low and gentle, and in front of the counter rather than over the shopkeeper's face: at head
  // height and full strength the light blew her face out to white.
  const shopLight = track(new THREE.PointLight('#ffc48a', 5.5, 7.5, 2));
  shopLight.position.set(0, 1.95, 0.85);
  group.add(shopLight);
  // a soft warm halo, so the shop reads from the far end of the lane as a lit island on a dark square
  const haloCanvas = document.createElement('canvas');
  haloCanvas.width = haloCanvas.height = 128;
  {
    const ctx = haloCanvas.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,206,150,0.85)');
    g.addColorStop(0.45, 'rgba(255,186,120,0.22)');
    g.addColorStop(1, 'rgba(255,186,120,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }
  const haloTex = new THREE.CanvasTexture(haloCanvas);
  haloTex.colorSpace = THREE.NoColorSpace;
  track(haloTex);
  const halo = new THREE.Sprite(track(new THREE.SpriteMaterial({
    map: haloTex, color: '#ffcf96', transparent: true, opacity: 0.8,
    depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  })));
  halo.scale.set(4.6, 3.2, 1);
  halo.position.set(0, 2.1, 0.4);
  group.add(halo);

  // two pots of pink blossom either side of the counter: the shop's own flowers, spilling out
  const potMat = track(new THREE.MeshStandardMaterial({ color: '#7a4b3c', roughness: 0.9 }));
  const blossomMat = track(new THREE.MeshStandardMaterial({ color: '#f19bbd', roughness: 0.85, flatShading: true }));
  const potLeafMat = track(new THREE.MeshStandardMaterial({ color: '#3f7a55', roughness: 0.9, flatShading: true }));
  [-1, 1].forEach((side) => {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.38, 12), potMat);
    pot.position.set(side * (half + 0.34), 0.19, 0.5);
    group.add(pot);
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2;
      const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), potLeafMat);
      leaf.position.set(side * (half + 0.34) + Math.cos(a) * 0.11, 0.44, 0.5 + Math.sin(a) * 0.11);
      leaf.scale.set(1, 0.8, 1);
      group.add(leaf);
      const flower = new THREE.Mesh(new THREE.IcosahedronGeometry(0.085, 0), blossomMat);
      flower.position.set(side * (half + 0.34) + Math.cos(a) * 0.13, 0.58, 0.5 + Math.sin(a) * 0.13);
      group.add(flower);
    }
  });

  // a crate of spare blooms and a barrel, so the corner of the square looks lived in
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.62, 12), woodDark);
  barrel.position.set(-half - 0.62, 0.31, 0.9);
  group.add(barrel);
  const barrelBand = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.02, 6, 14), gold);
  barrelBand.rotation.x = Math.PI / 2;
  barrelBand.position.set(-half - 0.62, 0.5, 0.9);
  group.add(barrelBand);

  // a string of little beads along the awning's front edge, catching that light
  const beadMat = track(new THREE.MeshBasicMaterial({ color: '#ffe6b0', toneMapped: false }));
  const beadGeo = track(new THREE.SphereGeometry(0.028, 8, 6));
  for (let i = 0; i < 9; i += 1) {
    const bead = new THREE.Mesh(beadGeo, beadMat);
    bead.position.set(-half - 0.05 + (i * (half * 2 + 0.1)) / 8, 2.84 - Math.sin((i / 8) * Math.PI) * 0.045, 0.79);
    group.add(bead);
  }

  // five roses on the counter, each with a small vase and a price tag
  const counterRoses = SHOP.roses.map((spot, i) => {
    const colour = ROSE_COLOURS[spot.colour];
    const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.1, 10), track(new THREE.MeshStandardMaterial({ color: '#f7e6ee', roughness: 0.3 })));
    vase.position.set(spot.x, SHOP.counterY + 0.06, 0.02);
    group.add(vase);
    // one of each colour, all five sold out before the shop says it is empty
    const rose = makeRose({ petalColor: colour.petal, ribbon: colour.ribbon });
    rose.rotation.z = 0.08 * (i % 2 ? 1 : -1);
    group.add(rose);
    rose.userData.spot = { x: spot.x, y: SHOP.counterY + 0.1, z: 0.12 };
    rose.position.set(spot.x, SHOP.counterY + 0.1, 0.12);
    return rose;
  });

  // a bucket of spare roses on the ground, and a small crate of leaves
  const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.16, 0.4, 12), bucketMat);
  bucket.position.set(-half - 0.35, 0.2, 0.35);
  group.add(bucket);
  const spare = new THREE.Group();
  for (let i = 0; i < 4; i += 1) {
    const top = ROSE_COLOURS[(i + 1) % ROSE_COLOURS.length];
    const rose = makeRose({ petalColor: top.petal, ribbon: top.ribbon, scale: 0.95 });
    rose.position.set(-0.08 + i * 0.05, 0.3, 0.02 * i);
    rose.rotation.z = (i - 1.5) * 0.12;
    spare.add(rose);
  }
  spare.position.set(-half - 0.35, 0.2, 0.35);
  group.add(spare);
  const crate = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.26), wood);
  crate.position.set(half + 0.38, 0.11, 0.3);
  group.add(crate);
  for (let i = 0; i < 6; i += 1) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), leafMat);
    leaf.scale.set(0.6, 0.3, 1.1);
    leaf.position.set(half + 0.3 + (i % 3) * 0.08, 0.24, 0.24 + Math.floor(i / 3) * 0.08);
    group.add(leaf);
  }

  // the shopkeeper behind the counter
  const seller = makeSeller(track);
  seller.group.position.set(SHOP.seller.x, 0, SHOP.seller.z);
  seller.group.rotation.y = Math.PI; // facing the counter and the couple
  group.add(seller.group);

  // the five roses still to be sold, by index; the sold ones are hidden
  const sold = new Array(SHOP.roses.length).fill(false);

  function refresh() {
    counterRoses.forEach((rose, i) => { rose.visible = !sold[i]; });
  }
  refresh();

  function update(t) {
    // the awning breathes a little, the lantern flickers, the seller sways and turns her head
    awning.rotation.x = AWNING_TILT + Math.sin(t * 0.8) * 0.012;
    const flicker = 0.86 + Math.sin(t * 5.1) * 0.08 + Math.sin(t * 11.7) * 0.04;
    lanterns.forEach((l, i) => {
      l.position.y = 2.42 + Math.sin(t * 1.3 + i * 1.7) * 0.004;
    });
    lanternGlow.color.setRGB(1, 0.84 * flicker, 0.6 * flicker);
    shopLight.intensity = 5.0 + flicker * 1.1;
    seller.group.rotation.y = Math.PI + Math.sin(t * 0.45) * 0.18;
    seller.head.rotation.z = Math.sin(t * 0.6) * 0.05;
    counterRoses.forEach((rose, i) => {
      if (!rose.visible) return;
      rose.rotation.z = 0.08 * (i % 2 ? 1 : -1) + Math.sin(t * 1.1 + i) * 0.03;
    });
  }

  return {
    group,
    // where the couple stands to buy: in front of the counter
    buyAt: { ...SHOP.buySpot },
    // what she is standing in front of, for the hearts that pop when she buys
    counter: { x: SHOP.x, z: SHOP.z },
    radius: SHOP.radius,
    sold,
    refresh,
    update,
    get remaining() {
      return sold.filter((s) => !s).length;
    },
    buy() {
      const result = buyRose(sold);
      if (result.index < 0) return { index: -1, sold };
      sold.length = 0;
      sold.push(...result.sold);
      refresh();
      return result;
    },
  };
}

// ---------------------------------------------------------------------------
// Her bouquet, in her hand
// ---------------------------------------------------------------------------

// A group on the princess's flower arm (hers, from characters.js). `add()` adds a rose; each new one
// takes its place in the fan. Returns the group and a small API the game uses when she buys one.
export function createBouquet(handGroup) {
  // The group already lives on her arm (characters.js puts it there with her own rose in it), so a
  // bought rose joins that same bundle rather than hanging in a second one.
  const group = handGroup;
  const roses = [];

  function layout() {
    roses.forEach((rose, i) => {
      const slot = bouquetSlot(i, roses.length);
      rose.position.set(slot.x, slot.y, slot.z);
      rose.rotation.set(slot.rotX, 0, slot.rotZ);
      rose.scale.setScalar(slot.scale);
    });
  }

  function add({ petalColor = '#ff5f8f' } = {}) {
    const rose = makeRose({ petalColor, ribbon: '#fff1f7', scale: 1.15 });
    group.add(rose);
    roses.push(rose);
    layout();
    return rose;
  }

  return { group, roses, add, get count() { return roses.length; } };
}
