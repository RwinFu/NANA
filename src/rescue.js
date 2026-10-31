// The rescue mini game. It plays before the intro:
// the boy climbs the dark castle, defeats the dragon with magic sparkles,
// frees the princess and runs with her out of the falling castle to the gate.
// onDone() is called once the game is won (or skipped); the intro plays after it.

import { sfx } from './sfx.js';
import { CAT_APPEARANCE } from './cat-appearance.js';
import { followHero, princessPose } from './princess-animation.js';
import { VICTORY_WALK_START, VICTORY_GATE_CUE, VICTORY_EXIT, PORTAL_ZOOM_START, portalCamera, portalCharacterOpacity, ROCK_WARNING, ledgeX, helpAfterLoss } from './rescue-timing.js';

const W = 960;
const H = 540;
const LEVEL_W = 4300;
const GROUND_Y = 430;
const GRAVITY = 2000;
const JUMP_V = -760;
const RUN_SPEED = 260;
const HALF_W = 13;
const BODY_H = 56;
const HEARTS = 3;
const DRAGON_HITS = 3;
const DRAGON_ACTIVE_X = 500;
const ARENA_X = 1800;
const BARRIER_X = 2180;
// The princess is held on top of her tower (the stone block beside the dragon's yard)
const TOWER = { x0: 2080, x1: 2260, top: 150 };
const PRINCESS_AT = { x: 2180, y: 150 };
const GATE_X = 4150;
const GLITCH_S = 1.2; // the broken-signal burst at the gate, before the fade
const FADE_MS = 1800;
// The golden hair the boy climbs: from the high balcony down to the ground
// Two golden braids to climb: the first up the stage-1 tower to the balcony,
// the second up the princess's tower
const ROPES = [
  { x: 700, top: 150, bottom: GROUND_Y, window: true },
  { x: 2050, top: 150, bottom: GROUND_Y, window: false },
];
// The two cats: Ani (the brown tabby) is caged on the balcony and is rescued first;
// Pastil is caged in the dragon's yard and opens when the dragon flees
const CAT_AT = { ani: { x: 790, y: 150 }, pastil: { x: 1985, y: GROUND_Y } };
const CAT_STYLE = {
  pastil: { ...CAT_APPEARANCE.pastil, name: 'پاستیل' },
  ani: { ...CAT_APPEARANCE.ani, name: 'آنی' },
};
const CAT_IMAGES = {
  pastil: loadImage(`${(import.meta.env?.BASE_URL || '/')}cats/pastil.jpg`),
  ani: loadImage(`${(import.meta.env?.BASE_URL || '/')}cats/ani.jpg`),
};
const FONT = '"Vazirmatn Variable", Vazirmatn, sans-serif';

// Solid ground, with pits between the segments
const GROUND = [[0, 820], [900, 1500], [1590, 3150], [3240, LEVEL_W]];
// Stone ledges (solid from above)
const LEDGES = [
  { x: 300, y: 350, w: 150 },
  { x: 530, y: 280, w: 150 },
  { x: 1000, y: 350, w: 140 },
  { x: 1180, y: 280, w: 150 },
  { x: 1420, y: 360, w: 260 }, // bridge over the pit
  { x: 620, y: 150, w: 200 }, // the high balcony, reached by the golden hair
  { x: 2030, y: 150, w: 230 }, // the top of the princess's tower
  { x: 2400, y: 345, w: 100 }, // safe optional spot to practise the double jump
  { x: 2620, y: 340, w: 160, sway: 32, speed: 0.65 }, // optional slow-moving platform
  { x: 3000, y: 280, w: 170 },
  { x: 3500, y: 350, w: 170 },
];
const CHECKPOINTS = [40, 905, 1190, 1830, 2000, 3245];
const STAGE_NAMES = ['برج قلعه', 'نبرد با اژدها', 'فرار از قلعه'];
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', KeyF: 'fire', KeyK: 'fire',
};
// Hidden skip Easter egg: type LOVE, or tap the three HUD hearts left-to-right.
const SECRET_SKIP_KEYS = ['KeyL', 'KeyO', 'KeyV', 'KeyE'];
const SECRET_HEART_X = [34, 68, 102];
const SECRET_SEQUENCE_MS = 1800;

// ---------- deterministic decoration ---------------------------------------

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeTowers(seed, count, spacing, minH, maxH) {
  const r = rng(seed);
  const list = [];
  for (let i = 0; i < count; i += 1) {
    list.push({
      x: i * spacing + r() * spacing * 0.5 - 200,
      w: 70 + r() * 70,
      h: minH + r() * (maxH - minH),
      spire: r() < 0.55,
      seed: r() * 10,
    });
  }
  return list;
}

function makeStars() {
  const r = rng(3);
  return Array.from({ length: 90 }, () => ({ x: r() * W, y: r() * 230, s: 0.4 + r() * 1.5, ph: r() * 6 }));
}

function makeBats() {
  const r = rng(9);
  return Array.from({ length: 8 }, () => ({ x0: r() * (W + 200), y: 40 + r() * 160, sp: 35 + r() * 45, ph: r() * 6, size: 0.7 + r() * 0.6 }));
}

const FAR_TOWERS = makeTowers(11, 30, 300, 150, 300);
const STARS = makeStars();
const BATS = makeBats();

function makeSkyLanterns() {
  const r = rng(21);
  return Array.from({ length: 16 }, () => ({
    x0: r() * (W + 200), rise: 12 + r() * 16, drift: 4 + r() * 10, ph: r() * 1000, s: 3 + r() * 3,
  }));
}

function makeGlimmer() {
  const r = rng(33);
  return Array.from({ length: 36 }, () => ({
    x: r() * W, y: r() * H, sp: 10 + r() * 26, sw: r() * 6, ph: r() * 6, s: 1 + r() * 1.8,
  }));
}

function makeClouds() {
  const r = rng(44);
  return Array.from({ length: 7 }, () => ({ x: r() * W * 1.6, y: 40 + r() * 150, w: 120 + r() * 140, sp: 3 + r() * 6 }));
}

const SKY_LANTERNS = makeSkyLanterns();
const GLIMMER = makeGlimmer();
const CLOUDS = makeClouds();

// ---------- game state ------------------------------------------------------

function newState() {
  return {
    phase: 'title', // title | play | won | lost | done
    t: 0,
    endT: 0,
    camX: 0,
    shake: 0,
    flash: 0,
    flashT: 5,
    glitch: 0,
    hearts: HEARTS,
    checkpoint: CHECKPOINTS[0],
    rescued: false,
    cageOpen: false,
    msg: '',
    msgT: 0,
    p: { x: 40, y: GROUND_Y, vx: 0, vy: 0, facing: 1, onGround: true, phase: 0, inv: 0, coyote: 0, jumpBuf: 0, fireCd: 0, climb: false, usedDouble: false },
    dragon: { x: 1500, y: 150, hp: DRAGON_HITS, state: 'fight', active: false, alpha: 1, flap: 0, hit: 0, fireT: 1.5, surprise: 0 },
    princess: { x: PRINCESS_AT.x, y: PRINCESS_AT.y, state: 'captive', facing: 1, phase: 0, speed: 0, airborne: false, climbing: false, trail: [] },
    fire: [],
    sparks: [],
    rocks: [],
    rockT: 1.5,
    parts: [],
    ropeTaught: false,
    cats: {
      ani: { freed: false, x: CAT_AT.ani.x, y: CAT_AT.ani.y, reaction: 0 },
      pastil: { freed: false, x: CAT_AT.pastil.x, y: CAT_AT.pastil.y, reaction: 0 },
    },
    abilities: { doubleJump: false, rapid: false },
  };
}

function say(g, text, secs = 2.6) {
  g.msg = text;
  g.msgT = secs;
}

function burst(g, x, y, color, n, speed, star = false) {
  for (let i = 0; i < n; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const s = Math.random() * speed;
    g.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * 0.4, life: 0.7 + Math.random() * 0.6, max: 1.3, color, size: 2 + Math.random() * 3, star });
  }
}

function solidsFor(g) {
  const list = GROUND.map(([a, b]) => ({ x0: a, x1: b, y0: GROUND_Y, y1: GROUND_Y + 220 }));
  for (const l of LEDGES) {
    const x = ledgeX(l, g.t);
    list.push({ x0: x, x1: x + l.w, y0: l.y, y1: l.y + 26 });
  }
  list.push({ x0: TOWER.x0, x1: TOWER.x1, y0: TOWER.top, y1: GROUND_Y + 220 });
  return list;
}

function lose(g, why) {
  g.hearts -= 1;
  if (g.hearts <= 0) {
    g.hearts = 0;
    g.phase = 'lost';
    g.endT = 0;
    return;
  }
  if (why === 'fall') {
    const p = g.p;
    p.x = g.checkpoint;
    p.y = GROUND_Y;
    p.vx = 0;
    p.vy = 0;
    p.onGround = true;
    p.climb = false;
    p.inv = 1.5;
    say(g, 'مراقب باش! دوباره تلاش کن');
  }
}

function hurt(g) {
  const p = g.p;
  if (p.inv > 0 || g.phase !== 'play') return;
  g.shake = 0.35;
  p.inv = 1.3;
  p.climb = false;
  p.vx = -p.facing * 180;
  p.vy = -300;
  p.onGround = false;
  burst(g, p.x, p.y - 30, '#ff5c7a', 12, 200);
  sfx.play('hit');
  lose(g, 'hit');
  if (g.phase === 'play') say(g, 'اوه! مراقب اژدها باش', 1.8);
}

// ---------- update ----------------------------------------------------------

