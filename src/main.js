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
const floatingHeartsLayer = $('#floating-hearts');

const dynamicTouchIndicator = $('#dynamic-touch-indicator');
const touchKnobInner = $('#dynamic-touch-indicator .touch-knob-inner');
const mobileTapMarker = $('#mobile-tap-marker');
const touchHintPill = $('#touch-hint-pill');

const storageKey = 'our-museum-gift-v6';
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

// Optimized Third-Person Camera State
let cameraYaw = 0;
let targetYaw = 0;
let yawVelocity = 0;

let cameraPitch = 0.16;
let targetPitch = 0.16;
let pitchVelocity = 0;

let cameraDistance = 6.4;
let targetDistance = 6.4;

const cameraLookTarget = new THREE.Vector3(0, 1.35, 14);
const desiredCameraLook = new THREE.Vector3(0, 1.35, 14);

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
  const bg = fs.plaqueBg || '#1c2130';
  const border = fs.plaqueBorder || '#ffd875';
  return makeCanvasTexture((ctx, w, h) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = border; ctx.lineWidth = 2.5; ctx.strokeRect(9, 9, w - 18, h - 18);
    ctx.fillStyle = border; ctx.font = 'bold 12px Tahoma, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.direction = 'rtl';
    ctx.fillText(`خاطره‌ی ${String(index + 1).padStart(2, '۰')} · ${fs.styleName ? fs.styleName.split(' ')[0] : 'یادگاری'}`, w / 2, 32);
    ctx.fillStyle = '#fff8eb'; ctx.font = 'bold 24px Tahoma, Arial, sans-serif';
    ctx.fillText(memory.title, w / 2, 70);
  }, 512, 112);
}

// Grand High-Impact 3D Frames (Larger & Prominent)
function createFrame(memory, index, x, y, z, rotationY, width = 2.85, height = 3.65) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.y = rotationY;
  scene.add(group);

  const fs = memory.frameStyle || {
    frameColor: 0xb69b6b,
    matColor: 0xf2ede2,
    accentColor: 0xd4af37,
    roughness: 0.35,
    metalness: 0.5,
  };

  const frameMat = colorMaterial(fs.frameColor, fs.roughness ?? 0.3, fs.metalness ?? 0.4);
  const matMat = colorMaterial(fs.matColor, 0.85, 0.02);
  const accentMat = colorMaterial(fs.accentColor, 0.22, 0.78);
  const darkBack = colorMaterial(0x0c0e12, 0.4);

  // Backing & Shadow
  addBox(group, width + 0.18, height + 0.18, 0.12, darkBack, 0, 0, -0.02, { castShadow: true, receiveShadow: false });

  // Main Frame Moulding
  addBox(group, width, height, 0.11, frameMat, 0, 0, 0.04);

  // Inner Mat
  const matMargin = 0.26;
  addBox(group, width - matMargin, height - matMargin, 0.06, matMat, 0, 0, 0.08, { castShadow: false });

  // Custom Architectural Features
  const halfW = width / 2;
  const halfH = height / 2;

  switch (fs.type) {
    case 'rose-gold-romance':
      for (const sx of [-1, 1]) {
        for (const sy of [-1, 1]) {
          const rose = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 8), accentMat);
          rose.rotation.x = Math.PI / 2;
          rose.position.set(sx * (halfW - 0.14), sy * (halfH - 0.14), 0.14);
          group.add(rose);
          const center = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), colorMaterial(0xfff0f2, 0.2, 0.8));
          center.position.set(sx * (halfW - 0.14), sy * (halfH - 0.14), 0.17);
          group.add(center);
        }
      }
      addBox(group, width - 0.36, height - 0.36, 0.025, accentMat, 0, 0, 0.11, { castShadow: false });
      break;

    case 'baroque-gold':
      {
        const crown = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.32, 5), accentMat);
        crown.position.set(0, halfH + 0.16, 0.06);
        group.add(crown);
        for (const sx of [-0.26, 0.26]) {
          const miniPinnacle = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), accentMat);
          miniPinnacle.position.set(sx, halfH + 0.10, 0.06);
          group.add(miniPinnacle);
        }
        for (const sx of [-1, 1]) {
          for (const sy of [-1, 1]) {
            const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.04), accentMat);
            bracket.rotation.z = Math.PI / 4;
            bracket.position.set(sx * (halfW - 0.12), sy * (halfH - 0.12), 0.12);
            group.add(bracket);
          }
        }
      }
      break;

    default:
      for (const sx of [-1, 1]) {
        for (const sy of [-1, 1]) {
          const rosette = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), accentMat);
          rosette.position.set(sx * (halfW - 0.12), sy * (halfH - 0.12), 0.12);
          group.add(rosette);
        }
      }
      break;
  }

  // Large Artwork Plane
  const artWidth = width - 0.48;
  const artHeight = height - 0.58;
  const artTexture = makeAbstractArtwork(memory, index);
  const art = new THREE.Mesh(
    new THREE.PlaneGeometry(artWidth, artHeight),
    new THREE.MeshBasicMaterial({ map: artTexture, side: THREE.DoubleSide })
  );
  art.position.set(0, 0, 0.125);
  art.userData.memory = memory;
  art.userData.index = index;
  art.userData.isFrame = true;
  group.add(art);

  if (memory.imageSrc) {
    const loadPhoto = () => new THREE.TextureLoader().load(memory.imageSrc, (loadedTexture) => {
      let texture = loadedTexture;
      const source = loadedTexture.image;
      const maxPhotoSide = isMobileViewport() ? 1024 : Infinity;
      const scale = Math.min(1, maxPhotoSide / Math.max(source.width, source.height));
      if (scale < 1) {
        const resized = document.createElement('canvas');
        resized.width = Math.max(1, Math.round(source.width * scale));
        resized.height = Math.max(1, Math.round(source.height * scale));
        resized.getContext('2d').drawImage(source, 0, 0, resized.width, resized.height);
        texture = new THREE.CanvasTexture(resized);
        loadedTexture.dispose();
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(isMobileViewport() ? 2 : 4, renderer.capabilities.getMaxAnisotropy());
      const photoAspect = texture.image.width / texture.image.height;
      const frameAspect = artWidth / artHeight;
      const fitWidth = photoAspect > frameAspect ? artWidth : artHeight * photoAspect;
      const fitHeight = photoAspect > frameAspect ? artWidth / photoAspect : artHeight;
      art.geometry.dispose();
      art.geometry = new THREE.PlaneGeometry(fitWidth, fitHeight);
      art.material.map?.dispose();
      art.material.map = texture;
      art.material.needsUpdate = true;
    }, undefined, (error) => console.warn(`Could not load memory image: ${memory.imageSrc}`, error));
    if (started) loadPhoto(); else pendingPhotoLoads.push(loadPhoto);
  }
  frameTargets.push(art);

  // Dedicated Sconce with glowing bulb
  const sconceGroup = new THREE.Group();
  sconceGroup.position.set(0, halfH + 0.32, 0.18);
  const sconceArm = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.22, 6), colorMaterial(fs.accentColor, 0.3, 0.7));
  sconceArm.rotation.x = Math.PI / 3; sconceGroup.add(sconceArm);
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.12, 8), colorMaterial(fs.frameColor, 0.4, 0.3));
  shade.rotation.x = Math.PI / 2; shade.position.set(0, 0.07, 0.09); sconceGroup.add(shade);
  const bulbGlow = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffeaae }));
  bulbGlow.position.set(0, 0.07, 0.12); sconceGroup.add(bulbGlow);
  group.add(sconceGroup);

  // Plaque Below Frame
  const plaqueWidth = Math.max(width - 0.05, 2.3);
  addBox(group, plaqueWidth + 0.06, 0.54, 0.08, colorMaterial(fs.frameColor, 0.5, 0.2), 0, -halfH - 0.40, 0.015, { castShadow: false });
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

