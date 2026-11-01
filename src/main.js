import '@fontsource-variable/vazirmatn';
import '@fontsource/lalezar/400.css';
import './style.css';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { allMemories, defaults, letterParagraphs } from './memories.js';
import { createStore, formatNumber } from './state.js';
import { buildWorld, LAYOUT } from './world.js';
import { createCouple } from './characters.js';
import { createEnvelope } from './envelope.js';
import { createControls, isSolid } from './controls.js';
import { createAudio } from './audio.js';
import { createFx } from './fx.js';
import { createTrail } from './trail.js';
import { createHouseSparkles } from './house-sparkles.js';
import { createFootprints } from './footprints.js';
import { createSparkles } from './castle.js';
import { createFairy } from './fairy.js';
import { composePostcard, canvasToBlob } from './postcard.js';
import { createRescueGame, showHowTo } from './rescue.js';
import { createCats } from './cats.js';
import { buildDecor, GARDEN_BENCH } from './decor.js';
import { createBouquet, buyLine, SHOP_EMPTY_LINE, flowerArmPose, ROSE_COLOURS } from './flower-shop.js';

const $ = (sel) => document.querySelector(sel);
const SWATCHES = [
  ['#ff758f', 'صورتی پرنسسی'],
  ['#ff9ebb', 'شکوفه رز'],
  ['#e27396', 'رز مخملی'],
  ['#c084fc', 'بنفش یاسی'],
  ['#ffd875', 'طلایی رویایی'],
];
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
  musicBtn: $('#music-btn'),
  holdBtn: $('#hold-btn'),
  danceBtn: $('#dance-btn'),
  prompt: $('#prompt'),
  promptLabel: $('#prompt-label'),
  promptBtn: $('#prompt-btn'),
  hint: $('#controls-hint'),
  joystick: $('#joystick'),
  curtain: $('#curtain'),
  jump: $('#jump-btn'),
  knob: $('#joystick-knob'),
  toast: $('#toast'),
  flash: $('#flash'),
  memory: $('#memory-dialog'),
  finale: $('#finale-dialog'),
  letter: $('#letter-dialog'),
  postcard: $('#postcard-dialog'),
  help: $('#help-dialog'),
  video: $('#video-dialog'),
  videoPlayer: $('#video-player'),
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
  return {
    patch: {
      fromName: $('#from-name').value,
      toName: $('#to-name').value,
      dedication: $('#dedication').value,
      anniversaryMsg: $('#anniversary-msg').value,
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

// If anything throws while the scene is being built, the canvas keeps the page background and the
// game looks "blank". Say so, rather than leaving a black screen with no explanation: the message
// names the failure, so a bug like this can be recognised (and reported) instead of guessed at.
let bootFailed = false;
function reportBootFailure(err) {
  if (bootFailed) return;
  bootFailed = true;
  if (dom.webgl) {
    dom.webgl.textContent = 'صحنه بالا نیامد. یک بار صفحه را نو کن؛ اگر باز هم همین‌طور بود، این خطا را بفرست: ' + (err && err.message ? err.message : String(err));
    dom.webgl.hidden = false;
  }
  if (dom.enter) dom.enter.disabled = true;
  console.error('[start-up]', err);
}
window.addEventListener('error', (e) => reportBootFailure(e.error || e.message));
window.addEventListener('unhandledrejection', (e) => reportBootFailure(e.reason));

const scene = new THREE.Scene();
// Portrait phones get a wider vertical FOV so the couple fits side by side
const camera = new THREE.PerspectiveCamera(
  window.innerWidth / window.innerHeight < 0.8 ? 66 : 55,
  window.innerWidth / window.innerHeight,
  0.1,
  220
);
let world = null;
let hero = null;
let photoTick = 0; // seconds since the room's photos were last checked for
let cats = null;
let decor = null;
let trail = null;
let houseSparkles = null;
let footprints = null;
let envelope = null;
let controls = null;
// Her bouquet, and how many roses she has bought. These belong up here with the other scene refs:
// syncBouquet() is called as soon as the couple exists, inside the start-up block, and reading a
// `let` declared further down throws "Cannot access before initialization" — one thrown error at
// start-up and the canvas never draws a frame, so the whole page came up blank.
// tests/startup-order.test.js checks that nothing the start-up block touches is declared below it.
let bouquet = null;
let rosesBought = 0;
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
let starting = false; // the curtain is falling before the tour starts
const introLook = new THREE.Vector3(); // where the intro camera looks, for the hand-off

function beginRescue() {
  rescueActive = true;
  dom.intro.hidden = true;
  rescue = createRescueGame({
    onDone: finishRescue,
    autoStart: true,
    onGate: () => {
      audio.startSong();
    },
  });
  if (import.meta.env.DEV) {
    window.__rescue = rescue;
    // Preview the win transition without playing the entire rescue (development only).
    if (new URLSearchParams(window.location.search).get('preview') === 'reveal') {
      rescue.state().phase = 'won';
      rescue.state().endT = 0;
    }
  }
}

function finishRescue(quick) {
  rescueActive = false;
  introPlaying = true;
  introFired = false;
  introReady = false;
  introT0 = clock.elapsedTime;
  dom.intro.classList.remove('is-ready');
  dom.intro.classList.add('flight-only');
  dom.intro.hidden = false;
  rescue.reveal(quick); // the night veil lifts into the castle flight
}

// Render scale the loop is allowed to fall back to when frames get slow.
// A slower GPU then draws fewer pixels instead of the video losing frames.
const MAX_SCALE = 1.5;
let qualityScale = MAX_SCALE;
let qualityCooldown = 0; // seconds to wait before lowering the scale again

if (renderer) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, qualityScale));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  world = buildWorld(scene, camera);
  introSparkles = createSparkles(scene);
  introFairy = createFairy(scene);
  hero = createCouple(store.get().avatarColor);
  syncBouquet(); // hangs her bouquet on her free arm (empty until she buys a rose)
  scene.add(hero.root);
  // Start in the garden, not at the origin: the origin is the middle of the door, and the couple sank into it before the walk began
  hero.root.position.copy(LAYOUT.spawn);
  // A soft studio reflection for the characters' glossy parts (hair, eyes, gold, shoes)
  const pmrem = new THREE.PMREMGenerator(renderer);
  hero.setEnvironment(pmrem.fromScene(new RoomEnvironment(), 0.04).texture);
  pmrem.dispose();
  cats = createCats(scene, hero, { frames: world.frames, butterflies: () => (decor ? decor.butterflies : []) });
  decor = buildDecor(scene, { hero });
  trail = createTrail(scene);
  houseSparkles = createHouseSparkles(scene);
  footprints = createFootprints(scene);

  envelope = createEnvelope(scene, {
    fromName: store.get().fromName,
    toName: store.get().toName,
    paragraph: letterParagraphs[1],
    audio,
    // each beat fires its own burst of light where the envelope is, so the opening is not silent
    onBeat: (beat) => {
      // a small spill of light at the seal as it gives, and a fuller one as the flap comes up
      const sx = window.innerWidth / 2;
      if (beat === 'break') fx.burst(sx, window.innerHeight * 0.47, '#ffd2c4', 6);
      if (beat === 'flap') fx.burst(sx, window.innerHeight * 0.44, '#ffe0b0', 22);
    },
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

// Finale
function openFinale() {
  const s = store.get();
  $('#finale-message').textContent = s.anniversaryMsg;
  $('#finale-title').textContent = 'اولین سالگرد یکی شدنمون مبارک!';
  openDialog(dom.finale);
  audio.fanfare();
  fx.show(7, 0.45);
}
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

// A camera move of its own, laid over the follow camera while the envelope opens or is being read.
let letterView = null;

// The reader opens in the same cream, the same border and the same font as the paper in 3D (see
// style.css), and it grows in from where the sheet sits in the hall rather than sliding up from the
// bottom of the screen, so the letter does not jump from a prop to a web page.
function openLetter({ fromScreen = false } = {}) {
  audio.chime(523.25);
  const dialog = dom.letter;
  dialog.dataset.fromPaper = fromScreen ? 'yes' : 'no';
  openDialog(dialog);
  if (fromScreen) {
    // The reader is over a sheet that is still in front of the camera; a quick lift into place, then
    // out of the way of the text.
    dialog.animate?.(
      [
        { transform: 'translateY(7vh) scale(0.5)', opacity: 0 },
        { transform: 'none', opacity: 1 },
      ],
      { duration: 460, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' }
    );
  }
}

// Bring the camera to the letter. The envelope offers a pose (`focus`) and this eases the real camera
// onto it: the same eased hand-off the intro uses, so the opening is a scene rather than something
// happening three metres away. The envelope itself never touches the camera.
function watchLetter() {
  if (!started || !envelope) return;
  // stop the walk: the stick is held outside the game loop, so it has to be let go of explicitly
  controls?.setJoystick(0, 0, false);
  // already coming in, or watching: nothing to do. On the way out, come back.
  if (letterView && letterView.phase !== 'out') return;
  const place = envelope.focus(window.innerWidth / Math.max(1, window.innerHeight));
  letterView = {
    phase: 'in',
    fromPos: camera.position.clone(),
    fromLook: controls ? controls.focus.clone() : place.look.clone(),
    toPos: place.from,
    toLook: place.look,
    seen: false, // has the reader been open yet?
    elapsed: 0,
    // the envelope's own opening takes 2.3 s, so the move is over before there is something to read
    duration: 1.7,
  };
}

function openEnvelope() {
  if (!envelope) return;
  if (envelope.isOpen) {
    // already opened once: come back to the letter and read it again
    watchLetter();
    openLetter({ fromScreen: true });
    return;
  }
  if (envelope.isBusy) return;
  watchLetter();
  envelope.open(() => {
    fx.burst(window.innerWidth / 2, window.innerHeight * 0.44, '#ffd98a', 30);
    decor?.celebrate();
    openLetter({ fromScreen: true });
  });
}

// Postcard
let postcardUrl = null;
let postcardBusy = false;
async function openPostcard() {
  if (!renderer || postcardBusy) return;
  postcardBusy = true;
  ['finale-dialog', 'memory-dialog', 'letter-dialog', 'help-dialog', 'video-dialog'].forEach((id) => closeDialog(document.getElementById(id)));
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
  if (world.video && nearVideoScreen()) {
    const videoHits = raycaster.intersectObject(world.video.screen, false);
    if (videoHits.length && videoHits[0].distance < VIDEO_RADIUS + 2) {
      openVideo();
      return;
    }
  }
  if (world.flowers && nearFlowerShop()) {
    const shopHits = raycaster.intersectObject(world.flowers.shop.group, true);
    if (shopHits.length && shopHits[0].distance < world.flowers.radius + 2.5) {
      buyFlower();
      return;
    }
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

let benchSeated = false;
function toggleBench() {
  if (!controls || !hero) return;
  benchSeated = !benchSeated;
  controls.setBenchSeated(benchSeated);
  hero.setSitting(benchSeated);
  if (benchSeated) {
    world.burstHearts(new THREE.Vector3(GARDEN_BENCH.x, 1.1, GARDEN_BENCH.z), 5);
    audio.chime(523.25);
    toast('یه لحظه‌ی آروم، فقط برای ما دوتا ❤️', 3500);
  } else {
    toast('دوباره بریم خونه‌مون رو بگردیم ✨', 2200);
  }
  updatePrompt();
}

let promptTarget = null;
// The clip in the photo room, played large on a panel (silent, like the clip itself).
// A short tap on the screen in the room opens it too, so a phone needs no keyboard.
const VIDEO_RADIUS = 3.0;
function nearVideoScreen() {
  if (!world || !controls) return false;
  return world.video.isNear(controls.position.x, controls.position.z, VIDEO_RADIUS);
}

let videoPanelTimer = 0;
function openVideo() {
  if (!world) return;
  window.clearTimeout(videoPanelTimer); // the panel may be reopening while it unloads
  const player = dom.videoPlayer;
  if (player.getAttribute('src') !== world.video.src) player.src = world.video.src;
  player.currentTime = 0;
  openDialog(dom.video);
  // The clip has no sound track: it stays muted so it can start on its own, on any phone.
  player.muted = true;
  const attempt = player.play();
  if (attempt && typeof attempt.catch === 'function') attempt.catch(() => {});
}

function closeVideoPanel() {
  const player = dom.videoPlayer;
  if (!player.paused) player.pause();
  window.clearTimeout(videoPanelTimer);
  // Drop the stream so the game world keeps the whole decoder to itself.
  videoPanelTimer = window.setTimeout(() => {
    player.removeAttribute('src');
    player.load();
  }, 400);
}

dom.video.addEventListener('close', closeVideoPanel);

// The walk to town: when the couple reaches the gate's doorstep, the town's own clock says hello
// once per visit, and they turn back for home.
const TOWN_RADIUS = 3.6;
let townVisited = false;
function checkTownWalk() {
  if (!world?.town || !controls || townVisited || benchSeated) return;
  const gate = world.town.gate;
  if (!controls.isNear(gate.x, gate.z, TOWN_RADIUS)) return;
  townVisited = true;
  const line = world.town.greeting();
  toast(line, 6500);
  world.burstHearts(new THREE.Vector3(gate.x, 1.4, gate.z), 6);
  audio.chime(659.25);
  // a breath later, the couple turns back toward the house — unless they came to the flower shop,
  // which stands on this same square: turning them round mid-purchase would be rude
  window.setTimeout(() => {
    const home = { x: 0, z: 12 };
    if (controls && !benchSeated && !nearFlowerShop()) controls.faceToward(home.x, home.z);
  }, 1400);
  window.setTimeout(() => {
    toast('برگردیم خونه؟ ✨', 3200);
    townVisited = false; // they may come back another time
  }, 9000);
}

// ---------- the flower shop at the end of the walk ------------------------

function nearFlowerShop() {
  if (!world?.flowers || !controls) return false;
  return world.flowers.isNear(controls.position.x, controls.position.z);
}

// The bouquet hangs off her free arm (the one on the side away from the boy), and the arm swings
// out to make room for it. Nothing here touches her dress: the roses sit in front of her shoulder.
function syncBouquet() {
  if (!hero) return;
  if (!bouquet) bouquet = createBouquet(hero.bouquetGroup);
  hero.setFlowerPose(Math.min(1, rosesBought / 3));
}

// Her flower arm's swing is folded into her own animation (see flowerArmPose and characters.js):
// one rose already takes the arm most of the way out of her side, so the stems never touch the
// dress. This only eases that pose in, so buying a rose does not snap her arm.
let bouquetPoseApplied = 0;
function updateBouquetPose(dt = 0.016) {
  if (!hero) return;
  const pose = flowerArmPose(rosesBought);
  const target = rosesBought > 0 ? Math.min(1, 0.55 + 0.45 * (rosesBought / 5)) : 0;
  bouquetPoseApplied += (target - bouquetPoseApplied) * Math.min(1, dt * 4);
  hero.setFlowerPose(bouquetPoseApplied);
  // the arm itself is posed in the walk cycle; the bouquet only needs its own steady tilt
  // the tilt always leans out to her side (negative), easing further out as the bouquet fills
  if (bouquet) bouquet.group.rotation.z = -0.3 - pose.sway * bouquetPoseApplied;
}

function buyFlower() {
  if (!world?.flowers) return;
  const result = world.flowers.shop.buy();
  if (result.index < 0) {
    toast(SHOP_EMPTY_LINE, 4000);
    return;
  }
  rosesBought += 1;
  syncBouquet();
  // the rose she keeps is the one she took off the counter: same colour, so the bunch ends up mixed
  const picked = ROSE_COLOURS[(result.index >= 0 ? result.index : 0) % ROSE_COLOURS.length];
  bouquet.add({ petalColor: picked.petal });
  toast(buyLine(rosesBought), 3200);
  audio.chime([523.25, 587.33, 659.25, 783.99, 880][Math.min(rosesBought, 5) - 1] || 880);
  world.burstHearts(new THREE.Vector3(world.flowers.centre.x, 1.5, world.flowers.centre.z + 0.4), 3);
  updatePrompt();
}

function updatePrompt() {
  if (!started || anyDialogOpen() || letterView) {
    dom.prompt.hidden = true;
    return;
  }
  nearFrame = nearestFrame();
  if (benchSeated || controls.isNear(GARDEN_BENCH.x, GARDEN_BENCH.z, 2.5)) {
    promptTarget = { type: 'bench' };
    dom.promptLabel.textContent = benchSeated ? 'بلند شدن' : 'کنار هم بشینیم';
  } else if (nearFlowerShop()) {
    promptTarget = { type: 'flowers' };
    const left = world.flowers.shop.remaining;
    dom.promptLabel.textContent = left > 0
      ? `خریدن گل (${formatNumber(left)} تا مانده)`
      : 'گل‌های فروخته‌شده';
  } else if (nearVideoScreen()) {
    promptTarget = { type: 'video' };
    dom.promptLabel.textContent = 'دیدن ویدیو بزرگ‌تر';
  } else if (nearFrame >= 0) {
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
  if (promptTarget.type === 'bench') {
    toggleBench();
  } else if (promptTarget.type === 'frame') {
    openMemory(promptTarget.index);
  } else if (promptTarget.type === 'envelope') {
    openEnvelope();
  } else if (promptTarget.type === 'video') {
    openVideo();
  } else if (promptTarget.type === 'flowers') {
    buyFlower();
  }
}
dom.promptBtn.addEventListener('click', interact);

window.addEventListener('keydown', (event) => {
  if (!started || anyDialogOpen()) return;
  if (letterView) return; // the letter has the camera: walk keys wait until it has let go
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
  if (benchSeated) { toast('برای رقص اول از نیمکت بلند شو ✨'); return; }
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

// Jump button for touch screens: one tap, one jump
dom.jump.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  controls?.jump();
});

// ---------- start --------------------------------------------------------

function setFormError(message) {
  dom.error.textContent = message;
  dom.error.hidden = !message;
}

  dom.setup.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!renderer || starting) return;
  const { patch } = readForm();
  setFormError('');
  const state = store.set(patch);
  audio.unlock();
  // Fall to a dark curtain first, so the camera's swing to the tour happens out of sight
  starting = true;
  dom.curtain.classList.add('is-on');
  window.setTimeout(() => {
    start(state);
    // Lift the curtain while the camera glides into the tour
    window.setTimeout(() => dom.curtain.classList.remove('is-on'), 200);
  }, 850);
});

function start(state) {
  started = true;
  townVisited = false;
  audio.unlock();
  setMusicUi();

  dom.hudSub.textContent = `از طرف ${state.fromName} برای ${state.toName}`;
  if (world) world.setDedication(state.dedication);
  hero?.setDress(state.avatarColor);
  fillLetter(state);
  if (envelope) {
    const redraw = () => envelope.setNames(state.fromName, state.toName, letterParagraphs[1]);
    redraw();
  }

  // Glide from the intro view into the follow camera: both the position and the look target
  transition = { from: camera.position.clone(), lookFrom: introLook.clone(), elapsed: 0, duration: 1.8 };

  dom.intro.classList.add('is-leaving');
  dom.hud.hidden = false;
  dom.hint.hidden = coarse;
  dom.joystick.hidden = !coarse;
  dom.jump.hidden = !coarse;
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
  document.fonts.load('400 84px "Lalezar"').then(draw, draw);
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
  introLook.copy(look);
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
  updateSparkles(t, dt, p);
  world.castle.setLit(p);

  if (!introFired && t > 2.6) {
    introFired = true;
    fx.show(9, 0.55);
  }
  if (!introReady && p >= 1) {
    introReady = true;
    world.castle.setLit(1);
    dom.intro.classList.remove('flight-only'); // the names form and enter button appear now
    dom.intro.classList.add('is-ready');
    fx.show(5, 0.7);
  }
}

// ---------- resize & loop -------------------------------------------------

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.fov = w / h < 0.8 ? 66 : 55;
  camera.updateProjectionMatrix();
  if (renderer) renderer.setSize(w, h, false); // setSize keeps the current pixel ratio
}
window.addEventListener('resize', onResize);

// ---------- adaptive resolution --------------------------------------------

const QUALITY_STEPS = [1.5, 1.25, 1, 0.8, 0.65];
let qualityStep = 0;
let slowTime = 0;
let fastTime = 0;

// Watch the frame rate and trade pixels for smoothness. It only steps down when frames are
// consistently slow (two seconds of them), and climbs back slowly once things are calm again.
function adaptQuality(dt) {
  if (dt <= 0) return;
  qualityCooldown = Math.max(0, qualityCooldown - dt);
  // A frame that took this long was a hitch (a tab switch, a decode), not a slow GPU.
  if (dt > 0.25) return;
  if (dt > 1 / 40) {
    slowTime += dt;
    fastTime = 0;
  } else if (dt < 1 / 52) {
    fastTime += dt;
    slowTime = 0;
  } else {
    slowTime = 0;
    fastTime = 0;
  }
  if (slowTime > 2 && qualityStep < QUALITY_STEPS.length - 1 && qualityCooldown === 0) {
    qualityStep += 1;
    qualityScale = QUALITY_STEPS[qualityStep];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, qualityScale));
    slowTime = 0;
    qualityCooldown = 4; // give the new scale time to show up in the timings
  } else if (fastTime > 8 && qualityStep > 0) {
    qualityStep -= 1;
    qualityScale = QUALITY_STEPS[qualityStep];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, qualityScale));
    fastTime = 0;
    qualityCooldown = 4;
  }
}

