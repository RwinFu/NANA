// Full-screen 2D particle layer for fireworks and sparkles.
const COLORS = ['#ffcf8a', '#ff7a9a', '#fff1e1', '#b9a6ff', '#ffe27a', '#8fd6ff'];

export function createFx(canvas) {
  const ctx = canvas.getContext('2d');
  let particles = [];
  let rockets = [];
  let running = false;
  let last = 0;
  let width = 0;
  let height = 0;
  let dpr = 1;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function burst(x, y, color, count = 46) {
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.2;
      const speed = 60 + Math.random() * 180;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        max: 0.9 + Math.random() * 0.8,
        color: color || COLORS[Math.floor(Math.random() * COLORS.length)],
        size: 1.6 + Math.random() * 1.8,
      });
    }
  }

  function launch() {
    rockets.push({
      x: width * (0.15 + Math.random() * 0.7),
      y: height,
      vy: -(height * (0.55 + Math.random() * 0.25)),
      target: height * (0.18 + Math.random() * 0.3),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    });
    ensureRunning();
  }

  function show(count = 6, interval = 0.35) {
    if (reduceMotion) {
      burst(width / 2, height / 3, null, 60);
      ensureRunning();
      return undefined;
    }
    let spawned = 0;
    let timer = 0;
    const schedule = () => {
      if (spawned >= count) return;
      launch();
      spawned += 1;
      timer = window.setTimeout(schedule, interval * 1000 * (0.6 + Math.random() * 0.8));
    };
    schedule();
    return () => window.clearTimeout(timer);
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ctx.clearRect(0, 0, width, height);

    rockets = rockets.filter((r) => {
      r.vy += 260 * dt;
      r.y += r.vy * dt;
      ctx.fillStyle = r.color;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 2, 0, Math.PI * 2);
      ctx.fill();
      if (r.vy >= 0 || r.y <= r.target) {
        burst(r.x, r.y, r.color);
        return false;
      }
      return true;
    });

    particles = particles.filter((p) => {
      p.life += dt;
      if (p.life >= p.max) return false;
      p.vx *= 0.985;
      p.vy = p.vy * 0.985 + 90 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      ctx.globalAlpha = 1 - p.life / p.max;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      return true;
    });
    ctx.globalAlpha = 1;

    if (particles.length || rockets.length) {
      requestAnimationFrame(frame);
    } else {
      running = false;
      ctx.clearRect(0, 0, width, height);
    }
  }

  function ensureRunning() {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }

  resize();
  window.addEventListener('resize', resize);

  return {
    burst(x, y, color, count) {
      burst(x, y, color, count);
      ensureRunning();
    },
    show(count, interval) {
      return show(count, interval);
    },
    dispose() {
      window.removeEventListener('resize', resize);
      particles = [];
      rockets = [];
    },
  };
}