// Gorgeous High-Quality Princess Character in Pink Royal Ballgown
function createPrincessAvatar(options = {}) {
  const root = new THREE.Group();
  const rig = new THREE.Group(); root.add(rig);

  const skin = colorMaterial(options.skin || 0xffe2d2, 0.65);
  const dressPink = colorMaterial(options.shirt || state.avatarColor || 0xff758f, 0.35, 0.15); // Shimmering Princess Satin
  const dressAccentPink = colorMaterial(0xffa8ba, 0.45, 0.1);
  const goldTrim = colorMaterial(0xffd875, 0.25, 0.85);
  const pearlMat = colorMaterial(0xffffff, 0.15, 0.9);
  const hairMat = colorMaterial(options.hair || 0x2b1c18, 0.85);
  const eyeColor = new THREE.MeshBasicMaterial({ color: 0x1f1412 });
  const eyeWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const blushMat = colorMaterial(0xff4d6d, 0.3, 0.1);
  const rubyGem = new THREE.MeshBasicMaterial({ color: 0xff2a5c });

  // --- Voluminous Princess Ballgown Skirt ---
  const skirtGroup = new THREE.Group();
  skirtGroup.position.y = 0.98;
  rig.add(skirtGroup);

  // Upper Flared Peplum
  const peplum = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.45, 16, 1, true), dressPink);
  peplum.rotation.x = Math.PI;
  peplum.position.y = -0.15;
  peplum.castShadow = true;
  skirtGroup.add(peplum);

  // Main Voluminous Bell Skirt
  const mainSkirt = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.82, 0.96, 18), dressPink);
  mainSkirt.position.y = -0.48;
  mainSkirt.castShadow = true;
  skirtGroup.add(mainSkirt);

  // Bottom Ruffled Lace Tier
  const skirtHem = new THREE.Mesh(new THREE.CylinderGeometry(0.80, 0.88, 0.16, 18), dressAccentPink);
  skirtHem.position.y = -0.92;
  skirtHem.castShadow = true;
  skirtGroup.add(skirtHem);

  // Gold Trim Ribbon along skirt hem
  const hemGoldRing = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.018, 6, 24), goldTrim);
  hemGoldRing.rotation.x = Math.PI / 2;
  hemGoldRing.position.y = -0.85;
  skirtGroup.add(hemGoldRing);

  // Big Princess Silk Ribbon Bow at the back of waist
  const bowGroup = new THREE.Group();
  bowGroup.position.set(0, 1.02, 0.28);
  const bowCenter = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), goldTrim);
  bowGroup.add(bowCenter);
  for (const sx of [-1, 1]) {
    const bowLoop = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.035, 6, 12), dressPink);
    bowLoop.position.set(sx * 0.10, 0.02, 0);
    bowLoop.rotation.y = sx * 0.35;
    bowGroup.add(bowLoop);
    const streamer = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 0.02), dressPink);
    streamer.position.set(sx * 0.07, -0.22, 0.02);
    streamer.rotation.z = sx * -0.22;
    bowGroup.add(streamer);
  }
  rig.add(bowGroup);

  // --- Bodice & Sweetheart Corset ---
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.52, 4, 12), dressPink);
  torso.position.y = 1.34;
  torso.castShadow = true;
  rig.add(torso);

  // Gold Corset Filigree & Sweetheart neckline trim
  const waistGoldBand = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.016, 6, 18), goldTrim);
  waistGoldBand.rotation.x = Math.PI / 2;
  waistGoldBand.position.set(0, 1.05, 0);
  rig.add(waistGoldBand);

  const neckline = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.016, 6, 16), goldTrim);
  neckline.rotation.x = Math.PI / 2.2;
  neckline.position.set(0, 1.62, -0.16);
  rig.add(neckline);

  // Pearl Necklace Choker with Heart Pendant
  const choker = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.012, 6, 16), pearlMat);
  choker.rotation.x = Math.PI / 2;
  choker.position.set(0, 1.76, -0.01);
  rig.add(choker);

  const heartPendant = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), rubyGem);
  heartPendant.position.set(0, 1.72, -0.13);
  rig.add(heartPendant);

  // Hidden legs inside gown for smooth foot steps
  const leftLeg = new THREE.Group(); leftLeg.position.set(-0.12, 0.65, 0); rig.add(leftLeg);
  const rightLeg = new THREE.Group(); rightLeg.position.set(0.12, 0.65, 0); rig.add(rightLeg);
  for (const leg of [leftLeg, rightLeg]) {
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.24), goldTrim);
    shoe.position.set(0, -0.62, -0.05);
    shoe.castShadow = true;
    leg.add(shoe);
  }

  // --- Delicate Princess Arms with Puffy Off-shoulder Sleeves ---
  const leftArm = new THREE.Group(); leftArm.position.set(-0.31, 1.54, 0); rig.add(leftArm);
  const rightArm = new THREE.Group(); rightArm.position.set(0.31, 1.54, 0); rig.add(rightArm);
  for (const arm of [leftArm, rightArm]) {
    // Puffy Sleeve Cap
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), dressAccentPink);
    puff.scale.set(1.1, 0.9, 1.1);
    arm.add(puff);

    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.072, 0.40, 3, 8), dressPink);
    sleeve.position.y = -0.24; sleeve.rotation.z = arm === leftArm ? -0.06 : 0.06; sleeve.castShadow = true; arm.add(sleeve);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 8), skin);
    hand.position.y = -0.52; hand.castShadow = true; arm.add(hand);
  }

  // --- Beautiful Princess Face & Cascading Hair ---
  const head = new THREE.Group(); head.position.set(0, 2.06, 0); rig.add(head);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.235, 16, 14), skin);
  face.scale.set(0.92, 1.04, 0.92); face.castShadow = true; head.add(face);

  // Hair Base
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.252, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.58), hairMat);
  cap.position.y = 0.05; cap.castShadow = true; head.add(cap);

  // Long flowing hair down the back
  const backHair = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), hairMat);
  backHair.scale.set(1.15, 1.75, 0.75); backHair.position.set(0, -0.22, 0.08); backHair.castShadow = true; head.add(backHair);

  // Cascading front locks over shoulders
  for (const side of [-1, 1]) {
    const lock = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.56, 3, 8), hairMat);
    lock.position.set(side * 0.21, -0.28, -0.03); lock.rotation.z = side * -0.12; lock.castShadow = true; head.add(lock);
  }

  // --- Sparkling Golden Princess Crown / Tiara ---
  const tiaraGroup = new THREE.Group();
  tiaraGroup.position.set(0, 0.26, -0.02);
  const crownBase = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.016, 6, 18), goldTrim);
  crownBase.rotation.x = Math.PI / 2;
  tiaraGroup.add(crownBase);

  // 5 jeweled points of the crown
  for (let i = -2; i <= 2; i++) {
    const angle = i * 0.24;
    const ptHeight = i === 0 ? 0.22 : Math.abs(i) === 1 ? 0.16 : 0.11;
    const crownSpike = new THREE.Mesh(new THREE.ConeGeometry(0.032, ptHeight, 5), goldTrim);
    crownSpike.position.set(Math.sin(angle) * 0.18, ptHeight / 2 + 0.01, -Math.cos(angle) * 0.18);
    tiaraGroup.add(crownSpike);

    // Gem on crown peak
    const gem = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 6), i === 0 ? rubyGem : pearlMat);
    gem.position.set(Math.sin(angle) * 0.18, ptHeight + 0.02, -Math.cos(angle) * 0.18);
    tiaraGroup.add(gem);
  }
  head.add(tiaraGroup);

  // --- Expressive Princess Eyes, Rosy Blush & Sweet Smile ---
  for (const side of [-1, 1]) {
    const eyeWh = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 7), eyeWhite);
    eyeWh.position.set(side * 0.082, 0.012, -0.21); head.add(eyeWh);

    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.018, 7, 6), eyeColor);
    pupil.position.set(side * 0.082, 0.008, -0.235); head.add(pupil);

    // Eye sparkle highlight
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.007, 5, 5), eyeWhite);
    glint.position.set(side * 0.082 - 0.005, 0.015, -0.246); head.add(glint);

    // Eyelash curve
    const lash = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.004, 3, 6, Math.PI * 0.5), eyeColor);
    lash.position.set(side * 0.082, 0.035, -0.215);
    lash.rotation.z = side > 0 ? 0.2 : Math.PI - 0.2;
    head.add(lash);

    // Rosy Blush
    const blush = new THREE.Mesh(new THREE.CircleGeometry(0.042, 12), blushMat);
    blush.position.set(side * 0.12, -0.04, -0.218);
    blush.rotation.y = side * 0.32;
    head.add(blush);
  }

  const cuteNose = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), skin);
  cuteNose.position.set(0, -0.03, -0.232); head.add(cuteNose);

  const sweetMouth = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.006, 4, 8, Math.PI), colorMaterial(0xd84c6c, 0.3));
  sweetMouth.position.set(0, -0.08, -0.215); sweetMouth.rotation.z = Math.PI; head.add(sweetMouth);

  const label = createSpriteLabel(options.name || 'پرنسس من', '#ffd875');
  label.position.y = 2.82; rig.add(label);

  // Soft personal glow on the princess
  playerFollowLight = new THREE.PointLight(0xfff0e4, 1.8, 8.0, 2);
  playerFollowLight.position.set(0, 2.2, 0.5);
  root.add(playerFollowLight);

  root.userData = {
    rig, leftLeg, rightLeg, leftArm, rightArm, head, skirtGroup, bowGroup, label,
    shirtMaterial: dressPink, phase: Math.random() * 6.28
  };
  root.traverse((obj) => { if (obj.isMesh) { obj.castShadow = true; if (obj.geometry.type !== 'PlaneGeometry') obj.receiveShadow = true; } });
  return root;
}

