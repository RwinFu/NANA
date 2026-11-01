import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

// The letter is drawn on a canvas, so the envelope needs a 2D context to exist. It is never read back.
function stubDocument() {
  const gradient = { addColorStop() {} };
  const ctx = new Proxy({}, {
    get: (target, key) => {
      if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => gradient;
      if (key === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
      if (key === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
      if (key === 'measureText') return () => ({ width: 10 });
      if (key in target) return target[key];
      return () => {};
    },
    set: (target, key, value) => { target[key] = value; return true; },
  });
  return { createElement: () => ({ width: 1, height: 1, getContext: () => ctx, toDataURL: () => 'data:,' }) };
}

const withCanvas = (fn) => {
  const previous = globalThis.document;
  globalThis.document = stubDocument();
  try {
    return fn();
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
};

async function openEnvelope() {
  const { createEnvelope, OPEN_TIME } = await import('../src/envelope.js');
  const env = withCanvas(() => createEnvelope(new THREE.Scene(), {
    fromName: 'من', toName: 'تو', paragraph: 'سلام', audio: {},
  }));
  // the scene's own updateMatrixWorld has to have run for world positions to mean anything
  env.group.parent.updateMatrixWorld(true);
  return { env, OPEN_TIME };
}

// Drive the opening forward by `seconds` of frame time (the envelope counts its own beats, so time is
// fed in as frame steps rather than as an absolute clock).
function run(env, seconds) {
  const step = 1 / 60;
  for (let t = 0; t < seconds; t += step) env.update(t, step);
  env.group.parent.updateMatrixWorld(true);
}

// Drive the opening to its end and return the sheet of paper as it ends up.
function finished(env, OPEN_TIME) {
  env.open(() => {});
  run(env, OPEN_TIME + 0.05);
  return env.group.getObjectByName('letter-paper');
}

// The paper's real corners: each panel is a plane, so its geometry's own corners in world space are
// what the frame has to hold. (The box around the paper is bigger than the paper, and its corners are
// not on the page, so a camera fitted to the box would look further away than it needs to.)
function paperCorners(paper) {
  const points = [];
  paper.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry.computeBoundingBox();
    const bb = o.geometry.boundingBox;
    for (const x of [bb.min.x, bb.max.x]) {
      for (const y of [bb.min.y, bb.max.y]) points.push(o.localToWorld(new THREE.Vector3(x, y, 0)));
    }
  });
  return points;
}

test('the camera the envelope offers actually frames the open letter', () => withCanvas(async () => {
  // One fixed distance cannot work: the page is 2.7 m wide, which is more than a portrait phone sees
  // at the distance that suits a laptop. This holds the offered camera to the frame at every shape a
  // window can be.
  const { env, OPEN_TIME } = await openEnvelope();
  const corners = paperCorners(finished(env, OPEN_TIME));
  for (const aspect of [0.46, 0.62, 0.75, 1.0, 1.33, 1.78, 2.2]) {
    const { from, look } = env.focus(aspect);
    const cam = new THREE.PerspectiveCamera(aspect < 0.8 ? 66 : 55, aspect, 0.1, 220);
    cam.position.copy(from);
    cam.lookAt(look);
    cam.updateMatrixWorld(true);
    cam.updateProjectionMatrix();
    let widest = 0;
    for (const corner of corners) {
      const p = corner.clone().project(cam);
      assert.ok(p.z > 0 && p.z < 1, `the letter is behind the camera at aspect ${aspect}`);
      widest = Math.max(widest, Math.abs(p.x), Math.abs(p.y));
      assert.ok(Math.abs(p.x) < 1, `the letter is cropped at the side at aspect ${aspect} (x ${p.x.toFixed(2)})`);
      assert.ok(Math.abs(p.y) < 1, `the letter is cropped top or bottom at aspect ${aspect} (y ${p.y.toFixed(2)})`);
    }
    assert.ok(widest > 0.55, `the camera stands so far back the letter is a stamp at aspect ${aspect}`);
  }
}));

test('the camera stands in front of the letter, not in the wall behind it', () => withCanvas(async () => {
  const { env } = await openEnvelope();
  const front = env.group.position.z;
  for (const aspect of [0.5, 1.78]) {
    const { from } = env.focus(aspect);
    assert.ok(from.z > front + 1.5, 'the camera must be out in the hall, in front of the letter');
    assert.ok(from.y > 1 && from.y < 4.5, 'and at eye height, not in the ceiling or the floor');
    assert.ok(Math.abs(from.x) < 2, 'and near the middle of the hall');
  }
}));

test('the seal is whole and the paper folded until the flap has lifted', () => withCanvas(async () => {
  const { env, OPEN_TIME } = await openEnvelope();
  const paper = env.group.getObjectByName('letter-paper');
  env.open(() => {});
  env.update(0, 1 / 60);
  assert.equal(paper.visible, false, 'the paper must not show before the envelope is open');

  // a moment in: the wax is only cracked, and still one piece
  run(env, 0.1);
  const seal = env.group.getObjectByName('wax-seal');
  assert.ok(seal.visible, 'the whole seal is still on the flap while it cracks');
  assert.equal(env.group.getObjectByName('wax-seal-top').visible, false, 'it has not split yet');

  // and once it has given, the two halves are what is on the envelope
  run(env, 0.5);
  assert.equal(seal.visible, false, 'the whole seal is gone once it breaks');
  assert.ok(env.group.getObjectByName('wax-seal-top').visible, 'the upper half rides the flap');
  assert.ok(env.group.getObjectByName('wax-seal-bottom').visible, 'the lower half stays on the paper');
  assert.equal(paper.visible, false, 'and the paper is still folded inside the envelope');

  // and by the end the paper is out
  run(env, OPEN_TIME);
  assert.equal(paper.visible, true);
  assert.ok(paper.position.y > 2, 'the letter ends up out of the envelope, not still inside it');
}));

test('the light inside the envelope comes up with the flap', () => withCanvas(async () => {
  const { env, OPEN_TIME } = await openEnvelope();
  let light = null;
  env.group.traverse((o) => { if (o.isPointLight && !light) light = o; });
  assert.ok(light, 'opening the letter has to light it');
  env.open(() => {});
  env.update(0, 1 / 60);
  const dark = light.intensity;
  run(env, OPEN_TIME);
  const lit = light.intensity;
  assert.ok(dark < 0.4, `the envelope starts dark: ${dark}`);
  assert.ok(lit > 4, `and ends lit: ${lit}`);
}));
