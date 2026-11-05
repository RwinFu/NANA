import * as THREE from 'three';
import { surfaceNormal, clothWeave } from './surface.js';
import { CHAR } from './charpalette.js';
import { physMat, charMats } from './charmats.js';
import { blinkFactor, addPrincessFace, addBoyFace } from './faces.js';
import { createSkirt, addBodiceDetail, addHemPearls, dressMaterials } from './dress.js';
import { addPrincessHairDetail, addBoyHair } from './hairdetail.js';
import { guest, GUEST_LOOK } from './guest.js';

// The colours themselves live in charpalette.js, as one family; see the note there.
const SKIN = CHAR.skin;
const HAIR = CHAR.hair;
const COAT = CHAR.coat;
const PANTS = CHAR.trousers;
const SHOE = CHAR.boyShoe;
const ARM_R = 0.07;
// The princess is a small figure: her whole body is scaled down, so she is shorter than the boy
// and every part keeps the same proportions.
const PRINCESS_SCALE = 0.68;
// The boy walks beside her on her right side (her -x), a little behind, and follows her
const FOLLOW_SIDE = 0.95;
const FOLLOW_BACK = 0.45; // standing still: a step behind her
const FOLLOW_BACK_WALKING = 0.05; // walking, guest house only: level with her, so the pair walks side by side
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

  const gemPink = physMat({ color: '#ffa8c4', roughness: 0.18, metalness: 0.1, emissive: '#5c1830', emissiveIntensity: 0.4 });
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
  // A guest is not the princess, so she is not dressed as one: see src/guest.js. The two differences are
  // made here, at the two places that build them, rather than by a setting of colours alone -- a tiara is
  // geometry, not a colour, and so is a bow tie.
  const herDress = guest ? GUEST_LOOK.her.dress : dressColor;
  const herHair = guest ? GUEST_LOOK.her.hair : HAIR;
  const root = new THREE.Group();
  const body = new THREE.Group(); // bobs and sways while walking
  body.scale.setScalar(PRINCESS_SCALE);
  root.add(body);

  // Her satin: the colour comes from the player's avatar colour, with a coloured weave on the map slot
  // so the bell of the skirt is not one flat tone, and a fine jacquard on the normal slot so the fabric
  // catches the chandeliers as cloth.
  const dressMat = physMat({
    // A guest's dress is one plain colour: no satin weave, no jacquard, so it reads as a dress and not as a
    // costume. The family's satin is kept exactly as it was.
    color: herDress, map: guest ? null : clothWeave('satin', 3), roughness: guest ? 0.62 : 0.44, side: THREE.DoubleSide,
    sheen: guest ? 0.3 : 1, sheenColor: new THREE.Color(guest ? GUEST_LOOK.her.dressDeep : CHAR.dressLight), sheenRoughness: 0.3,
    normalMap: guest ? null : surfaceNormal('satin', 5), normalScale: new THREE.Vector2(0.34, 0.34),
  });
  const pinkGemMatBody = physMat({ color: '#ff6f9d', roughness: 0.08, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03, emissive: '#4a1226', emissiveIntensity: 0.35 });
  // Skin: warm, a little subsurface-looking. Clearcoat alone made it plasticky; a low sheen and a
  // slightly rosier sheen colour read as skin instead.
  const skinMat = physMat({
    color: SKIN, roughness: 0.58, sheen: 0.4, sheenColor: new THREE.Color('#ffab92'), sheenRoughness: 0.75,
    clearcoat: 0.06, clearcoatRoughness: 0.55,
  });
  const hairMat = physMat({
    color: herHair, roughness: 0.34, clearcoat: 0.45, clearcoatRoughness: 0.3,
    sheen: 0.5, sheenColor: new THREE.Color(CHAR.hairSheen), sheenRoughness: 0.45,
    normalMap: surfaceNormal('strands', 2), normalScale: new THREE.Vector2(0.4, 0.4),
  });
  const goldMat = physMat({ color: CHAR.gold, metalness: 1, roughness: 0.18, clearcoat: 0.5, clearcoatRoughness: 0.12 });
  const shoeMat = physMat({ color: CHAR.shoe, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.07 });

  // Skirt: a lathe with a soft bell shape. Her feet move under it while she walks.
  const skirtProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.72, 0.0),
    new THREE.Vector2(0.58, 0.55),
    new THREE.Vector2(0.38, 0.98),
    new THREE.Vector2(0.3, 1.1),
  ];
  // A guest's dress is plain: no lace, no pearls, no sash -- those are the princess's trim. The materials are
  // still made (the skirt asks for them), but nothing is added to the dress.
  const dressDet = dressMaterials();
  const skirt = createSkirt(dressMat, guest ? null : dressDet.lace, { embroidery: !guest, crystals: !guest });
  skirt.position.y = 0.12;
  body.add(skirt);

  // A lighter petticoat under the skirt, with a white lace edge along the hem
  const petticoat = new THREE.Mesh(
    new THREE.LatheGeometry(skirtProfile.map((p) => new THREE.Vector2(p.x * 0.93, p.y * 0.97)), 112),
    physMat({ color: CHAR.petticoat, roughness: 0.68, side: THREE.DoubleSide, map: clothWeave('satin', 4), sheen: 0.7, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.5 }),
  );
  petticoat.position.y = 0.1;
  body.add(petticoat);
  const petLaceMat = physMat({ color: CHAR.lace, roughness: 0.55, sheen: 1, sheenColor: new THREE.Color('#ffffff'), sheenRoughness: 0.45 });
  if (!guest) {
    const hem = part(new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.024, 12, 120), petLaceMat), body, 0, 0.13, 0);
    hem.rotation.x = Math.PI / 2;
    addHemPearls(body, dressDet.pearl);
  }

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

  // A sash at the waist with a bow at the back -- the princess's, not the guest's.
  // A warm, saturated sash: it has to separate from the dress, which is already pink-red.
  if (!guest) {
    const sashMat = physMat({ color: CHAR.sash, roughness: 0.26, sheen: 0.9, sheenColor: new THREE.Color('#ffe0ec'), sheenRoughness: 0.35, map: clothWeave('satin', 2) });
    const sash = part(new THREE.Mesh(new THREE.TorusGeometry(0.275, 0.034, 10, 40), sashMat), body, 0, 1.19, 0);
    sash.rotation.x = Math.PI / 2;
    [-1, 1].forEach((side) => {
      const loop = part(new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), sashMat), body, side * 0.06, 1.19, -0.3);
      loop.scale.set(0.9, 0.6, 0.45);
    });
    part(new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), sashMat), body, 0, 1.19, -0.31);
  }

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
  if (!guest) addBodiceDetail(body, dressDet);
  part(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.12, 12), skinMat), body, 0, 1.72, 0);
  // A gold choker with a pink pendant: hers, not the guest's (the guest's only jewellery is the earrings,
  // which are part of the face rather than the dress).
  if (!guest) {
    const choker = part(new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.012, 8, 28), goldMat), body, 0, 1.68, 0);
    choker.rotation.x = Math.PI / 2;
    part(new THREE.Mesh(new THREE.SphereGeometry(0.024, 10, 8), pinkGemMatBody), body, 0, 1.56, 0.22);
  }

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
  part(new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), physMat({ color: '#c92348', roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2 })), rose, 0, 0.05, 0);
  part(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.35, 6), physMat({ color: '#2f7a4a', roughness: 0.6 })), rose, 0, -0.14, 0);
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
  // A guest wears no tiara: the crown is what makes her the princess of this story, and the guests are not.
  if (!guest) addTiara(head, goldMat);

  // Earrings: gold studs with a pink drop
  const pinkGemMat = physMat({ color: '#ff5f8f', roughness: 0.08, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03, emissive: '#3a0f1f' });
  [-1, 1].forEach((side) => {
    part(new THREE.Mesh(new THREE.SphereGeometry(0.017, 10, 8), goldMat), head, side * 0.216, -0.03, 0);
    part(new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), pinkGemMat), head, side * 0.222, -0.075, 0);
  });
  // A small pink bow on the side of the hair. A guest has her hair down and plain, so no bow.
  if (!guest) {
    const bowMat = physMat({ color: '#ffa8c4', roughness: 0.32, sheen: 0.7, sheenColor: new THREE.Color('#ffe0ec'), clearcoat: 0.5, clearcoatRoughness: 0.2 });
    [-1, 1].forEach((side) => {
      const loop = part(new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), bowMat), head, 0.2 + side * 0.03, 0.13, 0.12);
      loop.scale.set(1, 0.6, 0.5);
      loop.rotation.z = side * 0.5;
    });
    part(new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), bowMat), head, 0.2, 0.13, 0.125);
  }

  // Two braids down her back. Each is a physics chain with a braided ribbon and a pink tie at the end
  const tieMat = physMat({ color: '#ffa8c4', roughness: 0.32, sheen: 0.7, sheenColor: new THREE.Color('#ffe0ec'), clearcoat: 0.5, clearcoatRoughness: 0.2 });
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
  // Who is who. The body above is the one the name and the stick depend on: the cats follow the character in
  // front, the footprint trail spawns under the feet in front, and the decorations are measured from the head
  // in front. A guest can walk in as the boy (see setSwap below), and then that character is the one standing
  // here -- so the labels move with the role. The family's house never swaps.
  let leadName = 'princess';
  let secondName = 'boy';
  // His coat: a slate blue with a real tweed on both slots, so it is cloth at arm's length and does not
  // read as a silhouette beside her.
  // A guest wears a suit: coat and trousers in one cloth, no tweed, no epaulettes, a plain tie instead of a
  // bow tie. Everything below reads `guest` and leaves the family's boy exactly as he was.
  const coatMat = physMat(guest
    ? { color: GUEST_LOOK.him.suit, roughness: 0.52, sheen: 0.5, sheenColor: new THREE.Color(GUEST_LOOK.him.suitLight), sheenRoughness: 0.4 }
    : { color: COAT, roughness: 0.54, sheen: 0.85, sheenColor: new THREE.Color(CHAR.coatLight), sheenRoughness: 0.42, map: clothWeave('tweed', 5), normalMap: surfaceNormal('tweed', 4), normalScale: new THREE.Vector2(0.5, 0.5) });
  const pantsMat = physMat(guest
    ? { color: GUEST_LOOK.him.suit, roughness: 0.58, sheen: 0.4, sheenColor: new THREE.Color(GUEST_LOOK.him.suitLight), sheenRoughness: 0.45 }
    : { color: PANTS, roughness: 0.62, sheen: 0.5, sheenColor: new THREE.Color('#55608c'), sheenRoughness: 0.5, map: clothWeave('tweed', 9), normalMap: surfaceNormal('tweed', 8), normalScale: new THREE.Vector2(0.35, 0.35) });
  const boyHairMat = physMat({ color: guest ? GUEST_LOOK.him.hair : CHAR.boyHair, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.3, sheen: 0.4, sheenColor: new THREE.Color('#8a5a44'), sheenRoughness: 0.5, normalMap: surfaceNormal('curl', 1), normalScale: new THREE.Vector2(0.42, 0.42) });
  const boyHairLightMat = physMat({ color: guest ? '#3a2a22' : CHAR.boyHairLight, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.3, sheen: 0.45, sheenColor: new THREE.Color('#c08464'), sheenRoughness: 0.5, normalMap: surfaceNormal('curl', 1), normalScale: new THREE.Vector2(0.42, 0.42) });
  const boyBody = new THREE.Group();
  boy.add(boyBody);
  const torso = part(new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.55, 12, 32), coatMat), boyBody, 0, 1.05, 0);
  const boyHead = part(new THREE.Mesh(new THREE.SphereGeometry(0.23, 40, 28), skinMat), boyBody, 0, 1.75, 0);
  addBoyHair(boyHead, boyHairMat, boyHairLightMat, 0.235);
  const boyBlinks = addBoyFace(boyHead, skinMat);
  // Neck, a white collar with a pink bow tie, a dark vest with gold buttons, lapels and a belt
  const boyShirtMat = physMat({ color: guest ? GUEST_LOOK.him.shirt : CHAR.shirt, roughness: 0.48, sheen: 0.4, sheenColor: new THREE.Color('#ffffff'), map: guest ? null : clothWeave('tweed', 8) });
  const vestMat = physMat({ color: guest ? GUEST_LOOK.him.tie : CHAR.vest, roughness: 0.55, sheen: 0.7, sheenColor: new THREE.Color(CHAR.coatLight), sheenRoughness: 0.45, map: guest ? null : clothWeave('tweed', 6), normalMap: guest ? null : surfaceNormal('tweed', 5), normalScale: new THREE.Vector2(0.45, 0.45) });
  const lapelMat = physMat({ color: '#232a49', roughness: 0.65, sheen: 0.5, sheenColor: new THREE.Color('#5d6b9e'), map: clothWeave('tweed', 10) });
  const goldBtnMat = physMat({ color: CHAR.gold, metalness: 1, roughness: 0.2, clearcoat: 0.4 });
  const beltMat = physMat({ color: CHAR.belt, roughness: 0.45, clearcoat: 0.35, clearcoatRoughness: 0.4, normalMap: surfaceNormal('tweed', 12), normalScale: new THREE.Vector2(0.3, 0.3) });
  const bowTieMat = physMat({ color: CHAR.bowTie, roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.18, map: clothWeave('satin', 6) });
  part(new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.11, 0.2, 12), skinMat), boyBody, 0, 1.6, 0);
  [-1, 1].forEach((side) => {
    const collar = part(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.035, 0.02), boyShirtMat), boyBody, side * 0.065, 1.48, 0.2);
    collar.rotation.z = side * -0.5;
  });
  if (guest) {
    // A tie: one flat blade down the front of the shirt, from the collar to the belt.
    const tieMat = physMat({ color: GUEST_LOOK.him.tie, roughness: 0.4, sheen: 0.6, sheenColor: new THREE.Color('#5b6478') });
    const knot = part(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.045, 0.03), tieMat), boyBody, 0, 1.44, 0.25);
    knot.rotation.x = 0.1;
    const blade = part(new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.34, 0.02), tieMat), boyBody, 0, 1.26, 0.265);
    blade.rotation.x = 0.04;
  } else {
    [-1, 1].forEach((side) => {
      const wing = part(new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.09, 10), bowTieMat), boyBody, side * 0.045, 1.43, 0.25);
      wing.rotation.z = side * Math.PI / 2;
    });
    part(new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), bowTieMat), boyBody, 0, 1.43, 0.25);
  }
  // The waistcoat with its three gold buttons is the family's boy; a guest's jacket is closed over his shirt.
  if (!guest) {
    part(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.42, 0.04), vestMat), boyBody, 0, 1.15, 0.262);
    [1.22, 1.12, 1.02].forEach((y) => {
      part(new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), goldBtnMat), boyBody, 0, y, 0.29);
    });
  }
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

  // The tailoring that makes a coat a coat. Without it the torso was one flat capsule of slate blue:
  // no lapel line, no pockets, no cuffs, nothing to tell the eye it is wool. These are all small
  // boxes and tori sitting a few millimetres proud of the same capsule.
  {
    const coatTrim = physMat({ color: '#232a49', roughness: 0.62, sheen: 0.6, sheenColor: new THREE.Color(CHAR.coatLight), map: clothWeave('tweed', 8) });
    const brass = physMat({ color: CHAR.gold, metalness: 1, roughness: 0.25 });
    // a front seam down the coat's placket, and the two side seams
    part(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.62, 0.015), coatTrim), boyBody, 0, 1.1, 0.272);
    // an open notch collar: two flat wedges turned out from the chest
    [-1, 1].forEach((side) => {
      const notch = part(new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.16, 0.015), coatTrim), boyBody, side * 0.11, 1.36, 0.24);
      notch.rotation.z = side * -0.5;
      notch.rotation.y = side * 0.35;
    });
    // flap pockets at the hips, with a button on each
    [-1, 1].forEach((side) => {
      const pocket = part(new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.055, 0.02), coatTrim), boyBody, side * 0.15, 0.78, 0.245);
      pocket.rotation.z = side * 0.06;
      part(new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 6), brass), boyBody, side * 0.15, 0.755, 0.262);
    });
    // shoulder epaulettes, so the silhouette has a corner at each shoulder -- the family's boy only: a suit
    // has a plain shoulder.
    if (!guest) {
      [-1, 1].forEach((side) => {
        const ep = part(new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.02, 0.1), coatTrim), boyBody, side * 0.2, 1.335, 0.02);
        ep.rotation.z = side * -0.28;
        part(new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), brass), boyBody, side * 0.265, 1.363, 0.02);
      });
    }
    // vent seams at the back, and a half belt across the back of the coat
    part(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.035, 0.02), coatTrim), boyBody, 0, 0.86, -0.262);
    [-1, 1].forEach((side) => {
      part(new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 6), brass), boyBody, side * 0.12, 0.86, -0.272);
    });
  }

  // Free arm (his right) swings against his leg; the inner arm (his left) is stretched to her hand
  const freeArm = new THREE.Group();
  freeArm.position.set(-0.34, 1.35, 0);
  boyBody.add(freeArm);
  part(new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.42, 8, 16), coatMat), freeArm, 0, -0.27, 0);
  // a turned-back cuff in the darker wool, so the sleeve ends in something
  part(new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.082, 0.06, 14), physMat({ color: '#232a49', roughness: 0.6, map: clothWeave('tweed', 8) })), freeArm, 0, -0.44, 0);
  part(new THREE.Mesh(new THREE.SphereGeometry(0.085, 18, 14), skinMat), freeArm, 0, -0.56, 0);

  // His arm on her side, and her arm on his: which side that is depends on where they stand (side_sign), so
  // the arm is placed from the shoulder's own x rather than from a fixed positive one.
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
    if (alone) hold = 0;
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
  const offsetLocal = new THREE.Vector3();
  let boyYaw = 0;
  let rootReady = false;
  // +1 puts him beside her right hand, -1 beside his left. -1 is a guest who walks in as the boy (setSwap).
  let side_sign = 1;
  // A guest walks in alone: the second character is hidden and its place beside her is emptied (setSwap). The
  // family's house has the two of them, so this is false for it and every line below that reads it is a no-op.
  let alone = false;
  // Where the second character stands, a step behind and to one side. Written once here and looked at every
  // frame, so a swap made after this line (and after the model is built) is picked up on the next frame.
  const offset = new THREE.Vector3(-FOLLOW_SIDE, 0, -FOLLOW_BACK);
  function sideOf(back, hold, sit) {
    offset.x = side_sign * -THREE.MathUtils.lerp(FOLLOW_SIDE, 0.75, hold);
    offset.z = -back * (1 - sit);
    // Alone, he is put level with her and very close: a hidden character still has to be *somewhere*, and this
    // is the one place that cannot be seen even if it turned out to be in the way.
    if (alone) {
      offset.x = 0;
      offset.z = 0;
    }
    return offset;
  }
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
  // ---- the turn ---------------------------------------------------------------------------------------
  // `facing` is where she is *really* pointed (the controls own it); `turnYaw` is where the model is drawn,
  // which lags a little behind it and eases into it. The gap is the animation: head first, body after, and the
  // things that hang off her trailing behind that. See the turn block inside `animate`.
  let facingYaw = 0;
  let turnYaw = null; // starts synced to the facing on the first frame
  let turnSpeed = 0;