// Handsome Companion Avatar in Dashing Royal Suit
function createCompanionAvatar(options = {}) {
  const root = new THREE.Group();
  const rig = new THREE.Group(); root.add(rig);

  const skin = colorMaterial(options.skin || 0xd9aa88, 0.70);
  const suitMat = colorMaterial(options.shirt || 0x24222b, 0.55, 0.1);
  const shirtWhite = colorMaterial(0xffffff, 0.45);
  const goldTrim = colorMaterial(0xffd875, 0.25, 0.85);
  const pantsMat = colorMaterial(0x1e1c24, 0.75);
  const shoe = colorMaterial(0x141218, 0.6);
  const hair = colorMaterial(options.hair || 0x2e2420, 0.90);
  const eye = new THREE.MeshBasicMaterial({ color: 0x241a18 });
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff });

  const hips = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.27, 0.34, 10), pantsMat);
  hips.position.y = 0.78; hips.castShadow = true; rig.add(hips);

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.29, 0.56, 4, 10), suitMat);
  torso.position.y = 1.28; torso.castShadow = true; rig.add(torso);

  // White Shirt V-collar & Bow Tie
  const shirtPanel = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.38, 0.04), shirtWhite);
  shirtPanel.position.set(0, 1.42, -0.26); rig.add(shirtPanel);

  const bowTie = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.018, 5, 8), colorMaterial(0x8f1d32, 0.3));
  bowTie.position.set(0, 1.56, -0.29); rig.add(bowTie);

  for (const y of [1.22, 1.34]) {
    const btn = new THREE.Mesh(new THREE.SphereGeometry(0.016, 6, 6), goldTrim);
    btn.position.set(0, y, -0.285); rig.add(btn);
  }

  const leftLeg = new THREE.Group(); leftLeg.position.set(-0.14, 0.69, 0); rig.add(leftLeg);
  const rightLeg = new THREE.Group(); rightLeg.position.set(0.14, 0.69, 0); rig.add(rightLeg);
  for (const leg of [leftLeg, rightLeg]) {
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.46, 3, 8), pantsMat);
    mesh.position.y = -0.28; mesh.castShadow = true; leg.add(mesh);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.11, 0.33), shoe);
    foot.position.set(0, -0.61, -0.075); foot.castShadow = true; leg.add(foot);
  }

  const leftArm = new THREE.Group(); leftArm.position.set(-0.34, 1.56, 0); rig.add(leftArm);
  const rightArm = new THREE.Group(); rightArm.position.set(0.34, 1.56, 0); rig.add(rightArm);
  for (const arm of [leftArm, rightArm]) {
    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.42, 3, 8), suitMat);
    sleeve.position.y = -0.25; sleeve.rotation.z = arm === leftArm ? -0.08 : 0.08; sleeve.castShadow = true; arm.add(sleeve);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), skin);
    hand.position.y = -0.55; hand.castShadow = true; arm.add(hand);
  }

  const head = new THREE.Group(); head.position.set(0, 2.08, 0); rig.add(head);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.245, 16, 14), skin);
  face.scale.set(0.91, 1.06, 0.92); face.castShadow = true; head.add(face);

  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.257, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.56), hair);
  hairCap.position.y = 0.05; hairCap.castShadow = true; head.add(hairCap);

  for (const side of [-1, 1]) {
    const eyeWhiteMesh = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 7), white);
    eyeWhiteMesh.position.set(side * 0.082, 0.012, -0.218); head.add(eyeWhiteMesh);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.014, 7, 6), eye);
    pupil.position.set(side * 0.082, 0.008, -0.24); head.add(pupil);
  }

  const label = createSpriteLabel(options.name || 'من', '#ff8fa3');
  label.position.y = 2.79; rig.add(label);

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

  // 7 Grand Floral Arches spanning across the long corridor
  const archPositionsZ = [-3.5, -13.0, -22.5, -32.0, -41.5, -51.0, -60.5];
  archPositionsZ.forEach((archZ) => {
    createFloralArch(0, archZ);
  });

  // Architectural Columns along left and right walls
  for (let z = -2.5; z >= -64.0; z -= 9.5) {
    createClassicColumn(-9.6, z);
    createClassicColumn(9.6, z);
  }

  // Grand Crystal Chandeliers suspended from ceiling
  for (let z = -8.0; z >= -62.0; z -= 11.0) {
    createCrystalChandelier(0, 6.8, z);
  }
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

