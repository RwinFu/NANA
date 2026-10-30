// Small sound effects for the rescue game, made with the Web Audio API, so no files are loaded.
// The audio context is created on the first sound, which always follows a tap or key press.
let ctx = null;
let master = null;
let noiseBuf = null;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.3;
    master.connect(ctx.destination);
    // one second of white noise, reused by every noise sound
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// A tone that glides from f0 to f1 and fades out over dur seconds
function tone(c, f0, f1, t0, dur, type, peak) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.02, dur * 0.2));
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain);
  gain.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

// Filtered noise: a breath, a rumble or a crash
function noise(c, t0, dur, peak, cutoff) {
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  const gain = c.createGain();
  gain.gain.setValueAtTime(peak, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  src.start(t0, Math.random() * 0.5, dur + 0.05);
}

const SOUNDS = {
  // a bright sparkle when she throws a spark
  spark(c, t) {
    tone(c, 1400, 2100, t, 0.14, 'triangle', 0.22);
  },
  // a short thump and crackle when she is hurt
  hit(c, t) {
    noise(c, t, 0.3, 0.35, 900);
    tone(c, 170, 60, t, 0.25, 'sine', 0.35);
  },
  // the dragon's breath
  breath(c, t) {
    noise(c, t, 0.7, 0.12, 520);
  },
  // the dragon's roar, when it is hit and flees
  roar(c, t) {
    noise(c, t, 0.9, 0.3, 380);
    tone(c, 95, 42, t, 0.9, 'sawtooth', 0.09);
  },
  // a metal clank when a spark hits the dragon
  clank(c, t) {
    tone(c, 900, 600, t, 0.12, 'square', 0.1);
    tone(c, 1300, 900, t + 0.02, 0.2, 'triangle', 0.14);
  },
  // a happy chime when a cat is freed
  chime(c, t) {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, k) => {
      tone(c, f, f * 1.003, t + k * 0.09, 0.6, 'sine', 0.2);
    });
  },
  // a soft upward whoosh for the second jump
  jump2(c, t) {
    tone(c, 620, 1240, t, 0.18, 'sine', 0.14);
  },
};

export const sfx = {
  play(name) {
    const c = ensure();
    if (!c || !SOUNDS[name]) return;
    try {
      SOUNDS[name](c, c.currentTime + 0.005);
    } catch {
      // a sound that fails must never stop the game
    }
  },
};
