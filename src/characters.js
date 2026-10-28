import * as THREE from 'three';

const SKIN = '#f2c7a3';
const HAIR = '#2b1a18';

function part(mesh, parent, x = 0, y = 0, z = 0) {
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

// Low-poly figure built from primitives so no model files are needed.
export function createPlayer() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const coatMat = new THREE.MeshStandardMaterial({ color: '#2d3354', roughness: 0.7 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: '#1b1d2e', roughness: 0.8 });
  const skinMat = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.6 });
  const hairMat = new THREE.MeshStandardMaterial({ color: HAIR, roughness: 0.5 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: '#111018', roughness: 0.5 });

  part(new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.55, 6, 12), coatMat), body, 0, 1.05, 0);
  const head = part(new THREE.Mesh(new THREE.SphereGeometry(0.23, 16, 12), skinMat), body, 0, 1.75, 0);
  part(new THREE.Mesh(new THREE.SphereGeometry(0.245, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat), head, 0, 0.03, 0);

  const legs = [];
  [-0.13, 0.13].forEach((x) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.62, 0);
    body.add(pivot);
    part(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.62, 8), pantsMat), pivot, 0, -0.31, 0);
    part(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.26), shoeMat), pivot, 0, -0.66, 0.05);
    legs.push(pivot);
  });

  const arms = [];
  [-1, 1].forEach((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.34, 1.35, 0);
    body.add(pivot);
    part(new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.42, 4, 8), coatMat), pivot, 0, -0.27, 0);
    part(new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), skinMat), pivot, 0, -0.56, 0);
    arms.push(pivot);
  });

  // A single rose in the right hand
  const rose = new THREE.Group();
  part(new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), new THREE.MeshStandardMaterial({ color: '#c81e3c', roughness: 0.5 })), rose, 0, 0.05, 0);
  part(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.35, 6), new THREE.MeshStandardMaterial({ color: '#2f7a4a' })), rose, 0, -0.14, 0);
  rose.position.set(0.02, -0.72, 0.12);
  arms[1].add(rose);

  let walkPhase = 0;
  let walkAmount = 0;
  function animate(dt, t, moving) {
    walkAmount += ((moving ? 1 : 0) - walkAmount) * Math.min(1, dt * 10);
    if (moving) walkPhase += dt * 9;
    const swing = Math.sin(walkPhase) * 0.6 * walkAmount;
    legs[0].rotation.x = swing;
    legs[1].rotation.x = -swing;
    arms[0].rotation.x = -swing * 0.7;
    arms[1].rotation.x = swing * 0.5 - 0.2 * (1 - walkAmount);
    body.position.y = Math.abs(Math.sin(walkPhase)) * 0.05 * walkAmount + Math.sin(t * 1.6) * 0.01 * (1 - walkAmount);
    head.rotation.z = Math.sin(t * 0.9) * 0.03;
  }

  return { root, animate };
}

// The princess waiting at the end of the hall.
export function createPrincess(dressColor) {
  const root = new THREE.Group();
  const dressMat = new THREE.MeshStandardMaterial({ color: dressColor, roughness: 0.55, side: THREE.DoubleSide });
  const skinMat = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.6 });
  const hairMat = new THREE.MeshStandardMaterial({ color: '#3a2220', roughness: 0.45 });
  const goldMat = new THREE.MeshStandardMaterial({ color: '#f5c96a', metalness: 0.8, roughness: 0.25 });

  // Skirt: a lathe with a soft bell shape
  const skirtProfile = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.78, 0.0),
    new THREE.Vector2(0.62, 0.55),
    new THREE.Vector2(0.4, 1.0),
    new THREE.Vector2(0.3, 1.12),
  ];
  const skirt = new THREE.Mesh(new THREE.LatheGeometry(skirtProfile, 40), dressMat);
  root.add(skirt);

  const bodice = part(new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.33, 0.55, 20), dressMat), root, 0, 1.38, 0);
  bodice.scale.z = 0.8;
  part(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.12, 12), skinMat), root, 0, 1.72, 0);

  const armPivots = [];
  [-1, 1].forEach((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.3, 1.6, 0);
    root.add(pivot);
    part(new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.42, 4, 8), dressMat), pivot, 0, -0.25, 0.02);
    armPivots.push(pivot);
  });

  const head = part(new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 14), skinMat), root, 0, 2.0, 0);
  part(new THREE.Mesh(new THREE.SphereGeometry(0.245, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.6), hairMat), head, 0, 0.03, 0);
  part(new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12, 0, Math.PI * 2, Math.PI * 0.4, Math.PI * 0.6), hairMat), head, 0, -0.1, -0.06);
  const ponytail = part(new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.42, 4, 8), hairMat), head, 0, -0.35, -0.2);
  ponytail.rotation.x = 0.4;
  // Tiara
  const tiara = part(new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.12, 10, 24, Math.PI), goldMat), head, 0, 0.2, 0);
  tiara.rotation.x = -Math.PI / 2;
  tiara.rotation.z = Math.PI;
  tiara.scale.set(1, 1, 0.8);

  function animate(t, dt, wave) {
    head.rotation.y = Math.sin(t * 0.5) * 0.12;
    root.position.y = Math.sin(t * 1.4) * 0.02;
    armPivots[0].rotation.z = 0.12 + Math.sin(t * 1.4) * 0.03;
    armPivots[1].rotation.z = wave ? -2.4 + Math.sin(t * 8) * 0.3 : -0.12 - Math.sin(t * 1.4) * 0.03;
  }

  function setDress(color) {
    dressMat.color.set(color);
  }

  return { root, animate, setDress };
}