// Memory Frames placed along the long corridor
function addMemoryFrames() {
  const frameSpots = [
    // 6 Frames along West (left) Wall (x = -9.2)
    { x: -9.2, z: -7.5, rot: Math.PI / 2 },
    { x: -9.2, z: -17.0, rot: Math.PI / 2 },
    { x: -9.2, z: -26.5, rot: Math.PI / 2 },
    { x: -9.2, z: -36.0, rot: Math.PI / 2 },
    { x: -9.2, z: -45.5, rot: Math.PI / 2 },
    { x: -9.2, z: -55.0, rot: Math.PI / 2 },

    // 6 Frames along East (right) Wall (x = +9.2)
    { x: 9.2, z: -7.5, rot: -Math.PI / 2 },
    { x: 9.2, z: -17.0, rot: -Math.PI / 2 },
    { x: 9.2, z: -26.5, rot: -Math.PI / 2 },
    { x: 9.2, z: -36.0, rot: -Math.PI / 2 },
    { x: 9.2, z: -45.5, rot: -Math.PI / 2 },
    { x: 9.2, z: -55.0, rot: -Math.PI / 2 },
  ];

  memories.forEach((memory, index) => {
    const spot = frameSpots[index] || frameSpots[frameSpots.length - 1];
    createFrame(memory, index, spot.x, 4.35, spot.z, spot.rot, 2.85, 3.65);
  });
}

