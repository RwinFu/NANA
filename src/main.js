import '@fontsource-variable/vazirmatn';
import './style.css';
import * as THREE from 'three';
import { allMemories, defaults, letterParagraphs } from './memories.js';
import { createStore, formatNumber } from './state.js';
import { buildWorld, LAYOUT } from './world.js';
import { createCouple } from './characters.js';
import { createEnvelope } from './envelope.js';
import { createControls } from './controls.js';
import { createAudio } from './audio.js';
import { createFx } from './fx.js';
import { createTrail } from './trail.js';
import { createFootprints } from './footprints.js';
import { createSparkles } from './castle.js';
import { createFairy } from './fairy.js';
import { composePostcard, canvasToBlob } from './postcard.js';
import { createRescueGame } from './rescue.js';
import { createCats } from './cats.js';

const $ = (sel) => document.querySelector(sel);
const SWATCHES = [
  ['#ff758f', 'صورتی پرنسسی'],
  ['#ff9ebb', 'شکوفه رز'],
  ['#e27396', 'رز مخملی'],
  ['#c084fc', 'بنفش یاسی'],
  ['#ffd875', 'طلایی رویایی'],
];
const MILESTONE = 1000;
const INTERACT_RADIUS = 3.6;
const ENVELOPE_RADIUS = 3.2;

const dom = {
  intro: $('#intro'),
  setup: $('#setup'),
  error: $('#form-error'),
  enter: $('#enter-btn'),
  webgl: $('#webgl-error'),
  swatchRow: $('#swatch-row'),
  hud: $('#hud'),
  hudSub: $('#hud-subtitle'),
  love: $('#love-btn'),
  loveCount: $('#love-count'),
  plusOne: $('#plus-one'),
  musicBtn: $('#music-btn'),
  holdBtn: $('#hold-btn'),
  danceBtn: $('#dance-btn'),
  prompt: $('#prompt'),
  promptLabel: $('#prompt-label'),
  promptBtn: $('#prompt-btn'),
  hint: $('#controls-hint'),
  joystick: $('#joystick'),
  knob: $('#joystick-knob'),
  toast: $('#toast'),
  flash: $('#flash'),
  memory: $('#memory-dialog'),
  finale: $('#finale-dialog'),
  letter: $('#letter-dialog'),
  postcard: $('#postcard-dialog'),
  help: $('#help-dialog'),
};

const store = createStore();
const coarse = window.matchMedia('(pointer: coarse)').matches;

// ---------- form ---------------------------------------------------------

let selectedColor = store.get().avatarColor;
function fillForm(state) {
  $('#from-name').value = state.fromName;
  $('#to-name').value = state.toName;
  $('#dedication').value = state.dedication;
  $('#anniversary-msg').value = state.anniversaryMsg;
  $('#love-count-input').value = String(state.loveCount);
}
fillForm(store.get());

SWATCHES.forEach(([color, label]) => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'swatch';
  btn.dataset.color = color;
  btn.style.setProperty('--swatch', color);
  btn.setAttribute('aria-label', label);
  btn.setAttribute('aria-pressed', String(color === selectedColor));
  btn.title = label;
  btn.addEventListener('click', () => {
    selectedColor = color;
    dom.swatchRow.querySelectorAll('.swatch').forEach((el) => {
      el.setAttribute('aria-pressed', String(el.dataset.color === color));
    });
    hero?.setDress(color);
  });
  dom.swatchRow.appendChild(btn);
});

function readForm() {
  const raw = Number($('#love-count-input').value);
  const loveOk = Number.isInteger(raw) && raw >= 1 && raw <= 9999999;
  return {
    loveOk,
    patch: {
      fromName: $('#from-name').value,
      toName: $('#to-name').value,
      dedication: $('#dedication').value,
      anniversaryMsg: $('#anniversary-msg').value,
      loveCount: loveOk ? raw : store.get().loveCount,
      avatarColor: selectedColor,
    },
  };
}

// ---------- WebGL setup -------------------------------------------------

let renderer = null;
try {
  renderer = new THREE.WebGLRenderer({ canvas: $('#scene'), antialias: true, powerPreference: 'high-performance' });
} catch {
  renderer = null;
}

