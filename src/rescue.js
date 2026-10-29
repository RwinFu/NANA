// The rescue mini game. It plays before the intro:
// the boy climbs the dark castle, defeats the dragon with magic sparkles,
// frees the princess and runs with her out of the falling castle to the gate.
// onDone() is called once the game is won (or skipped); the intro plays after it.

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
const CAGE_X = 2105;
const BARRIER_X = 2180;
const GATE_X = 4150;
const WIN_HOLD = 3.2;
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
  { x: 2620, y: 340, w: 160 },
  { x: 3000, y: 280, w: 170 },
  { x: 3500, y: 350, w: 170 },
];
const CHECKPOINTS = [40, 905, 1190, 1830, 2220, 3245];
const STAGE_NAMES = ['برج قلعه', 'نبرد با اژدها', 'فرار از قلعه'];
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', KeyF: 'fire', KeyK: 'fire',
};

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
    hearts: HEARTS,
    checkpoint: CHECKPOINTS[0],
    rescued: false,
    cageOpen: false,
    msg: '',
    msgT: 0,
    p: { x: 40, y: GROUND_Y, vx: 0, vy: 0, facing: 1, onGround: true, phase: 0, inv: 0, coyote: 0, jumpBuf: 0, fireCd: 0 },
    dragon: { x: 1500, y: 150, hp: DRAGON_HITS, state: 'fight', active: false, alpha: 1, flap: 0, hit: 0, fireT: 1.5 },
    princess: { x: CAGE_X, state: 'captive', facing: 1, phase: 0, moving: 0 },
    fire: [],
    sparks: [],
    rocks: [],
    rockT: 1.5,
    parts: [],
  };
}

function say(g, text, secs = 2.6) {
  g.msg = text;
  g.msgT = secs;
}

function burst(g, x, y, color, n, speed) {
  for (let i = 0; i < n; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const s = Math.random() * speed;
    g.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - speed * 0.4, life: 0.7 + Math.random() * 0.6, max: 1.3, color, size: 2 + Math.random() * 3 });
  }
}

function solidsFor(g) {
  const list = GROUND.map(([a, b]) => ({ x0: a, x1: b, y0: GROUND_Y, y1: GROUND_Y + 220 }));
  for (const l of LEDGES) list.push({ x0: l.x, x1: l.x + l.w, y0: l.y, y1: l.y + 26 });
  if (!g.rescued) list.push({ x0: BARRIER_X, x1: BARRIER_X + 22, y0: -400, y1: GROUND_Y + 220 });
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
    p.inv = 1.5;
    say(g, 'مراقب باش! دوباره تلاش کن');
  }
}

function hurt(g) {
  const p = g.p;
  if (p.inv > 0 || g.phase !== 'play') return;
  g.shake = 0.35;
  p.inv = 1.3;
  p.vx = -p.facing * 180;
  p.vy = -300;
  p.onGround = false;
  burst(g, p.x, p.y - 30, '#ff5c7a', 12, 200);
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
  if (!playing) {
    // Won: the boy stands at the gate
    p.vx *= 0.9;
  }
  if (!playing && g.phase === 'won') g.endT += dt;

  // Flash lightning in the castle
  if (playing) {
    g.flashT -= dt;
    if (g.flashT <= 0) {
      g.flash = 0.9;
      g.flashT = 6 + Math.random() * 5;
    }
  }

  // Input
  const dir = playing ? (input.right ? 1 : 0) - (input.left ? 1 : 0) : 0;
  p.vx += (dir * RUN_SPEED - p.vx) * Math.min(1, dt * 12);
  if (dir) p.facing = dir;
  p.coyote = p.onGround ? 0.12 : p.coyote - dt;
  p.jumpBuf = pressed.jump && playing ? 0.12 : p.jumpBuf - dt;
  if (p.jumpBuf > 0 && (p.onGround || p.coyote > 0)) {
    p.vy = JUMP_V;
    p.onGround = false;
    p.coyote = 0;
    p.jumpBuf = 0;
  }
  p.fireCd = Math.max(0, p.fireCd - dt);
  if (playing && pressed.fire && p.fireCd <= 0) {
    p.fireCd = 0.35;
    spark(g);
  }
  p.inv = Math.max(0, p.inv - dt);
  if (p.onGround && Math.abs(p.vx) > 5) p.phase += Math.abs(p.vx) * dt * 0.028;

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
  if (p.y > 620) {
    lose(g, 'fall');
  }

  // Checkpoints: the furthest one reached on the ground
  for (const cp of CHECKPOINTS) {
    if (p.x >= cp && cp > g.checkpoint) g.checkpoint = cp;
  }

  if (playing) {
    updateDragon(g, dt);
    updateFire(g, dt);
    updateSparks(g, dt);
    updateRocks(g, dt);
    checkCage(g);
  }
  updatePrincess(g, dt);

  if (playing && g.rescued && p.x >= GATE_X) {
    g.phase = 'won';
    g.endT = 0;
    say(g, 'نجات یافتی! پرنسس و پسرش با هم از قلعه بیرون رفتند', 99);
  }

  g.camX = Math.max(0, Math.min(LEVEL_W - W, p.x - 330));
}

