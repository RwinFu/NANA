import * as THREE from 'three';
import { furMaps } from './fur.js';
import { CAT_APPEARANCE, catEarPose } from './cat-appearance.js';

// Each cat has its own gait:
//   Pastil, the grey one, is calm: a soft, slow trot with a gentle side sway of the body.
//   Ani, the brown tabby, is quick: short bouncy hops, a fast stride and a flicking tail.
export const CAT_SPECS = {
  pastil: {
    ...CAT_APPEARANCE.pastil, leader: 'princess',
    maxSpeed: 2.7, legRate: 0.8, bob: 0.5, sway: 0.05, tailRate: 1.0,
  },
  ani: {
    ...CAT_APPEARANCE.ani, leader: 'boy',
    maxSpeed: 3.8, legRate: 1.3, bob: 1.8, sway: 0.0, tailRate: 2.2,
  },
};

function mesh(geo, mat, x, y, z) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

// A soft blob: a sphere squashed into an ellipsoid
function blob(radius, mat, x, y, z, sx, sy, sz) {
  const m = mesh(new THREE.SphereGeometry(radius, 24, 16), mat, x, y, z);
  m.scale.set(sx, sy, sz);
  return m;
}

// The cat stands on the origin with her nose toward +z
export function buildCat(key) {
  const spec = CAT_SPECS[key];
  const root = new THREE.Group();
  root.name = `cat-${key}`;
  const body = new THREE.Group();
  root.add(body);

  // Shared fur: the normal map gives the coat real texture; each cat has its own colour
  const fur = furMaps(spec.base, spec.stripe);
  const furMat = new THREE.MeshStandardMaterial({ map: fur.map, normalMap: fur.normal, normalScale: new THREE.Vector2(0.42, 0.42), roughness: 0.96 });
  const plainMat = new THREE.MeshStandardMaterial({ color: spec.base, normalMap: fur.normal, normalScale: new THREE.Vector2(0.42, 0.42), roughness: 0.96 });
  const creamMat = new THREE.MeshStandardMaterial({ color: spec.muzzle, normalMap: fur.normal, normalScale: new THREE.Vector2(0.2, 0.2), roughness: 0.96 });
  const faceMat = furMat.clone();
  faceMat.normalScale.set(0.18, 0.18);
  const ringMat = new THREE.MeshStandardMaterial({ color: spec.stripe, roughness: 0.9 });
  const irisMat = new THREE.MeshStandardMaterial({ color: spec.eye, emissive: spec.eye, emissiveIntensity: 0.35, roughness: 0.25 });
  const pupilMat = new THREE.MeshStandardMaterial({ color: '#15101a', roughness: 0.3 });
  const glintMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const noseMat = new THREE.MeshStandardMaterial({ color: '#f08aa0', roughness: 0.5 });
  const pinkMat = new THREE.MeshStandardMaterial({ color: '#ff8fb8', roughness: 0.4 });
  const innerEarMat = new THREE.MeshStandardMaterial({ color: '#f7a8bd', roughness: 0.8 });
  const goldMat = new THREE.MeshStandardMaterial({ color: '#f5c96a', metalness: 0.8, roughness: 0.25 });
  const whiskerMat = new THREE.MeshBasicMaterial({ color: '#f5f0ea' });

  // Torso: a long oval, a round chest in front and round haunches behind
  body.add(blob(1, furMat, 0, 0.25, 0, 0.12 * spec.bodyWidth, 0.11 * spec.bodyWidth, 0.22));
  body.add(blob(1, furMat, 0, 0.26, 0.1, 0.115 * spec.bodyWidth, 0.115 * spec.bodyWidth, 0.12));
  body.add(blob(1, furMat, 0, 0.25, -0.12, 0.13 * spec.bodyWidth, 0.12 * spec.bodyWidth, 0.13));
  body.add(blob(1, plainMat, 0, 0.31, 0.16, 0.105, 0.105, 0.13));

  // Head: a round skull with cheek fluff, a cream muzzle and a small pink nose
  const head = new THREE.Group();
  head.position.set(0, 0.36, 0.25);
  body.add(head);
  head.add(blob(0.12, faceMat, 0, 0, 0, spec.headWidth, spec.headHeight, 0.98));
  [-1, 1].forEach((s) => {
    head.add(blob(spec.cheek, faceMat, s * 0.088, -0.035, 0.03, 1, 0.9, 1));
  });
  head.add(blob(0.05, creamMat, 0, -0.045, 0.092, 1.2, 0.8, 1));
  head.add(blob(0.017, noseMat, 0, -0.02, 0.135, 1.3, 0.8, 0.6));

  // Ear pivots allow independent, gentle listening twitches.
  const ears = [];
  [-1, 1].forEach((side) => {
    const pivot = new THREE.Group();
    pivot.name = side < 0 ? 'ear-left' : 'ear-right';
    pivot.position.set(side * (spec.folded ? 0.079 : 0.072), 0.1, 0);
    const rest = catEarPose(spec, side);
    pivot.rotation.z = rest.z;
    pivot.rotation.x = rest.x;
    head.add(pivot);
    if (spec.folded) {
      // Short, rounded ears tip gently forward rather than lying flat.
      pivot.add(mesh(new THREE.ConeGeometry(0.043, 0.079, 8), faceMat, 0, 0.025, 0));
      const tip = blob(0.026, faceMat, 0, 0.059, 0.019, 1, 0.7, 1.05);
      tip.rotation.x = 0.65;
      pivot.add(tip);
      const inner = blob(0.022, innerEarMat, 0, 0.027, 0.034, 0.75, 1, 0.16);
      pivot.add(inner);
    } else {
      pivot.add(mesh(new THREE.ConeGeometry(0.052, 0.11, 3), faceMat, 0, 0.03, 0));
      pivot.add(mesh(new THREE.ConeGeometry(0.03, 0.07, 3), innerEarMat, 0, 0.022, 0.018));
    }
    ears.push({ pivot, side });
  });

  // Eyes: coloured irises with a vertical pupil and a small glint
  const eyes = [];
  [-1, 1].forEach((s) => {
    const eye = new THREE.Group();
    eye.position.set(s * 0.046, 0.02, 0.1);
    eye.rotation.y = s * 0.2;
    head.add(eye);
    eye.add(blob(0.026, irisMat, 0, 0, 0, key === 'ani' ? 1.02 : 0.9, key === 'ani' ? 1.1 : 1.18, 0.45));
    eye.add(blob(0.012, pupilMat, 0, 0, 0.012, 0.5, 1.3, 0.4));
    eye.add(blob(0.004, glintMat, 0.008, 0.009, 0.02, 1, 1, 1));
    eyes.push(eye);
  });

  // Whiskers: three fine lines on each side of the muzzle
  [-1, 1].forEach((s) => {
    [0, 1, 2].forEach((i) => {
      const w = mesh(new THREE.CylinderGeometry(0.0013, 0.0013, 0.12, 4), whiskerMat, s * 0.1, -0.035 + i * 0.018, 0.11);
      w.rotation.z = s * (Math.PI / 2 - 0.08 + i * 0.07);
      head.add(w);
    });
  });

  // The neck runs along the body (Z), so the collar must wrap around it in
  // the XY plane. Anchor it to the body, not the independently turning head.
  if (spec.collar) {
    const collar = new THREE.Group();
    collar.name = 'collar';
    collar.position.set(0, 0.30, 0.19);
    body.add(collar);
    const band = mesh(new THREE.TorusGeometry(0.12, 0.012, 10, 32), pinkMat, 0, 0, 0);
    band.scale.y = 1.08;
    collar.add(band);
    // A tiny loop joins the bell to the lower edge of the band.
    const loop = mesh(new THREE.TorusGeometry(0.012, 0.003, 6, 12), goldMat, 0, -0.136, 0.012);
    collar.add(loop);
    const bell = mesh(new THREE.SphereGeometry(0.022, 12, 10), goldMat, 0, -0.163, 0.012);
    collar.add(bell);
  }

  // Four legs, pivoting at the hips, each with a soft paw
  const legs = [];
  [[-0.08, 0.16], [0.08, 0.16], [-0.08, -0.14], [0.08, -0.14]].forEach(([x, z]) => {
    const hip = new THREE.Group();
    hip.position.set(x, 0.2, z);
    body.add(hip);
    hip.add(mesh(new THREE.CapsuleGeometry(0.03, 0.14, 4, 8), furMat, 0, -0.1, 0));
    hip.add(blob(0.036, plainMat, 0, -0.19, 0.012, 1.15, 0.75, 1.35));
    legs.push({ hip, diag: (z > 0) === (x > 0) ? 0 : 1 });
  });

  // Two curved sections and a flexible tip make the tail move as a soft chain.
  const tail = new THREE.Group();
  tail.position.set(0, 0.3, -0.2);
  body.add(tail);
  const tailGeo = new THREE.CylinderGeometry(0.025, 0.031, 0.18, 8);
  const tailMiddle = new THREE.Group();
  const tailTip = new THREE.Group();
  tail.add(mesh(tailGeo, furMat, 0, 0.09, 0));
  tailMiddle.position.y = 0.18;
  tail.add(tailMiddle);
  tailMiddle.add(mesh(tailGeo, furMat, 0, 0.09, 0));
  tailTip.position.y = 0.18;
  tailMiddle.add(tailTip);
  tailTip.add(blob(0.031, furMat, 0, 0.035, 0, 1, 1.8, 1));
  [tail, tailMiddle].forEach((segment) => {
    const ring = mesh(new THREE.TorusGeometry(0.03, 0.006, 6, 14), ringMat, 0, 0.12, 0);
    ring.rotation.x = Math.PI / 2;
    segment.add(ring);
  });

  return { root, body, head, ears, eyes, legs, tail, tailMiddle, tailTip, phase: Math.random() * 6 };

}