if (!renderer) {
  dom.webgl.hidden = false;
  dom.enter.disabled = true;
}

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 220);
let world = null;
let hero = null;
let cats = null;
let trail = null;
let footprints = null;
let envelope = null;
let controls = null;
let started = false;
let transition = null;
let introSparkles = null;
let introFairy = null;
let introSparkleLevel = 0;
let introReady = false;
let introFired = false;
let nearFrame = -1;
const audio = createAudio();
const fx = createFx($('#fx'));
const raycaster = new THREE.Raycaster();

// "Enter the house" starts the rescue mini game. When the boy has saved the princess and both cats,
// the intro flight plays, then the tour of our home starts by itself.
let rescueActive = false;
let introPlaying = false; // the flight plays only after the rescue
let introSettled = false;
let rescue = null;
let introT0 = 0;
let pendingState = null;

function beginRescue(state) {
  pendingState = state;
  rescueActive = true;
  dom.intro.hidden = true;
  rescue = createRescueGame({ onDone: finishRescue, autoStart: true });
  if (import.meta.env.DEV) window.__rescue = rescue;
}

function finishRescue() {
  rescueActive = false;
  introPlaying = true;
  introFired = false;
  introReady = false;
  introT0 = clock.elapsedTime;
  dom.intro.classList.remove('is-ready');
  dom.intro.classList.add('flight-only');
  dom.intro.hidden = false;
  rescue.reveal(); // the black screen lifts into the intro
}

if (renderer) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  world = buildWorld(scene);
  introSparkles = createSparkles(scene);
  introFairy = createFairy(scene);
  hero = createCouple(store.get().avatarColor);
  scene.add(hero.root);
  cats = createCats(scene, hero);
  trail = createTrail(scene);
  footprints = createFootprints(scene);

  envelope = createEnvelope(scene, {
    fromName: store.get().fromName,
    toName: store.get().toName,
    paragraph: letterParagraphs[1],
  });

  controls = createControls({
    camera,
    canvas: renderer.domElement,
    player: hero.root,
    playerModel: hero.root,
    isBlocked: () => !started || anyDialogOpen(),
    onTapFrame: tapFrame,
  });
}

function anyDialogOpen() {
  return !!document.querySelector('dialog[open]');
}

// ---------- toast --------------------------------------------------------

let toastTimer = 0;
function toast(text, ms = 2800) {
  dom.toast.textContent = text;
  dom.toast.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => dom.toast.classList.remove('is-visible'), ms);
}

// ---------- love ---------------------------------------------------------

function renderLove(count) {
  const text = formatNumber(count);
  dom.loveCount.textContent = text;
  $('#memory-love-text').textContent = `دوستت دارم (${text} بار)`;
  $('#stat-love').textContent = text;
}

function addLove(burstAt) {
  const count = store.get().loveCount + 1;
  store.set({ loveCount: count });
  renderLove(count);
  audio.chime(count % 2 ? 659.25 : 783.99);

  dom.plusOne.classList.remove('is-showing');
  void dom.plusOne.offsetWidth; // restart the CSS animation
  dom.plusOne.classList.add('is-showing');

  if (world && burstAt) world.burstHearts(burstAt, 9);
  if (count % MILESTONE === 0) {
    toast(`به ${formatNumber(count)} بار دوستت دارم رسیدیم`, 3600);
    fx.show(3, 0.4);
  }
  return count;
}

// ---------- dialogs ------------------------------------------------------

let lastFocus = null;
function openDialog(dialog) {
  if (dialog.open) return;
  const active = document.activeElement;
  if (active && active !== document.body) lastFocus = active;
  dialog.showModal();
}
function closeDialog(dialog) {
  if (dialog.open) dialog.close();
}
document.querySelectorAll('dialog').forEach((dialog) => {
  dialog.addEventListener('close', () => {
    if (lastFocus && typeof lastFocus.focus === 'function' && !anyDialogOpen()) lastFocus.focus();
    lastFocus = null;
  });
  dialog.querySelectorAll('[data-close]').forEach((btn) => btn.addEventListener('click', () => closeDialog(dialog)));
});

// Memory
let memoryIndex = 0;
const memoryPhoto = $('#memory-photo');
const memoryFrame = $('#memory-frame');

