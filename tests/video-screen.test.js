import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldPlayVideo, createVideoPlayback, WATCH_RADIUS, STOP_RADIUS, CULL_MARGIN } from '../src/video-screen.js';

function eventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    dispatch(type) {
      for (const listener of listeners.get(type) ?? []) listener();
    },
    listenerCount(type) {
      return listeners.get(type)?.size ?? 0;
    },
  };
}

// A stand-in for an <video>: enough of the API for createVideoPlayback, with counters.
function fakeVideo({ readyState = 0, refuse = 0 } = {}) {
  const video = Object.assign(eventTarget(), {
    paused: true,
    readyState,
    error: null,
    playCalls: 0,
    refusalsLeft: refuse,
    play() {
      this.playCalls += 1;
      if (this.refusalsLeft > 0) {
        this.refusalsLeft -= 1;
        return Promise.reject(new Error('NotAllowedError'));
      }
      this.paused = false;
      return Promise.resolve();
    },
    pause() {
      this.paused = true;
      this.dispatch('pause');
    },
  });
  return video;
}

function fakeTimers() {
  const callbacks = [];
  return {
    callbacks,
    setTimeout(fn) {
      callbacks.push(fn);
      return callbacks.length;
    },
    clearTimeout(id) {
      if (id) callbacks[id - 1] = null;
    },
    run() {
      const pending = callbacks.slice();
      callbacks.length = 0;
      pending.forEach((fn) => fn && fn());
    },
  };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

test('the screen plays near the couple and stops far away, holding in between', () => {
  assert.equal(shouldPlayVideo({ distance: 1, cameraDistance: 2, playing: false }), true);
  assert.equal(shouldPlayVideo({ distance: WATCH_RADIUS - 0.1, cameraDistance: 5, playing: false }), true);
  assert.equal(shouldPlayVideo({ distance: STOP_RADIUS + 1, cameraDistance: 30, playing: true }), false);
  // In the band, the current state is kept so the video does not start and stop at one spot
  assert.equal(shouldPlayVideo({ distance: (WATCH_RADIUS + STOP_RADIUS) / 2, cameraDistance: 20, playing: true }), true);
  assert.equal(shouldPlayVideo({ distance: (WATCH_RADIUS + STOP_RADIUS) / 2, cameraDistance: 20, playing: false }), false);
});

test('a screen the camera cannot see is left paused, and unknown distances play', () => {
  assert.equal(shouldPlayVideo({ distance: 1, cameraDistance: CULL_MARGIN + 5, playing: true }), false);
  assert.equal(shouldPlayVideo({ distance: null, cameraDistance: 3, playing: false }), true);
  assert.equal(shouldPlayVideo({ distance: NaN, cameraDistance: NaN, playing: false }), true);
});

test('nothing starts before a frame is decoded, then it starts once', async () => {
  const video = fakeVideo({ readyState: 0 });
  const doc = Object.assign(eventTarget(), { hidden: false });
  createVideoPlayback(video, doc, fakeTimers());
  assert.equal(video.playCalls, 0, 'no data to play yet');
  video.readyState = 2;
  video.dispatch('loadeddata');
  await settle();
  assert.equal(video.playCalls, 1);
});

test('sync() does not call play() again on every frame', async () => {
  const video = fakeVideo({ readyState: 2 });
  const doc = Object.assign(eventTarget(), { hidden: false });
  const player = createVideoPlayback(video, doc, fakeTimers());
  for (let frame = 0; frame < 120; frame += 1) player.sync(true);
  await settle();
  assert.equal(video.playCalls, 1);
  assert.equal(player.playing, true);
  for (let frame = 0; frame < 60; frame += 1) player.sync(true);
  await settle();
  assert.equal(video.playCalls, 1);
});

test('walking away pauses once, and coming back plays once more', async () => {
  const video = fakeVideo({ readyState: 2 });
  const doc = Object.assign(eventTarget(), { hidden: false });
  const player = createVideoPlayback(video, doc, fakeTimers());
  player.sync(true);
  await settle();
  assert.equal(video.paused, false);

  player.sync(false);
  assert.equal(video.paused, true);
  const callsWhileAway = video.playCalls;
  player.sync(false);
  assert.equal(video.playCalls, callsWhileAway, 'no play() while the screen is not wanted');

  player.sync(true);
  await settle();
  assert.equal(video.playCalls, callsWhileAway + 1);
});

test('a refused play() is retried a limited number of times, with a gap', async () => {
  const video = fakeVideo({ readyState: 2, refuse: 99 });
  const doc = Object.assign(eventTarget(), { hidden: false });
  const timers = fakeTimers();
  createVideoPlayback(video, doc, timers);
  await settle();
  await settle();
  assert.equal(video.playCalls, 1);
  assert.equal(timers.callbacks.length, 1, 'a retry is scheduled, not a loop');

  timers.run();
  await settle();
  await settle();
  assert.equal(video.playCalls, 2);

  timers.run();
  await settle();
  await settle();
  assert.equal(video.playCalls, 3);
  // Two retries were allowed; nothing more is scheduled for the same attempt.
  assert.equal(timers.callbacks.filter(Boolean).length, 0);
});

test('a retry that succeeds starts the clip', async () => {
  const video = fakeVideo({ readyState: 2, refuse: 1 });
  const doc = Object.assign(eventTarget(), { hidden: false });
  const timers = fakeTimers();
  createVideoPlayback(video, doc, timers);
  await settle();
  await settle();
  assert.equal(video.paused, true, 'the first attempt was refused');

  timers.run();
  await settle();
  assert.equal(video.paused, false);
});

test('a hidden tab pauses the clip and coming back resumes it', async () => {
  const video = fakeVideo({ readyState: 0 });
  const doc = Object.assign(eventTarget(), { hidden: false });
  createVideoPlayback(video, doc, fakeTimers());
  video.readyState = 2;
  video.dispatch('loadeddata');
  await settle();
  assert.equal(video.paused, false);

  doc.hidden = true;
  doc.dispatch('visibilitychange');
  assert.equal(video.paused, true);

  doc.hidden = false;
  doc.dispatch('visibilitychange');
  await settle();
  assert.equal(video.paused, false);
});

test('a pause nobody asked for resumes by itself, until the screen is not wanted', async () => {
  const video = fakeVideo({ readyState: 2 });
  const doc = Object.assign(eventTarget(), { hidden: false });
  const player = createVideoPlayback(video, doc, fakeTimers());
  await settle();
  const started = video.playCalls;

  video.pause(); // the browser's own pause, e.g. it reclaimed the decoder
  await settle();
  assert.equal(video.playCalls, started + 1, 'it comes back');

  player.sync(false); // now the game does not want it
  video.pause();
  await settle();
  assert.equal(video.playCalls, started + 1, 'a pause we wanted is not undone');
});

test('dispose() stops the video and drops every listener', async () => {
  const video = fakeVideo({ readyState: 2 });
  const doc = Object.assign(eventTarget(), { hidden: false });
  const player = createVideoPlayback(video, doc, fakeTimers());
  await settle();
  assert.equal(video.paused, false);

  player.dispose();
  assert.equal(video.paused, true);
  assert.equal(video.listenerCount('canplay'), 0);
  assert.equal(video.listenerCount('loadeddata'), 0);
  assert.equal(doc.listenerCount('visibilitychange'), 0);

  const calls = video.playCalls;
  video.readyState = 2;
  video.dispatch('canplay');
  await settle();
  assert.equal(video.playCalls, calls, 'no play after dispose');
});
