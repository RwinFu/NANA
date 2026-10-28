import * as THREE from 'three';

const SKIN = '#f2c7a3';
const HAIR = '#3a2220';

function part(mesh, parent, x = 0, y = 0, z = 0) {
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

// The walking princess (you). Built from primitives so no model files are needed.
// Her front is +z; the ponytail is at -z.
export function createPrincess(dressColor) {
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

  // Little shoes peeking out under the hem
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

  // A rose in her right hand
  const rose = new THREE.Group();
  part(new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), new THREE.MeshStandardMaterial({ color: '#c81e3c', roughness: 0.5 })), rose, 0, 0.05, 0);
  part(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.35, 6), new THREE.MeshStandardMaterial({ color: '#2f7a4a' })), rose, 0, -0.14, 0);
  rose.position.set(0.02, -0.66, 0.12);
  arms[1].add(rose);

  const head = part(new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 14), skinMat), body, 0, 2.0, 0);
  part(new THREE.Mesh(new THREE.SphereGeometry(0.245, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.6), hairMat), head, 0, 0.03, 0);
  part(new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12, 0, Math.PI * 2, Math.PI * 0.4, Math.PI * 0.6), hairMat), head, 0, -0.1, -0.06);
  const ponytail = part(new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.42, 4, 8), hairMat), head, 0, -0.35, -0.2);
  ponytail.rotation.x = 0.4;
  const tiara = part(new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 8, 24, Math.PI), goldMat), head, 0, 0.2, 0.02);
  tiara.rotation.x = -0.2;

  let walkPhase = 0;
  let walkAmount = 0;
  function animate(dt, t, moving) {
    walkAmount += ((moving ? 1 : 0) - walkAmount) * Math.min(1, dt * 10);
    if (moving) walkPhase += dt * 8;
    const swing = Math.sin(walkPhase) * walkAmount;
    skirt.rotation.z = swing * 0.05;
    skirt.rotation.x = Math.abs(swing) * 0.03;
    arms[0].rotation.x = -swing * 0.45;
    arms[1].rotation.x = swing * 0.3 - 0.15 * (1 - walkAmount);
    body.position.y = Math.abs(Math.sin(walkPhase)) * 0.05 * walkAmount + Math.sin(t * 1.6) * 0.012 * (1 - walkAmount);
    head.rotation.y = Math.sin(t * 0.7) * 0.08 * (1 - walkAmount);
  }

  function setDress(color) {
    dressMat.color.set(color);
  }

  return { root, animate, setDress };
}