function update(g, dt, input, pressed) {
  g.t += dt;
  g.shake = Math.max(0, g.shake - dt);
  g.flash = Math.max(0, g.flash - dt * 1.8);
  g.msgT = Math.max(0, g.msgT - dt);
  for (const q of g.parts) {
    q.life -= dt;
    q.vy += 500 * dt;
    q.x += q.vx * dt;
    q.y += q.vy * dt;
  }
  g.parts = g.parts.filter((q) => q.life > 0);

  if (g.phase === 'title' || g.phase === 'lost' || g.phase === 'done') return;

  const p = g.p;
  const playing = g.phase === 'play';
  if (g.phase === 'won') g.endT += dt;

  // Flash lightning in the castle
  if (playing) {
    g.flashT -= dt;
    if (g.flashT <= 0) {
      g.flash = 0.9;
      g.flashT = 6 + Math.random() * 5;
    }
  }

  // Input. After the win the boy walks in through the gate and stops inside it.
  let dir = 0;
  if (playing) dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  else if (g.phase === 'won' && g.endT >= VICTORY_WALK_START && p.x < GATE_X + 120) dir = 1;
  p.vx += (dir * (playing ? RUN_SPEED : 70) - p.vx) * Math.min(1, dt * 12);
  if (dir) p.facing = dir;
  p.coyote = p.onGround ? 0.12 : p.coyote - dt;
  p.jumpBuf = pressed.jump && playing ? 0.12 : p.jumpBuf - dt;

  // The golden hair: hold jump next to it to climb. Let go to slide down, walk away to drop off.
  const rope = ROPES.find((r) => Math.abs(p.x - r.x) < 18 && p.y <= r.bottom + 2 && p.y > r.top + 12) || null;
  const nearRope = rope !== null;
  if (p.climb && (!playing || dir !== 0)) p.climb = false;
  if (!p.climb && playing && dir === 0 && nearRope && input.jump) {
    p.climb = true;
    p.rope = rope;
    p.jumpBuf = 0;
  }

  p.fireCd = Math.max(0, p.fireCd - dt);
  if (playing && (pressed.fire || (g.abilities.rapid && input.fire)) && p.fireCd <= 0) {
    p.fireCd = g.abilities.rapid ? 0.16 : 0.35;
    spark(g);
  }
  p.inv = Math.max(0, p.inv - dt);
  if (p.onGround && Math.abs(p.vx) > 5) p.phase += Math.abs(p.vx) * dt * 0.028;

  if (p.climb) {
    p.phase += dt * 9;
    p.x = p.rope.x;
    p.vx = 0;
    p.vy = input.jump ? -230 : 70;
    p.onGround = false;
    p.coyote = 0;
    p.y += p.vy * dt;
    if (p.y <= p.rope.top) {
      p.y = p.rope.top;
      p.vy = 0;
      p.climb = false;
      p.onGround = true;
      burst(g, p.x, p.y, '#ffd66b', 10, 140);
    } else if (p.y >= GROUND_Y) {
      p.y = GROUND_Y;
      p.vy = 0;
      p.climb = false;
      p.onGround = true;
    }
  } else {
    if (p.onGround) p.usedDouble = false;
    if (p.jumpBuf > 0 && (p.onGround || p.coyote > 0)) {
      p.vy = JUMP_V;
      p.onGround = false;
      p.coyote = 0;
      p.jumpBuf = 0;
    } else if (p.jumpBuf > 0 && g.abilities.doubleJump && !p.usedDouble) {
      // Pastil's gift: a second jump in the air
      p.vy = JUMP_V * 0.92;
      p.usedDouble = true;
      p.jumpBuf = 0;
      burst(g, p.x, p.y, '#cfe9ff', 8, 120);
      burst(g, p.x, p.y, '#fff4c2', 10, 220, true);
      sfx.play('jump2');
    }
    // Carry the player by the same displacement used for drawing the platform.
    if (p.onGround) {
      for (const ledge of LEDGES) {
        if (!ledge.sway) continue;
        const prev = ledgeX(ledge, g.t - dt);
        if (Math.abs(p.y - ledge.y) < 1 && p.x + HALF_W > prev && p.x - HALF_W < prev + ledge.w) {
          p.x += ledgeX(ledge, g.t) - prev;
        }
      }
    }
    // Physics: horizontal, then vertical
    const solids = solidsFor(g);
    const prevX = p.x;
    p.x += p.vx * dt;
    for (const s of solids) {
      if (p.x + HALF_W > s.x0 && p.x - HALF_W < s.x1 && p.y > s.y0 + 2 && p.y - BODY_H < s.y1) {
        if (p.x > prevX) p.x = s.x0 - HALF_W;
        else p.x = s.x1 + HALF_W;
        p.vx = 0;
      }
    }
    p.x = Math.max(HALF_W, p.x);
    p.vy = Math.min(1100, p.vy + GRAVITY * dt);
    const prevY = p.y;
    p.y += p.vy * dt;
    p.onGround = false;
    for (const s of solids) {
      if (p.x + HALF_W <= s.x0 || p.x - HALF_W >= s.x1) continue;
      if (p.vy >= 0 && prevY <= s.y0 + 1 && p.y >= s.y0) {
        p.y = s.y0;
        p.vy = 0;
        p.onGround = true;
      } else if (p.vy < 0 && prevY - BODY_H >= s.y1 && p.y - BODY_H < s.y1) {
        p.y = s.y1 + BODY_H;
        p.vy = 0;
      }
    }
  }
  if (p.y > 620) lose(g, 'fall');

  // Checkpoints: the furthest one reached on the ground
  // Checkpoints only count when the boy stands on the ground (not on the tower top)
  for (const cp of CHECKPOINTS) {
    if (p.onGround && p.y >= GROUND_Y - 1 && p.x >= cp && cp > g.checkpoint) g.checkpoint = cp;
  }
  if (playing && !g.ropeTaught && Math.abs(p.x - ROPES[0].x) < 160) {
    g.ropeTaught = true;
    say(g, 'موی طلایی را بگیر و دکمه‌ی پرش را نگه دار تا بالا بروی', 3.4);
  }

  if (playing) {
    updateDragon(g, dt);
    updateFire(g, dt);
    updateSparks(g, dt);
    updateRocks(g, dt);
    checkCage(g);
  }
  updatePrincess(g, dt);
  updateCats(g, dt);

  if (playing && g.rescued && g.cats.pastil.freed && g.cats.ani.freed && p.x >= GATE_X - 25) {
    g.phase = 'won';
    g.endT = 0;
    g.msgT = 0;
  }

  g.camX = Math.max(0, Math.min(LEVEL_W - W, p.x - 330));
}

// Freeing the cats: Ani on the balcony first, Pastil in the yard after the dragon. Freed cats run after the boy.
function updateCats(g, dt) {
  const p = g.p;
  const an = g.cats.ani;
  const pa = g.cats.pastil;
  if (g.phase !== 'play' && g.phase !== 'won') return;

  if (!an.freed && Math.abs(p.x - CAT_AT.ani.x) < 60 && Math.abs(p.y - CAT_AT.ani.y) < 56) {
    an.freed = true;
    an.reaction = 3;
    g.abilities.rapid = true;
    g.shake = 0.4;
    sfx.play('chime');
    burst(g, CAT_AT.ani.x, CAT_AT.ani.y - 30, '#ffd66b', 26, 260);
    say(g, 'آنی نجات یافت! دکمه‌ی جرقه را نگه دار تا سریع‌تر شلیک کنی', 4.5);
  }
  if (!pa.freed && g.cageOpen && Math.abs(p.x - CAT_AT.pastil.x) < 64) {
    pa.freed = true;
    pa.reaction = 3;
    g.abilities.doubleJump = true;
    g.shake = 0.4;
    sfx.play('chime');
    burst(g, CAT_AT.pastil.x, CAT_AT.pastil.y - 30, '#ff8fb8', 26, 260);
    say(g, 'پاستیل نجات یافت! در هوا دوباره دکمه‌ی پرش را بزن', 4.5);
  }

  if (g.phase === 'play' && g.rescued && p.x >= GATE_X - 120 && (!an.freed || !pa.freed) && g.msgT <= 0) {
    const missing = !an.freed ? CAT_STYLE.ani.name : CAT_STYLE.pastil.name;
    say(g, `${missing} هنوز اسیر است! برو و نجاتش بده`, 2.4);
  }

  an.reaction = Math.max(0, an.reaction - dt);
  pa.reaction = Math.max(0, pa.reaction - dt);
  // Freed cats follow the boy. Ani briefly plays with a nearby spark after rescue.
  const followX = (back) => p.x - back * p.facing;
  if (an.freed) {
    const toy = an.reaction > 0 ? g.sparks.find((spark) => Math.abs(spark.x - p.x) < 120) : null;
    const target = toy ? Math.max(p.x - 70, Math.min(p.x + 70, toy.x)) : followX(40);
    an.x += (target - an.x) * Math.min(1, dt * 5);
    an.y += (p.y - an.y) * Math.min(1, dt * 8);
  }
  if (pa.freed) {
    pa.x += (followX(70) - pa.x) * Math.min(1, dt * 5);
    pa.y += (p.y - pa.y) * Math.min(1, dt * 8);
  }
}

function spark(g) {
  const p = g.p;
  const d = g.dragon;
  sfx.play('spark');
  const sx = p.x + p.facing * 22;
  const sy = p.y - 34;
  let vx = p.facing * 520;
  let vy = 0;
  // In the dragon's arena the sparkle flies toward the dragon
  if (d.active && d.state === 'fight' && p.x >= ARENA_X - 150) {
    const dx = d.x - sx;
    const dy = d.y - sy;
    const len = Math.hypot(dx, dy) || 1;
    vx = (dx / len) * 520;
    vy = (dy / len) * 520;
  }
  g.sparks.push({ x: sx, y: sy, vx, vy, life: 1.1 });
  burst(g, sx, sy, '#ffd6e7', 4, 60);
}

function updateDragon(g, dt) {
  const d = g.dragon;
  const p = g.p;
  d.flap += dt * 5;
  d.hit = Math.max(0, d.hit - dt);
  d.surprise = Math.max(0, d.surprise - dt);
  if (d.state === 'fight' && g.sparks.some((s) => Math.hypot(s.x - d.x, s.y - d.y) < 150)) d.surprise = 0.3;
  if (d.state === 'fled') {
    d.y -= 140 * dt;
    d.x += (100 + Math.sin(g.t * 16) * 35) * dt;
    d.alpha = Math.max(0, d.alpha - 0.5 * dt);
    return;
  }
  const inArena = p.x >= ARENA_X;
  if (p.x > DRAGON_ACTIVE_X || inArena) d.active = true;
  if (!d.active) return;
  const target = inArena
    ? PRINCESS_AT.x - 130 + Math.sin(g.t * 0.9) * 90
    : p.x + 300 + Math.sin(g.t * 0.7) * 50;
  d.x += (target - d.x) * Math.min(1, dt * 1.6);
  d.y = 150 + Math.sin(g.t * 1.3) * 30;
  d.fireT -= dt;
  if (d.fireT <= 0) {
    d.fireT = inArena ? 1.5 : 2.6;
    sfx.play('breath');
    const sx = d.x - 80;
    const sy = d.y + 16;
    const dx = p.x - sx;
    const dy = p.y - 30 - sy;
    const len = Math.hypot(dx, dy) || 1;
    g.fire.push({ x: sx, y: sy, vx: (dx / len) * 320, vy: (dy / len) * 320, life: 4 });
  }
}

function updateFire(g, dt) {
  const p = g.p;
  for (const f of g.fire) {
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.life -= dt;
    if (Math.abs(f.x - p.x) < 20 && Math.abs(f.y - (p.y - 28)) < 34) {
      f.life = 0;
      hurt(g);
    }
  }
  g.fire = g.fire.filter((f) => f.life > 0 && f.x > -100);
}

function updateSparks(g, dt) {
  const d = g.dragon;
  for (const s of g.sparks) {
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.life -= dt;
    if (d.active && d.state === 'fight' && Math.abs(s.x - d.x) < 70 && Math.abs(s.y - d.y) < 46) {
      s.life = 0;
      d.hp -= 1;
      d.hit = 0.3;
      sfx.play('clank');
      burst(g, s.x, s.y, '#ffd66b', 14, 260);
      if (d.hp <= 0) {
        d.state = 'fled';
        g.cageOpen = true;
        say(g, 'اژدها فرار کرد! حالا برو سراغ قفس پرنسس', 3.2);
      }
    }
  }
  g.sparks = g.sparks.filter((s) => s.life > 0 && s.x < LEVEL_W + 100 && s.x > -100);
}

