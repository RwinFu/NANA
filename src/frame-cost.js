// Where is the frame going, on *this* machine?
//
// Optical advice — "it is draw calls", "it is the resolution", "it is the blur" — is worth nothing, because
// the same scene costs a dedicated GPU almost nothing and a laptop's integrated one a great deal. So this
// measures the frame in four parts and prints them on screen (`?perf=hud`):
//
//   cpu     the game's own JavaScript: the camera, the couple, the cats, the world, the UI
//   render  handing the picture to the GPU and waiting for it (draw calls, lights, fill, shaders)
//   gap     the rest of the frame: the browser's compositing, the blur behind the panels, other tabs
//
// Divide the first two by frames to get milliseconds per frame; `gap` is whatever nobody in this file
// asked for. A page that draws a `backdrop-filter` blur over the canvas can be slow while the game's own
// numbers look faultless — the cost is real and it is not in our code, which is exactly the case `gap`
// exists to name.
//
// `?perf=half` renders the same scene at half the width and height and shows both numbers side by side.
// If the half-size build is much faster, the frame is fill-bound (resolution, lights, transparent
// layers); if it is not, it is call-bound (the draw calls). Those two are fixed by entirely different work,
// so this is the first thing to know.

// How many frames each phase of the comparison averages over.
const PHASE_FRAMES = 12;

export function createFrameCost() {
  let el = null;
  let text = null;
  let elapsed = 0;
  let frames = 0;
  let cpuMs = 0;
  let renderMs = 0;
  let worst = 0;
  let renderer = null;
  let quality = null; // read the adaptive ladder: an oscillating ladder shows up as drops, not as slowness
  let lastScale = null;
  let steps = 0;
  let comparing = false;
  let fullMs = null;
  let halfMs = null;
  let phase = 'full';
  let phaseDeadline = 0;

  function mount() {
    if (el) return;
    el = document.createElement('div');
    el.className = 'frame-cost';
    text = document.createElement('pre');
    el.append(text);
    document.body.append(el);
  }

  function setSize(width, height) {
    // setSize, not setPixelRatio: this is a measurement of the drawing buffer, not a quality decision.
    renderer.setSize(width, height, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
  }

  function fullSize() {
    return [window.innerWidth, window.innerHeight];
  }

  function halfSize() {
    return [Math.max(320, Math.round(window.innerWidth / 2)), Math.max(200, Math.round(window.innerHeight / 2))];
  }

  function describe() {
    const buffer = renderer.domElement;
    const mp = +((buffer.width * buffer.height) / 1e6).toFixed(2);
    const fps = frames / Math.max(0.001, elapsed);
    const per = (ms) => (ms / Math.max(1, frames)).toFixed(1);
    const total = 1000 / Math.max(0.001, fps);
    const cpu = Number(per(cpuMs));
    const render = Number(per(renderMs));
    const gap = Math.max(0, total - cpu - render).toFixed(1);
    const lines = [
      `فریم   ${total.toFixed(1)} ms   ${fps.toFixed(0)} fps   (بدترین ${worst.toFixed(0)} ms)`,
      `بوم    ${buffer.width}×${buffer.height}  = ${mp} مگاپیکسل`,
      `کد بازی  ${cpu.toFixed(1)} ms`,
      `رسم/GPU  ${render.toFixed(1)} ms   (${renderer.info.render.calls} draw call)`,
      `مرورگر  ${gap} ms   (ترکیب لایه‌ها، بلور، تب‌های دیگر)`,
    ];
    if (quality) {
      lines.push(`کیفیت  ${quality.scale}×  ${steps ? `(${steps} بار تغییر کرد — این خودش لگ می‌سازد)` : '(ثابت)'}`);
    }
    if (fullMs !== null && halfMs !== null) {
      const gain = (1 - halfMs / fullMs) * 100;
      lines.push(`نصف‌رزولوشن ${halfMs.toFixed(1)} ms  /  کامل ${fullMs.toFixed(1)} ms  (${gain.toFixed(0)}٪ کمتر)`);
      lines.push(gain > 25 ? '  ⇒ گلوگاه «پرکردن پیکسل» است (رزولوشن/نور/لایه‌ها)' : '  ⇒ گلوگاه تعداد draw call است');
    }
    if (text) text.textContent = lines.join('\n');
  }

  return {
    mount,
    attach(instance, ladder) { renderer = instance; quality = ladder || null; },
    // Wrap the render call (and the wait for the GPU that follows it). `workStart` is when this frame
    // began, which is how the game's own CPU time falls out as the difference.
    measureDraw(draw, workStart) {
      const t0 = performance.now();
      if (typeof workStart === 'number') cpuMs += t0 - workStart;
      draw();
      const gl = renderer.getContext();
      gl.finish(); // otherwise the GPU drifts into the next frame and the number means nothing
      renderMs += performance.now() - t0;
    },
    // Once per frame, with the real time between frames. Not the game's own dt: that is clamped to 50 ms,
    // and a measurement that clamps its own input cannot report a slow frame.
    end(frameMs) {
      frames += 1;
      elapsed += frameMs / 1000;
      if (frameMs > worst) worst = frameMs;
      // a ladder that keeps changing its mind reallocates the drawing buffer each time: visible hitches
      if (quality) {
        if (lastScale !== null && quality.scale !== lastScale) steps += 1;
        lastScale = quality.scale;
      }
      // The half-resolution comparison. Each phase lasts until it has drawn a real frame, not a second of
      // wall-clock: on a slow machine a second may hold only one frame, and on a fast one the measurement
      // would be dominated by the frame it changed the canvas on.
      // (a first phase also ends on a timeout, so a scene that cannot finish a second of frames still
      // produces both numbers instead of nothing)
      if (comparing && (frames >= PHASE_FRAMES || performance.now() > phaseDeadline)) {
        const per = renderMs / frames;
        if (phase === 'full') {
          fullMs = per;
          phase = 'half';
          setSize(...halfSize());
        } else {
          halfMs = per;
          phase = 'full';
          setSize(...fullSize());
        }
        phaseDeadline = performance.now() + 6000;
        reset();
      }
      if (elapsed >= 1) {
        describe();
        reset();
        worst = 0;
      }
    },
    // `?perf=half`: keep comparing full and half the whole time.
    startComparing() {
      comparing = true;
      phase = 'full';
      phaseDeadline = performance.now() + 6000;
      setSize(...fullSize());
    },
  };

  function reset() {
    elapsed = 0;
    frames = 0;
    cpuMs = 0;
    renderMs = 0;
  }
}
