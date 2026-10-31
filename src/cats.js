// The two cats the boy rescues in the mini game. They join the tour of our home and follow us.
//   Pastil (grey tabby, pink collar and bell) follows the princess.
//   Ani (orange tabby) follows the boy.
// Both are built from soft shapes. Their coats use a colour map with tabby stripes and a
// normal map made from fur strands (see fur.js), so the fur catches the light.
import * as THREE from 'three';
import { furMaps } from './fur.js';
import { LAYOUT } from './world.js';
import { nextGuideTarget, roomGuideWaypoint } from './house-reactivity.js';
import { isSolid } from './controls.js';
import { catPlayPhase } from './cat-play.js';

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
  const furMat = new THREE.MeshStandardMaterial({ map: fur.map, normalMap: fur.normal, normalScale: new THREE.Vector2(0.42, 0.42), roughness: 0.96 });
  const plainMat = new THREE.MeshStandardMaterial({ color: spec.base, normalMap: fur.normal, normalScale: new THREE.Vector2(0.42, 0.42), roughness: 0.96 });
  const creamMat = new THREE.MeshStandardMaterial({ color: '#f3e6d4', normalMap: fur.normal, normalScale: new THREE.Vector2(0.2, 0.2), roughness: 0.96 });
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
  body.add(blob(1, furMat, 0, 0.25, 0, 0.12, 0.11, 0.22));
  body.add(blob(1, furMat, 0, 0.26, 0.1, 0.115, 0.115, 0.12));
  body.add(blob(1, furMat, 0, 0.25, -0.12, 0.13, 0.12, 0.13));
  body.add(blob(1, plainMat, 0, 0.31, 0.16, 0.105, 0.105, 0.13));

  // Head: a round skull with cheek fluff, a cream muzzle and a small pink nose
  const head = new THREE.Group();
  head.position.set(0, 0.36, 0.25);
  body.add(head);
  head.add(blob(0.12, faceMat, 0, 0, 0, 1, 0.96, 0.98));
  [-1, 1].forEach((s) => {
    head.add(blob(0.052, faceMat, s * 0.088, -0.035, 0.03, 1, 0.9, 1));
  });
  head.add(blob(0.05, creamMat, 0, -0.045, 0.092, 1.2, 0.8, 1));
  head.add(blob(0.017, noseMat, 0, -0.02, 0.135, 1.3, 0.8, 0.6));

  // Ear pivots allow independent, gentle listening twitches.
  const ears = [];
  [-1, 1].forEach((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.072, 0.1, 0);
    pivot.rotation.z = -side * 0.28;
    pivot.rotation.x = -0.12;
    head.add(pivot);
    pivot.add(mesh(new THREE.ConeGeometry(0.052, 0.11, 3), faceMat, 0, 0.03, 0));
    pivot.add(mesh(new THREE.ConeGeometry(0.03, 0.07, 3), innerEarMat, 0, 0.022, 0.018));
    ears.push({ pivot, side });
  });

  // Eyes: coloured irises with a vertical pupil and a small glint
  const eyes = [];
  [-1, 1].forEach((s) => {
    const eye = new THREE.Group();
    eye.position.set(s * 0.046, 0.02, 0.1);
    eye.rotation.y = s * 0.2;
    head.add(eye);
    eye.add(blob(0.026, irisMat, 0, 0, 0, 0.9, key === 'pastil' ? 1.18 : 1.35, 0.45));
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
  tailTip.add(blob(0.031, key === 'ani' ? creamMat : furMat, 0, 0.035, 0, 1, 1.8, 1));
  [tail, tailMiddle].forEach((segment) => {
    const ring = mesh(new THREE.TorusGeometry(0.03, 0.006, 6, 14), ringMat, 0, 0.12, 0);
    ring.rotation.x = Math.PI / 2;
    segment.add(ring);
  });
  // Ani has a small cream blaze above the eyes, in addition to her pale tail tip.
  if (key === 'ani') head.add(blob(0.022, creamMat, 0, 0.09, 0.095, 0.8, 1.2, 0.25));

  return { root, body, head, ears, eyes, legs, tail, tailMiddle, tailTip, phase: Math.random() * 6 };

}

function animateCat(cat, dt, t, speed, idx) {
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
    pivot.rotation.z = -side * (0.28 + twitch + (cat.attentive ? 0.08 : 0));
    pivot.rotation.x = -0.12 + (cat.attentive ? 0.15 : 0);
  });
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

