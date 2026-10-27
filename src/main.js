import * as THREE from 'three';
import { museumDefaults, memories } from './memories.js';
import './style.css';

const $ = (selector) => document.querySelector(selector);
const canvas = $('#world');
const intro = $('#intro-screen');
const hud = $('#hud');
const setupForm = $('#setup-form');
const touchPad = $('#touch-pad');
const memoryOverlay = $('#memory-overlay');
const helpOverlay = $('#help-overlay');

const storageKey = 'our-museum-gift-v1';
let saved = {};
try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch { saved = {}; }
const state = {
  fromName: saved.fromName || museumDefaults.fromName,
  toName: saved.toName || museumDefaults.toName,
  dedication: saved.dedication || museumDefaults.dedication,
  avatarColor: saved.avatarColor || '#30313a',
};

$('#from-name').value = state.fromName;
$('#to-name').value = state.toName;
$('#dedication').value = state.dedication;
document.querySelectorAll('.swatch').forEach((button) => {
  button.classList.toggle('is-selected', button.dataset.color === state.avatarColor);
});

let renderer, scene, camera, clock;
let player, companion;
let leftDoorPivot = null;
let rightDoorPivot = null;
let started = false;
let currentMemory = null;
let nearestMemory = null;
let cameraYaw = 0;
let cameraDistance = 7.8;
let cameraHeight = 3.65;
let doorProgress = 0;
let doorTarget = 0;
let entryQueued = false;
let insideHouse = false;
let dragging = false;
let dragStart = null;
let dragPointerId = null;
let pointerMoved = false;
let suppressClickUntil = 0;
let joystickPointerId = null;
let joystickCenter = null;
let toastTimer = null;
let movementTarget = null;
let dedicationSign = null;
const keys = new Set();
const frameTargets = [];
const frameRecords = [];
const pendingPhotoLoads = [];
const playerPosition = new THREE.Vector3(0, 0, 14);
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const dummy = new THREE.Object3D();

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const isMobileViewport = () => window.innerWidth < 700 || Boolean(window.matchMedia?.('(pointer: coarse)').matches && window.innerWidth < 1100);
const colorMaterial = (color, roughness = 0.7, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });

function createRenderer() {
  const mobile = isMobileViewport();
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, alpha: false, powerPreference: 'high-performance', stencil: false });
  } catch (error) {
    console.error('WebGL could not be initialized:', error);
    showToast('این مرورگر امکان اجرای گرافیک سه‌بعدی را ندارد.');
    return false;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.18 : 1.65));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return true;
}

function createFloorTexture() {
  const tile = document.createElement('canvas');
  tile.width = 512; tile.height = 512;
  const ctx = tile.getContext('2d');
  ctx.fillStyle = '#b4ad9e'; ctx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 128) {
    for (let x = 0; x < 512; x += 128) {
      const offset = (Math.floor(y / 128) % 2) * 64;
      const px = (x + offset) % 512;
      const shade = ((x + y) / 128) % 4;
      ctx.fillStyle = ['#c8c1b1', '#c1baaa', '#d0c9bb', '#beb7a8'][shade];
      ctx.fillRect(px + 2, y + 2, 124, 124);
      ctx.fillStyle = '#a49c8d'; ctx.fillRect(px, y, 128, 2); ctx.fillRect(px, y, 2, 128);
    }
  }
  const texture = new THREE.CanvasTexture(tile);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(7, 9); texture.anisotropy = renderer ? Math.min(4, renderer.capabilities.getMaxAnisotropy()) : 1;
  return texture;
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
    ctx.fillStyle = '#202430'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#a88d5d'; ctx.lineWidth = 2; ctx.strokeRect(7, 7, w - 14, h - 14);
    ctx.fillStyle = '#d1bb8b'; ctx.font = '600 11px Georgia, serif'; ctx.textAlign = 'center'; ctx.direction = 'ltr';
    ctx.fillText('OUR HOME · OUR STORY', w / 2, 23);
    ctx.fillStyle = '#f2ead9'; ctx.font = '600 22px Tahoma, Arial, sans-serif'; ctx.direction = 'rtl';
    ctx.fillText(`برایِ ${state.toName}`, w / 2, 51, w - 36);
    ctx.fillStyle = '#d2c5ab'; ctx.font = '14px Tahoma, Arial, sans-serif';
    const words = state.dedication.split(/\s+/); const lines = [''];
    for (const word of words) {
      const current = lines[lines.length - 1];
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width > w - 56 && lines.length < 2) lines.push(word);
      else lines[lines.length - 1] = candidate;
    }
    ctx.fillText(lines[0] || 'تمامِ لحظه‌های ما', w / 2, 77, w - 42);
    if (lines[1]) ctx.fillText(lines[1], w / 2, 96, w - 42);
    ctx.fillStyle = '#ba9e6c'; ctx.font = 'italic 11px Georgia, serif'; ctx.direction = 'ltr';
    ctx.fillText(`with love, ${state.fromName}`, w / 2, 126, w - 32);
  }, 512, 144);
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
    // A small no-photo marker: this is decorative placeholder art, not a photo.
    ctx.strokeStyle = '#fffaf0'; ctx.globalAlpha = 0.67; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(w * 0.39, h * 0.36, w * 0.22, h * 0.18, 7); ctx.stroke();
    ctx.beginPath(); ctx.arc(w * 0.5, h * 0.45, h * 0.045, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#fffaf0'; ctx.font = '600 13px Tahoma, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.direction = 'rtl';
    ctx.fillText('جای عکس', w / 2, h * 0.62);
    ctx.fillStyle = '#fffaf0a8'; ctx.font = '9px Arial, sans-serif'; ctx.direction = 'ltr';
    ctx.fillText(`MEMORY ${String(index + 1).padStart(2, '0')}`, w / 2, h * 0.94);
  }, 600, 800);
}

function makePlaqueTexture(memory, index) {
  return makeCanvasTexture((ctx, w, h) => {
    ctx.fillStyle = '#1c2130'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#a88d5d'; ctx.lineWidth = 2; ctx.strokeRect(9, 9, w - 18, h - 18);
    ctx.fillStyle = '#c3a775'; ctx.font = '600 12px Tahoma, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.direction = 'rtl';
    ctx.fillText(`یادگاریِ ${String(index + 1).padStart(2, '۰')}`, w / 2, 34);
    ctx.fillStyle = '#f3ead8'; ctx.font = '600 25px Tahoma, Arial, sans-serif';
    ctx.fillText(memory.title, w / 2, 72);
  }, 512, 112);
}

