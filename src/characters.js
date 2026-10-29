import * as THREE from 'three';

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
const FOLLOW_SIDE = 0.85;
const FOLLOW_BACK = 0.12;
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

// Front face: eyes with a dark iris and catch-light, a soft lash line, brows and a small smile.
// Everything sits on the front of the head (+z), so the face stays visible.
function addPrincessFace(head, skinMat) {
  const irisMat = new THREE.MeshStandardMaterial({ color: '#3b2319', roughness: 0.35 });
  const shineMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const lashMat = new THREE.MeshStandardMaterial({ color: '#1e1210', roughness: 0.5 });
  const cheekMat = new THREE.MeshStandardMaterial({ color: '#f58fa6', roughness: 0.7, transparent: true, opacity: 0.75 });
  const lipMat = new THREE.MeshStandardMaterial({ color: '#c93d61', roughness: 0.4 });
  [-1, 1].forEach((side) => {
    const x = side * 0.08;
    const eye = part(new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 12), irisMat), head, x, 0.0, 0.205);
    eye.scale.set(1, 1.25, 0.6);
    part(new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), shineMat), head, x + side * 0.009, 0.012, 0.228);
    // upper lash line: a half ring over the top of the eye
    const lash = part(new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.008, 6, 18, Math.PI * 0.9), lashMat), head, x, 0.0, 0.212);
    lash.rotation.z = Math.PI * 0.05;
    lash.scale.set(1, 1.1, 0.6);
    // soft brow, slightly lifted at the outer end
    const brow = part(new THREE.Mesh(new THREE.CapsuleGeometry(0.007, 0.055, 3, 6), lashMat), head, x, 0.078, 0.2);
    brow.rotation.z = Math.PI / 2 - side * 0.12;
    const cheek = part(new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), cheekMat), head, side * 0.13, -0.06, 0.18);
    cheek.scale.set(1, 0.7, 0.4);
  });
  part(new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), skinMat), head, 0, -0.03, 0.222).scale.set(1, 1.2, 0.8);
  // smile: the lower half of a small ring
  const smile = part(new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.0072, 6, 14, Math.PI), lipMat), head, 0, -0.095, 0.205);
  smile.rotation.z = Math.PI;
}

// Boy's face: the same eyes and brows, with a simple smile
function addBoyFace(head) {
  const irisMat = new THREE.MeshStandardMaterial({ color: '#1d1410', roughness: 0.4 });
  const browMat = new THREE.MeshStandardMaterial({ color: '#1f1412', roughness: 0.6 });
  const shineMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  [-1, 1].forEach((side) => {
    const x = side * 0.08;
    const eye = part(new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 10), irisMat), head, x, 0.0, 0.2);
    eye.scale.set(1, 1.25, 0.6);
    part(new THREE.Mesh(new THREE.SphereGeometry(0.007, 8, 6), shineMat), head, x + side * 0.008, 0.01, 0.222);
    const brow = part(new THREE.Mesh(new THREE.CapsuleGeometry(0.006, 0.05, 3, 6), browMat), head, x, 0.068, 0.19);
    brow.rotation.z = Math.PI / 2;
  });
  const smile = part(new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.0065, 6, 12, Math.PI), new THREE.MeshStandardMaterial({ color: '#b5485f', roughness: 0.5 })), head, 0, -0.09, 0.2);
  smile.rotation.z = Math.PI;
}