function showMemory(index) {
  const count = allMemories.length;
  memoryIndex = (index + count) % count;
  const memory = allMemories[memoryIndex];
  $('#memory-title').textContent = memory.title;
  $('#memory-caption').textContent = memory.caption;
  $('#memory-chapter').textContent = memory.chapter;
  $('#memory-count').textContent = `${formatNumber(memoryIndex + 1)} از ${formatNumber(count)}`;
  $('#memory-frame-name').textContent = `قاب ${memory.frame.name}`;
  memoryFrame.style.setProperty('--frame', memory.frame.color);
  memoryPhoto.alt = memory.title;
  memoryPhoto.hidden = false;
  memoryPhoto.src = memory.image;
  memoryPhoto.onerror = () => {
    memoryPhoto.alt = 'این عکس پیدا نشد';
    memoryPhoto.hidden = true;
  };
  renderLove(store.get().loveCount);
}

function openMemory(index) {
  showMemory(index);
  openDialog(dom.memory);
  $('#memory-next').focus({ preventScroll: true });
}

dom.memory.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    showMemory(memoryIndex + 1);
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    showMemory(memoryIndex - 1);
  }
});
$('#memory-prev').addEventListener('click', () => showMemory(memoryIndex - 1));
$('#memory-next').addEventListener('click', () => showMemory(memoryIndex + 1));
$('#memory-love').addEventListener('click', () => addLove());

// Finale
function openFinale() {
  const s = store.get();
  $('#finale-message').textContent = s.anniversaryMsg;
  $('#finale-title').textContent = 'اولین سالگرد یکی شدنمون مبارک!';
  renderLove(s.loveCount);
  openDialog(dom.finale);
  audio.fanfare();
  fx.show(7, 0.45);
}
$('#finale-love').addEventListener('click', () => {
  const origin = hero ? hero.root.position.clone().setY(2.4) : null;
  addLove(origin);
  fx.burst(window.innerWidth / 2, window.innerHeight * 0.45, '#ff8fab', 40);
});
$('#finale-photo').addEventListener('click', () => openPostcard());

// Letter (shown after the envelope opens)
function fillLetter(state) {
  $('#letter-title').textContent = `برای ${state.toName}`;
  $('#letter-from-sign').textContent = state.fromName;
  $('#letter-body').replaceChildren(
    ...letterParagraphs.map((text) => {
      const p = document.createElement('p');
      p.textContent = text;
      return p;
    })
  );
}
fillLetter(store.get());

function openLetter() {
  audio.chime(523.25);
  openDialog(dom.letter);
}

function openEnvelope() {
  if (!envelope) return;
  if (envelope.isOpen) {
    openLetter();
    return;
  }
  if (envelope.isBusy) return;
  envelope.open(() => {
    fx.burst(window.innerWidth / 2, window.innerHeight * 0.4, '#ffd98a', 36);
    openLetter();
  });
}

// Postcard
let postcardUrl = null;
let postcardBusy = false;
async function openPostcard() {
  if (!renderer || postcardBusy) return;
  postcardBusy = true;
  ['finale-dialog', 'memory-dialog', 'letter-dialog', 'help-dialog'].forEach((id) => closeDialog(document.getElementById(id)));
  const img = $('#postcard-img');
  const busy = $('#postcard-busy');
  busy.hidden = false;
  img.hidden = true;
  openDialog(dom.postcard);

  // Flash and shutter sound, then capture the current view.
  dom.flash.classList.remove('is-firing');
  void dom.flash.offsetWidth;
  dom.flash.classList.add('is-firing');
  audio.shutter();

  renderer.render(scene, camera);
  const snapshot = renderer.domElement.toDataURL('image/png');
  const s = store.get();
  try {
    const canvas = await composePostcard({
      snapshot,
      title: 'خانه‌ی ما',
      names: `${s.fromName} & ${s.toName}`,
      subtitle: '۳۶۵ روز خاطره‌ی قشنگ · تا ابد در قلبم',
    });
    const blob = await canvasToBlob(canvas);
    if (postcardUrl) URL.revokeObjectURL(postcardUrl);
    postcardUrl = URL.createObjectURL(blob);
    img.src = postcardUrl;
    $('#postcard-download').href = postcardUrl;
    img.hidden = false;
  } catch {
    toast('ساخت کارت پستال انجام نشد. دوباره امتحان کن.');
    closeDialog(dom.postcard);
  } finally {
    busy.hidden = true;
    postcardBusy = false;
  }
}
$('#photo-btn').addEventListener('click', () => openPostcard());
dom.postcard.addEventListener('close', () => {
  if (postcardUrl) {
    URL.revokeObjectURL(postcardUrl);
    postcardUrl = null;
    $('#postcard-img').removeAttribute('src');
  }
});

