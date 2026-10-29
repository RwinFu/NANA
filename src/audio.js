// Small Web Audio synth: a soft arpeggiated loop plus a few sound effects.
// Everything is generated in code, so there are no audio files to download.

// The loop is in C# minor, the key of the family song. The melody opens on C# then G#,
// the first two notes of the song, and moves through its E, D# and F# colour.
const CHORDS = [
  [277.18, 329.63, 415.3, 554.37], // C#m: C# E G# C#
  [220.0, 277.18, 329.63, 440.0], // A: A C# E A
  [164.81, 207.65, 246.94, 329.63], // E: E G# B E
  [246.94, 311.13, 369.99, 493.88], // B: B D# F# B
];
const PATTERN = [0, 2, 1, 2, 3, 1, 2, 1];
// The song's detected beat is about 172 BPM. Its half-time pulse, about 86, is the one the loop follows.
const BPM = 86;
const STEP = 60 / BPM / 2; // eighth notes
const LOOKAHEAD_S = 0.25;
// The song from the family folder. Starts at the gate and keeps playing through the tour.
const SONG_URL = `${import.meta.env.BASE_URL}music/khooneye-man.mp3`;

export function createAudio() {
  let ctx = null;
  let master = null;
  let sfx = null;
  let musicOn = true;
  let playing = false;
  let timer = null;
  let nextTime = 0;
  let step = 0;
  let song = null;
  let songActive = false;
  let fadeTimer = null;

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
    get songPlaying() {
      return !!song && !song.paused;
    },
    // Called from a user gesture (the start button) so browsers allow audio.
    unlock() {
      const context = ensureContext();
      if (context && context.state === 'suspended') context.resume();
      if (musicOn && !songActive) startLoop();
    },
    setMusic(on) {
      musicOn = on;
      if (songActive) {
        if (song) on ? song.play().catch(() => {}) : song.pause();
        return;
      }
      if (on) startLoop();
      else stopLoop();
    },
    // The family song takes over from the synth loop and loops until the end.
    // Starts the song right away. main.js calls this in the same tick as the static burst.
    startSong() {
      if (!song) {
        song = new Audio(SONG_URL);
        song.loop = true;
        song.preload = 'auto';
        song.volume = 0;
      }
      stopLoop();
      songActive = true;
      if (!musicOn) return;
      song.currentTime = 0;
      song.play().catch(() => {});
      clearInterval(fadeTimer);
      const t0 = performance.now();
      fadeTimer = setInterval(() => {
        const k = Math.min(1, (performance.now() - t0) / 2200);
        song.volume = 0.7 * k;
        if (k >= 1) clearInterval(fadeTimer);
      }, 60);
    },
    // A short burst of filtered static for the gate glitch.
    static(duration = 1.2) {
      const context = ensureContext();
      if (!context || !sfx) return;
      if (context.state === 'suspended') context.resume();
      const len = Math.floor(context.sampleRate * duration);
      const buf = context.createBuffer(1, len, context.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
      const src = context.createBufferSource();
      src.buffer = buf;
      const band = context.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = 1800;
      band.Q.value = 0.6;
      const gain = context.createGain();
      gain.gain.value = 0.6;
      src.connect(band);
      band.connect(gain);
      gain.connect(sfx);
      src.start();
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