export function animateCat(cat, dt, t, speed, idx) {
  const k = Math.min(1, speed / 1.6);
  const g = cat.gait;
  cat.phase += dt * (3 + speed * 3.2) * g.legRate;
  cat.legs.forEach((leg) => {
    leg.hip.rotation.x = Math.sin(cat.phase + leg.diag * Math.PI) * 0.55 * k;
  });
  const crouch = cat.crouch || 0;
  cat.body.position.y = Math.abs(Math.sin(cat.phase)) * 0.02 * g.bob * k - crouch * 0.065 + (cat.hop || 0);
  cat.body.rotation.z = Math.sin(cat.phase) * g.sway * k;
  cat.tail.rotation.x = -0.9 - k * 0.2 - (cat.nearPerson ? 0.18 : 0);
  cat.tail.rotation.y = Math.sin(t * 1.4 * g.tailRate + idx * 2) * (0.14 + 0.16 * k);
  cat.tailMiddle.rotation.z = Math.sin(t * 1.8 * g.tailRate + idx) * (0.12 + 0.18 * k);
  cat.tailTip.rotation.z = Math.sin(t * 2.2 * g.tailRate + idx - 0.6) * (0.16 + 0.2 * k);
  cat.head.rotation.x = 0;
  cat.head.rotation.y = cat.lookAngle ?? Math.sin(t * 0.6 + idx * 3) * 0.2 * (1 - k);
  const blinkAt = (t + idx * 1.7) % (idx ? 4.8 : 5.6);
  const blink = blinkAt < 0.16 ? Math.max(0.08, Math.abs(blinkAt - 0.08) / 0.08) : 1;
  cat.eyes.forEach((eye) => { eye.scale.y = blink; });
  const twitch = Math.sin(t * 0.7 + idx * 2) > 0.94 ? Math.sin(t * 12) * 0.12 : 0;
  cat.ears.forEach(({ pivot, side }) => {
    const pose = catEarPose(g, side, twitch, cat.attentive);
    pivot.rotation.z = pose.z;
    pivot.rotation.x = pose.x;
  });
}

