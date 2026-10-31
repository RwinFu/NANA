import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createEnvelopeShell } from '../src/envelope-art.js';

test('folds sit on the envelope, and the seal moves with the flap', () => {
  const shell = createEnvelopeShell(3.4, 2.2, null, null);
  assert.equal(shell.body.name, 'envelope-body');
  assert.equal(shell.flap.parent, shell.flapPivot);
  const seal = shell.group.getObjectByName('wax-seal');
  assert.equal(seal.parent, shell.flapPivot);
  assert.ok(shell.group.getObjectByName('left-fold'));
  assert.ok(shell.group.getObjectByName('right-fold'));
  assert.ok(shell.group.getObjectByName('bottom-fold'));
  shell.group.updateMatrixWorld(true);
  const closed = seal.getWorldPosition(new THREE.Vector3());
  shell.flapPivot.rotation.x = Math.PI * 0.98;
  shell.group.updateMatrixWorld(true);
  const opened = seal.getWorldPosition(new THREE.Vector3());
  assert.ok(opened.y > closed.y + 1);
  const raycaster = new THREE.Raycaster(new THREE.Vector3(0, 1, 4), new THREE.Vector3(0, 0, -1));
  assert.ok(raycaster.intersectObject(shell.body, false).length, 'body remains clickable');
  shell.dispose();
});

test('anniversary letter wording stays unchanged apart from the ring emoji', () => {
  const source = readFileSync(new URL('../src/memories.js', import.meta.url), 'utf8');
  const match = source.match(/export const letterParagraphs = \[([\s\S]*?)\];/);
  assert.ok(match);
  assert.equal(match[1].includes('💍'), false);
  const lines = [...match[1].matchAll(/'([^']*)'/g)].map((m) => m[1]);
  assert.deepEqual(lines, [
    'سلام مهربون‌ترین دختر دنیا،',
    'درست یک سال پیش، تو وارد زندگیم شدی و از همون روز اول، همه‌چیز رنگ و بوی دیگه‌ای گرفت. تک‌تک این ۱۲ قابی که توی این خونه می‌بینی، گوشه‌ای از زیباترین لحظه‌هایی هستن که با هم ساختیم.',
    'از خنده‌هامون توی ماشین و قرارهای دونفره‌مون گرفته تا آرامشِ بودنت کنارم، همه‌شون باارزش‌ترین گنجینه‌ی زندگی منن.',
    'اولین سالگردمون و ولنتاین مبارک عشقم؛ قول میدم هر روز بیشتر از دیروز دوستت داشته باشم و کنارت باشم. ❤️',
  ]);
});
