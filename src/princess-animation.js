// A short recording of the hero's real path lets the princess use the same
// jumps, ledges and climbing route instead of floating straight through them.
const FOLLOW_DELAY = 0.32;
const FOLLOW_GAP = 18;
const TELEPORT_DISTANCE = 120;

export function followHero(pr, p, time, dt) {
  const trail = pr.trail || (pr.trail = []);
  const last = trail[trail.length - 1];
  if (!last) {
    pr.joinX = pr.x;
    pr.joinY = pr.y;
    pr.joinT = 0;
    pr.followOffset = FOLLOW_GAP * p.facing;
  }
  if (last && Math.hypot(p.x - last.x, p.y - last.y) > TELEPORT_DISTANCE) {
    // Falls and checkpoint retries are discontinuities, not a path to animate.
    trail.length = 0;
    pr.x = p.x - FOLLOW_GAP * p.facing;
    pr.y = p.y;
    pr.speed = 0;
    pr.joinX = pr.x; pr.joinY = pr.y; pr.joinT = 0.3;
    pr.followOffset = FOLLOW_GAP * p.facing;
  }
  trail.push({ t: time, x: p.x, y: p.y, facing: p.facing, onGround: p.onGround, climb: p.climb });
  const targetTime = time - FOLLOW_DELAY;
  while (trail.length > 2 && trail[1].t <= targetTime) trail.shift();
  const a = trail[0];
  const b = trail[1] || a;
  const mix = b.t > a.t ? Math.max(0, Math.min(1, (targetTime - a.t) / (b.t - a.t))) : 0;
  const prevX = pr.x;
  const facing = mix < 0.5 ? a.facing : b.facing;
  pr.followOffset += (FOLLOW_GAP * facing - pr.followOffset) * (1 - Math.exp(-dt * 10));
  const targetX = a.x + (b.x - a.x) * mix - pr.followOffset;
  const targetY = a.y + (b.y - a.y) * mix;
  pr.joinT = Math.min(0.3, (pr.joinT || 0) + dt);
  const join = pr.joinT / 0.3;
  const eased = join * join * (3 - 2 * join);
  pr.x = pr.joinX + (targetX - pr.joinX) * eased;
  pr.y = pr.joinY + (targetY - pr.joinY) * eased;
  pr.facing = facing;
  pr.airborne = !(mix < 0.5 ? a.onGround : b.onGround);
  pr.climbing = mix < 0.5 ? a.climb : b.climb;
  const distance = Math.abs(pr.x - prevX);
  pr.speed = dt > 0 ? Math.min(300, distance / dt) : 0;
  // Advance gait by distance, not by wall-clock time; it stops when she does.
  if (!pr.airborne) pr.phase += distance * 0.11;
}

export function princessPose(pr, time) {
  const captive = pr.state === 'captive';
  const walking = !captive && !pr.airborne && pr.speed > 8;
  const strength = walking ? Math.min(1, pr.speed / 90) : 0;
  const step = Math.sin(pr.phase) * strength;
  const lift = walking ? Math.abs(Math.sin(pr.phase)) * 1.3 * strength : 0;
  const blinkCycle = ((time + 1.4) % 4.8 + 4.8) % 4.8;
  return {
    captive, walking, airborne: !captive && !!pr.airborne, climbing: !captive && !!pr.climbing,
    step, lift, breath: Math.sin(time * 2) * (captive ? 0.35 : 0.22),
    hair: Math.sin(time * 2.3 - 0.7) * 0.7 - step * 1.6,
    blink: blinkCycle < 0.12,
  };
}
