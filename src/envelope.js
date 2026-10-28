import * as THREE from 'three';
import { LAYOUT, wrapText } from './world.js';

const FONT = '"Vazirmatn Variable", Vazirmatn, sans-serif';
const PAPER_W = 2.7;
const PAPER_H = 1.9;
const FLAP_TIME = 0.9;
const PAPER_TIME = 0.9;

function drawPaper(ctx, w, h, fromName, toName, paragraph) {
  ctx.fillStyle = '#fff6ea';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#e6b86f';
  ctx.lineWidth = 6;
  ctx.strokeRect(26, 26, w - 52, h - 52);
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#6b2c45';
  ctx.font = `900 62px ${FONT}`;
  ctx.fillText(`برای ${toName}`, w / 2, 120);

  ctx.fillStyle = '#8a5a3c';
  ctx.font = `500 34px ${FONT}`;
  ctx.fillText(`نامه‌ای از طرف ${fromName}`, w / 2, 196);

  ctx.fillStyle = '#2b1f2e';
  ctx.font = `500 36px ${FONT}`;
  const lines = wrapText(ctx, paragraph, w - 260, 5);
  lines.forEach((line, i) => ctx.fillText(line, w / 2, 290 + i * 66));
}

// A big envelope standing at the end of the hall. Opening it lifts the flap,
// slides the letter out and then calls onOpened so the letter can be read.
export function createEnvelope(scene, { fromName, toName, paragraph }) {
  const { x, y, z, w, h } = LAYOUT.envelope;
  const group = new THREE.Group();
  group.position.set(x, y, z);
  scene.add(group);

  const bodyMat = new THREE.MeshStandardMaterial({ color: '#fbefe0', roughness: 0.75 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), bodyMat);
  body.position.set(0, h / 2, 0);
  group.add(body);

  // Back inner lining, visible through the gap when the flap opens
  const lining = new THREE.Mesh(
    new THREE.PlaneGeometry(w - 0.2, h - 0.2),
    new THREE.MeshStandardMaterial({ color: '#c99272', roughness: 0.9, side: THREE.DoubleSide })
  );
  lining.position.set(0, h / 2, -0.045);
  group.add(lining);

  // Seal
  const seal = new THREE.Mesh(
    new THREE.CircleGeometry(0.22, 32),
    new THREE.MeshStandardMaterial({ color: '#b3223d', roughness: 0.5 })
  );
  seal.position.set(0, h * 0.4, 0.05);
  group.add(seal);

  // Flap, hinged on its top edge
  const flapShape = new THREE.Shape();
  flapShape.moveTo(-w / 2, 0);
  flapShape.lineTo(w / 2, 0);
  flapShape.lineTo(0, -h * 0.6);
  flapShape.closePath();
  const flapMat = new THREE.MeshStandardMaterial({ color: '#e59aae', roughness: 0.6, side: THREE.DoubleSide });
  const flapPivot = new THREE.Group();
  flapPivot.position.set(0, h, 0.045);
  group.add(flapPivot);
  const flap = new THREE.Mesh(new THREE.ShapeGeometry(flapShape), flapMat);
  flapPivot.add(flap);

  // Letter paper, hidden inside the envelope until it's pulled out
  const paperCanvas = document.createElement('canvas');
  paperCanvas.width = 1024;
  paperCanvas.height = 720;
  const paperTex = new THREE.CanvasTexture(paperCanvas);
  paperTex.colorSpace = THREE.SRGBColorSpace;
  const paper = new THREE.Mesh(
    new THREE.PlaneGeometry(PAPER_W, PAPER_H),
    new THREE.MeshStandardMaterial({ map: paperTex, roughness: 0.9 })
  );
  paper.position.set(0, h / 2, -0.02);
  group.add(paper);

  // Soft warm glow behind the envelope
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = 256;
  glowCanvas.height = 256;
  const gctx = glowCanvas.getContext('2d');
  const grad = gctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255,190,140,0.9)');
  grad.addColorStop(1, 'rgba(255,190,140,0)');
  gctx.fillStyle = grad;
  gctx.fillRect(0, 0, 256, 256);
  const glowTex = new THREE.CanvasTexture(glowCanvas);
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })
  );
  glow.scale.set(w + 2.6, h + 2.2, 1);
  glow.position.set(0, h / 2, -0.3);
  group.add(glow);

  let state = 'closed'; // closed -> flap -> paper -> open
  let stateTime = 0;
  let onOpened = null;

  function setNames(from, to, text) {
    drawPaper(paperCanvas.getContext('2d'), paperCanvas.width, paperCanvas.height, from, to, text);
    paperTex.needsUpdate = true;
  }
  setNames(fromName, toName, paragraph);

  function open(callback) {
    if (state !== 'closed') return;
    state = 'flap';
    stateTime = 0;
    onOpened = callback;
  }

  function update(t, dt) {
    if (state === 'flap') {
      stateTime += dt;
      const k = Math.min(1, stateTime / FLAP_TIME);
      const e = k * k * (3 - 2 * k);
      flapPivot.rotation.x = e * Math.PI * 0.98;
      if (k >= 1) {
        state = 'paper';
        stateTime = 0;
      }
    } else if (state === 'paper') {
      stateTime += dt;
      const k = Math.min(1, stateTime / PAPER_TIME);
      const e = 1 - Math.pow(1 - k, 3);
      paper.position.set(0, h / 2 + (h + 0.15 - h / 2) * e, -0.02 + 0.42 * e);
      paper.rotation.x = -0.25 * e;
      if (k >= 1) {
        state = 'open';
        const cb = onOpened;
        onOpened = null;
        if (cb) cb();
      }
    } else {
      // Idle: the envelope floats very gently
      group.position.y = y + Math.sin(t * 1.2) * 0.03;
    }
    if (state === 'closed') glow.material.opacity = 0.45 + Math.sin(t * 1.8) * 0.12;
  }

  return {
    group,
    // objects that can be clicked to open the envelope
    hitTargets: [body, flap],
    get isOpen() {
      return state === 'open';
    },
    get isBusy() {
      return state === 'flap' || state === 'paper';
    },
    open,
    update,
    setNames,
    dispose() {
      paperTex.dispose();
      glowTex.dispose();
    },
  };
}
