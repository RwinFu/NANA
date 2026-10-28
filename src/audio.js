// Small Web Audio synth: a soft arpeggiated loop plus a few sound effects.
// Everything is generated in code, so there are no audio files to download.

const CHORDS = [
  [261.63, 329.63, 392.0, 523.25], // C
  [220.0, 261.63, 329.63, 440.0], // Am
  [174.61, 220.0, 261.63, 349.23], // F
  [196.0, 246.94, 293.66, 392.0], // G
];
const PATTERN = [0, 1, 2, 3, 2, 1, 2, 1];
const BPM = 76;
const STEP = 60 / BPM / 2; // eighth notes
const LOOKAHEAD_S = 0.25;

export function createAudio() {
  let ctx = null;
  let master = null;
  let sfx = null;
  let musicOn = true;
  let playing = false;
  let timer = null;
  let nextTime = 0;
  let step = 0;

  function ensureContext() {
    if (ctx) return ctx;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 2400;
    master.connect(lowpass);
    lowpass.connect(ctx.destination);
    // Sound effects bypass the music gain so they still play when music is off.
    sfx = ctx.createGain();
    sfx.gain.value = 0.5;
    sfx.connect(ctx.destination);
    return ctx;
  }

  function tone(freq, when, duration, volume, dest) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, when);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(volume, when + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(when);
    osc.stop(when + duration + 0.05);
  }

  function scheduleStep(when) {
    const chordIndex = Math.floor(step / PATTERN.length) % CHORDS.length;
    const chord = CHORDS[chordIndex];
    const note = chord[PATTERN[step % PATTERN.length]];
    tone(note, when, 1.9, 0.16, master);
    if (step % PATTERN.length === 0) tone(chord[0] / 2, when, 2.6, 0.12, master);
    step += 1;
  }

  function pump() {
    if (!ctx || !playing) return;
    while (nextTime < ctx.currentTime + LOOKAHEAD_S) {
      scheduleStep(nextTime);
      nextTime += STEP;
    }
  }

  function startLoop() {
    const context = ensureContext();
    if (!context || playing) return;
    if (context.state === 'suspended') context.resume();
    playing = true;
    nextTime = context.currentTime + 0.05;
    timer = window.setInterval(pump, 80);
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setTargetAtTime(0.32, context.currentTime, 0.4);
  }

  function stopLoop() {
    if (!ctx) return;
    playing = false;
    window.clearInterval(timer);
    timer = null;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
  }

  return {
    get musicOn() {
      return musicOn;
    },
    // Called from a user gesture (the start button) so browsers allow audio.
    unlock() {
      const context = ensureContext();
      if (context && context.state === 'suspended') context.resume();
      if (musicOn) startLoop();
    },
    setMusic(on) {
      musicOn = on;
      if (on) startLoop();
      else stopLoop();
    },
    chime(freq = 659.25) {
      const context = ensureContext();
      if (!context) return;
      if (context.state === 'suspended') context.resume();
      const t = context.currentTime;
      tone(freq, t, 0.9, 0.22, sfx);
      tone(freq * 1.5, t + 0.09, 1.1, 0.12, sfx);
    },
    shutter() {
      const context = ensureContext();
      if (!context) return;
      if (context.state === 'suspended') context.resume();
      const t = context.currentTime;
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1400, t);
      osc.frequency.exponentialRampToValueAtTime(180, t + 0.06);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      osc.connect(gain);
      gain.connect(sfx);
      osc.start(t);
      osc.stop(t + 0.1);
    },
    fanfare() {
      const context = ensureContext();
      if (!context) return;
      if (context.state === 'suspended') context.resume();
      const t = context.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, t + i * 0.12, 1.6, 0.2, sfx));
    },
    dispose() {
      stopLoop();
      if (ctx && ctx.state !== 'closed') ctx.close();
      ctx = null;
    },
  };
}