function createFrame(memory, index, x, y, z, rotationY, width = 2.65, height = 2.45) {
  const group = new THREE.Group();
  group.position.set(x, y, z); group.rotation.y = rotationY; scene.add(group);
  const frameMat = colorMaterial(index % 2 ? 0x9d855d : 0xb69b6b, 0.27, 0.55);
  const ivoryMat = colorMaterial(0xf2ede2, 0.42, 0.03);
  const bar = 0.13;
  // Shadow panel behind the artwork.
  addBox(group, width + 0.14, height + 0.14, 0.14, colorMaterial(0x0b0e14, 0.38), 0, 0, -0.03, { castShadow: true, receiveShadow: false });
  addBox(group, width, height, 0.11, frameMat, 0, 0, 0.04);
  addBox(group, width - bar * 1.5, height - bar * 1.5, 0.07, ivoryMat, 0, 0, 0.11, { castShadow: false });
  const artWidth = width - 0.42, artHeight = height - 0.48;
  const artTexture = makeAbstractArtwork(memory, index);
  const art = new THREE.Mesh(new THREE.PlaneGeometry(artWidth, artHeight), new THREE.MeshBasicMaterial({ map: artTexture, side: THREE.DoubleSide }));
  art.position.set(0, 0, 0.155); art.userData.memory = memory; art.userData.index = index; group.add(art);
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
      art.geometry.dispose(); art.geometry = new THREE.PlaneGeometry(fitWidth, fitHeight);
      art.material.map?.dispose(); art.material.map = texture; art.material.needsUpdate = true;
    }, undefined, (error) => console.warn(`Could not load memory image: ${memory.imageSrc}`, error));
    if (started) loadPhoto(); else pendingPhotoLoads.push(loadPhoto);
  }
  frameTargets.push(art);
  // Tiny brass corners and bottom plaque.
  const cornerMat = colorMaterial(0xd0b67c, 0.24, 0.72);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), cornerMat);
    pin.position.set(sx * (width / 2 - 0.12), sy * (height / 2 - 0.12), 0.19); group.add(pin);
  }
  const plaqueWidth = Math.max(width - 0.05, 1.7);
  addBox(group, plaqueWidth + 0.08, 0.55, 0.11, colorMaterial(0xb4a58c, 0.5, 0.16), 0, -height / 2 - 0.42, 0.015, { castShadow: false });
  const plaqueTex = makePlaqueTexture(memory, index);
  const plaque = new THREE.Mesh(new THREE.PlaneGeometry(plaqueWidth, 0.45), new THREE.MeshBasicMaterial({ map: plaqueTex }));
  plaque.position.set(0, -height / 2 - 0.42, 0.078); group.add(plaque);
  frameRecords.push({ memory, index, x, z, rotationY, group, art });
  return group;
}

function createSpriteLabel(text, accent = '#c9ad7b') {
  const texture = makeCanvasTexture((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const radius = 24;
    ctx.fillStyle = 'rgba(19,22,31,.82)'; ctx.beginPath(); ctx.roundRect(12, 18, w - 24, h - 36, radius); ctx.fill();
    ctx.strokeStyle = 'rgba(229,215,183,.35)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(48, h / 2, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f7f0e1'; ctx.font = '600 30px Tahoma, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.direction = 'rtl';
    ctx.fillText(text, w / 2 + 12, h / 2 + 10, w - 110);
  }, 512, 112);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
  sprite.scale.set(1.45, 0.34, 1); sprite.renderOrder = 4;
  return sprite;
}

function createAvatar(options = {}) {
  const root = new THREE.Group();
  const rig = new THREE.Group(); root.add(rig);
  const skin = colorMaterial(options.skin || 0xe4bea0, 0.74);
  const shirt = colorMaterial(options.shirt || state.avatarColor || 0x7d8b78, 0.8);
  const pants = colorMaterial(options.pants || 0x31394a, 0.82);
  const hair = colorMaterial(options.hair || 0x3c302b, 0.92);
  const shoe = colorMaterial(0x3b302d, 0.7);
  const eye = new THREE.MeshStandardMaterial({ color: 0x392e2a, roughness: 0.7 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf7eee0, roughness: 0.55 });

  // Hips and softly rounded torso.
  const hips = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.27, 0.34, 9), pants);
  hips.position.y = 0.78; hips.castShadow = true; rig.add(hips);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.29, 0.56, 4, 9), shirt);
  torso.position.y = 1.27; torso.castShadow = true; rig.add(torso);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.018, 6, 16), colorMaterial(0xd9c6a7, 0.45));
  collar.position.set(0, 1.70, -0.015); collar.rotation.x = Math.PI / 2; rig.add(collar);
  if (options.vestColor) {
    const vestMat = colorMaterial(options.vestColor, 0.72);
    for (const side of [-1, 1]) {
      const vestPanel = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.035), vestMat);
      vestPanel.position.set(side * 0.09, 1.29, -0.278); vestPanel.castShadow = true; rig.add(vestPanel);
    }
    const buttonMat = colorMaterial(0xc1a674, 0.25, 0.6);
    for (const y of [1.16, 1.31, 1.46]) {
      const button = new THREE.Mesh(new THREE.SphereGeometry(0.018, 7, 6), buttonMat);
      button.position.set(0, y, -0.302); rig.add(button);
    }
  }

  const leftLeg = new THREE.Group(); leftLeg.position.set(-0.14, 0.69, 0); rig.add(leftLeg);
  const rightLeg = new THREE.Group(); rightLeg.position.set(0.14, 0.69, 0); rig.add(rightLeg);
  for (const leg of [leftLeg, rightLeg]) {
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.46, 3, 8), pants);
    mesh.position.y = -0.28; mesh.castShadow = true; leg.add(mesh);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.11, 0.33), shoe);
    foot.position.set(0, -0.61, -0.075); foot.castShadow = true; leg.add(foot);
  }

  const leftArm = new THREE.Group(); leftArm.position.set(-0.34, 1.56, 0); rig.add(leftArm);
  const rightArm = new THREE.Group(); rightArm.position.set(0.34, 1.56, 0); rig.add(rightArm);
  for (const arm of [leftArm, rightArm]) {
    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.42, 3, 8), shirt);
    sleeve.position.y = -0.25; sleeve.rotation.z = arm === leftArm ? -0.08 : 0.08; sleeve.castShadow = true; arm.add(sleeve);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), skin);
    hand.position.y = -0.55; hand.castShadow = true; arm.add(hand);
  }

  const head = new THREE.Group(); head.position.set(0, 2.08, 0); rig.add(head);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.245, 16, 12), skin);
  face.scale.set(0.91, 1.06, 0.92); face.castShadow = true; head.add(face);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.257, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.56), hair);
  cap.position.y = 0.05; cap.castShadow = true; head.add(cap);
  if (options.longHair) {
    const backHair = new THREE.Mesh(new THREE.SphereGeometry(0.245, 12, 10), hair);
    backHair.scale.set(1.08, 1.28, 0.65); backHair.position.set(0, -0.05, 0.055); backHair.castShadow = true; head.add(backHair);
    for (const side of [-1, 1]) {
      const lock = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.43, 3, 7), hair);
      lock.position.set(side * 0.19, -0.25, -0.01); lock.castShadow = true; head.add(lock);
    }
  } else if (options.curls) {
    const curlPoints = [
      [-0.17, 0.10, -0.11], [-0.09, 0.17, -0.16], [0, 0.18, -0.17], [0.09, 0.17, -0.16], [0.17, 0.10, -0.11],
      [-0.20, 0.04, -0.08], [-0.12, 0.08, -0.19], [-0.04, 0.10, -0.21], [0.04, 0.10, -0.21], [0.12, 0.08, -0.19], [0.20, 0.04, -0.08],
    ];
    for (const [x, y, z] of curlPoints) {
      const curl = new THREE.Mesh(new THREE.SphereGeometry(0.073, 8, 7), hair);
      curl.position.set(x, y, z); curl.castShadow = true; head.add(curl);
    }
  } else {
    const fringe = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8, 0, Math.PI, 0, Math.PI * 0.34), hair);
    fringe.position.set(0, 0.1, -0.16); fringe.rotation.x = 0.24; head.add(fringe);
  }
  for (const side of [-1, 1]) {
    const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.027, 8, 7), white);
    eyeWhite.position.set(side * 0.082, 0.012, -0.218); head.add(eyeWhite);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.013, 7, 6), eye);
    pupil.position.set(side * 0.082, 0.008, -0.24); head.add(pupil);
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.027, 7, 6), skin);
  nose.scale.set(0.72, 0.8, 0.75); nose.position.set(0, -0.035, -0.238); head.add(nose);
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.006, 4, 9, Math.PI), eye);
  mouth.position.set(0, -0.09, -0.22); mouth.rotation.z = Math.PI; head.add(mouth);

  const label = createSpriteLabel(options.name || ''); label.position.y = 2.79; rig.add(label);
  root.userData = { rig, leftLeg, rightLeg, leftArm, rightArm, head, label, shirtMaterial: shirt, phase: Math.random() * 6.28 };
  root.traverse((obj) => { if (obj.isMesh) { obj.castShadow = true; if (obj.geometry.type !== 'PlaneGeometry') obj.receiveShadow = true; } });
  return root;
}

