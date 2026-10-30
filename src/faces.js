// The faces of the princess and the boy. Everything sits on the front of the head, just above the
// skin, so it stays visible from the camera. Each eye is a small group (white, iris, pupil and
// catch-lights) that blinks as one piece.
import * as THREE from 'three';
import { physMat, place, frontZ, tubeThrough } from './charmats.js';

// Eyes close for a short moment every few seconds. Returns the open amount (1 open, about 0.08 closed).
export function blinkFactor(t, offset, period) {
  const k = (t + offset) % period;
  const closed = k < 0.14 ? Math.sin((k / 0.14) * Math.PI) : 0;
  return 1 - 0.92 * closed;
}

const shineMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });

// One eye. `size` scales the whole eye, `side` is -1 (her/his right side) or 1.
function buildEye(head, side, o) {
  const s = o.size;
  const eye = new THREE.Group();
  eye.position.set(side * o.x, o.y, frontZ(o.x, o.y, o.R) - 0.004);
  head.add(eye);

  // white of the eye, a little flattened so it sits on the skin
  place(new THREE.Mesh(new THREE.SphereGeometry(0.03 * s, 24, 18), o.sclera), eye).scale.set(1, 1.1, 0.55);
  // iris and pupil, both with a rounded front
  const iris = place(new THREE.Mesh(new THREE.SphereGeometry(0.019 * s, 20, 16), o.iris), eye, 0, 0, 0.012 * s);
  iris.scale.set(1, 1, 0.6);
  const pupil = place(new THREE.Mesh(new THREE.SphereGeometry(0.0095 * s, 16, 12), o.pupil), eye, 0, 0, 0.0186 * s);
  pupil.scale.set(1, 1, 0.5);
  // two catch-lights: a large one up and inward, a small one below it
  place(new THREE.Mesh(new THREE.SphereGeometry(0.0055 * s, 8, 6), shineMat), eye, 0.0065 * s, 0.0075 * s, 0.025 * s);
  place(new THREE.Mesh(new THREE.SphereGeometry(0.0028 * s, 6, 5), shineMat), eye, -0.007 * s, -0.006 * s, 0.0235 * s);

  // upper lid line: an arc over the top of the eye, a little thicker and flicked at the outer corner
  const lid = [];
  for (let k = 0; k <= 12; k += 1) {
    const a = Math.PI * (k / 12);
    lid.push(new THREE.Vector3(side * Math.cos(a) * 0.034 * s, Math.sin(a) * 0.036 * s, 0.008 * s + 0.006 * s * Math.sin(a)));
  }
  if (o.flick) lid.unshift(new THREE.Vector3(side * 0.047 * s, 0.018 * s, 0.006 * s));
  eye.add(tubeThrough(lid, o.lidRadius * s, o.lidMat, 24));

  if (o.lowerLine) {
    const low = [];
    for (let k = 0; k <= 8; k += 1) {
      const a = Math.PI * (1.15 + 0.7 * (k / 8));
      low.push(new THREE.Vector3(side * Math.cos(a) * 0.031 * s, Math.sin(a) * 0.031 * s, 0.006 * s));
    }
    eye.add(tubeThrough(low, 0.0022 * s, o.lowerMat, 16));
  }

  if (o.shadow) {
    // soft colour on the lid, the top half of a small ball
    const shadow = place(new THREE.Mesh(new THREE.SphereGeometry(0.036 * s, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), o.shadow), eye, 0, 0.006 * s, 0.004 * s);
    shadow.scale.set(1.05, 0.7, 0.45);
  }

  if (o.lashes) {
    // a fan of nine fine lashes along the upper lid: short at the inner corner, longer toward the
    // outer corner, each one curving up at the tip
    for (let k = 0; k < 9; k += 1) {
      const a = -1.05 + (k / 8) * 2.1; // from the inner corner (negative) to the outer one
      const base = new THREE.Vector3(side * Math.sin(a) * 0.034 * s, Math.cos(a) * 0.036 * s, 0.012 * s);
      const dir = new THREE.Vector3(side * (0.25 + 0.75 * (a / 1.05)), 0.9 - 0.2 * Math.abs(a) / 1.05, 0.1).normalize();
      const len = (0.012 + 0.008 * ((a + 1.05) / 2.1)) * s;
      const mid = base.clone().addScaledVector(dir, len * 0.55);
      const tip = base.clone().addScaledVector(dir, len);
      tip.y += 0.003 * s;
      eye.add(tubeThrough([base, mid, tip], 0.0024 * s, o.lashMat, 6, 4));
    }
  }
  return eye;
}

