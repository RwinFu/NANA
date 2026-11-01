import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldPlayVideo, createVideoPlayback, WATCH_RADIUS, STOP_RADIUS, CULL_MARGIN } from '../src/video-screen.js';

// A stand-in for an <video>: enough of the API for createVideoPlayback, with counters.
function fakeVideo({ readyState = 4, refuse = false } = {}) {
  const listeners = new Map();
  return {
    paused: true,
    readyState,
    plays: 0,
    pauses: 0,
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      listeners.get(type)?.delete(fn);
    },
    emit(type) {
      listeners.get(type)?.forEach((fn) => fn());
    },
    play() {
      this.plays += 1;
      if (refuse) return Promise.reject(new Error('NotAllowedError'));
      this.paused = false;
      return Promise.resolve();
    },
    pause() {
      this.pauses += 1;
      this.paused = true;
    },
  };
}

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

test('sync() calls play() once, not on every frame', () => {
  const video = fakeVideo();
  const player = createVideoPlayback(video);
  for (let frame = 0; frame < 120; frame += 1) player.sync(true);
  assert.equal(video.plays, 1);
  assert.equal(player.playing, true);
  for (let frame = 0; frame < 60; frame += 1) player.sync(true);
  assert.equal(video.plays, 1);
});

test('pausing is only asked for while it is actually playing', () => {
  const video = fakeVideo();
  const player = createVideoPlayback(video);
  player.sync(false);
  assert.equal(video.pauses, 0);
  player.sync(true);
  player.sync(false);
  player.sync(false);
  assert.equal(video.pauses, 1);
  assert.equal(video.paused, true);
});

test('a refused play() is retried after a pause, not every frame', () => {
  const video = fakeVideo({ refuse: true });
  let clock = 0;
  const player = createVideoPlayback(video, { now: () => clock });
  player.sync(true);
  assert.equal(video.plays, 1);
  clock += 30;
  player.sync(true);
  assert.equal(video.plays, 1, 'no retry before the cooldown');
  clock += 1000;
  player.sync(true);
  assert.equal(video.plays, 2, 'retried once the cooldown is over');
});

test('a clip that is not ready yet plays as soon as it can', () => {
  const video = fakeVideo({ readyState: 0 });
  const player = createVideoPlayback(video);
  player.sync(true);
  assert.equal(video.plays, 0, 'nothing to play yet');
  video.readyState = 4;
  video.emit('canplay');
  assert.equal(video.plays, 1);
});

test('dispose() stops the video and drops its listener', () => {
  const video = fakeVideo();
  const player = createVideoPlayback(video);
  player.sync(true);
  player.dispose();
  assert.equal(video.paused, true);
  video.emit('canplay');
  assert.equal(video.plays, 1, 'no play after dispose');
});
