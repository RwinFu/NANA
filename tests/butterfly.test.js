import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createFairy } from '../src/fairy.js';

test('butterfly carries the readable letter on attached threads throughout the flight', () => {
  const text = [];
  const gradient = { addColorStop() {} };
  const ctx = new Proxy({}, { get: (_, key) => {
    if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => gradient;
    if (key === 'fillText') return (value) => text.push(value);
    return () => {};
  }, set: () => true });
  const previous = globalThis.document;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
  try {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1.7, 0.1, 100);
    camera.position.set(2, 5, 10);
    camera.lookAt(0, 4, 4);
    camera.updateMatrixWorld();
    const messenger = createFairy(scene);
    const cords = scene.getObjectByName('letter-threads');
    assert.ok(messenger.group.getObjectByName('butterfly'));
    const thorax = messenger.group.getObjectByName('butterfly-thorax');
    const abdomen = messenger.group.getObjectByName('butterfly-abdomen');
    const head = messenger.group.getObjectByName('butterfly-head');
    assert.ok(thorax && abdomen && head);
    assert.ok(thorax.scale.x < 0.05 && thorax.scale.y > thorax.scale.x);
    assert.ok(head.geometry.parameters.radius < 0.04);
    for (const pair of ['upper-wing', 'lower-wing']) {
      const left = messenger.group.getObjectByName(`${pair}-left`);
      const right = messenger.group.getObjectByName(`${pair}-right`);
      assert.ok(left && right);
      assert.equal(left.material, right.material);
      const lp = left.geometry.attributes.position, rp = right.geometry.attributes.position;
      const lu = left.geometry.attributes.uv, ru = right.geometry.attributes.uv;
      assert.equal(lp.count, rp.count);
      for (let i = 0; i < lp.count; i++) {
        assert.ok(Math.abs(lp.getX(i) + rp.getX(i)) < 1e-6);
        assert.ok(Math.abs(lu.getX(i) - ru.getX(i)) < 1e-6, 'markings mirror around the body');
        assert.ok(Math.abs(lu.getY(i) - ru.getY(i)) < 1e-6);
      }
    }
    assert.ok(text.includes('سالگردمون مبارک'));
    assert.ok(text.includes('خوشگلترین پرنسس دنیا'));
    for (let i = 1; i <= 180; i++) {
      const t = i / 60;
      messenger.update(t, 1 / 60, Math.min(1, t / 2), false, camera);
      if (i < 10) continue;
      assert.equal(messenger.letter.visible, true);
      assert.equal(cords.visible, true);
      const scale = messenger.group.scale.x;
      const start = new THREE.Vector3().fromBufferAttribute(cords.geometry.attributes.position, 0);
      assert.ok(start.distanceTo(messenger.group.position) < 0.1 * scale + 1e-6);
      const end = new THREE.Vector3().fromBufferAttribute(cords.geometry.attributes.position, 11);
      const local = end.clone().sub(messenger.letter.position).applyQuaternion(camera.quaternion.clone().invert()).divideScalar(scale);
      assert.ok(Math.abs(local.x + 0.29) < 1e-4);
      assert.ok(Math.abs(local.y - 0.355) < 1e-4);
    }
    for (let i = 0; i < 240; i++) messenger.update(3 + i / 60, 1 / 60, 1, true, camera);
    assert.equal(messenger.letter.visible, false);
    assert.equal(cords.visible, false);
  } finally {
    globalThis.document = previous;
  }
});