// Try a few short steering directions so play stays outside the fountain and bench.
function movePlayfully(cat, x, z, speed, dt) {
  const dx = x - cat.pos.x;
  const dz = z - cat.pos.z;
  const distance = Math.hypot(dx, dz);
  if (distance < 0.3) return 0;
  const heading = Math.atan2(dx, dz);
  const step = Math.min(distance, speed * dt);
  for (const turn of [0, 0.45, -0.45, 0.9, -0.9, 1.4, -1.4]) {
    const a = heading + turn;
    const nx = cat.pos.x + Math.sin(a) * step;
    const nz = cat.pos.z + Math.cos(a) * step;
    if (!isSolid(nx, 0, nz, 0.16)) {
      cat.pos.x = nx;
      cat.pos.z = nz;
      const diff = Math.atan2(Math.sin(a - cat.yaw), Math.cos(a - cat.yaw));
      cat.yaw += diff * Math.min(1, dt * 8);
      return speed;
    }
  }
  return 0;
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
export function createCats(scene, hero, { butterflies = () => [], frames = [] } = {}) {
  const group = new THREE.Group();
  const guidedTargets = new Set();
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
      guideCooldown: 3 + idx * 7,
      guide: null,
      target: null,
      spot: new THREE.Vector3(),
      lie: 0,
      crouch: 0,
      hop: 0,
      lookAngle: null,
      nearPerson: false,
      attentive: false,
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

  let playingOnBench = false;
  let playTime = 0;
  // A short welcome, then a paced guide to the photo room, only once per visit.
  let welcomeStage = 'waiting';
  function update(dt, t, _hero, show, seated = false, story = {}) {
    group.visible = show || !!story.intro;
    if (!group.visible) return;

    if (!show && story.intro) {
      for (const cat of list) {
        if (!cat.placed) {
          cat.pos.set(cat.idx ? 0.7 : -0.7, 0, 1.6);
          cat.yaw = 0; // face outward towards the arriving couple
          cat.root.scale.setScalar(1.25);
          cat.scale = 1;
          cat.placed = true;
        }
        cat.root.position.copy(cat.pos);
        cat.root.rotation.y = cat.yaw;
        cat.crouch = 0.35;
        cat.attentive = true;
        animateCat(cat, dt, t, 0, cat.idx);
        // Sitting upright, rather than the side-lying sleep pose.
        cat.legs.forEach(({ hip }) => { hip.rotation.x = 0.3; });
      }
      return;
    }
    if (show && welcomeStage === 'waiting') welcomeStage = 'welcome';
    if (show && story.doorOpen && welcomeStage === 'welcome') welcomeStage = 'room-guide';

    ['princess', 'boy'].forEach((name) => {
      leaderPos(name, leadNow);
      leadIdle[name] = leadNow.distanceTo(leadLast[name]) > 0.0005 ? 0 : leadIdle[name] + dt;
      leadLast[name].copy(leadNow);
    });

    const flyers = butterflies();
    if (seated !== playingOnBench) {
      playingOnBench = seated;
      playTime = 0;
      for (const cat of list) {
        if (cat.guide) guidedTargets.delete(cat.guide.key);
        cat.guide = null;
        cat.target = null;
        cat.state = seated ? 'bench-play' : 'follow';
        cat.cooldown = seated ? 0 : 2;
        cat.guideCooldown = 4;
      }
    }
    if (seated) playTime += dt;
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
      cat.guideCooldown = Math.max(0, cat.guideCooldown - dt);
      let speed = 0;

      const leadDistance = Math.hypot(lead.x - cat.pos.x, lead.z - cat.pos.z);
      cat.nearPerson = leadDistance < 2.4;
      cat.lookAngle = null;
      cat.attentive = seated || cat.state === 'stalk' || cat.state === 'chase' || cat.nearPerson;
      cat.crouch = 0;
      cat.hop = 0;
      if (seated) {
        const other = list[1 - cat.idx];
        const phase = catPlayPhase(playTime);
        const butterfly = flyers.length ? flyers[phase.cycle % flyers.length] : null;
        let x = lead.x + (cat.idx ? 2 : -2);
        let z = lead.z + 1.5;
        if (phase.name === 'rest') {
          // Rest near the couple, outside the bench collision box.
          x = lead.x + (cat.idx ? 1.9 : -1.9);
          z = lead.z + 1.2;
          const d = Math.hypot(x - cat.pos.x, z - cat.pos.z);
          speed = movePlayfully(cat, x, z, 1.2, dt);
          cat.lie = THREE.MathUtils.clamp(cat.lie + (d < 0.5 ? dt : -dt * 2), 0, 1);
        } else {
          cat.lie = Math.max(0, cat.lie - dt * 2);
          if (phase.name === 'chase' && other.placed) {
            // Alternate the leader every cycle instead of both cats chasing themselves.
            const chaser = phase.cycle % 2;
            if (cat.idx === chaser) {
              x = other.pos.x; z = other.pos.z;
            } else {
              const angle = playTime * 0.8;
              x = lead.x + 2.5 * Math.cos(angle);
              z = lead.z + 1.8 + Math.sin(angle);
            }
          } else if (butterfly && Math.hypot(butterfly.position.x - lead.x, butterfly.position.z - lead.z) < 6) {
            x = butterfly.position.x + (cat.idx ? 0.35 : -0.35);
            z = butterfly.position.z + (cat.idx ? 0.3 : -0.3);
          }
          if (Math.hypot(cat.pos.x - lead.x, cat.pos.z - lead.z) > 6) {
            x = lead.x + (cat.idx ? 1.9 : -1.9); z = lead.z + 1.2;
          }
          const aim = Math.atan2(x - cat.pos.x, z - cat.pos.z);
          if (phase.name === 'stalk') {
            cat.crouch = Math.min(1, phase.progress * 3);
            const diff = Math.atan2(Math.sin(aim - cat.yaw), Math.cos(aim - cat.yaw));
            cat.yaw += diff * Math.min(1, dt * 4);
          } else {
            if (phase.name === 'pounce') cat.hop = Math.sin(phase.progress * Math.PI) * 0.13;
            speed = movePlayfully(cat, x, z, cat.gait.maxSpeed * (phase.name === 'pounce' ? 1.1 : 0.85), dt);
          }
        }
        cat.root.position.copy(cat.pos);
        cat.root.rotation.y = cat.yaw;
        animateCat(cat, dt, t, speed, cat.idx);
        applyLie(cat, cat.lie, t);
        continue;
      }
      if (welcomeStage === 'welcome') {
        // Leave the doorway and greet the couple; don't pin them to a cutscene.
        const distance = Math.hypot(lead.x - cat.pos.x, lead.z - cat.pos.z);
        if (distance > 1.6) speed = movePlayfully(cat, lead.x + side * 0.65, lead.z, cat.gait.maxSpeed, dt);
        else {
          const a = Math.atan2(lead.x - cat.pos.x, lead.z - cat.pos.z);
          const diff = Math.atan2(Math.sin(a - cat.yaw), Math.cos(a - cat.yaw));
          cat.yaw += diff * Math.min(1, dt * 5);
        }
        cat.root.position.copy(cat.pos);
        cat.root.rotation.y = cat.yaw;
        animateCat(cat, dt, t, speed, cat.idx);
        continue;
      }

      if (welcomeStage === 'room-guide') {
        const roomZ = (LAYOUT.room.door.z0 + LAYOUT.room.door.z1) / 2;
        const player = hero.root.position;
        // If the player stays in the garden, accompany them instead of abandoning them.
        const inGarden = player.z > 2.5;
        const goalZ = inGarden ? player.z : roomGuideWaypoint(player.z, roomZ);
        const nearRoom = goalZ <= roomZ + 1;
        const goalX = inGarden ? player.x + side * 0.7 : (nearRoom ? -1.3 + cat.idx * 0.65 : side * 0.55);
        const d = Math.hypot(goalX - cat.pos.x, goalZ - cat.pos.z);
        if (d > 0.4) speed = movePlayfully(cat, goalX, goalZ, cat.gait.maxSpeed, dt);
        else {
          const a = Math.atan2(player.x - cat.pos.x, player.z - cat.pos.z);
          const diff = Math.atan2(Math.sin(a - cat.yaw), Math.cos(a - cat.yaw));
          cat.yaw += diff * Math.min(1, dt * 4);
        }
        cat.root.position.copy(cat.pos);
        cat.root.rotation.y = cat.yaw;
        animateCat(cat, dt, t, speed, cat.idx);
        // Wait until the couple actually reaches the room, not just until the cats arrive.
        if (player.z < roomZ + 3 && list.every((item) => Math.abs(item.pos.z - roomZ) < 1.2)) {
          welcomeStage = 'done';
          list.forEach((item) => { item.state = 'follow'; item.cooldown = 3; item.guideCooldown = 6; });
        }
        continue;
      }

      // At rest, glance toward the nearby person rather than rotating the whole cat.
      if (cat.nearPerson && cat.state === 'follow' && leadDistance < STOP_DIST + 0.5) {
        const angle = Math.atan2(lead.x - cat.pos.x, lead.z - cat.pos.z) - cat.yaw;
        cat.lookAngle = THREE.MathUtils.clamp(Math.atan2(Math.sin(angle), Math.cos(angle)), -0.6, 0.6);
      }

      // Take turns pointing out nearby memories; stay in the hall and close to the couple.
      if (cat.state === 'follow' && cat.guideCooldown <= 0 && leadIdle[leadName] < 0.5 &&
          Math.hypot(lead.x - cat.pos.x, lead.z - cat.pos.z) < 3) {
        const target = nextGuideTarget(lead, frames, guidedTargets, LAYOUT.hallHalfWidth, LAYOUT.hallLength, LAYOUT.room.door);
        if (target) {
          cat.guide = target;
          guidedTargets.add(target.key);
          cat.state = 'guide';
          cat.timer = 8;
        } else {
          cat.guideCooldown = 3;
        }
      }

      if (cat.state === 'guide') {
        cat.timer -= dt;
        const distanceToLeader = Math.hypot(lead.x - cat.pos.x, lead.z - cat.pos.z);
        if (distanceToLeader > 9 || cat.timer <= 0 || Math.abs(lead.x) > LAYOUT.hallHalfWidth) {
          guidedTargets.delete(cat.guide.key);
          cat.guide = null;
          cat.state = 'follow';
          cat.guideCooldown = 12;
        } else {
          const d = moveTowards(cat, cat.guide.x, cat.guide.z, cat.gait.maxSpeed, dt);
          speed = d > 0.25 ? cat.gait.maxSpeed : 0;
          if (d <= 0.25) {
            cat.state = 'guide-wait';
            cat.timer = 4;
          }
        }
      }

      if (cat.state === 'guide-wait') {
        cat.timer -= dt;
        // Turn back toward the couple while waiting, as if inviting them to follow.
        const yaw = Math.atan2(lead.x - cat.pos.x, lead.z - cat.pos.z);
        const diff = Math.atan2(Math.sin(yaw - cat.yaw), Math.cos(yaw - cat.yaw));
        cat.yaw += diff * Math.min(1, dt * 5);
        if (cat.timer <= 0 || Math.hypot(lead.x - cat.pos.x, lead.z - cat.pos.z) > 9 || Math.abs(lead.x) > LAYOUT.hallHalfWidth) {
          cat.state = 'follow';
          cat.guide = null;
          cat.guideCooldown = 14 + cat.idx * 3;
        }
      }

      if (cat.state === 'follow' && cat.cooldown <= 0) {
        const near = nearestButterfly(cat, flyers);
        if (near && Math.hypot(lead.x - cat.pos.x, lead.z - cat.pos.z) < 7) {
          cat.state = 'stalk';
          cat.target = near;
          cat.timer = 0.9;
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

      if (cat.state === 'stalk') {
        cat.timer -= dt;
        cat.crouch = Math.min(1, (0.9 - cat.timer) * 3);
        const b = cat.target.position;
        const a = Math.atan2(b.x - cat.pos.x, b.z - cat.pos.z);
        const diff = Math.atan2(Math.sin(a - cat.yaw), Math.cos(a - cat.yaw));
        cat.yaw += diff * Math.min(1, dt * 4);
        if (cat.timer <= 0) { cat.state = 'chase'; cat.timer = CHASE_TIME; }
      }
      if (cat.state === 'chase') {
        cat.timer -= dt;
        const jumpProgress = (CHASE_TIME - cat.timer) / 0.55;
        if (jumpProgress >= 0 && jumpProgress < 1) cat.hop = Math.sin(jumpProgress * Math.PI) * 0.12;
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
