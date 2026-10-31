import test from 'node:test';
import assert from 'node:assert/strict';
import { CAT_APPEARANCE, catEarPose } from '../src/cat-appearance.js';
import { buildCat, animateCat, CAT_SPECS } from '../src/cat-model.js';

test('Ani has a rounder brown-tabby look, Pastil keeps her collar and upright ears', () => {
  const { ani, pastil } = CAT_APPEARANCE;
  assert.equal(ani.folded, true);
  assert.equal(pastil.folded, false);
  assert.equal(ani.collar, false);
  assert.equal(pastil.collar, true);
  assert.ok(ani.headWidth > pastil.headWidth);
  assert.notEqual(ani.base, pastil.base);
  for (const side of [-1, 1]) {
    for (const attentive of [false, true]) {
      for (const twitch of [-0.12, 0, 0.12]) {
        assert.ok(catEarPose(ani, side, twitch, attentive).x > 0.4, 'fold is retained while animating');
        assert.ok(catEarPose(ani, side, twitch, attentive).x < 0.8, 'fold is not flattened');
        assert.ok(Math.abs(catEarPose(pastil, side, twitch, attentive).x) < 0.2);
      }
    }
  }
});

test('3D cats keep their ear shape in the animated welcome and only Pastil has a collar', () => {
  // Texture drawing is mocked; the actual Three.js scene graph and animation run.
  const data = new Uint8ClampedArray(256 * 256 * 4);
  const ctx = new Proxy({}, { get: (_, key) => key === 'getImageData' || key === 'createImageData' ? () => ({ data }) : () => {}, set: () => true });
  const oldDocument = globalThis.document;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
  try {
    const pastilModel = buildCat('pastil');
    const aniModel = buildCat('ani');
    const pastil = pastilModel.root;
    const ani = aniModel.root;
    assert.ok(pastil.getObjectByName('collar'));
    assert.equal(ani.getObjectByName('collar'), undefined);
    for (const ear of ['ear-left', 'ear-right']) {
      assert.ok(ani.getObjectByName(ear).rotation.x > 0.4);
      assert.ok(pastil.getObjectByName(ear).rotation.x < 0);
    }
    animateCat({ ...pastilModel, gait: CAT_SPECS.pastil, attentive: true }, 0.016, 2, 0, 0);
    animateCat({ ...aniModel, gait: CAT_SPECS.ani, attentive: true }, 0.016, 2, 0, 1);
    for (const ear of ['ear-left', 'ear-right']) {
      assert.ok(ani.getObjectByName(ear).rotation.x > 0.4);
      assert.ok(pastil.getObjectByName(ear).rotation.x < 0.1);
    }
  } finally {
    globalThis.document = oldDocument;
  }
});