// Help
$('#help-btn').addEventListener('click', () => openDialog(dom.help));

// ---------- world interaction --------------------------------------------

function tapFrame(ndc) {
  if (!world || !started) return;
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(world.frames.map((f) => f.photo), false);
  if (hits.length && hits[0].distance < 12) {
    const frame = world.frames.find((f) => f.photo === hits[0].object);
    if (frame) openMemory(frame.index);
    return;
  }
  if (envelope) {
    const envHits = raycaster.intersectObjects(envelope.hitTargets, false);
    if (envHits.length && envHits[0].distance < 14) openEnvelope();
  }
}

function nearestFrame() {
  if (!world || !controls) return -1;
  let best = -1;
  let bestDist = INTERACT_RADIUS;
  world.frames.forEach((frame) => {
    const d = Math.hypot(controls.position.x - frame.center.x, controls.position.z - frame.center.z);
    if (d < bestDist) {
      bestDist = d;
      best = frame.index;
    }
  });
  return best;
}

function nearEnvelope() {
  const { x, z } = LAYOUT.envelope;
  return !!controls && controls.isNear(x, z, ENVELOPE_RADIUS);
}

let promptTarget = null;
function updatePrompt() {
  if (!started || anyDialogOpen()) {
    dom.prompt.hidden = true;
    return;
  }
  nearFrame = nearestFrame();
  if (nearFrame >= 0) {
    promptTarget = { type: 'frame', index: nearFrame };
    dom.promptLabel.textContent = `دیدن خاطره‌ی ${formatNumber(nearFrame + 1)}`;
  } else if (nearEnvelope()) {
    promptTarget = { type: 'envelope' };
    dom.promptLabel.textContent = envelope?.isOpen ? 'خواندن نامه' : 'باز کردن نامه';
  } else {
    promptTarget = null;
  }
  dom.prompt.hidden = !promptTarget;
}

function interact() {
  if (!promptTarget) return;
  if (promptTarget.type === 'frame') {
    openMemory(promptTarget.index);
  } else if (promptTarget.type === 'envelope') {
    openEnvelope();
  }
}
dom.promptBtn.addEventListener('click', interact);

window.addEventListener('keydown', (event) => {
  if (!started || anyDialogOpen()) return;
  if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select')) return;
  if (event.code === 'KeyE') {
    event.preventDefault();
    interact();
  } else if (event.code === 'KeyG') {
    event.preventDefault();
    toggleHold();
  } else if (event.code === 'KeyR') {
    event.preventDefault();
    cycleDance();
  } else if (event.code === 'KeyH') {
    openDialog(dom.help);
  }
});

// ---------- HUD ----------------------------------------------------------

dom.love.addEventListener('click', () => {
  const rect = dom.love.getBoundingClientRect();
  addLove(hero ? hero.root.position.clone().setY(2.2) : null);
  fx.burst(rect.left + rect.width / 2, rect.top + rect.height / 2, '#ff8fab', 22);
});

// ---------- hand holding and dances ---------------------------------------

let coupleUiKey = '';
function syncCoupleUi() {
  if (!hero) return;
  const holding = hero.isHolding();
  const dance = hero.danceName();
  const key = `${holding}|${dance}`;
  if (key === coupleUiKey) return;
  coupleUiKey = key;
  dom.holdBtn.textContent = holding ? 'ول کن' : 'دست بگیر';
  dom.holdBtn.setAttribute('aria-pressed', String(holding));
  dom.danceBtn.textContent = dance ? `رقص: ${dance}` : 'رقص';
  dom.danceBtn.setAttribute('aria-pressed', String(!!dance));
}

function toggleHold() {
  if (!hero) return;
  const on = hero.toggleHolding();
  toast(on ? 'دستش را گرفت' : 'دستش را رها کرد', 2200);
  syncCoupleUi();
}