function spark(g) {
  const p = g.p;
  const d = g.dragon;
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
  if (d.state === 'fled') {
    d.y -= 140 * dt;
    d.x += 40 * dt;
    d.alpha = Math.max(0, d.alpha - 0.5 * dt);
    return;
  }
  const inArena = p.x >= ARENA_X;
  if (p.x > DRAGON_ACTIVE_X || inArena) d.active = true;
  if (!d.active) return;
  const target = inArena
    ? CAGE_X - 90 + Math.sin(g.t * 0.9) * 120
    : p.x + 300 + Math.sin(g.t * 0.7) * 50;
  d.x += (target - d.x) * Math.min(1, dt * 1.6);
  d.y = 150 + Math.sin(g.t * 1.3) * 30;
  d.fireT -= dt;
  if (d.fireT <= 0) {
    d.fireT = inArena ? 1.5 : 2.6;
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
      g.rocks.push({ x, y: -140, vy: 120, landed: false, landT: 0.6 });
    }
  }
  for (const r of g.rocks) {
    if (!r.landed) {
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
  if (g.rescued || Math.abs(p.x - CAGE_X) >= 70) return;
  if (!g.cageOpen) {
    if (g.msgT <= 0) say(g, 'اول اژدها را با جرقه‌های جادویی شکست بده', 1.6);
    return;
  }
  g.rescued = true;
  g.princess.state = 'freed';
  g.shake = 0.6;
  g.flash = 1;
  burst(g, CAGE_X, GROUND_Y - 60, '#ffd66b', 40, 360);
  burst(g, CAGE_X, GROUND_Y - 60, '#ff8fb8', 30, 300);
  say(g, 'پرنسس نجات یافت! حالا با هم فرار کنید', 3.2);
}

function updatePrincess(g, dt) {
  const pr = g.princess;
  if (pr.state === 'captive') {
    pr.phase += dt * 4;
    return;
  }
  const target = g.p.x - 46;
  const before = pr.x;
  pr.x += (target - pr.x) * Math.min(1, dt * 5);
  pr.moving = pr.x - before;
  pr.phase += Math.abs(pr.moving) * 0.6 + dt * 2;
  pr.facing = 1;
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
  sky.addColorStop(0, '#05040f');
  sky.addColorStop(0.55, '#1b0f31');
  sky.addColorStop(1, '#3b1b3f');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Moon behind the clouds
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

  // Stars
  for (const s of STARS) {
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 2 + s.ph);
    ctx.fillStyle = '#fff4e0';
    ctx.fillRect(s.x, s.y, s.s, s.s);
  }
  ctx.globalAlpha = 1;
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
}

function drawFloor(ctx) {
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
    ctx.fillStyle = '#4d3868';
    ctx.fillRect(l.x, l.y, l.w, 26);
    ctx.fillStyle = '#b294d9';
    ctx.fillRect(l.x, l.y, l.w, 3);
    ctx.fillStyle = '#2a1d3c';
    ctx.fillRect(l.x, l.y + 20, l.w, 6);
  }
}