function addMemoryFrames() {
  // Portrait-sized frames line the home's warm living room.
  const sideZ = [-17.2, -12.0, -6.8, -1.9];
  const layout = [
    { x: -6.45, z: -21.91, rot: 0 }, { x: -2.15, z: -21.91, rot: 0 },
    { x: 2.15, z: -21.91, rot: 0 }, { x: 6.45, z: -21.91, rot: 0 },
    ...sideZ.map((z) => ({ x: -10.34, z, rot: Math.PI / 2 })),
    ...sideZ.map((z) => ({ x: 10.34, z, rot: -Math.PI / 2 })),
  ];
  memories.forEach((memory, index) => {
    const spot = layout[index] || layout[layout.length - 1];
    createFrame(memory, index, spot.x, 4.25, spot.z, spot.rot, 2.15, 2.9);
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
  texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(3.4, 5.8); texture.anisotropy = renderer ? Math.min(4, renderer.capabilities.getMaxAnisotropy()) : 1;
  return texture;
}

function makeGrassTexture() {
  const image = document.createElement('canvas'); image.width = 256; image.height = 256;
  const ctx = image.getContext('2d'); ctx.fillStyle = '#2a3d32'; ctx.fillRect(0, 0, 256, 256);
  let seed = 47;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const greens = ['#26392e', '#304333', '#344734', '#3d4c37', '#2b3e31'];
  for (let i = 0; i < 950; i++) {
    ctx.fillStyle = greens[Math.floor(random() * greens.length)]; ctx.globalAlpha = 0.28 + random() * 0.5;
    ctx.fillRect(random() * 256, random() * 256, 1 + random() * 2, 1 + random() * 4);
  }
  ctx.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(image); texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(17, 18); texture.anisotropy = renderer ? Math.min(2, renderer.capabilities.getMaxAnisotropy()) : 1;
  return texture;
}

function addGround(width, depth, material, x, y, z) {
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
  plane.rotation.x = -Math.PI / 2; plane.position.set(x, y, z); plane.receiveShadow = true; scene.add(plane);
  return plane;
}

function createFacadeWindow(x, y, width = 3.4, height = 2.6) {
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xc9935d, emissive: 0xffb966, emissiveIntensity: 0.42, roughness: 0.24, metalness: 0.05 });
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
  // A warm inner curtain hint behind the glass.
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
  // Deep inset panels and slim brass inlay give the doors a crafted, high-end finish.
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
  const leafMaterials = [colorMaterial(0x21372d, 0.98), colorMaterial(0x2b4234, 0.98), colorMaterial(0x334a39, 0.98)];
  for (let i = 0; i < 3; i++) {
    const leaves = new THREE.Mesh(new THREE.ConeGeometry((1.45 - i * 0.2) * scale, (2.3 - i * 0.12) * scale, 7), leafMaterials[i]);
    leaves.position.set((i % 2 ? 0.11 : -0.08) * scale, (2.75 + i * 1.08) * scale, 0); leaves.castShadow = true; group.add(leaves);
  }
  return group;
}

function createPlanter(x, z, scale = 1, indoor = false) {
  const group = new THREE.Group(); group.position.set(x, 0, z); scene.add(group);
  const potMat = colorMaterial(indoor ? 0x4e4540 : 0x343b38, 0.42, 0.11);
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.42 * scale, 0.31 * scale, 0.64 * scale, 12), potMat);
  pot.position.y = 0.32 * scale; pot.castShadow = true; group.add(pot);
  const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.34 * scale, 0.34 * scale, 0.055 * scale, 12), colorMaterial(0x292821, 0.98));
  soil.position.y = 0.64 * scale; group.add(soil);
  const leafMats = [colorMaterial(0x395344, 0.86), colorMaterial(0x536b4d, 0.9), colorMaterial(0x63734d, 0.9)];
  const positions = [[0,1.0,0],[-0.28,1.15,0.06],[0.28,1.15,-0.03],[0.1,1.38,0.12],[-0.1,1.33,-0.12],[0,1.55,0]];
  positions.forEach(([px, py, pz], i) => {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry((i === 5 ? 0.23 : 0.27) * scale, 8, 7), leafMats[i % leafMats.length]);
    leaf.scale.set(0.72, 1.25, 0.7); leaf.position.set(px * scale, py * scale, pz * scale); leaf.castShadow = true; group.add(leaf);
  });
  return group;
}

