import * as THREE from 'three';
import * as TWEEN from '@tweenjs/tween.js';
import confetti from 'canvas-confetti';
import { museumDefaults, memories } from './memories.js';
import './style.css';

const $ = (selector) => document.querySelector(selector);
const canvas = $('#world');
const intro = $('#intro-screen');
const hud = $('#hud');
const setupForm = $('#setup-form');
const memoryOverlay = $('#memory-overlay');
const helpOverlay = $('#help-overlay');
const anniversaryOverlay = $('#anniversary-overlay');
const loveletterOverlay = $('#loveletter-overlay');
const polaroidOverlay = $('#polaroid-overlay');
const floatingHeartsLayer = $('#floating-hearts');

const dynamicTouchIndicator = $('#dynamic-touch-indicator');
const touchKnobInner = $('#dynamic-touch-indicator .touch-knob-inner');
const mobileTapMarker = $('#mobile-tap-marker');
const touchHintPill = $('#touch-hint-pill');

const storageKey = 'our-museum-gift-v7';
let saved = {};
try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch { saved = {}; }
const state = {
  fromName: saved.fromName || museumDefaults.fromName,
  toName: saved.toName || museumDefaults.toName,
  dedication: saved.dedication || museumDefaults.dedication,
  anniversaryMsg: saved.anniversaryMsg || museumDefaults.anniversaryText,
  loveCount: Number(saved.loveCount) || museumDefaults.loveCount,
  avatarColor: saved.avatarColor || '#ff758f',
};

// Form init
$('#from-name').value = state.fromName;
$('#to-name').value = state.toName;
$('#dedication').value = state.dedication;
if ($('#anniversary-msg')) $('#anniversary-msg').value = state.anniversaryMsg;
if ($('#initial-love-count')) $('#initial-love-count').value = state.loveCount;

document.querySelectorAll('.swatch').forEach((button) => {
  button.classList.toggle('is-selected', button.dataset.color === state.avatarColor);
});

// Sound synthesizer using Web Audio API
let audioCtx = null;
let musicPlaying = false;
let musicTimer = null;
let musicGain = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    musicGain = audioCtx.createGain();
    musicGain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    musicGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playRomanticChime(frequency = 587.33) {
  try {
    initAudio();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(frequency * 1.5, audioCtx.currentTime + 0.35);
    gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.75);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.8);
  } catch (e) {
    // Ignore audio errors
  }
}

function playCelebrationChord() {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, idx) => {
    setTimeout(() => playRomanticChime(freq), idx * 110);
  });
}

function playCameraShutterSound() {
  try {
    initAudio();
    const osc1 = audioCtx.createOscillator();
    const g1 = audioCtx.createGain();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.06);
    g1.gain.setValueAtTime(0.35, audioCtx.currentTime);
    g1.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
    osc1.connect(g1); g1.connect(audioCtx.destination);
    osc1.start(); osc1.stop(audioCtx.currentTime + 0.09);

    setTimeout(() => {
      if (!audioCtx) return;
      const osc2 = audioCtx.createOscillator();
      const g2 = audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1200, audioCtx.currentTime);
      osc2.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.08);
      g2.gain.setValueAtTime(0.28, audioCtx.currentTime);
      g2.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      osc2.connect(g2); g2.connect(audioCtx.destination);
      osc2.start(); osc2.stop(audioCtx.currentTime + 0.11);
    }, 70);
  } catch (e) {}
}

function playFireworkSound() {
  try {
    initAudio();
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1400, audioCtx.currentTime + 0.4);
    g.gain.setValueAtTime(0.12, audioCtx.currentTime);
    g.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 0.45);
    osc.connect(g); g.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + 0.46);

    setTimeout(() => {
      if (!audioCtx) return;
      const osc2 = audioCtx.createOscillator();
      const g2 = audioCtx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(140, audioCtx.currentTime);
      osc2.frequency.exponentialRampToValueAtTime(35, audioCtx.currentTime + 0.6);
      g2.gain.setValueAtTime(0.35, audioCtx.currentTime);
      g2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.7);
      osc2.connect(g2); g2.connect(audioCtx.destination);
      osc2.start(); osc2.stop(audioCtx.currentTime + 0.75);
    }, 380);
  } catch (e) {}
}

function playGrandPianoMelody() {
  try {
    initAudio();
    const chords = [
      [329.63, 392.00, 493.88, 659.25], // E minor / G
      [440.00, 523.25, 659.25, 880.00], // A minor
      [392.00, 493.88, 587.33, 783.99], // G major
      [523.25, 659.25, 783.99, 1046.50] // C / Anniversary resolution
    ];
    chords.forEach((chordGroup, cIdx) => {
      chordGroup.forEach((freq, nIdx) => {
        setTimeout(() => {
          if (!audioCtx) return;
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
          gain.gain.setValueAtTime(0.22, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.2);
          osc.connect(gain);
          gain.connect(audioCtx.destination);
          osc.start();
          osc.stop(audioCtx.currentTime + 1.25);
        }, (cIdx * 450) + (nIdx * 90));
      });
    });
  } catch (e) {}
}

function playWishingWellSplash() {
  try {
    initAudio();
    [783.99, 1046.50, 1318.51, 1567.98].forEach((freq, idx) => {
      setTimeout(() => {
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.65);
      }, idx * 80);
    });
  } catch (e) {}
}

// Procedural Romantic Piano Melody Generator
const romanticProgression = [
  [261.63, 329.63, 392.00, 523.25, 659.25],
  [196.00, 246.94, 293.66, 392.00, 493.88],
  [220.00, 261.63, 329.63, 440.00, 523.25],
  [174.61, 220.00, 261.63, 349.23, 440.00],
];

let progressionIndex = 0;
let noteIndex = 0;

function playPianoNote(freq, duration = 1.4) {
  if (!audioCtx || !musicPlaying) return;
  try {
    const osc = audioCtx.createOscillator();
    const noteGain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

    noteGain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

    osc.connect(noteGain);
    noteGain.connect(musicGain);

    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {
    // Ignore error
  }
}

function scheduleMusicStep() {
  if (!musicPlaying) return;
  const chord = romanticProgression[progressionIndex];
  const note = chord[noteIndex % chord.length];

  playPianoNote(note, 1.6);
  noteIndex++;
  if (noteIndex >= chord.length) {
    noteIndex = 0;
    progressionIndex = (progressionIndex + 1) % romanticProgression.length;
  }

  musicTimer = setTimeout(scheduleMusicStep, 480);
}

function toggleMusic() {
  initAudio();
  musicPlaying = !musicPlaying;
  const btn = $('#music-toggle-btn');
  if (musicPlaying) {
    btn?.classList.add('is-playing');
    scheduleMusicStep();
    showToast('🎵 موسیقی پیانو روشن شد');
  } else {
    btn?.classList.remove('is-playing');
    clearTimeout(musicTimer);
    showToast('موسیقی خاموش شد');
  }
}

function triggerConfetti(x = 0.5, y = 0.6) {
  try {
    confetti({
      particleCount: 85,
      spread: 85,
      origin: { x, y },
      colors: ['#ff4d6d', '#ffd875', '#ff758f', '#ffffff', '#e29578'],
      ticks: 200,
      gravity: 0.85,
      scalar: 1.15,
    });
  } catch (e) {
    // Ignore confetti errors
  }
}

function toPersianDigits(n) {
  const numStr = Number(n).toLocaleString('en-US');
  return numStr.replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
}

function updateLoveUI() {
  const formatted = toPersianDigits(state.loveCount);
  const hudCount = $('#hud-love-count');
  if (hudCount) hudCount.textContent = formatted;
  const annivStat = $('#anniv-love-stat');
  if (annivStat) annivStat.textContent = formatted;
  const modalText = $('#modal-love-text');
  if (modalText) modalText.textContent = `دوستت دارم (${formatted} بار)`;
  if (loveMonumentLabel) {
    loveMonumentLabel.material.map?.dispose();
    loveMonumentLabel.material.map = createLoveMonumentTexture();
    loveMonumentLabel.material.needsUpdate = true;
  }
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function triggerHeartFX(x, y, count = 1) {
  if (!floatingHeartsLayer) return;
  const emojis = ['❤️', '💖', '💕', '✨', '👑', '🌸', '🎀', '💎'];
  for (let i = 0; i < count; i++) {
    const el = document.createElement('span');
    el.className = 'floating-heart-particle';
    el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    const posX = x ?? (window.innerWidth / 2 + (Math.random() - 0.5) * 160);
    const posY = y ?? (window.innerHeight / 2 + (Math.random() - 0.5) * 100);
    el.style.left = `${posX}px`;
    el.style.top = `${posY}px`;
    el.style.setProperty('--dx', `${(Math.random() - 0.5) * 90}px`);
    el.style.setProperty('--rot', `${(Math.random() - 0.5) * 35}deg`);
    el.style.setProperty('--rot2', `${(Math.random() - 0.5) * 45}deg`);
    el.style.fontSize = `${18 + Math.random() * 16}px`;
    floatingHeartsLayer.appendChild(el);
    setTimeout(() => el.remove(), 1900);
  }
}

function addLoveCount(event) {
  state.loveCount += 1;
  updateLoveUI();
  playRomanticChime(659.25 + Math.random() * 200);
  const clientX = event?.clientX ?? window.innerWidth / 2;
  const clientY = event?.clientY ?? window.innerHeight / 2;
  triggerHeartFX(clientX, clientY, 4);
  triggerConfetti(clientX / window.innerWidth, clientY / window.innerHeight);
  showToast(`❤️ یک «دوستت دارم» دیگر به قلب پرنسسم رفت! (مجموعاً ${toPersianDigits(state.loveCount)} بار)`);
}

// Math and damping helpers
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const isMobileViewport = () => window.innerWidth < 700 || Boolean(window.matchMedia?.('(pointer: coarse)').matches && window.innerWidth < 1100);
const colorMaterial = (color, roughness = 0.6, metalness = 0.05) => new THREE.MeshStandardMaterial({ color, roughness, metalness });

function shortestAngleDiff(from, to) {
  const diff = (to - from) % (Math.PI * 2);
  return ((diff + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}
function lerpAngle(from, to, t) {
  return from + shortestAngleDiff(from, to) * t;
}

// Scene & Camera variables
let renderer, scene, camera, clock;
let player, companion;
let leftDoorPivot = null;
let rightDoorPivot = null;
let started = false;
let currentMemory = null;
let nearestMemory = null;
let nearestInteractable = null;

// Miniature Chibi Scale Factor
const MINI_SCALE = 0.68;

// Optimized Third-Person Camera State (Tailored for Miniature Character)
let cameraYaw = 0;
let targetYaw = 0;
let yawVelocity = 0;

let cameraPitch = 0.15;
let targetPitch = 0.15;
let pitchVelocity = 0;

let cameraDistance = 5.2;
let targetDistance = 5.2;

const cameraLookTarget = new THREE.Vector3(0, 0.95, 14);
const desiredCameraLook = new THREE.Vector3(0, 0.95, 14);

// Player physics state
const playerPosition = new THREE.Vector3(0, 0, 14);
const playerVelocity = new THREE.Vector3(0, 0, 0);
let playerTargetRot = 0;

let doorProgress = 0;
let doorTarget = 0;
let entryQueued = false;
let insideHouse = false;

// Cinematic Tour State
let isTouring = false;
let tourStep = 0;
let tourTimer = null;

// Dynamic On-Screen Touch / Drag Movement State
let touchMoveActive = false;
let touchMovePointerId = null;
let touchOriginX = 0;
let touchOriginY = 0;
let touchStartTime = 0;
let touchVector = new THREE.Vector2(0, 0);
let pointerMoved = false;

// Drag pointer for camera rotation
let isDraggingCamera = false;
let cameraDragPointerId = null;
let lastDragX = 0;
let lastDragY = 0;
let prevPinchDist = null;
let tapMarkerTimer = null;

let toastTimer = null;
let movementTarget = null;
let dedicationSign = null;
let anniversaryMantleSign = null;
let loveMonument = null;
let loveMonumentLabel = null;
let crystalHeartMesh = null;
let fireplaceLight = null;
let playerFollowLight = null;
let floatingParticleSystem = null;
const fairyBulbs = [];
const candleFlames = [];
const giantLetterHearts = [];
const activePointers = new Map();

// Couple Emotes & Poses State
let couplePose = 'normal'; // 'normal' | 'dance' | 'kiss' | 'holding_hands' | 'sitting'
let poseTimer = 0;

// Magic Footsteps State
const magicFootsteps = [];
let lastFootstepTime = 0;
let footstepToggle = false;

// Fireworks, Sky Lanterns & Meteors State
const activeFireworks = [];
const activeLanterns = [];
const activeMeteors = [];
let nextMeteorTime = 3.5;

const keys = new Set();
const frameTargets = [];
const frameRecords = [];
const interactiveTargets = [];
const floorTargets = [];
const pendingPhotoLoads = [];
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function createRenderer() {
  const mobile = isMobileViewport();
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !mobile,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
      precision: mobile ? 'mediump' : 'highp',
    });
  } catch (error) {
    console.error('WebGL could not be initialized:', error);
    showToast('این مرورگر امکان اجرای گرافیک سه‌بعدی را ندارد.');
    return false;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return true;
}

function addBox(parent, width, height, depth, material, x, y, z, options = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = options.castShadow !== false;
  mesh.receiveShadow = options.receiveShadow !== false;
  if (options.rotationY) mesh.rotation.y = options.rotationY;
  parent.add(mesh);
  return mesh;
}

function makeCanvasTexture(draw, width = 512, height = 256) {
  const canvasEl = document.createElement('canvas');
  canvasEl.width = width; canvasEl.height = height;
  const ctx = canvasEl.getContext('2d');
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvasEl);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = renderer ? Math.min(4, renderer.capabilities.getMaxAnisotropy()) : 1;
  return texture;
}

function createDedicationTexture() {
  return makeCanvasTexture((ctx, w, h) => {
    ctx.fillStyle = '#1c202d'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#ffd875'; ctx.lineWidth = 3; ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.strokeStyle = '#ff9ebb44'; ctx.lineWidth = 1; ctx.strokeRect(14, 14, w - 28, h - 28);
    ctx.fillStyle = '#ffd875'; ctx.font = '700 12px Georgia, serif'; ctx.textAlign = 'center'; ctx.direction = 'ltr';
    ctx.fillText('OUR 1ST ANNIVERSARY · 365 DAYS OF LOVE', w / 2, 24);
    ctx.fillStyle = '#fff4e0'; ctx.font = 'bold 22px Tahoma, Arial, sans-serif'; ctx.direction = 'rtl';
    ctx.fillText(`برایِ ${state.toName} عزیزم`, w / 2, 53, w - 36);
    ctx.fillStyle = '#d2c5ab'; ctx.font = '13.5px Tahoma, Arial, sans-serif';
    const words = state.dedication.split(/\s+/); const lines = [''];
    for (const word of words) {
      const current = lines[lines.length - 1];
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width > w - 56 && lines.length < 2) lines.push(word);
      else lines[lines.length - 1] = candidate;
    }
    ctx.fillText(lines[0] || 'تمامِ لحظه‌های ما', w / 2, 79, w - 42);
    if (lines[1]) ctx.fillText(lines[1], w / 2, 98, w - 42);
    ctx.fillStyle = '#ff8fa3'; ctx.font = 'italic 12px Georgia, serif'; ctx.direction = 'ltr';
    ctx.fillText(`Forever & Always, ${state.fromName} ♡`, w / 2, 127, w - 32);
  }, 512, 144);
}

function createAnniversaryMantleTexture() {
  return makeCanvasTexture((ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#2b1c26'); grad.addColorStop(0.5, '#481c32'); grad.addColorStop(1, '#2b1c26');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#ffd875'; ctx.lineWidth = 3.5; ctx.strokeRect(6, 6, w - 12, h - 12);
    ctx.strokeStyle = '#ff9ebb88'; ctx.lineWidth = 1; ctx.strokeRect(12, 12, w - 24, h - 24);

    ctx.fillStyle = '#ffd875'; ctx.font = 'bold 25px Tahoma, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.direction = 'rtl';
    ctx.fillText('✨ اولین سالگرد عشقمون مبارک ✨', w / 2, 42);

    ctx.fillStyle = '#fff0f4'; ctx.font = '700 16px Tahoma, Arial, sans-serif';
    ctx.fillText(`${state.fromName}  ❤️  ${state.toName}  (۳۶۵ روز عاشقی)`, w / 2, 73);

    ctx.fillStyle = '#ffd5de'; ctx.font = 'italic 12px Georgia, serif'; ctx.direction = 'ltr';
    ctx.fillText('Happy 1st Anniversary · Click to Celebrate', w / 2, 102);
  }, 512, 120);
}

function createLoveMonumentTexture() {
  return makeCanvasTexture((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(28, 16, 26, 0.9)';
    ctx.beginPath(); ctx.roundRect(10, 10, w - 20, h - 20, 24); ctx.fill();
    ctx.strokeStyle = '#ff4d6d'; ctx.lineWidth = 2.5; ctx.stroke();

    ctx.fillStyle = '#ff3366'; ctx.font = '22px Arial'; ctx.textAlign = 'center';
    ctx.fillText('❤️', 40, h / 2 + 8);

    ctx.fillStyle = '#ffeef2'; ctx.font = 'bold 18px Tahoma, Arial, sans-serif'; ctx.direction = 'rtl';
    ctx.fillText(`${toPersianDigits(state.loveCount)} بار گفتم دوستت دارم`, w / 2 + 10, h / 2 - 2);

    ctx.fillStyle = '#ff9ebb'; ctx.font = '11px Tahoma, Arial, sans-serif';
    ctx.fillText('برای ثبتِ دوستت دارم کلیک کن (یا ضربه بزن)', w / 2 + 10, h / 2 + 20);
  }, 440, 110);
}

function makeAbstractArtwork(memory, index) {
  const [tone1, tone2, tone3] = memory.palette;
  return makeCanvasTexture((ctx, w, h) => {
    const gradient = ctx.createLinearGradient(0, 0, w, h);
    gradient.addColorStop(0, tone1); gradient.addColorStop(1, tone2);
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#fff7e9'; ctx.beginPath(); ctx.arc(w * 0.78, h * 0.23, h * 0.13, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    const bands = [0.67, 0.76, 0.84];
    bands.forEach((height, j) => {
      ctx.beginPath();
      ctx.moveTo(0, h * height);
      ctx.bezierCurveTo(w * 0.22, h * (height - 0.13 - index * 0.006), w * 0.44, h * (height + 0.12), w * 0.66, h * (height - 0.06));
      ctx.bezierCurveTo(w * 0.82, h * (height - 0.16), w * 0.92, h * (height + 0.05), w, h * (height - 0.02));
      ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
      ctx.fillStyle = j === 0 ? tone3 : j === 1 ? '#6d7b76' : '#485255';
      ctx.globalAlpha = 0.46 - j * 0.07; ctx.fill(); ctx.globalAlpha = 1;
    });
    ctx.strokeStyle = '#fffaf0'; ctx.globalAlpha = 0.67; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(w * 0.39, h * 0.36, w * 0.22, h * 0.18, 7); ctx.stroke();
    ctx.beginPath(); ctx.arc(w * 0.5, h * 0.45, h * 0.045, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fffaf0'; ctx.font = 'bold 15px Tahoma, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.direction = 'rtl';
    ctx.fillText('خاطره‌ی دونفره', w / 2, h * 0.62);
    ctx.fillStyle = '#fffaf0a8'; ctx.font = '10px Arial, sans-serif'; ctx.direction = 'ltr';
    ctx.fillText(`1ST ANNIVERSARY · MEMORY ${String(index + 1).padStart(2, '0')}`, w / 2, h * 0.94);
  }, 600, 800);
}

function makePlaqueTexture(memory, index) {
  const fs = memory.frameStyle || {};
  const bg = fs.plaqueBg || '#221822';
  const border = fs.plaqueBorder || '#ffd875';
  return makeCanvasTexture((ctx, w, h) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = border; ctx.lineWidth = 2.5; ctx.strokeRect(9, 9, w - 18, h - 18);
    ctx.fillStyle = '#ff8fa3'; ctx.font = 'bold 13px Tahoma, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.direction = 'rtl';
    ctx.fillText(`خاطره‌ی عاشقیمون · ${toPersianDigits(index + 1)}`, w / 2, 32);
    ctx.fillStyle = '#fff8eb'; ctx.font = 'bold 24px Tahoma, Arial, sans-serif';
    ctx.fillText(memory.title, w / 2, 70);
  }, 512, 112);
}

// Procedural Nanaz Pastel Wall Texture with Victorian Floral Damask & Gold Paneling
function makeNanazWallTexture() {
  return makeCanvasTexture((ctx, w, h) => {
    // Elegant warm rose-tinted wallpaper
    const bgGrad = ctx.createLinearGradient(0, 0, w, h);
    bgGrad.addColorStop(0, '#2d1c28');
    bgGrad.addColorStop(0.5, '#382232');
    bgGrad.addColorStop(1, '#2a1a24');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle pinstripes & damask swirls
    ctx.strokeStyle = 'rgba(255, 216, 117, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 32) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }

    // Gold decorative boiserie moulding frame
    ctx.strokeStyle = 'rgba(255, 216, 117, 0.22)';
    ctx.lineWidth = 3;
    ctx.strokeRect(16, 16, w - 32, h - 32);

    // Cute corner swirls
    ctx.fillStyle = 'rgba(255, 143, 163, 0.18)';
    for (const [cx, cy] of [[32, 32], [w - 32, 32], [32, h - 32], [w - 32, h - 32]]) {
      ctx.beginPath(); ctx.arc(cx, cy, 12, 0, Math.PI * 2); ctx.fill();
    }
  }, 512, 512);
}

