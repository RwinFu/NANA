import * as THREE from 'three';

const SKIN = '#f2c7a3';
const HAIR = '#3a2220';
const COAT = '#2d3354';
const PANTS = '#1b1d2e';
const SHOE = '#111018';
const BOY_OFFSET_X = -1.05; // the boy walks beside her on the side of her arm that holds his hand
const ARM_R = 0.07;
const PRINCESS_SCALE = 1.08; // she stands a little taller than the boy
const HAIR_LIMIT = 1.3; // radians; keeps the hair from folding through the body

function part(mesh, parent, x = 0, y = 0, z = 0) {
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Eyes with a dark iris, a catch-light, a soft lash line, a brow and a small smile.
// Everything sits on the front of the head (+z), so the face stays visible.
function addFace(head, skinMat, { lashes = true } = {}) {
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
    if (lashes) {
      // upper lash line: a half ring over the top of the eye
      const lash = part(new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.008, 6, 18, Math.PI * 0.9), lashMat), head, x, 0.0, 0.212);
      lash.rotation.z = Math.PI * 0.05;
      lash.scale.set(1, 1.1, 0.6);
    }
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

// A chain of hinged segments that hangs from `anchor` and swings with physics:
// a spring pulls each joint back to its rest angle, damping stops the wobble, and the
// head's acceleration pushes the hair so it lags behind every move.
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
    const r = radii[i];
    // segments overlap a little, so bent hair reads as one strand instead of beads
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.01, len * 1.3 - 2 * r), 4, 8), material);
    mesh.position.y = -len / 2;
    g.add(mesh);
    joints.push({
      g,
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
  }

  return { step, angles: () => joints.map((j) => [+j.ax.toFixed(3), +j.az.toFixed(3)]) };
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

// The walking princess (you) and the boy holding her hand.
// Her front is +z; the ponytail hangs at -z.
export function createCouple(dressColor) {
  const root = new THREE.Group();
  const body = new THREE.Group(); // bobs while walking, and is a bit taller than the boy
  body.scale.setScalar(PRINCESS_SCALE);
  root.add(body);

  const dressMat = new THREE.MeshStandardMaterial({ color: dressColor, roughness: 0.55, side: THREE.DoubleSide });
  const skinMat = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.6 });
  const hairMat = new THREE.MeshStandardMaterial({ color: HAIR, roughness: 0.45 });
  const goldMat = new THREE.MeshStandardMaterial({ color: '#f5c96a', metalness: 0.8, roughness: 0.25 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: '#2a1a24', roughness: 0.5 });

  // Skirt: a lathe with a soft bell shape; it sways a little while walking
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
  [-0.14, 0.14].forEach((x) => {
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
  part(new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 12), hairMat), head, 0, -0.12, -0.11).scale.set(1, 1.2, 0.8);
  addFace(head, skinMat);
  const tiara = part(new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 8, 24, Math.PI), goldMat), head, 0, 0.2, 0.02);
  tiara.rotation.x = -0.2;

  // Ponytail: a physics chain tied with a pink ribbon at the back of the head
  const ponytail = createHairChain({
    parent: head,
    anchor: { x: 0, y: 0.08, z: -0.2 },
    lengths: [0.15, 0.14, 0.13, 0.12],
    radii: [0.075, 0.07, 0.063, 0.05],
    rest: { x: 0.55, z: 0 },
    stiffness: 28,
    damping: 4.5,
    drive: 2.5,
    material: hairMat,
  });
  part(new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), new THREE.MeshStandardMaterial({ color: '#ff8fab', roughness: 0.4 })), head, 0, 0.08, -0.2);

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

  // ----- the boy -----
  const boy = new THREE.Group();
  boy.position.set(BOY_OFFSET_X, 0, 0);
  root.add(boy);
  const coatMat = new THREE.MeshStandardMaterial({ color: COAT, roughness: 0.7 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: PANTS, roughness: 0.8 });
  const boyHairMat = new THREE.MeshStandardMaterial({ color: '#1f1412', roughness: 0.5 });
  const boyBody = new THREE.Group();
  boy.add(boyBody);
  part(new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.55, 6, 12), coatMat), boyBody, 0, 1.05, 0);
  const boyHead = part(new THREE.Mesh(new THREE.SphereGeometry(0.23, 16, 12), skinMat), boyBody, 0, 1.75, 0);
  part(new THREE.Mesh(new THREE.SphereGeometry(0.245, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), boyHairMat), boyHead, 0, 0.03, 0);
  addBoyFace(boyHead);
  const legs = [];
  [-0.13, 0.13].forEach((x) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.62, 0);
    boyBody.add(pivot);
    part(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.62, 8), pantsMat), pivot, 0, -0.31, 0);
    part(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.26), new THREE.MeshStandardMaterial({ color: SHOE })), pivot, 0, -0.66, 0.05);
    legs.push(pivot);
  });
  // Free arm (his right) swings; the inner arm (his left) is stretched to her hand each frame
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

  const up = new THREE.Vector3(0, 1, 0);
  const handWorld = new THREE.Vector3();
  const handLocal = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const mid = new THREE.Vector3();

  // Place the inner arm from the boy's shoulder to her hand (in boy-local space)
  function stretchInnerArm() {
    root.updateMatrixWorld(true);
    handL.getWorldPosition(handWorld);
    boy.worldToLocal(handLocal.copy(handWorld));
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

  let walkPhase = 0;
  let walkAmount = 0;
  let idleTime = 0;
  let waveAmount = 0;
  function animate(dt, t, moving) {
    walkAmount += ((moving ? 1 : 0) - walkAmount) * Math.min(1, dt * 10);
    if (moving) walkPhase += dt * 8;
    // After a few seconds standing still, the boy waves his free hand
    idleTime = moving ? 0 : idleTime + dt;
    waveAmount += ((idleTime > 5 ? 1 : 0) - waveAmount) * Math.min(1, dt * 4);
    const swing = Math.sin(walkPhase) * walkAmount;
    const idle = 1 - walkAmount;

    // Princess: skirt sways, her arm reaches out toward the boy
    skirt.rotation.z = swing * 0.05;
    skirt.rotation.x = Math.abs(swing) * 0.03;
    arms[0].rotation.x = -swing * 0.3;
    arms[0].rotation.z = -0.6;
    arms[1].rotation.x = swing * 0.3 - 0.15 * idle;
    body.position.y = Math.abs(Math.sin(walkPhase)) * 0.05 * walkAmount + Math.sin(t * 1.6) * 0.012 * idle;
    head.rotation.y = Math.sin(t * 0.7) * 0.08 * idle;
    updateHair(dt, swing * 0.12 + Math.sin(t * 1.3) * 0.02 * idle);

    // Boy: legs and free arm walk in step with her, body bobs slightly
    legs[0].rotation.x = swing * 0.9;
    legs[1].rotation.x = -swing * 0.9;
    // While he waves, the walking swing fades out and the arm lifts outward and shakes
    const wave = waveAmount;
    freeArm.rotation.x = -swing * 0.6 * (1 - wave);
    freeArm.rotation.z = wave * (-2.4 + Math.sin(t * 7) * 0.25);
    boyBody.position.y = Math.abs(Math.sin(walkPhase)) * 0.05 * walkAmount + Math.sin(t * 1.4 + 1) * 0.01 * idle;
    boyHead.rotation.y = -Math.sin(t * 0.6) * 0.06 * idle;

    stretchInnerArm();
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
    };
  }

  return { root, animate, setDress, measure, feet, stride: () => walkPhase };
}