// The brow: a row of small soft dabs along an arch. They are thickest in the middle and thin out at
// both ends, so it reads as fine hair, not as a wire. Points are in head space, x mirrored by side.
function buildBrow(head, side, pts, R, material, thickness) {
  const path = new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(side * x, y, 0)), false, 'centripetal');
  const N = 10;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  for (let i = 0; i <= N; i += 1) {
    const t = i / N;
    path.getPoint(t, a);
    path.getPoint(Math.min(1, t + 0.01), b);
    const r = thickness * (0.5 + 0.5 * Math.sin(Math.PI * t));
    const dab = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), material);
    dab.position.set(a.x, a.y, frontZ(a.x, a.y, R) - 0.001);
    dab.scale.set(1.8, 1, 0.6);
    dab.rotation.z = Math.atan2(b.y - a.y, b.x - a.x);
    head.add(dab);
  }
}

// A small mouth: an upper and a lower lip and a soft curve between them
function buildMouth(head, R, y, size, lipMat, lineMat) {
  const up = place(new THREE.Mesh(new THREE.SphereGeometry(0.016 * size, 16, 10), lipMat), head, 0, y + 0.004 * size, frontZ(0, y, R) - 0.003);
  up.scale.set(1.8, 0.5, 0.7);
  const low = place(new THREE.Mesh(new THREE.SphereGeometry(0.015 * size, 16, 10), lipMat), head, 0, y - 0.012 * size, frontZ(0, y - 0.012 * size, R) - 0.003);
  low.scale.set(1.6, 0.6, 0.8);
  const line = [-0.022, 0, 0.022].map((x, i) => {
    const yy = y + (i === 1 ? -0.006 : 0.0) * size;
    return new THREE.Vector3(x * size, yy, frontZ(x * size, yy, R));
  });
  head.add(tubeThrough(line, 0.0022 * size, lineMat, 12));
  return { up, low };
}

// Princess face: long lashes, eyeliner, an eyelid colour, an arched brow, a small nose and soft lips
export function addPrincessFace(head) {
  const R = 0.22;
  const sclera = physMat({ color: '#fbf7f4', roughness: 0.25, clearcoat: 0.6, clearcoatRoughness: 0.15 });
  const iris = physMat({ color: '#7a4a2a', roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.04 });
  const pupil = physMat({ color: '#140b08', roughness: 0.2 });
  const lashMat = physMat({ color: '#1e1210', roughness: 0.5 });
  const lowerMat = physMat({ color: '#a77a68', roughness: 0.5 });
  const lidShadow = physMat({ color: '#f2a6c4', roughness: 0.6, transparent: true, opacity: 0.25, depthWrite: false });
  const cheekMat = physMat({ color: '#ff8fb0', roughness: 0.7, transparent: true, opacity: 0.85 });
  const lipMat = physMat({ color: '#e0557a', roughness: 0.25, clearcoat: 0.8, clearcoatRoughness: 0.1 });
  const lipLineMat = physMat({ color: '#8c2a45', roughness: 0.4 });
  const noseMat = physMat({ color: '#eab28f', roughness: 0.55, sheen: 0.3, sheenColor: new THREE.Color('#ffd9c2') });
  const browMat = physMat({ color: '#6b4a3c', roughness: 0.6 });

  const blinks = [];
  [-1, 1].forEach((side) => {
    const eye = buildEye(head, side, {
      x: 0.085, y: 0, R, size: 1.3, sclera, iris, pupil, lashMat, lowerMat, lidShadow,
      lidRadius: 0.0036, lidMat: lashMat, lowerLine: true, shadow: lidShadow, lashes: true, flick: true,
    });
    blinks.push({ mesh: eye, base: 1 });
    buildBrow(head, side, [[0.03, 0.086], [0.085, 0.1], [0.15, 0.088]], R, browMat, 0.0042);
    // cheek blush
    const cheek = place(new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), cheekMat), head, side * 0.14, -0.065, 0.175);
    cheek.scale.set(1, 0.7, 0.4);
  });

  // a small nose: a soft tip with a darker shadow under it
  const nose = place(new THREE.Mesh(new THREE.SphereGeometry(0.009, 12, 10), noseMat), head, 0, -0.045, frontZ(0, -0.045, R) - 0.004);
  nose.scale.set(0.95, 0.85, 0.7);

  buildMouth(head, R, -0.1, 0.85, lipMat, lipLineMat);
  // a soft light on the lower lip
  const gloss = place(new THREE.Mesh(new THREE.SphereGeometry(0.005, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55 })), head, 0.002, -0.1, frontZ(0.002, -0.1, R) - 0.001);
  gloss.scale.set(1.6, 0.7, 0.5);
  return blinks;
}