let turnVel = 0;
let boyVel = 0;
  let headLead = 0;
  let turnSwing = 0;
  // The turn is a bell curve, not an exponential: the angular velocity ramps up, holds, and eases into the new
// facing. At these numbers a ninety-degree turn takes about a third of a second and the body is never more than
// ~14 degrees behind where she is really pointed, so she does not visibly slide sideways while it catches up.
const TURN_GAIN = 14; // how hard it pulls towards the target angle
const TURN_MAX_VEL = 7.5; // radians/second
const TURN_ACCEL = 60; // radians/second squared: the ramp at the start and the brake at the end
  function shortestArc(from, to) {
    let d = to - from;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  }
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
    // Holding hands brings him in closer. The step back is no longer a constant: standing still he is beside
    // her and a step behind, and the moment they walk he comes level with her, so his walk -- his own face
    // turned to the way they are going -- is the pair walking side by side instead of one pair of feet
    // behind the other. The dances own their own place (m.phi), so it is only the walk this moves.
    // Alone, the second character is the one the camera is looking at: its offset from the root is zero, so the
    // character the guest chose stands exactly where the pair's middle was, under the same camera.
    const lone = alone ? 0 : 1;
    const side = side_sign * lone * THREE.MathUtils.lerp(FOLLOW_SIDE, 0.75, holdAmount);
    const back = lone * THREE.MathUtils.lerp(FOLLOW_BACK, guest ? FOLLOW_BACK_WALKING : FOLLOW_BACK, amount) * (1 - holdAmount) * (1 - sitAmount);
    if (!rootReady) {
      prevRoot.copy(rootPos);
      boyWorld.copy(rootPos).add(sideOf(back, holdAmount, sitAmount).clone().applyAxisAngle(up, yaw));
      boyYaw = yaw;
      rootReady = true;
    }
    offsetLocal
      .set(
        THREE.MathUtils.lerp(-side, side_sign * m.R * Math.sin(m.phi), danceAmount),
        0,
        THREE.MathUtils.lerp(-back, m.R * Math.cos(m.phi), danceAmount),
      )
      .applyAxisAngle(up, yaw);
    boyTarget.copy(rootPos).add(offsetLocal);
    boyWorld.lerp(boyTarget, 1 - Math.exp(-dt * FOLLOW_RATE));
    boyWorld.y = rootPos.y; // he rises and lands with her when she jumps
    const faceHer = lerpAngle(0, m.phi + Math.PI, danceAmount);
    // He does not snap round either. The rate below is his *position*, which has to keep up or he trails her
    // like a balloon; his facing gets the same bell curve she has, or he pivots on the spot the instant she turns.
    const boyWant = shortestArc(boyYaw, yaw + faceHer);
    boyVel += clamp(clamp(boyWant * TURN_GAIN, -TURN_MAX_VEL, TURN_MAX_VEL) - boyVel, -TURN_ACCEL * dt, TURN_ACCEL * dt);
    boyYaw += boyVel * dt;
    if (Math.abs(shortestArc(boyYaw, yaw + faceHer)) < 0.004) { boyYaw = yaw + faceHer; boyVel = 0; }
    boy.position.copy(root.worldToLocal(boyWorld.clone()));
    boy.rotation.y = shortestArc(0, boyYaw - turnYaw);
  }

  function animate(dt, t, moving, airborne = false) {
    if (alone) { holding = false; danceId = -1; }
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

    // ---- the turn -----------------------------------------------------------------------------------
    // `root.rotation.y` is what the controls set the instant she changes direction, which snaps her whole body
    // round: 18 degrees on the first frame of a turn at 60 fps, 36 at 30, and then a constant-rate spin for the
    // rest of it. That is what "the turning looks artificial" is -- a body is not a turntable.
    //
    // So the model lags behind the *true* facing, smoothly, and the lag is what gets animated: her head goes
    // first, her body follows on an ease, and what hangs off her (skirt, hair, the arm on his side) keeps
    // trailing a moment after the body has stopped. All of it is cosmetic -- the facing the game uses for
    // walking, for the camera and for the necklace is untouched.
    if (turnYaw === null) { turnYaw = facingYaw; root.rotation.y = turnYaw; }
    const wantArc = shortestArc(turnYaw, facingYaw);
    // how fast we *want* to be turning: proportional to how far there is left, capped
    const wantVel = clamp(wantArc * TURN_GAIN, -TURN_MAX_VEL, TURN_MAX_VEL);
    // ...and the angular velocity itself ramps, so the very first frame of a turn is the slowest, not the fastest
    turnVel += clamp(wantVel - turnVel, -TURN_ACCEL * step, TURN_ACCEL * step);
    const turnRate = turnYaw + turnVel * step;
    const turnDelta = shortestArc(turnYaw, turnRate);
    turnYaw = turnRate;
    // never overshoot the target: if we would pass it this frame, land on it and stop
    if (Math.abs(shortestArc(turnYaw, facingYaw)) < 0.004 || Math.sign(turnVel) !== Math.sign(shortestArc(turnYaw, facingYaw))) {
      if (Math.abs(shortestArc(turnYaw, facingYaw)) < 0.004) { turnYaw = facingYaw; turnVel = 0; }
    }
    // how hard is she turning right now, in radians per second
    const turnNow = Math.abs(turnDelta) / Math.max(step, 1e-4);
    turnSpeed += (turnNow - turnSpeed) * Math.min(1, step * 10);
    const turning = Math.min(1, turnSpeed / 2.6);
    // her head leads the turn, and settles after it
    headLead += ((turnDelta / Math.max(step, 1e-4)) * 0.045 - headLead) * Math.min(1, step * 9);
    headLead = clamp(headLead, -0.34, 0.34);
    // and what she is wearing swings out sideways while she turns
    turnSwing += (clamp(-(turnDelta / Math.max(step, 1e-4)) * 0.055, -0.24, 0.24) - turnSwing) * Math.min(1, step * 4);
    root.rotation.y = turnYaw;
    // a short step under her, so a turn has feet in it (a quarter of a stride, only while she is turning)
    phase += turning * step * 2.0;

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
    // He glances at her, idles, and leads his own turn with his head -- all in one place, after lookYaw is
    // current. (This used to be split: the glance set here, the head lead set earlier in followPrincess from
    // the previous frame's value, which meant his head was a frame behind his body and often not set at all.)
    boyHead.rotation.y = lookYaw - Math.sin(t * 0.6) * 0.05 * idle + clamp(boyVel * 0.05, -0.2, 0.2);

    // Princess: body bobs twice per stride and sways; her feet step under the skirt
    bodice.scale.y = 1 + 0.012 * Math.sin(t * 1.9) * idle;
    body.position.y = Math.abs(s) * 0.04 * amount * walk + Math.sin(t * 1.6) * 0.01 * idle + bounce - sitAmount * 0.09;
    // Fold only the skirt at its waist; the upper body keeps its natural proportions.
    skirtPose.scale.y = 1 - 0.72 * sitAmount;
    skirtPose.scale.z = 1 + 0.15 * sitAmount;
    body.rotation.y = spinAngle + turn * d - headLead * 0.55;
    body.rotation.z = s * 0.025 * amount * walk + m.roll * d + turnSwing * 0.12;
    skirt.rotation.z = s * 0.05 * amount * walk + m.roll * d * 0.6 + turnSwing * 0.7;
    skirt.rotation.x = Math.abs(s) * 0.03 * amount * walk - turnSwing * 0.3;
    shoeRest.forEach((x, i) => {
      const fw = phase + i * Math.PI;
      const fi = fd + i * Math.PI;
      feet[i].position.set(
        x,
        THREE.MathUtils.lerp(0.06 + Math.max(0, Math.cos(fw)) * 0.07 * amount * walk + Math.max(0, Math.cos(fi)) * 0.07 * m.feetAmp * d + 0.05 * air, 0.30, sitAmount),
        THREE.MathUtils.lerp(0.12 + Math.sin(fw) * 0.14 * amount * walk + Math.sin(fi) * 0.14 * m.feetAmp * d, 0.55, sitAmount),
      );
    });
    // Her arm on his side: hangs by default, reaches for his hand when holding, and takes the dance pose. With
    // nobody there it turns in a little, holding the rose out in front of her instead of out to one side.
    arms[0].rotation.x = Math.sin(phase) * 0.04 * amount * walk + armX * d + 0.16 * (alone ? 1 : 0);
    arms[0].rotation.z = THREE.MathUtils.lerp(THREE.MathUtils.lerp(-0.12, -0.6, holdAmount), armZ, d) - 0.35 * air + turnSwing * 0.8;
    arms[1].rotation.x = -s * 0.35 * amount * walk * (1 - 0.6 * flowerPose) + 0.15 * idle - 0.15 * d * Math.sin(fd) + 0.1 * flowerPose;
    // With flowers in her hand the arm swings out and forward instead of brushing the skirt.
    // This arm sits at +x, so a positive z rotation is the one that carries it away from her.
    arms[1].rotation.z = 0.62 * flowerPose + Math.sin(t * 1.1) * 0.03 * flowerPose;
    // leaning out from her side; the more she carries, the further out it leans
    handBouquet.rotation.z = -0.33 - 0.10 * flowerPose + Math.sin(t * 0.9) * 0.03 * flowerPose;
    head.rotation.y = Math.sin(t * 0.7) * 0.08 * idle + headLead;
    head.rotation.z = m.roll * 0.5 * d;
    updateHair(dt, Math.sin(phase) * amount * 0.12 + Math.sin(t * 1.3) * 0.02 * idle + m.roll * d + turnSwing * 1.6);

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
    boyBody.rotation.z = s * 0.025 * amount * walk + m.roll * d + clamp(-boyVel * 0.045, -0.12, 0.12);
    const wave = waveAmount;
    freeArm.rotation.x = -s * 0.5 * amount * (1 - wave) * walk;
    freeArm.rotation.z = wave * (-2.4 + Math.sin(t * 7) * 0.25) + freeZ * d;
    // (his head lead is set with his yaw in followPrincess; this keeps the idle look on top of it)
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

  // A guest walks in alone. The start screen asks which of the two the visitor is, and the house keeps that one
  // and puts the other away: she walks on her own, or he does. The family's house never asks and never hides
  // anybody, so nothing here is reached for it (it only runs with `guest` true).
  //
  // The rig is always the same couple; `alone` just stops drawing the second character and mirrors her body so
  // that the hand reaching out into empty air becomes the hand carrying her flowers, on the side away from him.
  // Emptying the second character's place also puts out everything that was aimed at the pair -- the waves, the
  // dances -- rather than leaving her dancing with nobody.
  function setSwap(asHim) {
    alone = true;
    // The one left in front: the boy when the guest is him, her otherwise. The other one is not built a second
    // time -- it is hidden, and its place beside the one who stayed is emptied.
    boy.visible = asHim;
    body.visible = !asHim;
    // Her own body is mirrored down the x axis, which moves the hand he held and the flowers to the other side
    // in one line: her arms are numbered, not sided -- arms[0] reaches for his hand, arms[1] carries the bouquet
    // -- and the hand and the bouquet are children of them. Three.js flips the winding for a negative
    // determinant on its own, so nothing here shows an inside-out sleeve.
    body.scale.set((asHim ? -1 : 1) * PRINCESS_SCALE, PRINCESS_SCALE, PRINCESS_SCALE);
    leadName = asHim ? 'boy' : 'princess';
    secondName = asHim ? 'princess' : 'boy';
    // Nothing to hold, nobody to dance with: the pair's own states are cleared, and stay cleared (see the guard
    // in animate()), so a key press or a button cannot bring the empty place back into the picture.
    holding = false;
    danceId = -1;
    holdAmount = 0;
    danceAmount = 0;
    waveAmount = 0;
  }

  // `color` is a colour, or nothing. Nothing means "leave her as she was built": a guest's dress colour comes
  // from GUEST_LOOK, and every caller that used to repaint her now passes nothing for a guest (see setHerDress()
  // in main.js). Ignoring an empty value here is the belt to that braces: no stored colour can reach her.
  function setDress(color) {
    if (!color) return;
    dressMat.color.set(color);
  }

  // Heights and hair angles, for checks
  function measure() {
    const princessBox = new THREE.Box3().setFromObject(body);
    const boyBox = new THREE.Box3().setFromObject(boy);
    return {
      // `princessTop` is the head of whoever is in front -- the pair is what the house's decor (the hair
      // sparkles over her head) and the necklaces are measured from, and after setSwap() that is him.
      princessTop: +(leadName === 'boy' ? boyBox.max.y : princessBox.max.y).toFixed(3),
      boyTop: +boyBox.max.y.toFixed(3),
      braids: braids.map((b) => b.angles()),
      boyWorld: [+boyWorld.x.toFixed(3), +boyWorld.z.toFixed(3)],
      princessWorld: [+rootPos.x.toFixed(3), +rootPos.z.toFixed(3)],
    };
  }

  function toggleHolding() {
    if (alone) return false; // there is nobody beside her to take by the hand
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
    if (alone) return null; // the dances are for two
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
    // The game owns where she is really pointed; the model eases its own facing towards it so turns are animated
    // rather than snapped. `setFacing` is called every frame from the walk controls with the true heading.
    setFacing(yaw) { facingYaw = yaw; },
    facing: () => facingYaw,
    drawnFacing: () => turnYaw,
    // Who is in front -- 'princess' (the family's house, always) or 'boy' (a guest who chose him). The cats
    // read this instead of assuming names: they follow the character the player is walking.
    lead: () => leadName,
    second: () => secondName,
    setSwap,
    // for the flower shop: her free arm, the group a bought rose hangs from, and the pose it needs
    flowerArm: arms[1],
    bouquetGroup: handBouquet,
    // Her dress's own frame: the skirt profile lives here (the body is scaled as a whole), so any
    // check on what she carries has to be expressed in it.
    dressSpace: body,
    setFlowerPose,
  };
}