const clock = new THREE.Clock();
// The castle entrance, see buildWorld (the front doors are centred on this z)
const DOOR_Z = 0.12;
let lastDoorZ = null;

const grassBoyPosition = new THREE.Vector3();
const grassCatPositions = [new THREE.Vector3(), new THREE.Vector3()];
const grassActors = [];
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;
  if (!renderer) return;
  if (rescueActive) return; // the rescue game is on screen

  if (started) {
    // The letter's camera. While it is moving, or while the letter is open, the follow camera is not
    // asked for a view of its own: this is the one scene in the house that is watched, not walked
    // through. When the reader closes, the follow camera takes the view back with the same ease.
    if (!letterView || letterView.phase === 'out') controls.update(dt);
    // The letter's own clock is behind the camera's: it only starts when onOpened fires, so the wax
    // breaks before the camera has finished arriving and the paper comes out under it, not after it.
    if (started && envelope && !envelope.isOpen && !envelope.isBusy) envelope.update(t, dt);
    if (letterView) {
      const v = letterView;
      v.elapsed += dt;
      const k = Math.min(1, v.elapsed / v.duration);
      const e = k * k * (3 - 2 * k);
      if (v.phase === 'in') {
        camera.position.lerpVectors(v.fromPos, v.toPos, e);
        camera.lookAt(new THREE.Vector3().lerpVectors(v.fromLook, v.toLook, e));
        if (k >= 1) { v.phase = 'hold'; v.elapsed = 0; }
      } else if (v.phase === 'hold') {
        // Hold the pose we arrived at and wait for the reader to close. The reader only opens at the end
        // of the opening, which is after the camera has arrived, so "the dialog is not open yet" is not
        // the same as "the reader has been closed": the camera must wait until it has seen it open.
        camera.position.copy(v.toPos);
        camera.lookAt(v.toLook);
        if (dom.letter.open) v.seen = true;
        else if (v.seen) {
          v.phase = 'out';
          v.elapsed = 0;
          v.fromPos = camera.position.clone();
          v.fromLook = v.toLook.clone();
        }
      } else {
        // 'out': controls.update has just placed the follow camera, so ease from the held pose to it
        camera.position.lerpVectors(v.fromPos, camera.position.clone(), e);
        camera.lookAt(new THREE.Vector3().lerpVectors(v.fromLook, controls.focus, e));
        if (k >= 1) letterView = null;
      }
    }
    if (transition && !letterView) {
      transition.elapsed += dt;
      const k = Math.min(1, transition.elapsed / transition.duration);
      const e = k * k * (3 - 2 * k);
      // controls.update has just placed the follow camera; blend from the intro view to it
      const follow = camera.position.clone();
      camera.position.lerpVectors(transition.from, follow, e);
      camera.lookAt(new THREE.Vector3().lerpVectors(transition.lookFrom, controls.focus, e));
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

  if (started) world.updateDoors(dt, hero.root.position.x, hero.root.position.z);
  // The photo room's pictures and the room's clip download when the couple comes near them, not at
  // start-up: they used to all start at once, 4 MB of photo while the world was still being built.
  photoTick += dt;
  if (started && photoTick > 0.5) {
    photoTick = 0;
    world.photos.update({ x: hero.root.position.x, z: hero.root.position.z });
  }
  updateBouquetPose(dt);
  // The couple stands still while the letter is being opened and read, and so do the effects that
  // follow their feet: they follow the couple's movement, not the camera's.
  const frozen = !!letterView && letterView.phase !== 'out';
  const walking = started && controls.moving && !frozen;
  hero.animate(dt, t, walking, controls.airborne);
  cats?.update(dt, t, hero, started, benchSeated, { intro: introPlaying, doorOpen: world.frontDoorOpen });
  syncCoupleUi();
  trail?.update(dt, hero.root.position, walking, camera);
  houseSparkles?.update(dt, hero.root.position, walking);
  world?.rugGlint?.update(dt, t, hero.root.position, walking);
  world?.stoneGlint?.update(dt, t, hero.root.position, walking);
  footprints?.update(dt, hero, walking);
  envelope.update(t, dt);
  grassActors.length = 0;
  if (started) {
    grassActors.push(hero.root.position);
    const boy = hero.root.getObjectByName('boy');
    if (boy) grassActors.push(boy.getWorldPosition(grassBoyPosition));
    if (cats?.group.visible) cats.group.children.forEach((cat, i) => {
      if (i < grassCatPositions.length && cat.visible) grassActors.push(cat.getWorldPosition(grassCatPositions[i]));
    });
  }
  world.update(t, dt, started ? nearFrame : -1, started ? hero.root.position : null, grassActors);
  decor?.update(t, dt, hero.root.position, started && controls.moving, started && controls.airborne);
  // walking through the castle door: a crystal flash and petals
  if (started && !rescueActive) {
    const hz = hero.root.position.z;
    if (lastDoorZ !== null && Math.abs(hero.root.position.x) < LAYOUT.doorHalfWidth && (lastDoorZ - DOOR_Z) * (hz - DOOR_Z) < 0) {
      decor?.doorBurst();
    }
    lastDoorZ = hz;
  }
  if (started) updatePrompt();
  if (started) checkTownWalk();

  adaptQuality(dt);
  renderer.render(scene, camera);
}

if (renderer) {
  world.setDedication(store.get().dedication);
  onResize();
  frame();
}

// The how-to page opens first. Its start button begins the rescue straight away;
// the intro, then the names form and the enter button come after the rescue.
showHowTo({
  onStart() {
    audio.unlock();
    beginRescue();
  },
});

// Dev-only hook for automated checks
if (import.meta.env.DEV) {
  window.__home = { audio, controls, camera, isSolid, store, openMemory, openFinale, start: () => dom.setup.requestSubmit(), hero: () => hero, cats: () => cats, footprints: () => footprints };
}