// Ultra-Nanaz 3D Frames (Multi-layered moulding, Ribbon Bow crest, Heart rosettes & Soft Halo)
function createFrame(memory, index, x, y, z, rotationY, width = 2.85, height = 3.65) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotationY;
  scene.add(group);

  const fs = memory.frameStyle || {
    frameColor: 0xd88a8a,
    matColor: 0xfff6f2,
    accentColor: 0xffd875,
    roughness: 0.25,
    metalness: 0.65,
  };

  const goldMat = colorMaterial(0xffd875, 0.2, 0.85);
  const roseGoldMat = colorMaterial(0xe88a9c, 0.25, 0.7);
  const matMat = colorMaterial(fs.matColor || 0xfff8f4, 0.85, 0.02);
  const darkBack = colorMaterial(0x16121a, 0.5);
  const rubyMat = new THREE.MeshBasicMaterial({ color: 0xff2a5c });
  const pearlMat = new THREE.MeshBasicMaterial({ color: 0xfff6ee });

  // Soft Ambient Glow Halo behind frame
  const haloMat = new THREE.MeshBasicMaterial({ color: 0xffccd5, transparent: true, opacity: 0.28 });
  const haloMesh = new THREE.Mesh(new THREE.PlaneGeometry(width + 0.55, height + 0.55), haloMat);
  haloMesh.position.set(0, 0, -0.04);
  group.add(haloMesh);

  // Backing & Shadow
  addBox(group, width + 0.18, height + 0.18, 0.12, darkBack, 0, 0, -0.02, { castShadow: true, receiveShadow: false });

  // Main Outer Bevel Moulding
  addBox(group, width, height, 0.11, goldMat, 0, 0, 0.04);

  // Inner Rose Gold Moulding
  addBox(group, width - 0.16, height - 0.16, 0.08, roseGoldMat, 0, 0, 0.07);

  // Inner Mat
  const matMargin = 0.28;
  addBox(group, width - matMargin, height - matMargin, 0.05, matMat, 0, 0, 0.09, { castShadow: false });

  // Custom Cute Ribbon Bow on Top Crest of Every Frame
  const halfW = width / 2;
  const halfH = height / 2;

  const bowGroup = new THREE.Group();
  bowGroup.position.set(0, halfH + 0.14, 0.11);
  const bowCenter = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 8), rubyMat);
  bowGroup.add(bowCenter);
  for (const sx of [-1, 1]) {
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.035, 6, 12), roseGoldMat);
    loop.position.set(sx * 0.11, 0.02, 0);
    loop.rotation.y = sx * 0.3;
    bowGroup.add(loop);
    const streamer = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.28, 0.02), roseGoldMat);
    streamer.position.set(sx * 0.08, -0.16, 0.01);
    streamer.rotation.z = sx * -0.25;
    bowGroup.add(streamer);
  }
  group.add(bowGroup);

  // Corner Heart & Pearl Studs
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      const rosette = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), rubyMat);
      rosette.position.set(sx * (halfW - 0.12), sy * (halfH - 0.12), 0.12);
      group.add(rosette);

      const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 6), pearlMat);
      pearl.position.set(sx * (halfW - 0.12), sy * (halfH - 0.12), 0.15);
      group.add(pearl);
    }
  }

  // Large Artwork Plane
  const artWidth = width - 0.48;
  const artHeight = height - 0.58;
  const artTexture = makeAbstractArtwork(memory, index);
  const artMat = new THREE.MeshBasicMaterial({ map: artTexture, side: THREE.DoubleSide });
  const art = new THREE.Mesh(new THREE.PlaneGeometry(artWidth, artHeight), artMat);
  art.position.set(0, 0, 0.125);
  art.userData.memory = memory;
  art.userData.index = index;
  art.userData.isFrame = true;
  group.add(art);

  if (memory.imageSrc) {
    const loader = new THREE.TextureLoader();
    loader.load(
      memory.imageSrc,
      (loadedTexture) => {
        loadedTexture.colorSpace = THREE.SRGBColorSpace;
        loadedTexture.minFilter = THREE.LinearMipmapLinearFilter;
        loadedTexture.magFilter = THREE.LinearFilter;
        loadedTexture.generateMipmaps = true;
        art.material.map = loadedTexture;
        art.material.needsUpdate = true;
      },
      undefined,
      (err) => {
        console.warn(`Could not load memory image: ${memory.imageSrc}`, err);
      }
    );
  }
  frameTargets.push(art);

  // Dedicated Sconce with glowing bulb
  const sconceGroup = new THREE.Group();
  sconceGroup.position.set(0, halfH + 0.38, 0.18);
  const sconceArm = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.22, 6), roseGoldMat);
  sconceArm.rotation.x = Math.PI / 3; sconceGroup.add(sconceArm);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.12, 8), goldMat);
  shade.rotation.x = Math.PI / 2; shade.position.set(0, 0.07, 0.09); sconceGroup.add(shade);
  const bulbGlow = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffeaae }));
  bulbGlow.position.set(0, 0.07, 0.12); sconceGroup.add(bulbGlow);
  group.add(sconceGroup);

  // Plaque Below Frame
  const plaqueWidth = Math.max(width - 0.05, 2.3);
  addBox(group, plaqueWidth + 0.06, 0.54, 0.08, roseGoldMat, 0, -halfH - 0.40, 0.015, { castShadow: false });
  const plaqueTex = makePlaqueTexture(memory, index);
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(plaqueWidth, 0.46), new THREE.MeshBasicMaterial({ map: plaqueTex }));
  plaque.position.set(0, -halfH - 0.40, 0.065);
  group.add(plaque);

  frameRecords.push({ memory, index, x, z, rotationY, group, art });
  return group;
}

function createSpriteLabel(text, accent = '#ffd875') {
  const texture = makeCanvasTexture((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(28, 18, 26, 0.88)'; ctx.beginPath(); ctx.roundRect(12, 18, w - 24, h - 36, 24); ctx.fill();
    ctx.strokeStyle = '#ffd875'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(48, h / 2, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff4f6'; ctx.font = 'bold 30px Tahoma, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.direction = 'rtl';
    ctx.fillText(text, w / 2 + 12, h / 2 + 10, w - 110);
  }, 512, 112);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set(1.45, 0.34, 1);
  sprite.renderOrder = 4;
  return sprite;
}

// --- High-Resolution Expressive Anime / Chibi Face Textures ---
function createPrincessFaceTexture(skinHex = '#ffe5d9') {
  return makeCanvasTexture((ctx, w, h) => {
    // Fill base skin tone
    ctx.fillStyle = typeof skinHex === 'number' ? `#${skinHex.toString(16).padStart(6, '0')}` : skinHex;
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2 + 10;

    // Airbrushed Soft Rosy Cheeks (Blush)
    for (const [bx, by] of [[cx - 105, cy + 28], [cx + 105, cy + 28]]) {
      const blushGrad = ctx.createRadialGradient(bx, by, 4, bx, by, 58);
      blushGrad.addColorStop(0, 'rgba(255, 80, 125, 0.68)');
      blushGrad.addColorStop(0.5, 'rgba(255, 120, 150, 0.35)');
      blushGrad.addColorStop(1, 'rgba(255, 140, 160, 0)');
      ctx.fillStyle = blushGrad;
      ctx.beginPath();
      ctx.arc(bx, by, 58, 0, Math.PI * 2);
      ctx.fill();

      // Cute blush sparkle marks (✨ / ✦)
      ctx.fillStyle = 'rgba(255, 245, 248, 0.95)';
      ctx.font = 'bold 18px Arial';
      ctx.fillText('✦', bx - 12, by - 8);
      ctx.font = 'bold 13px Arial';
      ctx.fillText('✦', bx + 16, by + 10);
    }

    // --- Sparkling Anime Princess Eyes ---
    const eyeSpacing = 82;
    const eyeY = cy - 20;
    const eyeW = 46;
    const eyeH = 60;

    for (const eyeX of [cx - eyeSpacing, cx + eyeSpacing]) {
      const isLeft = eyeX < cx;

      // Eye sclera (soft white base)
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(eyeX, eyeY, eyeW, eyeH, 0, 0, Math.PI * 2);
      ctx.clip();

      ctx.fillStyle = '#fffaff';
      ctx.fillRect(eyeX - eyeW - 10, eyeY - eyeH - 10, eyeW * 2 + 20, eyeH * 2 + 20);

      // Gradient Iris (Deep Berry Rose / Amber Chocolate)
      const irisGrad = ctx.createLinearGradient(eyeX, eyeY - eyeH, eyeX, eyeY + eyeH);
      irisGrad.addColorStop(0, '#2b0c18');
      irisGrad.addColorStop(0.35, '#5c1a32');
      irisGrad.addColorStop(0.7, '#c92a58');
      irisGrad.addColorStop(1, '#ff758f');

      ctx.fillStyle = irisGrad;
      ctx.beginPath();
      ctx.ellipse(eyeX, eyeY + 4, eyeW - 6, eyeH - 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Deep dark pupil
      ctx.fillStyle = '#1a0610';
      ctx.beginPath();
      ctx.ellipse(eyeX, eyeY - 2, 20, 26, 0, 0, Math.PI * 2);
      ctx.fill();

      // Inner glowing crescent
      ctx.fillStyle = 'rgba(255, 182, 193, 0.55)';
      ctx.beginPath();
      ctx.arc(eyeX, eyeY + 22, 19, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.fill();

      // Main big glossy highlight (top-left)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(eyeX - (isLeft ? 13 : 9), eyeY - 16, 14, 18, -0.2, 0, Math.PI * 2);
      ctx.fill();

      // Secondary star/heart sparkle (bottom-right)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.beginPath();
      ctx.arc(eyeX + (isLeft ? 12 : 14), eyeY + 16, 7.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(eyeX - 8, eyeY + 24, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Upper Eyeliner & Curled Eyelashes
      ctx.strokeStyle = '#200c16';
      ctx.lineWidth = 7.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(eyeX, eyeY - 4, eyeW + 2, Math.PI * 1.08, Math.PI * 1.92);
      ctx.stroke();

      // Curled eyelash flicks
      const flickDir = isLeft ? -1 : 1;
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(eyeX + flickDir * (eyeW - 4), eyeY - 24);
      ctx.quadraticCurveTo(
        eyeX + flickDir * (eyeW + 16), eyeY - 36,
        eyeX + flickDir * (eyeW + 22), eyeY - 42
      );
      ctx.stroke();

      // Delicate Eyebrows
      ctx.strokeStyle = '#5c3326';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.arc(eyeX, eyeY - 56, 40, Math.PI * 1.18, Math.PI * 1.82);
      ctx.stroke();
    }

    // Cute Subtle Nose Shading
    ctx.fillStyle = 'rgba(216, 120, 110, 0.45)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 24, 4.5, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Sweet Smiling Mouth with Pink Gloss
    ctx.strokeStyle = '#b82a4a';
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy + 46, 20, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    // Soft Lip Tint
    ctx.fillStyle = 'rgba(255, 100, 130, 0.35)';
    ctx.beginPath();
    ctx.arc(cx, cy + 48, 15, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.fill();
  }, 512, 512);
}

function createCompanionFaceTexture(skinHex = '#ecd4c2') {
  return makeCanvasTexture((ctx, w, h) => {
    // Fill base skin color
    ctx.fillStyle = typeof skinHex === 'number' ? `#${skinHex.toString(16).padStart(6, '0')}` : skinHex;
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2 + 10;

    // Gentle Warm Peach Blush
    for (const [bx, by] of [[cx - 100, cy + 28], [cx + 100, cy + 28]]) {
      const blushGrad = ctx.createRadialGradient(bx, by, 4, bx, by, 48);
      blushGrad.addColorStop(0, 'rgba(240, 105, 105, 0.45)');
      blushGrad.addColorStop(0.6, 'rgba(240, 135, 125, 0.2)');
      blushGrad.addColorStop(1, 'rgba(240, 135, 125, 0)');
      ctx.fillStyle = blushGrad;
      ctx.beginPath();
      ctx.arc(bx, by, 48, 0, Math.PI * 2);
      ctx.fill();
    }

    // --- Handsome Anime / Chibi Eyes ---
    const eyeSpacing = 82;
    const eyeY = cy - 20;
    const eyeW = 44;
    const eyeH = 54;

    for (const eyeX of [cx - eyeSpacing, cx + eyeSpacing]) {
      const isLeft = eyeX < cx;

      ctx.save();
      ctx.beginPath();
      ctx.ellipse(eyeX, eyeY, eyeW, eyeH, 0, 0, Math.PI * 2);
      ctx.clip();

      ctx.fillStyle = '#fffaff';
      ctx.fillRect(eyeX - eyeW - 10, eyeY - eyeH - 10, eyeW * 2 + 20, eyeH * 2 + 20);

      // Gradient Iris (Deep Warm Amber / Mocha)
      const irisGrad = ctx.createLinearGradient(eyeX, eyeY - eyeH, eyeX, eyeY + eyeH);
      irisGrad.addColorStop(0, '#1c1514');
      irisGrad.addColorStop(0.4, '#38221b');
      irisGrad.addColorStop(0.8, '#7a4531');
      irisGrad.addColorStop(1, '#a66848');

      ctx.fillStyle = irisGrad;
      ctx.beginPath();
      ctx.ellipse(eyeX, eyeY + 2, eyeW - 6, eyeH - 4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Pupil
      ctx.fillStyle = '#0f0a09';
      ctx.beginPath();
      ctx.ellipse(eyeX, eyeY - 2, 18, 24, 0, 0, Math.PI * 2);
      ctx.fill();

      // Glossy specular highlight
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(eyeX - (isLeft ? 12 : 8), eyeY - 14, 12, 15, -0.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(eyeX + (isLeft ? 10 : 12), eyeY + 14, 6.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Upper Eyeliner
      ctx.strokeStyle = '#181210';
      ctx.lineWidth = 6.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(eyeX, eyeY - 2, eyeW + 2, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();

      // Handsome Defined Eyebrows
      ctx.strokeStyle = '#281a16';
      ctx.lineWidth = 5.2;
      ctx.beginPath();
      ctx.moveTo(eyeX - (isLeft ? 36 : 32), eyeY - 46);
      ctx.quadraticCurveTo(eyeX, eyeY - 58, eyeX + (isLeft ? 32 : 36), eyeY - 48);
      ctx.stroke();
    }

    // Subtle Nose
    ctx.fillStyle = 'rgba(180, 110, 90, 0.4)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 24, 4.2, 3.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Charming Confident Smile
    ctx.strokeStyle = '#7a3228';
    ctx.lineWidth = 4.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy + 46, 18, 0.12 * Math.PI, 0.88 * Math.PI);
    ctx.stroke();
  }, 512, 512);
}

// Gorgeous High-Quality Chibi Princess Avatar in Royal Silk Ballgown
function createPrincessAvatar(options = {}) {
  const root = new THREE.Group();
  const rig = new THREE.Group(); root.add(rig);

  const skinColor = options.skin || 0xffe5d9;
  const skin = colorMaterial(skinColor, 0.65);
  const dressPink = colorMaterial(options.shirt || state.avatarColor || 0xff758f, 0.32, 0.18); // Shimmering Royal Satin
  const dressAccentPink = colorMaterial(0xfff0f4, 0.55, 0.05); // Scalloped Lace / Chiffon
  const goldTrim = colorMaterial(0xffd875, 0.22, 0.88);
  const pearlMat = colorMaterial(0xffffff, 0.15, 0.9);
  const hairMat = colorMaterial(options.hair || 0x2a1a15, 0.45, 0.15); // Glossy Brunette / Chocolate
  const rubyGem = new THREE.MeshBasicMaterial({ color: 0xff2a5c });

  // --- Voluminous Princess Ballgown Skirt (Smooth 32-segment Geometry) ---
  const skirtGroup = new THREE.Group();
  skirtGroup.position.y = 0.98;
  rig.add(skirtGroup);

  // Main Voluminous Bell Skirt
  const mainSkirtGeom = new THREE.CylinderGeometry(0.26, 0.86, 1.02, 32);
  const mainSkirt = new THREE.Mesh(mainSkirtGeom, dressPink);
  mainSkirt.position.y = -0.50;
  mainSkirt.castShadow = true;
  skirtGroup.add(mainSkirt);

  // Bottom Ruffled Lace Tier (Petticoat peeking at hem)
  const skirtHem = new THREE.Mesh(new THREE.CylinderGeometry(0.84, 0.91, 0.15, 32), dressAccentPink);
  skirtHem.position.y = -0.96;
  skirtHem.castShadow = true;
  skirtGroup.add(skirtHem);

  // Gold Trim Ribbon along skirt hem
  const hemGoldRing = new THREE.Mesh(new THREE.TorusGeometry(0.89, 0.016, 8, 32), goldTrim);
  hemGoldRing.rotation.x = Math.PI / 2;
  hemGoldRing.position.y = -0.89;
  skirtGroup.add(hemGoldRing);

  // Big Princess Silk Ribbon Bow at the back of waist
  const bowGroup = new THREE.Group();
  bowGroup.position.set(0, 1.02, 0.28);
  const bowCenter = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 12), rubyGem);
  bowGroup.add(bowCenter);
  for (const sx of [-1, 1]) {
    const bowLoop = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.038, 8, 16), dressPink);
    bowLoop.position.set(sx * 0.11, 0.02, 0);
    bowLoop.rotation.y = sx * 0.3;
    bowGroup.add(bowLoop);
    const streamer = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.44, 0.02), dressPink);
    streamer.position.set(sx * 0.08, -0.22, 0.02);
    streamer.rotation.z = sx * -0.22;
    bowGroup.add(streamer);
  }
  rig.add(bowGroup);

  // --- Bodice & Sweetheart Corset ---
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.48, 8, 24), dressPink);
  torso.position.y = 1.34;
  torso.castShadow = true;
  rig.add(torso);

  // Gold Corset Filigree & Sweetheart neckline trim
  const waistGoldBand = new THREE.Mesh(new THREE.TorusGeometry(0.245, 0.016, 8, 24), goldTrim);
  waistGoldBand.rotation.x = Math.PI / 2;
  waistGoldBand.position.set(0, 1.05, 0);
  rig.add(waistGoldBand);

  const neckline = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.016, 8, 24), goldTrim);
  neckline.rotation.x = Math.PI / 2.2;
  neckline.position.set(0, 1.62, -0.15);
  neckline.castShadow = true;
  rig.add(neckline);

  // Pearl Necklace Choker with Heart Pendant
  const choker = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.012, 8, 24), pearlMat);
  choker.rotation.x = Math.PI / 2;
  choker.position.set(0, 1.76, -0.01);
  rig.add(choker);

  const heartPendant = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 10), rubyGem);
  heartPendant.position.set(0, 1.72, -0.13);
  rig.add(heartPendant);

  // Hidden legs inside gown for smooth foot steps
  const leftLeg = new THREE.Group(); leftLeg.position.set(-0.11, 0.65, 0); rig.add(leftLeg);
  const rightLeg = new THREE.Group(); rightLeg.position.set(0.11, 0.65, 0); rig.add(rightLeg);
  for (const leg of [leftLeg, rightLeg]) {
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.22), goldTrim);
    shoe.position.set(0, -0.62, -0.04);
    shoe.castShadow = true;
    leg.add(shoe);
  }

  // --- Delicate Princess Arms with Puffy Off-shoulder Sleeves ---
  const leftArm = new THREE.Group(); leftArm.position.set(-0.30, 1.54, 0); rig.add(leftArm);
  const rightArm = new THREE.Group(); rightArm.position.set(0.30, 1.54, 0); rig.add(rightArm);
  for (const arm of [leftArm, rightArm]) {
    // Puffy Sleeve Cap
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 12), dressAccentPink);
    puff.scale.set(1.1, 0.9, 1.1);
    arm.add(puff);

    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.40, 6, 14), dressPink);
    sleeve.position.y = -0.24; sleeve.rotation.z = arm === leftArm ? -0.06 : 0.06; sleeve.castShadow = true; arm.add(sleeve);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.072, 12, 10), skin);
    hand.position.y = -0.52; hand.castShadow = true; arm.add(hand);
  }

  // --- High-Resolution Princess Head & Sparkling Anime Face ---
  const head = new THREE.Group(); head.position.set(0, 2.06, 0); rig.add(head);

  // Smooth Base Head Sphere (32x24 segments)
  const faceGeom = new THREE.SphereGeometry(0.24, 32, 24);
  const faceMesh = new THREE.Mesh(faceGeom, skin);
  faceMesh.scale.set(0.93, 1.02, 0.93);
  faceMesh.castShadow = true;
  head.add(faceMesh);

  // High-Res Face Texture Shell (Seamless crystal-clear anime eyes, blush & smile)
  const faceTex = createPrincessFaceTexture(skinColor);
  const faceShellGeom = new THREE.SphereGeometry(0.242, 32, 24, -Math.PI * 0.42, Math.PI * 0.84, Math.PI * 0.18, Math.PI * 0.64);
  const faceShellMat = new THREE.MeshBasicMaterial({ map: faceTex, transparent: true, side: THREE.DoubleSide });
  const faceShell = new THREE.Mesh(faceShellGeom, faceShellMat);
  faceShell.scale.set(0.93, 1.02, 0.93);
  head.add(faceShell);

  // --- Layered Chibi Anime Hair (Voluminous Cap, Front Bangs & Side Curls) ---
  // Main Hair Cap
  const hairCapGeom = new THREE.SphereGeometry(0.258, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.60);
  const hairCap = new THREE.Mesh(hairCapGeom, hairMat);
  hairCap.position.y = 0.04;
  hairCap.castShadow = true;
  head.add(hairCap);

  // Voluminous Back Hair cascading down
  const backHair = new THREE.Mesh(new THREE.SphereGeometry(0.265, 20, 18), hairMat);
  backHair.scale.set(1.12, 1.72, 0.78);
  backHair.position.set(0, -0.22, 0.08);
  backHair.castShadow = true;
  head.add(backHair);

  // Layered Sculpted Bangs across Forehead (5 curved locks)
  for (let i = -2; i <= 2; i++) {
    const ang = i * 0.22;
    const lockLen = i === 0 ? 0.16 : 0.20;
    const lock = new THREE.Mesh(new THREE.ConeGeometry(0.042, lockLen, 8), hairMat);
    lock.rotation.z = -ang * 0.8;
    lock.rotation.x = Math.PI * 0.88;
    lock.position.set(Math.sin(ang) * 0.18, 0.12 - Math.abs(i) * 0.02, -0.19 - Math.cos(ang) * 0.04);
    lock.castShadow = true;
    head.add(lock);
  }

  // Cascading Side Locks over shoulders
  for (const side of [-1, 1]) {
    const sideLock = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.58, 6, 14), hairMat);
    sideLock.position.set(side * 0.22, -0.28, -0.04);
    sideLock.rotation.z = side * -0.12;
    sideLock.castShadow = true;
    head.add(sideLock);

    // Pearl Earring
    const earring = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), pearlMat);
    earring.position.set(side * 0.24, -0.04, -0.04);
    head.add(earring);
  }

  // --- Sparkling Golden Princess Crown / Tiara ---
  const tiaraGroup = new THREE.Group();
  tiaraGroup.position.set(0, 0.26, -0.02);
  const crownBase = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.016, 8, 24), goldTrim);
  crownBase.rotation.x = Math.PI / 2;
  tiaraGroup.add(crownBase);

  // 5 jeweled points of the crown
  for (let i = -2; i <= 2; i++) {
    const angle = i * 0.24;
    const ptHeight = i === 0 ? 0.22 : Math.abs(i) === 1 ? 0.16 : 0.11;
    const crownSpike = new THREE.Mesh(new THREE.ConeGeometry(0.032, ptHeight, 6), goldTrim);
    crownSpike.position.set(Math.sin(angle) * 0.18, ptHeight / 2 + 0.01, -Math.cos(angle) * 0.18);
    tiaraGroup.add(crownSpike);

    // Gem on crown peak
    const gem = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), i === 0 ? rubyGem : pearlMat);
    gem.position.set(Math.sin(angle) * 0.18, ptHeight + 0.02, -Math.cos(angle) * 0.18);
    tiaraGroup.add(gem);
  }
  head.add(tiaraGroup);

  const label = createSpriteLabel(options.name || 'پرنسس من', '#ffd875');
  label.position.y = 2.82; rig.add(label);

  // Soft personal glow on the princess
  playerFollowLight = new THREE.PointLight(0xfff0e4, 1.8, 8.0, 2);
  playerFollowLight.position.set(0, 2.2, 0.5);
  root.add(playerFollowLight);

  // Apply Miniature Chibi Scale
  root.scale.set(MINI_SCALE, MINI_SCALE, MINI_SCALE);

  root.userData = {
    rig, leftLeg, rightLeg, leftArm, rightArm, head, skirtGroup, bowGroup, label,
    shirtMaterial: dressPink, phase: Math.random() * 6.28
  };
  root.traverse((obj) => { if (obj.isMesh) { obj.castShadow = true; if (obj.geometry.type !== 'PlaneGeometry') obj.receiveShadow = true; } });
  return root;
}

