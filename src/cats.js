// The two cats the boy rescues in the mini game. They join the tour of our home and follow us.
//   Pastil (grey tabby, pink collar and bell) follows the princess.
//   Ani (brown tabby) follows the boy.
// Both are built from simple shapes, with a striped texture for the coat.
import * as THREE from 'three';

// Each cat has its own gait:
//   Pastil, the grey one, is calm: a soft, slow trot with a gentle side sway of the body.
//   Ani, the brown one, is quick: short bouncy hops, a fast stride and a flicking tail.
const SPECS = {
  pastil: {
    base: '#a7a098', stripe: '#5b5249', eye: '#e8b64c', collar: true, leader: 'princess',
    maxSpeed: 2.7, legRate: 0.8, bob: 0.5, sway: 0.05, tailRate: 1.0,
  },
  ani: {
    base: '#8a6a4c', stripe: '#3a2a1e', eye: '#7fa35a', collar: false, leader: 'boy',
    maxSpeed: 3.8, legRate: 1.3, bob: 1.8, sway: 0.0, tailRate: 2.2,
  },
};

// Stop this far from the one we follow
const STOP_DIST = 1.05;

function stripeTexture(base, stripe) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 64);
  g.fillStyle = stripe;
  for (let x = 6; x < 128; x += 20) {
    g.fillRect(x, 0, 6, 40);
    g.fillRect(x + 2, 36, 3, 20);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function mesh(geo, mat, x, y, z) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

// The cat stands on the origin with her nose toward +z
function buildCat(key) {
  const spec = SPECS[key];
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const furMat = new THREE.MeshStandardMaterial({ map: stripeTexture(spec.base, spec.stripe), roughness: 0.85 });
  const plainMat = new THREE.MeshStandardMaterial({ color: spec.base, roughness: 0.85 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: spec.eye, emissive: spec.eye, emissiveIntensity: 0.3, roughness: 0.3 });
  const noseMat = new THREE.MeshStandardMaterial({ color: '#f08aa0', roughness: 0.5 });
  const pinkMat = new THREE.MeshStandardMaterial({ color: '#ff8fb8', roughness: 0.4 });
  const goldMat = new THREE.MeshStandardMaterial({ color: '#f5c96a', metalness: 0.8, roughness: 0.25 });

  // Torso, lying along z
  const torso = mesh(new THREE.CapsuleGeometry(0.11, 0.22, 6, 12), furMat, 0, 0.25, 0);
  torso.rotation.x = Math.PI / 2;
  body.add(torso);

  // Head with ears, eyes and nose
  const head = new THREE.Group();
  head.position.set(0, 0.36, 0.25);
  body.add(head);
  head.add(mesh(new THREE.SphereGeometry(0.12, 16, 12), furMat, 0, 0, 0));
  [-1, 1].forEach((s) => {
    const ear = mesh(new THREE.ConeGeometry(0.05, 0.1, 8), furMat, s * 0.07, 0.13, 0);
    ear.rotation.z = -s * 0.25;
    head.add(ear);
  });
  head.add(mesh(new THREE.SphereGeometry(0.045, 10, 8), plainMat, 0, -0.035, 0.1));
  head.add(mesh(new THREE.SphereGeometry(0.018, 8, 6), noseMat, 0, -0.01, 0.145));
  [-1, 1].forEach((s) => {
    head.add(mesh(new THREE.SphereGeometry(0.024, 10, 8), eyeMat, s * 0.05, 0.02, 0.1));
  });

  // Pastil's pink collar with a little gold bell
  if (spec.collar) {
    const collar = mesh(new THREE.TorusGeometry(0.105, 0.013, 8, 20), pinkMat, 0, -0.1, -0.02);
    collar.rotation.x = Math.PI / 2;
    head.add(collar);
    head.add(mesh(new THREE.SphereGeometry(0.022, 10, 8), goldMat, 0, -0.2, 0.0));
  }

  // Four legs, pivoting at the hips
  const legs = [];
  [[-0.08, 0.16], [0.08, 0.16], [-0.08, -0.14], [0.08, -0.14]].forEach(([x, z]) => {
    const hip = new THREE.Group();
    hip.position.set(x, 0.2, z);
    body.add(hip);
    hip.add(mesh(new THREE.CapsuleGeometry(0.03, 0.14, 4, 8), furMat, 0, -0.1, 0));
    hip.add(mesh(new THREE.SphereGeometry(0.035, 8, 6), plainMat, 0, -0.19, 0.01));
    legs.push({ hip, diag: (z > 0) === (x > 0) ? 0 : 1 });
  });

  // Tail: a tapered stick that leans back and up, sways
  const tail = new THREE.Group();
  tail.position.set(0, 0.3, -0.2);
  tail.rotation.x = -0.9;
  body.add(tail);
  tail.add(mesh(new THREE.CapsuleGeometry(0.026, 0.3, 4, 8), furMat, 0, 0.15, 0));

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
