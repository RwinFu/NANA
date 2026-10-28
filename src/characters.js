import * as THREE from 'three';

const SKIN = '#f2c7a3';
const HAIR = '#3a2220';
const COAT = '#2d3354';
const PANTS = '#1b1d2e';
const SHOE = '#111018';
const BOY_OFFSET_X = -1.05; // the boy walks beside her on the side of her arm that holds his hand
const ARM_R = 0.07;

function part(mesh, parent, x = 0, y = 0, z = 0) {
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function addFace(head, skinMat) {
  const eyeMat = new THREE.MeshStandardMaterial({ color: '#2a1a18', roughness: 0.4 });
  const shineMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const cheekMat = new THREE.MeshStandardMaterial({ color: '#f58fa6', roughness: 0.7, transparent: true, opacity: 0.8 });
  const lipMat = new THREE.MeshStandardMaterial({ color: '#c93d61', roughness: 0.4 });
  [-1, 1].forEach((side) => {
    // eyes sit on the front of the head (+z)
    const eye = part(new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 10), eyeMat), head, side * 0.08, 0.0, 0.205);
    eye.scale.set(1, 1.25, 0.6);
    part(new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), shineMat), head, side * 0.08 + 0.01, 0.01, 0.23);
    const cheek = part(new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), cheekMat), head, side * 0.13, -0.06, 0.18);
    cheek.scale.set(1, 0.7, 0.4);
  });
  part(new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), skinMat), head, 0, -0.03, 0.222).scale.set(1, 1.2, 0.8);
  const lips = part(new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), lipMat), head, 0, -0.105, 0.2);
  lips.scale.set(1.2, 0.35, 0.5);
}

// The walking princess (you). Her front is +z; the ponytail is at -z.
// The boy's shared pose is driven from here too, because he holds her hand.
export function createCouple(dressColor) {
  const root = new THREE.Group();
  const body = new THREE.Group(); // bobs while walking
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

  [-0.14, 0.14].forEach((x) => {
    const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), shoeMat);
    shoe.scale.set(1, 0.55, 1.5);
    part(shoe, body, x, 0.06, 0.12);
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

  // A rose in her right hand
  const rose = new THREE.Group();
  part(new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), new THREE.MeshStandardMaterial({ color: '#c81e3c', roughness: 0.5 })), rose, 0, 0.05, 0);
  part(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.35, 6), new THREE.MeshStandardMaterial({ color: '#2f7a4a' })), rose, 0, -0.14, 0);
  rose.position.set(0.02, -0.66, 0.12);
  arms[1].add(rose);

  const head = part(new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 14), skinMat), body, 0, 2.0, 0);
  // Hair covers only the crown and back of the head so the face stays visible
  part(new THREE.Mesh(new THREE.SphereGeometry(0.245, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.36), hairMat), head, 0, 0.03, 0);
  part(new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 12), hairMat), head, 0, -0.12, -0.11).scale.set(1, 1.2, 0.8);
  const ponytail = part(new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.42, 4, 8), hairMat), head, 0, -0.35, -0.2);
  ponytail.rotation.x = 0.4;
  addFace(head, skinMat);
  const tiara = part(new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 8, 24, Math.PI), goldMat), head, 0, 0.2, 0.02);
  tiara.rotation.x = -0.2;

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
  [-1, 1].forEach((side) => {
    const eye = part(new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), new THREE.MeshStandardMaterial({ color: '#1d1410' })), boyHead, side * 0.08, 0.0, 0.2);
    eye.scale.set(1, 1.25, 0.6);
  });
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

    // Princess: skirt sways, her left arm reaches out toward the boy
    skirt.rotation.z = swing * 0.05;
    skirt.rotation.x = Math.abs(swing) * 0.03;
    arms[0].rotation.x = -swing * 0.3;
    arms[0].rotation.z = -0.6;
    arms[1].rotation.x = swing * 0.3 - 0.15 * idle;
    body.position.y = Math.abs(Math.sin(walkPhase)) * 0.05 * walkAmount + Math.sin(t * 1.6) * 0.012 * idle;
    head.rotation.y = Math.sin(t * 0.7) * 0.08 * idle;

    // Boy: legs and free arm walk in step with her, body bobs slightly
    legs[0].rotation.x = swing * 0.9;
    legs[1].rotation.x = -swing * 0.9;
    // Walking swing fades out while he waves; the wave raises the arm outward and shakes it
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

  return { root, animate, setDress };
}
