import * as THREE from 'three';
import { LAYOUT, wrapText } from './world.js';
import { envelopeNormal } from './architecture.js';
import { createEnvelopeShell } from './envelope-art.js';
import { BEATS as OPEN_BEATS, BEAT_AT, OPEN_TIME as TIMELINE_TIME, openingAtTime } from './letter-open.js';

// The letter at the end of the hall, and the moment of opening it.
//
// It used to be two seconds: the flap turned up, a flat sheet of paper rose out of the envelope, and a
// text dialog fell over the screen. Nothing broke, nothing lit, and the camera never moved, so the one
// scripted moment in the house read like a prop being lifted rather than a letter being opened.
//
// The opening is now a short piece of choreography in five beats, and each beat has a sound:
//
//   0.00  the wax gives: cracks open across the seal, the two halves rock apart   (a crackle, a snap)
//   0.55  the flap lifts and the warm light inside the envelope comes up with it
//   1.35  the folded paper rises out of the envelope, unfolding as it clears the lip (paper, softly)
//   2.15  the letter is out and held in the light; the camera is already close on it
//   2.60  onOpened fires, and the reader opens over the same space the paper occupies
//
// The camera is offered a place to go (`focus()`), which main.js eases the real camera toward while
// the opening runs; the envelope never touches the camera itself.

const FONT = '"Vazirmatn Variable", Vazirmatn, sans-serif';
const PAPER_W = 2.7;
const PAPER_H = 1.9;

// The beats live in letter-open.js, so the timing can be tested without a clock. Re-exported here
// because this is where they are used.
export const BEATS = OPEN_BEATS;
export const OPEN_TIME = TIMELINE_TIME;