// A smooth ribbon that follows a list of points (in the space of its parent). It is rebuilt
// each frame from the hair joints, so the hair reads as one flowing strand, not as beads.
function createRibbon(material, radialSegs = 8, spine = 14) {
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
        const c = Math.cos(a) * r;
        const d = Math.sin(a) * r;
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
function createHairChain({ parent, anchor, lengths, radii, rest, stiffness, damping, drive, material }) {
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

  const ribbon = createRibbon(material);
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

  return { step, angles: () => joints.map((j) => [+j.ax.toFixed(3), +j.az.toFixed(3)]) };
}

// Curly hair for the boy: a cloud of small curls over the crown, the sides and the nape,
// sitting on top of the smooth base so there are no bald gaps. Positions are fixed, so the
// curls stay put on the head and move with it.
function addCurlyHair(head, mat, headR) {
  const geometry = new THREE.SphereGeometry(1, 10, 8);
  const rings = [
    { theta: 0.26, count: 9, r: 0.043 },
    { theta: 0.5, count: 13, r: 0.046 },
    { theta: 0.74, count: 16, r: 0.05 },
    { theta: 0.95, count: 18, r: 0.048 },
    { theta: 1.4, count: 14, r: 0.05, back: true },
  ];
  rings.forEach((ring, ri) => {
    for (let i = 0; i < ring.count; i += 1) {
      const u = i / ring.count;
      // a fixed, varied jitter so the curls look natural but never change between frames
      const jitter = Math.abs(Math.sin((i + 1) * 12.9898 + ri * 78.233) * 43758.5453) % 1;
      const a = ring.back
        ? Math.PI + (u - 0.5) * 2.2
        : (u + (ri % 2) * 0.5 / ring.count) * Math.PI * 2;
      const theta = ring.theta + (jitter - 0.5) * 0.08;
      const rr = headR + ring.r * 0.55;
      const sinT = Math.sin(theta);
      const curl = new THREE.Mesh(geometry, mat);
      curl.position.set(rr * sinT * Math.sin(a), rr * Math.cos(theta), rr * sinT * Math.cos(a));
      const size = ring.r * (0.9 + jitter * 0.25);
      curl.scale.setScalar(size);
      head.add(curl);
    }
  });
}

// Bangs for the princess: a fringe of tapered strands that starts at the hairline and falls
// over the forehead, stopping above the eyebrows. Each strand fans out a little, so it reads as
// soft, swept-aside bangs.
function addBangs(head, mat, headR) {
  [-2, -1, 0, 1, 2].forEach((k) => {
    const a0 = k * 0.2;
    const sweep = k * 0.08;
    const pts = [0.5, 0.78, 0.98, 1.1].map((theta, j) => {
      const rr = headR + 0.012 + 0.012 * j;
      const a = a0 + sweep * (j / 3);
      const sinT = Math.sin(theta);
      return new THREE.Vector3(rr * sinT * Math.sin(a), rr * Math.cos(theta), rr * sinT * Math.cos(a));
    });
    const radius = 0.017 + 0.004 * (2 - Math.abs(k));
    const strand = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, radius, 6, false),
      mat,
    );
    head.add(strand);
  });
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

  const gemPink = new THREE.MeshStandardMaterial({ color: '#ff8fab', roughness: 0.2, metalness: 0.1, emissive: '#4a1426' });
  const gemBlue = new THREE.MeshStandardMaterial({ color: '#8ec5ff', roughness: 0.2, metalness: 0.1 });
  const pearlMat = new THREE.MeshStandardMaterial({ color: '#fff6ee', roughness: 0.3 });
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
// Her front is +z; the ponytail hangs at -z.
export function createCouple(dressColor) {
  const root = new THREE.Group();
  const body = new THREE.Group(); // bobs and sways while walking
  body.scale.setScalar(PRINCESS_SCALE);
  root.add(body);

  const dressMat = new THREE.MeshStandardMaterial({ color: dressColor, roughness: 0.55, side: THREE.DoubleSide });
  const skinMat = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.6 });
  const hairMat = new THREE.MeshStandardMaterial({ color: HAIR, roughness: 0.45 });
  const goldMat = new THREE.MeshStandardMaterial({ color: '#f5c96a', metalness: 0.8, roughness: 0.25 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: '#2a1a24', roughness: 0.5 });

  // Skirt: a lathe with a soft bell shape. Her feet move under it while she walks.
  const skirtProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.72, 0.0),
    new THREE.Vector2(0.58, 0.55),
    new THREE.Vector2(0.38, 0.98),
    new THREE.Vector2(0.3, 1.1),
  ];
  const skirt = new THREE.Mesh(new THREE.LatheGeometry(skirtProfile, 40), dressMat);
  skirt.position.y = 0.12;
  body.add(skirt);

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
  part(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.12, 12), skinMat), body, 0, 1.72, 0);

  const arms = [];
  [-1, 1].forEach((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.3, 1.6, 0);
    body.add(pivot);
    part(new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.42, 4, 8), dressMat), pivot, 0, -0.25, 0.02);
    part(new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), skinMat), pivot, 0, -0.5, 0.03);
    arms.push(pivot);
  });

  // The arm on the boy's side reaches out to hold his hand
  const handL = new THREE.Object3D();
  handL.position.set(0, -0.5, 0.03);
  arms[0].add(handL);

  // A rose in her other hand
  const rose = new THREE.Group();
  part(new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), new THREE.MeshStandardMaterial({ color: '#c81e3c', roughness: 0.5 })), rose, 0, 0.05, 0);
  part(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.35, 6), new THREE.MeshStandardMaterial({ color: '#2f7a4a' })), rose, 0, -0.14, 0);
  rose.position.set(0.02, -0.66, 0.12);
  arms[1].add(rose);

  const head = part(new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 14), skinMat), body, 0, 2.0, 0);
  // Hair covers the crown and the back of the head, so the face stays visible
  part(new THREE.Mesh(new THREE.SphereGeometry(0.245, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.36), hairMat), head, 0, 0.03, 0);
  // Back of the head: a hair shell over the back half of the skull, down to the nape.
  // phi in [PI, 2PI] is the back (z <= 0), so no skin shows from behind.
  part(new THREE.Mesh(new THREE.SphereGeometry(0.252, 24, 14, Math.PI, Math.PI, 0, Math.PI * 0.62), hairMat), head, 0, 0, 0);
  addBangs(head, hairMat, 0.245);
  addPrincessFace(head, skinMat);
  addTiara(head, goldMat);

  // Ponytail: a physics chain, tied with a pink ribbon at the back of the head
  const ponytail = createHairChain({
    parent: head,
    anchor: { x: 0, y: 0.05, z: -0.245 },
    lengths: [0.15, 0.14, 0.13, 0.12],
    radii: [0.075, 0.07, 0.063, 0.05],
    rest: { x: 0.55, z: 0 },
    stiffness: 28,
    damping: 4.5,
    drive: 2.5,
    material: hairMat,
  });
  part(new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), new THREE.MeshStandardMaterial({ color: '#ff8fab', roughness: 0.4 })), head, 0, 0.05, -0.25);

  // Two side locks that fall beside her face and swing with the head
  const locks = [-1, 1].map((side) =>
    createHairChain({
      parent: head,
      anchor: { x: side * 0.2, y: 0.0, z: -0.03 },
      lengths: [0.16, 0.15, 0.14],
      radii: [0.062, 0.058, 0.05],
      rest: { x: 0.15, z: side * 0.22 },
      stiffness: 36,
      damping: 5,
      drive: 1.8,
      material: hairMat,
    }),
  );

  // ----- the boy: his own group, moved to his place beside her each frame -----
  const boy = new THREE.Group();
  root.add(boy);
  const coatMat = new THREE.MeshStandardMaterial({ color: COAT, roughness: 0.7 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: PANTS, roughness: 0.8 });
  const boyHairMat = new THREE.MeshStandardMaterial({ color: '#1f1412', roughness: 0.5 });
  const boyBody = new THREE.Group();
  boy.add(boyBody);
  part(new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.55, 6, 12), coatMat), boyBody, 0, 1.05, 0);
  const boyHead = part(new THREE.Mesh(new THREE.SphereGeometry(0.23, 16, 12), skinMat), boyBody, 0, 1.75, 0);
  part(new THREE.Mesh(new THREE.SphereGeometry(0.245, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), boyHairMat), boyHead, 0, 0.03, 0);
  addCurlyHair(boyHead, boyHairMat, 0.235);
  addBoyFace(boyHead);

  // Legs: hip, knee and foot, so the knee bends through each step
  const legs = [];
  const shins = [];
  [-0.13, 0.13].forEach((x) => {
    const hip = new THREE.Group();
    hip.position.set(x, 0.62, 0);
    boyBody.add(hip);
    part(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.31, 8), pantsMat), hip, 0, -0.155, 0);
    const knee = new THREE.Group();
    knee.position.set(0, -0.31, 0);
    hip.add(knee);
    part(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.31, 8), pantsMat), knee, 0, -0.155, 0);
    part(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.26), new THREE.MeshStandardMaterial({ color: SHOE })), knee, 0, -0.335, 0.05);
    legs.push(hip);
    shins.push(knee);
  });

  // Free arm (his right) swings against his leg; the inner arm (his left) is stretched to her hand
  const freeArm = new THREE.Group();
  freeArm.position.set(-0.34, 1.35, 0);
  boyBody.add(freeArm);
  part(new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.42, 4, 8), coatMat), freeArm, 0, -0.27, 0);
  part(new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), skinMat), freeArm, 0, -0.56, 0);

  const innerShoulder = new THREE.Vector3(0.34, 1.35, 0);
  const innerArm = new THREE.Mesh(new THREE.CylinderGeometry(ARM_R, ARM_R, 1, 10), coatMat);
  boy.add(innerArm);
  const innerHand = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), skinMat);
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
    ponytail.step(dt, accLocal, sway);
    locks.forEach((lock) => lock.step(dt, accLocal, sway));
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
  let idleTime = 0;
  let waveAmount = 0;

  // ----- hand holding and dances -----
  let holding = false; // the player asked him to hold her hand
  let holdAmount = 0; // eased: 0 hand down, 1 hands joined
  let danceId = -1; // -1 no dance, otherwise an index into DANCE_NAMES
  let danceT = 0; // time spent in the current dance
  let danceAmount = 0; // eased: 0 beside her, 1 at the dance spot
  let liftAmount = 0; // eased: her arm raised for the lifted-hand dance
  let spinAngle = 0; // how far she has turned in the spin dance

  function lerpAngle(a, b, t) {
    let diff = b - a;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return a + diff * t;
  }

  // A spot on a circle around her, in her space, with him facing her
  function poseAt(phi) {
    const R = 0.8;
    return { x: R * Math.sin(phi), z: R * Math.cos(phi), yaw: phi + Math.PI };
  }

  // Where he stands for the current dance (in her space). Beside her when there is no dance.
  function dancePose() {
    if (danceId === 0) return poseAt(-Math.PI / 2 + 0.55 * Math.sin((danceT * Math.PI * 2) / 3.6)); // waltz sway
    if (danceId === 1) return poseAt(-Math.PI / 2 + spinAngle); // he circles her as she turns
    if (danceId === 2) return poseAt(-Math.PI / 2 + 0.25 * Math.sin((danceT * Math.PI * 2) / 1.2)); // lifted-hand sway
    return poseAt(-Math.PI / 2);
  }

  // The boy keeps his place beside her, or at the dance spot, and catches up if she moves on
  function followPrincess(dt) {
    root.getWorldPosition(rootPos);
    const yaw = root.rotation.y;
    if (!rootReady) {
      prevRoot.copy(rootPos);
      boyWorld.copy(rootPos).add(offset.clone().applyAxisAngle(up, yaw));
      boyYaw = yaw;
      rootReady = true;
    }
    const pose = dancePose();
    offsetLocal
      .set(
        THREE.MathUtils.lerp(-FOLLOW_SIDE, pose.x, danceAmount),
        0,
        THREE.MathUtils.lerp(-FOLLOW_BACK, pose.z, danceAmount),
      )
      .applyAxisAngle(up, yaw);
    boyTarget.copy(rootPos).add(offsetLocal);
    boyWorld.lerp(boyTarget, 1 - Math.exp(-dt * FOLLOW_RATE));
    boyWorld.y = 0;
    const turn = lerpAngle(0, pose.yaw, danceAmount);
    boyYaw = lerpAngle(boyYaw, yaw + turn, 1 - Math.exp(-dt * FOLLOW_RATE));
    boy.position.copy(root.worldToLocal(boyWorld.clone()));
    boy.rotation.y = boyYaw - yaw;
  }

  function animate(dt, t, moving) {
    const step = Math.min(dt, 0.05);
    // distance walked since the last frame (ignores large jumps such as teleports)
    root.getWorldPosition(rootPos);
    const walked = Math.min(rootPos.distanceTo(prevRoot), 3.6 * step * 1.5);
    prevRoot.copy(rootPos);
    if (moving) phase += (walked / STRIDE) * Math.PI * 2;
    amount += ((moving ? 1 : 0) - amount) * Math.min(1, dt * 8);

    // Walking ends a dance; a dance holds hands
    if (moving) danceId = -1;
    const dancing = danceId >= 0;
    if (dancing) danceT += step;
    danceAmount += ((dancing ? 1 : 0) - danceAmount) * Math.min(1, dt * 4);
    holdAmount += ((holding || dancing ? 1 : 0) - holdAmount) * Math.min(1, dt * 6);
    liftAmount += ((danceId === 2 ? 1 : 0) - liftAmount) * Math.min(1, dt * 5);

    // Her turn: she spins during the spin dance, then unwinds to face forward
    if (danceId === 1) {
      spinAngle += step * ((Math.PI * 2) / 3);
    } else {
      spinAngle = Math.atan2(Math.sin(spinAngle), Math.cos(spinAngle));
      spinAngle += -spinAngle * Math.min(1, dt * 2);
    }

    // After a few seconds standing still, the boy waves his free hand
    idleTime = moving || dancing ? 0 : idleTime + dt;
    waveAmount += ((idleTime > 5 ? 1 : 0) - waveAmount) * Math.min(1, dt * 4);
    const idle = 1 - amount;
    const s = Math.sin(phase);

    followPrincess(dt);

    // Princess: body bobs twice per stride and sways; her feet step under the skirt
    const beat = Math.abs(Math.sin(danceT * 3.5)) * 0.035 * danceAmount;
    body.position.y = Math.abs(s) * 0.04 * amount + Math.sin(t * 1.6) * 0.01 * idle + beat;
    body.rotation.y = spinAngle;
    body.rotation.z =
      s * 0.025 * amount + (danceId === 0 ? Math.sin((danceT * Math.PI * 2) / 3.6) * 0.05 * danceAmount : 0);
    skirt.rotation.z = s * 0.05 * amount;
    skirt.rotation.x = Math.abs(s) * 0.03 * amount;
    shoeRest.forEach((x, i) => {
      const f = phase + i * Math.PI;
      feet[i].position.set(x, 0.06 + Math.max(0, Math.cos(f)) * 0.07 * amount, 0.12 + Math.sin(f) * 0.14 * amount);
    });
    // Her arm on the boy's side hangs by default, reaches for his hand when holding, and is raised for the lifted-hand dance
    arms[0].rotation.x = Math.sin(phase) * 0.04 * amount;
    arms[0].rotation.z = THREE.MathUtils.lerp(THREE.MathUtils.lerp(-0.12, -0.6, holdAmount), -1.35, liftAmount);
    arms[1].rotation.x = -Math.sin(phase) * 0.35 * amount + 0.15 * idle;
    head.rotation.y = Math.sin(t * 0.7) * 0.08 * idle;
    updateHair(dt, Math.sin(phase) * amount * 0.12 + Math.sin(t * 1.3) * 0.02 * idle);

    // Boy: legs step in time with hers; knees bend in the forward swing
    legs.forEach((hip, i) => {
      const f = phase + i * Math.PI;
      hip.rotation.x = Math.sin(f) * 0.5 * amount;
      shins[i].rotation.x = 0.85 * Math.max(0, Math.cos(f)) * amount;
    });
    boyBody.position.y = Math.abs(s) * 0.035 * amount + Math.sin(t * 1.4 + 1) * 0.01 * idle;
    boyBody.rotation.z = s * 0.025 * amount;
    const wave = waveAmount;
    freeArm.rotation.x = -s * 0.5 * amount * (1 - wave);
    freeArm.rotation.z = wave * (-2.4 + Math.sin(t * 7) * 0.25);
    boyHead.rotation.y = -Math.sin(t * 0.6) * 0.06 * idle;

    stretchInnerArm(holdAmount, s, amount);
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
      ponytail: ponytail.angles(),
      locks: locks.map((l) => l.angles()),
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

  return { root, animate, setDress, measure, feet, stride: () => phase, toggleHolding, isHolding, nextDance, danceName };
}
