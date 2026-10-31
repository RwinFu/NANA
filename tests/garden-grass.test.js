import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { grassAllowed, grassColourAt, grassLayout, grassPressure, createGardenGrass } from '../src/garden-grass.js';

test('grass placement is deterministic and leaves the path, fountain and bench clear', () => {
  const data = grassLayout();
  assert.equal(data.length, 1000);
  assert.deepEqual(data, grassLayout());
  assert.ok(data.every((p) => grassAllowed(p.x, p.z)));
  assert.equal(grassAllowed(0, 19), false);
  assert.equal(grassAllowed(-14, 8), false);
  assert.equal(grassAllowed(-14, 11.4), false);
  assert.ok(data.some((p) => Math.abs(p.x) < 3));
  assert.ok(data.some((p) => Math.abs(p.x) > 10));
});

test('colour texture is periodic and the bend is local, bounded and ignores airborne actors', () => {
  for (const y of [0, 37, 128, 255]) assert.deepEqual(grassColourAt(0, y), grassColourAt(256, y));
  assert.deepEqual(grassColourAt(20, 0), grassColourAt(20, 256));
  assert.deepEqual(grassPressure(0, 0, [{ x: 3, z: 0 }]), { x: 0, z: 0 });
  assert.deepEqual(grassPressure(0, 0, [{ x: 0, z: 0, y: 2 }]), { x: 0, z: 0 });
  const bend = grassPressure(0.3, 0, [{ x: 0, z: 0 }, { x: 0, z: 0 }]);
  assert.ok(bend.x > 0 && bend.x <= 0.38 && bend.z === 0);
});

test('instanced grass reacts to a nearby actor and releases again without moving its roots', () => {
  const previous = globalThis.document;
  const gradient = { addColorStop() {} };
  const ctx = new Proxy({}, { get: (_, key) => {
    if (key === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
    if (key === 'createRadialGradient') return () => gradient;
    return () => {};
  }, set: () => true });
  globalThis.document = { createElement: () => ({ getContext: () => ctx }) };
  try {
    const scene = new THREE.Scene(), material = new THREE.MeshStandardMaterial();
    const grass = createGardenGrass(scene, material);
    const mesh = scene.getObjectByName('garden-grass');
    assert.equal(mesh.count, 1000);
    assert.ok(scene.getObjectByName('garden-wildflowers-white'));
    assert.ok(scene.getObjectByName('garden-wildflowers-pink'));
    const point = grassLayout()[0];
    const matrix = new THREE.Matrix4();
    grass.update(2, 0.05, []); mesh.getMatrixAt(0, matrix);
    const initial = matrix.clone();
    for (let i = 0; i < 30; i++) grass.update(2, 0.05, [{ x: point.x - 0.1, z: point.z }]);
    mesh.getMatrixAt(0, matrix);
    assert.notDeepEqual(matrix.elements, initial.elements);
    assert.ok(Math.abs(matrix.elements[12] - point.x) < 1e-5);
    assert.ok(Math.abs(matrix.elements[14] - point.z) < 1e-5);
    for (let i = 0; i < 60; i++) grass.update(2, 0.05, []);
    mesh.getMatrixAt(0, matrix);
    assert.ok(Math.abs(matrix.elements[1] - initial.elements[1]) < 0.002);
    grass.dispose();
    assert.equal(scene.getObjectByName('garden-grass'), undefined);
  } finally {
    globalThis.document = previous;
  }
});