// Handsome High-Quality Chibi Companion Avatar in Tailored Royal Suit
function createCompanionAvatar(options = {}) {
  const root = new THREE.Group();
  const rig = new THREE.Group(); root.add(rig);

  const skinColor = options.skin || 0xecd4c2;
  const skin = colorMaterial(skinColor, 0.68);
  const suitMat = colorMaterial(options.shirt || 0x1e1c26, 0.50, 0.12); // Tailored Midnight Velvet
  const shirtWhite = colorMaterial(0xffffff, 0.40);
  const goldTrim = colorMaterial(0xffd875, 0.22, 0.85);
  const bowTieMat = colorMaterial(0x8a1c2f, 0.35, 0.2); // Burgundy Silk Bow Tie
  const pantsMat = colorMaterial(0x18161f, 0.70);
  const shoeMat = colorMaterial(0x121016, 0.25, 0.4); // Polished Leather
  const hairMat = colorMaterial(options.hair || 0x241b18, 0.45, 0.10); // Stylish Espresso / Dark Mocha
  const roseRed = new THREE.MeshBasicMaterial({ color: 0xff2a5c });
  const leafGreen = colorMaterial(0x2d4c38, 0.85);

  const hips = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.34, 16), pantsMat);
  hips.position.y = 0.78; hips.castShadow = true; rig.add(hips);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.54, 6, 20), suitMat);
  torso.position.y = 1.28; torso.castShadow = true; rig.add(torso);

  // White Dress Shirt Panel & Lapels
  const shirtPanel = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.38, 0.04), shirtWhite);
  shirtPanel.position.set(0, 1.42, -0.25); rig.add(shirtPanel);

  // Tuxedo Lapels
  for (const sx of [-1, 1]) {
    const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.36, 0.02), suitMat);
    lapel.position.set(sx * 0.10, 1.42, -0.27);
    lapel.rotation.z = sx * -0.15;
    rig.add(lapel);
  }

  // Silk Bow Tie
  const bowTie = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.018, 6, 12), bowTieMat);
  bowTie.position.set(0, 1.56, -0.29); rig.add(bowTie);

  // Gold Shirt Buttons
  for (const y of [1.22, 1.34]) {
    const btn = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 8), goldTrim);
    btn.position.set(0, y, -0.28); rig.add(btn);
  }

  // Red Rose Boutoniere Corsage pinned to left lapel
  const corsage = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), roseRed);
  corsage.position.set(0.14, 1.46, -0.28); rig.add(corsage);
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.01), leafGreen);
  leaf.position.set(0.16, 1.44, -0.27); rig.add(leaf);

  // Legs & Polished Dress Shoes
  const leftLeg = new THREE.Group(); leftLeg.position.set(-0.13, 0.69, 0); rig.add(leftLeg);
  const rightLeg = new THREE.Group(); rightLeg.position.set(0.13, 0.69, 0); rig.add(rightLeg);
  for (const leg of [leftLeg, rightLeg]) {
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.10, 0.46, 4, 12), pantsMat);
    mesh.position.y = -0.28; mesh.castShadow = true; leg.add(mesh);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.10, 0.30), shoeMat);
    foot.position.set(0, -0.61, -0.06); foot.castShadow = true; leg.add(foot);
  }

  // Arms with tailored suit sleeves
  const leftArm = new THREE.Group(); leftArm.position.set(-0.33, 1.56, 0); rig.add(leftArm);
  const rightArm = new THREE.Group(); rightArm.position.set(0.33, 1.56, 0); rig.add(rightArm);
  for (const arm of [leftArm, rightArm]) {
    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.088, 0.42, 4, 12), suitMat);
    sleeve.position.y = -0.25; sleeve.rotation.z = arm === leftArm ? -0.08 : 0.08; sleeve.castShadow = true; arm.add(sleeve);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.082, 12, 10), skin);
    hand.position.y = -0.54; hand.castShadow = true; arm.add(hand);
  }

  // --- Head & Handsome Face ---
  const head = new THREE.Group(); head.position.set(0, 2.08, 0); rig.add(head);

  // Smooth Base Head Sphere (32x24 segments)
  const faceGeom = new THREE.SphereGeometry(0.245, 32, 24);
  const faceMesh = new THREE.Mesh(faceGeom, skin);
  faceMesh.scale.set(0.92, 1.04, 0.92);
  faceMesh.castShadow = true;
  head.add(faceMesh);

  // High-Res Face Texture Shell
  const faceTex = createCompanionFaceTexture(skinColor);
  const faceShellGeom = new THREE.SphereGeometry(0.247, 32, 24, -Math.PI * 0.42, Math.PI * 0.84, Math.PI * 0.18, Math.PI * 0.64);
  const faceShellMat = new THREE.MeshBasicMaterial({ map: faceTex, transparent: true, side: THREE.DoubleSide });
  const faceShell = new THREE.Mesh(faceShellGeom, faceShellMat);
  faceShell.scale.set(0.92, 1.04, 0.92);
  head.add(faceShell);

  // --- Layered Stylish Anime/K-Pop Hair (Side-parted Fringe & Volume) ---
  const hairCapGeom = new THREE.SphereGeometry(0.262, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.58);
  const hairCap = new THREE.Mesh(hairCapGeom, hairMat);
  hairCap.position.y = 0.04;
  hairCap.castShadow = true;
  head.add(hairCap);

  // Layered Sculpted Bangs across Forehead (4 side-parted locks)
  for (let i = -1.5; i <= 2; i++) {
    const ang = i * 0.22;
    const lockLen = 0.18 + Math.abs(i) * 0.03;
    const lock = new THREE.Mesh(new THREE.ConeGeometry(0.048, lockLen, 8), hairMat);
    lock.rotation.z = -ang * 0.7 - 0.2;
    lock.rotation.x = Math.PI * 0.86;
    lock.position.set(Math.sin(ang) * 0.17 + 0.02, 0.14, -0.19 - Math.cos(ang) * 0.03);
    lock.castShadow = true;
    head.add(lock);
  }

  // Sideburns
  for (const side of [-1, 1]) {
    const sb = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.08), hairMat);
    sb.position.set(side * 0.23, 0.02, -0.06);
    head.add(sb);
  }

  const label = createSpriteLabel(options.name || 'من', '#ff8fa3');
  label.position.y = 2.79; rig.add(label);

  // Apply Miniature Chibi Scale
  root.scale.set(MINI_SCALE, MINI_SCALE, MINI_SCALE);

  root.userData = { rig, leftLeg, rightLeg, leftArm, rightArm, head, label, phase: Math.random() * 6.28 };
  root.traverse((obj) => { if (obj.isMesh) { obj.castShadow = true; if (obj.geometry.type !== 'PlaneGeometry') obj.receiveShadow = true; } });
  return root;
}

// VERY LONG Grand Gallery Corridor Walkway Elements
function createGalleryWalkway() {
  const runnerMat = colorMaterial(0x821c2d, 0.95);
  const runnerGoldEdge = colorMaterial(0xffd875, 0.3, 0.8);

  const corridorLength = 68.0;
  const corridorCenterZ = -corridorLength / 2;

  // Velvet aisle runner carpet down the entire length
  addBox(scene, 4.4, 0.025, corridorLength - 1.0, runnerMat, 0, 0.005, corridorCenterZ, { receiveShadow: true });
  addBox(scene, 0.10, 0.03, corridorLength - 1.0, runnerGoldEdge, -2.2, 0.01, corridorCenterZ, { castShadow: false });
  addBox(scene, 0.10, 0.03, corridorLength - 1.0, runnerGoldEdge, 2.2, 0.01, corridorCenterZ, { castShadow: false });

  // 150+ Scattered Rose Petals along the long aisle
  const petalMat = colorMaterial(0xff2a5c, 0.4, 0.2);
  const petalMatPink = colorMaterial(0xff758f, 0.4, 0.2);
  for (let i = 0; i < 160; i++) {
    const petal = new THREE.Mesh(new THREE.CircleGeometry(0.075 + Math.random() * 0.05, 6), i % 2 ? petalMat : petalMatPink);
    petal.rotation.x = -Math.PI / 2;
    petal.rotation.z = Math.random() * Math.PI * 2;
    petal.position.set((Math.random() - 0.5) * 3.8, 0.022, -1.2 - Math.random() * (corridorLength - 4.0));
    scene.add(petal);
  }

  // Romantic Glowing Candles along the sides of the aisle runner
  const candleWax = colorMaterial(0xfffaf0, 0.3);
  const candleFlameMat = new THREE.MeshBasicMaterial({ color: 0xffaa33 });
  const candleHaloMat = new THREE.MeshBasicMaterial({ color: 0xffcc44, transparent: true, opacity: 0.45 });

  for (let z = -2.0; z >= -65.0; z -= 3.0) {
    for (const sx of [-2.05, 2.05]) {
      const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 8), candleWax);
      candle.position.set(sx, 0.08, z);
      scene.add(candle);

      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.07, 6), candleFlameMat);
      flame.position.set(sx, 0.175, z);
      scene.add(flame);

      const halo = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), candleHaloMat);
      halo.position.set(sx, 0.18, z);
      scene.add(halo);

      candleFlames.push({ flame, halo, phase: Math.random() * 6.28 });
    }
  }

  // 7 Grand Floral Arches & Classical Columns between frame bays
  const archPositionsZ = [-3.0, -13.0, -23.0, -33.0, -43.0, -53.0, -63.0];
  archPositionsZ.forEach((archZ) => {
    createFloralArch(0, archZ);
    createClassicColumn(-9.8, archZ);
    createClassicColumn(9.8, archZ);
  });

  // Grand Crystal Chandeliers suspended above each frame pair
  const chanPositionsZ = [-8.0, -18.0, -28.0, -38.0, -48.0, -58.0];
  chanPositionsZ.forEach((chanZ) => {
    createCrystalChandelier(0, 6.8, chanZ);
  });
}

function createClassicColumn(x, z) {
  const colGroup = new THREE.Group();
  colGroup.position.set(x, 0, z);
  scene.add(colGroup);

  const marbleMat = colorMaterial(0xe8e2d8, 0.65, 0.05);
  const goldTrim = colorMaterial(0xffd875, 0.25, 0.8);

  addBox(colGroup, 0.85, 0.35, 0.85, marbleMat, 0, 0.175, 0);
  addBox(colGroup, 0.75, 0.12, 0.75, goldTrim, 0, 0.41, 0);

  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 6.2, 12), marbleMat);
  pillar.position.y = 3.6;
  pillar.castShadow = true;
  colGroup.add(pillar);

  addBox(colGroup, 0.75, 0.14, 0.75, goldTrim, 0, 6.78, 0);
  addBox(colGroup, 0.88, 0.38, 0.88, marbleMat, 0, 7.04, 0);
}

function createCrystalChandelier(x, y, z) {
  const chanGroup = new THREE.Group();
  chanGroup.position.set(x, y, z);
  scene.add(chanGroup);

  const goldMat = colorMaterial(0xffd875, 0.2, 0.85);
  const crystalMat = new THREE.MeshBasicMaterial({ color: 0xfff6dd });

  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 6), goldMat);
  chain.position.y = -0.4; chanGroup.add(chain);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.04, 8, 16), goldMat);
  ring.rotation.x = Math.PI / 2; ring.position.y = -0.82; chanGroup.add(ring);

  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.08), crystalMat);
    crystal.position.set(Math.cos(ang) * 0.55, -0.96, Math.sin(ang) * 0.55);
    chanGroup.add(crystal);
  }

  const centerCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.14), crystalMat);
  centerCrystal.position.set(0, -1.05, 0); chanGroup.add(centerCrystal);
}

function createFloralArch(x, z) {
  const archGroup = new THREE.Group();
  archGroup.position.set(x, 0, z);
  scene.add(archGroup);

  const goldArchMat = colorMaterial(0xffd875, 0.25, 0.8);
  const rosePink = colorMaterial(0xff758f, 0.4, 0.3);
  const roseWhite = colorMaterial(0xfff0f4, 0.4, 0.3);
  const leafMat = colorMaterial(0x2f4d38, 0.85);

  // Main Arch Structure (Left Column, Right Column, Top Torus Arch)
  addBox(archGroup, 0.14, 5.4, 0.14, goldArchMat, -2.6, 2.7, 0);
  addBox(archGroup, 0.14, 5.4, 0.14, goldArchMat, 2.6, 2.7, 0);

  const archTop = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.07, 8, 18, Math.PI), goldArchMat);
  archTop.position.set(0, 5.4, 0);
  archGroup.add(archTop);

  // Roses & leaves along the arch curve
  for (let i = 0; i <= 18; i++) {
    const angle = (i / 18) * Math.PI;
    const rx = Math.cos(angle) * 2.6;
    const ry = 5.4 + Math.sin(angle) * 1.25;
    const flower = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), i % 2 ? rosePink : roseWhite);
    flower.position.set(rx, ry, (Math.random() - 0.5) * 0.16);
    archGroup.add(flower);

    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.02), leafMat);
    leaf.rotation.z = angle;
    leaf.position.set(rx + (Math.random() - 0.5) * 0.1, ry, 0.08);
    archGroup.add(leaf);
  }
}

// 12 Grand Memory Frames placed along the long corridor (6 on Left, 6 on Right with spacious non-overlapping layout)
function addMemoryFrames() {
  const frameSpots = [
    // 6 Frames along West (left) Wall (x = -10.22)
    { x: -10.22, z: -8.0, rot: Math.PI / 2 },
    { x: -10.22, z: -18.0, rot: Math.PI / 2 },
    { x: -10.22, z: -28.0, rot: Math.PI / 2 },
    { x: -10.22, z: -38.0, rot: Math.PI / 2 },
    { x: -10.22, z: -48.0, rot: Math.PI / 2 },
    { x: -10.22, z: -58.0, rot: Math.PI / 2 },

    // 6 Frames along East (right) Wall (x = +10.22)
    { x: 10.22, z: -8.0, rot: -Math.PI / 2 },
    { x: 10.22, z: -18.0, rot: -Math.PI / 2 },
    { x: 10.22, z: -28.0, rot: -Math.PI / 2 },
    { x: 10.22, z: -38.0, rot: -Math.PI / 2 },
    { x: 10.22, z: -48.0, rot: -Math.PI / 2 },
    { x: 10.22, z: -58.0, rot: -Math.PI / 2 },
  ];

  memories.forEach((memory, index) => {
    const spot = frameSpots[index] || frameSpots[frameSpots.length - 1];
    createFrame(memory, index, spot.x, 3.75, spot.z, spot.rot, 2.9, 3.7);
  });
}

function makeRoyalMarbleFloorTexture() {
  const image = document.createElement('canvas'); image.width = 512; image.height = 512;
  const ctx = image.getContext('2d');
  ctx.fillStyle = '#faf6f0';
  ctx.fillRect(0, 0, 512, 512);

  const tileSize = 128;
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const isAlt = (x + y) % 2 === 1;
      const px = x * tileSize;
      const py = y * tileSize;

      const grad = ctx.createLinearGradient(px, py, px + tileSize, py + tileSize);
      if (isAlt) {
        grad.addColorStop(0, '#f2e4e8');
        grad.addColorStop(0.5, '#e8d5db');
        grad.addColorStop(1, '#f7eaee');
      } else {
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.5, '#f5f0e8');
        grad.addColorStop(1, '#faf7f2');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(px + 2, py + 2, tileSize - 4, tileSize - 4);

      // Organic marble veining
      ctx.strokeStyle = isAlt ? 'rgba(180, 120, 140, 0.22)' : 'rgba(210, 195, 175, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px + 10, py + tileSize - 10);
      ctx.bezierCurveTo(px + tileSize * 0.4, py + tileSize * 0.6, px + tileSize * 0.6, py + tileSize * 0.4, px + tileSize - 15, py + 12);
      ctx.stroke();

      // Gold tile inlay border
      ctx.strokeStyle = 'rgba(255, 215, 115, 0.75)';
      ctx.lineWidth = 2.0;
      ctx.strokeRect(px + 4, py + 4, tileSize - 8, tileSize - 8);

      // Corner diamond rosettes
      ctx.fillStyle = '#ffd875';
      ctx.fillRect(px + tileSize / 2 - 3, py + tileSize / 2 - 3, 6, 6);
    }
  }

  const texture = new THREE.CanvasTexture(image);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4.0, 16.0);
  texture.anisotropy = renderer ? Math.min(4, renderer.capabilities.getMaxAnisotropy()) : 1;
  return texture;
}

function createRibbedVaultedCeiling(corridorLength, corridorCenterZ) {
  const goldRibMat = colorMaterial(0xffd875, 0.22, 0.85);
  const rosetteGold = colorMaterial(0xffd875, 0.18, 0.9);

  const archZs = [-3.5, -13.0, -22.5, -32.0, -41.5, -51.0, -60.5];
  archZs.forEach((z) => {
    const vaultGroup = new THREE.Group();
    vaultGroup.position.set(0, 0, z);
    scene.add(vaultGroup);

    // Arch Rib Curve across ceiling
    const rib = new THREE.Mesh(new THREE.TorusGeometry(10.4, 0.12, 8, 24, Math.PI), goldRibMat);
    rib.position.set(0, 7.25, 0);
    rib.rotation.z = Math.PI;
    vaultGroup.add(rib);

    // Central Gilded Ceiling Boss / Rosette
    const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.14, 16), rosetteGold);
    boss.position.set(0, 7.30, 0);
    vaultGroup.add(boss);

    const jewel = new THREE.Mesh(new THREE.OctahedronGeometry(0.18), new THREE.MeshBasicMaterial({ color: 0xffd8a8 }));
    jewel.position.set(0, 7.15, 0);
    vaultGroup.add(jewel);
  });
}

function createStainedGlassWindows() {
  const windowTex = makeCanvasTexture((ctx, w, h) => {
    ctx.fillStyle = '#1c152a';
    ctx.fillRect(0, 0, w, h);
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#ff9ebb');
    grad.addColorStop(0.3, '#c084fc');
    grad.addColorStop(0.7, '#60a5fa');
    grad.addColorStop(1, '#ffd875');
    ctx.fillStyle = grad;
    ctx.fillRect(12, 12, w - 24, h - 24);

    ctx.strokeStyle = '#241b2e';
    ctx.lineWidth = 10;
    ctx.strokeRect(12, 12, w - 24, h - 24);

    ctx.beginPath();
    ctx.arc(w / 2, h * 0.35, w * 0.35, Math.PI, 0);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 60, 110, 0.75)';
    ctx.beginPath();
    const cx = w / 2, cy = h * 0.48;
    ctx.moveTo(cx, cy + 30);
    ctx.bezierCurveTo(cx - 50, cy - 30, cx - 60, cy + 40, cx, cy + 90);
    ctx.bezierCurveTo(cx + 60, cy + 40, cx + 50, cy - 30, cx, cy + 30);
    ctx.fill();
    ctx.stroke();
  }, 256, 512);

  const winMat = new THREE.MeshBasicMaterial({ map: windowTex });
  const frameGold = colorMaterial(0xffd875, 0.25, 0.85);

  // Upper Clerestory Arch Windows above arch bays
  const winZs = [-13.0, -23.0, -33.0, -43.0, -53.0];
  winZs.forEach((z) => {
    for (const side of [-10.42, 10.42]) {
      const winGroup = new THREE.Group();
      winGroup.position.set(side, 5.4, z);
      winGroup.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      scene.add(winGroup);

      addBox(winGroup, 2.2, 2.4, 0.06, frameGold, 0, 0, 0, { castShadow: false });
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 2.2), winMat);
      glass.position.set(0, 0, 0.04);
      winGroup.add(glass);
    }
  });
}

