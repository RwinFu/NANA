// The two cats the boy rescues in the mini game. They join the tour of our home and follow us.
//   Pastil (grey tabby, pink collar and bell) follows the princess.
//   Ani (brown tabby with softly folded ears) follows the boy.
// Both are built from soft shapes. Their coats use a colour map with tabby stripes and a
// normal map made from fur strands (see fur.js), so the fur catches the light.
import * as THREE from 'three';
import { CAT_SPECS, buildCat, animateCat } from './cat-model.js';
import { LAYOUT } from './world.js';
import { nextGuideTarget, roomGuideWaypoint } from './house-reactivity.js';
import { isSolid } from './controls.js';
import { catPlayPhase } from './cat-play.js';

// Stop this far from the one we follow
const STOP_DIST = 1.05;

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

  // The two cats are built on the first frame they can be seen, not while the world is being built.
  // Their fur is two 256 x 256 maps drawn by hand on the CPU and they are hidden through the whole
  // gate (the rescue game), so building them at start-up was work nothing on screen needed yet.
  let built = null;
  function buildCats() {
    if (built) return built;
    built = ['pastil', 'ani'].map((key, idx) => {
      const cat = buildCat(key);
      group.add(cat.root);
      return {
        key,
        idx,
        ...cat,
        gait: CAT_SPECS[key],
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
    return built;
  }

  function leaderPos(name, out) {
    if (name === 'princess') return out.copy(hero.root.position);
    if (boyNode) {
      boyNode.getWorldPosition(out);
      return out;
    }
    return out.copy(hero.root.position);
  }

  function place(cat) {
    const lead = leaderPos(CAT_SPECS[cat.key].leader, tmp);
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
    // first visible frame: build them now, not at start-up
    const list = buildCats();

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
      const leadName = CAT_SPECS[cat.key].leader;
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

  // building them is not done at start-up; `warm()` lets a caller pay for it at a chosen moment
  return { update, group, warm: () => buildCats() };
}
