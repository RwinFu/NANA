import * as THREE from 'three';
import { surfaceNormal } from './surface.js';
import { physMat, charMats } from './charmats.js';
import { blinkFactor, addPrincessFace, addBoyFace } from './faces.js';
import { createSkirt, addBodiceDetail, addHemPearls, dressMaterials } from './dress.js';
import { addPrincessHairDetail, addBoyHair } from './hairdetail.js';

const SKIN = '#f2c7a3';
const HAIR = '#3a2220';
const COAT = '#2d3354';
const PANTS = '#1b1d2e';
const SHOE = '#111018';
const ARM_R = 0.07;
// The princess is a small figure: her whole body is scaled down, so she is shorter than the boy
// and every part keeps the same proportions.
const PRINCESS_SCALE = 0.68;
// The boy walks beside her on her right side (her -x), a little behind, and follows her
const FOLLOW_SIDE = 0.95;
const FOLLOW_BACK = 0.45;
const FOLLOW_RATE = 16; // higher means the boy keeps closer to his spot
// Distance (in metres) the couple covers in one full stride cycle (two steps)
const STRIDE = 3.4;
const HAIR_LIMIT = 1.3; // radians; keeps the hair from folding through the body
const up = new THREE.Vector3(0, 1, 0);
// The two-person dances, in the order the dance button cycles through them
const DANCE_NAMES = ['والس', 'چرخش دونفره', 'دست بالا'];

function part(mesh, parent, x = 0, y = 0, z = 0) {
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// A smooth ribbon that follows a list of points (in the space of its parent). It is rebuilt
// each frame from the hair joints, so the hair reads as one flowing strand, not as beads.
function createRibbon(material, radialSegs = 8, spine = 14, braid = null) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array((spine + 1) * (radialSegs + 1) * 3);
  const indices = [];
  for (let i = 0; i < spine; i += 1) {
    for (let j = 0; j < radialSegs; j += 1) {
      const a = i * (radialSegs + 1) + j;
      const b = (i + 1) * (radialSegs + 1) + j;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  geometry.setIndex(indices);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  const ref = new THREE.Vector3(1, 0, 0);
  const alt = new THREE.Vector3(0, 0, 1);
  const T = new THREE.Vector3();
  const N = new THREE.Vector3();
  const B = new THREE.Vector3();

  function update(points, r0, r1) {
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    const pts = curve.getSpacedPoints(spine);
    for (let i = 0; i <= spine; i += 1) {
      const p = pts[i];
      T.subVectors(pts[Math.min(spine, i + 1)], pts[Math.max(0, i - 1)]).normalize();
      N.crossVectors(T, Math.abs(T.x) > 0.9 ? alt : ref).normalize();
      B.crossVectors(T, N).normalize();
      const r = THREE.MathUtils.lerp(r0, r1, i / spine);
      for (let j = 0; j <= radialSegs; j += 1) {
        const a = (j / radialSegs) * Math.PI * 2;
        // a braid: the radius swells and thins in two diagonal strands that twist along the hair
        const rr = braid ? 1 + braid.amp * Math.cos(2 * a + braid.freq * i) : 1;
        const c = Math.cos(a) * r * rr;
        const d = Math.sin(a) * r * rr;
        const k = (i * (radialSegs + 1) + j) * 3;
        positions[k] = p.x + c * N.x + d * B.x;
        positions[k + 1] = p.y + c * N.y + d * B.y;
        positions[k + 2] = p.z + c * N.z + d * B.z;
      }
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.computeVertexNormals();
    return pts[spine];
  }

  return { mesh, update };
}

// A chain of hinged joints that hangs from `anchor`. Each joint is a spring pulled toward its
// rest angle, damped, and pushed by the head's acceleration, so the hair lags behind every move.
// The hair itself is a smooth ribbon that follows the joints.
function createHairChain({ parent, anchor, lengths, radii, rest, stiffness, damping, drive, material, braid = null }) {
  const base = new THREE.Group();
  base.position.set(anchor.x, anchor.y, anchor.z);
  parent.add(base);
  const joints = [];
  let owner = base;
  lengths.forEach((len, i) => {
    const g = new THREE.Group();
    if (i > 0) g.position.y = -lengths[i - 1];
    owner.add(g);
    joints.push({
      g,
      len,
      ax: 0,
      az: 0,
      vx: 0,
      vz: 0,
      // the rest pose is spread over the segments, so the whole chain hangs in a curve
      restX: i === 0 ? rest.x : rest.x * 0.2,
      restZ: i === 0 ? rest.z : rest.z * 0.5,
      k: stiffness * (1 - 0.12 * i),
      drive: drive * (1 + 0.45 * i),
    });
    owner = g;
  });

  const ribbon = createRibbon(material, 12, 22, braid);
  base.add(ribbon.mesh);
  const inv = new THREE.Matrix4();
  const tmp = new THREE.Vector3();
  const tip = new THREE.Vector3();
  const tipCap = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), material);
  base.add(tipCap);
  const r0 = radii[0];
  const r1 = radii[radii.length - 1] * 0.6;

  function step(dt, accLocal, sway) {
    const d = Math.min(dt, 0.05);
    joints.forEach((j, i) => {
      const targetX = j.restX + sway * (i === 0 ? 1 : 0.5);
      j.vx += (-j.k * (j.ax - targetX) - damping * j.vx + j.drive * accLocal.z) * d;
      j.vz += (-j.k * (j.az - j.restZ) - damping * j.vz - j.drive * accLocal.x) * d;
      j.ax = clamp(j.ax + j.vx * d, -HAIR_LIMIT, HAIR_LIMIT);
      j.az = clamp(j.az + j.vz * d, -HAIR_LIMIT, HAIR_LIMIT);
      j.g.rotation.set(j.ax, 0, j.az);
    });

    // Joint pivots and the tip, in the chain's own space
    let top = base;
    while (top.parent) top = top.parent;
    top.updateMatrixWorld(true);
    inv.copy(base.matrixWorld).invert();
    const last = joints[joints.length - 1];
    const pts = [new THREE.Vector3(0, 0, 0)];
    joints.forEach((j, i) => {
      if (i === 0) return;
      j.g.getWorldPosition(tmp).applyMatrix4(inv);
      pts.push(tmp.clone());
    });
    tip.set(0, -last.len, 0);
    last.g.localToWorld(tip).applyMatrix4(inv);
    pts.push(tip.clone());
    const end = ribbon.update(pts, r0, r1);
    tipCap.position.copy(end);
    tipCap.scale.setScalar(r1);
  }

  return { step, end: joints[joints.length - 1].g, angles: () => joints.map((j) => [+j.ax.toFixed(3), +j.az.toFixed(3)]) };
}

// A princess tiara that wraps across the front of the head, above the bangs: a curved gold band
// with a row of points (the tallest in the middle, with a pink jewel), blue gems and pearls.
function addTiara(head, goldMat) {
  const R = 0.29; // distance from the head centre
  const TH = 0.6; // polar angle from the crown: it sits above the bangs
  const onBand = (a, r = R) => {
    const s = Math.sin(TH);
    return new THREE.Vector3(r * s * Math.sin(a), r * Math.cos(TH), r * s * Math.cos(a));
  };
  const span = 1.5;
  const band = onBand;
  const bandPts = [];
  for (let i = 0; i <= 8; i += 1) bandPts.push(band(-span + (i / 8) * span * 2));
  head.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bandPts), 40, 0.013, 8, false), goldMat));

  const gemPink = physMat({ color: '#ff8fab', roughness: 0.2, metalness: 0.1, emissive: '#4a1426' });
  const gemBlue = physMat({ color: '#8ec5ff', roughness: 0.2, metalness: 0.1 });
  const pearlMat = physMat({ color: '#fff6ee', roughness: 0.3 });
  const up = new THREE.Vector3(0, 1, 0);
  const dir = new THREE.Vector3();
  const quat = new THREE.Quaternion();

  // Points: tallest in the middle, shorter toward the sides
  const points = [
    { a: -0.9, h: 0.075, r: 0.02 },
    { a: -0.45, h: 0.09, r: 0.022 },
    { a: 0, h: 0.14, r: 0.03 },
    { a: 0.45, h: 0.09, r: 0.022 },
    { a: 0.9, h: 0.075, r: 0.02 },
  ];
  points.forEach(({ a, h, r }) => {
    const base = onBand(a, R - 0.004);
    dir.copy(base).normalize();
    const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 10).translate(0, h / 2, 0), goldMat);
    quat.setFromUnitVectors(up, dir);
    cone.quaternion.copy(quat);
    cone.position.copy(base);
    head.add(cone);
    const tip = base.clone().addScaledVector(dir, h);
    const gem = new THREE.Mesh(new THREE.SphereGeometry(a === 0 ? 0.022 : 0.012, 12, 10), a === 0 ? gemPink : gemBlue);
    gem.position.copy(tip);
    head.add(gem);
  });

  // Pearls between the points, on the band
  [-1.12, -0.68, -0.22, 0.22, 0.68, 1.12].forEach((a) => {
    const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), pearlMat);
    pearl.position.copy(onBand(a));
    head.add(pearl);
  });
}

