import test from 'node:test';
import assert from 'node:assert/strict';
import { ledgeX, helpAfterLoss, ROCK_WARNING, VICTORY_GATE_CUE, VICTORY_EXIT, PORTAL_ZOOM_START, PORTAL_ZOOM_DURATION, portalZoom, portalCamera, portalCharacterOpacity } from '../src/rescue-timing.js';

// Minimal DOM/canvas harness: exercises the real simulation and UI handlers,
// not browser layout or rendered appearance.
function environment() {
  const noop = () => {};
  const gradient = { addColorStop: noop };
  const ctx = new Proxy({}, { get: (_, key) => key === 'measureText' ? (s) => ({ width: s.length * 10 }) : key.startsWith('create') ? () => gradient : noop, set: () => true });
  const elements = new Map();
  const listeners = {};
  const element = () => ({ hidden: false, classList: { add: noop }, setAttribute: noop, addEventListener: noop, removeEventListener: noop, remove: noop });
  const root = { ...element(), querySelector(selector) {
    if (!elements.has(selector)) elements.set(selector, selector === '.rescue-canvas' ? { ...element(), getContext: () => ctx } : element());
    return elements.get(selector);
  }, addEventListener(type, fn) { listeners[type] = fn; } };
  globalThis.document = { createElement: () => root, body: { appendChild: noop }, addEventListener: noop, removeEventListener: noop, hidden: false };
  globalThis.window = { innerWidth: 960, innerHeight: 540, devicePixelRatio: 1, matchMedia: () => ({ matches: false }), addEventListener: noop, removeEventListener: noop, setTimeout: noop };
  globalThis.Image = class { set src(v) {} };
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = noop;
  return { elements, click(action) { listeners.click({ target: { closest: () => ({ dataset: { action } }) } }); } };
}

const env = environment();
const { createRescueGame } = await import('../src/rescue.js');

test('doorway zoom starts after the entrance and eases smoothly to full size', () => {
  assert.equal(portalZoom(0), 1);
  assert.equal(portalZoom(PORTAL_ZOOM_START), 1);
  assert.ok(portalZoom(PORTAL_ZOOM_START + PORTAL_ZOOM_DURATION / 2) > 1);
  assert.equal(portalZoom(VICTORY_EXIT), 25);
  assert.equal(portalZoom(VICTORY_EXIT + 1), 25);
  assert.equal(portalCharacterOpacity(4146, 4150), 1);
  assert.ok(portalCharacterOpacity(4164, 4150) > 0 && portalCharacterOpacity(4164, 4150) < 1);
  assert.equal(portalCharacterOpacity(4182, 4150), 0);
});

test('victory camera centres the doorway and the final view fits inside its sky', () => {
  const start = portalCamera(PORTAL_ZOOM_START, 4150, 3340, 960, 540);
  assert.deepEqual([start.x, start.y, start.targetX, start.targetY, start.zoom, start.hudOpacity], [870, 307, 870, 307, 1, 1]);
  const mid = portalCamera(PORTAL_ZOOM_START + PORTAL_ZOOM_DURATION / 2, 4150, 3340, 960, 540);
  assert.ok(mid.targetX < start.targetX && mid.targetX > 480);
  assert.ok(mid.zoom > 1 && mid.zoom < 25);
  const end = portalCamera(VICTORY_EXIT, 4150, 3340, 960, 540);
  assert.deepEqual([end.targetX, end.targetY, end.zoom, end.hudOpacity], [480, 270, 25, 0]);
  // Inverse-transform all viewport corners to the door's local coordinates.
  for (const x of [0, 960]) for (const y of [0, 540]) {
    const doorX = 60 + (x - end.targetX) / end.zoom;
    const doorY = 307 + (y - end.targetY) / end.zoom;
    assert.ok(doorX > 14 && doorX < 106 && doorY > 230 && doorY < 430);
  }
});

test('platform movement is slow, bounded and deterministic', () => {
  const ledge = { x: 2620, sway: 32, speed: 0.65 };
  assert.equal(ledgeX(ledge, 0), 2620);
  for (let t = 0; t < 100; t += 0.1) assert.ok(Math.abs(ledgeX(ledge, t) - 2620) <= 32);
  assert.equal(ledgeX({ x: 20 }, 10), 20);
});

