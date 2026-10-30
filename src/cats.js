// The two cats the boy rescues in the mini game. They join the tour of our home and follow us.
//   Pastil (grey tabby, pink collar and bell) follows the princess.
//   Ani (orange tabby) follows the boy.
// Both are built from soft shapes. Their coats use a colour map with tabby stripes and a
// normal map made from fur strands (see fur.js), so the fur catches the light.
import * as THREE from 'three';
import { furMaps } from './fur.js';

// Each cat has its own gait:
//   Pastil, the grey one, is calm: a soft, slow trot with a gentle side sway of the body.
//   Ani, the orange one, is quick: short bouncy hops, a fast stride and a flicking tail.
const SPECS = {
  pastil: {
    base: '#a7a098', stripe: '#5b5249', eye: '#e8b64c', collar: true, leader: 'princess',
    maxSpeed: 2.7, legRate: 0.8, bob: 0.5, sway: 0.05, tailRate: 1.0,
  },
  ani: {
    base: '#e0893f', stripe: '#8f4a1c', eye: '#7fa35a', collar: false, leader: 'boy',
    maxSpeed: 3.8, legRate: 1.3, bob: 1.8, sway: 0.0, tailRate: 2.2,
  },
};

// Stop this far from the one we follow
const STOP_DIST = 1.05;

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
function buildCat(key) {
  const spec = SPECS[key];
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // Shared fur: the normal map gives the coat real texture; each cat has its own colour
  const fur = furMaps(spec.base, spec.stripe);
  const furMat = new THREE.MeshStandardMaterial({ map: fur.map, normalMap: fur.normal, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.92 });
  const plainMat = new THREE.MeshStandardMaterial({ color: spec.base, normalMap: fur.normal, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.92 });
  const creamMat = new THREE.MeshStandardMaterial({ color: '#f3e6d4', normalMap: fur.normal, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.9 });
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
  body.add(blob(1, furMat, 0, 0.25, 0, 0.12, 0.11, 0.22));
  body.add(blob(1, furMat, 0, 0.26, 0.1, 0.115, 0.115, 0.12));
  body.add(blob(1, furMat, 0, 0.25, -0.12, 0.13, 0.12, 0.13));

  // Head: a round skull with cheek fluff, a cream muzzle and a small pink nose
  const head = new THREE.Group();
  head.position.set(0, 0.36, 0.25);
  body.add(head);
  head.add(blob(0.12, furMat, 0, 0, 0, 1, 0.96, 0.98));
  [-1, 1].forEach((s) => {
    head.add(blob(0.052, furMat, s * 0.088, -0.035, 0.03, 1, 0.9, 1));
  });
  head.add(blob(0.05, creamMat, 0, -0.045, 0.092, 1.2, 0.8, 1));
  head.add(blob(0.017, noseMat, 0, -0.02, 0.135, 1.3, 0.8, 0.6));

  // Ears: real triangles, pink inside
  [-1, 1].forEach((s) => {
    const ear = mesh(new THREE.ConeGeometry(0.052, 0.11, 3), furMat, s * 0.072, 0.13, 0);
    ear.rotation.z = -s * 0.28;
    ear.rotation.x = -0.12;
    head.add(ear);
    const inner = mesh(new THREE.ConeGeometry(0.03, 0.07, 3), innerEarMat, s * 0.072, 0.122, 0.018);
    inner.rotation.z = -s * 0.28;
    inner.rotation.x = -0.12;
    head.add(inner);
  });

  // Eyes: coloured irises with a vertical pupil and a small glint
  [-1, 1].forEach((s) => {
    const eye = new THREE.Group();
    eye.position.set(s * 0.046, 0.02, 0.1);
    eye.rotation.y = s * 0.2;
    head.add(eye);
    eye.add(blob(0.026, irisMat, 0, 0, 0, 0.9, 1.25, 0.45));
    eye.add(blob(0.012, pupilMat, 0, 0, 0.012, 0.5, 1.3, 0.4));
    eye.add(blob(0.005, glintMat, 0.008, 0.009, 0.02, 1, 1, 1));
  });

  // Whiskers: three fine lines on each side of the muzzle
  [-1, 1].forEach((s) => {
    [0, 1, 2].forEach((i) => {
      const w = mesh(new THREE.CylinderGeometry(0.0013, 0.0013, 0.12, 4), whiskerMat, s * 0.1, -0.035 + i * 0.018, 0.11);
      w.rotation.z = s * (Math.PI / 2 - 0.08 + i * 0.07);
      head.add(w);
    });
  });

  // Pastil's pink collar with a little gold bell
  if (spec.collar) {
    const collar = mesh(new THREE.TorusGeometry(0.105, 0.013, 8, 20), pinkMat, 0, -0.1, -0.02);
    collar.rotation.x = Math.PI / 2;
    head.add(collar);
    head.add(mesh(new THREE.SphereGeometry(0.022, 10, 8), goldMat, 0, -0.2, 0.0));
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

  // Tail: a curved tube that leans back and up, with rings in the stripe colour.
  // The pivot is where the tail meets the body, so the sway in animateCat still works.
  const tail = new THREE.Group();
  tail.position.set(0, 0.3, -0.2);
  tail.rotation.x = -0.9;
  body.add(tail);
  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0.14, -0.01),
    new THREE.Vector3(0, 0.28, -0.03),
    new THREE.Vector3(0, 0.38, 0.0),
  ]);
  tail.add(mesh(new THREE.TubeGeometry(tailCurve, 16, 0.028, 8, false), furMat, 0, 0, 0));
  [0.12, 0.22, 0.32].forEach((y, i) => {
    const ring = mesh(new THREE.TorusGeometry(0.03, 0.008, 6, 14), ringMat, 0, y, -0.005 * (i + 1) * 0.6);
    ring.rotation.x = Math.PI / 2;
    tail.add(ring);
  });

  return { root, body, head, legs, tail, phase: Math.random() * 6 };
}

