// Hair detail for the two characters.
// The princess has bangs of nine strands (every other one a lighter brown), two locks that fall
// beside her face, and a sheen over the crown.
// The boy has a hairline that leaves his forehead and brows open, and about a hundred coil-shaped
// curls over the rest of his head, in two browns.
import * as THREE from 'three';
import { physMat } from './charmats.js';

// A point on a sphere of radius r. theta is the angle from the crown (0 at the top), and A is the
// angle around the head from the front (0 is the front, positive is toward +x, the side).
function sphPoint(r, theta, A) {
  return new THREE.Vector3(r * Math.sin(theta) * Math.sin(A), r * Math.cos(theta), r * Math.sin(theta) * Math.cos(A));
}

// Deterministic jitter in [0, 1), so the curls look varied and never change between frames
function jit(i, j) {
  return Math.abs(Math.sin((i + 1) * 12.9898 + (j + 1) * 78.233) * 43758.5453) % 1;
}

// Princess hair detail: bangs, side locks and a crown sheen. `hairMat` is her hair material.
export function addPrincessHairDetail(head, hairMat, headR) {
  const shineMat = physMat({
    color: '#7a4640', roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.15, sheen: 0.4, sheenColor: new THREE.Color('#ffb0a0'),
  });

  // bangs: nine strands from the hairline, sweeping across the forehead above the brows
  for (let k = -4; k <= 4; k += 1) {
    const a0 = k * 0.14;
    const sweep = k * 0.06;
    const pts = [0.5, 0.78, 0.98, 1.1].map((theta, j) => {
      const rr = headR + 0.012 + 0.012 * j;
      return sphPoint(rr, theta, a0 + sweep * (j / 3));
    });
    const radius = 0.013 + 0.004 * ((4 - Math.abs(k)) / 4);
    head.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, radius, 6, false), k % 2 === 0 ? hairMat : shineMat));
  }

  // two locks on each side, falling from the crown past the cheek, a little in front of the ear
  [-1, 1].forEach((side) => {
    for (let s = 0; s < 2; s += 1) {
      const A0 = side * (0.9 + s * 0.08);
      const pts = [0.95, 1.2, 1.45, 1.7, 1.95].map((theta, j) => sphPoint(headR + 0.02 + 0.004 * s, theta, A0 + side * 0.02 * j));
      const radius = 0.018 - 0.004 * s;
      head.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, radius, 6, false), s === 1 ? shineMat : hairMat));
    }
  });

  // a soft sheen across the crown, in arcs from the top down to the bangs
  for (let k = -2; k <= 2; k += 1) {
    const A = k * 0.3;
    const pts = [0.2, 0.42, 0.62, 0.78].map((theta) => sphPoint(headR + 0.012, theta, A));
    head.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.0035, 6, false), shineMat));
  }
}

// Boy hair: a hairline that stops above the brows (the forehead is open), a cap over the crown and
// the back, and curls on top of the cap. `hairMat` is the base colour, `lightMat` a lighter brown.
export function addBoyHair(head, hairMat, lightMat, headR) {
  // the front of the cap ends at a hairline about 61 degrees from the crown, and only across the
  // front of the face (the open part is between -0.9 and 0.9 radians from the front)
  const frontCap = new THREE.Mesh(new THREE.SphereGeometry(0.245, 40, 16, Math.PI / 2 - 0.9, 1.8, 0, Math.PI * 0.34), hairMat);
  frontCap.position.y = 0.03;
  head.add(frontCap);
  // the rest of the cap, down to the equator at the sides and the back
  const sideCap = new THREE.Mesh(new THREE.SphereGeometry(0.245, 40, 28, Math.PI / 2 + 0.9, Math.PI * 2 - 1.8, 0, Math.PI * 0.5), hairMat);
  sideCap.position.y = 0.03;
  head.add(sideCap);

  // curls: small rings lying on the surface, tilted and rolled so they read as coils
  const curlGeo = new THREE.TorusGeometry(0.02, 0.0085, 8, 14);
  const rings = [
    { theta: 0.22, n: 8 },
    { theta: 0.42, n: 12 },
    { theta: 0.62, n: 15 },
    { theta: 0.8, n: 17 },
    { theta: 0.98, n: 18 },
    { theta: 1.16, n: 18 },
    { theta: 1.34, n: 16, back: true },
  ];
  const Z = new THREE.Vector3(0, 0, 1);
  rings.forEach((ring, ri) => {
    for (let i = 0; i < ring.n; i += 1) {
      const j1 = jit(i, ri);
      const j2 = jit(i + 17, ri + 3);
      const A = ((i + j1 * 0.6) / ring.n) * Math.PI * 2 - Math.PI;
      const inFront = Math.abs(A) < 0.9;
      if (ring.back && Math.abs(A) < Math.PI / 2) continue;
      if (ring.theta > 1.1 && inFront) continue; // nothing on the forehead below the hairline
      const theta = ring.theta + (j2 - 0.5) * 0.08;
      // sunk into the cap: a coil lying on the scalp, not a ring hovering over it
      const rr = headR + 0.002 + j2 * 0.004;
      const p = sphPoint(rr, theta, A);
      p.y += 0.03;
      const n = p.clone().normalize();
      const curl = new THREE.Mesh(curlGeo, j1 > 0.6 && ring.theta < 0.8 ? lightMat : hairMat);
      curl.position.copy(p);
      curl.quaternion.setFromUnitVectors(Z, n);
      curl.rotateZ(j2 * Math.PI * 2);
      curl.rotateX(0.5);
      // flattened along the scalp's normal, so it is a coil pressed into the hair, not a hoop
      const size = 0.82 + 0.26 * j1;
      curl.scale.set(size, size, size * 0.4);
      head.add(curl);
    }
  });
}