// Royal Concert Grand Piano (Interactive 3D Piano)
function createGrandPiano(x, y, z) {
  const pianoGroup = new THREE.Group();
  pianoGroup.position.set(x, y, z);
  pianoGroup.rotation.y = -Math.PI * 0.28;
  scene.add(pianoGroup);

  const pianoBlack = colorMaterial(0x111116, 0.18, 0.3);
  const soundboardGold = colorMaterial(0xcca352, 0.4, 0.6);
  const goldTrim = colorMaterial(0xffd875, 0.22, 0.85);
  const ivoryWhite = colorMaterial(0xfffdfa, 0.2);
  const keyEbony = colorMaterial(0x18181c, 0.15);
  const stoolVelvet = colorMaterial(0x821c2d, 0.8);

  // Main Piano Rim / Body (Curved Wing)
  addBox(pianoGroup, 2.4, 0.42, 2.8, pianoBlack, 0, 1.25, 0, { castShadow: true });
  
  // Inner Soundboard
  addBox(pianoGroup, 2.2, 0.04, 2.5, soundboardGold, 0, 1.32, -0.1, { castShadow: false });

  // Open Wing Lid angled up
  const lid = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.04, 2.75), pianoBlack);
  lid.position.set(0, 1.75, 0);
  lid.rotation.z = 0.42;
  pianoGroup.add(lid);

  // Gold Lid Prop Stick
  const prop = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.85, 6), goldTrim);
  prop.position.set(0.85, 1.65, 0.2);
  prop.rotation.z = -0.3;
  pianoGroup.add(prop);

  // Keyboard Bed & Keys
  addBox(pianoGroup, 2.1, 0.12, 0.48, pianoBlack, 0, 1.05, 1.45, { castShadow: true });
  for (let i = 0; i < 24; i++) {
    const kx = -0.92 + i * 0.08;
    addBox(pianoGroup, 0.075, 0.04, 0.38, ivoryWhite, kx, 1.13, 1.48, { castShadow: false });
    if (i % 7 !== 2 && i % 7 !== 6 && i < 23) {
      addBox(pianoGroup, 0.045, 0.06, 0.24, keyEbony, kx + 0.04, 1.16, 1.42, { castShadow: false });
    }
  }

  // 3 Fluted Legs with Gold Casters
  for (const [lx, lz] of [[-0.95, -1.0], [0.95, -1.0], [0, 1.1]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.05, 1.05, 8), pianoBlack);
    leg.position.set(lx, 0.52, lz);
    leg.castShadow = true;
    pianoGroup.add(leg);
    const caster = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), goldTrim);
    caster.position.set(lx, 0.05, lz);
    pianoGroup.add(caster);
  }

  // Velvet Piano Stool
  const stoolGroup = new THREE.Group();
  stoolGroup.position.set(0, 0, 2.1);
  addBox(stoolGroup, 1.1, 0.14, 0.48, stoolVelvet, 0, 0.62, 0, { castShadow: true });
  addBox(stoolGroup, 1.14, 0.04, 0.52, goldTrim, 0, 0.54, 0, { castShadow: false });
  for (const sx of [-0.42, 0.42]) {
    for (const sz of [-0.16, 0.16]) {
      const sLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.52, 6), pianoBlack);
      sLeg.position.set(sx, 0.26, sz);
      stoolGroup.add(sLeg);
    }
  }
  pianoGroup.add(stoolGroup);

  // Sheet Music Stand with Anniversary Waltz Notes
  addBox(pianoGroup, 0.85, 0.35, 0.02, goldTrim, 0, 1.55, 1.15, { castShadow: false });
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.28), new THREE.MeshBasicMaterial({ color: 0xfffaf0 }));
  sheet.position.set(0, 1.55, 1.17);
  pianoGroup.add(sheet);

  // Interactive Target
  const clickTarget = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.5, 3.5), new THREE.MeshBasicMaterial({ visible: false }));
  clickTarget.position.set(0, 1.2, 0.5);
  clickTarget.userData = { type: 'piano' };
  pianoGroup.add(clickTarget);
  interactiveTargets.push(clickTarget);

  return pianoGroup;
}

// Romantic Garden Wishing Fountain in Courtyard
function createWishingFountain(x, z) {
  const fountainGroup = new THREE.Group();
  fountainGroup.position.set(x, 0, z);
  scene.add(fountainGroup);

  const marbleMat = colorMaterial(0xe8e2d8, 0.45, 0.1);
  const waterMat = colorMaterial(0x38c2d6, 0.15, 0.4);
  const goldMat = colorMaterial(0xffd875, 0.2, 0.85);

  // Octagonal Basin
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 3.1, 0.65, 8), marbleMat);
  basin.position.y = 0.32;
  basin.castShadow = true;
  fountainGroup.add(basin);

  // Water Surface
  const water = new THREE.Mesh(new THREE.CylinderGeometry(2.65, 2.65, 0.08, 16), waterMat);
  water.position.y = 0.58;
  fountainGroup.add(water);

  // Pedestal & 2nd Tier Bowl
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 1.35, 12), marbleMat);
  ped.position.y = 1.15;
  ped.castShadow = true;
  fountainGroup.add(ped);

  const topBowl = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 0.35, 0.45, 12), marbleMat);
  topBowl.position.y = 1.95;
  fountainGroup.add(topBowl);

  // Golden Double-Heart Fountain Sculpture
  const heart = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.08, 8, 16), goldMat);
  heart.position.set(0, 2.55, 0);
  fountainGroup.add(heart);

  // Surrounding Rose Planters
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * Math.PI * 2;
    const px = Math.cos(ang) * 3.6;
    const pz = Math.sin(ang) * 3.6;
    createPlanter(x + px, 0, z + pz);
  }

  // Interactive Target
  const clickTarget = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 2.5, 8), new THREE.MeshBasicMaterial({ visible: false }));
  clickTarget.position.set(0, 1.2, 0);
  clickTarget.userData = { type: 'wishing-fountain' };
  fountainGroup.add(clickTarget);
  interactiveTargets.push(clickTarget);

  return fountainGroup;
}

// Royal Lounge Suite & Velvet Chesterfield Sofa
function createRoyalLoungeSuite(x, z) {
  const loungeGroup = new THREE.Group();
  loungeGroup.position.set(x, 0, z);
  scene.add(loungeGroup);

  const velvetMat = colorMaterial(0x821c2d, 0.75, 0.1);
  const goldTrim = colorMaterial(0xffd875, 0.22, 0.85);
  const marbleMat = colorMaterial(0xfbf7ee, 0.3, 0.1);

  // Velvet Chesterfield Sofa Base & Cushions
  addBox(loungeGroup, 3.8, 0.42, 1.4, velvetMat, 0, 0.38, 0, { castShadow: true });
  addBox(loungeGroup, 3.84, 0.06, 1.44, goldTrim, 0, 0.16, 0, { castShadow: false });

  // Tufted Backrest
  addBox(loungeGroup, 3.8, 0.85, 0.42, velvetMat, 0, 0.95, -0.48, { castShadow: true });

  // Side Armrests
  for (const sx of [-1.8, 1.8]) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 1.35, 12), velvetMat);
    arm.rotation.x = Math.PI / 2;
    arm.position.set(sx, 0.82, 0);
    loungeGroup.add(arm);
  }

  // Silk Pillows
  for (const sx of [-1.1, 1.1]) {
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.18), colorMaterial(0xffa8ba, 0.6));
    pillow.rotation.z = sx > 0 ? -0.2 : 0.2;
    pillow.position.set(sx, 0.82, -0.22);
    loungeGroup.add(pillow);
  }

  // Marble Coffee Table in front of Sofa
  const tableGroup = new THREE.Group();
  tableGroup.position.set(0, 0, 1.5);
  addBox(tableGroup, 2.2, 0.08, 1.0, marbleMat, 0, 0.45, 0, { castShadow: true });
  addBox(tableGroup, 2.24, 0.02, 1.04, goldTrim, 0, 0.42, 0, { castShadow: false });
  for (const sx of [-0.9, 0.9]) {
    for (const sz of [-0.38, 0.38]) {
      const tLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.025, 0.42, 6), goldTrim);
      tLeg.position.set(sx, 0.21, sz);
      tableGroup.add(tLeg);
    }
  }

  // Champagne Flutes & Strawberries on Table
  for (const fx of [-0.35, 0.35]) {
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.02, 0.18, 8), new THREE.MeshBasicMaterial({ color: 0xfff2aa, transparent: true, opacity: 0.75 }));
    glass.position.set(fx, 0.58, 0);
    tableGroup.add(glass);
  }
  loungeGroup.add(tableGroup);

  // Interactive Target
  const clickTarget = new THREE.Mesh(new THREE.BoxGeometry(4.0, 1.8, 2.8), new THREE.MeshBasicMaterial({ visible: false }));
  clickTarget.position.set(0, 0.8, 0.5);
  clickTarget.userData = { type: 'sofa' };
  loungeGroup.add(clickTarget);
  interactiveTargets.push(clickTarget);

  return loungeGroup;
}

function makeWoodTexture() {
  return makeRoyalMarbleFloorTexture();
}

function makeGrassTexture() {
  const image = document.createElement('canvas'); image.width = 256; image.height = 256;
  const ctx = image.getContext('2d'); ctx.fillStyle = '#22362b'; ctx.fillRect(0, 0, 256, 256);
  let seed = 47;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const greens = ['#203227', '#2c3e2f', '#324533', '#394635', '#24372a'];
  for (let i = 0; i < 950; i++) {
    ctx.fillStyle = greens[Math.floor(random() * greens.length)]; ctx.globalAlpha = 0.28 + random() * 0.5;
    ctx.fillRect(random() * 256, random() * 256, 1 + random() * 2, 1 + random() * 4);
  }
  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(image); texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(17, 18);
  texture.anisotropy = renderer ? Math.min(2, renderer.capabilities.getMaxAnisotropy()) : 1;
  return texture;
}

function addGround(width, depth, material, x, y, z) {
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
  plane.rotation.x = -Math.PI / 2; plane.position.set(x, y, z); plane.receiveShadow = true; scene.add(plane);
  return plane;
}

function createFacadeWindow(x, y, width = 3.4, height = 2.6) {
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xc9935d, emissive: 0xffb966, emissiveIntensity: 0.5, roughness: 0.24, metalness: 0.05 });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(width, height), glassMat);
  glass.position.set(x, y, 0.397); scene.add(glass);
  const trim = colorMaterial(0x382d29, 0.47, 0.15);
  const bar = 0.13, z = 0.47;
  addBox(scene, width + bar * 2, bar, 0.18, trim, x, y + height / 2 + bar / 2, z);
  addBox(scene, width + bar * 2, bar, 0.18, trim, x, y - height / 2 - bar / 2, z);
  addBox(scene, bar, height + bar * 2, 0.18, trim, x - width / 2 - bar / 2, y, z);
  addBox(scene, bar, height + bar * 2, 0.18, trim, x + width / 2 + bar / 2, y, z);
  addBox(scene, 0.075, height, 0.11, colorMaterial(0xa8875d, 0.33, 0.28), x, y, z + 0.045, { castShadow: false });
  addBox(scene, width, 0.075, 0.11, colorMaterial(0xa8875d, 0.33, 0.28), x, y, z + 0.045, { castShadow: false });
  for (const side of [-1, 1]) addBox(scene, 0.22, height - 0.1, 0.025, colorMaterial(0xe2c9a2, 0.9), x + side * (width / 2 - 0.17), y, 0.36, { castShadow: false });
}

function createDoorPivot(side) {
  const hingeX = side > 0 ? -2.58 : 2.58;
  const pivot = new THREE.Group(); pivot.position.set(hingeX, 0, 0.42); scene.add(pivot);
  const leafX = side * 1.29;
  const doorMat = colorMaterial(0x3a2c27, 0.42, 0.08);
  const panelMat = colorMaterial(0x594133, 0.5, 0.05);
  const brass = colorMaterial(0xc6a56d, 0.24, 0.72);
  addBox(pivot, 2.58, 4.25, 0.18, doorMat, leafX, 2.13, 0);
  for (const y of [1.08, 2.9]) {
    addBox(pivot, 1.86, 1.3, 0.055, panelMat, leafX, y, 0.106, { castShadow: false });
    addBox(pivot, 1.98, 0.045, 0.035, brass, leafX, y + 0.68, 0.14, { castShadow: false });
    addBox(pivot, 1.98, 0.045, 0.035, brass, leafX, y - 0.68, 0.14, { castShadow: false });
  }
  addBox(pivot, 0.045, 3.42, 0.035, brass, leafX - 0.98, 2.13, 0.14, { castShadow: false });
  addBox(pivot, 0.045, 3.42, 0.035, brass, leafX + 0.98, 2.13, 0.14, { castShadow: false });
  const handle = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), brass);
  handle.position.set(side * 2.26, 2.1, 0.18); pivot.add(handle);
  const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.26, 8), brass);
  lever.rotation.z = Math.PI / 2; lever.position.set(side * 2.13, 2.1, 0.18); pivot.add(lever);
  return pivot;
}

function createTree(x, z, scale = 1) {
  const group = new THREE.Group(); group.position.set(x, 0, z); scene.add(group);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.17 * scale, 0.29 * scale, 2.8 * scale, 7), colorMaterial(0x514132, 0.95));
  trunk.position.y = 1.35 * scale; trunk.castShadow = true; group.add(trunk);
  const foliageMat = colorMaterial(0x2d4334, 0.88);
  const foliageLayers = [
    { y: 2.25 * scale, radius: 1.45 * scale, height: 1.7 * scale },
    { y: 3.25 * scale, radius: 1.15 * scale, height: 1.55 * scale },
    { y: 4.15 * scale, radius: 0.85 * scale, height: 1.35 * scale },
  ];
  foliageLayers.forEach((l) => {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(l.radius, l.height, 8), foliageMat);
    cone.position.y = l.y; cone.castShadow = true; group.add(cone);
  });
  return group;
}

function createPlanter(x, y, z) {
  const potMat = colorMaterial(0xd3c6b1, 0.85);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.44, 0.72, 10), potMat);
  pot.position.set(x, y + 0.36, z); pot.castShadow = true; scene.add(pot);
  const leafMat = colorMaterial(0x384c3c, 0.85);
  const bush = new THREE.Mesh(new THREE.SphereGeometry(0.68, 10, 8), leafMat);
  bush.position.set(x, y + 0.92, z); bush.castShadow = true; scene.add(bush);
  const flowerMat = colorMaterial(0xff758f, 0.3, 0.4);
  for (let i = 0; i < 5; i++) {
    const ang = i * 1.25;
    const flower = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), flowerMat);
    flower.position.set(x + Math.cos(ang) * 0.52, y + 1.05 + (i % 2) * 0.15, z + Math.sin(ang) * 0.52);
    scene.add(flower);
  }
}

function createPathLight(x, z) {
  const metal = colorMaterial(0x272c36, 0.5, 0.2);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 1.45, 8), metal);
  pole.position.set(x, 0.725, z); pole.castShadow = true; scene.add(pole);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.05, 8), metal);
  cap.position.set(x, 1.45, z); scene.add(cap);
  const lanternMat = new THREE.MeshBasicMaterial({ color: 0xffe28b });
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.22, 8), lanternMat);
  lantern.position.set(x, 1.32, z); scene.add(lantern);
}

function createLoveMonument(x, z) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  scene.add(group);

  const marbleMat = colorMaterial(0x241d28, 0.3, 0.2);
  const goldTrim = colorMaterial(0xf3c858, 0.2, 0.8);
  addBox(group, 1.2, 0.22, 1.2, goldTrim, 0, 0.11, 0);
  addBox(group, 0.95, 0.75, 0.95, marbleMat, 0, 0.58, 0);
  addBox(group, 1.1, 0.12, 1.1, goldTrim, 0, 1.02, 0);

  const heartGroup = new THREE.Group();
  heartGroup.position.set(0, 1.62, 0);
  const heartMat = new THREE.MeshBasicMaterial({ color: 0xff2a5c });

  const c1 = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), heartMat); c1.position.set(-0.16, 0.16, 0); heartGroup.add(c1);
  const c2 = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 12), heartMat); c2.position.set(0.16, 0.16, 0); heartGroup.add(c2);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.58, 12), heartMat); cone.rotation.z = Math.PI; cone.position.set(0, -0.12, 0); heartGroup.add(cone);
  group.add(heartGroup);
  crystalHeartMesh = heartGroup;

  const heartLight = new THREE.PointLight(0xff3366, 3.2, 8.5, 2);
  heartLight.position.set(0, 1.65, 0);
  group.add(heartLight);

  const labelTex = createLoveMonumentTexture();
  const labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, transparent: true, depthTest: false }));
  labelSprite.scale.set(2.2, 0.55, 1);
  labelSprite.position.set(0, 2.45, 0);
  labelSprite.renderOrder = 5;
  group.add(labelSprite);
  loveMonumentLabel = labelSprite;

  const clickTarget = new THREE.Mesh(new THREE.SphereGeometry(0.75, 8, 8), new THREE.MeshBasicMaterial({ visible: false }));
  clickTarget.position.set(0, 1.5, 0);
  clickTarget.userData = { type: 'love-monument' };
  group.add(clickTarget);
  interactiveTargets.push(clickTarget);

  loveMonument = { x, z, group };
}

// Grand Centerpiece Fireplace & 1st Anniversary Mantle at the far end of the corridor
function createFireplaceAndAnniversaryMantle() {
  const mantelX = 0, mantelZ = -67.85;
  const stoneMat = colorMaterial(0x282c33, 0.7, 0.1);
  const goldMat = colorMaterial(0xf3c858, 0.2, 0.8);
  const darkHearth = colorMaterial(0x15161a, 0.9);

  addBox(scene, 5.2, 0.25, 1.4, stoneMat, mantelX, 0.125, mantelZ + 0.45);
  addBox(scene, 0.75, 2.8, 0.9, stoneMat, mantelX - 1.9, 1.4, mantelZ + 0.35);
  addBox(scene, 0.75, 2.8, 0.9, stoneMat, mantelX + 1.9, 1.4, mantelZ + 0.35);
  addBox(scene, 5.0, 0.52, 1.1, stoneMat, mantelX, 2.82, mantelZ + 0.35);
  addBox(scene, 5.2, 0.16, 1.25, goldMat, mantelX, 3.16, mantelZ + 0.35);

  addBox(scene, 3.0, 2.3, 0.7, darkHearth, mantelX, 1.15, mantelZ + 0.15, { castShadow: false });

  const logMat = colorMaterial(0x382317, 0.9);
  for (let i = 0; i < 4; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.10, 1.4, 6), logMat);
    log.rotation.z = Math.PI / 2 + (i - 1.5) * 0.18;
    log.position.set(mantelX + (i - 1.5) * 0.18, 0.28 + i * 0.08, mantelZ + 0.25);
    scene.add(log);
  }
  const emberMat = new THREE.MeshBasicMaterial({ color: 0xff5511 });
  for (let i = 0; i < 8; i++) {
    const ember = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), emberMat);
    ember.position.set(mantelX + (Math.random() - 0.5) * 1.4, 0.22, mantelZ + 0.22 + (Math.random() - 0.5) * 0.3);
    scene.add(ember);
  }

  fireplaceLight = new THREE.PointLight(0xff6e2b, 4.5, 14.0, 2);
  fireplaceLight.position.set(mantelX, 1.0, mantelZ + 0.55);
  scene.add(fireplaceLight);

  const plaqueTex = createAnniversaryMantleTexture();
  const plaqueMesh = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.95), new THREE.MeshBasicMaterial({ map: plaqueTex }));
  plaqueMesh.position.set(mantelX, 4.35, mantelZ + 0.16);
  scene.add(plaqueMesh);
  anniversaryMantleSign = plaqueMesh;

  const annivTarget = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.4, 0.5), new THREE.MeshBasicMaterial({ visible: false }));
  annivTarget.position.set(mantelX, 4.35, mantelZ + 0.16);
  annivTarget.userData = { type: 'anniversary-mantle' };
  scene.add(annivTarget);
  interactiveTargets.push(annivTarget);

  for (const sx of [-2.8, 2.8]) {
    const sconceGlow = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffe299 }));
    sconceGlow.position.set(sx, 4.35, mantelZ + 0.4);
    scene.add(sconceGlow);
  }
}

function createFairyLights() {
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe299 });
  const bulbGeom = new THREE.SphereGeometry(0.045, 6, 6);

  // Porch fairy lights
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    const x = lerp(-3.8, 3.8, t);
    const sag = Math.sin(t * Math.PI) * 0.32;
    const y = 4.82 - sag;
    const z = 2.65;
    const bulb = new THREE.Mesh(bulbGeom, bulbMat);
    bulb.position.set(x, y, z);
    scene.add(bulb);
    fairyBulbs.push({ mesh: bulb, phase: Math.random() * 6.28 });
  }

  // Ceiling fairy lights along the entire long corridor
  for (let row = 0; row < 12; row++) {
    const z = -4.0 - row * 5.2;
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const x = lerp(-8.5, 8.5, t);
      const sag = Math.sin(t * Math.PI) * 0.24;
      const y = 6.95 - sag;
      const bulb = new THREE.Mesh(bulbGeom, bulbMat);
      bulb.position.set(x, y, z);
      scene.add(bulb);
      fairyBulbs.push({ mesh: bulb, phase: Math.random() * 6.28 });
    }
  }
}