// The walking princess (you) and the boy who follows her and holds her hand.
// Her front is +z; her two braids hang down her back (-z).
export function createCouple(dressColor) {
  const root = new THREE.Group();
  const body = new THREE.Group(); // bobs and sways while walking
  body.scale.setScalar(PRINCESS_SCALE);
  root.add(body);

  const dressMat = physMat({
    color: dressColor, roughness: 0.5, side: THREE.DoubleSide, sheen: 1, sheenColor: new THREE.Color('#ffe6f0'), sheenRoughness: 0.35,
    normalMap: surfaceNormal('satin', 5), normalScale: new THREE.Vector2(0.3, 0.3),
  });
  const pinkGemMatBody = physMat({ color: '#ff5f8f', roughness: 0.08, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03, emissive: '#3a0f1f' });
  const skinMat = physMat({ color: SKIN, roughness: 0.5, sheen: 0.3, sheenColor: new THREE.Color('#ffd9c2'), sheenRoughness: 0.6, clearcoat: 0.12, clearcoatRoughness: 0.45 });
  const hairMat = physMat({ color: HAIR, roughness: 0.4, clearcoat: 0.38, clearcoatRoughness: 0.32, normalMap: surfaceNormal('strands', 2), normalScale: new THREE.Vector2(0.32, 0.32) });
  const goldMat = physMat({ color: '#f5c96a', metalness: 1, roughness: 0.2, clearcoat: 0.5, clearcoatRoughness: 0.15 });
  const shoeMat = physMat({ color: '#2a1a24', roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 });

  // Skirt: a lathe with a soft bell shape. Her feet move under it while she walks.
  const skirtProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.72, 0.0),
    new THREE.Vector2(0.58, 0.55),
    new THREE.Vector2(0.38, 0.98),
    new THREE.Vector2(0.3, 1.1),
  ];
  const dressDet = dressMaterials();
  const skirt = createSkirt(dressMat, dressDet.lace);
  skirt.position.y = 0.12;
  body.add(skirt);

  // A lighter petticoat under the skirt, with a white lace edge along the hem
  const petticoat = new THREE.Mesh(
    new THREE.LatheGeometry(skirtProfile.map((p) => new THREE.Vector2(p.x * 0.93, p.y * 0.97)), 112),
    physMat({ color: '#ffd7e6', roughness: 0.7, side: THREE.DoubleSide }),
  );
  petticoat.position.y = 0.1;
  body.add(petticoat);
  const petLaceMat = physMat({ color: '#fff7fb', roughness: 0.6, sheen: 1, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.5 });
  const hem = part(new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.024, 12, 120), petLaceMat), body, 0, 0.13, 0);
  hem.rotation.x = Math.PI / 2;
  addHemPearls(body, dressDet.pearl);

  // Gather the entire skirt, lace and hem under one waist-level pivot. This lets
  // the dress settle onto the seat without squashing her head and torso.
  const skirtPose = new THREE.Group();
  skirtPose.position.y = 1.1;
  const skirtParts = [...body.children];
  body.add(skirtPose);
  skirtParts.forEach((part) => {
    body.remove(part);
    part.position.y -= skirtPose.position.y;
    skirtPose.add(part);
  });

  // A sash at the waist with a bow at the back
  const sashMat = physMat({ color: '#ff8fb8', roughness: 0.3, sheen: 0.8, sheenColor: new THREE.Color('#ffd0e2'), sheenRoughness: 0.4 });
  const sash = part(new THREE.Mesh(new THREE.TorusGeometry(0.275, 0.034, 10, 40), sashMat), body, 0, 1.19, 0);
  sash.rotation.x = Math.PI / 2;
  [-1, 1].forEach((side) => {
    const loop = part(new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), sashMat), body, side * 0.06, 1.19, -0.3);
    loop.scale.set(0.9, 0.6, 0.45);
  });
  part(new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), sashMat), body, 0, 1.19, -0.31);

  const feet = [];
  const shoeRest = [-0.14, 0.14];
  shoeRest.forEach((x) => {
    const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), shoeMat);
    shoe.scale.set(1, 0.55, 1.5);
    part(shoe, body, x, 0.06, 0.12);
    feet.push(shoe);
  });

  const bodice = part(new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.31, 0.55, 20), dressMat), body, 0, 1.38, 0);
  bodice.scale.z = 0.8;
  addBodiceDetail(body, dressDet);
  part(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.12, 12), skinMat), body, 0, 1.72, 0);
  // A gold choker with a pink pendant
  const choker = part(new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.012, 8, 28), goldMat), body, 0, 1.68, 0);
  choker.rotation.x = Math.PI / 2;
  part(new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), pinkGemMatBody), body, 0, 1.56, 0.22);

  // How far her flower arm is swung out from her side (0 = the normal walk, 1 = holding a bouquet).
  // Set from the game when she buys roses; see flowerArmPose() in src/flower-shop.js.
  let flowerPose = 0;
  const arms = [];
  [-1, 1].forEach((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.3, 1.6, 0);
    body.add(pivot);
    part(new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.42, 8, 16), dressMat), pivot, 0, -0.25, 0.02);
    part(new THREE.Mesh(new THREE.SphereGeometry(0.08, 18, 14), skinMat), pivot, 0, -0.5, 0.03);
    arms.push(pivot);
  });

  // Puffed sleeves with a lace cuff, on both arms
  arms.forEach((pv) => {
    const puff = part(new THREE.Mesh(new THREE.SphereGeometry(0.105, 12, 10), dressMat), pv, 0, -0.02, 0);
    puff.scale.set(1, 0.85, 1);
    const cuff = part(new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.014, 8, 20), petLaceMat), pv, 0, -0.4, 0);
    cuff.rotation.x = Math.PI / 2;
  });

  // The arm on the boy's side reaches out to hold his hand
  const handL = new THREE.Object3D();
  handL.position.set(0, -0.5, 0.03);
  arms[0].add(handL);

  // What she carries in her free hand. It starts as a single rose (her own), and the flower shop
  // fills it up: `handBouquet` is the group a bought rose is added to. See src/flower-shop.js.
  const handBouquet = new THREE.Group();
  handBouquet.position.set(0.06, -0.5, 0.06);
  // Tilted out to her side, not in: a positive z rotation would lay the blooms against her bodice
  // Tilted up and FORWARD (a positive x rotation brings the blooms round to her front; negative
  // lays them along her back) and out to her side (negative z). With a shallower tilt the stem of
  // her own rose grazed the waist of her dress.
  handBouquet.rotation.set(0.42, 0, -0.36);
  arms[1].add(handBouquet);
  const rose = new THREE.Group();
  part(new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), physMat({ color: '#c81e3c', roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2 })), rose, 0, 0.05, 0);
  part(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.35, 6), physMat({ color: '#2f7a4a' })), rose, 0, -0.14, 0);
  rose.position.set(0, 0.36, 0);
  handBouquet.add(rose);

  const head = part(new THREE.Mesh(new THREE.SphereGeometry(0.22, 40, 28), skinMat), body, 0, 2.0, 0);
  // Hair covers the crown and the back of the head, so the face stays visible
  part(new THREE.Mesh(new THREE.SphereGeometry(0.245, 40, 28, 0, Math.PI * 2, 0, Math.PI * 0.36), hairMat), head, 0, 0.03, 0);
  // Back of the head: a hair shell over the back half of the skull, down to the nape.
  // phi in [PI, 2PI] is the back (z <= 0), so no skin shows from behind.
  part(new THREE.Mesh(new THREE.SphereGeometry(0.252, 40, 28, Math.PI, Math.PI, 0, Math.PI * 0.62), hairMat), head, 0, 0, 0);
  addPrincessHairDetail(head, hairMat, 0.245);
  const princessBlinks = addPrincessFace(head);
  addTiara(head, goldMat);

  // Earrings: gold studs with a pink drop
  const pinkGemMat = physMat({ color: '#ff5f8f', roughness: 0.08, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03, emissive: '#3a0f1f' });
  [-1, 1].forEach((side) => {
    part(new THREE.Mesh(new THREE.SphereGeometry(0.017, 10, 8), goldMat), head, side * 0.216, -0.03, 0);
    part(new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), pinkGemMat), head, side * 0.222, -0.075, 0);
  });
  // A small pink bow on the side of the hair
  const bowMat = physMat({ color: '#ff8fab', roughness: 0.35, sheen: 0.6, sheenColor: new THREE.Color('#ffd6e2'), clearcoat: 0.5, clearcoatRoughness: 0.2 });
  [-1, 1].forEach((side) => {
    const loop = part(new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), bowMat), head, 0.2 + side * 0.03, 0.13, 0.12);
    loop.scale.set(1, 0.6, 0.5);
    loop.rotation.z = side * 0.5;
  });
  part(new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), bowMat), head, 0.2, 0.13, 0.125);

  // Two braids down her back. Each is a physics chain with a braided ribbon and a pink tie at the end
  const tieMat = physMat({ color: '#ff8fab', roughness: 0.35, sheen: 0.6, sheenColor: new THREE.Color('#ffd6e2'), clearcoat: 0.5, clearcoatRoughness: 0.2 });
  const braids = [-1, 1].map((side) => {
    const braid = createHairChain({
      parent: head,
      anchor: { x: side * 0.17, y: 0.02, z: -0.13 },
      lengths: [0.13, 0.13, 0.125, 0.12, 0.115],
      radii: [0.064, 0.064, 0.061, 0.058, 0.054],
      rest: { x: 0.1, z: side * 0.12 },
      stiffness: 30,
      damping: 4.5,
      drive: 2.2,
      material: hairMat,
      braid: { amp: 0.2, freq: 0.9 },
    });
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.066, 0.018, 8, 18), tieMat);
    tie.rotation.x = Math.PI / 2;
    tie.position.y = -0.1;
    braid.end.add(tie);
    return braid;
  });

  // ----- the boy: his own group, moved to his place beside her each frame -----
  const boy = new THREE.Group();
  boy.name = 'boy';
  root.add(boy);
  const coatMat = physMat({ color: COAT, roughness: 0.6, sheen: 0.7, sheenColor: new THREE.Color('#8e9ad0'), sheenRoughness: 0.5, normalMap: surfaceNormal('knit', 6), normalScale: new THREE.Vector2(0.35, 0.35) });
  const pantsMat = physMat({ color: PANTS, roughness: 0.7, sheen: 0.35, sheenColor: new THREE.Color('#3a3f66'), sheenRoughness: 0.6 });
  const boyHairMat = physMat({ color: '#1f1412', roughness: 0.48, clearcoat: 0.3, clearcoatRoughness: 0.35, normalMap: surfaceNormal('curl', 1), normalScale: new THREE.Vector2(0.4, 0.4) });
  const boyHairLightMat = physMat({ color: '#4b2a20', roughness: 0.48, clearcoat: 0.3, clearcoatRoughness: 0.35, normalMap: surfaceNormal('curl', 1), normalScale: new THREE.Vector2(0.4, 0.4) });
  const boyBody = new THREE.Group();
  boy.add(boyBody);
  const torso = part(new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.55, 12, 32), coatMat), boyBody, 0, 1.05, 0);
  const boyHead = part(new THREE.Mesh(new THREE.SphereGeometry(0.23, 40, 28), skinMat), boyBody, 0, 1.75, 0);
  addBoyHair(boyHead, boyHairMat, boyHairLightMat, 0.235);
  const boyBlinks = addBoyFace(boyHead, skinMat);
  // Neck, a white collar with a pink bow tie, a dark vest with gold buttons, lapels and a belt
  const boyShirtMat = physMat({ color: '#f7f4ef', roughness: 0.5, sheen: 0.3, sheenColor: new THREE.Color('#ffffff') });
  const vestMat = physMat({ color: '#3d4a7a', roughness: 0.6, sheen: 0.6, sheenColor: new THREE.Color('#6e7fc0'), sheenRoughness: 0.5, normalMap: surfaceNormal('knit', 6), normalScale: new THREE.Vector2(0.4, 0.4) });
  const lapelMat = physMat({ color: '#1f2542', roughness: 0.7 });
  const goldBtnMat = physMat({ color: '#e8c06a', metalness: 1, roughness: 0.2, clearcoat: 0.4 });
  const beltMat = physMat({ color: '#5a3a22', roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.4 });
  const bowTieMat = physMat({ color: '#e15a7a', roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2 });
  part(new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.11, 0.2, 12), skinMat), boyBody, 0, 1.6, 0);
  [-1, 1].forEach((side) => {
    const collar = part(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.035, 0.02), boyShirtMat), boyBody, side * 0.065, 1.48, 0.2);
    collar.rotation.z = side * -0.5;
  });
  [-1, 1].forEach((side) => {
    const wing = part(new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.09, 10), bowTieMat), boyBody, side * 0.045, 1.43, 0.25);
    wing.rotation.z = side * Math.PI / 2;
  });
  part(new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), bowTieMat), boyBody, 0, 1.43, 0.25);
  part(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.42, 0.04), vestMat), boyBody, 0, 1.15, 0.262);
  [1.22, 1.12, 1.02].forEach((y) => {
    part(new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), goldBtnMat), boyBody, 0, y, 0.29);
  });
  [-1, 1].forEach((side) => {
    const lapel = part(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.03), lapelMat), boyBody, side * 0.11, 1.25, 0.27);
    lapel.rotation.z = side * -0.35;
  });
  const belt = part(new THREE.Mesh(new THREE.TorusGeometry(0.272, 0.022, 8, 40), beltMat), boyBody, 0, 0.66, 0);
  belt.rotation.x = Math.PI / 2;
  part(new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.02), goldBtnMat), boyBody, 0, 0.66, 0.29);

  // Legs: hip, knee and foot, so the knee bends through each step
  const legs = [];
  const shins = [];
  const soleMat = physMat({ color: '#efe6dc', roughness: 0.6 });
  const shoeLaceMat = physMat({ color: '#ffffff' });
  [-0.13, 0.13].forEach((x) => {
    const hip = new THREE.Group();
    hip.position.set(x, 0.62, 0);
    boyBody.add(hip);
    part(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.31, 18), pantsMat), hip, 0, -0.155, 0);
    const knee = new THREE.Group();
    knee.position.set(0, -0.31, 0);
    hip.add(knee);
    part(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.31, 18), pantsMat), knee, 0, -0.155, 0);
    part(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.26), physMat({ color: SHOE, roughness: 0.35, clearcoat: 0.9, clearcoatRoughness: 0.1 })), knee, 0, -0.335, 0.05);
    part(new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.03, 0.28), soleMat), knee, 0, -0.39, 0.05);
    part(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.014, 0.03), shoeLaceMat), knee, 0, -0.282, 0.12);
    legs.push(hip);
    shins.push(knee);
  });

  // Free arm (his right) swings against his leg; the inner arm (his left) is stretched to her hand
  const freeArm = new THREE.Group();
  freeArm.position.set(-0.34, 1.35, 0);
  boyBody.add(freeArm);
  part(new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.42, 8, 16), coatMat), freeArm, 0, -0.27, 0);
  part(new THREE.Mesh(new THREE.SphereGeometry(0.085, 18, 14), skinMat), freeArm, 0, -0.56, 0);

  const innerShoulder = new THREE.Vector3(0.34, 1.35, 0);
  const innerArm = new THREE.Mesh(new THREE.CylinderGeometry(ARM_R, ARM_R, 1, 10), coatMat);
  boy.add(innerArm);
  const innerHand = new THREE.Mesh(new THREE.SphereGeometry(0.085, 18, 14), skinMat);
  boy.add(innerHand);

  const handWorld = new THREE.Vector3();
  const handLocal = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const mid = new THREE.Vector3();

  const reachLocal = new THREE.Vector3();
  const hangLocal = new THREE.Vector3();
  // Place the inner arm from the boy's shoulder to his hand (in boy-local space). The hand hangs
  // by his side and swings with the stride, or reaches for her hand while they hold hands.
  function stretchInnerArm(hold, s, walk) {
    root.updateMatrixWorld(true);
    handL.getWorldPosition(handWorld);
    boy.worldToLocal(reachLocal.copy(handWorld));
    hangLocal.set(innerShoulder.x, innerShoulder.y - 0.56, -0.28 * s * walk);
    handLocal.copy(hangLocal).lerp(reachLocal, hold);
    dir.copy(handLocal).sub(innerShoulder);
    const len = dir.length();
    if (len < 1e-4) return;
    mid.copy(innerShoulder).add(handLocal).multiplyScalar(0.5);
    innerArm.position.copy(mid);
    innerArm.quaternion.setFromUnitVectors(up, dir.divideScalar(len));
    innerArm.scale.set(1, len, 1);
    innerHand.position.copy(handLocal);
  }

  // Hair physics: the head's acceleration, in head space, drives the chains
  const headPos = new THREE.Vector3();
  const prevHead = new THREE.Vector3();
  const vel = new THREE.Vector3();
  const prevVel = new THREE.Vector3();
  const raw = new THREE.Vector3();
  const smooth = new THREE.Vector3();
  const accLocal = new THREE.Vector3();
  const headQ = new THREE.Quaternion();
  let hairReady = false;

  function updateHair(dt, sway) {
    head.getWorldPosition(headPos);
    if (!hairReady) {
      prevHead.copy(headPos);
      hairReady = true;
      return;
    }
    if (dt < 1e-4) return;
    vel.copy(headPos).sub(prevHead).divideScalar(dt);
    raw.copy(vel).sub(prevVel).divideScalar(dt);
    if (raw.length() > 40) raw.setLength(40);
    smooth.lerp(raw, Math.min(1, dt * 10));
    prevHead.copy(headPos);
    prevVel.copy(vel);
    head.getWorldQuaternion(headQ).invert();
    accLocal.copy(smooth).applyQuaternion(headQ);
    braids.forEach((braid) => braid.step(dt, accLocal, sway));
  }

  // ----- movement state -----
  const prevRoot = new THREE.Vector3();
  const rootPos = new THREE.Vector3();
  const boyTarget = new THREE.Vector3();
  const boyWorld = new THREE.Vector3();
  const offset = new THREE.Vector3(-FOLLOW_SIDE, 0, -FOLLOW_BACK);
  const offsetLocal = new THREE.Vector3();
  let boyYaw = 0;
  let rootReady = false;
  let phase = 0; // stride phase: advances with the distance the couple walks, so feet do not slide
  let amount = 0; // 0 standing, 1 walking, eased in and out
  let airAmount = 0; // 0 on the ground, 1 mid-jump, eased in and out
  let idleTime = 0;
  let waveAmount = 0;
  let lookYaw = 0; // how far the boy turns his head toward her

  // ----- hand holding and dances -----
  let sitting = false;
  let sitAmount = 0;
  let holding = false; // the player asked him to hold her hand
  let holdAmount = 0; // eased: 0 hand down, 1 hands joined
  let danceId = -1; // -1 no dance, otherwise an index into DANCE_NAMES
  let danceT = 0; // time spent in the current dance
  let danceAmount = 0; // eased: 0 walking, 1 dancing
  let spinAngle = 0; // how far she has turned in the spin dance
  // eased dance poses, so switching dances never snaps
  let armX = 0;
  let armZ = -0.12;
  let freeZ = 0;
  let turn = 0;

  function lerpAngle(a, b, t) {
    let diff = b - a;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return a + diff * t;
  }

  // Each dance has a rhythm (beats per bar) and its own poses. Times are in seconds.
  const NEUTRAL = { phi: -Math.PI / 2, R: 0.8, turn: 0, armX: 0, armZ: -0.12, freeZ: 0, roll: 0, bounce: 0, bounceAmt: 0, legRate: 0, legAmp: 0, feetAmp: 0 };
  function danceMotion() {
    if (danceId === 0) {
      // Waltz: 3 beats per bar. He stands in front-left and sways across her front; she turns a little toward him and holds his hand forward at chest height
      const b = (danceT * Math.PI * 2) / 2.0;
      return {
        phi: -Math.PI / 2 + 0.35 * Math.sin(b),
        R: 0.75,
        turn: -0.35 + 0.1 * Math.sin(b),
        armX: -0.9,
        armZ: -0.3,
        freeZ: 0,
        roll: 0.05 * Math.sin(b),
        bounce: 0.5 - 0.5 * Math.cos(3 * b),
        bounceAmt: 0.04,
        legRate: (Math.PI * 2) / 1.33, // one step each beat
        legAmp: 0.22,
        feetAmp: 0.6,
      };
    }
    if (danceId === 1) {
      // Spin: she turns once per bar, her hand held high, and he circles her, facing her. His free arm lifts.
      const b = (danceT * Math.PI * 2) / 2.4;
      return {
        phi: -Math.PI / 2 + spinAngle,
        R: 0.8,
        turn: 0,
        armX: -0.2,
        armZ: -2.3,
        freeZ: -1.1 + 0.15 * Math.sin(2 * b),
        roll: 0,
        bounce: 0.5 - 0.5 * Math.cos(2 * b),
        bounceAmt: 0.03,
        legRate: (Math.PI * 2) / 2.4,
        legAmp: 0.08,
        feetAmp: 0.15,
      };
    }
    if (danceId === 2) {
      // Lifted-hand sway: side steps and a body roll, her hand raised and waving gently
      const b = (danceT * Math.PI * 2) / 1.6;
      return {
        phi: -Math.PI / 2 + 0.3 * Math.sin(b),
        R: 0.8,
        turn: 0,
        armX: 0.3 * Math.sin(b),
        armZ: -1.35,
        freeZ: 0,
        roll: 0.08 * Math.sin(b),
        bounce: 0.5 - 0.5 * Math.cos(4 * b),
        bounceAmt: 0.035,
        legRate: (Math.PI * 2) / 1.6,
        legAmp: 0.3,
        feetAmp: 0.7,
      };
    }
    return NEUTRAL;
  }

  // The boy keeps his place beside her, or at the dance spot, and catches up if she moves on
  function followPrincess(dt, m) {
    root.getWorldPosition(rootPos);
    const yaw = root.rotation.y;
    // Holding hands brings him in closer
    const side = THREE.MathUtils.lerp(FOLLOW_SIDE, 0.75, holdAmount);
    const back = FOLLOW_BACK * (1 - holdAmount) * (1 - sitAmount);
    if (!rootReady) {
      prevRoot.copy(rootPos);
      boyWorld.copy(rootPos).add(offset.clone().applyAxisAngle(up, yaw));
      boyYaw = yaw;
      rootReady = true;
    }
    offsetLocal
      .set(
        THREE.MathUtils.lerp(-side, m.R * Math.sin(m.phi), danceAmount),
        0,
        THREE.MathUtils.lerp(-back, m.R * Math.cos(m.phi), danceAmount),
      )
      .applyAxisAngle(up, yaw);
    boyTarget.copy(rootPos).add(offsetLocal);
    boyWorld.lerp(boyTarget, 1 - Math.exp(-dt * FOLLOW_RATE));
    boyWorld.y = rootPos.y; // he rises and lands with her when she jumps
    const faceHer = lerpAngle(0, m.phi + Math.PI, danceAmount);
    boyYaw = lerpAngle(boyYaw, yaw + faceHer, 1 - Math.exp(-dt * FOLLOW_RATE));
    boy.position.copy(root.worldToLocal(boyWorld.clone()));
    boy.rotation.y = boyYaw - yaw;
  }

  function animate(dt, t, moving, airborne = false) {
    const step = Math.min(dt, 0.05);
    // distance walked since the last frame (ignores large jumps such as teleports)
    root.getWorldPosition(rootPos);
    const walked = Math.min(rootPos.distanceTo(prevRoot), 3.6 * step * 1.5);
    prevRoot.copy(rootPos);
    if (moving) phase += (walked / STRIDE) * Math.PI * 2;
    amount += ((moving ? 1 : 0) - amount) * Math.min(1, dt * 8);
    airAmount += ((airborne ? 1 : 0) - airAmount) * Math.min(1, dt * 14);
    const air = airAmount;

    sitAmount += ((sitting ? 1 : 0) - sitAmount) * (1 - Math.exp(-dt * 4));
    // Walking ends a dance; a dance holds hands
    if (moving) danceId = -1;
    const dancing = danceId >= 0;
    if (dancing) danceT += step;
    danceAmount += ((dancing ? 1 : 0) - danceAmount) * Math.min(1, dt * 4);
    holdAmount += ((holding || dancing ? 1 : 0) - holdAmount) * Math.min(1, dt * 6);

    // Her turn: she spins during the spin dance, then unwinds to face forward
    if (danceId === 1) {
      spinAngle += step * ((Math.PI * 2) / 2.4);
    } else {
      spinAngle = Math.atan2(Math.sin(spinAngle), Math.cos(spinAngle));
      spinAngle += -spinAngle * Math.min(1, dt * 2);
    }

    const m = danceMotion();
    const ease = Math.min(1, dt * 5);
    armX += (m.armX - armX) * ease;
    armZ += (m.armZ - armZ) * ease;
    freeZ += (m.freeZ - freeZ) * ease;
    turn += (m.turn - turn) * ease;

    // After a few seconds standing still, the boy waves his free hand
    idleTime = moving || dancing || sitting ? 0 : idleTime + dt;
    waveAmount += ((idleTime > 5 ? 1 : 0) - waveAmount) * Math.min(1, dt * 4);
    const idle = 1 - amount;
    const d = danceAmount;
    const walk = 1 - d;
    const s = Math.sin(phase); // walking stride
    const fd = danceT * m.legRate; // dance step rhythm
    const bounce = m.bounce * m.bounceAmt * d;

    followPrincess(dt, m);

    // He glances at her while he walks beside her, and keeps looking at her when he stands
    const toPrincess = Math.atan2(rootPos.x - boyWorld.x, rootPos.z - boyWorld.z) - boyYaw;
    const lookWant = clamp(toPrincess, -0.5, 0.5) * (1 - 0.5 * amount) * (1 - d);
    lookYaw += (lookWant - lookYaw) * Math.min(1, dt * 3);

    // Princess: body bobs twice per stride and sways; her feet step under the skirt
    bodice.scale.y = 1 + 0.012 * Math.sin(t * 1.9) * idle;
    body.position.y = Math.abs(s) * 0.04 * amount * walk + Math.sin(t * 1.6) * 0.01 * idle + bounce - sitAmount * 0.09;
    // Fold only the skirt at its waist; the upper body keeps its natural proportions.
    skirtPose.scale.y = 1 - 0.72 * sitAmount;
    skirtPose.scale.z = 1 + 0.15 * sitAmount;
    body.rotation.y = spinAngle + turn * d;
    body.rotation.z = s * 0.025 * amount * walk + m.roll * d;
    skirt.rotation.z = s * 0.05 * amount * walk + m.roll * d * 0.6;
    skirt.rotation.x = Math.abs(s) * 0.03 * amount * walk;
    shoeRest.forEach((x, i) => {
      const fw = phase + i * Math.PI;
      const fi = fd + i * Math.PI;
      feet[i].position.set(
        x,
        THREE.MathUtils.lerp(0.06 + Math.max(0, Math.cos(fw)) * 0.07 * amount * walk + Math.max(0, Math.cos(fi)) * 0.07 * m.feetAmp * d + 0.05 * air, 0.30, sitAmount),
        THREE.MathUtils.lerp(0.12 + Math.sin(fw) * 0.14 * amount * walk + Math.sin(fi) * 0.14 * m.feetAmp * d, 0.55, sitAmount),
      );
    });
    // Her arm on his side: hangs by default, reaches for his hand when holding, and takes the dance pose
    arms[0].rotation.x = Math.sin(phase) * 0.04 * amount * walk + armX * d;
    arms[0].rotation.z = THREE.MathUtils.lerp(THREE.MathUtils.lerp(-0.12, -0.6, holdAmount), armZ, d) - 0.35 * air;
    arms[1].rotation.x = -s * 0.35 * amount * walk * (1 - 0.6 * flowerPose) + 0.15 * idle - 0.15 * d * Math.sin(fd) + 0.1 * flowerPose;
    // With flowers in her hand the arm swings out and forward instead of brushing the skirt.
    // This arm sits at +x, so a positive z rotation is the one that carries it away from her.
    arms[1].rotation.z = 0.62 * flowerPose + Math.sin(t * 1.1) * 0.03 * flowerPose;
    // leaning out from her side; the more she carries, the further out it leans
    handBouquet.rotation.z = -0.33 - 0.10 * flowerPose + Math.sin(t * 0.9) * 0.03 * flowerPose;
    head.rotation.y = Math.sin(t * 0.7) * 0.08 * idle;
    head.rotation.z = m.roll * 0.5 * d;
    updateHair(dt, Math.sin(phase) * amount * 0.12 + Math.sin(t * 1.3) * 0.02 * idle + m.roll * d);

    // Boy: legs step in time with hers; knees bend in the forward swing
    legs.forEach((hip, i) => {
      const fw = phase + i * Math.PI;
      const fi = fd + i * Math.PI;
      hip.rotation.x = Math.sin(fw) * 0.5 * amount * walk + Math.sin(fi) * m.legAmp * d - 0.6 * air;
      shins[i].rotation.x = 0.85 * Math.max(0, Math.cos(fw)) * amount * walk + 2 * m.legAmp * Math.max(0, Math.cos(fi)) * d + 1.0 * air;
      hip.rotation.x = THREE.MathUtils.lerp(hip.rotation.x, -Math.PI * 0.48, sitAmount);
      shins[i].rotation.x = THREE.MathUtils.lerp(shins[i].rotation.x, Math.PI * 0.48, sitAmount);
    });
    boyBody.position.y = Math.abs(s) * 0.035 * amount * walk + Math.sin(t * 1.4 + 1) * 0.01 * idle + bounce - 0.06 * sitAmount;
    boyBody.rotation.z = s * 0.025 * amount * walk + m.roll * d;
    const wave = waveAmount;
    freeArm.rotation.x = -s * 0.5 * amount * (1 - wave) * walk;
    freeArm.rotation.z = wave * (-2.4 + Math.sin(t * 7) * 0.25) + freeZ * d;
    boyHead.rotation.y = lookYaw - Math.sin(t * 0.6) * 0.05 * idle;
    torso.scale.y = 1 + 0.012 * Math.sin(t * 2.1) * idle;
    // blinks: the eyes close for a moment every few seconds, at different times for each of them
    const pOpen = blinkFactor(t, 0, 4.1);
    princessBlinks.forEach((b) => {
      b.mesh.scale.y = b.base * pOpen;
    });
    const bOpen = blinkFactor(t, 1.7, 3.6);
    boyBlinks.forEach((b) => {
      b.mesh.scale.y = b.base * bOpen;
    });

    stretchInnerArm(holdAmount, s, amount * walk);
  }

  // The environment map (set once by the main scene) gives the materials real reflections
  function setEnvironment(texture) {
    charMats.forEach((m) => {
      m.envMap = texture;
      m.needsUpdate = true;
    });
  }

  function setDress(color) {
    dressMat.color.set(color);
  }

  // Heights and hair angles, for checks
  function measure() {
    const princessBox = new THREE.Box3().setFromObject(body);
    const boyBox = new THREE.Box3().setFromObject(boy);
    return {
      princessTop: +princessBox.max.y.toFixed(3),
      boyTop: +boyBox.max.y.toFixed(3),
      braids: braids.map((b) => b.angles()),
      boyWorld: [+boyWorld.x.toFixed(3), +boyWorld.z.toFixed(3)],
      princessWorld: [+rootPos.x.toFixed(3), +rootPos.z.toFixed(3)],
    };
  }

  function toggleHolding() {
    holding = !holding;
    return holding;
  }
  function isHolding() {
    return holding;
  }
  function danceName() {
    return danceId >= 0 ? DANCE_NAMES[danceId] : null;
  }
  // Cycles: no dance, then each dance in turn, then no dance again
  function nextDance() {
    danceId += 1;
    if (danceId >= DANCE_NAMES.length) danceId = -1;
    danceT = 0;
    return danceName();
  }

  function setSitting(value) {
    sitting = value;
    if (value) { danceId = -1; spinAngle = 0; }
  }

  function setFlowerPose(amount) {
    flowerPose = Math.min(1, Math.max(0, amount));
  }

  return {
    root, animate, setSitting, setDress, setEnvironment, measure, feet, stride: () => phase, toggleHolding, isHolding, nextDance, danceName,
    // for the flower shop: her free arm, the group a bought rose hangs from, and the pose it needs
    flowerArm: arms[1],
    bouquetGroup: handBouquet,
    // Her dress's own frame: the skirt profile lives here (the body is scaled as a whole), so any
    // check on what she carries has to be expressed in it.
    dressSpace: body,
    setFlowerPose,
  };
}