function makeWoodTexture() {
  const image = document.createElement('canvas'); image.width = 512; image.height = 512;
  const ctx = image.getContext('2d');
  const plankColors = ['#806045', '#8b694b', '#76583f', '#92704e', '#7e5d43', '#896849', '#74553e', '#8b694b'];
  for (let row = 0; row < 8; row++) {
    const y = row * 64; const offset = row % 2 ? 96 : 0;
    ctx.fillStyle = plankColors[row]; ctx.fillRect(0, y, 512, 62);
    ctx.fillStyle = '#4d3929'; ctx.fillRect(0, y + 62, 512, 2);
    for (let x = -offset; x < 512; x += 192) {
      ctx.fillStyle = '#513e2e'; ctx.fillRect(x, y, 2, 62);
      ctx.fillStyle = '#a17d59'; ctx.fillRect(x + 2, y + 2, 1, 58);
    }
    for (let line = 0; line < 5; line++) {
      const sy = y + 7 + line * 11;
      ctx.strokeStyle = line % 2 ? '#b69168' : '#493729'; ctx.globalAlpha = 0.16; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(4, sy); ctx.bezierCurveTo(120, sy - 3, 260, sy + 2, 508, sy - 1); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(image); texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(3.4, 18.0);
  texture.anisotropy = renderer ? Math.min(4, renderer.capabilities.getMaxAnisotropy()) : 1;
  return texture;
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

function createLivingRoomFurniture() {
  const sofaGroup = new THREE.Group();
  sofaGroup.position.set(0, 0, -62.5); // Placed at the romantic finale of the long corridor
  scene.add(sofaGroup);

  const sofaFabric = colorMaterial(0x42384a, 0.85);
  const pillowMat = colorMaterial(0xd88a8a, 0.75);
  const coffeeWood = colorMaterial(0x382c23, 0.5, 0.1);
  const rugMat = colorMaterial(0x822b3c, 0.95);

  const rug = new THREE.Mesh(new THREE.PlaneGeometry(8.2, 8.2), rugMat);
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.012, 0);
  rug.receiveShadow = true;
  sofaGroup.add(rug);

  addBox(sofaGroup, 3.8, 0.42, 1.25, sofaFabric, 0, 0.21, 1.8);
  addBox(sofaGroup, 3.8, 0.75, 0.35, sofaFabric, 0, 0.72, 2.25);
  addBox(sofaGroup, 0.35, 0.62, 1.25, sofaFabric, -1.95, 0.45, 1.8);
  addBox(sofaGroup, 0.35, 0.62, 1.25, sofaFabric, 1.95, 0.45, 1.8);

  for (const side of [-1.3, 1.3]) {
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.45, 0.22), pillowMat);
    pillow.position.set(side, 0.62, 2.05);
    pillow.rotation.y = side < 0 ? 0.2 : -0.2;
    sofaGroup.add(pillow);
  }

  addBox(sofaGroup, 2.2, 0.08, 1.2, coffeeWood, 0, 0.42, 0);
  for (const sx of [-0.95, 0.95]) {
    for (const sz of [-0.48, 0.48]) {
      addBox(sofaGroup, 0.07, 0.42, 0.07, coffeeWood, sx, 0.21, sz, { castShadow: false });
    }
  }

  const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.32, 10), colorMaterial(0xffffff, 0.1, 0.1));
  vase.position.set(0, 0.62, 0); sofaGroup.add(vase);
  const rose = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), colorMaterial(0xff3366, 0.4, 0.2));
  rose.position.set(0, 0.82, 0); sofaGroup.add(rose);

  // Love Letter Book on table
  const bookMat = colorMaterial(0x8f2d48, 0.4, 0.3);
  const book = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.06, 0.28), bookMat);
  book.position.set(0.42, 0.49, 0.15);
  book.rotation.y = 0.25;
  sofaGroup.add(book);

  const bookTarget = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.5), new THREE.MeshBasicMaterial({ visible: false }));
  bookTarget.position.set(0.42, 0.52, -62.35);
  bookTarget.userData = { type: 'love-letter' };
  scene.add(bookTarget);
  interactiveTargets.push(bookTarget);
}