function createFloatingParticles() {
  const particleCount = 75;
  const positions = new Float32Array(particleCount * 3);
  const velocities = [];

  for (let i = 0; i < particleCount; i++) {
    positions[i * 3 + 0] = (Math.random() - 0.5) * 22;
    positions[i * 3 + 1] = 0.5 + Math.random() * 6.0;
    positions[i * 3 + 2] = -68 + Math.random() * 85;
    velocities.push({
      speedY: 0.15 + Math.random() * 0.25,
      driftX: (Math.random() - 0.5) * 0.12,
      phase: Math.random() * Math.PI * 2,
    });
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const pTexture = makeCanvasTexture((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#ff758f'; ctx.beginPath(); ctx.arc(w / 2, h / 2, w * 0.35, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(w / 2, h / 2, w * 0.18, 0, Math.PI * 2); ctx.fill();
  }, 64, 64);

  const mat = new THREE.PointsMaterial({
    map: pTexture,
    size: 0.22,
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const particles = new THREE.Points(geom, mat);
  scene.add(particles);
  floatingParticleSystem = { particles, geom, velocities, count: particleCount };
}

function updateFloatingParticles(dt, time) {
  if (!floatingParticleSystem) return;
  const pos = floatingParticleSystem.geom.attributes.position.array;
  for (let i = 0; i < floatingParticleSystem.count; i++) {
    const v = floatingParticleSystem.velocities[i];
    pos[i * 3 + 1] += v.speedY * dt;
    pos[i * 3 + 0] += Math.sin(time + v.phase) * v.driftX * dt;
    if (pos[i * 3 + 1] > 7.2) {
      pos[i * 3 + 1] = 0.4;
      pos[i * 3 + 0] = (Math.random() - 0.5) * 20;
    }
  }
  floatingParticleSystem.geom.attributes.position.needsUpdate = true;
}

function createGiantLetterTexture() {
  return makeCanvasTexture((ctx, w, h) => {
    // Parchment paper gradient
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#fffdf7');
    grad.addColorStop(0.5, '#fff6eb');
    grad.addColorStop(1, '#faebd7');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Ornate double border
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 6;
    ctx.strokeRect(14, 14, w - 28, h - 28);

    ctx.strokeStyle = '#ff758f';
    ctx.lineWidth = 2;
    ctx.strokeRect(22, 22, w - 44, h - 44);

    // Header & calligraphy
    ctx.textAlign = 'center';
    ctx.direction = 'rtl';

    ctx.fillStyle = '#b82b4a';
    ctx.font = 'bold 22px Tahoma, Arial, sans-serif';
    ctx.fillText('🌸 نامه‌ی عاشقی اولین سالگردمون 🌸', w / 2, 58);

    ctx.fillStyle = '#5c4033';
    ctx.font = 'bold 16px Tahoma, Arial, sans-serif';
    ctx.fillText('برای پرنسسِ قشنگم · ۳۶۵ روز عاشقی بی‌نهایت', w / 2, 95);

    ctx.fillStyle = '#443328';
    ctx.font = '13.5px Tahoma, Arial, sans-serif';
    ctx.fillText('یک سال از زیباترین لحظه‌های زندگیمون گذشت...', w / 2, 135);

    ctx.fillStyle = '#ff4d6d';
    ctx.font = 'bold 15px Tahoma, Arial, sans-serif';
    ctx.fillText('💌 برای باز کردن و خواندن نامه‌ی ۱ سالگی لمس کنید 💌', w / 2, 180);

    // Decorative corner hearts
    ctx.fillStyle = '#ff4d6d';
    ctx.font = '20px Arial';
    ctx.fillText('♡', 36, 46);
    ctx.fillText('♡', w - 36, 46);
    ctx.fillText('♡', 36, h - 30);
    ctx.fillText('♡', w - 36, h - 30);
  }, 512, 256);
}

function createGiantEnvelopeTexture() {
  return makeCanvasTexture((ctx, w, h) => {
    // Romantic satin rose-cream gradient
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#fff4f6');
    grad.addColorStop(0.5, '#ffe5eb');
    grad.addColorStop(1, '#fad1dc');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Gold border lining
    ctx.strokeStyle = '#ffd875';
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, w - 16, h - 16);

    // Envelope diagonal flap fold lines
    ctx.strokeStyle = 'rgba(216, 120, 140, 0.45)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(8, 8);
    ctx.lineTo(w / 2, h * 0.65);
    ctx.lineTo(w - 8, 8);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(8, h - 8);
    ctx.lineTo(w / 2, h * 0.42);
    ctx.lineTo(w - 8, h - 8);
    ctx.stroke();

    // Golden embossed emblem in center
    ctx.fillStyle = '#ffd875';
    ctx.font = 'bold 22px Tahoma, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.direction = 'rtl';
    ctx.fillText('✨ ۱ سال عاشقی با تو ✨', w / 2, h - 32);
  }, 512, 384);
}

function createGiantLetterLabel() {
  return makeCanvasTexture((ctx, w, h) => {
    ctx.fillStyle = 'rgba(34, 18, 30, 0.94)';
    ctx.roundRect ? ctx.roundRect(8, 8, w - 16, h - 16, 18) : ctx.fillRect(8, 8, w - 16, h - 16);
    ctx.fill();
    ctx.strokeStyle = '#ffd875';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.direction = 'rtl';

    ctx.fillStyle = '#ffd875';
    ctx.font = 'bold 24px Tahoma, Arial, sans-serif';
    ctx.fillText('💌 پاکت نامه‌ی عاشقی ۱ سالگی', w / 2, 42);

    ctx.fillStyle = '#ffb3c1';
    ctx.font = 'bold 16px Tahoma, Arial, sans-serif';
    ctx.fillText('✨ برای باز کردن و خواندن نامه لمس کنید ✨', w / 2, 74);
  }, 512, 96);
}

function createGiantLoveLetterAltar(x, z) {
  const altarGroup = new THREE.Group();
  altarGroup.position.set(x, 0, z);
  scene.add(altarGroup);

  const marbleMat = colorMaterial(0xf5ede1, 0.45, 0.1);
  const goldMat = colorMaterial(0xffd875, 0.2, 0.85);
  const roseGoldMat = colorMaterial(0xe88a9c, 0.25, 0.7);
  const rubyMat = new THREE.MeshBasicMaterial({ color: 0xc9184a });
  const darkBack = colorMaterial(0x201520, 0.5);

  // Grand Romantic Velvet Rug with Gold Border
  const rugMat = colorMaterial(0x821c2d, 0.95);
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(9.2, 9.2), rugMat);
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.012, 0);
  rug.receiveShadow = true;
  altarGroup.add(rug);

  // Scattered Rose Petals on the Altar Rug
  const petalRed = colorMaterial(0xff2a5c, 0.4, 0.2);
  const petalPink = colorMaterial(0xff758f, 0.4, 0.2);
  for (let i = 0; i < 40; i++) {
    const angle = (i / 40) * Math.PI * 2;
    const rad = 2.2 + Math.random() * 1.8;
    const petal = new THREE.Mesh(new THREE.CircleGeometry(0.09, 6), i % 2 ? petalRed : petalPink);
    petal.rotation.x = -Math.PI / 2;
    petal.rotation.z = Math.random() * Math.PI * 2;
    petal.position.set(Math.cos(angle) * rad, 0.022, Math.sin(angle) * rad);
    altarGroup.add(petal);
  }

  // Multi-tier Royal Pedestal
  addBox(altarGroup, 3.8, 0.22, 2.4, goldMat, 0, 0.11, 0);
  addBox(altarGroup, 3.5, 0.28, 2.1, marbleMat, 0, 0.36, 0);
  addBox(altarGroup, 3.2, 0.14, 1.8, goldMat, 0, 0.57, 0);

  // Glowing Scented Candles on Pedestal Corners
  const candleWax = colorMaterial(0xfffaf0, 0.3);
  const candleFlameMat = new THREE.MeshBasicMaterial({ color: 0xffaa33 });
  const candleHaloMat = new THREE.MeshBasicMaterial({ color: 0xffcc44, transparent: true, opacity: 0.45 });

  for (const sx of [-1.5, 1.5]) {
    for (const sz of [-0.8, 0.8]) {
      const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 8), candleWax);
      candle.position.set(sx, 0.72, sz);
      altarGroup.add(candle);

      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.09, 6), candleFlameMat);
      flame.position.set(sx, 0.84, sz);
      altarGroup.add(flame);

      const halo = new THREE.Mesh(new THREE.SphereGeometry(0.10, 6, 6), candleHaloMat);
      halo.position.set(sx, 0.85, sz);
      altarGroup.add(halo);

      candleFlames.push({ flame, halo, phase: Math.random() * 6.28 });
    }
  }

  // --- Giant Angled Envelope & Stand ---
  const standGroup = new THREE.Group();
  standGroup.position.set(0, 0.65, 0);
  standGroup.rotation.x = -0.15; // Angled backward for optimal view
  altarGroup.add(standGroup);

  // Back support easel
  addBox(standGroup, 0.15, 2.6, 0.15, goldMat, 0, 1.3, -0.22);

  // Soft Ambient Glow Halo behind the giant letter
  const haloMat = new THREE.MeshBasicMaterial({ color: 0xffccd5, transparent: true, opacity: 0.38 });
  const haloMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.6), haloMat);
  haloMesh.position.set(0, 1.45, -0.06);
  standGroup.add(haloMesh);

  // Envelope Body
  const envTex = createGiantEnvelopeTexture();
  const envMat = new THREE.MeshStandardMaterial({ map: envTex, roughness: 0.35, metalness: 0.2 });
  addBox(standGroup, 2.85, 1.75, 0.12, darkBack, 0, 1.45, 0.0, { castShadow: true });
  addBox(standGroup, 2.92, 1.82, 0.06, goldMat, 0, 1.45, 0.02, { castShadow: false });
  addBox(standGroup, 2.80, 1.70, 0.08, envMat, 0, 1.45, 0.06, { castShadow: false });

  // Parchment Letter Emerging Upward
  const letterTex = createGiantLetterTexture();
  const letterMat = new THREE.MeshStandardMaterial({ map: letterTex, roughness: 0.5, metalness: 0.05 });
  addBox(standGroup, 2.55, 1.55, 0.04, letterMat, 0, 1.95, 0.10, { castShadow: true });

  // 3D Crimson Wax Seal with Golden Heart
  const waxSeal = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.06, 18), rubyMat);
  waxSeal.rotation.x = Math.PI / 2;
  waxSeal.position.set(0, 1.45, 0.14);
  standGroup.add(waxSeal);

  // Golden heart relief on wax seal
  const h1 = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), goldMat); h1.position.set(-0.035, 1.47, 0.18); standGroup.add(h1);
  const h2 = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), goldMat); h2.position.set(0.035, 1.47, 0.18); standGroup.add(h2);
  const hc = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.12, 8), goldMat); hc.rotation.z = Math.PI; hc.position.set(0, 1.41, 0.18); standGroup.add(hc);

  // Ribbon Bow Crest on top of the letter
  const bowGroup = new THREE.Group();
  bowGroup.position.set(0, 2.76, 0.12);
  const bowCenter = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), rubyMat);
  bowGroup.add(bowCenter);
  for (const sx of [-1, 1]) {
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.045, 6, 14), roseGoldMat);
    loop.position.set(sx * 0.14, 0.02, 0);
    loop.rotation.y = sx * 0.3;
    bowGroup.add(loop);
    const streamer = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.02), roseGoldMat);
    streamer.position.set(sx * 0.10, -0.20, 0.01);
    streamer.rotation.z = sx * -0.28;
    bowGroup.add(streamer);
  }
  standGroup.add(bowGroup);

  // Floating Pulsating Mini 3D Hearts around the Giant Letter
  const heartColors = [0xff2a5c, 0xff758f, 0xffa8ba, 0xffd875];
  for (let i = 0; i < 4; i++) {
    const fHeart = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: heartColors[i] });
    const p1 = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), mat); p1.position.set(-0.05, 0.05, 0); fHeart.add(p1);
    const p2 = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), mat); p2.position.set(0.05, 0.05, 0); fHeart.add(p2);
    const pc = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.16, 8), mat); pc.rotation.z = Math.PI; pc.position.set(0, -0.04, 0); fHeart.add(pc);

    const angle = (i / 4) * Math.PI * 2;
    const hx = Math.cos(angle) * 1.65;
    const hy = 2.2 + (i % 2) * 0.6;
    const hz = Math.sin(angle) * 0.5 + 0.3;
    fHeart.position.set(hx, hy, hz);
    altarGroup.add(fHeart);
    giantLetterHearts.push({ mesh: fHeart, baseY: hy, phase: i * 1.5 });
  }

  // Floating Glowing Persian Billboard Sprite Title
  const labelTex = createGiantLetterLabel();
  const labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, transparent: true, depthTest: false }));
  labelSprite.scale.set(3.4, 0.68, 1);
  labelSprite.position.set(0, 3.45, 0);
  labelSprite.renderOrder = 5;
  altarGroup.add(labelSprite);

  // Generous Invisible Interactive Collider
  const letterTarget = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 3.4, 2.2),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  letterTarget.position.set(0, 1.8, 0);
  letterTarget.userData = { type: 'love-letter' };
  altarGroup.add(letterTarget);
  interactiveTargets.push(letterTarget);

  // Royal Lounge Loveseats on the Left & Right Sides of the Corridor End
  const sofaFabric = colorMaterial(0x42384a, 0.85);
  const pillowMat = colorMaterial(0xd88a8a, 0.75);
  const coffeeWood = colorMaterial(0x382c23, 0.5, 0.1);

  for (const side of [-5.2, 5.2]) {
    const lounge = new THREE.Group();
    lounge.position.set(side, 0, 0);
    lounge.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    altarGroup.add(lounge);

    addBox(lounge, 3.2, 0.38, 1.1, sofaFabric, 0, 0.19, 0);
    addBox(lounge, 3.2, 0.70, 0.30, sofaFabric, 0, 0.65, -0.45);
    addBox(lounge, 0.30, 0.55, 1.1, sofaFabric, -1.65, 0.38, 0);
    addBox(lounge, 0.30, 0.55, 1.1, sofaFabric, 1.65, 0.38, 0);

    for (const ps of [-1.1, 1.1]) {
      const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.38, 0.18), pillowMat);
      pillow.position.set(ps, 0.52, -0.28);
      pillow.rotation.y = ps < 0 ? 0.2 : -0.2;
      lounge.add(pillow);
    }

    addBox(lounge, 1.4, 0.06, 0.8, coffeeWood, 0, 0.36, 1.1);
    for (const cx of [-0.6, 0.6]) {
      for (const cz of [0.8, 1.4]) {
        addBox(lounge, 0.05, 0.36, 0.05, coffeeWood, cx, 0.18, cz, { castShadow: false });
      }
    }

    const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.26, 8), colorMaterial(0xffffff, 0.1, 0.1));
    vase.position.set(0, 0.52, 1.1); lounge.add(vase);
    const rose = new THREE.Mesh(new THREE.SphereGeometry(0.10, 8, 8), colorMaterial(0xff3366, 0.4, 0.2));
    rose.position.set(0, 0.68, 1.1); lounge.add(rose);
  }
}

// --- Magic Footsteps (Princess Glowing Petal Trails) ---
function spawnMagicFootstep(x, z) {
  const geom = new THREE.PlaneGeometry(0.28, 0.28);
  const footTex = makeCanvasTexture((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const grad = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.35, '#ff8fa3');
    grad.addColorStop(0.7, '#ffd875');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff2a5c';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('♡', w / 2, h / 2 + 5);
  }, 64, 64);

  const mat = new THREE.MeshBasicMaterial({
    map: footTex,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geom, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.rotation.z = Math.random() * Math.PI * 2;
  mesh.position.set(x, 0.026, z);
  scene.add(mesh);

  magicFootsteps.push({ mesh, mat, life: 1.0, maxLife: 1.0 });
}

function updateMagicFootsteps(dt) {
  for (let i = magicFootsteps.length - 1; i >= 0; i--) {
    const step = magicFootsteps[i];
    step.life -= dt * 0.85;
    if (step.life <= 0) {
      scene.remove(step.mesh);
      step.mat.dispose();
      step.mesh.geometry.dispose();
      magicFootsteps.splice(i, 1);
    } else {
      step.mat.opacity = (step.life / step.maxLife) * 0.85;
      const s = 1.0 + (1.0 - step.life) * 0.35;
      step.mesh.scale.set(s, s, s);
    }
  }
}

// --- Shooting Stars (Meteors in Night Sky) ---
function spawnMeteor() {
  if (!scene) return;
  const startX = (Math.random() - 0.5) * 40 - 10;
  const startY = 22 + Math.random() * 8;
  const startZ = 10 + (Math.random() - 0.5) * 20;

  const dirX = 14 + Math.random() * 8;
  const dirY = -8 - Math.random() * 4;
  const dirZ = -6 + (Math.random() - 0.5) * 6;

  const mat = new THREE.MeshBasicMaterial({ color: 0xfff4d0, transparent: true, opacity: 1 });
  const geom = new THREE.SphereGeometry(0.18, 6, 6);
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(startX, startY, startZ);
  scene.add(mesh);

  activeMeteors.push({
    mesh, mat,
    pos: new THREE.Vector3(startX, startY, startZ),
    vel: new THREE.Vector3(dirX, dirY, dirZ),
    life: 1.4,
  });
}

function updateMeteors(dt) {
  for (let i = activeMeteors.length - 1; i >= 0; i--) {
    const m = activeMeteors[i];
    m.life -= dt;
    if (m.life <= 0) {
      scene.remove(m.mesh);
      m.mat.dispose();
      m.mesh.geometry.dispose();
      activeMeteors.splice(i, 1);
    } else {
      m.pos.addScaledVector(m.vel, dt);
      m.mesh.position.copy(m.pos);
      m.mat.opacity = Math.min(1.0, m.life / 0.4);
    }
  }
}

// --- Sky Lanterns (فانوس‌های آرزو) ---
function spawnSkyLantern(x, z, customY = 0.5) {
  const group = new THREE.Group();
  group.position.set(x, customY, z);
  scene.add(group);

  const lanternPaper = new THREE.MeshBasicMaterial({ color: 0xffc470, transparent: true, opacity: 0.92 });
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xff7722 });
  const goldRingMat = colorMaterial(0xffd875, 0.2, 0.8);

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.42, 8), lanternPaper);
  body.position.y = 0.21; group.add(body);

  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 6), flameMat);
  flame.position.y = 0.15; group.add(flame);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.018, 6, 12), goldRingMat);
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.03; group.add(ring);

  activeLanterns.push({
    group,
    speedY: 0.9 + Math.random() * 0.6,
    driftX: (Math.random() - 0.5) * 0.4,
    driftZ: (Math.random() - 0.5) * 0.3,
    phase: Math.random() * 6.28,
  });
}

function initSkyLanterns() {
  for (let i = 0; i < 14; i++) {
    const lx = (Math.random() - 0.5) * 28;
    const ly = 3.0 + Math.random() * 22;
    const lz = 18 - Math.random() * 80;
    spawnSkyLantern(lx, lz, ly);
  }
}

function updateSkyLanterns(dt, elapsed) {
  for (let i = 0; i < activeLanterns.length; i++) {
    const l = activeLanterns[i];
    l.group.position.y += l.speedY * dt;
    l.group.position.x += Math.sin(elapsed + l.phase) * l.driftX * dt;
    l.group.position.z += Math.cos(elapsed * 0.8 + l.phase) * l.driftZ * dt;
    l.group.rotation.y = elapsed * 0.3 + l.phase;

    if (l.group.position.y > 32) {
      l.group.position.y = 0.5;
      l.group.position.x = (Math.random() - 0.5) * 26;
      l.group.position.z = 16 - Math.random() * 75;
    }
  }
}

// --- 3D Heart Fireworks System (آتش‌بازی سه‌بعدی) ---
function triggerFireworkShow() {
  playFireworkSound();
  const colors = [0xff2a5c, 0xffd875, 0x48cae4, 0xff758f, 0xc77dff, 0x52b788];
  for (let i = 0; i < 6; i++) {
    setTimeout(() => {
      const fx = (Math.random() - 0.5) * 24;
      const fz = 8 + (Math.random() - 0.5) * 20;
      const color = colors[i % colors.length];
      spawnFireworkBurst(fx, 14 + Math.random() * 6, fz, color);
      triggerConfetti(0.2 + i * 0.12, 0.3);
    }, i * 380);
  }
  showToast('🎆 جشن آتش‌بازی و فانوس‌های آرزو در آسمان!');
}

function spawnFireworkBurst(x, y, z, colorHex) {
  if (!scene) return;
  const particleCount = 42;
  const geom = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const velocities = [];

  for (let i = 0; i < particleCount; i++) {
    positions[i * 3 + 0] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    const angle = (i / particleCount) * Math.PI * 2;
    const speed = 4.2 + Math.random() * 3.5;
    const vx = Math.cos(angle) * speed;
    const vy = (Math.sin(angle) + 0.3) * speed;
    const vz = (Math.random() - 0.5) * speed * 0.8;

    velocities.push({ vx, vy, vz });
  }

  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: colorHex,
    size: 0.28,
    transparent: true,
    opacity: 1.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const points = new THREE.Points(geom, mat);
  scene.add(points);

  activeFireworks.push({ points, geom, velocities, life: 1.6, maxLife: 1.6 });
}

function updateFireworks(dt) {
  for (let i = activeFireworks.length - 1; i >= 0; i--) {
    const fw = activeFireworks[i];
    fw.life -= dt;
    if (fw.life <= 0) {
      scene.remove(fw.points);
      fw.geom.dispose();
      fw.points.material.dispose();
      activeFireworks.splice(i, 1);
    } else {
      const pos = fw.geom.attributes.position.array;
      const gravity = -4.5;
      for (let j = 0; j < fw.velocities.length; j++) {
        const v = fw.velocities[j];
        v.vy += gravity * dt;
        pos[j * 3 + 0] += v.vx * dt;
        pos[j * 3 + 1] += v.vy * dt;
        pos[j * 3 + 2] += v.vz * dt;
      }
      fw.geom.attributes.position.needsUpdate = true;
      fw.points.material.opacity = fw.life / fw.maxLife;
    }
  }
}