function createPathLight(x, z) {
  const bronze = colorMaterial(0x514538, 0.34, 0.58);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.08, 0.8, 8), bronze);
  post.position.set(x, 0.4, z); post.castShadow = true; scene.add(post);
  const glowMat = new THREE.MeshStandardMaterial({ color: 0xffd59a, emissive: 0xffb85b, emissiveIntensity: 1.2, roughness: 0.35 });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), glowMat);
  lamp.position.set(x, 0.88, z); scene.add(lamp);
}

function createFloorLamp(x, z) {
  const brass = colorMaterial(0x8c7655, 0.27, 0.6);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.34, 0.1, 12), brass); base.position.set(x, 0.06, z); scene.add(base);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.75, 8), brass); stem.position.set(x, 0.96, z); scene.add(stem);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.21, 0.4, 12, 1, true), colorMaterial(0xd8c9ad, 0.65));
  shade.position.set(x, 1.98, z); scene.add(shade);
  const light = new THREE.PointLight(0xffd29b, 4.4, 8, 2); light.position.set(x, 1.78, z); scene.add(light);
}

function createLivingRoomFurniture() {
  const rugMat = colorMaterial(0x9d8873, 0.97);
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(6.3, 4.5), rugMat); rug.rotation.x = -Math.PI / 2; rug.position.set(-6.0, 0.012, -8.25); scene.add(rug);
  const rugBorder = colorMaterial(0xc7ad88, 0.92);
  for (const x of [-9.05, -2.95]) addBox(scene, 0.055, 0.018, 4.3, rugBorder, x, 0.024, -8.25, { castShadow: false });
  for (const z of [-10.4, -6.1]) addBox(scene, 6.1, 0.018, 0.055, rugBorder, -6.0, 0.024, z, { castShadow: false });

  const sofa = colorMaterial(0x343c4b, 0.94);
  const sofaLight = colorMaterial(0x475365, 0.94);
  addBox(scene, 3.75, 0.48, 1.35, sofa, -6.95, 0.48, -8.7);
  addBox(scene, 3.75, 1.15, 0.34, sofa, -6.95, 1.05, -9.34);
  addBox(scene, 0.42, 0.82, 1.48, sofa, -8.78, 0.78, -8.68);
  addBox(scene, 0.42, 0.82, 1.48, sofa, -5.12, 0.78, -8.68);
  for (const x of [-8.15, -6.95, -5.75]) {
    addBox(scene, 1.12, 0.18, 1.08, sofaLight, x, 0.79, -8.62, { castShadow: false });
    addBox(scene, 1.08, 0.74, 0.23, x < -7.4 ? colorMaterial(0xc2a990, 0.96) : sofaLight, x, 1.26, -9.08, { castShadow: false });
  }
  // A low oak coffee table with a tiny book stack.
  const oak = colorMaterial(0x76563d, 0.39, 0.08);
  addBox(scene, 2.2, 0.14, 1.34, oak, -3.8, 0.63, -8.0);
  for (const x of [-4.68, -2.92]) for (const z of [-8.48, -7.52]) addBox(scene, 0.09, 0.6, 0.09, oak, x, 0.31, z);
  addBox(scene, 0.48, 0.06, 0.32, colorMaterial(0x6b5144, 0.85), -4.25, 0.74, -7.85, { castShadow: false });
  addBox(scene, 0.36, 0.045, 0.27, colorMaterial(0xb0916b, 0.82), -4.20, 0.79, -7.80, { castShadow: false });
  createFloorLamp(-9.35, -7.0);
  createPlanter(-9.2, -12.2, 1.12, true);
  createPlanter(8.7, -8.5, 1.18, true);

  // Console and the personalized dedication plaque at the end of the house.
  const consoleMat = colorMaterial(0x554337, 0.42, 0.08);
  addBox(scene, 4.0, 0.24, 0.82, consoleMat, 0, 0.84, -20.2);
  for (const x of [-1.75, 1.75]) addBox(scene, 0.14, 0.78, 0.64, consoleMat, x, 0.42, -20.2);
  addBox(scene, 3.7, 0.08, 0.72, colorMaterial(0x9a7955, 0.34, 0.2), 0, 1.0, -20.2);
  dedicationSign = new THREE.Mesh(new THREE.PlaneGeometry(3.55, 1.0), new THREE.MeshBasicMaterial({ map: createDedicationTexture() }));
  dedicationSign.position.set(0, 1.77, -19.76); scene.add(dedicationSign);
}