// VERY LONG Grand Architecture
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
  const brass = colorMaterial(0x9d8157, 0.3, 0.55);
  const ceiling = colorMaterial(0xe1d9c9, 0.86);

  // Walls for the long corridor
  addBox(scene, 21.8, 7.45, 0.62, featureWall, 0, 3.72, -corridorLength - 0.25);
  addBox(scene, 0.62, 7.45, corridorLength + 0.8, sidePlaster, -10.78, 3.72, corridorCenterZ);
  addBox(scene, 0.62, 7.45, corridorLength + 0.8, sidePlaster, 10.78, 3.72, corridorCenterZ);

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

  createLoveMonument(0, 7.5);
  createFireplaceAndAnniversaryMantle();
  createFairyLights();
  createFloatingParticles();

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

  createLivingRoomFurniture();
}

function createWorld() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x131526);
  camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 140);
  camera.position.set(0, 3.8, 21.0);
  if (!createRenderer()) return;

  buildHome();
  addMemoryFrames();

  // Create High-Quality Princess Avatar (Girlfriend in pink ballgown with golden tiara)
  player = createPrincessAvatar({
    name: state.toName || 'پرنسس من',
    shirt: state.avatarColor || '#ff758f',
    skin: 0xffe2d2,
    hair: 0x241812,
  });
  player.position.copy(playerPosition); player.rotation.y = 0; scene.add(player);

  // Companion Avatar (Boyfriend in Dashing Suit)
  companion = createCompanionAvatar({
    name: state.fromName || 'من',
    shirt: 0x24222b,
    skin: 0xd9aa88,
    hair: 0x2e2420,
  });
  companion.position.set(-1.15, 0, 15.0); companion.rotation.y = 0; scene.add(companion);

  cameraLookTarget.copy(player.position).add(new THREE.Vector3(0, 1.35, 0));
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

  // Dynamic look target: slightly over character center
  const leadOffset = new THREE.Vector3(playerVelocity.x * 0.18, 0, playerVelocity.z * 0.18);
  const lookDesiredY = insideHouse ? 1.38 : 1.25;
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
    cameraLookTarget.y + sinPitch * cameraDistance + (insideHouse ? 0.35 : 0.65),
    cameraLookTarget.z + cosYaw * cosPitch * cameraDistance
  );

  // Prevent clipping through floor or side walls
  if (desiredPos.y < 0.85) desiredPos.y = 0.85;
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
  const phase = time * (walking ? 9.5 * speed : 2.0) + u.phase + offset;
  const amp = walking ? Math.min(0.55, 0.42 * speed) : 0.02;

  if (u.leftLeg) u.leftLeg.rotation.x = Math.sin(phase) * amp;
  if (u.rightLeg) u.rightLeg.rotation.x = -Math.sin(phase) * amp;
  if (u.leftArm) u.leftArm.rotation.x = -Math.sin(phase) * amp * 0.62;
  if (u.rightArm) u.rightArm.rotation.x = Math.sin(phase) * amp * 0.62;

  // Princess gown sway
  if (u.skirtGroup) {
    u.skirtGroup.rotation.z = walking ? Math.sin(phase * 0.5) * 0.06 : Math.sin(time * 1.5) * 0.015;
    u.skirtGroup.rotation.x = walking ? Math.cos(phase) * 0.05 : 0;
  }
  if (u.bowGroup) {
    u.bowGroup.rotation.x = walking ? Math.sin(phase * 0.08) : 0;
  }

  u.rig.position.y = walking ? Math.abs(Math.sin(phase * 0.5)) * (0.04 * speed) : Math.sin(time * 1.3 + u.phase) * 0.015;
  u.head.rotation.z = walking ? Math.sin(phase * 0.35) * 0.018 : Math.sin(time * 1.0 + u.phase) * 0.012;
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
    targetDistance = 6.4; targetPitch = 0.16; doorTarget = 1;
    showToast(`به راهروی خاطرات ۱ سالگی ${state.toName} خوش آمدی 🌸`);
  } else {
    targetDistance = 8.0; targetPitch = 0.22;
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

  updateFloatingParticles(dt, elapsed);

  if (!started || !player) {
    updateCamera(1, dt);
    return;
  }

  if (currentMemory || !helpOverlay.hidden || !anniversaryOverlay.hidden || !loveletterOverlay.hidden) {
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
      const speed = (keys.has('ShiftLeft') ? 5.4 : 3.8) * Math.min(1.0, touchVector.length());
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
      const speed = Math.min(3.8, distance * 2.5);
      desiredVelocity.copy(delta).multiplyScalar(speed);
      playerTargetRot = Math.atan2(-delta.x, -delta.z);
    }
  } else if (forwardInput || sideInput) {
    const forward = new THREE.Vector3(Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
    const right = new THREE.Vector3(Math.cos(cameraYaw), 0, Math.sin(cameraYaw));
    const direction = forward.multiplyScalar(forwardInput).add(right.multiplyScalar(sideInput));
    if (direction.lengthSq() > 0) {
      direction.normalize();
      const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 5.4 : 3.6;
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

  // Companion follows gracefully
  const side = new THREE.Vector3(Math.cos(cameraYaw), 0, Math.sin(cameraYaw)).multiplyScalar(-1.15);
  const behind = new THREE.Vector3(Math.sin(cameraYaw), 0, Math.cos(cameraYaw)).multiplyScalar(0.48);
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

  animateAvatar(player, elapsed, isMoving, 0, currentSpeed / 3.6);
  animateAvatar(companion, elapsed, isMoving && companion.position.distanceTo(player.position) > 0.8, 1.4, 1.0);

  updateCamera(1, dt);
  updateInteractions();
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
  const shouldRender = started && !document.hidden && memoryOverlay.hidden && helpOverlay.hidden && anniversaryOverlay.hidden && loveletterOverlay.hidden;
  if (shouldRender) {
    clock?.start();
    renderer.setAnimationLoop(render);
  } else {
    clock?.stop();
    renderer.setAnimationLoop(null);
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

  if (!insideHouse && loveMonument) {
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

  if (insideHouse) {
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

    const dBook = Math.hypot(player.position.x - 0.42, player.position.z - (-62.35));
    if (dBook < 2.4) {
      nearestInteractable = { type: 'love-letter' };
      card.classList.remove('is-hidden');
      copy.textContent = 'کتابچه‌ی نامه‌ی ۱ سالگی؛ برای خواندن دکمه را بزن';
      buttonLabel.textContent = '💌 خواندن نامه‌ی ۱ سالگی';
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
  $('#loveletter-from-sign').textContent = `${state.fromName} برای ${state.toName}`;
  loveletterOverlay.hidden = false;
  playRomanticChime(523.25);
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
  showToast('در راهرو باز می‌شود...');
}

function interactNearest() {
  if (!started || currentMemory || !helpOverlay.hidden || !anniversaryOverlay.hidden || !loveletterOverlay.hidden) return;

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
  targetPitch = insideHouse ? 0.16 : 0.22;
  targetDistance = insideHouse ? 6.4 : 8.0;
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

  companion.position.set(-1.15, 0, playerPosition.z + 1.0); companion.rotation.y = 0;
  cameraYaw = 0; targetYaw = 0; yawVelocity = 0;
  cameraPitch = 0.22; targetPitch = 0.22; pitchVelocity = 0;
  cameraDistance = 8.0; targetDistance = 8.0;
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

// Raycasting for Direct Taps (Frames, Altar, Love Monument or Ground)
function handleScreenTap(clientX, clientY) {
  if (!started || !camera || currentMemory || !renderer) return;
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  // 1. Check Interactive Objects
  const intHits = raycaster.intersectObjects(interactiveTargets, true);
  if (intHits.length) {
    const hitObj = intHits[0].object;
    if (hitObj.userData?.type === 'love-monument') {
      addLoveCount({ clientX, clientY });
      return;
    }
    if (hitObj.userData?.type === 'anniversary-mantle') {
      openAnniversaryModal();
      return;
    }
    if (hitObj.userData?.type === 'love-letter') {
      openLoveLetterModal();
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
    targetDistance = clamp(targetDistance + e.deltaY * 0.005, 2.2, 11.5);
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

    touchStartTime = Date.now();
    pointerMoved = false;

    // Touch device or mobile viewport: Primary touch is movement, secondary touch is camera
    if (e.pointerType === 'touch' || isMobileViewport()) {
      if (touchMovePointerId === null) {
        touchMovePointerId = e.pointerId;
        touchOriginX = e.clientX;
        touchOriginY = e.clientY;
        touchMoveActive = false;
        touchVector.set(0, 0);

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
      }
    } else {
      // Desktop Mouse Drag = Camera Rotation
      isDraggingCamera = true;
      cameraDragPointerId = e.pointerId;
      lastDragX = e.clientX;
      lastDragY = e.clientY;
      yawVelocity = 0;
      pitchVelocity = 0;
    }
  });

  window.addEventListener('pointermove', (e) => {
    // 1. Handle Active Touch Movement on screen
    if (e.pointerId === touchMovePointerId) {
      const dx = e.clientX - touchOriginX;
      const dy = e.clientY - touchOriginY;
      const dist = Math.hypot(dx, dy);

      if (dist > 8) {
        pointerMoved = true;
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

    // 2. Handle Camera Drag Rotation
    if (isDraggingCamera && e.pointerId === cameraDragPointerId) {
      const dx = e.clientX - lastDragX;
      const dy = e.clientY - lastDragY;
      if (Math.hypot(dx, dy) > 4) pointerMoved = true;

      targetYaw -= dx * 0.0048;
      targetPitch = clamp(targetPitch + dy * 0.0035, 0.02, 0.58);

      yawVelocity = -dx * 0.0048 / 0.016;
      pitchVelocity = dy * 0.0035 / 0.016;

      lastDragX = e.clientX;
      lastDragY = e.clientY;
    }
  });

  const finishTouch = (e) => {
    // Finish on-screen movement touch
    if (e.pointerId === touchMovePointerId) {
      const tapDuration = Date.now() - touchStartTime;
      const wasTap = !pointerMoved && tapDuration < 350;

      touchMovePointerId = null;
      touchMoveActive = false;
      touchVector.set(0, 0);
      if (dynamicTouchIndicator) dynamicTouchIndicator.hidden = true;
      if (touchKnobInner) touchKnobInner.style.transform = 'translate3d(0, 0, 0)';

      if (wasTap) {
        handleScreenTap(e.clientX, e.clientY);
      }
    }

    // Finish camera drag
    if (isDraggingCamera && e.pointerId === cameraDragPointerId) {
      isDraggingCamera = false;
      cameraDragPointerId = null;
      if (!pointerMoved && Date.now() - touchStartTime < 350) {
        handleScreenTap(e.clientX, e.clientY);
      }
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
      targetDistance = clamp(targetDistance + delta * 0.02, 2.2, 11.5);
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