// --- Couple Emotes & Poses Handler ---
function setCouplePose(poseName) {
  couplePose = poseName;
  document.querySelectorAll('.emote-btn').forEach((b) => b.classList.remove('is-active'));

  if (poseName === 'dance') {
    $('#emote-dance-btn')?.classList.add('is-active');
    playRomanticChime(659.25);
    setTimeout(() => playRomanticChime(783.99), 180);
    setTimeout(() => playRomanticChime(1046.5), 360);
    showToast('💃 همراه پرنسس شد و شروع به رقصیدن کردند 💖');
    triggerHeartFX(window.innerWidth / 2, window.innerHeight / 2, 8);
  } else if (poseName === 'kiss') {
    $('#emote-kiss-btn')?.classList.add('is-active');
    playRomanticChime(880.0);
    showToast('💋 پرنسس یک بوسه‌ی قلبی به همراهش فرستاد!');
    triggerHeartFX(window.innerWidth / 2, window.innerHeight / 2, 12);
    setTimeout(() => { if (couplePose === 'kiss') setCouplePose('normal'); }, 3200);
  } else if (poseName === 'holding_hands') {
    $('#emote-hands-btn')?.classList.add('is-active');
    playRomanticChime(587.33);
    showToast('👫 دست در دست هم در راهروی رویایی قدم می‌زنید...');
  } else if (poseName === 'sitting') {
    $('#emote-sofa-btn')?.classList.add('is-active');
    playRomanticChime(523.25);
    movementTarget = new THREE.Vector3(-4.8, 0, -62.5);
    showToast('🛋️ به سمت مبل سلطنتی کنار شومینه حرکت می‌کنید ✨');
  } else {
    showToast('حالت گردش عادی فعال شد 🌸');
  }
}

// --- Photo Booth & Polaroid Snapshot Handler ---
function takePolaroidSnapshot() {
  if (!started || !renderer) return;

  playCameraShutterSound();

  const flash = $('#camera-flash-fx');
  if (flash) {
    flash.hidden = false;
    flash.classList.add('flashing');
    setTimeout(() => {
      flash.classList.remove('flashing');
      setTimeout(() => { flash.hidden = true; }, 400);
    }, 120);
  }

  renderer.render(scene, camera);
  const dataURL = canvas.toDataURL('image/png');

  $('#polaroid-image-preview').src = dataURL;
  $('#polaroid-couple').textContent = `${state.fromName || 'من'} ♡ ${state.toName || 'پرنسس من'}`;
  polaroidOverlay.hidden = false;
  syncAnimationLoop();
}

function downloadPolaroidCard() {
  const previewImg = $('#polaroid-image-preview');
  if (!previewImg || !previewImg.src) return;

  const cardCanvas = document.createElement('canvas');
  cardCanvas.width = 1200;
  cardCanvas.height = 1450;
  const ctx = cardCanvas.getContext('2d');

  // Polaroid Paper background
  ctx.fillStyle = '#fdfbf7';
  ctx.fillRect(0, 0, 1200, 1450);

  // Outer paper border
  ctx.strokeStyle = '#ebdccb';
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, 1180, 1430);

  // Gold washi tape on top
  ctx.fillStyle = '#ffd875';
  ctx.save();
  ctx.translate(600, 48);
  ctx.rotate(-0.025);
  ctx.fillRect(-220, -22, 440, 44);
  ctx.fillStyle = '#3b2210';
  ctx.font = 'bold 22px Tahoma, Arial';
  ctx.textAlign = 'center';
  ctx.direction = 'rtl';
  ctx.fillText('🌸 OUR 1ST ANNIVERSARY 🌸', 0, 8);
  ctx.restore();

  // Photo Inset
  const photoX = 60, photoY = 95, photoW = 1080, photoH = 810;
  ctx.fillStyle = '#111420';
  ctx.fillRect(photoX, photoY, photoW, photoH);
  ctx.drawImage(previewImg, photoX, photoY, photoW, photoH);

  // Photo border
  ctx.strokeStyle = '#dfd3c3';
  ctx.lineWidth = 6;
  ctx.strokeRect(photoX, photoY, photoW, photoH);

  // Decorative stickers on photo
  ctx.font = '48px Arial';
  ctx.fillText('👑', photoX + photoW - 55, photoY + 65);
  ctx.fillText('💍', photoX + 55, photoY + 65);
  ctx.fillText('💖', photoX + 55, photoY + photoH - 25);
  ctx.fillText('✨', photoX + photoW - 55, photoY + photoH - 25);

  // Persian Caption
  ctx.textAlign = 'center';
  ctx.direction = 'rtl';
  ctx.fillStyle = '#3d2a20';
  ctx.font = 'bold 44px Tahoma, Arial';
  ctx.fillText('«اولین سالگرد یکی شدنمون مبارک»', 600, 1030);

  ctx.fillStyle = '#c9184a';
  ctx.font = 'bold 36px Tahoma, Arial';
  ctx.fillText(`${state.fromName || 'من'} ♡ ${state.toName || 'پرنسس من'}`, 600, 1120);

  ctx.fillStyle = '#8c7b6d';
  ctx.font = '28px Tahoma, Arial';
  ctx.fillText('۳۶۵ روز خاطره‌ی قشنگ · عشق تا ابد و بی‌نهایت 💍✨', 600, 1210);

  const downloadLink = document.createElement('a');
  downloadLink.download = `Anniversary-Photo-${Date.now()}.png`;
  downloadLink.href = cardCanvas.toDataURL('image/png');
  downloadLink.click();

  showToast('💾 عکس یادگاری با موفقیت در گالری ذخیره شد 🌸');
  triggerConfetti(0.5, 0.4);
}

function closePolaroidModal() {
  polaroidOverlay.hidden = true;
  syncAnimationLoop();
  canvas.focus({ preventScroll: true });
}

// VERY LONG Grand Architecture with Nanaz Walls & Mouldings
function buildHome() {
  const corridorLength = 68.0;
  const corridorCenterZ = -corridorLength / 2;

  const grassTexture = makeGrassTexture();
  const lawn = addGround(64, 44, new THREE.MeshStandardMaterial({ map: grassTexture, roughness: 0.92 }), 0, -0.05, 12);
  lawn.receiveShadow = true;
  floorTargets.push(lawn);

  const pathMat = colorMaterial(0xdfd9ce, 0.84);
  const pathEdge = colorMaterial(0x8a7f72, 0.9);
  const stonePath = addBox(scene, 6.4, 0.03, 22.8, pathMat, 0, -0.035, 10.7, { receiveShadow: true, castShadow: false });
  addBox(scene, 0.07, 0.035, 22.7, pathEdge, -3.22, -0.025, 10.7, { castShadow: false });
  addBox(scene, 0.07, 0.035, 22.7, pathEdge, 3.22, -0.025, 10.7, { castShadow: false });
  floorTargets.push(stonePath);

  const woodTexture = makeWoodTexture();
  const woodFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(21.5, corridorLength + 0.8),
    new THREE.MeshStandardMaterial({ map: woodTexture, roughness: 0.65, metalness: 0.025 })
  );
  woodFloor.rotation.x = -Math.PI / 2; woodFloor.position.set(0, -0.025, corridorCenterZ); woodFloor.receiveShadow = true; scene.add(woodFloor);
  floorTargets.push(woodFloor);

  // Gallery Walkway elements (aisle carpet, floral arches, candles, petals, columns)
  createGalleryWalkway();

  const outerStone = colorMaterial(0xc7bda9, 0.86);
  const innerPlaster = colorMaterial(0xe3ddcf, 0.88);
  const sidePlaster = colorMaterial(0xd8d1c3, 0.9);
  const featureWall = colorMaterial(0x2d342f, 0.86);
  const roofMat = colorMaterial(0x222923, 0.74);
  const walnut = colorMaterial(0x44352c, 0.48, 0.08);
  const brass = colorMaterial(0xffd875, 0.25, 0.8);
  const ceiling = colorMaterial(0xe1d9c9, 0.86);

  // Nanaz Wall Pattern Material for Interior Corridor
  const nanazWallTex = makeNanazWallTexture();
  nanazWallTex.wrapS = THREE.RepeatWrapping;
  nanazWallTex.wrapT = THREE.RepeatWrapping;
  nanazWallTex.repeat.set(12.0, 1.5);
  const nanazWallMat = new THREE.MeshStandardMaterial({ map: nanazWallTex, roughness: 0.6, metalness: 0.1 });

  // Walls for the long corridor
  addBox(scene, 21.8, 7.45, 0.62, featureWall, 0, 3.72, -corridorLength - 0.25);
  addBox(scene, 0.62, 7.45, corridorLength + 0.8, sidePlaster, -10.78, 3.72, corridorCenterZ);
  addBox(scene, 0.62, 7.45, corridorLength + 0.8, sidePlaster, 10.78, 3.72, corridorCenterZ);

  // Interior Nanaz Wall Linings
  addBox(scene, 0.06, 7.25, corridorLength + 0.6, nanazWallMat, -10.42, 3.65, corridorCenterZ, { castShadow: false });
  addBox(scene, 0.06, 7.25, corridorLength + 0.6, nanazWallMat, 10.42, 3.65, corridorCenterZ, { castShadow: false });

  // Wainscoting Chair Rail & Crown Picture Rail Mouldings with Gold Liners
  for (const side of [-10.40, 10.40]) {
    // Baseboard moulding
    addBox(scene, 0.12, 0.32, corridorLength + 0.6, walnut, side, 0.16, corridorCenterZ, { castShadow: false });
    addBox(scene, 0.14, 0.04, corridorLength + 0.6, brass, side, 0.34, corridorCenterZ, { castShadow: false });

    // Chair rail moulding at y = 2.1m
    addBox(scene, 0.12, 0.14, corridorLength + 0.6, walnut, side, 2.10, corridorCenterZ, { castShadow: false });
    addBox(scene, 0.14, 0.04, corridorLength + 0.6, brass, side, 2.18, corridorCenterZ, { castShadow: false });

    // Crown picture rail moulding at y = 6.6m
    addBox(scene, 0.14, 0.18, corridorLength + 0.6, walnut, side, 6.60, corridorCenterZ, { castShadow: false });
    addBox(scene, 0.16, 0.05, corridorLength + 0.6, brass, side, 6.50, corridorCenterZ, { castShadow: false });
  }

  addBox(scene, 8.45, 7.25, 0.72, outerStone, -6.775, 3.62, 0.0);
  addBox(scene, 8.45, 7.25, 0.72, outerStone, 6.775, 3.62, 0.0);
  addBox(scene, 5.3, 2.78, 0.72, outerStone, 0, 5.86, 0.0);
  addBox(scene, 8.3, 7.05, 0.045, innerPlaster, -6.85, 3.58, -0.39, { castShadow: false });
  addBox(scene, 8.3, 7.05, 0.045, innerPlaster, 6.85, 3.58, -0.39, { castShadow: false });
  addBox(scene, 5.2, 2.65, 0.045, innerPlaster, 0, 5.9, -0.39, { castShadow: false });

  // Roof & Ceiling
  addBox(scene, 23.8, 0.5, corridorLength + 3.0, roofMat, 0, 7.62, corridorCenterZ + 0.25);
  addBox(scene, 24.1, 0.18, 0.28, walnut, 0, 7.28, 0.22);
  addBox(scene, 21.25, 0.18, corridorLength + 0.4, ceiling, 0, 7.25, corridorCenterZ, { castShadow: false });

  createFacadeWindow(-6.8, 3.55, 3.5, 2.65);
  createFacadeWindow(6.8, 3.55, 3.5, 2.65);

  for (const side of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      const x = side * (2.82 + i * 0.105);
      addBox(scene, 0.055, 4.35, 0.07, i % 2 ? walnut : brass, x, 2.25, 0.42, { castShadow: false });
    }
  }

  addBox(scene, 8.6, 0.32, 3.4, colorMaterial(0x3c3831, 0.5, 0.1), 0, 5.05, 1.55);
  addBox(scene, 8.8, 0.12, 3.5, brass, 0, 4.87, 1.55, { castShadow: false });

  for (const x of [-3.68, 3.68]) {
    addBox(scene, 0.36, 4.88, 0.42, outerStone, x, 2.48, 2.72);
  }

  const stepStone = colorMaterial(0xbab09f, 0.7);
  for (let i = 0; i < 3; i++) {
    addBox(scene, 7.8 - i * 0.65, 0.13, 0.62, stepStone, 0, 0.09 + i * 0.02, 0.72 + i * 0.58, { castShadow: false });
  }

  leftDoorPivot = createDoorPivot(1);
  rightDoorPivot = createDoorPivot(-1);

  // Large Interactive Door Hitbox for Mobile Tap & Desktop Click
  const doorClickTarget = new THREE.Mesh(
    new THREE.BoxGeometry(5.6, 4.6, 1.5),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  doorClickTarget.position.set(0, 2.2, 0.42);
  doorClickTarget.userData = { type: 'door' };
  scene.add(doorClickTarget);
  interactiveTargets.push(doorClickTarget);

  const wallGlow = new THREE.MeshBasicMaterial({ color: 0xffdfaa });
  for (const x of [-3.2, 3.2]) {
    addBox(scene, 0.32, 0.52, 0.25, walnut, x, 3.6, 0.56);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), wallGlow);
    glow.position.set(x, 3.6, 0.72);
    scene.add(glow);
  }

  const dedicationTex = createDedicationTexture();
  const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.68), new THREE.MeshBasicMaterial({ map: dedicationTex }));
  signMesh.position.set(0, 4.25, 0.88);
  scene.add(signMesh);
  dedicationSign = signMesh;

  createPlanter(-4.65, 0, 1.6);
  createPlanter(4.65, 0, 1.6);
  createTree(-13.7, 4.5, 1.35); createTree(13.7, 4.5, 1.35);
  createTree(-16.5, 11.5, 1.0); createTree(16.5, 11.5, 1.0);
  for (const z of [5.2, 10.2, 15.2, 19.5]) { createPathLight(-4.3, z); createPathLight(4.3, z); }

  // Architectural Gothic/Palace Ribbed Vaults & Stained Glass Windows
  createRibbedVaultedCeiling(corridorLength, corridorCenterZ);
  createStainedGlassWindows();

  // Grand Interactive Objects
  createGrandPiano(5.8, 0, -20.0);
  createWishingFountain(-8.8, 10.5);
  createRoyalLoungeSuite(0, -60.8);

  createLoveMonument(0, 7.5);
  createFireplaceAndAnniversaryMantle();
  createFairyLights();
  createFloatingParticles();
  initSkyLanterns();

  // --- Optimized Rock-Solid Global Lighting (Guaranteed Bright & Rich on ALL Mobile Devices) ---
  const ambientLight = new THREE.AmbientLight(0xfff6ea, 1.75);
  scene.add(ambientLight);

  const hemiLight = new THREE.HemisphereLight(0xffe6ee, 0x2d2229, 1.35);
  scene.add(hemiLight);

  const sunMoon = new THREE.DirectionalLight(0xfff8ed, 2.2);
  sunMoon.position.set(-14, 24, 12);
  sunMoon.castShadow = true;
  sunMoon.shadow.mapSize.set(isMobileViewport() ? 512 : 1024, isMobileViewport() ? 512 : 1024);
  scene.add(sunMoon);

  const fillLight = new THREE.DirectionalLight(0xffdbe6, 1.1);
  fillLight.position.set(14, 18, -12);
  scene.add(fillLight);

  const porchLight = new THREE.PointLight(0xffc97e, 3.5, 12, 2);
  porchLight.position.set(0, 4.6, 1.5);
  scene.add(porchLight);

  const starPositions = [];
  let seed = 19;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  for (let i = 0; i < 220; i++) starPositions.push((random() - 0.5) * 80, 10 + random() * 24, -3 + random() * 50);
  const starGeometry = new THREE.BufferGeometry(); starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xfff0d8, size: 0.12, transparent: true, opacity: 0.72 }));
  scene.add(stars);

  const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(1.05, 20, 16), new THREE.MeshBasicMaterial({ color: 0xfff3cf }));
  moonMesh.position.set(-18, 15.5, 1.5); scene.add(moonMesh);

  createGiantLoveLetterAltar(0, -62.5);
}

function createWorld() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x131526);
  camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 140);
  camera.position.set(0, 3.2, 19.0);
  if (!createRenderer()) return;

  buildHome();
  addMemoryFrames();

  // Create High-Quality Miniature Chibi Princess Avatar (Girlfriend in pink ballgown with golden tiara)
  player = createPrincessAvatar({
    name: state.toName || 'پرنسس من',
    shirt: state.avatarColor || '#ff758f',
    skin: 0xffe2d2,
    hair: 0x241812,
  });
  player.position.copy(playerPosition); player.rotation.y = 0; scene.add(player);

  // Miniature Companion Avatar (Boyfriend in Dashing Suit)
  companion = createCompanionAvatar({
    name: state.fromName || 'من',
    shirt: 0x24222b,
    skin: 0xd9aa88,
    hair: 0x2e2420,
  });
  companion.position.set(-0.95, 0, 15.0); companion.rotation.y = 0; scene.add(companion);

  cameraLookTarget.copy(player.position).add(new THREE.Vector3(0, 0.95, 0));
  updateCamera(1, 0.016);

  clock = new THREE.Clock();
  clock.stop();
  renderer.setAnimationLoop(null);
}

// Ultra-Smooth Third-Person Camera with Flawless Framing and Collision Avoidance
function updateCamera(smoothFactor = 1, dt = 0.016) {
  if (!camera || !player) return;

  const rotDamp = 1 - Math.exp(-dt * 16.0);
  cameraYaw = lerp(cameraYaw, targetYaw, rotDamp);
  cameraPitch = lerp(cameraPitch, targetPitch, rotDamp);
  cameraDistance = lerp(cameraDistance, targetDistance, 1 - Math.exp(-dt * 14.0));

  // Dynamic look target: centered on miniature character
  const leadOffset = new THREE.Vector3(playerVelocity.x * 0.15, 0, playerVelocity.z * 0.15);
  const lookDesiredY = insideHouse ? 0.95 : 0.85;
  desiredCameraLook.set(
    player.position.x + leadOffset.x,
    player.position.y + lookDesiredY,
    player.position.z + leadOffset.z
  );

  cameraLookTarget.lerp(desiredCameraLook, 1 - Math.exp(-dt * 15.0));

  const cosPitch = Math.cos(cameraPitch);
  const sinPitch = Math.sin(cameraPitch);
  const sinYaw = Math.sin(cameraYaw);
  const cosYaw = Math.cos(cameraYaw);

  const desiredPos = new THREE.Vector3(
    cameraLookTarget.x - sinYaw * cosPitch * cameraDistance,
    cameraLookTarget.y + sinPitch * cameraDistance + (insideHouse ? 0.25 : 0.50),
    cameraLookTarget.z + cosYaw * cosPitch * cameraDistance
  );

  // Prevent clipping through floor or side walls
  if (desiredPos.y < 0.75) desiredPos.y = 0.75;
  if (insideHouse) {
    desiredPos.x = clamp(desiredPos.x, -8.6, 8.6);
    desiredPos.z = clamp(desiredPos.z, -66.8, 1.8);
  }

  camera.position.lerp(desiredPos, 1 - Math.exp(-dt * 16.0));
  camera.lookAt(cameraLookTarget);
}

function animateAvatar(avatar, time, walking, offset = 0, speed = 1) {
  if (!avatar) return;
  const u = avatar.userData;
  const phase = time * (walking ? 11.0 * speed : 2.2) + u.phase + offset;
  const amp = walking ? Math.min(0.55, 0.44 * speed) : 0.02;

  if (u.leftLeg) u.leftLeg.rotation.x = Math.sin(phase) * amp;
  if (u.rightLeg) u.rightLeg.rotation.x = -Math.sin(phase) * amp;
  if (u.leftArm) u.leftArm.rotation.x = -Math.sin(phase) * amp * 0.62;
  if (u.rightArm) u.rightArm.rotation.x = Math.sin(phase) * amp * 0.62;

  // Couple Poses Special Arm & Body Overrides
  if (couplePose === 'dance') {
    if (avatar === player) {
      if (u.leftArm) u.leftArm.rotation.x = -0.75 + Math.sin(time * 3.0) * 0.15;
      if (u.rightArm) u.rightArm.rotation.x = -0.75 - Math.sin(time * 3.0) * 0.15;
    } else if (avatar === companion) {
      if (u.leftArm) u.leftArm.rotation.x = -0.75 - Math.sin(time * 3.0) * 0.15;
      if (u.rightArm) u.rightArm.rotation.x = -0.75 + Math.sin(time * 3.0) * 0.15;
    }
  } else if (couplePose === 'holding_hands') {
    if (avatar === player && u.rightArm) u.rightArm.rotation.z = -0.32;
    if (avatar === companion && u.leftArm) u.leftArm.rotation.z = 0.32;
  } else if (couplePose === 'sitting') {
    if (u.leftLeg) u.leftLeg.rotation.x = -1.45;
    if (u.rightLeg) u.rightLeg.rotation.x = -1.45;
    if (u.leftArm) u.leftArm.rotation.x = -0.4;
    if (u.rightArm) u.rightArm.rotation.x = -0.4;
    u.rig.position.y = 0.08 + Math.sin(time * 1.5) * 0.01;
    return;
  }

  // Princess gown mini sway
  if (u.skirtGroup) {
    u.skirtGroup.rotation.z = walking ? Math.sin(phase * 0.5) * 0.07 : Math.sin(time * 1.5) * 0.015;
    u.skirtGroup.rotation.x = walking ? Math.cos(phase) * 0.05 : 0;
  }
  if (u.bowGroup) {
    u.bowGroup.rotation.x = walking ? Math.sin(phase) * 0.09 : 0;
  }

  u.rig.position.y = walking ? Math.abs(Math.sin(phase * 0.5)) * (0.04 * speed) : Math.sin(time * 1.3 + u.phase) * 0.015;
  u.head.rotation.z = walking ? Math.sin(phase * 0.35) * 0.02 : Math.sin(time * 1.0 + u.phase) * 0.012;
}

