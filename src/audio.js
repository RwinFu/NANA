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
  let loopEndTimer = null;
  let songRamp = null;

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

  // Creates the song element once and starts downloading it early, so it plays right at the gate.
  function ensureSong() {
    if (song) return song;
    song = new Audio(SONG_URL);
    song.loop = true;
    song.preload = 'auto';
    song.volume = 0;
    song.load();
    return song;
  }

  // One second of white noise, made once and reused by every paper and wax sound.
  let noise = null;
  function noiseBuffer() {
    if (noise) return noise;
    const frames = Math.floor(ctx.sampleRate);
    noise = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = noise.getChannelData(0);
    let seed = 1;
    for (let i = 0; i < frames; i += 1) {
      // a tiny xorshift, so the same sound every visit rather than Math.random's hiss
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      data[i] = ((seed >>> 0) / 4294967296) * 2 - 1;
    }
    return noise;
  }

  // A short burst of filtered noise: the body of every non-tonal effect here.
  function noiseBurst(when, duration, freq, volume, q = 1) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer();
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.setValueAtTime(freq, when);
    band.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(volume, when + duration * 0.2);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    src.connect(band); band.connect(gain); gain.connect(sfx);
    src.start(when, 0, duration + 0.02);
    src.stop(when + duration + 0.04);
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

  // Slowly lowers the synth loop, keeping the notes going, then stops the scheduler.
  function fadeLoopOut(seconds) {
    if (!ctx || !playing) return;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0, now + seconds);
    window.clearTimeout(loopEndTimer);
    loopEndTimer = window.setTimeout(() => {
      playing = false;
      window.clearInterval(timer);
      timer = null;
    }, seconds * 1000 + 100);
  }

  // Eases the song's volume toward `to` over `seconds` (smoothstep, so it starts and ends softly).
  function rampSong(to, seconds) {
    if (!song) return;
    window.cancelAnimationFrame(songRamp);
    const from = song.volume;
    const t0 = performance.now();
    const frame = () => {
      const k = Math.min(1, (performance.now() - t0) / (seconds * 1000));
      const e = k * k * (3 - 2 * k);
      song.volume = from + (to - from) * e;
      if (k < 1) songRamp = window.requestAnimationFrame(frame);
    };
    songRamp = window.requestAnimationFrame(frame);
  }

  return {
    get musicOn() {
      return musicOn;
    },
    get songPlaying() {
      return !!song && !song.paused;
    },
    get songVolume() {
      return song ? song.volume : 0;
    },
    // Called from a user gesture (the start button) so browsers allow audio.
    unlock() {
      const context = ensureContext();
      if (context && context.state === 'suspended') context.resume();
      ensureSong();
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
    // Starts the song right away at the gate.
    // The synth loop fades out slowly while the song fades in, so the two overlap softly.
    startSong() {
      ensureSong();
      songActive = true;
      fadeLoopOut(3.2);
      if (!musicOn) return;
      song.volume = 0;
      song.currentTime = 0;
      song.play().catch(() => {});
      rampSong(0.7, 3.8);
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
    // The four sounds of opening a sealed letter. All noise-shaped rather than tonal: wax and paper
    // are not notes. They are kept here, next to the other effects, so the envelope only says *when*.
    waxCrack() {
      const context = ensureContext();
      if (!context) return;
      if (context.state === 'suspended') context.resume();
      const t = context.currentTime;
      // a short, dry crackle: filtered noise with a fast decay
      for (let i = 0; i < 3; i += 1) {
        noiseBurst(t + i * 0.045, 0.05, 2600 - i * 500, 0.06, 0.6);
      }
    },
    waxSnap() {
      const context = ensureContext();
      if (!context) return;
      if (context.state === 'suspended') context.resume();
      const t = context.currentTime;
      // the break itself: a lower, rounder knock with a little body under it
      noiseBurst(t, 0.09, 900, 0.11, 1.4);
      tone(196, t, 0.12, 0.07, sfx);
      tone(146.83, t + 0.02, 0.16, 0.05, sfx);
    },
    flap() {
      const context = ensureContext();
      if (!context) return;
      if (context.state === 'suspended') context.resume();
      const t = context.currentTime;
      // paper being turned: a soft swish that opens upward
      const src = context.createBufferSource();
      src.buffer = noiseBuffer();
      const band = context.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.setValueAtTime(700, t);
      band.frequency.exponentialRampToValueAtTime(2400, t + 0.22);
      band.Q.value = 0.9;
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.09, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      src.connect(band); band.connect(gain); gain.connect(sfx);
      src.start(t); src.stop(t + 0.34);
    },
    paper() {
      const context = ensureContext();
      if (!context) return;
      if (context.state === 'suspended') context.resume();
      const t = context.currentTime;
      // the sheet sliding out: a longer, quieter rustle with the folds in it
      for (let i = 0; i < 4; i += 1) {
        noiseBurst(t + i * 0.075, 0.075, 1800 + (i % 2) * 900, 0.035, 0.9);
      }
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