function drawCage(ctx, g, t) {
  const cx = CAGE_X;
  if (g.cageOpen && !g.rescued) {
    const pulse = 0.35 + 0.15 * Math.sin(t * 4);
    const glow = ctx.createRadialGradient(cx, GROUND_Y - 60, 10, cx, GROUND_Y - 60, 110);
    glow.addColorStop(0, `rgba(255,214,120,${pulse.toFixed(3)})`);
    glow.addColorStop(1, 'rgba(255,214,120,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(cx - 120, GROUND_Y - 180, 240, 240);
  }
  if (g.rescued) return;
  ctx.strokeStyle = '#d9b35a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, GROUND_Y - 118, 46, Math.PI, 0);
  ctx.stroke();
  for (let dx = -40; dx <= 40; dx += 10) {
    // the door opens: the front bars are gone
    if (g.cageOpen && dx > 0) continue;
    ctx.beginPath();
    ctx.moveTo(cx + dx, GROUND_Y - 118 + Math.sqrt(Math.max(0, 46 * 46 - dx * dx)) * -1);
    ctx.lineTo(cx + dx, GROUND_Y);
    ctx.stroke();
  }
  ctx.fillStyle = '#d9b35a';
  ctx.fillRect(cx - 50, GROUND_Y - 6, 100, 8);
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

function drawGate(ctx, g, t) {
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
    const glow = ctx.createRadialGradient(x + 60, 330, 10, x + 60, 330, 170);
    glow.addColorStop(0, `rgba(255,220,140,${(0.55 + 0.12 * Math.sin(t * 3)).toFixed(3)})`);
    glow.addColorStop(1, 'rgba(255,220,140,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 100, 120, 320, 330);
    ctx.fillStyle = '#ffe6a8';
    ctx.beginPath();
    ctx.moveTo(x + 14, GROUND_Y);
    ctx.lineTo(x + 14, 230);
    ctx.arc(x + 60, 230, 46, Math.PI, 0);
    ctx.lineTo(x + 106, GROUND_Y);
    ctx.closePath();
    ctx.fill();
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
  const bob = pr.state === 'freed' ? Math.abs(Math.sin(pr.phase)) * 2 : 0;
  const sway = pr.state === 'freed' ? Math.sin(pr.phase) * 2 : Math.sin(t * 2) * 0.8;
  ctx.save();
  ctx.translate(pr.x, GROUND_Y - bob);
  ctx.scale(pr.facing, 1);
  // Long hair at the back
  ctx.fillStyle = '#6b3a2a';
  ctx.beginPath();
  ctx.moveTo(-9, -50);
  ctx.quadraticCurveTo(-18, -30, -13, -16);
  ctx.lineTo(-4, -22);
  ctx.closePath();
  ctx.fill();
  // Dress
  ctx.fillStyle = '#ff7fb0';
  ctx.beginPath();
  ctx.moveTo(-7, -32);
  ctx.lineTo(7, -32);
  ctx.lineTo(16 + sway, 0);
  ctx.lineTo(-16 + sway, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff0f6';
  ctx.fillRect(-16 + sway, -4, 32, 4);
  ctx.fillStyle = '#ffd66b';
  ctx.fillRect(-7, -33, 14, 2.5);
  ctx.fillStyle = '#ff4f8b';
  ctx.fillRect(-6, -41, 12, 10);
  // Arms: raised on the bars while captive
  ctx.strokeStyle = '#ffd9b8';
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  if (pr.state === 'captive') {
    limb(ctx, -5, -38, 12, -2.5);
    limb(ctx, 5, -38, 12, 2.5);
  } else {
    limb(ctx, -5, -38, 12, 0.5 + sway * 0.05);
    limb(ctx, 5, -38, 12, -0.4 - sway * 0.05);
  }
  // Head, hair and tiara
  ctx.fillStyle = '#ffd9b8';
  ctx.beginPath();
  ctx.arc(0, -48, 8.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#6b3a2a';
  ctx.beginPath();
  ctx.arc(0, -50, 9, Math.PI * 0.95, Math.PI * 2.05);
  ctx.fill();
  ctx.fillStyle = '#ffd66b';
  ctx.beginPath();
  ctx.moveTo(-7, -55);
  ctx.lineTo(-5, -63);
  ctx.lineTo(-2, -57);
  ctx.lineTo(0, -65);
  ctx.lineTo(2, -57);
  ctx.lineTo(5, -63);
  ctx.lineTo(7, -55);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ff4f8b';
  ctx.beginPath();
  ctx.arc(0, -58, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2b1b33';
  ctx.beginPath();
  ctx.arc(3, -48, 1.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2b1b33';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(3, -45, 2.5, 0.2, 1.2);
  ctx.stroke();
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
  limb(ctx, -3, -26, 25, air ? -0.45 : run * 0.7);
  limb(ctx, 3, -26, 25, air ? 0.35 : -run * 0.7);
  // Back arm
  ctx.strokeStyle = '#2f6fb8';
  ctx.lineWidth = 5;
  limb(ctx, -5, -42, 16, run ? -run * 0.9 : 0.25);
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
  ctx.fillStyle = '#ff3d5a';
  ctx.beginPath();
  ctx.ellipse(-116, -50, 6, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#12000a';
  ctx.fillRect(-117, -54, 2, 8);
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
    ctx.arc(q.x, q.y, q.size, 0, Math.PI * 2);
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
  drawSky(ctx, g, t);
  drawBats(ctx, t);
  drawTowers(ctx, g, FAR_TOWERS, 0.2, 330, '#170d2a', t);
  drawWall(ctx, g, t);
  ctx.save();
  ctx.translate(-g.camX + (g.shake > 0 ? (Math.random() - 0.5) * g.shake * 16 : 0), g.shake > 0 ? (Math.random() - 0.5) * g.shake * 10 : 0);
  drawFloor(ctx);
  drawGate(ctx, g, t);
  drawBarrier(ctx, g, t);
  drawPrincess(ctx, g.princess, t);
  drawCage(ctx, g, t);
  drawDragon(ctx, g.dragon, t);
  drawFire(ctx, g);
  drawRocks(ctx, g);
  drawBoy(ctx, g.p, t);
  drawSparks(ctx, g);
  drawParts(ctx, g);
  ctx.restore();
  if (g.flash > 0) {
    ctx.fillStyle = `rgba(230,220,255,${(g.flash * 0.45).toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
  }
  drawHud(ctx, g);
  if (g.phase === 'lost') {
    ctx.fillStyle = 'rgba(5,4,13,0.6)';
    ctx.fillRect(0, 0, W, H);
  }
  if (g.phase === 'won') {
    ctx.textAlign = 'center';
    ctx.font = `800 44px ${FONT}`;
    ctx.fillStyle = '#ffd66b';
    ctx.fillText('نجات یافتی!', W / 2, 180);
    ctx.textAlign = 'left';
  }
}

// ---------- the game object -------------------------------------------------

function buildDom() {
  const root = document.createElement('section');
  root.className = 'rescue';
  root.setAttribute('aria-label', 'بازی نجات پرنسس');
  root.innerHTML = `
    <canvas class="rescue-canvas" aria-hidden="true"></canvas>
    <div class="rescue-card" data-card="title">
      <div class="rescue-card-inner">
        <p class="rescue-kicker">قبل از ورود به خانه</p>
        <h2>نجات پرنسس</h2>
        <p>پرنسس زیر نگاه اژدها در قفس قلعه‌ی ترسناک اسیر است. پسر شجاع باید او را نجات بدهد و با هم از قلعه‌ی بلند فرار کنند.</p>
        <p class="rescue-keys" data-keys>← → حرکت · Space پرش · F جرقه‌ی جادویی</p>
        <button type="button" class="rescue-btn" data-action="start">شروع ماجراجویی</button>
      </div>
    </div>
    <div class="rescue-card" data-card="lost" hidden>
      <div class="rescue-card-inner">
        <h2>پرنسس منتظر است</h2>
        <p>اژدها کمی زورش آمد. دوباره تلاش کن، این بار محکم‌تر!</p>
        <button type="button" class="rescue-btn" data-action="retry">دوباره تلاش کن</button>
      </div>
    </div>
    <button type="button" class="rescue-skip" data-action="skip" hidden>رد کردن</button>
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

export function createRescueGame({ onDone }) {
  const root = buildDom();
  const canvas = root.querySelector('.rescue-canvas');
  const ctx = canvas.getContext('2d');
  const titleCard = root.querySelector('[data-card="title"]');
  const lostCard = root.querySelector('[data-card="lost"]');
  const skipBtn = root.querySelector('.rescue-skip');
  const touch = root.querySelector('.rescue-touch');
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  if (coarse) {
    root.querySelector('[data-keys]').textContent = 'دکمه‌های پایین صفحه را برای حرکت و جرقه بزن';
    touch.hidden = true;
  }

  const input = { left: false, right: false, jump: false, fire: false };
  const pressed = { jump: false, fire: false };
  let g = newState();
  let scale = 1;
  let offX = 0;
  let offY = 0;
  let finished = false;
  let raf = 0;
  let last = performance.now();

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
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
  }

  function finish() {
    if (finished) return;
    finished = true;
    g.phase = 'done';
    cancelAnimationFrame(raf);
    root.classList.add('is-leaving');
    window.setTimeout(() => root.remove(), 1400);
    if (onDone) onDone();
  }

  function advance(dt) {
    update(g, dt, input, pressed);
    pressed.jump = false;
    pressed.fire = false;
    if (g.phase === 'won' && g.endT >= WIN_HOLD) finish();
    syncUi();
  }

  function syncUi() {
    const playing = g.phase === 'play';
    skipBtn.hidden = !(playing || g.phase === 'won');
    touch.hidden = !(coarse && playing);
    lostCard.hidden = g.phase !== 'lost';
    titleCard.hidden = g.phase !== 'title';
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    advance(dt);
    draw();
    raf = requestAnimationFrame(loop);
  }

  function startGame() {
    if (g.phase !== 'title') return;
    g.phase = 'play';
    say(g, 'با ← و → حرکت کن و با F جرقه بزن', 3.4);
    syncUi();
  }

  function retry() {
    g = newState();
    g.phase = 'play';
    say(g, 'پرنسس منتظر است!', 2.2);
    syncUi();
  }

  // Keyboard
  function onKeyDown(e) {
    if (finished) return;
    if (e.target && e.target.tagName === 'BUTTON' && (e.code === 'Space' || e.code === 'Enter')) return;
    const key = KEYMAP[e.code];
    if (!key) return;
    e.preventDefault();
    if (e.repeat) return;
    input[key] = true;
    if (key === 'jump') pressed.jump = true;
    if (key === 'fire') pressed.fire = true;
  }
  function onKeyUp(e) {
    const key = KEYMAP[e.code];
    if (key) input[key] = false;
  }
  function releaseAll() {
    input.left = input.right = input.jump = input.fire = false;
  }

  // Buttons (click for start, retry, skip; press-and-hold for the touch controls)
  function onClick(e) {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'start') startGame();
    if (action === 'retry') retry();
    if (action === 'skip') finish();
  }
  function onTouchDown(e) {
    const btn = e.target.closest('button[data-key]');
    if (!btn) return;
    e.preventDefault();
    const key = btn.dataset.key;
    input[key] = true;
    if (key === 'jump') pressed.jump = true;
    if (key === 'fire') pressed.fire = true;
  }
  function onTouchUp(e) {
    const btn = e.target.closest('button[data-key]');
    if (btn) input[btn.dataset.key] = false;
  }

  window.addEventListener('resize', resize);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', releaseAll);
  root.addEventListener('click', onClick);
  root.addEventListener('pointerdown', onTouchDown);
  root.addEventListener('pointerup', onTouchUp);
  root.addEventListener('pointercancel', onTouchUp);
  root.addEventListener('pointerleave', onTouchUp);

  resize();
  syncUi();
  requestAnimationFrame((now) => {
    last = now;
    loop(now);
  });

  return {
    start: startGame,
    skip: finish,
    // Test hooks: read the state, move the boy, press keys, and step the simulation
    state: () => g,
    setPlayer(partial) {
      Object.assign(g.p, partial);
    },
    press(key) {
      input[key] = true;
      if (key === 'jump') pressed.jump = true;
      if (key === 'fire') pressed.fire = true;
    },
    release(key) {
      input[key] = false;
    },
    step(dt = 0.033, n = 1) {
      for (let i = 0; i < n; i += 1) advance(dt);
      draw();
    },
  };
}