function updateRocks(g, dt) {
  const p = g.p;
  if (g.rescued) {
    g.rockT -= dt;
    if (g.rockT <= 0) {
      g.rockT = 1.15 + Math.random() * 0.45;
      const x = Math.max(BARRIER_X + 40, Math.min(LEVEL_W - 60, p.x + (Math.random() - 0.25) * 420));
      g.rocks.push({ x, y: -140, vy: 120, landed: false, landT: 0.6, warning: ROCK_WARNING });
    }
  }
  for (const r of g.rocks) {
    if (!r.landed) {
      if (r.warning > 0) { r.warning -= dt; continue; }
      r.vy += 520 * dt;
      r.y += r.vy * dt;
      if (!r.landed && Math.abs(r.x - p.x) < 22 && r.y > p.y - BODY_H && r.y < p.y + 4) {
        hurt(g);
      }
      if (r.y >= GROUND_Y - 6) {
        r.y = GROUND_Y - 6;
        r.landed = true;
        burst(g, r.x, r.y, '#8a7f98', 6, 120);
      }
    } else {
      r.landT -= dt;
    }
  }
  g.rocks = g.rocks.filter((r) => !r.landed || r.landT > 0);
}

function checkCage(g) {
  const p = g.p;
  if (g.rescued || Math.abs(p.x - PRINCESS_AT.x) >= 70 || Math.abs(p.y - PRINCESS_AT.y) >= 60) return;
  if (!g.cageOpen) {
    if (g.msgT <= 0) say(g, 'اول اژدها را با جرقه‌های جادویی شکست بده', 1.6);
    return;
  }
  g.rescued = true;
  g.princess.state = 'freed';
  g.shake = 0.6;
  g.flash = 1;
  burst(g, PRINCESS_AT.x, PRINCESS_AT.y - 60, '#ffd66b', 40, 360);
  burst(g, PRINCESS_AT.x, PRINCESS_AT.y - 60, '#ff8fb8', 30, 300);
  say(g, 'پرنسس نجات یافت! حالا با هم فرار کنید', 3.2);
}

function updatePrincess(g, dt) {
  const pr = g.princess;
  if (pr.state === 'captive') {
    pr.phase += dt * 4;
    return;
  }
  followHero(pr, g.p, g.t, dt);
}

// ---------- drawing ---------------------------------------------------------

function limb(ctx, x, y, len, a) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.sin(a) * len, y + Math.cos(a) * len);
  ctx.stroke();
}

function heartShape(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.3);
  ctx.bezierCurveTo(x - s * 0.5, y - s * 0.4, x - s, y + s * 0.2, x, y + s);
  ctx.bezierCurveTo(x + s, y + s * 0.2, x + s * 0.5, y - s * 0.4, x, y + s * 0.3);
  ctx.closePath();
}

function drawSky(ctx, g, t) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#05061a');
  sky.addColorStop(0.5, '#1d1446');
  sky.addColorStop(0.85, '#4a2a6a');
  sky.addColorStop(1, '#8a4a72');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Moon moves more slowly than the clouds and towers.
  ctx.save();
  ctx.translate(-g.camX * 0.025, 0);
  const moon = ctx.createRadialGradient(740, 96, 10, 740, 96, 120);
  moon.addColorStop(0, 'rgba(255,236,200,0.45)');
  moon.addColorStop(1, 'rgba(255,236,200,0)');
  ctx.fillStyle = moon;
  ctx.fillRect(600, 0, 280, 240);
  ctx.fillStyle = '#f7ecd6';
  ctx.beginPath();
  ctx.arc(740, 96, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(160,140,170,0.35)';
  ctx.beginPath();
  ctx.arc(728, 88, 7, 0, Math.PI * 2);
  ctx.arc(752, 106, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  // Stars: they drift very slowly to the left, and twinkle
  for (const s of STARS) {
    const x = (((s.x - t * 2 * s.s) % W) + W) % W;
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 2 + s.ph);
    ctx.fillStyle = '#fff4e0';
    ctx.fillRect(x, s.y, s.s, s.s);
  }
  ctx.globalAlpha = 1;

  // A shooting star every few seconds: it streaks across the sky in under a second
  const cycle = 6.5;
  const k = Math.floor(t / cycle);
  const ph = t - k * cycle;
  if (ph < 0.8) {
    const r = rng(k * 7 + 1);
    const sx = 60 + r() * (W * 0.55);
    const sy = 30 + r() * 110;
    const p = ph / 0.8;
    const hx = sx + p * 260;
    const hy = sy + p * 110;
    const streak = ctx.createLinearGradient(hx - 130, hy - 60, hx, hy);
    streak.addColorStop(0, 'rgba(255,244,224,0)');
    streak.addColorStop(1, `rgba(255,244,224,${(Math.sin(p * Math.PI) * 0.9).toFixed(3)})`);
    ctx.strokeStyle = streak;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hx - 130, hy - 60);
    ctx.lineTo(hx, hy);
    ctx.stroke();
  }
}