function animateCat(cat, dt, t, speed, idx) {
  const k = Math.min(1, speed / 1.6);
  const g = cat.gait;
  cat.phase += dt * (3 + speed * 3.2) * g.legRate;
  cat.legs.forEach((leg) => {
    const swing = Math.sin(cat.phase + leg.diag * Math.PI) * 0.55 * k;
    leg.hip.rotation.x = swing;
  });
  cat.body.position.y = Math.abs(Math.sin(cat.phase)) * 0.02 * g.bob * k;
  cat.body.rotation.z = Math.sin(cat.phase) * g.sway * k;
  // Tail sways and lifts a little when she walks
  cat.tail.rotation.x = -0.9 + Math.sin(t * 1.3 * g.tailRate + idx) * 0.05 - k * 0.2;
  cat.tail.rotation.y = Math.sin(t * 2 * g.tailRate + idx * 2) * 0.3;
  // The head looks around now and then
  cat.head.rotation.y = Math.sin(t * 0.6 + idx * 3) * 0.2 * (1 - k);
}

// The two cats, following the princess and the boy. They appear once the tour starts.
export function createCats(scene, hero) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  const boyNode = hero.root.getObjectByName('boy');
  const tmp = new THREE.Vector3();

  const list = ['pastil', 'ani'].map((key, idx) => {
    const built = buildCat(key);
    group.add(built.root);
    return { key, idx, ...built, gait: SPECS[key], pos: new THREE.Vector3(), yaw: 0, scale: 0, placed: false };
  });

  function leaderPos(name, out) {
    if (name === 'princess') return out.copy(hero.root.position);
    if (boyNode) {
      boyNode.getWorldPosition(out);
      return out;
    }
    return out.copy(hero.root.position);
  }

  function place(cat) {
    const lead = leaderPos(SPECS[cat.key].leader, tmp);
    // Pastil starts by the princess, Ani by the boy
    const side = cat.key === 'pastil' ? -1 : 1;
    cat.pos.set(lead.x + side * 0.9, 0, lead.z - 0.7);
    cat.scale = 0;
    cat.placed = true;
  }

  function update(dt, t, _hero, show) {
    group.visible = show;
    if (!show) return;
    for (const cat of list) {
      if (!cat.placed) place(cat);
      if (cat.scale < 1) {
        cat.scale = Math.min(1, cat.scale + dt * 1.6);
        cat.root.scale.setScalar((1 - Math.pow(1 - cat.scale, 3)) * 1.25);
      }
      const lead = leaderPos(SPECS[cat.key].leader, tmp);
      const dx = lead.x - cat.pos.x;
      const dz = lead.z - cat.pos.z;
      const dist = Math.hypot(dx, dz);
      let speed = 0;
      if (dist > STOP_DIST) {
        speed = Math.min(cat.gait.maxSpeed, 0.9 + (dist - STOP_DIST) * 2.2);
        const step = Math.min(dist - STOP_DIST, speed * dt);
        cat.pos.x += (dx / dist) * step;
        cat.pos.z += (dz / dist) * step;
        const yaw = Math.atan2(dx, dz);
        let diff = yaw - cat.yaw;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        cat.yaw += diff * Math.min(1, dt * 8);
      }
      cat.root.position.copy(cat.pos);
      cat.root.rotation.y = cat.yaw;
      animateCat(cat, dt, t, speed, cat.idx);
    }
  }

  return { update, group };
}
