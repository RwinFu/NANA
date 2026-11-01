import * as THREE from 'three';
import { surfaceNormal } from './surface.js';
import { outdoorNormal } from './outdoor-textures.js';

// The flower shop at the far end of the gallery hall.
//
// The hall used to end at the envelope in front of the heart window, with two dark metres either
// side of it. Now there is a little shop there: a wooden stall with a striped awning, five pink
// roses in a row on the counter, a lantern, and roses spilling out of a bucket on the ground. Walk
// up to it and press E (or tap the prompt) to buy the next rose in the row. Each rose she buys stays
// in her left hand — the arm on the side away from the boy, so it never crosses her dress.
//
// The stall sits under the heart window and never crosses the envelope's footprint, so the finale
// still has its spot.

export const SHOP = {
  // In the west corner at the end of the hall, not across the middle: the envelope in front of the
  // heart window keeps the centre, and the couple can still walk up to it. This corner used to be
  // the one dark patch at the end of the corridor.
  x: -2.35,
  z: -36.7,
  counterY: 1.02,
  counterDepth: 0.36,
  halfWidth: 0.95,
  // Each rose's own spot on the counter, relative to the stall: five in a row, all in reach.
  roses: [
    { x: -0.66, y: 1.13, z: 0 },
    { x: -0.33, y: 1.13, z: 0 },
    { x: 0, y: 1.13, z: 0 },
    { x: 0.33, y: 1.13, z: 0 },
    { x: 0.66, y: 1.13, z: 0 },
  ],
  // Where she stands to buy, in front of the counter's east half. The couple walk a corridor that
  // leaves the boy a metre and a half of room by the wall, so the spot has to stay clear of that
  // band: at |x| > ~2.05 the hall itself stops them.
  buySpot: { x: -1.5, z: -35.45 },
  // How close she has to be to the counter to buy one.
  radius: 2.0,
  // Where the seller stands, behind the counter (relative to the stall).
  seller: { x: 0.3, z: -0.75 },
};

// The envelope and its pedestal keep the middle of the hall; the stall must leave them alone.
export function shopClearsEnvelope(envelope) {
  const dz = Math.abs(SHOP.z - envelope.z);
  return dz > SHOP.counterDepth + 0.25;
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
  'سه‌تا شد؛ عطرش کل راهرو را برداشته 🌹',
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
  const counter = new THREE.Mesh(new THREE.BoxGeometry(half * 2, 1.0, 0.5), wood);
  counter.position.set(0, 0.5, 0);
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
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.5, 10), wood);
    post.position.set(side * (half - 0.02), 1.25, -0.12);
    group.add(post);
    posts.push(post);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), gold);
    cap.position.set(side * (half - 0.02), 2.55, -0.12);
    group.add(cap);
  });
  const awning = new THREE.Mesh(new THREE.BoxGeometry(half * 2 + 0.3, 0.05, 1.15), awningMat);
  awning.position.set(0, 2.5, 0.2);
  awning.rotation.x = 0.18;
  group.add(awning);
  // the scalloped fringe, one little half-cylinder per stripe
  const fringe = new THREE.Group();
  fringe.position.set(0, 2.36, 0.75);
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
  sign.position.set(0, 2.14, 0.66);
  sign.rotation.x = -0.06;
  group.add(sign);
  const signBack = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.5, 0.05), woodDark);
  signBack.position.set(0, 2.14, 0.62);
  group.add(signBack);
  [-1, 1].forEach((side) => {
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 10), gold);
    hook.position.set(side * 0.5, 2.38, 0.64);
    group.add(hook);
  });

  // a little lantern on the right post
  const lanternGlow = track(new THREE.MeshBasicMaterial({ color: '#ffd79a', toneMapped: false }));
  const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), lanternGlow);
  lantern.position.set(half + 0.06, 2.0, 0.05);
  group.add(lantern);
  const lanternRoof = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.11, 10), gold);
  lanternRoof.position.set(half + 0.06, 2.12, 0.05);
  group.add(lanternRoof);

  // five roses on the counter, each with a small vase and a price tag
  const counterRoses = SHOP.roses.map((spot, i) => {
    const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.1, 10), track(new THREE.MeshStandardMaterial({ color: '#f7e6ee', roughness: 0.3 })));
    vase.position.set(spot.x, SHOP.counterY + 0.06, 0.02);
    group.add(vase);
    const rose = makeRose({ petalColor: i % 2 ? '#ff8fb0' : '#ff5f8f', ribbon: i % 2 ? '#fff1f7' : '#ffe6f0' });
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
    const rose = makeRose({ petalColor: i % 2 ? '#ff8fb0' : '#ffd0e0', scale: 0.95 });
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
    awning.rotation.x = 0.18 + Math.sin(t * 0.8) * 0.012;
    const flicker = 0.86 + Math.sin(t * 5.1) * 0.08 + Math.sin(t * 11.7) * 0.04;
    lanternGlow.color.setRGB(1, 0.84 * flicker, 0.6 * flicker);
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