function drawPaper(ctx, w, h, fromName, toName, paragraph) {
  // The same paper, ink and border as the reader in style.css (dialog.letter-sheet), so the 3D sheet
  // and the page that takes over from it are one material. If one of these colours changes, the other
  // has to change with it — tests/envelope.test.js compares them.
  ctx.fillStyle = '#fff6ea';
  ctx.fillRect(0, 0, w, h);
  // the reader's paper is a wash of two creams, not a flat fill
  const wash = ctx.createLinearGradient(0, 0, w, h);
  wash.addColorStop(0, 'rgba(255,255,255,0.55)');
  wash.addColorStop(1, 'rgba(243,229,210,0.55)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#e6b86f';
  ctx.lineWidth = 6;
  ctx.strokeRect(26, 26, w - 52, h - 52);
  ctx.strokeStyle = 'rgba(150,104,87,0.22)';
  ctx.lineWidth = 2;
  ctx.strokeRect(44, 44, w - 88, h - 88);
  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#9c5b60';
  ctx.font = `700 26px ${FONT}`;
  ctx.fillText('نامه‌ای برای تو', w / 2, 92);

  ctx.fillStyle = '#553542';
  ctx.font = `900 58px ${FONT}`;
  ctx.fillText(`برای ${toName}`, w / 2, 150);

  ctx.fillStyle = '#9c5b60';
  ctx.font = `500 30px ${FONT}`;
  ctx.fillText(`نامه‌ای از طرف ${fromName}`, w / 2, 208);

  ctx.strokeStyle = 'rgba(150,104,87,0.2)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(120, 244);
  ctx.lineTo(w - 120, 244);
  ctx.stroke();

  ctx.fillStyle = '#70545a';
  ctx.font = `500 34px ${FONT}`;
  const lines = wrapText(ctx, paragraph, w - 280, 4);
  lines.forEach((line, i) => ctx.fillText(line, w / 2, 306 + i * 62));
}

export function createEnvelope(scene, { fromName, toName, paragraph, audio = null, onBeat = null }) {
  const { x, y, z, w, h } = LAYOUT.envelope;
  const group = new THREE.Group();
  group.position.set(x, y, z);
  scene.add(group);

  const shell = createEnvelopeShell(w, h, envelopeNormal(8, 5), envelopeNormal(2.4, 2.4));
  group.add(shell.group);
  const { body, flap, flapPivot } = shell;

  // ---- the paper, in three folds -------------------------------------------------------------
  // One flat plane rising out of an envelope is a card, not a letter. The letter carries two fold
  // lines across it, so it can come out folded and open as it clears the lip. When it is settled it is
  // flat and the camera is close enough that the folds only show as a soft crease in the light.
  const paperCanvas = document.createElement('canvas');
  paperCanvas.width = 1024;
  paperCanvas.height = 720;
  const paperTex = new THREE.CanvasTexture(paperCanvas);
  paperTex.colorSpace = THREE.SRGBColorSpace;
  const paperMat = new THREE.MeshStandardMaterial({ map: paperTex, roughness: 0.92, side: THREE.DoubleSide });

  // three panels, hinged on the fold lines, chained so one move carries all of them
  const paperRoot = new THREE.Group();
  paperRoot.name = 'letter-paper';
  group.add(paperRoot);
  const panelH = PAPER_H / 3;
  const folds = [];
  let parent = paperRoot;
  for (let i = 0; i < 3; i += 1) {
    const hinge = new THREE.Group();
    // the first panel hangs from the paper's top edge; each later one from the fold above it
    hinge.position.y = i === 0 ? 0 : -panelH;
    parent.add(hinge);
    const geo = new THREE.PlaneGeometry(PAPER_W, panelH + 0.004);
    // each panel shows its own third of the drawn page
    const uv = geo.attributes.uv;
    for (let v = 0; v < uv.count; v += 1) uv.setY(v, (uv.getY(v) + (2 - i)) / 3);
    uv.needsUpdate = true;
    const mesh = new THREE.Mesh(geo, paperMat);
    mesh.position.y = -panelH / 2;
    hinge.add(mesh);
    folds.push(hinge);
    parent = hinge;
  }
  paperRoot.position.set(0, h / 2, -0.02);
  paperRoot.visible = false;

  // soft warm glow behind the envelope
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = 256;
  glowCanvas.height = 256;
  const gctx = glowCanvas.getContext('2d');
  const grad = gctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(239,188,189,0.65)');
  grad.addColorStop(1, 'rgba(239,188,189,0)');
  gctx.fillStyle = grad;
  gctx.fillRect(0, 0, 256, 256);
  const glowTex = new THREE.CanvasTexture(glowCanvas);
  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })
  );
  glow.scale.set(w + 2.6, h + 2.2, 1);
  glow.position.set(0, h / 2, -0.3);
  group.add(glow);

  // ---- the light inside the envelope ---------------------------------------------------------
  // The flap coming up reveals a lit interior; a point light at the mouth, warm and short-range, is
  // what makes the paper read as *coming out of* something rather than sliding up the front.
  const innerLight = new THREE.PointLight('#ffcf9a', 0, 5.2, 2);
  innerLight.position.set(0, h + 0.1, 0.45);
  group.add(innerLight);
  let lightLevel = 0;

  // and a little dust in that light, drifting out over the mouth while it is open
  const dustCount = 26;
  const dustGeo = new THREE.BufferGeometry();
  const dustPos = new Float32Array(dustCount * 3);
  const dustSeed = [];
  for (let i = 0; i < dustCount; i += 1) {
    dustSeed.push({ a: Math.random() * Math.PI * 2, r: 0.15 + Math.random() * 0.75, up: Math.random(), sp: 0.25 + Math.random() * 0.5 });
    dustPos[i * 3 + 1] = -10; // parked below, off screen, until the envelope opens
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({ color: '#ffe6b8', size: 0.035, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.frustumCulled = false;
  group.add(dust);

  let state = 'closed'; // closed -> opening -> open
  let stateTime = 0;
  let onOpened = null;
  let announced = new Set();

  function say(beat, fn) {
    if (announced.has(beat)) return;
    announced.add(beat);
    if (fn) fn();
    if (onBeat) onBeat(beat);
  }

  function setNames(from, to, text) {
    drawPaper(paperCanvas.getContext('2d'), paperCanvas.width, paperCanvas.height, from, to, text);
    paperTex.needsUpdate = true;
  }
  setNames(fromName, toName, paragraph);

  function open(callback) {
    if (state !== 'closed') return;
    state = 'opening';
    stateTime = 0;
    announced = new Set();
    onOpened = callback;
  }

  // Where the camera should be to watch this. The letter sits at the end of the hall, so there is room
  // to stand back: far enough that the whole sheet of paper is in frame with a little air around it
  // when it opens, close enough that the wax seal still reads.
  //
  // The distance is fitted to the frame rather than fixed. A page 2.7 m wide is wider than a phone
  // held upright sees: at the distance that frames it on a laptop, a portrait phone crops a third of
  // it off each side, and on a laptop the page's own height overflows. So the camera backs off by
  // exactly as much as the frame in front of it needs, measured by projecting the open page. (The
  // envelope is at an angle to the camera, so this is not simple arithmetic — a test projects the page
  // through a camera standing here and holds the result inside the frame at every size.)
  const focusPoint = new THREE.Vector3(x, y + h * 0.62, z + 0.05);
  const watchDirection = new THREE.Vector3(0.22, 0.1, 1).normalize(); // a little to the right, a little above

  // The page, flat and out of the envelope: the corners the camera has to frame. These are the numbers
  // setPhase() drives the paper to at the end of the opening (its root sits at the mouth, tilted back
  // by 0.22 rad, with the three panels hanging below it), so the camera is fitted to where the letter
  // really ends up rather than to a guess.
  const PAGE_TILT = -0.22;
  function pageCorners() {
    const cos = Math.cos(PAGE_TILT);
    const sin = Math.sin(PAGE_TILT);
    const baseY = y + h + 0.05;
    const baseZ = z + 0.32;
    const pts = [];
    for (const sx of [-1, 1]) {
      for (const py of [0, -PAPER_H]) {
        pts.push(new THREE.Vector3(x + (sx * PAPER_W) / 2, baseY + py * cos, baseZ + py * sin));
      }
    }
    return pts;
  }
  const pagePts = pageCorners();
  const fitCam = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 220);
  function framed(aspect, distance) {
    fitCam.fov = aspect < 0.8 ? 66 : 55; // main.js widens the camera on portrait phones
    fitCam.aspect = Math.max(0.3, aspect);
    fitCam.position.copy(focusPoint).addScaledVector(watchDirection, distance);
    fitCam.lookAt(focusPoint);
    fitCam.updateMatrixWorld(true);
    fitCam.updateProjectionMatrix();
    for (const p of pagePts) {
      const v = p.clone().project(fitCam);
      if (Math.abs(v.x) > 0.94 || Math.abs(v.y) > 0.94) return false;
    }
    return true;
  }
  // The nearest distance from which the whole page is in frame: bisection, because the page is tilted
  // and at an angle, so the answer is not simple arithmetic.
  function watchDistance(aspect) {
    let lo = 2.0;
    let hi = 12;
    for (let i = 0; i < 24; i += 1) {
      const mid = (lo + hi) / 2;
      if (framed(aspect, mid)) hi = mid; else lo = mid;
    }
    return Math.min(7.5, Math.max(2.4, hi));
  }
  function watchPointAt(aspect = 16 / 9) {
    return focusPoint.clone().addScaledVector(watchDirection, watchDistance(aspect));
  }

  // aspect is width / height; main.js passes the window's, so the camera stands where the frame needs it
  function focus(aspect = 16 / 9) {
    return { look: focusPoint.clone(), from: watchPointAt(aspect) };
  }

  // The clock, for the slow breathing of the light. It is a plain variable rather than a call to
  // performance.now(), so the same frame always renders the same thing and the tests can drive it.
  let now = 0;

  // The whole opening, driven by the shared timeline: one number in, every part of the scene out.
  function setPhase(k) {
    const p = openingAtTime(Math.min(1, Math.max(0, k)) * OPEN_TIME);

    // 0..0.29 cracks the plate without splitting it; 0.3..1 is the two halves parting, so the halves
    // are never shown before the wax has actually given
    // once the paper is lifting out, the wax is off the envelope (the flap took the upper half with it)
    shell.setBreak(p.wax * 0.29 + p.split * 0.71, p.rise > 0.02);
    flapPivot.rotation.x = p.flap * Math.PI * 0.98;

    // the light: up as the flap clears, then a slow breath while the letter is read
    lightLevel = p.light;
    innerLight.intensity = lightLevel * 9 * (0.92 + 0.08 * Math.sin(now * 4));

    // the paper: out of the mouth of the envelope, then unfolding as it clears it
    paperRoot.visible = p.paper > 0;
    paperRoot.position.set(0, h / 2 + (h + 0.05 - h / 2) * p.rise, -0.02 + 0.34 * p.rise);
    paperRoot.rotation.x = -0.22 * p.rise;
    // folded shut inside the envelope, flat once it is out
    folds[0].rotation.x = (1 - p.unfold) * -1.55;
    folds[1].rotation.x = (1 - p.unfold) * -1.1;
    folds[2].rotation.x = (1 - p.unfold) * -0.6;

    dustMat.opacity = lightLevel * 0.55;
    glow.material.opacity = 0.26 + lightLevel * 0.24;
    return p;
  }

  function update(t, dt) {
    now = t;
    if (state === 'opening') {
      stateTime += dt;
      const k = Math.min(1, stateTime / OPEN_TIME);
      const phase = setPhase(k);

      // the beats, each with its own sound and a moment to breathe
      if (stateTime >= BEAT_AT.crack + 0.02) say('crack', () => audio?.waxCrack?.());
      if (stateTime >= BEAT_AT.break) say('break', () => audio?.waxSnap?.());
      if (stateTime >= BEAT_AT.flap) say('flap', () => audio?.flap?.());
      if (stateTime >= BEAT_AT.paper) say('paper', () => audio?.paper?.());

      // dust drifts up out of the envelope while the light is on
      if (lightLevel > 0.02) {
        const pos = dustGeo.attributes.position;
        for (let i = 0; i < dustCount; i += 1) {
          const s = dustSeed[i];
          s.up += dt * s.sp * 0.5;
          if (s.up > 1) s.up -= 1;
          const spread = 0.3 + s.up * 0.9;
          pos.setXYZ(i, Math.cos(s.a + t * 0.4) * s.r * spread, h + 0.05 + s.up * 1.1, 0.2 + Math.sin(s.a + t * 0.3) * s.r * spread);
        }
        pos.needsUpdate = true;
      }

      if (k >= 1) {
        state = 'open';
        const cb = onOpened;
        onOpened = null;
        if (cb) cb();
      }
    } else if (state === 'open') {
      // Held open: the light keeps a slow breath so the letter does not look frozen behind the reader.
      innerLight.intensity = lightLevel * 9 * (0.9 + 0.1 * Math.sin(t * 1.7));
      dustMat.opacity = lightLevel * 0.4;
      if (lightLevel > 0.02) {
        const pos = dustGeo.attributes.position;
        for (let i = 0; i < dustCount; i += 1) {
          const s = dustSeed[i];
          s.up += dt * s.sp * 0.35;
          if (s.up > 1) s.up -= 1;
          pos.setXYZ(i, Math.cos(s.a + t * 0.4) * s.r * (0.5 + s.up * 0.8), h + 0.05 + s.up * 1.3, 0.25 + Math.sin(s.a + t * 0.3) * s.r * 0.9);
        }
        pos.needsUpdate = true;
      }
      group.position.y = y + Math.sin(t * 1.2) * 0.02;
    } else {
      // Idle: the envelope floats very gently
      group.position.y = y + Math.sin(t * 1.2) * 0.03;
      glow.material.opacity = 0.26 + Math.sin(t * 1.8) * 0.04;
    }
  }

  return {
    group,
    // objects that can be clicked to open the envelope
    hitTargets: [body, flap],
    get isOpen() {
      return state === 'open';
    },
    get isBusy() {
      return state === 'opening';
    },
    open,
    update,
    setNames,
    setPhase,
    focus,
    dispose() {
      shell.dispose();
      folds.forEach((hinge) => hinge.children.forEach((mesh) => mesh.geometry.dispose()));
      paperMat.dispose();
      glow.material.dispose();
      paperTex.dispose();
      glowTex.dispose();
      dustGeo.dispose();
      dustMat.dispose();
    },
  };
}