function buildHome() {
  scene.background = new THREE.Color(0x111925);
  scene.fog = new THREE.Fog(0x111925, 38, 92);

  const grassMat = new THREE.MeshStandardMaterial({ map: makeGrassTexture(), roughness: 0.98, color: 0xdce3d5 });
  addGround(64, 60, grassMat, 0, -0.14, -1.0);
  const stoneTexture = createFloorTexture(); stoneTexture.repeat.set(2.2, 11.0);
  const pathMat = new THREE.MeshStandardMaterial({ map: stoneTexture, roughness: 0.76, color: 0xd0cabb });
  addGround(6.5, 23.0, pathMat, 0, -0.045, 10.7);
  const pathEdge = colorMaterial(0x675e50, 0.84);
  addBox(scene, 0.07, 0.035, 22.7, pathEdge, -3.22, -0.025, 10.7, { castShadow: false });
  addBox(scene, 0.07, 0.035, 22.7, pathEdge, 3.22, -0.025, 10.7, { castShadow: false });
  for (let z = 1.0; z < 21.5; z += 2.15) addBox(scene, 6.35, 0.025, 0.035, colorMaterial(0x978d7c, 0.92), 0, -0.012, z, { castShadow: false });

  const woodTexture = makeWoodTexture();
  const woodFloor = new THREE.Mesh(new THREE.PlaneGeometry(21.5, 22.2), new THREE.MeshStandardMaterial({ map: woodTexture, roughness: 0.65, metalness: 0.025 }));
  woodFloor.rotation.x = -Math.PI / 2; woodFloor.position.set(0, -0.025, -11.0); woodFloor.receiveShadow = true; scene.add(woodFloor);

  // The home interior: warm plaster, a deep olive feature wall, and a soft timber ceiling.
  const outerStone = colorMaterial(0xc7bda9, 0.86);
  const innerPlaster = colorMaterial(0xe3ddcf, 0.88);
  const sidePlaster = colorMaterial(0xd8d1c3, 0.9);
  const featureWall = colorMaterial(0x374039, 0.86);
  const roofMat = colorMaterial(0x222923, 0.74);
  const walnut = colorMaterial(0x44352c, 0.48, 0.08);
  const brass = colorMaterial(0x9d8157, 0.3, 0.55);
  const ceiling = colorMaterial(0xe1d9c9, 0.86);
  addBox(scene, 21.8, 7.45, 0.62, featureWall, 0, 3.72, -22.25);
  addBox(scene, 0.62, 7.45, 22.4, sidePlaster, -10.78, 3.72, -11.0);
  addBox(scene, 0.62, 7.45, 22.4, sidePlaster, 10.78, 3.72, -11.0);
  // Front facade is split around a wide double door, so the exterior really opens into the home.
  addBox(scene, 8.45, 7.25, 0.72, outerStone, -6.775, 3.62, 0.0);
  addBox(scene, 8.45, 7.25, 0.72, outerStone, 6.775, 3.62, 0.0);
  addBox(scene, 5.3, 2.78, 0.72, outerStone, 0, 5.86, 0.0);
  addBox(scene, 8.3, 7.05, 0.045, innerPlaster, -6.85, 3.58, -0.39, { castShadow: false });
  addBox(scene, 8.3, 7.05, 0.045, innerPlaster, 6.85, 3.58, -0.39, { castShadow: false });
  addBox(scene, 5.2, 2.65, 0.045, innerPlaster, 0, 5.9, -0.39, { castShadow: false });

  // A generous floating roof slab and matching indoor ceiling create a modern villa silhouette.
  addBox(scene, 23.8, 0.5, 24.6, roofMat, 0, 7.62, -10.75);
  addBox(scene, 24.1, 0.18, 0.28, walnut, 0, 7.28, 0.22);
  addBox(scene, 21.25, 0.18, 21.8, ceiling, 0, 7.25, -11.0, { castShadow: false });
  for (const x of [-8.0, -4.0, 0, 4.0, 8.0]) addBox(scene, 0.07, 0.08, 21.2, brass, x, 7.12, -11.0, { castShadow: false });
  for (const z of [-4, -9, -14, -19]) addBox(scene, 18.5, 0.055, 0.05, brass, 0, 7.12, z, { castShadow: false });

  // Exterior window bays with a soft amber glow.
  createFacadeWindow(-6.8, 3.55, 3.5, 2.65);
  createFacadeWindow(6.8, 3.55, 3.5, 2.65);
  // Warm modern wood slats frame the entry.
  for (const side of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      const x = side * (2.82 + i * 0.105);
      addBox(scene, 0.055, 4.35, 0.07, i % 2 ? walnut : brass, x, 2.25, 0.42, { castShadow: false });
    }
  }
  // Stone surround, porch canopy, slim columns and floating steps.
  addBox(scene, 0.22, 4.55, 0.72, outerStone, -2.66, 2.24, 0.0);
  addBox(scene, 0.22, 4.55, 0.72, outerStone, 2.66, 2.24, 0.0);
  addBox(scene, 5.55, 0.19, 0.8, brass, 0, 4.47, 0.02, { castShadow: false });
  addBox(scene, 8.6, 0.32, 3.4, colorMaterial(0x3c3831, 0.5, 0.1), 0, 5.05, 1.55);
  addBox(scene, 8.8, 0.12, 3.5, brass, 0, 4.87, 1.55, { castShadow: false });
  for (const x of [-3.68, 3.68]) {
    addBox(scene, 0.36, 4.88, 0.42, outerStone, x, 2.48, 2.72);
    addBox(scene, 0.66, 0.18, 0.68, brass, x, 4.96, 2.72);
    addBox(scene, 0.62, 0.2, 0.65, outerStone, x, 0.12, 2.72);
  }
  const stepStone = colorMaterial(0xbab09f, 0.7);
  for (let i = 0; i < 3; i++) addBox(scene, 7.8 - i * 0.65, 0.13, 0.62, stepStone, 0, 0.09 + i * 0.02, 0.72 + i * 0.58, { castShadow: false });
  // Hinged double doors: the action key animates these into the house.
  leftDoorPivot = createDoorPivot(1);
  rightDoorPivot = createDoorPivot(-1);
  leftDoorPivot.rotation.y = 0; rightDoorPivot.rotation.y = 0; doorProgress = 0; doorTarget = 0;

  // Exterior lanterns and lush, sculpted greenery.
  const wallGlow = new THREE.MeshStandardMaterial({ color: 0xffd39a, emissive: 0xffb34f, emissiveIntensity: 1.0, roughness: 0.3 });
  for (const x of [-3.2, 3.2]) {
    addBox(scene, 0.32, 0.52, 0.25, walnut, x, 3.6, 0.56);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), wallGlow); glow.position.set(x, 3.6, 0.72); scene.add(glow);
    const light = new THREE.PointLight(0xffc277, 4.5, 9, 2); light.position.set(x, 3.55, 0.82); scene.add(light);
  }
  createPlanter(-4.65, 2.55, 1.05, false); createPlanter(4.65, 2.55, 1.05, false);
  createTree(-13.7, 4.5, 1.35); createTree(13.7, 4.5, 1.35);
  createTree(-16.5, 11.5, 1.0); createTree(16.5, 11.5, 1.0);
  for (const z of [5.2, 10.2, 15.2, 19.5]) { createPathLight(-4.3, z); createPathLight(4.3, z); }

  // Warm, layered lighting: a cool dusk outside and a welcoming amber home inside.
  scene.add(new THREE.HemisphereLight(0xd9e1f1, 0x303a32, 1.08));
  const moon = new THREE.DirectionalLight(0xa7b9df, 1.25); moon.position.set(-14, 20, 10); moon.castShadow = true;
  moon.shadow.mapSize.set(isMobileViewport() ? 512 : 1024, isMobileViewport() ? 512 : 1024); moon.shadow.camera.left = -24; moon.shadow.camera.right = 24; moon.shadow.camera.top = 22; moon.shadow.camera.bottom = -22; moon.shadow.bias = -0.0004; scene.add(moon);
  const interiorWarm = new THREE.PointLight(0xffcf91, 8, 34, 2); interiorWarm.position.set(0, 5.7, -8); scene.add(interiorWarm);
  const interiorBack = new THREE.PointLight(0xffd9a0, 7, 26, 2); interiorBack.position.set(0, 5.7, -18.5); scene.add(interiorBack);
  const porchLight = new THREE.PointLight(0xffc97e, 5.5, 14, 2); porchLight.position.set(0, 4.6, 1.5); scene.add(porchLight);
  const coolFill = new THREE.PointLight(0xaebcda, 2.0, 32, 2); coolFill.position.set(0, 5.0, 10); scene.add(coolFill);
  const sconceZ = isMobileViewport() ? [-7.0, -17.0] : [-3.2, -9.5, -15.8, -20.0];
  for (const z of sconceZ) {
    for (const x of [-8.7, 8.7]) {
      const sconce = new THREE.PointLight(0xffd6a0, isMobileViewport() ? 2.0 : 2.4, 7.2, 2);
      sconce.position.set(x, 4.7, z); scene.add(sconce);
    }
  }

  // A quiet night sky with a small moon above the roofline.
  const starPositions = [];
  let seed = 19;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  for (let i = 0; i < 180; i++) starPositions.push((random() - 0.5) * 70, 10 + random() * 24, -3 + random() * 45);
  const starGeometry = new THREE.BufferGeometry(); starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xf4e6c9, size: 0.11, sizeAttenuation: true, transparent: true, opacity: 0.68 })); scene.add(stars);
  const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(1.05, 20, 16), new THREE.MeshBasicMaterial({ color: 0xe1d9bd })); moonMesh.position.set(-18, 15.5, 1.5); scene.add(moonMesh);

  createLivingRoomFurniture();
}