function cycleDance() {
  if (!hero) return;
  const name = hero.nextDance();
  toast(name ? `رقص «${name}»` : 'رقص تمام شد', 2600);
  syncCoupleUi();
}

dom.holdBtn.addEventListener('click', toggleHold);
dom.danceBtn.addEventListener('click', cycleDance);

$('#finale-btn').addEventListener('click', () => openFinale());
$('#letter-btn').addEventListener('click', () => openDialog(dom.letter));

function setMusicUi() {
  dom.musicBtn.setAttribute('aria-pressed', String(audio.musicOn));
  dom.musicBtn.classList.toggle('is-off', !audio.musicOn);
}
dom.musicBtn.addEventListener('click', () => {
  audio.setMusic(!audio.musicOn);
  setMusicUi();
});

// ---------- joystick (touch) ----------------------------------------------

const JOY_RADIUS = 56;
let joyPointer = null;
function joyMove(event) {
  const rect = dom.joystick.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  let dx = event.clientX - cx;
  let dy = event.clientY - cy;
  const len = Math.hypot(dx, dy);
  if (len > JOY_RADIUS) {
    dx = (dx / len) * JOY_RADIUS;
    dy = (dy / len) * JOY_RADIUS;
  }
  dom.knob.style.transform = `translate(${dx}px, ${dy}px)`;
  let x = dx / JOY_RADIUS;
  let y = -dy / JOY_RADIUS;
  const dead = 0.14;
  if (Math.abs(x) < dead) x = 0;
  if (Math.abs(y) < dead) y = 0;
  controls?.setJoystick(x, y, true);
}
function joyEnd() {
  joyPointer = null;
  dom.knob.style.transform = 'translate(0, 0)';
  controls?.setJoystick(0, 0, false);
}
dom.joystick.addEventListener('pointerdown', (event) => {
  joyPointer = event.pointerId;
  dom.joystick.setPointerCapture(event.pointerId);
  joyMove(event);
});
dom.joystick.addEventListener('pointermove', (event) => {
  if (event.pointerId === joyPointer) joyMove(event);
});
dom.joystick.addEventListener('pointerup', (event) => {
  if (event.pointerId === joyPointer) joyEnd();
});
dom.joystick.addEventListener('pointercancel', joyEnd);

// ---------- start --------------------------------------------------------

function setFormError(message) {
  dom.error.textContent = message;
  dom.error.hidden = !message;
}

$('#love-count-input').addEventListener('input', () => setFormError(''));

dom.setup.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!renderer) return;
  const { loveOk, patch } = readForm();
  if (!loveOk) {
    setFormError('تعداد «دوستت دارم» باید یک عدد صحیح بین ۱ و ۹٬۹۹۹٬۹۹۹ باشد.');
    $('#love-count-input').focus();
    return;
  }
  setFormError('');
  const state = store.set(patch);
  audio.unlock();
  beginRescue(state);
});

function start(state) {
  started = true;
  audio.unlock();
  setMusicUi();

  dom.hudSub.textContent = `از طرف ${state.fromName} برای ${state.toName}`;
  renderLove(state.loveCount);
  if (world) world.setDedication(state.dedication);
  hero?.setDress(state.avatarColor);
  fillLetter(state);
  if (envelope) {
    const redraw = () => envelope.setNames(state.fromName, state.toName, letterParagraphs[1]);
    redraw();
  }

  // Glide from the intro view into the follow camera
  transition = { from: camera.position.clone(), elapsed: 0, duration: 1.6 };

  dom.intro.classList.add('is-leaving');
  dom.hud.hidden = false;
  dom.hint.hidden = coarse;
  dom.joystick.hidden = !coarse;
  window.setTimeout(() => {
    dom.intro.hidden = true;
  }, 900);
  toast(coarse ? 'با جوی‌استیک پایین صفحه حرکت کن' : 'با W A S D حرکت کن و با E نزدیک قاب‌ها بشو', 4200);
}

store.subscribe((state) => {
  if (world) world.setDedication(state.dedication);
});

// Plaque text: draw once fonts are ready so Persian renders correctly
if (world) {
  const draw = () => {
    world.setDedication(store.get().dedication);
    if (envelope) envelope.setNames(store.get().fromName, store.get().toName, letterParagraphs[1]);
  };
  document.fonts.ready.then(draw);
  document.fonts.load('800 96px "Vazirmatn Variable"').then(draw, draw);
}