// Boy face: round eyes with lashes on the upper lid, straight brows, a small nose, a smile with
// dimples, a few freckles and inner ears
export function addBoyFace(head, skinMat) {
  const R = 0.23;
  const sclera = physMat({ color: '#f8f5f2', roughness: 0.25, clearcoat: 0.6, clearcoatRoughness: 0.15 });
  const iris = physMat({ color: '#2a1a14', roughness: 0.2, clearcoat: 0.8, clearcoatRoughness: 0.06 });
  const pupil = physMat({ color: '#0e0807', roughness: 0.3 });
  const lineMat = physMat({ color: '#1f1412', roughness: 0.5 });
  const browMat = physMat({ color: '#3a2620', roughness: 0.6 });
  const cheekMat = physMat({ color: '#f58fa6', roughness: 0.7, transparent: true, opacity: 0.55 });
  const lipMat = physMat({ color: '#c96a7e', roughness: 0.4, clearcoat: 0.3, clearcoatRoughness: 0.3 });
  const lipLineMat = physMat({ color: '#8a3446', roughness: 0.5 });
  const dimpleMat = physMat({ color: '#e5a983', roughness: 0.6 });
  const noseMat = physMat({ color: '#e7ab8a', roughness: 0.55 });
  const freckleMat = physMat({ color: '#b5714e', roughness: 0.6 });
  const earInnerMat = physMat({ color: '#e0a07f', roughness: 0.6 });

  const blinks = [];
  [-1, 1].forEach((side) => {
    const eye = buildEye(head, side, {
      x: 0.08, y: 0, R, size: 0.9, sclera, iris, pupil, lashMat: lineMat,
      lidRadius: 0.0034, lidMat: lineMat, lowerLine: false, shadow: null, lashes: false, flick: false,
    });
    blinks.push({ mesh: eye, base: 1 });
    buildBrow(head, side, [[0.03, 0.08], [0.085, 0.09], [0.14, 0.082]], R, browMat, 0.0052);
    const cheek = place(new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 8), cheekMat), head, side * 0.12, -0.055, 0.185);
    cheek.scale.set(1, 0.7, 0.4);
    // ears with a darker inner part
    place(new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 8), skinMat), head, side * 0.222, -0.012, 0).scale.set(0.45, 1, 0.8);
    place(new THREE.Mesh(new THREE.SphereGeometry(0.026, 10, 8), earInnerMat), head, side * 0.228, -0.012, 0.004).scale.set(0.3, 0.7, 0.6);
    // dimple beside the smile
    const dimple = place(new THREE.Mesh(new THREE.SphereGeometry(0.0042, 6, 5), dimpleMat), head, side * 0.034, -0.09, frontZ(side * 0.034, -0.09, R) - 0.004);
    dimple.scale.set(1, 1, 0.5);
  });

  const nose = place(new THREE.Mesh(new THREE.SphereGeometry(0.011, 12, 10), noseMat), head, 0, -0.036, frontZ(0, -0.036, R) - 0.004);
  nose.scale.set(0.9, 0.9, 0.75);

  buildMouth(head, R, -0.1, 0.8, lipMat, lipLineMat);

  // freckles across the nose and cheeks
  const freckles = [
    [-0.012, -0.03], [0.01, -0.04], [0, -0.052], [-0.024, -0.046], [0.024, -0.03],
    [-0.1, -0.04], [-0.12, -0.022], [-0.086, -0.062], [0.1, -0.05], [0.118, -0.03], [0.088, -0.07],
  ];
  const freckleGeo = new THREE.SphereGeometry(0.0034, 6, 5);
  freckles.forEach(([x, y]) => {
    const f = place(new THREE.Mesh(freckleGeo, freckleMat), head, x, y, frontZ(x, y, R) - 0.001);
    f.scale.set(1, 1, 0.5);
  });
  return blinks;
}