function createWorld() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(49, window.innerWidth / window.innerHeight, 0.1, 130);
  camera.position.set(0, 4.0, 22.0);
  if (!createRenderer()) return;
  buildHome();
  addMemoryFrames();

  // A pair of stylized characters waits outside the front door.
  player = createAvatar({ name: 'تو', shirt: state.avatarColor, pants: 0xe2dbcf, skin: 0xe4b997, hair: 0x2c231f, longHair: true });
  player.position.copy(playerPosition); player.rotation.y = 0; scene.add(player);
  companion = createAvatar({ name: state.fromName, shirt: 0xe9e3d8, vestColor: 0x292c34, pants: 0x344052, skin: 0xd9aa88, hair: 0x322a27, curls: true });
  companion.position.set(-1.15, 0, 15.0); companion.rotation.y = 0; scene.add(companion);
  updateCamera(1);
  clock = new THREE.Clock();
  clock.stop();
  // The welcome screen is HTML/CSS; keep WebGL idle until the player starts.
  renderer.setAnimationLoop(null);
}

function updateCamera(smooth = 0.14) {
  if (!camera || !player) return;
  const forward = new THREE.Vector3(Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
  const target = player.position.clone().addScaledVector(forward, insideHouse ? 2.8 : 4.1);
  target.y = 1.12;
  const desired = new THREE.Vector3(
    player.position.x - Math.sin(cameraYaw) * cameraDistance,
    player.position.y + cameraHeight,
    player.position.z + Math.cos(cameraYaw) * cameraDistance,
  );
  camera.position.lerp(desired, smooth);
  camera.lookAt(target);
}

function animateAvatar(avatar, time, walking, offset = 0) {
  if (!avatar) return;
  const u = avatar.userData;
  const phase = time * 9 + u.phase + offset;
  const amp = walking ? 0.5 : 0.025;
  u.leftLeg.rotation.x = Math.sin(phase) * amp;
  u.rightLeg.rotation.x = -Math.sin(phase) * amp;
  u.leftArm.rotation.x = -Math.sin(phase) * amp * 0.62;
  u.rightArm.rotation.x = Math.sin(phase) * amp * 0.62;
  u.rig.position.y = walking ? Math.abs(Math.sin(phase * 0.5)) * 0.045 : Math.sin(time * 1.3 + u.phase) * 0.018;
  u.head.rotation.z = walking ? Math.sin(phase * 0.35) * 0.018 : Math.sin(time * 1.0 + u.phase) * 0.012;
}

function updateDoor(dt) {
  if (!leftDoorPivot || !rightDoorPivot) return;
  doorProgress = lerp(doorProgress, doorTarget, 1 - Math.exp(-dt * 2.25));
  leftDoorPivot.rotation.y = doorProgress * 1.22;
  rightDoorPivot.rotation.y = -doorProgress * 1.22;
}

function isNearDoor() {
  return Boolean(player && !insideHouse && !entryQueued && Math.abs(player.position.x) < 4.55 && player.position.z < 4.5 && player.position.z > 0.6);
}

function updateSceneLocation() {
  const label = $('#scene-location')?.querySelector('span:last-child');
  if (label) label.textContent = insideHouse ? 'داخل خانه' : 'حیاط خانه';
  const subtitle = $('#hud-subtitle');
  if (subtitle) subtitle.textContent = insideHouse ? `خانه‌ی ${state.toName}` : 'جلوی خانه‌ی خاطره‌ها';
}

function setHouseZone(inside) {
  if (insideHouse === inside) return;
  insideHouse = inside;
  if (inside) {
    cameraDistance = 5.8; cameraHeight = 3.25; doorTarget = 1;
    showToast(`به خانه‌ی ${state.toName} خوش آمدی`);
  } else {
    cameraDistance = 7.8; cameraHeight = 3.65;
    showToast('به حیاط خانه برگشتی');
  }
  updateSceneLocation();
}

function updateGame(dt, elapsed) {
  updateDoor(dt);
  if (!started || !player) {
    updateCamera(0.12);
    return;
  }
  if (currentMemory || helpOverlay.hidden === false) {
    animateAvatar(player, elapsed, false);
    animateAvatar(companion, elapsed, false, 1.4);
    updateCamera(0.12);
    return;
  }

  if (entryQueued && doorProgress > 0.72 && !movementTarget) {
    movementTarget = new THREE.Vector3(0, 0, -6.2);
  }
  const forwardInput = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  const sideInput = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  let moved = false;
  if (movementTarget) {
    const delta = movementTarget.clone().sub(player.position); delta.y = 0;
    const distance = delta.length();
    if (distance < 0.24) {
      movementTarget = null;
      if (entryQueued) { entryQueued = false; showToast('قدم بزن و خاطره‌ها را پیدا کن'); }
    } else {
      delta.normalize(); player.position.addScaledVector(delta, Math.min(3.6 * dt, distance));
      player.rotation.y = Math.atan2(-delta.x, -delta.z); moved = true;
    }
  } else if (forwardInput || sideInput) {
    const forward = new THREE.Vector3(Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
    const right = new THREE.Vector3(Math.cos(cameraYaw), 0, Math.sin(cameraYaw));
    const direction = forward.multiplyScalar(forwardInput).add(right.multiplyScalar(sideInput));
    if (direction.lengthSq() > 0) {
      direction.normalize();
      const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 5.0 : 3.45;
      player.position.addScaledVector(direction, speed * dt);
      player.rotation.y = Math.atan2(-direction.x, -direction.z);
      moved = true;
    }
  }

  const doorPassable = doorProgress > 0.72 && Math.abs(player.position.x) < 2.62;
  if (insideHouse) {
    player.position.x = clamp(player.position.x, -9.8, 9.8);
    player.position.z = clamp(player.position.z, -21.25, doorPassable ? 2.2 : -0.55);
  } else {
    player.position.x = clamp(player.position.x, -17.0, 17.0);
    player.position.z = clamp(player.position.z, doorPassable ? -6.5 : 1.0, 22.0);
  }
  if (!insideHouse && doorPassable && player.position.z < 0.1) setHouseZone(true);
  if (insideHouse && doorPassable && player.position.z > 0.85) setHouseZone(false);
  playerPosition.copy(player.position);

  // The partner avatar follows, turning from the night outside into the warm living room.
  const side = new THREE.Vector3(Math.cos(cameraYaw), 0, Math.sin(cameraYaw)).multiplyScalar(-1.05);
  const behind = new THREE.Vector3(Math.sin(cameraYaw), 0, Math.cos(cameraYaw)).multiplyScalar(0.42);
  const followTarget = player.position.clone().add(side).add(behind);
  if (insideHouse) {
    followTarget.x = clamp(followTarget.x, -9.4, 9.4); followTarget.z = clamp(followTarget.z, -20.8, -0.5);
  } else {
    followTarget.x = clamp(followTarget.x, -15.5, 15.5); followTarget.z = clamp(followTarget.z, 1.2, 21.5);
  }
  companion.position.lerp(followTarget, 1 - Math.exp(-dt * 2.4));
  const toPlayer = player.position.clone().sub(companion.position); toPlayer.y = 0;
  if (toPlayer.lengthSq() > 0.01) companion.rotation.y = Math.atan2(-toPlayer.x, -toPlayer.z);

  animateAvatar(player, elapsed, moved);
  animateAvatar(companion, elapsed, moved && companion.position.distanceTo(player.position) > 1.0, 1.4);
  updateCamera(1 - Math.exp(-dt * 5.0));
  updateNearestMemory();
}

function render() {
  if (!renderer || !scene || !camera) return;
  const dt = Math.min(clock ? clock.getDelta() : 0.016, 0.05);
  const elapsed = clock ? clock.elapsedTime : 0;
  updateGame(dt, elapsed);
  renderer.render(scene, camera);
}

function syncAnimationLoop() {
  if (!renderer) return;
  const shouldRender = started && !document.hidden && memoryOverlay.hidden && helpOverlay.hidden;
  if (shouldRender) {
    clock?.start();
    renderer.setAnimationLoop(render);
  } else {
    clock?.stop();
    renderer.setAnimationLoop(null);
  }
}

function updateNearestMemory() {
  if (!player) return;
  const card = $('#interaction-card');
  const button = $('#interact-button');
  const copy = $('#interaction-copy');
  const buttonLabel = button.querySelector('span:nth-child(2)');
  nearestMemory = null;

  if (!insideHouse) {
    if (started && isNearDoor() && !entryQueued) {
      card.classList.remove('is-hidden');
      copy.textContent = doorProgress > 0.72 ? 'در باز است؛ برای ورود به خانه دکمه را بزن' : 'جلوی در ایستادی؛ برای ورود دکمه را بزن';
      buttonLabel.textContent = doorProgress > 0.72 ? 'وارد خانه شو' : 'بازکردن در و ورود';
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
  nearestMemory = bestDistance < 3.35 ? best : null;
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
  const persianDigits = (n) => String(n).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
  $('#progress-count').textContent = `${persianDigits(count)} / ${persianDigits(memories.length)}`;
  $('#progress-bar').style.width = `${(count / memories.length) * 100}%`;
}

function openMemory(memory, index) {
  if (!memory) return;
  currentMemory = memory;
  movementTarget = null;
  $('#memory-title').textContent = memory.title;
  $('#memory-caption').textContent = memory.caption;
  $('#memory-date').textContent = memory.date || `یادگاری شماره‌ی ${String(index + 1).padStart(2, '۰')}`;
  $('#memory-author').textContent = state.fromName;
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
  memoryOverlay.hidden = false;
  syncAnimationLoop();
  $('#close-memory').focus({ preventScroll: true });
}

function closeMemory() {
  memoryOverlay.hidden = true;
  currentMemory = null;
  syncAnimationLoop();
  canvas.focus({ preventScroll: true });
  updateNearestMemory();
}

function beginEntry() {
  if (!started || insideHouse || entryQueued || !isNearDoor()) return;
  entryQueued = true;
  movementTarget = null;
  doorTarget = 1;
  keys.clear();
  showToast('درهای خانه باز می‌شوند…');
}

function interactNearest() {
  if (!started || currentMemory || !helpOverlay.hidden) return;
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
    showToast('به سمت در خانه راه می‌افتی'); return;
  }
  if (!nearestMemory) {
    let closest = null; let bestDistance = Infinity;
    for (const record of frameRecords) {
      const distance = Math.hypot(player.position.x - record.x, player.position.z - record.z);
      if (distance < bestDistance) { bestDistance = distance; closest = record; }
    }
    if (closest) {
      const approachDistance = 3.0;
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

function startGame() {
  state.fromName = $('#from-name').value.trim() || 'من';
  state.toName = $('#to-name').value.trim() || 'عزیزم';
  state.dedication = $('#dedication').value.trim() || museumDefaults.dedication;
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
  $('#hud-from').textContent = state.fromName;
  $('#hud-to').textContent = state.toName;
  $('#hud-subtitle').textContent = `خانه‌ی ${state.toName}`;
  insideHouse = false; entryQueued = false; movementTarget = null; doorProgress = 0; doorTarget = 0;
  keys.clear(); resetJoystick();
  if (leftDoorPivot) leftDoorPivot.rotation.y = 0;
  if (rightDoorPivot) rightDoorPivot.rotation.y = 0;
  player.position.copy(playerPosition); player.rotation.y = 0;
  companion.position.set(-1.15, 0, playerPosition.z + 1.0); companion.rotation.y = 0;
  cameraYaw = 0; cameraDistance = 7.8; cameraHeight = 3.65;
  updateSceneLocation();
  player.userData.label.material.map.dispose();
  player.userData.label.material.map = createSpriteLabel(state.toName, '#c9ad7b').material.map;
  player.userData.label.material.needsUpdate = true;
  companion.userData.label.material.map.dispose();
  companion.userData.label.material.map = createSpriteLabel(state.fromName, '#d89a92').material.map;
  companion.userData.label.material.needsUpdate = true;
  player.userData.shirtMaterial.color.set(state.avatarColor);
  started = true;
  for (const loadPhoto of pendingPhotoLoads.splice(0)) loadPhoto();
  syncAnimationLoop();
  intro.classList.add('is-leaving');
  hud.classList.remove('is-hidden');
  canvas.focus({ preventScroll: true });
  setTimeout(() => { intro.hidden = true; }, 850);
  showToast('از حیاط به سمت درِ خانه برو');
}

function updateSettingsFromForm() {
  state.fromName = $('#from-name').value.trim() || 'من';
  state.toName = $('#to-name').value.trim() || 'عزیزم';
  state.dedication = $('#dedication').value.trim() || museumDefaults.dedication;
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function raycastFrame(event) {
  if (!started || !insideHouse || !camera || currentMemory || !renderer) return;
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(frameTargets, false);
  if (hits.length) {
    const target = hits[0].object;
    openMemory(target.userData.memory, target.userData.index);
  }
}

function handleResize() {
  if (!camera || !renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.fov = window.innerWidth < 700 ? 55 : 49;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobileViewport() ? 1.18 : 1.65));
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Form and personalization.
setupForm.addEventListener('submit', (event) => { event.preventDefault(); updateSettingsFromForm(); startGame(); });
document.querySelectorAll('.swatch').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.swatch').forEach((item) => item.classList.remove('is-selected'));
    button.classList.add('is-selected'); state.avatarColor = button.dataset.color;
    if (player?.userData.shirtMaterial) player.userData.shirtMaterial.color.set(state.avatarColor);
  });
});

// Desktop controls; avoid hijacking typing in the setup form.
window.addEventListener('keydown', (event) => {
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code) && started) event.preventDefault();
  if (event.code === 'Escape') {
    if (!memoryOverlay.hidden) closeMemory();
    else if (!helpOverlay.hidden) closeHelp();
    else if (movementTarget) { movementTarget = null; entryQueued = false; }
    return;
  }
  if (event.code === 'KeyE' || event.code === 'Enter') { if (started && memoryOverlay.hidden && helpOverlay.hidden) interactNearest(); }
  if (event.code === 'KeyW' || event.code === 'KeyA' || event.code === 'KeyS' || event.code === 'KeyD' || event.code.startsWith('Arrow') || event.code === 'ShiftLeft' || event.code === 'ShiftRight') keys.add(event.code);
});
window.addEventListener('keyup', (event) => keys.delete(event.code));
window.addEventListener('blur', () => { keys.clear(); resetJoystick(); });
document.addEventListener('visibilitychange', () => {
  keys.clear(); resetJoystick();
  syncAnimationLoop();
});
canvas.addEventListener('click', (event) => {
  if (Date.now() < suppressClickUntil) return;
  raycastFrame(event);
});
canvas.addEventListener('pointerdown', (event) => {
  if (!started || currentMemory || (event.pointerType === 'mouse' && event.button !== 0)) return;
  dragging = true; pointerMoved = false; dragPointerId = event.pointerId;
  dragStart = { x: event.clientX, y: event.clientY };
  canvas.setPointerCapture?.(event.pointerId);
});
canvas.addEventListener('pointermove', (event) => {
  if (!dragging || !dragStart || event.pointerId !== dragPointerId) return;
  const dx = event.clientX - dragStart.x;
  const dy = event.clientY - dragStart.y;
  if (Math.abs(dx) + Math.abs(dy) > 2) {
    if (Math.abs(dx) + Math.abs(dy) > 5) pointerMoved = true;
    const sensitivity = event.pointerType === 'touch' ? 0.0066 : 0.004;
    cameraYaw -= dx * sensitivity;
    cameraHeight = clamp(cameraHeight + dy * (event.pointerType === 'touch' ? 0.005 : 0.008), 2.55, 5.0);
    dragStart = { x: event.clientX, y: event.clientY };
  }
});
function finishCameraDrag(event) {
  if (event?.pointerId !== undefined && dragPointerId !== null && event.pointerId !== dragPointerId) return;
  if (pointerMoved) suppressClickUntil = Date.now() + 220;
  dragging = false; dragStart = null; dragPointerId = null; pointerMoved = false;
}
canvas.addEventListener('pointerup', finishCameraDrag);
canvas.addEventListener('pointercancel', finishCameraDrag);
canvas.addEventListener('lostpointercapture', finishCameraDrag);
canvas.addEventListener('wheel', (event) => {
  if (!started) return;
  cameraDistance = clamp(cameraDistance + Math.sign(event.deltaY) * 0.35, insideHouse ? 4.2 : 5.5, insideHouse ? 8.0 : 10.5);
}, { passive: true });

// Thumbstick-style movement for phones and tablets.
const joystickBase = touchPad.querySelector('.joystick-base');
const joystickKnob = $('#joystick-knob');
function updateJoystick(event) {
  if (!joystickCenter || !joystickKnob) return;
  let dx = event.clientX - joystickCenter.x;
  let dy = event.clientY - joystickCenter.y;
  const radius = joystickBase.getBoundingClientRect().width * 0.31;
  const magnitude = Math.hypot(dx, dy);
  if (magnitude > radius) { dx = (dx / magnitude) * radius; dy = (dy / magnitude) * radius; }
  joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) keys.delete(code);
  const deadzone = radius * 0.22;
  if (dy < -deadzone) keys.add('KeyW');
  if (dy > deadzone) keys.add('KeyS');
  if (dx < -deadzone) keys.add('KeyA');
  if (dx > deadzone) keys.add('KeyD');
}
function resetJoystick() {
  for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) keys.delete(code);
  if (joystickKnob) joystickKnob.style.transform = 'translate(0px, 0px)';
  joystickPointerId = null; joystickCenter = null;
}
if (joystickBase) {
  joystickBase.addEventListener('pointerdown', (event) => {
    if (!started) return;
    event.preventDefault(); joystickPointerId = event.pointerId;
    const rect = joystickBase.getBoundingClientRect();
    joystickCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    joystickBase.setPointerCapture?.(event.pointerId);
    updateJoystick(event);
  });
  joystickBase.addEventListener('pointermove', (event) => {
    if (event.pointerId !== joystickPointerId) return;
    event.preventDefault(); updateJoystick(event);
  });
  const releaseJoystick = (event) => {
    if (event.pointerId !== joystickPointerId) return;
    event.preventDefault(); resetJoystick();
  };
  joystickBase.addEventListener('pointerup', releaseJoystick);
  joystickBase.addEventListener('pointercancel', releaseJoystick);
  joystickBase.addEventListener('lostpointercapture', releaseJoystick);
}
$('#interact-button').addEventListener('click', interactNearest);
$('#close-memory').addEventListener('click', closeMemory);
$('#memory-backdrop').addEventListener('click', closeMemory);
$('#next-memory').addEventListener('click', () => {
  const index = memories.findIndex((memory) => memory.id === currentMemory?.id);
  const next = memories[(index + 1) % memories.length];
  closeMemory();
  openMemory(next, (index + 1) % memories.length);
});

function openHelp() { helpOverlay.hidden = false; syncAnimationLoop(); $('#close-help').focus({ preventScroll: true }); }
function closeHelp() { helpOverlay.hidden = true; syncAnimationLoop(); canvas.focus({ preventScroll: true }); }
$('#help-button').addEventListener('click', openHelp);
$('#close-help').addEventListener('click', closeHelp);
$('#help-close-action').addEventListener('click', closeHelp);
$('#help-backdrop').addEventListener('click', closeHelp);
$('#fullscreen-button').addEventListener('click', async () => {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  } catch { showToast('تمام‌صفحه در این مرورگر در دسترس نیست.'); }
});

// Keep the welcome screen lightweight; initialize WebGL and the 3D scene on demand.
updateProgress();
window.addEventListener('resize', handleResize);
window.addEventListener('storage', (event) => { if (event.key === storageKey) showToast('تنظیمات هدیه به‌روز شد.'); });
