import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { createEnvelopeShell } from '../src/envelope-art.js';

// A wax seal breaks because the flap it holds down lifts away from the paper under it. That means the
// seal has to be two pieces in two different parents: the upper half rides with the flap, the lower
// half stays stuck to the body. It used to be one disc parented to the flap, which could only turn
// with it — a seal that never breaks, which is most of why opening the letter felt like a prop.

test('folds sit on the envelope, and the seal is split across the flap and the body', () => {
  const shell = createEnvelopeShell(3.4, 2.2, null, null);
  assert.equal(shell.body.name, 'envelope-body');
  assert.equal(shell.flap.parent, shell.flapPivot);

  const top = shell.group.getObjectByName('wax-seal-top');
  const bottom = shell.group.getObjectByName('wax-seal-bottom');
  assert.ok(top && bottom, 'the seal must be two halves');
  assert.equal(top.parent, shell.flapPivot, 'the upper half is carried by the flap');
  assert.equal(bottom.parent, shell.group, 'and the lower half stays on the envelope');

  // the two halves meet exactly on the cut line when the envelope is closed. (Their groups also hold
  // the ragged wax chips that cross the break, so measure the halves themselves.)
  shell.group.updateMatrixWorld(true);
  const halfBox = (group) => new THREE.Box3().setFromObject(group.children[0]);
  const tb = halfBox(top);
  const bb = halfBox(bottom);
  assert.ok(Math.abs(tb.min.y - bb.max.y) < 0.005, `the halves do not meet: gap ${(tb.min.y - bb.max.y).toFixed(3)}`);
  // and together they are one round seal, not two smaller ones
  assert.ok(Math.abs(tb.max.x - bb.max.x) < 0.02);
  assert.ok(Math.abs((tb.max.x - tb.min.x) - (bb.max.x - bb.min.x)) < 0.02);
  // the chips that make the break ragged cross the line, but only a little
  const whole = new THREE.Box3().setFromObject(bottom);
  assert.ok(whole.max.y - bb.max.y < 0.06, 'the broken edge should be ragged, not spilling over the seal');

  assert.ok(shell.group.getObjectByName('left-fold'));
  assert.ok(shell.group.getObjectByName('right-fold'));
  assert.ok(shell.group.getObjectByName('bottom-fold'));
  shell.dispose();
});

test('the upper half of the seal goes up when the flap is opened', () => {
  const shell = createEnvelopeShell(3.4, 2.2, null, null);
  const top = shell.group.getObjectByName('wax-seal-top');
  shell.group.updateMatrixWorld(true);
  const closed = top.getWorldPosition(new THREE.Vector3());
  shell.flapPivot.rotation.x = Math.PI * 0.98;
  shell.group.updateMatrixWorld(true);
  const opened = top.getWorldPosition(new THREE.Vector3());
  assert.ok(opened.y > closed.y + 1, 'the wax has to travel with the flap, or it is not sealing anything');
  const sealed = shell.group.getObjectByName('wax-seal-bottom').getWorldPosition(new THREE.Vector3());
  assert.ok(Math.abs(sealed.y - closed.y) < 0.4, 'the lower half must stay where the paper is');
  shell.dispose();
});

test('setBreak opens the cracks first and then parts the halves', () => {
  const shell = createEnvelopeShell(3.4, 2.2, null, null);
  shell.group.updateMatrixWorld(true);
  const topY = () => shell.group.getObjectByName('wax-seal-top').position.y;
  const whole = topY();
  const crackOpacity = () => shell.cracks[0].material.opacity;

  shell.setBreak(0);
  assert.equal(crackOpacity(), 0, 'a whole seal shows no cracks');

  shell.setBreak(0.15); // cracked, not yet apart
  assert.ok(crackOpacity() > 0.4, 'the cracks must show as it gives');
  assert.ok(Math.abs(topY() - whole) < 0.004, 'the halves do not move until the cracks are open');
  assert.equal(shell.sealWhole.visible, true, 'the whole seal is still on the flap while it cracks');
  assert.equal(shell.sealTop.visible, false, 'the halves are not shown until it breaks');

  shell.setBreak(0.6); // past the break
  assert.equal(shell.sealWhole.visible, false, 'the whole plate is swapped for the two halves');
  assert.equal(shell.sealTop.visible, true);

  shell.setBreak(1);
  assert.ok(crackOpacity() === 0 || shell.cracks[0].visible === false, 'the cracks are gone once it has broken');
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
