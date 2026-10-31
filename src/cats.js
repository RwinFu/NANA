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

// The hall runner, from world.js. The cats may only lie down on it.
const RUG = { z0: 0.3, z1: -37.6, halfW: 1.1 };
const BUTTERFLY_NEAR = 5; // a cat chases a butterfly that flies this close to it
const CHASE_TIME = 2.6; // seconds of chasing
const CHASE_COOLDOWN = 7; // seconds before the cat may chase again
const IDLE_TO_SLEEP = 3; // seconds the couple must stand still before a cat lies down
const LIE_ANGLE = -1.4; // lying on its side

function onRug(x, z) {
  return Math.abs(x) < RUG.halfW - 0.3 && z < RUG.z0 - 0.3 && z > RUG.z1 + 0.3;
}

function nearestButterfly(cat, flyers) {
  let best = null;
  let bestD = BUTTERFLY_NEAR;
  flyers.forEach((f) => {
    const d = Math.hypot(f.position.x - cat.pos.x, f.position.z - cat.pos.z);
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  });
  return best;
}

// Walk towards (x, z) at a speed. Returns the distance left.
function moveTowards(cat, x, z, speed, dt) {
  const dx = x - cat.pos.x;
  const dz = z - cat.pos.z;
  const d = Math.hypot(dx, dz);
  if (d > 0.001) {
    const step = Math.min(d, speed * dt);
    cat.pos.x += (dx / d) * step;
    cat.pos.z += (dz / d) * step;
    const yaw = Math.atan2(dx, dz);
    let diff = yaw - cat.yaw;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    cat.yaw += diff * Math.min(1, dt * 8);
  }
  return d;
}

// Lying down: the body turns onto its side, the legs tuck in, the head drops, and it breathes slowly
function applyLie(cat, lie, t) {
  if (lie <= 0) return;
  const k = lie;
  const breathe = Math.sin(t * 1.8 + cat.idx) * 0.004;
  cat.body.rotation.z = cat.body.rotation.z * (1 - k) + LIE_ANGLE * k;
  cat.body.position.y = cat.body.position.y * (1 - k) + (0.16 + breathe) * k;
  cat.legs.forEach((leg) => {
    leg.hip.rotation.x = leg.hip.rotation.x * (1 - k) + 0.7 * k;
  });
  cat.head.rotation.x = cat.head.rotation.x * (1 - k) + 0.35 * k;
}

// The two cats, following the princess and the boy. They appear once the tour starts.
// States: follow (the default), chase (a butterfly flies close), sleep (the couple stands still on the rug),
// and wake (the couple moves again, so the cat gets up and follows).
export function createCats(scene, hero, { butterflies = () => [] } = {}) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  const boyNode = hero.root.getObjectByName('boy');
  const tmp = new THREE.Vector3();
  const leadNow = new THREE.Vector3();
  const leadLast = { princess: new THREE.Vector3(), boy: new THREE.Vector3() };
  const leadIdle = { princess: 0, boy: 0 }; // seconds each one has stood still

  const list = ['pastil', 'ani'].map((key, idx) => {
    const built = buildCat(key);
    group.add(built.root);
    return {
      key,
      idx,
      ...built,
      gait: SPECS[key],
      pos: new THREE.Vector3(),
      yaw: 0,
      scale: 0,
      placed: false,
      state: 'follow',
      timer: 0,
      cooldown: 2 + idx * 2,
      target: null,
      spot: new THREE.Vector3(),
      lie: 0,
    };
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

    ['princess', 'boy'].forEach((name) => {
      leaderPos(name, leadNow);
      leadIdle[name] = leadNow.distanceTo(leadLast[name]) > 0.0005 ? 0 : leadIdle[name] + dt;
      leadLast[name].copy(leadNow);
    });

    const flyers = butterflies();
    for (const cat of list) {
      if (!cat.placed) place(cat);
      if (cat.scale < 1) {
        cat.scale = Math.min(1, cat.scale + dt * 1.6);
        cat.root.scale.setScalar((1 - Math.pow(1 - cat.scale, 3)) * 1.25);
      }
      const leadName = SPECS[cat.key].leader;
      const lead = leaderPos(leadName, tmp);
      const side = cat.key === 'pastil' ? -1 : 1;
      cat.cooldown = Math.max(0, cat.cooldown - dt);
      let speed = 0;

      if (cat.state === 'follow' && cat.cooldown <= 0) {
        const near = nearestButterfly(cat, flyers);
        if (near && Math.hypot(lead.x - cat.pos.x, lead.z - cat.pos.z) < 7) {
          cat.state = 'chase';
          cat.target = near;
          cat.timer = CHASE_TIME;
        }
      }
      if (cat.state === 'follow' && leadIdle[leadName] > IDLE_TO_SLEEP && onRug(lead.x, lead.z)) {
        cat.state = 'sleep';
        cat.spot.set(
          THREE.MathUtils.clamp(lead.x + side * 0.6, -0.9, 0.9),
          0,
          THREE.MathUtils.clamp(lead.z - 0.9, RUG.z1 + 0.6, RUG.z0 - 0.6)
        );
      }

      if (cat.state === 'chase') {
        cat.timer -= dt;
        const b = cat.target.position;
        speed = cat.gait.maxSpeed * 1.1;
        const d = moveTowards(cat, b.x, b.z, speed, dt);
        if (cat.timer <= 0 || d < 0.3) {
          cat.state = 'follow';
          cat.cooldown = CHASE_COOLDOWN;
        }
      }

      if (cat.state === 'sleep') {
        if (leadIdle[leadName] < 0.2) {
          cat.state = 'wake';
        } else {
          const d = moveTowards(cat, cat.spot.x, cat.spot.z, 1.1, dt);
          speed = d > 0.08 ? 1.1 : 0;
          if (d <= 0.08) cat.lie = Math.min(1, cat.lie + dt * 0.9);
        }
      }

      if (cat.state === 'wake') {
        cat.lie = Math.max(0, cat.lie - dt * 1.3);
        if (cat.lie === 0) {
          cat.state = 'follow';
          cat.cooldown = 2;
        }
      }

      if (cat.state === 'follow') {
        const dx = lead.x - cat.pos.x;
        const dz = lead.z - cat.pos.z;
        const dist = Math.hypot(dx, dz);
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
      }

      cat.root.position.copy(cat.pos);
      cat.root.rotation.y = cat.yaw;
      animateCat(cat, dt, t, speed, cat.idx);
      applyLie(cat, cat.lie, t);
    }
  }

  return { update, group };
}