test('moving platform carries a standing player and keeps its collision aligned', () => {
  const game = createRescueGame({ autoStart: true });
  const g = game.state();
  game.setPlayer({ x: 2700, y: 340, vx: 0, vy: 0, onGround: true });
  const before = g.p.x;
  game.step(0.033, 20);
  assert.ok(g.p.x > before);
  assert.equal(g.p.y, 340);
  assert.equal(g.p.onGround, true);
});

test('rescues, abilities, dragon and win cue preserve their ordering', () => {
  let cues = 0;
  const game = createRescueGame({ autoStart: true, onGate: () => cues++ });
  const g = game.state();
  game.setPlayer({ x: 790, y: 150, onGround: false }); game.step();
  assert.equal(g.cats.ani.freed, true);
  assert.equal(g.abilities.rapid, true);
  game.press('fire'); game.step(0.033, 20); game.release('fire');
  assert.ok(g.sparks.length >= 2, 'holding fire produces multiple sparks');
  g.dragon.active = true; g.dragon.hp = 1;
  g.sparks.push({ x: g.dragon.x, y: g.dragon.y, vx: 0, vy: 0, life: 1 }); game.step();
  assert.equal(g.dragon.state, 'fled');
  game.setPlayer({ x: 1985, y: 430, onGround: true }); game.step();
  assert.equal(g.abilities.doubleJump, true);
  game.setPlayer({ x: 2180, y: 150, onGround: true }); game.step();
  assert.equal(g.rescued, true);
  game.setPlayer({ x: 4150, y: 430, vx: 0, vy: 0, onGround: true }); game.step();
  assert.equal(g.phase, 'won');
  assert.equal(cues, 0);
  game.step(0.1, Math.floor((VICTORY_GATE_CUE - 0.1) / 0.1));
  assert.equal(cues, 0);
  game.step(0.1, 3);
  assert.equal(cues, 1);
  assert.equal(g.glitch, 0); // no abrupt broken-signal effect during the entrance
  game.step(0.1, 10);
  // The last cat's tail has crossed the doorway before the night transition.
  assert.ok(g.cats.pastil.x - 26 > 4150 + 14);
  game.step(0.1, Math.ceil(VICTORY_EXIT / 0.1));
  assert.equal(cues, 1);
});

test('retry retains progress at checkpoint and offers skip after repeated losses', () => {
  let cues = 0;
  const game = createRescueGame({ autoStart: true, onGate: () => cues++ });
  const g = game.state();
  g.checkpoint = 2000; g.abilities.rapid = true; g.cats.ani.freed = true; g.dragon.hp = 2;
  for (let i = 0; i < 2; i++) {
    g.hearts = 1;
    game.setPlayer({ x: 3400, y: 630, vx: 0, vy: 1, onGround: false }); game.step();
    assert.equal(g.phase, 'lost');
    assert.equal(env.elements.get('.rescue-retry-skip').hidden, i === 0);
    if (i === 0) {
      env.click('retry');
      assert.equal(g.phase, 'play'); assert.equal(g.p.x, 2000);
      assert.equal(g.abilities.rapid, true); assert.equal(g.dragon.hp, 2);
      assert.equal(g.hearts, 3); assert.equal(g.fire.length, 0); assert.equal(g.rocks.length, 0);
    }
  }
  env.click('skip');
  assert.equal(cues, 0);
  assert.match(helpAfterLoss(2, 2000), /اژدها/);
});

test('falling rocks warn before moving', () => {
  const game = createRescueGame({ autoStart: true });
  const g = game.state();
  g.rescued = true; g.rockT = 0;
  game.step(0.033);
  assert.ok(g.rocks[0].warning > 0);
  const y = g.rocks[0].y;
  game.step(ROCK_WARNING / 3, 2);
  assert.equal(g.rocks[0].y, y);
  game.step(ROCK_WARNING / 3, 2);
  assert.ok(g.rocks[0].y > y);
});