function updateDoor(dt) {
  if (!leftDoorPivot || !rightDoorPivot) return;
  doorProgress = lerp(doorProgress, doorTarget, 1 - Math.exp(-dt * 2.8));
  leftDoorPivot.rotation.y = doorProgress * 1.22;
  rightDoorPivot.rotation.y = -doorProgress * 1.22;
}

function isNearDoor() {
  return Boolean(player && !insideHouse && !entryQueued && Math.abs(player.position.x) < 4.55 && player.position.z < 4.5 && player.position.z > 0.6);
}

function updateSceneLocation() {
  const label = $('#scene-location')?.querySelector('span:last-child');
  if (label) label.textContent = insideHouse ? 'راهروی رویایی و باشکوه خاطرات' : 'حیاط خانه';
  const subtitle = $('#hud-subtitle');
  if (subtitle) subtitle.textContent = insideHouse ? `راهروی خاطرات ۱ سالگی` : 'جلوی خانه‌ی خاطره‌ها';
}

function setHouseZone(inside) {
  if (insideHouse === inside) return;
  insideHouse = inside;
  if (inside) {
    targetDistance = 5.2; targetPitch = 0.15; doorTarget = 1;
    showToast(`به راهروی خاطرات ۱ سالگی ${state.toName} خوش آمدی 🌸`);
  } else {
    targetDistance = 7.0; targetPitch = 0.20;
    showToast('به حیاط خانه برگشتی');
  }
  updateSceneLocation();
}

// Cinematic Auto-Tour Handler along the long corridor
function startCinematicTour() {
  if (!started) return;
  isTouring = true;
  $('#cinema-tour-btn')?.classList.add('is-touring');
  showToast('🎬 تور سینمایی راهروی خاطرات شروع شد');

  if (!insideHouse) {
    doorTarget = 1;
    movementTarget = new THREE.Vector3(0, 0, -6.5);
  }

  tourStep = 0;
  advanceTourStep();
}

function advanceTourStep() {
  if (!isTouring) return;
  if (tourStep >= frameRecords.length) {
    // Grand Finale at Fireplace & Anniversary Altar
    movementTarget = new THREE.Vector3(0, 0, -64.5);
    targetYaw = 0;
    setTimeout(() => {
      stopCinematicTour();
      showToast('✨ به انتهای راهرو رسیدیم! اولین سالگردمون مبارک 💍');
      openAnniversaryModal();
    }, 4500);
    return;
  }

  const record = frameRecords[tourStep];
  const approachDistance = 2.8;
  movementTarget = new THREE.Vector3(
    record.x + Math.sin(record.rotationY) * approachDistance,
    0,
    record.z + Math.cos(record.rotationY) * approachDistance,
  );

  targetYaw = record.rotationY + Math.PI;

  tourTimer = setTimeout(() => {
    if (!isTouring) return;
    openMemory(record.memory, record.index);
    tourTimer = setTimeout(() => {
      if (!isTouring) return;
      closeMemory();
      tourStep++;
      advanceTourStep();
    }, 4500);
  }, 4200);
}

function stopCinematicTour() {
  isTouring = false;
  clearTimeout(tourTimer);
  $('#cinema-tour-btn')?.classList.remove('is-touring');
}