// ---------- intro camera -------------------------------------------------

// The intro is a flight: the camera swoops down from high above the castle to the gate
// over INTRO_FLIGHT seconds of real time, then settles into the hover view.
const INTRO_FLIGHT = 8;
const INTRO_FROM = new THREE.Vector3(0, 42, 96);
const INTRO_TO_Z = 10.5;
const INTRO_LOOK_FROM = new THREE.Vector3(0, 18, 0);
const INTRO_LOOK_TO = new THREE.Vector3(0, 3.6, -2);

function easeInOutCubic(p) {
  return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}

function introCamera(t) {
  const p = Math.min(1, t / INTRO_FLIGHT);
  const e = easeInOutCubic(p);
  const hover = Math.sin(t * 0.14) * 0.9;
  const endX = Math.sin(hover) * 8.5;
  // A sweeping arc to the side while descending, then the gentle hover
  const arc = Math.sin(p * Math.PI) * -14;
  camera.position.set(
    THREE.MathUtils.lerp(0, endX, e) + arc,
    THREE.MathUtils.lerp(INTRO_FROM.y, 2.6, e) + Math.sin(t * 0.3) * 0.2 * e,
    THREE.MathUtils.lerp(INTRO_FROM.z, INTRO_TO_Z, e),
  );
  const look = INTRO_LOOK_FROM.clone().lerp(INTRO_LOOK_TO, e);
  camera.lookAt(look);
  return p;
}

// Fairy dust fades in during the flight and out once the game starts; the fairy with her letter flies the flight with the camera
function updateSparkles(t, dt, p) {
  const target = started ? 0 : Math.min(1, p * 2.5);
  introSparkleLevel += (target - introSparkleLevel) * Math.min(1, dt * 2.5);
  introSparkles?.update(t, dt, introSparkleLevel);
  introFairy?.update(t, dt, p, started, camera);
}

function updateIntro(t, dt) {
  const p = introCamera(t);
  if (pendingState && t > INTRO_FLIGHT + 1.2) {
    const s = pendingState;
    pendingState = null;
    start(s);
  }
  updateSparkles(t, dt, p);
  world.castle.setLit(p);

  if (!introFired && t > 2.6) {
    introFired = true;
    fx.show(9, 0.55);
  }
  if (!introReady && p >= 1) {
    introReady = true;
    world.castle.setLit(1);
    dom.intro.classList.add('is-ready');
    fx.show(5, 0.7);
  }
}

// ---------- resize & loop -------------------------------------------------

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (renderer) renderer.setSize(w, h, false);
}
window.addEventListener('resize', onResize);

const clock = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;
  if (!renderer) return;
  if (rescueActive) return; // the rescue game is on screen

  if (started) {
    controls.update(dt);
    if (transition) {
      transition.elapsed += dt;
      const k = Math.min(1, transition.elapsed / transition.duration);
      const e = k * k * (3 - 2 * k);
      const target = camera.position.clone();
      camera.position.lerpVectors(transition.from, target, e);
      if (k >= 1) transition = null;
    }
  } else if (introPlaying) {
    updateIntro(t - introT0, dt);
  } else {
    // Landing page: the castle stays still in its final view until the rescue is over
    if (!introSettled) {
      introSettled = true;
      dom.intro.classList.add('is-ready');
      world.castle.setLit(1);
    }
    introCamera(INTRO_FLIGHT);
  }
  if (started) updateSparkles(t, dt, 1);

  hero.animate(dt, t, started && controls.moving);
  cats?.update(dt, t, hero, started);
  syncCoupleUi();
  trail?.update(dt, hero.root.position, started && controls.moving, camera);
  footprints?.update(dt, hero, started && controls.moving);
  envelope.update(t, dt);
  world.update(t, dt, started ? nearFrame : -1);
  if (started) updatePrompt();

  renderer.render(scene, camera);
}

if (renderer) {
  world.setDedication(store.get().dedication);
  onResize();
  frame();
}

// Dev-only hook for automated checks
if (import.meta.env.DEV) {
  window.__home = { controls, camera, store, openMemory, openFinale, start: () => dom.setup.requestSubmit(), addLove, hero: () => hero, cats: () => cats, footprints: () => footprints };
}