// Soft clouds drifting across the sky, moving a little with the camera (a parallax layer)
function drawClouds(ctx, g, t) {
  const f = 0.12;
  const span = W * 1.6;
  ctx.fillStyle = 'rgba(176,146,206,0.14)';
  for (const c of CLOUDS) {
    const x = (((c.x + t * c.sp - g.camX * f) % span) + span) % span - 200;
    ctx.beginPath();
    ctx.ellipse(x, c.y, c.w * 0.5, c.w * 0.14, 0, 0, Math.PI * 2);
    ctx.ellipse(x - c.w * 0.25, c.y + 6, c.w * 0.3, c.w * 0.12, 0, 0, Math.PI * 2);
    ctx.ellipse(x + c.w * 0.28, c.y + 8, c.w * 0.28, c.w * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawTowers(ctx, g, list, f, baseY, color, t) {
  const camX = g.camX;
  ctx.save();
  ctx.translate(-camX * f, 0);
  const left = camX * f - 200;
  const right = camX * f + W + 200;
  ctx.fillStyle = color;
  for (const b of list) {
    if (b.x + b.w < left || b.x > right) continue;
    ctx.fillRect(b.x, baseY - b.h, b.w, b.h + 400);
    ctx.beginPath();
    ctx.moveTo(b.x - 6, baseY - b.h);
    ctx.lineTo(b.x + b.w / 2, baseY - b.h - (b.spire ? 95 : 40));
    ctx.lineTo(b.x + b.w + 6, baseY - b.h);
    ctx.closePath();
    ctx.fill();
    // a lit window that flickers
    const a = 0.45 + 0.4 * Math.sin(t * 3 + b.seed);
    ctx.fillStyle = `rgba(255,190,110,${a.toFixed(3)})`;
    ctx.fillRect(b.x + b.w * 0.35, baseY - b.h * 0.6, 8, 14);
    ctx.fillStyle = color;
  }
  ctx.restore();
}

function drawBats(ctx, t) {
  ctx.fillStyle = '#07040c';
  for (const b of BATS) {
    const span = W + 120;
    const x = (((b.x0 - t * b.sp) % span) + span) % span - 60;
    const y = b.y + Math.sin(t * 2 + b.ph) * 12;
    const flap = Math.sin(t * 12 + b.ph) * 6 * b.size;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(b.size, b.size);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-8, -10 + flap, -20, -4 + flap);
    ctx.quadraticCurveTo(-12, 2, 0, 3);
    ctx.quadraticCurveTo(12, 2, 20, -4 + flap);
    ctx.quadraticCurveTo(8, -10 + flap, 0, 0);
    ctx.fill();
    ctx.restore();
  }
}

function drawWall(ctx, g, t) {
  ctx.save();
  ctx.translate(-g.camX, 0);
  const camX = g.camX;
  const x0 = Math.floor((camX - 160) / 160) * 160;
  for (let x = x0; x < camX + W + 160; x += 160) {
    ctx.fillStyle = '#2a1c3f';
    ctx.fillRect(x, 60, 160, GROUND_Y - 60);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    for (let y = 60; y < GROUND_Y; y += 40) {
      ctx.fillRect(x, y, 160, 2);
      ctx.fillRect(x + ((y / 40) % 2) * 40, y, 2, 40);
    }
    // A tiny blue-and-pink heart woven into the old stone: a quiet story hint.
    if (Math.floor(x / 160) % 4 === 1) {
      ctx.fillStyle = 'rgba(255,143,184,0.18)';
      heartShape(ctx, x + 80, 300, 7); ctx.fill();
      ctx.fillStyle = 'rgba(90,150,210,0.18)';
      ctx.fillRect(x + 66, 318, 28, 3);
    }
    // a tall arched window with cold light, every other block
    if (Math.floor(x / 160) % 2 === 0) {
      ctx.fillStyle = '#0c0716';
      ctx.beginPath();
      ctx.moveTo(x + 50, 250);
      ctx.lineTo(x + 50, 150);
      ctx.arc(x + 80, 150, 30, Math.PI, 0);
      ctx.lineTo(x + 110, 250);
      ctx.closePath();
      ctx.fill();
      const glow = ctx.createRadialGradient(x + 80, 200, 4, x + 80, 200, 90);
      glow.addColorStop(0, `rgba(130,160,255,${(0.18 + 0.05 * Math.sin(t + x)).toFixed(3)})`);
      glow.addColorStop(1, 'rgba(130,160,255,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - 10, 100, 180, 200);
    }
  }
  // Ivy climbing the stone, with pale blossoms among the leaves
  for (let x = x0; x < camX + W + 160; x += 160) {
    const r = rng(Math.abs(Math.floor(x / 160)) * 97 + 5);
    for (let v = 0; v < 3; v += 1) {
      const sx = x + 14 + r() * 132;
      const len = 70 + r() * 150;
      const sway = r() * 6;
      ctx.strokeStyle = '#2f6b47';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let q = 0; q <= len; q += 8) {
        const px = sx + Math.sin(t * 0.9 + q * 0.04 + sway) * 3;
        if (q === 0) ctx.moveTo(px, 60);
        else ctx.lineTo(px, 60 + q);
      }
      ctx.stroke();
      for (let q = 12; q < len; q += 14) {
        const n = Math.round(q / 14);
        const px = sx + Math.sin(t * 0.9 + q * 0.04 + sway) * 3;
        const side = n % 2 === 0 ? 1 : -1;
        ctx.fillStyle = n % 3 === 0 ? '#58a870' : '#3f8a5a';
        ctx.beginPath();
        ctx.ellipse(px + side * 5, 60 + q, 5, 2.4, side * 0.6, 0, Math.PI * 2);
        ctx.fill();
        if (n % 4 === 2) {
          ctx.fillStyle = '#ffb3d1';
          ctx.beginPath();
          ctx.arc(px - side * 6, 62 + q, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }
  // Lanterns hung on chains from the stone
  const kl0 = Math.floor((camX - 150) / 380);
  for (let k = kl0; k * 380 + 340 < camX + W + 150; k += 1) {
    if (k < 0 || k % 2 === 0) continue;
    const x = 340 + k * 380;
    ctx.strokeStyle = '#7a5a3a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, 60);
    ctx.lineTo(x, 118);
    ctx.stroke();
    const sway = Math.sin(t * 1.4 + k) * 1.5;
    const glow = ctx.createRadialGradient(x, 132, 4, x, 132, 90);
    glow.addColorStop(0, 'rgba(255,200,120,0.35)');
    glow.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 90, 42, 180, 180);
    ctx.fillStyle = '#ffcf7a';
    ctx.beginPath();
    ctx.ellipse(x + sway, 132, 8, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff4cf';
    ctx.beginPath();
    ctx.ellipse(x + sway, 133, 3.5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Torches on the wall
  const k0 = Math.floor((camX - 150) / 380);
  for (let k = k0; k * 380 + 150 < camX + W + 150; k += 1) {
    if (k < 0) continue;
    const x = 150 + k * 380;
    ctx.fillStyle = '#d9a441';
    ctx.fillRect(x - 3, 236, 6, 30);
    const flick = Math.sin(t * 17 + k) * 2 + Math.sin(t * 31 + k * 2) * 1.2;
    const glow = ctx.createRadialGradient(x, 228, 6, x, 228, 130);
    glow.addColorStop(0, 'rgba(255,150,60,0.32)');
    glow.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 130, 98, 260, 260);
    ctx.fillStyle = '#ffb23a';
    ctx.beginPath();
    ctx.ellipse(x, 226, 6, 11 + flick, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff1b0';
    ctx.beginPath();
    ctx.ellipse(x, 230, 3, 6 + flick * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawFloor(ctx, g) {
  // Pits between the ground segments
  for (let i = 0; i < GROUND.length - 1; i += 1) {
    const a = GROUND[i][1];
    const b = GROUND[i + 1][0];
    const pit = ctx.createLinearGradient(0, GROUND_Y, 0, H);
    pit.addColorStop(0, '#05030a');
    pit.addColorStop(1, '#2a0f2c');
    ctx.fillStyle = pit;
    ctx.fillRect(a, GROUND_Y, b - a, H - GROUND_Y);
  }
  for (const [a, b] of GROUND) {
    ctx.fillStyle = '#3a2a52';
    ctx.fillRect(a, GROUND_Y, b - a, 220);
    ctx.fillStyle = '#9d82c4';
    ctx.fillRect(a, GROUND_Y, b - a, 4);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let x = a; x < b; x += 70) ctx.fillRect(x, GROUND_Y + 14, 2, 90);
    for (let y = GROUND_Y + 40; y < H; y += 46) ctx.fillRect(a, y, b - a, 2);
  }
  for (const l of LEDGES) {
    const x = ledgeX(l, g.t);
    ctx.fillStyle = '#4d3868';
    ctx.fillRect(x, l.y, l.w, 26);
    ctx.fillStyle = '#b294d9';
    ctx.fillRect(x, l.y, l.w, 3);
    ctx.fillStyle = '#2a1d3c';
    ctx.fillRect(x, l.y + 20, l.w, 6);
  }
}

function drawCage(ctx, g, t) {
  const cx = PRINCESS_AT.x;
  const base = PRINCESS_AT.y;
  if (g.cageOpen && !g.rescued) {
    const pulse = 0.35 + 0.15 * Math.sin(t * 4);
    const glow = ctx.createRadialGradient(cx, base - 60, 10, cx, base - 60, 110);
    glow.addColorStop(0, `rgba(255,214,120,${pulse.toFixed(3)})`);
    glow.addColorStop(1, 'rgba(255,214,120,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - 120, base - 180, 240, 240);
  }
  if (g.rescued) return;
  ctx.strokeStyle = '#d9b35a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, base - 118, 46, Math.PI, 0);
  ctx.stroke();
  for (let dx = -40; dx <= 40; dx += 10) {
    // the door opens: the front bars are gone
    if (g.cageOpen && dx > 0) continue;
    ctx.beginPath();
    ctx.moveTo(cx + dx, base - 118 + Math.sqrt(Math.max(0, 46 * 46 - dx * dx)) * -1);
    ctx.lineTo(cx + dx, base);
    ctx.stroke();
  }
  ctx.fillStyle = '#d9b35a';
  ctx.fillRect(cx - 50, base - 6, 100, 8);
}

function drawBarrier(ctx, g, t) {
  if (g.rescued) return;
  ctx.fillStyle = '#1b1426';
  ctx.fillRect(BARRIER_X, 60, 22, GROUND_Y - 60);
  ctx.strokeStyle = `rgba(181,108,255,${(0.6 + 0.3 * Math.sin(t * 3)).toFixed(3)})`;
  ctx.lineWidth = 2;
  for (let y = 80; y < GROUND_Y; y += 30) {
    ctx.beginPath();
    ctx.moveTo(BARRIER_X + 2, y);
    ctx.lineTo(BARRIER_X + 20, y + 14);
    ctx.stroke();
  }
}

// The same night scene is used in the doorway and as it expands over the screen.
function drawGateNight(ctx, x, t, zoom = 1) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + 14, GROUND_Y);
  ctx.lineTo(x + 14, 230);
  ctx.arc(x + 60, 230, 46, Math.PI, 0);
  ctx.lineTo(x + 106, GROUND_Y);
  ctx.closePath();
  ctx.clip();
  const sky = ctx.createLinearGradient(0, 184, 0, GROUND_Y);
  sky.addColorStop(0, '#11132f');
  sky.addColorStop(0.48, '#35224f');
  sky.addColorStop(1, '#a45380');
  ctx.fillStyle = sky;
  ctx.fillRect(x + 14, 184, 92, GROUND_Y - 184);
  for (let i = 0; i < 22; i += 1) {
    const sx = x + 18 + (i * 37 % 84);
    const sy = 205 + (i * 53 % 180);
    ctx.fillStyle = `rgba(255,225,241,${0.35 + 0.25 * Math.sin(t * 1.8 + i)})`;
    // The stars remain delicate points as the sky expands, not pixel blocks.
    ctx.beginPath();
    ctx.arc(sx, sy, (i % 5 === 0 ? 1.2 : 0.7) / zoom, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,224,235,0.78)';
  ctx.beginPath();
  ctx.arc(x + 73, 238, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawGate(ctx, g, t, zoom = 1) {
  const x = GATE_X;
  ctx.fillStyle = '#3a2a52';
  ctx.beginPath();
  ctx.moveTo(x, GROUND_Y);
  ctx.lineTo(x, 230);
  ctx.arc(x + 60, 230, 60, Math.PI, 0);
  ctx.lineTo(x + 120, GROUND_Y);
  ctx.closePath();
  ctx.fill();
  if (g.rescued) {
    // A little window onto the same rose-and-indigo night beyond the castle.
    const glow = ctx.createRadialGradient(x + 60, 315, 10, x + 60, 315, 150);
    glow.addColorStop(0, 'rgba(212,126,189,0.23)');
    glow.addColorStop(1, 'rgba(126,91,179,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 100, 120, 320, 330);
    drawGateNight(ctx, x, t, zoom);
  } else {
    ctx.strokeStyle = '#8a7fa0';
    ctx.lineWidth = 3;
    for (let k = 0; k <= 6; k += 1) {
      ctx.beginPath();
      ctx.moveTo(x + 18 + k * 13, GROUND_Y);
      ctx.lineTo(x + 18 + k * 13, 232 + Math.abs(k - 3) * 6);
      ctx.stroke();
    }
  }
}

function drawPrincess(ctx, pr, t) {
  const pose = princessPose(pr, t);
  const { step, lift, hair, breath } = pose;
  const arm = pose.airborne ? -0.35 : step * 0.45;
  ctx.save();
  ctx.translate(pr.x, pr.y);
  ctx.scale(pr.facing, 1);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Behind the figure: long chestnut hair, with a little delayed sway.
  ctx.fillStyle = '#60372f';
  ctx.beginPath();
  ctx.moveTo(-10, -58 - lift);
  ctx.bezierCurveTo(-19, -53 - lift, -17 + hair, -30, -15 + hair, -17);
  ctx.quadraticCurveTo(-10 + hair, -11, -4, -18);
  ctx.lineTo(4, -46 - lift);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#855042';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(-11, -49 - lift);
  ctx.quadraticCurveTo(-14 + hair, -31, -11 + hair, -21);
  ctx.stroke();

  // Feet use opposite steps. Their baseline stays on the supporting surface.
  const leg = (side, swing) => {
    const footX = side * 3 + swing * 5;
    const footY = -Math.max(0, swing) * 2;
    ctx.strokeStyle = '#f4c5b7'; ctx.lineWidth = 3.5;
    ctx.beginPath(); ctx.moveTo(side * 3, -14 - lift); ctx.lineTo(footX, footY - 3); ctx.stroke();
    ctx.fillStyle = '#713c59';
    ctx.beginPath(); ctx.ellipse(footX + 1, footY - 2, 4, 2.4, 0, 0, Math.PI * 2); ctx.fill();
  };
  leg(-1, -step);
  leg(1, step);

  // Back arm sits behind the dress, and counter-swings against the legs.
  ctx.strokeStyle = '#f5c7b6'; ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-6, -40 - lift);
  ctx.quadraticCurveTo(-12, -34 - lift, -11 - arm * 5, -27 - lift);
  ctx.stroke();

  // Shaped bodice and flowing rose skirt: simple enough to read at game scale.
  ctx.fillStyle = '#dc6595';
  ctx.beginPath();
  ctx.moveTo(-7, -41 - lift); ctx.quadraticCurveTo(0, -45 - lift, 7, -41 - lift);
  ctx.lineTo(8, -26 - lift); ctx.lineTo(-8, -26 - lift); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f58cb1';
  ctx.beginPath();
  ctx.moveTo(-7, -28 - lift); ctx.lineTo(7, -28 - lift);
  ctx.quadraticCurveTo(10 + step, -19, 15 + step, -10);
  ctx.quadraticCurveTo(0, -6, -15 + step, -10);
  ctx.quadraticCurveTo(-10 + step, -19, -7, -28 - lift);
  ctx.fill();
  ctx.strokeStyle = '#fbd4e2'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.quadraticCurveTo(0, -6, 15 + step, -10); ctx.stroke();
  ctx.fillStyle = '#f3ce84'; ctx.fillRect(-7, -29 - lift, 14, 2.5);
  ctx.fillStyle = '#fff0f3';
  ctx.beginPath(); ctx.ellipse(0, -39 - lift, 4, 2, 0, 0, Math.PI * 2); ctx.fill();

  // Front arm and hand; she reaches gently toward the cage while waiting.
  ctx.strokeStyle = '#f5c7b6'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(6, -39 - lift);
  if (pose.captive) ctx.quadraticCurveTo(13, -38, 15, -46);
  else if (pose.climbing) ctx.quadraticCurveTo(14, -44, 12, -52);
  else ctx.quadraticCurveTo(12, -32 - lift, 10 + arm * 6, -25 - lift);
  ctx.stroke();

  // Head, fringe, expressive eye and a small rose-gold tiara.
  ctx.fillStyle = '#f7d0be';
  ctx.beginPath(); ctx.ellipse(0, -52 - lift + breath, 9.5, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#60372f';
  ctx.beginPath();
  ctx.moveTo(-9, -51 - lift); ctx.quadraticCurveTo(-13, -65 - lift, 0, -64 - lift);
  ctx.quadraticCurveTo(10, -64 - lift, 9, -55 - lift);
  ctx.quadraticCurveTo(4, -57 - lift, 1, -61 - lift);
  ctx.quadraticCurveTo(-3, -54 - lift, -9, -51 - lift); ctx.fill();
  ctx.fillStyle = '#e8b966';
  ctx.beginPath(); ctx.moveTo(-7, -62 - lift); ctx.lineTo(-6, -68 - lift);
  ctx.lineTo(-2, -65 - lift); ctx.lineTo(1, -71 - lift);
  ctx.lineTo(4, -65 - lift); ctx.lineTo(8, -68 - lift);
  ctx.lineTo(7, -61 - lift); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f78eb4'; ctx.beginPath(); ctx.arc(1, -65 - lift, 1.4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#4a3035'; ctx.lineWidth = 1.3;
  if (pose.blink) {
    ctx.beginPath(); ctx.moveTo(3, -52 - lift); ctx.lineTo(6, -52 - lift); ctx.stroke();
  } else {
    ctx.fillStyle = '#4a3035'; ctx.beginPath(); ctx.ellipse(4.5, -52 - lift, 1.2, 1.8, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = 'rgba(230,117,139,0.55)';
  ctx.beginPath(); ctx.ellipse(7, -48.5 - lift, 2, 1, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#9b5863'; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.arc(4, -47 - lift, 2, 0.2, 1.3); ctx.stroke();
  ctx.restore();
}

function drawBoy(ctx, p, t) {
  if (p.inv > 0 && Math.floor(t * 12) % 2 === 0) return;
  const run = p.onGround && Math.abs(p.vx) > 20 ? Math.sin(p.phase) : 0;
  const air = !p.onGround;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(p.facing, 1);
  ctx.lineCap = 'round';
  // Cape behind
  ctx.fillStyle = '#b3213b';
  ctx.beginPath();
  ctx.moveTo(-4, -46);
  ctx.quadraticCurveTo(-24, -38 + Math.sin(t * 6) * 3, -30 - run * 3, -20 + Math.sin(t * 7) * 3);
  ctx.lineTo(-6, -24);
  ctx.closePath();
  ctx.fill();
  // Legs
  ctx.strokeStyle = '#241a36';
  ctx.lineWidth = 6;
  const climbSwing = p.climb ? Math.sin(p.phase) * 0.5 : 0;
  limb(ctx, -3, -26, 25, p.climb ? climbSwing : air ? -0.45 : run * 0.7);
  limb(ctx, 3, -26, 25, p.climb ? -climbSwing : air ? 0.35 : -run * 0.7);
  // Back arm
  ctx.strokeStyle = '#2f6fb8';
  ctx.lineWidth = 5;
  limb(ctx, -5, -42, 16, p.climb ? 3.0 + Math.sin(p.phase) * 0.35 : run ? -run * 0.9 : 0.25);
  // Tunic and gold belt
  ctx.fillStyle = '#2f6fb8';
  ctx.beginPath();
  ctx.moveTo(-8, -46);
  ctx.lineTo(8, -46);
  ctx.lineTo(10, -25);
  ctx.lineTo(-10, -25);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f5c96a';
  ctx.fillRect(-10, -30, 20, 3);
  // Front arm holds the magic wand
  const wandA = 1.9;
  limb(ctx, 5, -42, 16, wandA);
  const hx = 5 + Math.sin(wandA) * 16;
  const hy = -42 + Math.cos(wandA) * 16;
  ctx.fillStyle = '#ffd9b8';
  ctx.beginPath();
  ctx.arc(hx, hy, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#f5c96a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(hx, hy);
  ctx.lineTo(hx + Math.sin(2.2) * 12, hy + Math.cos(2.2) * 12);
  ctx.stroke();
  // Head and hair
  ctx.fillStyle = '#ffd9b8';
  ctx.beginPath();
  ctx.arc(0, -55, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a2316';
  ctx.beginPath();
  ctx.arc(-0.5, -56, 11, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2b1b33';
  ctx.beginPath();
  ctx.arc(4, -54, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawDragon(ctx, d, t) {
  if (!d.active || d.alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = d.alpha;
  ctx.translate(d.x, d.y);
  if (d.state === 'fled') ctx.rotate(Math.sin(t * 18) * 0.09);
  const flap = Math.sin(d.flap);
  // Wings behind the body
  ctx.fillStyle = '#2d1640';
  ctx.beginPath();
  ctx.moveTo(6, -10);
  ctx.lineTo(50, -94 + flap * 26);
  ctx.lineTo(84, -40 + flap * 10);
  ctx.lineTo(26, 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#3b1d5a';
  ctx.beginPath();
  ctx.moveTo(-6, -8);
  ctx.lineTo(-30, -80 + flap * 20);
  ctx.lineTo(-54, -30 + flap * 8);
  ctx.lineTo(-20, 2);
  ctx.closePath();
  ctx.fill();
  // Tail
  ctx.strokeStyle = '#4a2a6e';
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-60, 6);
  ctx.quadraticCurveTo(-110, 12, -132, -8 + Math.sin(t * 3) * 6);
  ctx.stroke();
  ctx.fillStyle = '#2a1640';
  ctx.beginPath();
  ctx.moveTo(-126, -8 + Math.sin(t * 3) * 6);
  ctx.lineTo(-150, -18 + Math.sin(t * 3) * 6);
  ctx.lineTo(-142, 2 + Math.sin(t * 3) * 6);
  ctx.closePath();
  ctx.fill();
  // Neck and body
  ctx.strokeStyle = '#4a2a6e';
  ctx.lineWidth = 26;
  ctx.beginPath();
  ctx.moveTo(-40, -8);
  ctx.quadraticCurveTo(-74, -20, -96, -40);
  ctx.stroke();
  ctx.fillStyle = '#4a2a6e';
  ctx.beginPath();
  ctx.ellipse(0, 0, 66, 36, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8a5aa6';
  ctx.globalAlpha = d.alpha * 0.7;
  ctx.beginPath();
  ctx.ellipse(6, 12, 46, 15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = d.alpha;
  ctx.fillStyle = '#2a1640';
  for (let x = -50; x <= 40; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x - 6, -30);
    ctx.lineTo(x, -44);
    ctx.lineTo(x + 6, -30);
    ctx.closePath();
    ctx.fill();
  }
  // Head with horns, glowing eye and an open jaw before a shot
  ctx.fillStyle = '#4a2a6e';
  ctx.beginPath();
  ctx.ellipse(-108, -44, 34, 24, -0.1, 0, Math.PI * 2);
  ctx.fill();
  const jawOpen = d.fireT < 0.35;
  if (jawOpen) {
    const glow = ctx.createRadialGradient(-140, -30, 4, -140, -30, 46);
    glow.addColorStop(0, 'rgba(255,190,60,0.95)');
    glow.addColorStop(1, 'rgba(255,90,20,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(-190, -80, 100, 100);
  }
  ctx.fillStyle = jawOpen ? '#3a1d55' : '#4a2a6e';
  ctx.beginPath();
  ctx.moveTo(-130, -36);
  ctx.lineTo(-150, jawOpen ? -10 : -30);
  ctx.lineTo(-104, -28);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff0c2';
  ctx.beginPath();
  ctx.moveTo(-132, -34);
  ctx.lineTo(-138, -24);
  ctx.lineTo(-124, -30);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff0c2';
  ctx.beginPath();
  ctx.moveTo(-100, -62);
  ctx.lineTo(-122, -100);
  ctx.lineTo(-88, -66);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-84, -64);
  ctx.lineTo(-74, -94);
  ctx.lineTo(-78, -58);
  ctx.closePath();
  ctx.fill();
  const eyeGlow = ctx.createRadialGradient(-116, -50, 2, -116, -50, 16);
  eyeGlow.addColorStop(0, 'rgba(255,61,90,0.9)');
  eyeGlow.addColorStop(1, 'rgba(255,61,90,0)');
  ctx.fillStyle = eyeGlow;
  ctx.fillRect(-134, -68, 36, 36);
  const surprised = d.surprise > 0 || d.state === 'fled';
  ctx.fillStyle = surprised ? '#fff8ed' : '#ffb5be';
  ctx.beginPath();
  ctx.ellipse(-116, -50, surprised ? 8 : 6, surprised ? 8 : 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#29122f';
  ctx.beginPath(); ctx.arc(-117, -50, surprised ? 2.5 : 2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#29122f'; ctx.lineWidth = 2.5; ctx.beginPath();
  if (d.fireT < 0.7 && d.state === 'fight') {
    ctx.moveTo(-125, -61); ctx.lineTo(-109, -57); // playful pre-attack frown
  } else {
    ctx.arc(-116, -58, 8, Math.PI * 1.12, Math.PI * 1.88);
  }
  ctx.stroke();
  // Hit flash
  if (d.hit > 0) {
    ctx.fillStyle = `rgba(255,255,255,${(d.hit * 2).toFixed(3)})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, 68, 38, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Remaining hits
  for (let i = 0; i < DRAGON_HITS; i += 1) {
    ctx.fillStyle = i < d.hp ? '#ff5c7a' : 'rgba(255,255,255,0.2)';
    ctx.beginPath();
    ctx.arc(-70 + i * 20, -100, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSkyLanterns(ctx, g, t) {
  const span = W + 160;
  const off = g.camX * 0.12;
  const cycle = H + 120;
  for (const L of SKY_LANTERNS) {
    const rising = (L.ph + t * L.rise) % cycle;
    const y = H + 60 - rising;
    const x = ((((L.x0 - off - t * L.drift) % span) + span) % span) - 80;
    const fade = Math.min(1, rising / 60, (cycle - rising) / 60);
    const s = L.s;
    ctx.globalAlpha = fade;
    const glow = ctx.createRadialGradient(x, y, 1, x, y, s * 6);
    glow.addColorStop(0, 'rgba(255,184,96,0.6)');
    glow.addColorStop(1, 'rgba(255,184,96,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - s * 6, y - s * 6, s * 12, s * 12);
    ctx.fillStyle = '#ffd08a';
    ctx.beginPath();
    ctx.ellipse(x, y, s * 0.8, s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff7a4a';
    ctx.fillRect(x - s * 0.5, y + s * 0.9, s, s * 0.5);
  }
  ctx.globalAlpha = 1;
}

function drawGlimmer(ctx, t, opacity = 1) {
  ctx.fillStyle = '#ffe9a8';
  for (const q of GLIMMER) {
    const y = ((q.y - t * q.sp) % H + H) % H;
    const x = q.x + Math.sin(t * 0.8 + q.ph) * q.sw;
    ctx.globalAlpha = opacity * (0.35 + 0.35 * Math.sin(t * 3 + q.ph));
    ctx.fillRect(x, y, q.s, q.s);
  }
  ctx.globalAlpha = 1;
}

// A golden braid: the tower's climbing rope. The first one is tied to a window at the top.
function drawRope(ctx, t, rope) {
  const x = rope.x;
  const top = rope.window ? 60 : rope.top;
  const bottom = rope.bottom;
  const start = rope.window ? 100 : rope.top;
  if (rope.window) {
    ctx.fillStyle = '#0c0716';
    ctx.beginPath();
    ctx.moveTo(x - 16, 100);
    ctx.lineTo(x - 16, 66);
    ctx.arc(x, 66, 16, Math.PI, 0);
    ctx.lineTo(x + 16, 100);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#d9b35a';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // A warm glow around the golden braid, so it shines in the dark
  ctx.save();
  ctx.globalAlpha = 0.22 + 0.06 * Math.sin(t * 3 + x);
  ctx.strokeStyle = '#ffd98a';
  ctx.lineWidth = 16;
  ctx.beginPath();
  for (let y = start; y <= bottom; y += 6) {
    const px = x + Math.sin(y * 0.09) * 4;
    if (y === start) ctx.moveTo(px, y);
    else ctx.lineTo(px, y);
  }
  ctx.stroke();
  ctx.restore();
  // Two strands twisting around each other
  ctx.lineWidth = 6;
  for (let strand = 0; strand < 2; strand += 1) {
    ctx.strokeStyle = strand ? '#f5d77a' : '#d9a441';
    ctx.beginPath();
    for (let y = start; y <= bottom; y += 6) {
      const px = x + Math.sin(y * 0.09 + strand * Math.PI) * 4;
      if (y === start) ctx.moveTo(px, y);
      else ctx.lineTo(px, y);
    }
    ctx.stroke();
  }
  // A shine that slides down the braid
  const span = bottom - start;
  const shine = ((t * 220) % span) + start;
  ctx.fillStyle = 'rgba(255,255,230,0.9)';
  ctx.beginPath();
  ctx.arc(x + Math.sin(shine * 0.09) * 4, shine, 3.5, 0, Math.PI * 2);
  ctx.fill();
  // Pink ribbon at the top
  ctx.fillStyle = '#ff8fb8';
  ctx.beginPath();
  ctx.moveTo(x, rope.top);
  ctx.lineTo(x - 12, rope.top + 8);
  ctx.lineTo(x - 6, rope.top + 14);
  ctx.lineTo(x, rope.top + 6);
  ctx.lineTo(x + 6, rope.top + 14);
  ctx.lineTo(x + 12, rope.top + 8);
  ctx.closePath();
  ctx.fill();
  void top;
}

// The princess's stone tower: a lit window and crenellations on top
function drawTower(ctx) {
  const { x0, x1, top } = TOWER;
  ctx.fillStyle = '#2f2246';
  ctx.fillRect(x0, top, x1 - x0, GROUND_Y - top);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  for (let y = top + 24; y < GROUND_Y; y += 36) ctx.fillRect(x0, y, x1 - x0, 2);
  ctx.fillStyle = '#0c0716';
  ctx.beginPath();
  ctx.moveTo(x0 + 60, top + 150);
  ctx.lineTo(x0 + 60, top + 110);
  ctx.arc(x0 + 90, top + 110, 30, Math.PI, 0);
  ctx.lineTo(x0 + 120, top + 150);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#3d2c58';
  for (let x = x0; x < x1; x += 30) ctx.fillRect(x + 4, top - 14, 16, 14);
}

function loadImage(src) {
  const img = new Image();
  img.src = src;
  return img;
}

// A small cat drawn in the game's style: body, striped coat, ears, eyes, and a collar for Pastil
function drawCatSprite(ctx, key, x, y, dir, t, caged) {
  const st = CAT_STYLE[key];
  const bob = caged ? 0 : Math.abs(Math.sin(t * 9 + (key === 'ani' ? 1.5 : 0))) * 2;
  ctx.save();
  ctx.translate(x, y - bob);
  ctx.scale(dir, 1);
  // tail
  ctx.strokeStyle = st.base;
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-14, -6);
  ctx.quadraticCurveTo(-26, -8, -24, -20 + Math.sin(t * 4) * 2);
  ctx.stroke();
  // body
  ctx.fillStyle = st.base;
  ctx.beginPath();
  ctx.ellipse(0, -9, 14, key === 'ani' ? 9 : 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = st.stripe;
  ctx.lineWidth = 2;
  for (let i = -8; i <= 8; i += 5) {
    ctx.beginPath();
    ctx.moveTo(i, -16);
    ctx.lineTo(i - 1, -11);
    ctx.stroke();
  }
  // legs
  ctx.strokeStyle = st.base;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-8, -3);
  ctx.lineTo(-8, 0);
  ctx.moveTo(8, -3);
  ctx.lineTo(8, 0);
  ctx.stroke();
  // head and ears
  ctx.fillStyle = st.base;
  ctx.beginPath();
  ctx.ellipse(11, -18, key === 'ani' ? 9 : 8, key === 'ani' ? 8.5 : 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  if (st.folded) {
    // Rounded tips fold a little forward, while remaining visibly raised.
    ctx.moveTo(3, -23); ctx.quadraticCurveTo(2, -29, 7, -28);
    ctx.quadraticCurveTo(10, -27, 10, -24);
    ctx.moveTo(14, -24); ctx.quadraticCurveTo(16, -29, 20, -27);
    ctx.quadraticCurveTo(21, -26, 20, -23);
  } else {
    ctx.moveTo(4, -23); ctx.lineTo(5, -30); ctx.lineTo(10, -25);
    ctx.moveTo(14, -25); ctx.lineTo(19, -30); ctx.lineTo(19, -23);
  }
  ctx.fill();
  if (key === 'ani') {
    ctx.fillStyle = st.muzzle;
    ctx.beginPath(); ctx.ellipse(16, -14.5, 4.8, 2.5, 0, 0, Math.PI * 2); ctx.fill();
  }
  // eyes and nose
  ctx.fillStyle = st.eye;
  ctx.beginPath();
  ctx.arc(14, -19, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2b1b33';
  ctx.fillRect(13.5, -19.5, 1, 2);
  ctx.fillStyle = '#f08aa0';
  ctx.beginPath();
  ctx.arc(18, -15, 1.2, 0, Math.PI * 2);
  ctx.fill();
  if (key === 'pastil') {
    ctx.strokeStyle = '#ff8fb8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(6, -13);
    ctx.lineTo(16, -11);
    ctx.stroke();
    ctx.fillStyle = '#f5c96a';
    ctx.beginPath();
    ctx.arc(11, -10, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// A cage for a cat: arched bars on a base
function drawCatCage(ctx, cx, baseY, opened) {
  if (opened) return;
  ctx.fillStyle = '#d9b35a';
  ctx.fillRect(cx - 28, baseY - 4, 56, 6);
  ctx.strokeStyle = '#d9b35a';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cx, baseY - 40, 26, Math.PI, 0);
  ctx.stroke();
  for (let dx = -22; dx <= 22; dx += 8) {
    ctx.beginPath();
    ctx.moveTo(cx + dx, baseY - 40 + Math.sqrt(Math.max(0, 26 * 26 - dx * dx)) * -1);
    ctx.lineTo(cx + dx, baseY - 4);
    ctx.stroke();
  }
}

function drawEnteringCharacter(ctx, g, x, draw) {
  ctx.save();
  if (g.phase === 'won') ctx.globalAlpha = portalCharacterOpacity(x, GATE_X);
  draw();
  ctx.restore();
}

function drawCats(ctx, g, t) {
  const an = g.cats.ani;
  const pa = g.cats.pastil;
  // Ani in her cage on the balcony (the first one)
  if (!an.freed) {
    drawCatCage(ctx, CAT_AT.ani.x, CAT_AT.ani.y, false);
    drawCatSprite(ctx, 'ani', CAT_AT.ani.x, CAT_AT.ani.y - 6, 1, t, true);
  }
  // Pastil in her cage in the yard; the cage opens when the dragon flees
  if (!pa.freed) {
    drawCatCage(ctx, CAT_AT.pastil.x, CAT_AT.pastil.y, g.cageOpen);
    drawCatSprite(ctx, 'pastil', CAT_AT.pastil.x, CAT_AT.pastil.y - 6, -1, t, !g.cageOpen);
  }
  // Freed cats run after the boy
  if (an.freed) drawEnteringCharacter(ctx, g, an.x, () => drawCatSprite(ctx, 'ani', an.x, an.y - 6, an.reaction > 0 && g.sparks.length ? Math.sign(g.sparks[0].x - an.x) || 1 : g.p.facing, t, false));
  if (pa.freed) drawEnteringCharacter(ctx, g, pa.x, () => drawCatSprite(ctx, 'pastil', pa.x, pa.y - 6, pa.reaction > 1 ? (Math.sign(g.p.x - pa.x) || g.p.facing) : g.p.facing, t, false));
}

// Chips at the top left: the ability and the cat who gave it
function drawAbilities(ctx, g) {
  const chips = [];
  if (g.abilities.doubleJump) chips.push({ key: 'pastil', label: 'پرش دوباره' });
  if (g.abilities.rapid) chips.push({ key: 'ani', label: 'جرقه‌ی سریع' });
  let x = 24;
  for (const c of chips) {
    ctx.font = `700 14px ${FONT}`;
    const tw = ctx.measureText(c.label).width;
    const w = tw + 56;
    ctx.fillStyle = 'rgba(10,6,20,0.6)';
    ctx.beginPath();
    ctx.roundRect(x, 48, w, 34, 17);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + 17, 65, 13, 0, Math.PI * 2);
    ctx.clip();
    const img = CAT_IMAGES[c.key];
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, x + 4, 52, 26, 26);
    } else {
      ctx.fillStyle = CAT_STYLE[c.key].base;
      ctx.fillRect(x + 4, 52, 26, 26);
    }
    ctx.restore();
    ctx.strokeStyle = '#ffd66b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + 17, 65, 13, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffe9f2';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(c.label, x + 38, 66);
    ctx.textBaseline = 'alphabetic';
    x += w + 10;
  }
}

function drawFire(ctx, g) {
  for (const f of g.fire) {
    const glow = ctx.createRadialGradient(f.x, f.y, 2, f.x, f.y, 20);
    glow.addColorStop(0, '#fff6c2');
    glow.addColorStop(0.45, '#ffb13b');
    glow.addColorStop(1, 'rgba(255,90,20,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(f.x, f.y, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,140,50,0.35)';
    ctx.beginPath();
    ctx.ellipse(f.x - f.vx * 0.03, f.y - f.vy * 0.03, 16, 6, Math.atan2(f.vy, f.vx), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSparks(ctx, g) {
  for (const s of g.sparks) {
    const glow = ctx.createRadialGradient(s.x, s.y, 1, s.x, s.y, 14);
    glow.addColorStop(0, 'rgba(255,230,160,0.9)');
    glow.addColorStop(1, 'rgba(255,214,231,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd66b';
    ctx.beginPath();
    for (let i = 0; i < 8; i += 1) {
      const r = i % 2 === 0 ? 9 : 3;
      const a = (i / 8) * Math.PI * 2;
      ctx.lineTo(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
  }
}

function drawRocks(ctx, g) {
  for (const r of g.rocks) {
    if (r.warning > 0) {
      ctx.fillStyle = `rgba(255, 172, 130, ${0.35 + 0.2 * Math.sin(g.t * 20)})`;
      ctx.beginPath();
      ctx.ellipse(r.x, GROUND_Y - 3, 22, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate(r.x + Math.sin(g.t * 38) * 3, 45);
      ctx.fillStyle = '#b9a2bf';
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      continue;
    }
    if (!r.landed) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(r.x, GROUND_Y - 2, 18, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = r.landed ? Math.max(0, r.landT / 0.6) : 1;
    ctx.fillStyle = '#8a7f98';
    ctx.strokeStyle = '#3c3348';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(r.x - 16, r.y + 4);
    ctx.lineTo(r.x - 8, r.y - 14);
    ctx.lineTo(r.x + 8, r.y - 16);
    ctx.lineTo(r.x + 16, r.y + 2);
    ctx.lineTo(r.x + 4, r.y + 14);
    ctx.lineTo(r.x - 10, r.y + 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawParts(ctx, g) {
  for (const q of g.parts) {
    ctx.globalAlpha = Math.max(0, Math.min(1, q.life / q.max));
    ctx.fillStyle = q.color;
    ctx.beginPath();
    if (q.star) {
      // a four-point sparkle
      const r = q.size * 2.2;
      ctx.moveTo(q.x, q.y - r);
      ctx.quadraticCurveTo(q.x, q.y, q.x + r, q.y);
      ctx.quadraticCurveTo(q.x, q.y, q.x, q.y + r);
      ctx.quadraticCurveTo(q.x, q.y, q.x - r, q.y);
      ctx.quadraticCurveTo(q.x, q.y, q.x, q.y - r);
    } else {
      ctx.arc(q.x, q.y, q.size, 0, Math.PI * 2);
    }
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawHud(ctx, g) {
  // Hearts
  for (let i = 0; i < HEARTS; i += 1) {
    ctx.fillStyle = i < g.hearts ? '#ff5c7a' : 'rgba(255,255,255,0.18)';
    heartShape(ctx, 34 + i * 34, 24, 12);
    ctx.fill();
  }
  // Progress to the gate
  const bx = 300;
  const bw = 360;
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(bx, 20, bw, 8);
  const frac = Math.min(1, g.p.x / GATE_X);
  ctx.fillStyle = '#ff8fb8';
  ctx.fillRect(bx, 20, bw * frac, 8);
  ctx.fillStyle = '#ffd66b';
  ctx.beginPath();
  ctx.arc(bx + bw * frac, 24, 6, 0, Math.PI * 2);
  ctx.fill();
  // A heart at the end of the bar fills up as the boy nears the tower
  const hx = bx + bw + 26;
  const hy = 26;
  const hs = 11;
  const top = hy - hs * 0.45;
  const bottom = hy + hs;
  ctx.save();
  heartShape(ctx, hx, hy - hs * 0.2, hs);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fill();
  ctx.clip();
  ctx.fillStyle = '#ff8fb8';
  ctx.fillRect(hx - hs * 1.5, bottom - (bottom - top) * frac, hs * 3, (bottom - top) * frac + 2);
  ctx.restore();
  heartShape(ctx, hx, hy - hs * 0.2, hs);
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Stage name
  const stage = g.rescued ? 2 : g.p.x >= ARENA_X ? 1 : 0;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 18px ${FONT}`;
  ctx.fillStyle = '#ffe9f2';
  ctx.fillText(STAGE_NAMES[stage], W - 22, 32);
  // Message
  if (g.msgT > 0 && g.msg) {
    ctx.font = `700 20px ${FONT}`;
    ctx.textAlign = 'center';
    const tw = Math.min(W - 60, ctx.measureText(g.msg).width + 40);
    ctx.fillStyle = 'rgba(10,6,20,0.7)';
    ctx.beginPath();
    ctx.roundRect(W / 2 - tw / 2, 64, tw, 40, 20);
    ctx.fill();
    ctx.fillStyle = '#ffe9f2';
    ctx.fillText(g.msg, W / 2, 91);
  }
  ctx.textAlign = 'left';
}

function render(ctx, g, t) {
  const camera = g.phase === 'won' ? portalCamera(g.endT, GATE_X, g.camX, W, H) : null;
  // Transform the entire scene, not just the doorway: the stone frame and
  // surroundings move out of view as the camera approaches the night sky.
  ctx.save();
  if (camera && camera.zoom > 1) {
    ctx.translate(camera.targetX, camera.targetY);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);
  }
  drawSky(ctx, g, t);
  drawClouds(ctx, g, t);
  drawSkyLanterns(ctx, g, t);
  drawBats(ctx, t);
  drawTowers(ctx, g, FAR_TOWERS, 0.2, 330, '#170d2a', t);
  drawWall(ctx, g, t);
  ctx.save();
  ctx.translate(-g.camX + (g.shake > 0 ? (Math.random() - 0.5) * g.shake * 16 : 0), g.shake > 0 ? (Math.random() - 0.5) * g.shake * 10 : 0);
  drawTower(ctx);
  drawFloor(ctx, g);
  drawGate(ctx, g, t, camera?.zoom || 1);
  for (const r of ROPES) drawRope(ctx, t, r);
  // The doorway is a threshold: once a character crosses its near edge,
  // hide the part inside and beyond it, so nobody reappears on the far side.
  ctx.save();
  if (g.phase === 'won') {
    ctx.beginPath();
    ctx.rect(-1000, -1000, LEVEL_W + 2000, H + 2000);
    ctx.rect(GATE_X + 14, 184, LEVEL_W + 1000, GROUND_Y - 174);
    ctx.clip('evenodd');
  }
  drawEnteringCharacter(ctx, g, g.princess.x, () => drawPrincess(ctx, g.princess, t));
  drawCage(ctx, g, t);
  drawCats(ctx, g, t);
  drawDragon(ctx, g.dragon, t);
  drawFire(ctx, g);
  drawRocks(ctx, g);
  drawEnteringCharacter(ctx, g, g.p.x, () => drawBoy(ctx, g.p, t));
  drawSparks(ctx, g);
  drawParts(ctx, g);
  ctx.restore(); // doorway clipping
  ctx.restore(); // world coordinates
  ctx.restore(); // camera zoom
  if (g.flash > 0) {
    ctx.fillStyle = `rgba(230,220,255,${(g.flash * 0.45).toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.save();
  drawGlimmer(ctx, t, camera ? camera.hudOpacity : 1);
  ctx.globalAlpha = camera ? camera.hudOpacity : 1;
  drawHud(ctx, g);
  drawAbilities(ctx, g);
  ctx.restore();
  if (g.phase === 'lost') {
    ctx.fillStyle = 'rgba(5,4,13,0.6)';
    ctx.fillRect(0, 0, W, H);
  }
  if (g.phase === 'won' && g.endT < VICTORY_GATE_CUE && g.p.x < GATE_X + 14) {
    ctx.save();
    ctx.translate(-g.camX, 0);
    ctx.fillStyle = `rgba(255,143,184,${0.65 + 0.2 * Math.sin(g.t * 4)})`;
    heartShape(ctx, g.p.x - 20, g.p.y - 86 - Math.sin(g.t * 2) * 3, 8);
    ctx.fill();
    ctx.restore();
  }
}

// ---------- the game object -------------------------------------------------

function buildDom() {
  const root = document.createElement('section');
  root.className = 'rescue';
  root.setAttribute('aria-label', 'بازی نجات پرنسس');
  root.innerHTML = `
    <canvas class="rescue-canvas" aria-hidden="true"></canvas>
    <div class="rescue-fade" aria-hidden="true"></div>
    <div class="rescue-night" aria-hidden="true"><div class="rescue-night-stars"></div></div>
    <div class="rescue-card" data-card="lost" hidden>
      <div class="rescue-card-inner">
        <h2>پرنسس منتظر است</h2>
        <p data-loss-help>از آخرین نقطه‌ی امن ادامه بده.</p>
        <button type="button" class="rescue-btn" data-action="retry">ادامه از نقطه‌ی امن</button>
      </div>
    </div>
    <div class="rescue-rotate" hidden><p>گوشی را افقی کن تا بازی را بهتر ببینی</p></div>
    <div class="rescue-touch" hidden>
      <div class="rescue-touch-group">
        <button type="button" data-key="left" aria-label="چپ">◀</button>
        <button type="button" data-key="right" aria-label="راست">▶</button>
      </div>
      <div class="rescue-touch-group">
        <button type="button" data-key="jump" aria-label="پرش">▲</button>
        <button type="button" data-key="fire" aria-label="جرقه">✦</button>
      </div>
    </div>`;
  document.body.appendChild(root);
  return root;
}

// Broken-signal burst when the boy reaches the gate: torn bands, static bars,
// colour ghosts and scanlines. k goes from 1 down to 0 over the burst.
function drawGlitch(ctx, canvas, k) {
  const cw = canvas.width;
  const ch = canvas.height;
  const unit = ch / H;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const tears = 5 + Math.floor(Math.random() * 6);
  for (let i = 0; i < tears; i++) {
    const y = Math.random() * ch;
    const h = (6 + Math.random() * 40) * unit * (0.4 + k);
    const dx = (Math.random() - 0.5) * 160 * unit * k;
    ctx.drawImage(canvas, 0, y, cw, h, dx, y, cw, h);
  }
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = Math.random() < 0.5
      ? `rgba(255,255,255,${(0.5 * k).toFixed(3)})`
      : `rgba(0,0,0,${(0.6 * k).toFixed(3)})`;
    ctx.fillRect(0, Math.random() * ch, cw, (1 + Math.random() * 5) * unit);
  }
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = `rgba(255,40,140,${(0.22 * k).toFixed(3)})`;
  ctx.fillRect(Math.random() * cw * 0.12, Math.random() * ch, cw * 0.55, 10 * unit);
  ctx.fillStyle = `rgba(60,220,255,${(0.2 * k).toFixed(3)})`;
  ctx.fillRect(Math.random() * cw * 0.2, Math.random() * ch, cw * 0.5, 7 * unit);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = `rgba(0,0,0,${(0.35 * k).toFixed(3)})`;
  for (let y = 0; y < ch; y += 4 * unit) ctx.fillRect(0, y, cw, 2 * unit);
  ctx.restore();
}

// The how-to page shown when the link opens. Start hides it and calls onStart().
export function showHowTo({ onStart }) {
  const root = document.createElement('section');
  root.className = 'rescue rescue-howto';
  root.setAttribute('aria-label', 'روش نجات پرنسس');
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const keys = coarse
    ? 'دکمه‌های پایین صفحه را برای حرکت و جرقه بزن'
    : '← → حرکت · Space پرش و چنگ زدن · F جرقه‌ی جادویی';
  root.innerHTML = `
    <div class="rescue-card" data-card="howto">
      <div class="rescue-card-inner">
        <p class="rescue-kicker">قبل از ورود به خانه</p>
        <h2>روش نجات پرنسس</h2>
        <ol class="rescue-steps">
          <li>با ← و → پسر را حرکت بده و با Space بپر.</li>
          <li>نزدیک گیسوی طلایی، Space را نگه دار تا بالا بروی. رها کن تا سر بخوری.</li>
          <li>با F جرقه بزن تا اژدها فرار کند.</li>
          <li>گربه‌ها را نجات بده؛ پرنسس بالای برج منتظر است.</li>
        </ol>
        <p class="rescue-keys">${keys}</p>
        <button type="button" class="rescue-btn" data-action="start">شروع</button>
      </div>
    </div>
  `;
  document.body.appendChild(root);
  const btn = root.querySelector('[data-action="start"]');
  let closing = false;
  btn.addEventListener('click', () => {
    if (closing) return;
    closing = true;
    root.classList.add('is-leaving');
    window.setTimeout(() => root.remove(), 800);
    onStart();
  });
  return root;
}

// Plays the game. onDone() runs once the screen has gone black after the win (or a skip).
// The caller then shows the next scene and calls reveal() to fade the black away.
export function createRescueGame({ onDone, autoStart = false, onGate = null }) {
  const root = buildDom();
  const canvas = root.querySelector('.rescue-canvas');
  const ctx = canvas.getContext('2d');
  const lostCard = root.querySelector('[data-card="lost"]');
  const lostHelp = root.querySelector('[data-loss-help]');
  const touch = root.querySelector('.rescue-touch');
  const rotateCard = root.querySelector('.rescue-rotate');
  const coarse = window.matchMedia('(pointer: coarse)').matches;

  const input = { left: false, right: false, jump: false, fire: false };
  const pressed = { jump: false, fire: false };
  const pointerKeys = new Map(); // pointer id -> key, so every touch releases the key it pressed
  let g = newState();
  let scale = 1;
  let offX = 0;
  let offY = 0;
  let exiting = false;
  let detached = false;
  let raf = 0;
  let last = 0;
  let failures = 0;
  let secretKeyIndex = 0;
  let secretKeyAt = 0;
  let secretHeartIndex = 0;
  let secretHeartAt = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.floor(window.innerWidth * dpr));
    canvas.height = Math.max(1, Math.floor(window.innerHeight * dpr));
    scale = Math.min(canvas.width / W, canvas.height / H);
    offX = (canvas.width - W * scale) / 2;
    offY = (canvas.height - H * scale) / 2;
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05040d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, offX, offY);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();
    render(ctx, g, g.t);
    ctx.restore();
    if (g.glitch > 0) drawGlitch(ctx, canvas, g.glitch / GLITCH_S);
  }

  function canUseSecretSkip() {
    return g.phase === 'play' || g.phase === 'lost' || (g.phase === 'won' && g.endT < PORTAL_ZOOM_START);
  }

  function triggerSecretSkip() {
    if (exiting || !canUseSecretSkip()) return;
    say(g, 'جادوی قلب‌ها پیدا شد! ✨', 1.6);
    exitToIntro(true);
  }

  function readSecretKey(code) {
    if (!canUseSecretSkip()) return false;
    const now = performance.now();
    if (secretKeyIndex > 0 && now - secretKeyAt > SECRET_SEQUENCE_MS) secretKeyIndex = 0;
    if (code === SECRET_SKIP_KEYS[secretKeyIndex]) {
      secretKeyIndex += 1;
      secretKeyAt = now;
      if (secretKeyIndex === SECRET_SKIP_KEYS.length) {
        secretKeyIndex = 0;
        return true;
      }
      return false;
    }
    secretKeyIndex = code === SECRET_SKIP_KEYS[0] ? 1 : 0;
    secretKeyAt = secretKeyIndex ? now : 0;
    return false;
  }

  function gamePoint(event) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height || !scale) return null;
    const px = (event.clientX - rect.left) * (canvas.width / rect.width);
    const py = (event.clientY - rect.top) * (canvas.height / rect.height);
    return { x: (px - offX) / scale, y: (py - offY) / scale };
  }

  function readSecretHeartTap(event) {
    if (!canUseSecretSkip() || event.type === 'pointercancel' || event.target.closest?.('button')) {
      secretHeartIndex = 0;
      return;
    }
    const point = gamePoint(event);
    const heartIndex = point && point.y >= 10 && point.y <= 40
      ? SECRET_HEART_X.findIndex((x) => Math.abs(point.x - x) <= 13)
      : -1;
    if (heartIndex < 0) {
      secretHeartIndex = 0;
      return;
    }

    const now = performance.now();
    if (secretHeartIndex > 0 && now - secretHeartAt > SECRET_SEQUENCE_MS) secretHeartIndex = 0;
    if (heartIndex === secretHeartIndex) {
      secretHeartIndex += 1;
      secretHeartAt = now;
      if (secretHeartIndex === SECRET_HEART_X.length) {
        secretHeartIndex = 0;
        triggerSecretSkip();
      }
    } else {
      secretHeartIndex = heartIndex === 0 ? 1 : 0;
      secretHeartAt = secretHeartIndex ? now : 0;
    }
  }

  function syncUi() {
    const playing = g.phase === 'play';
    touch.hidden = exiting || !(coarse && playing);
    lostCard.hidden = g.phase !== 'lost';
    if (g.phase === 'lost') lostHelp.textContent = helpAfterLoss(failures, g.checkpoint);
  }

  function setKey(key, down) {
    input[key] = down;
    if (down && key === 'jump') pressed.jump = true;
    if (down && key === 'fire') pressed.fire = true;
  }

  function releaseAll() {
    input.left = false;
    input.right = false;
    input.jump = false;
    input.fire = false;
    pointerKeys.clear();
  }

  function onKeyDown(e) {
    if (exiting) return;
    if (!e.repeat && readSecretKey(e.code)) {
      e.preventDefault();
      triggerSecretSkip();
      return;
    }
    const isButton = !!e.target && e.target.tagName === 'BUTTON';
    if (isButton && (e.code === 'Space' || e.code === 'Enter')) return;
    const key = KEYMAP[e.code];
    if (!key) return;
    e.preventDefault();
    if (e.repeat) return;
    setKey(key, true);
  }

  function onKeyUp(e) {
    const key = KEYMAP[e.code];
    if (key) input[key] = false;
  }

  function onClick(e) {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'retry') retry();
  }

  function onPointerDown(e) {
    const btn = e.target.closest ? e.target.closest('button[data-key]') : null;
    if (!btn || exiting) return;
    e.preventDefault();
    const key = btn.dataset.key;
    pointerKeys.set(e.pointerId, key);
    setKey(key, true);
  }

  function onPointerUp(e) {
    const key = pointerKeys.get(e.pointerId);
    if (key) {
      pointerKeys.delete(e.pointerId);
      input[key] = false;
      secretHeartIndex = 0;
      return;
    }
    readSecretHeartTap(e);
  }

  function onVisibility() {
    if (document.hidden) releaseAll();
  }

  const listeners = [
    [window, 'resize', resize],
    [window, 'keydown', onKeyDown],
    [window, 'keyup', onKeyUp],
    [window, 'blur', releaseAll],
    [document, 'visibilitychange', onVisibility],
    [root, 'click', onClick],
    [root, 'pointerdown', onPointerDown],
    [root, 'pointerup', onPointerUp],
    [root, 'pointercancel', onPointerUp],
  ];

  function detach() {
    if (detached) return;
    detached = true;
    for (const [el, type, fn] of listeners) el.removeEventListener(type, fn);
  }

  // One simulation step
  let gateFired = false;
  function tick(dt) {
    const previousPhase = g.phase;
    update(g, dt, input, pressed);
    if (previousPhase !== 'lost' && g.phase === 'lost') failures += 1;
    if (g.glitch > 0) g.glitch = Math.max(0, g.glitch - dt);
    if (!gateFired && g.phase === 'won' && g.endT >= VICTORY_GATE_CUE) {
      gateFired = true;
      if (onGate) onGate();
    }
    pressed.jump = false;
    pressed.fire = false;
    if (g.phase === 'won' && g.endT >= VICTORY_EXIT) exitToIntro(false);
    syncUi();
  }

  function loop(now) {
    if (exiting) return;
    const dt = Math.min(0.033, Math.max(0, (now - last) / 1000));
    last = now;
    // Phones held upright: ask for landscape and pause the game
    const upright = coarse && window.innerHeight > window.innerWidth;
    rotateCard.hidden = !upright;
    if (!upright) tick(dt);
    if (!exiting) {
      draw();
      raf = requestAnimationFrame(loop);
    }
  }

  // The winning scene dissolves into the same deep night as the castle.
  // Skipping retains the original quick fade and does not trigger the song.
  function exitToIntro(quick) {
    if (exiting) return;
    exiting = true;
    cancelAnimationFrame(raf);
    releaseAll();
    detach();
    syncUi();
    lostCard.hidden = true;
    draw();
    g.phase = 'done';
    if (quick) {
      root.classList.add('is-quick', 'is-dark');
    } else {
      root.classList.add('is-night');
    }
    window.setTimeout(() => {
      if (onDone) onDone(quick);
    }, quick ? 700 : 1800);
  }

  function reveal(quick = false) {
    // Let the first 3D frame render behind the starry veil before it fades.
    requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('is-leaving')));
    window.setTimeout(() => root.remove(), quick ? FADE_MS + 300 : 3000);
  }

  function startGame() {
    if (exiting || g.phase !== 'title') return;
    g.phase = 'play';
    say(g, 'با ← و → حرکت کن و با F جرقه بزن', 3.4);
    syncUi();
  }

  function retry() {
    if (exiting) return;
    releaseAll();
    if (g.phase !== 'lost') return;
    g.phase = 'play';
    g.hearts = 3;
    g.endT = 0;
    g.fire = []; g.rocks = []; g.sparks = [];
    g.rockT = 2.5;
    g.dragon.fireT = Math.max(g.dragon.fireT, 1.5);
    Object.assign(g.p, { x: g.checkpoint, y: GROUND_Y, vx: 0, vy: 0, onGround: true,
      climb: false, inv: 2, coyote: 0, jumpBuf: 0, usedDouble: false });
    if (g.rescued) {
      // Retry is a teleport, so don't interpolate an old route across it.
      g.princess.trail.length = 0;
      g.princess.x = g.p.x - 18 * g.p.facing;
      g.princess.y = g.p.y;
      g.princess.speed = 0;
    }
    pressed.jump = false; pressed.fire = false;
    say(g, 'از آخرین نقطه‌ی امن ادامه بده!', 2.5);
    syncUi();
  }

  for (const [el, type, fn] of listeners) el.addEventListener(type, fn);

  resize();
  syncUi();
  if (autoStart) startGame();
  last = performance.now();
  raf = requestAnimationFrame(loop);

  return {
    start: startGame,
    skip: () => exitToIntro(true),
    reveal,
    // Test hooks: read the state, move the boy, press keys, and step the simulation
    state: () => g,
    setPlayer(partial) {
      Object.assign(g.p, partial);
    },
    press(key) {
      setKey(key, true);
    },
    release(key) {
      input[key] = false;
    },
    step(dt = 0.033, n = 1) {
      for (let i = 0; i < n; i += 1) tick(dt);
      if (!exiting) draw();
    },
  };
}