// Main Physics & Update Loop
function updateGame(dt, elapsed) {
  updateDoor(dt);
  TWEEN.update();

  if (!isDraggingCamera) {
    targetYaw += yawVelocity * dt;
    targetPitch = clamp(targetPitch + pitchVelocity * dt, 0.02, 0.58);
    yawVelocity = lerp(yawVelocity, 0, 1 - Math.exp(-dt * 8.0));
    pitchVelocity = lerp(pitchVelocity, 0, 1 - Math.exp(-dt * 8.0));
  }

  if (fireplaceLight) {
    fireplaceLight.intensity = 4.2 + Math.sin(elapsed * 9.5) * 0.6 + Math.cos(elapsed * 14.2) * 0.4;
  }

  if (crystalHeartMesh) {
    crystalHeartMesh.rotation.y = elapsed * 0.85;
    crystalHeartMesh.position.y = 1.62 + Math.sin(elapsed * 2.2) * 0.06;
  }

  if (candleFlames.length > 0) {
    candleFlames.forEach((candle) => {
      const flick = 0.85 + Math.sin(elapsed * 8.0 + candle.phase) * 0.18;
      candle.flame.scale.set(flick, flick, flick);
    });
  }

  if (giantLetterHearts.length > 0) {
    giantLetterHearts.forEach((item) => {
      item.mesh.position.y = item.baseY + Math.sin(elapsed * 2.4 + item.phase) * 0.12;
      item.mesh.rotation.y = elapsed * 1.6 + item.phase;
    });
  }

  updateFloatingParticles(dt, elapsed);
  updateMagicFootsteps(dt);
  updateMeteors(dt);
  updateSkyLanterns(dt, elapsed);
  updateFireworks(dt);

  // Auto Shooting Stars occasionally in the night sky
  nextMeteorTime -= dt;
  if (nextMeteorTime <= 0) {
    spawnMeteor();
    nextMeteorTime = 5.0 + Math.random() * 7.0;
  }

  if (!started || !player) {
    updateCamera(1, dt);
    return;
  }

  if (currentMemory || !helpOverlay.hidden || !anniversaryOverlay.hidden || !loveletterOverlay.hidden || !polaroidOverlay.hidden) {
    animateAvatar(player, elapsed, false);
    animateAvatar(companion, elapsed, false, 1.4);
    updateCamera(1, dt);
    return;
  }

  if (entryQueued && doorProgress > 0.72 && !movementTarget) {
    movementTarget = new THREE.Vector3(0, 0, -6.2);
  }

  const forwardInput = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  const sideInput = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);

  if (forwardInput || sideInput || touchMoveActive) {
    if (isTouring) stopCinematicTour();
  }

  const desiredVelocity = new THREE.Vector3();

  // Dynamic Touch Movement (Dragging anywhere on screen)
  if (touchMoveActive && touchVector.lengthSq() > 0.02) {
    const forward = new THREE.Vector3(Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
    const right = new THREE.Vector3(Math.cos(cameraYaw), 0, Math.sin(cameraYaw));
    const moveDir = forward.multiplyScalar(-touchVector.y).add(right.multiplyScalar(touchVector.x));
    if (moveDir.lengthSq() > 0.01) {
      moveDir.normalize();
      const speed = (keys.has('ShiftLeft') ? 5.2 : 3.6) * Math.min(1.0, touchVector.length());
      desiredVelocity.copy(moveDir).multiplyScalar(speed);
      playerTargetRot = Math.atan2(-moveDir.x, -moveDir.z);
    }
  } else if (movementTarget) {
    const delta = movementTarget.clone().sub(player.position); delta.y = 0;
    const distance = delta.length();
    if (distance < 0.24) {
      movementTarget = null;
      if (entryQueued) { entryQueued = false; showToast('قدم بزن و قاب‌های بزرگ راهرو را ببین'); }
    } else {
      delta.normalize();
      const speed = Math.min(3.6, distance * 2.5);
      desiredVelocity.copy(delta).multiplyScalar(speed);
      playerTargetRot = Math.atan2(-delta.x, -delta.z);
    }
  } else if (forwardInput || sideInput) {
    const forward = new THREE.Vector3(Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
    const right = new THREE.Vector3(Math.cos(cameraYaw), 0, Math.sin(cameraYaw));
    const direction = forward.multiplyScalar(forwardInput).add(right.multiplyScalar(sideInput));
    if (direction.lengthSq() > 0) {
      direction.normalize();
      const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 5.2 : 3.5;
      desiredVelocity.copy(direction).multiplyScalar(speed);
      playerTargetRot = Math.atan2(-direction.x, -direction.z);
    }
  }

  const accelDamp = 1 - Math.exp(-dt * 15.0);
  playerVelocity.x = lerp(playerVelocity.x, desiredVelocity.x, accelDamp);
  playerVelocity.z = lerp(playerVelocity.z, desiredVelocity.z, accelDamp);

  player.position.x += playerVelocity.x * dt;
  player.position.z += playerVelocity.z * dt;

  const currentSpeed = playerVelocity.length();
  const isMoving = currentSpeed > 0.08;

  if (isMoving) {
    player.rotation.y = lerpAngle(player.rotation.y, playerTargetRot, 1 - Math.exp(-dt * 16.0));
  }

  const doorPassable = doorProgress > 0.72 && Math.abs(player.position.x) < 2.62;
  if (insideHouse) {
    player.position.x = clamp(player.position.x, -9.6, 9.6);
    player.position.z = clamp(player.position.z, -67.2, doorPassable ? 2.2 : -0.55);
  } else {
    player.position.x = clamp(player.position.x, -17.0, 17.0);
    player.position.z = clamp(player.position.z, doorPassable ? -6.5 : 1.0, 22.0);
  }
  if (!insideHouse && doorPassable && player.position.z < 0.1) setHouseZone(true);
  if (insideHouse && doorPassable && player.position.z > 0.85) setHouseZone(false);
  playerPosition.copy(player.position);

  // Spawn Magic Footstep Sparkles on Princess Steps
  if (isMoving && currentSpeed > 0.25) {
    lastFootstepTime += dt;
    if (lastFootstepTime > 0.24) {
      lastFootstepTime = 0;
      footstepToggle = !footstepToggle;
      const footOffsetX = Math.cos(player.rotation.y + Math.PI / 2) * (footstepToggle ? 0.12 : -0.12);
      const footOffsetZ = -Math.sin(player.rotation.y + Math.PI / 2) * (footstepToggle ? 0.12 : -0.12);
      spawnMagicFootstep(player.position.x + footOffsetX, player.position.z + footOffsetZ);
    }
  }

  // --- Couple Emotes Behavior ---
  if (couplePose === 'dance') {
    // Face each other and waltz together!
    const danceCenter = player.position.clone();
    player.rotation.y += dt * 1.35;
    companion.position.set(
      danceCenter.x + Math.sin(player.rotation.y) * 0.85,
      0,
      danceCenter.z + Math.cos(player.rotation.y) * 0.85
    );
    companion.rotation.y = player.rotation.y + Math.PI;

    if (Math.random() < 0.05) {
      triggerHeartFX(
        window.innerWidth / 2 + (Math.random() - 0.5) * 100,
        window.innerHeight / 2 + (Math.random() - 0.5) * 80,
        1
      );
    }
  } else if (couplePose === 'holding_hands') {
    // Companion walks closely side by side
    const sideOffset = new THREE.Vector3(Math.cos(cameraYaw), 0, Math.sin(cameraYaw)).multiplyScalar(-0.62);
    const handTarget = player.position.clone().add(sideOffset);
    companion.position.lerp(handTarget, 1 - Math.exp(-dt * 14.0));
    companion.rotation.y = lerpAngle(companion.rotation.y, player.rotation.y, 1 - Math.exp(-dt * 14.0));
  } else if (couplePose === 'sitting') {
    // Sitting beside each other on royal lounge sofa
    if (player.position.distanceTo(new THREE.Vector3(-4.8, 0, -62.5)) < 1.2) {
      player.position.set(-4.8, 0.38, -62.1);
      player.rotation.y = Math.PI / 2;
      companion.position.set(-4.8, 0.38, -62.8);
      companion.rotation.y = Math.PI / 2;
    }
  } else {
    // Normal follow
    const side = new THREE.Vector3(Math.cos(cameraYaw), 0, Math.sin(cameraYaw)).multiplyScalar(-0.95);
    const behind = new THREE.Vector3(Math.sin(cameraYaw), 0, Math.cos(cameraYaw)).multiplyScalar(0.40);
    const followTarget = player.position.clone().add(side).add(behind);
    if (insideHouse) {
      followTarget.x = clamp(followTarget.x, -9.2, 9.2); followTarget.z = clamp(followTarget.z, -66.8, -0.5);
    } else {
      followTarget.x = clamp(followTarget.x, -15.5, 15.5); followTarget.z = clamp(followTarget.z, 1.2, 21.5);
    }

    companion.position.lerp(followTarget, 1 - Math.exp(-dt * 3.0));
    const toPlayer = player.position.clone().sub(companion.position); toPlayer.y = 0;
    if (toPlayer.lengthSq() > 0.01) {
      const compTargetRot = Math.atan2(-toPlayer.x, -toPlayer.z);
      companion.rotation.y = lerpAngle(companion.rotation.y, compTargetRot, 1 - Math.exp(-dt * 12.0));
    }
  }

  animateAvatar(player, elapsed, isMoving || couplePose === 'dance', 0, currentSpeed / 3.2);
  animateAvatar(companion, elapsed, (isMoving && companion.position.distanceTo(player.position) > 0.6) || couplePose === 'dance', 1.4, 1.0);

  updateCamera(1, dt);
  updateInteractions();
  updateRadar();
}

function updateRadar() {
  const playerPin = $('#radar-player-pin');
  const companionPin = $('#radar-companion-pin');
  if (!playerPin || !player) return;

  const minZ = -68.0;
  const maxZ = 20.0;
  const totalRange = maxZ - minZ;

  const playerNorm = clamp((maxZ - player.position.z) / totalRange, 0.05, 0.95);
  playerPin.style.top = `${(playerNorm * 100).toFixed(1)}%`;

  if (companionPin && companion) {
    const compNorm = clamp((maxZ - companion.position.z) / totalRange, 0.05, 0.95);
    companionPin.style.top = `${(compNorm * 100).toFixed(1)}%`;
  }
}

function render() {
  if (!renderer || !scene || !camera) return;
  const dt = Math.min(clock ? clock.getDelta() : 0.016, 0.033);
  const elapsed = clock ? clock.elapsedTime : 0;
  updateGame(dt, elapsed);
  renderer.render(scene, camera);
}

function syncAnimationLoop() {
  if (!renderer) return;
  const shouldRender = started && !document.hidden && memoryOverlay.hidden && helpOverlay.hidden && anniversaryOverlay.hidden && loveletterOverlay.hidden && polaroidOverlay.hidden;
  if (shouldRender) {
    clock?.start();
    renderer.setAnimationLoop(render);
  } else {
    clock?.stop();
    renderer.setAnimationLoop(null);
  }
}

const anniversaryWishes = [
  '✨ آرزوت ثبت شد: تا همیشه کنار هم شادترین و خوشبخت‌ترین باشیم! 💖',
  '🌸 آرزوت ثبت شد: ۳۶۵ روز عشق، مقدمه‌ی یک عمر با هم بودنمونه! 💍',
  '💖 آرزوت ثبت شد: خنده‌های قشنگت تا همیشه آرامش قلبم باشه! ✨',
  '👑 آرزوت ثبت شد: پرنسس قشنگم، همیشه مثل ماه بدرخشی! 🌸'
];

function makeWishingWellWish() {
  playWishingWellSplash();
  const wish = anniversaryWishes[Math.floor(Math.random() * anniversaryWishes.length)];
  showToast(wish);
  createFloatingHeartAtPosition(-8.8, 1.2, 10.5);
  setTimeout(() => createFloatingHeartAtPosition(-8.8, 1.6, 10.5), 180);
}

function playGrandPiano() {
  playGrandPianoMelody();
  showToast('🎹 در حال نواختن ملودی رویایی سالگرد عشقمون... 💖✨');
  for (let i = 0; i < 8; i++) {
    setTimeout(() => {
      createFloatingHeartAtPosition(5.8 + (Math.random() - 0.5) * 1.5, 1.8, -20.0 + (Math.random() - 0.5) * 1.2);
    }, i * 220);
  }
}

function updateInteractions() {
  if (!player) return;
  const card = $('#interaction-card');
  const button = $('#interact-button');
  const copy = $('#interaction-copy');
  const buttonLabel = button.querySelector('span:nth-child(2)');
  nearestMemory = null;
  nearestInteractable = null;

  if (!insideHouse) {
    const dFountain = Math.hypot(player.position.x - (-8.8), player.position.z - 10.5);
    if (dFountain < 3.2) {
      nearestInteractable = { type: 'wishing-fountain' };
      card.classList.remove('is-hidden');
      copy.textContent = 'نزدیک فواره‌ی آرزو هستی؛ برای انداختن سکه و ثبت آرزو دکمه را بزن 🪙✨';
      buttonLabel.textContent = '🪙 انداختن سکه و ثبت آرزو';
      button.disabled = false;
      updateProgress();
      return;
    }

    if (loveMonument) {
      const dMon = Math.hypot(player.position.x - loveMonument.x, player.position.z - loveMonument.z);
      if (dMon < 2.8) {
        nearestInteractable = { type: 'love-monument' };
        card.classList.remove('is-hidden');
        copy.textContent = 'نزدیک تندیس عشق هستی؛ برای ثبتِ «دوستت دارم» دکمه را بزن';
        buttonLabel.textContent = '❤️ ثبتِ دوستت دارم';
        button.disabled = false;
        updateProgress();
        return;
      }
    }
  }

  if (insideHouse) {
    const dPiano = Math.hypot(player.position.x - 5.8, player.position.z - (-20.0));
    if (dPiano < 3.2) {
      nearestInteractable = { type: 'piano' };
      card.classList.remove('is-hidden');
      copy.textContent = 'نزدیک پیانوی رویایی هستی؛ برای نواختن ملودی عاشقانه دکمه را بزن 🎹✨';
      buttonLabel.textContent = '🎹 نواختن پیانوی عاشقانه';
      button.disabled = false;
      updateProgress();
      return;
    }

    const dSofa = Math.hypot(player.position.x - 0, player.position.z - (-60.8));
    if (dSofa < 3.0) {
      nearestInteractable = { type: 'sofa' };
      card.classList.remove('is-hidden');
      copy.textContent = 'نزدیک مبل راحتی و شومینه هستی؛ برای نشستن دونفره دکمه را بزن 🛋️';
      buttonLabel.textContent = '🛋️ نشستن دونفره کنار شومینه';
      button.disabled = false;
      updateProgress();
      return;
    }

    const dLetter = Math.hypot(player.position.x - 0, player.position.z - (-62.5));
    if (dLetter < 4.5) {
      nearestInteractable = { type: 'love-letter' };
      card.classList.remove('is-hidden');
      copy.textContent = 'نزدیک پاکت نامه‌ی ۱ سالگی هستی؛ برای خواندن نامه لمس کن یا دکمه را بزن 💌';
      buttonLabel.textContent = '💌 بازکردن و خواندن نامه‌ی ۱ سالگی';
      button.disabled = false;
      updateProgress();
      return;
    }

    const dMantel = Math.hypot(player.position.x - 0, player.position.z - (-67.5));
    if (dMantel < 3.8) {
      nearestInteractable = { type: 'anniversary-mantle' };
      card.classList.remove('is-hidden');
      copy.textContent = 'کتیبه‌ی ۱ سالگی عشقمون؛ برای دیدن جشن دکمه را بزن';
      buttonLabel.textContent = '💍 جشنِ اولین سالگرد';
      button.disabled = false;
      updateProgress();
      return;
    }
  }

  if (!insideHouse) {
    if (started && isNearDoor() && !entryQueued) {
      card.classList.remove('is-hidden');
      copy.textContent = doorProgress > 0.72 ? 'در باز است؛ برای ورود به راهرو دکمه را بزن' : 'جلوی در ایستادی؛ برای ورود دکمه را بزن';
      buttonLabel.textContent = doorProgress > 0.72 ? 'وارد راهرو شو' : 'بازکردن در و ورود';
      button.disabled = false;
    } else {
      card.classList.add('is-hidden');
      buttonLabel.textContent = entryQueued ? 'لغو ورود' : movementTarget ? 'توقف حرکت' : 'حرکت خودکار به سمت در';
      button.disabled = !started;
    }
    updateProgress();
    return;
  }

  let best = null; let bestDistance = Infinity;
  for (const record of frameRecords) {
    const dx = player.position.x - record.x;
    const dz = player.position.z - record.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    if (distance < bestDistance) { bestDistance = distance; best = record; }
  }
  nearestMemory = bestDistance < 4.2 ? best : null;
  if (nearestMemory && started && !currentMemory) {
    card.classList.remove('is-hidden');
    copy.textContent = `برای دیدن «${nearestMemory.memory.title}» دکمه را بزن`;
    buttonLabel.textContent = `دیدن: ${nearestMemory.memory.title}`;
    button.disabled = false;
  } else {
    card.classList.add('is-hidden');
    buttonLabel.textContent = movementTarget ? 'توقف حرکت' : 'رفتن به نزدیک‌ترین قاب';
    button.disabled = !started;
  }
  updateProgress();
}

function updateProgress() {
  const visited = Number(localStorage.getItem('our-museum-visited') || '0');
  const count = clamp(visited, 0, memories.length);
  $('#progress-count').textContent = `${toPersianDigits(count)} / ${toPersianDigits(memories.length)}`;
  $('#progress-bar').style.width = `${(count / memories.length) * 100}%`;
}

function openMemory(memory, index) {
  if (!memory) return;
  currentMemory = memory;
  movementTarget = null;
  $('#memory-title').textContent = memory.title;
  $('#memory-caption').textContent = memory.caption;
  $('#memory-date').textContent = memory.date || `یادگاری شماره‌ی ${toPersianDigits(index + 1)}`;
  $('#memory-author').textContent = state.fromName;

  const cardEl = $('#memory-card-element');
  memories.forEach((m) => {
    if (m.frameStyle?.borderClass) cardEl.classList.remove(m.frameStyle.borderClass);
  });
  if (memory.frameStyle?.borderClass) {
    cardEl.classList.add(memory.frameStyle.borderClass);
  }

  const frameBadge = $('#memory-frame-stylename');
  if (frameBadge) {
    frameBadge.textContent = memory.frameStyle?.styleName || 'قاب اختصاصی';
  }

  const art = $('#memory-art-placeholder');
  const photo = $('#memory-photo');
  art.style.setProperty('--tone1', memory.palette[0]);
  art.style.setProperty('--tone2', memory.palette[1]);
  art.style.setProperty('--tone3', memory.palette[2]);
  art.querySelector('.art-corner-mark').textContent = `MEMORY / ${String(index + 1).padStart(2, '0')}`;

  if (memory.imageSrc) {
    photo.src = memory.imageSrc; photo.hidden = false; art.classList.add('has-photo');
  } else {
    photo.hidden = true; photo.removeAttribute('src'); art.classList.remove('has-photo');
  }

  const alreadySeen = new Set(JSON.parse(localStorage.getItem('our-museum-seen') || '[]'));
  alreadySeen.add(memory.id);
  localStorage.setItem('our-museum-seen', JSON.stringify([...alreadySeen]));
  localStorage.setItem('our-museum-visited', String(alreadySeen.size));
  updateProgress();

  updateLoveUI();
  memoryOverlay.hidden = false;
  syncAnimationLoop();
  $('#close-memory').focus({ preventScroll: true });
}

function closeMemory() {
  memoryOverlay.hidden = true;
  currentMemory = null;
  syncAnimationLoop();
  canvas.focus({ preventScroll: true });
  updateInteractions();
}

function openAnniversaryModal() {
  $('#anniv-from').textContent = state.fromName;
  $('#anniv-to').textContent = state.toName;
  $('#anniversary-card-msg').textContent = state.anniversaryMsg;
  updateLoveUI();
  anniversaryOverlay.hidden = false;
  playCelebrationChord();
  triggerConfetti(0.5, 0.4);
  triggerHeartFX(window.innerWidth / 2, window.innerHeight / 2, 8);
  syncAnimationLoop();
  $('#close-anniversary').focus({ preventScroll: true });
}

function closeAnniversaryModal() {
  anniversaryOverlay.hidden = true;
  syncAnimationLoop();
  canvas.focus({ preventScroll: true });
  updateInteractions();
}

function openLoveLetterModal() {
  $('#loveletter-title').textContent = `برای ${state.toName || 'پرنسس من'}`;
  $('#loveletter-from-sign').textContent = `${state.fromName || 'همراه تو'} برای ${state.toName || 'پرنسس من'}`;
  loveletterOverlay.hidden = false;
  playCelebrationChord();
  triggerConfetti(0.5, 0.4);
  triggerHeartFX(window.innerWidth / 2, window.innerHeight / 2, 10);
  syncAnimationLoop();
  $('#close-loveletter').focus({ preventScroll: true });
}

function closeLoveLetterModal() {
  loveletterOverlay.hidden = true;
  syncAnimationLoop();
  canvas.focus({ preventScroll: true });
  updateInteractions();
}

function beginEntry() {
  entryQueued = true;
  doorTarget = 1;
  movementTarget = new THREE.Vector3(0, 0, -5.0);
  playRomanticChime(659.25);
  showToast('در باز شد؛ در حال ورود به راهروی رویایی 🌸');
}

function interactNearest() {
  if (!started || currentMemory || !helpOverlay.hidden || !anniversaryOverlay.hidden || !loveletterOverlay.hidden) return;

  if (nearestInteractable?.type === 'wishing-fountain') {
    makeWishingWellWish();
    return;
  }
  if (nearestInteractable?.type === 'piano') {
    playGrandPiano();
    return;
  }
  if (nearestInteractable?.type === 'sofa') {
    setCouplePose('sitting');
    return;
  }
  if (nearestInteractable?.type === 'love-monument') {
    addLoveCount();
    return;
  }
  if (nearestInteractable?.type === 'anniversary-mantle') {
    openAnniversaryModal();
    return;
  }
  if (nearestInteractable?.type === 'love-letter') {
    openLoveLetterModal();
    return;
  }

  if (entryQueued) {
    entryQueued = false; movementTarget = null; doorTarget = 0;
    showToast('ورود لغو شد'); return;
  }
  if (movementTarget) {
    movementTarget = null;
    showToast('حرکت خودکار متوقف شد'); return;
  }
  if (!insideHouse) {
    if (isNearDoor()) { beginEntry(); return; }
    movementTarget = new THREE.Vector3(0, 0, 3.0);
    showToast('به سمت در راهرو راه می‌افتی'); return;
  }
  if (!nearestMemory) {
    let closest = null; let bestDistance = Infinity;
    for (const record of frameRecords) {
      const distance = Math.hypot(player.position.x - record.x, player.position.z - record.z);
      if (distance < bestDistance) { bestDistance = distance; closest = record; }
    }
    if (closest) {
      const approachDistance = 2.8;
      movementTarget = new THREE.Vector3(
        closest.x + Math.sin(closest.rotationY) * approachDistance,
        0,
        closest.z + Math.cos(closest.rotationY) * approachDistance,
      );
      showToast(`به سمت قابِ «${closest.memory.title}» راه می‌افتی`);
    }
    return;
  }
  openMemory(nearestMemory.memory, nearestMemory.index);
}

function showToast(message) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = message; el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

function resetCameraView() {
  targetYaw = 0;
  targetPitch = insideHouse ? 0.15 : 0.20;
  targetDistance = insideHouse ? 5.2 : 7.0;
  yawVelocity = 0;
  pitchVelocity = 0;
  showToast('زاویه‌ی دوربین تنظیم شد');
}

function startGame() {
  state.fromName = $('#from-name').value.trim() || 'من';
  state.toName = $('#to-name').value.trim() || 'پرنسس من';
  state.dedication = $('#dedication').value.trim() || museumDefaults.dedication;
  if ($('#anniversary-msg')) state.anniversaryMsg = $('#anniversary-msg').value.trim() || museumDefaults.anniversaryText;
  if ($('#initial-love-count')) state.loveCount = Number($('#initial-love-count').value) || museumDefaults.loveCount;

  localStorage.setItem(storageKey, JSON.stringify(state));

  if (!player) {
    createWorld();
    if (!player) {
      const note = $('.form-footnote');
      if (note) note.textContent = 'گرافیک سه‌بعدی در این مرورگر در دسترس نیست.';
      return;
    }
    updateProgress();
  }

  if (dedicationSign) {
    dedicationSign.material.map?.dispose();
    dedicationSign.material.map = createDedicationTexture();
    dedicationSign.material.needsUpdate = true;
  }
  if (anniversaryMantleSign) {
    anniversaryMantleSign.material.map?.dispose();
    anniversaryMantleSign.material.map = createAnniversaryMantleTexture();
    anniversaryMantleSign.material.needsUpdate = true;
  }

  $('#hud-from').textContent = state.fromName;
  $('#hud-to').textContent = state.toName;
  $('#hud-subtitle').textContent = `راهروی خاطرات ۱ سالگی`;
  updateLoveUI();

  insideHouse = false; entryQueued = false; movementTarget = null; doorProgress = 0; doorTarget = 0;
  keys.clear();
  touchMoveActive = false;
  if (dynamicTouchIndicator) dynamicTouchIndicator.hidden = true;

  if (leftDoorPivot) leftDoorPivot.rotation.y = 0;
  if (rightDoorPivot) rightDoorPivot.rotation.y = 0;
  player.position.copy(playerPosition); player.rotation.y = 0;
  playerVelocity.set(0, 0, 0);
  playerTargetRot = 0;

  companion.position.set(-0.95, 0, playerPosition.z + 1.0); companion.rotation.y = 0;
  cameraYaw = 0; targetYaw = 0; yawVelocity = 0;
  cameraPitch = 0.20; targetPitch = 0.20; pitchVelocity = 0;
  cameraDistance = 7.0; targetDistance = 7.0;
  updateSceneLocation();

  player.userData.label.material.map.dispose();
  player.userData.label.material.map = createSpriteLabel(state.toName, '#ffd875').material.map;
  player.userData.label.material.needsUpdate = true;
  companion.userData.label.material.map.dispose();
  companion.userData.label.material.map = createSpriteLabel(state.fromName, '#ff8fa3').material.map;
  companion.userData.label.material.needsUpdate = true;
  player.userData.shirtMaterial.color.set(state.avatarColor);

  started = true;
  for (const loadPhoto of pendingPhotoLoads.splice(0)) loadPhoto();
  syncAnimationLoop();
  intro.classList.add('is-leaving');
  hud.classList.remove('is-hidden');
  canvas.focus({ preventScroll: true });
  setTimeout(() => { intro.hidden = true; }, 850);
  showToast('انگشتت را روی صفحه بکش تا آزادانه حرکت کنی 🌸');
}

// Raycasting for Direct Taps (Door, Frames, Giant Letter, Fireplace, Love Monument, or Ground)
function handleScreenTap(clientX, clientY) {
  if (!started || !camera || currentMemory || !renderer) return;
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  // 1. Check Interactive Objects (Door, Giant Love Letter, Fireplace, Monument)
  const intHits = raycaster.intersectObjects(interactiveTargets, true);
  if (intHits.length) {
    const hitObj = intHits[0].object;
    const type = hitObj.userData?.type;

    if (type === 'love-letter') {
      openLoveLetterModal();
      showToast('💌 در حال باز کردن نامه‌ی عاشقی ۱ سالگی...');
      triggerHeartFX(clientX, clientY, 8);
      return;
    }

    if (type === 'door') {
      if (!insideHouse) {
        beginEntry();
      } else {
        movementTarget = new THREE.Vector3(0, 0, 4.0);
        showToast('در حال خروج به سمت حیاط...');
      }
      return;
    }

    if (type === 'anniversary-mantle') {
      openAnniversaryModal();
      return;
    }

    if (type === 'love-monument') {
      addLoveCount({ clientX, clientY });
      return;
    }
  }

  // 2. Check Memory Frames
  if (insideHouse) {
    const frameHits = raycaster.intersectObjects(frameTargets, false);
    if (frameHits.length) {
      const target = frameHits[0].object;
      openMemory(target.userData.memory, target.userData.index);
      return;
    }
  }

  // 3. Direct Tap-To-Walk on Ground / Walkway
  const floorHits = raycaster.intersectObjects(floorTargets, false);
  if (floorHits.length) {
    const hit = floorHits[0];
    const targetPt = hit.point;

    // Constrain target within playable area
    if (insideHouse) {
      targetPt.x = clamp(targetPt.x, -8.5, 8.5);
      targetPt.z = clamp(targetPt.z, -66.5, 0.5);
    } else {
      targetPt.x = clamp(targetPt.x, -16.0, 16.0);
      targetPt.z = clamp(targetPt.z, 0.5, 21.0);
    }

    movementTarget = new THREE.Vector3(targetPt.x, 0, targetPt.z);

    // Show Tap Marker at Screen Coord
    if (mobileTapMarker) {
      mobileTapMarker.style.left = `${clientX}px`;
      mobileTapMarker.style.top = `${clientY}px`;
      mobileTapMarker.hidden = false;
      clearTimeout(tapMarkerTimer);
      tapMarkerTimer = setTimeout(() => { mobileTapMarker.hidden = true; }, 900);
    }

    playRomanticChime(587.33);
    triggerHeartFX(clientX, clientY, 2);
    return;
  }

  // 4. Tap on Sky (in yard) -> release a romantic Sky Lantern & Meteor!
  if (!insideHouse && clientY < window.innerHeight * 0.45) {
    spawnSkyLantern((Math.random() - 0.5) * 14, player.position.z - 5.0, 1.2);
    if (Math.random() < 0.6) spawnMeteor();
    playRomanticChime(783.99);
    showToast('✨ یک فانوس آرزو به آسمان پرواز کرد ✨');
  }
}

function handleResize() {
  if (!camera || !renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.fov = window.innerWidth < 700 ? 56 : 48;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobileViewport() ? 1.25 : 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function setupEvents() {
  window.addEventListener('resize', handleResize);
  document.addEventListener('visibilitychange', syncAnimationLoop);

  setupForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    startGame();
  });

  document.querySelectorAll('.swatch').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.swatch').forEach((b) => b.classList.remove('is-selected'));
      button.classList.add('is-selected');
      state.avatarColor = button.dataset.color;
      if (player) player.userData.shirtMaterial.color.set(state.avatarColor);
    });
  });

  $('#photo-mode-btn')?.addEventListener('click', takePolaroidSnapshot);
  $('#download-polaroid-btn')?.addEventListener('click', downloadPolaroidCard);
  $('#retake-photo-btn')?.addEventListener('click', () => {
    closePolaroidModal();
    setTimeout(takePolaroidSnapshot, 200);
  });
  $('#close-polaroid')?.addEventListener('click', closePolaroidModal);
  $('#polaroid-backdrop')?.addEventListener('click', closePolaroidModal);

  $('#emote-dance-btn')?.addEventListener('click', () => {
    setCouplePose(couplePose === 'dance' ? 'normal' : 'dance');
  });
  $('#emote-kiss-btn')?.addEventListener('click', () => {
    setCouplePose('kiss');
  });
  $('#emote-hands-btn')?.addEventListener('click', () => {
    setCouplePose(couplePose === 'holding_hands' ? 'normal' : 'holding_hands');
  });
  $('#emote-sofa-btn')?.addEventListener('click', () => {
    setCouplePose('sitting');
  });
  $('#emote-fireworks-btn')?.addEventListener('click', triggerFireworkShow);

  $('#music-toggle-btn')?.addEventListener('click', toggleMusic);
  $('#cinema-tour-btn')?.addEventListener('click', () => {
    if (isTouring) stopCinematicTour();
    else startCinematicTour();
  });
  $('#camera-reset-button')?.addEventListener('click', resetCameraView);
  $('#loveletter-btn')?.addEventListener('click', openLoveLetterModal);
  $('#anniversary-btn')?.addEventListener('click', openAnniversaryModal);

  $('#love-counter-btn')?.addEventListener('click', (e) => {
    addLoveCount(e);
  });

  $('#modal-love-btn')?.addEventListener('click', (e) => {
    addLoveCount(e);
  });

  $('#anniv-heart-action')?.addEventListener('click', (e) => {
    addLoveCount(e);
  });

  $('#close-anniversary')?.addEventListener('click', closeAnniversaryModal);
  $('#anniv-close-action')?.addEventListener('click', closeAnniversaryModal);
  $('#anniversary-backdrop')?.addEventListener('click', closeAnniversaryModal);

  $('#close-loveletter')?.addEventListener('click', closeLoveLetterModal);
  $('#loveletter-close-btn')?.addEventListener('click', closeLoveLetterModal);
  $('#loveletter-backdrop')?.addEventListener('click', closeLoveLetterModal);

  $('#close-memory')?.addEventListener('click', closeMemory);
  $('#memory-backdrop')?.addEventListener('click', closeMemory);

  $('#next-memory')?.addEventListener('click', () => {
    if (!currentMemory) return;
    const currentIndex = memories.findIndex((m) => m.id === currentMemory.id);
    const nextIndex = (currentIndex + 1) % memories.length;
    openMemory(memories[nextIndex], nextIndex);
  });

  $('#help-button')?.addEventListener('click', () => {
    helpOverlay.hidden = false;
    syncAnimationLoop();
    $('#close-help')?.focus({ preventScroll: true });
  });

  $('#close-help')?.addEventListener('click', () => {
    helpOverlay.hidden = true;
    syncAnimationLoop();
  });

  $('#help-close-action')?.addEventListener('click', () => {
    helpOverlay.hidden = true;
    syncAnimationLoop();
  });

  $('#help-backdrop')?.addEventListener('click', () => {
    helpOverlay.hidden = true;
    syncAnimationLoop();
  });

  $('#interact-button')?.addEventListener('click', interactNearest);

  $('#fullscreen-button')?.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  });

  window.addEventListener('wheel', (e) => {
    if (currentMemory || !helpOverlay.hidden || !anniversaryOverlay.hidden || !loveletterOverlay.hidden) return;
    targetDistance = clamp(targetDistance + e.deltaY * 0.005, 1.8, 11.0);
  }, { passive: true });

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyE') {
      interactNearest();
      return;
    }
    if (e.code === 'Escape') {
      if (!anniversaryOverlay.hidden) closeAnniversaryModal();
      else if (!loveletterOverlay.hidden) closeLoveLetterModal();
      else if (!memoryOverlay.hidden) closeMemory();
      else if (!helpOverlay.hidden) { helpOverlay.hidden = true; syncAnimationLoop(); }
      return;
    }
    keys.add(e.code);
  });

  window.addEventListener('keyup', (e) => {
    keys.delete(e.code);
  });

  // --- Dynamic On-Screen Direct Touch & Drag Handling ---
  canvas.addEventListener('pointerdown', (e) => {
    if (!started || currentMemory || !helpOverlay.hidden || !anniversaryOverlay.hidden || !loveletterOverlay.hidden) return;

    activePointers.set(e.pointerId, {
      startX: e.clientX,
      startY: e.clientY,
      startTime: Date.now(),
      lastX: e.clientX,
      lastY: e.clientY,
      totalMoved: 0,
      mode: 'undecided',
    });

    // Touch device or mobile viewport: Smart Zone Detection
    if (e.pointerType === 'touch' || isMobileViewport()) {
      // Upper 65% of screen or right 50% = Camera Swipe Rotation
      const isUpperOrRightZone = (e.clientY < window.innerHeight * 0.65) || (e.clientX > window.innerWidth * 0.50);

      if (isUpperOrRightZone && cameraDragPointerId === null) {
        cameraDragPointerId = e.pointerId;
        isDraggingCamera = true;
        lastDragX = e.clientX;
        lastDragY = e.clientY;
        yawVelocity = 0;
        pitchVelocity = 0;
        activePointers.get(e.pointerId).mode = 'camera';
      } else if (touchMovePointerId === null) {
        // Lower-left quadrant = Movement Joystick
        touchMovePointerId = e.pointerId;
        touchOriginX = e.clientX;
        touchOriginY = e.clientY;
        touchMoveActive = false;
        touchVector.set(0, 0);
        activePointers.get(e.pointerId).mode = 'move';

        if (dynamicTouchIndicator) {
          dynamicTouchIndicator.style.left = `${touchOriginX}px`;
          dynamicTouchIndicator.style.top = `${touchOriginY}px`;
          dynamicTouchIndicator.hidden = false;
        }
        if (touchKnobInner) {
          touchKnobInner.style.transform = 'translate3d(0, 0, 0)';
        }
        touchHintPill?.classList.add('is-hidden');
      } else if (cameraDragPointerId === null) {
        cameraDragPointerId = e.pointerId;
        isDraggingCamera = true;
        lastDragX = e.clientX;
        lastDragY = e.clientY;
        yawVelocity = 0;
        pitchVelocity = 0;
        activePointers.get(e.pointerId).mode = 'camera';
      }
    } else {
      // Desktop Mouse Drag = Camera Rotation
      isDraggingCamera = true;
      cameraDragPointerId = e.pointerId;
      lastDragX = e.clientX;
      lastDragY = e.clientY;
      yawVelocity = 0;
      pitchVelocity = 0;
      activePointers.get(e.pointerId).mode = 'camera';
    }
  });

  window.addEventListener('pointermove', (e) => {
    const ptr = activePointers.get(e.pointerId);
    if (!ptr) return;

    const moveStep = Math.hypot(e.clientX - ptr.lastX, e.clientY - ptr.lastY);
    ptr.totalMoved += moveStep;
    ptr.lastX = e.clientX;
    ptr.lastY = e.clientY;

    // 1. Handle Active Touch Movement on screen
    if (e.pointerId === touchMovePointerId) {
      const dx = e.clientX - touchOriginX;
      const dy = e.clientY - touchOriginY;
      const dist = Math.hypot(dx, dy);

      if (dist > 8) {
        touchMoveActive = true;
        movementTarget = null; // direct drag takes priority

        const maxR = 38;
        const angle = Math.atan2(dy, dx);
        const knobX = Math.cos(angle) * Math.min(dist, maxR);
        const knobY = Math.sin(angle) * Math.min(dist, maxR);

        if (touchKnobInner) {
          touchKnobInner.style.transform = `translate3d(${knobX}px, ${knobY}px, 0)`;
        }

        const normalizedPower = clamp((dist - 6) / 34, 0.2, 1.0);
        touchVector.set(Math.cos(angle) * normalizedPower, Math.sin(angle) * normalizedPower);
      }
    }

    // 2. Handle Camera Drag Rotation (Silky Smooth & Highly Responsive)
    if (isDraggingCamera && e.pointerId === cameraDragPointerId) {
      const dx = e.clientX - lastDragX;
      const dy = e.clientY - lastDragY;

      targetYaw -= dx * 0.0055;
      targetPitch = clamp(targetPitch + dy * 0.0038, 0.02, 0.58);

      yawVelocity = -dx * 0.0055 / 0.016;
      pitchVelocity = dy * 0.0038 / 0.016;

      lastDragX = e.clientX;
      lastDragY = e.clientY;
    }
  });

  const finishTouch = (e) => {
    const ptr = activePointers.get(e.pointerId);
    const tapDuration = ptr ? (Date.now() - ptr.startTime) : 999;
    const totalMoved = ptr ? ptr.totalMoved : 999;
    const wasTap = tapDuration < 420 && totalMoved < 24;

    activePointers.delete(e.pointerId);

    // Finish on-screen movement touch
    if (e.pointerId === touchMovePointerId) {
      touchMovePointerId = null;
      touchMoveActive = false;
      touchVector.set(0, 0);
      if (dynamicTouchIndicator) dynamicTouchIndicator.hidden = true;
      if (touchKnobInner) touchKnobInner.style.transform = 'translate3d(0, 0, 0)';
    }

    // Finish camera drag
    if (e.pointerId === cameraDragPointerId) {
      isDraggingCamera = false;
      cameraDragPointerId = null;
    }

    // Direct Object Tap
    if (wasTap) {
      handleScreenTap(e.clientX, e.clientY);
    }
  };

  window.addEventListener('pointerup', finishTouch);
  window.addEventListener('pointercancel', finishTouch);

  // Pinch-to-zoom for mobile touch
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      prevPinchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  }, { passive: true });

  canvas.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && prevPinchDist != null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = prevPinchDist - dist;
      targetDistance = clamp(targetDistance + delta * 0.02, 1.8, 11.0);
      prevPinchDist = dist;
    }
  }, { passive: true });

  canvas.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) prevPinchDist = null;
  });
}

// Initial Setup
updateLoveUI();
setupEvents();
