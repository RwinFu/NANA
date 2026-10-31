import test from 'node:test';
import assert from 'node:assert/strict';
import { createVideoPlayback } from '../src/video-playback.js';

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

test('video waits for decoded data and resumes when the page becomes visible', async () => {
  const video = Object.assign(eventTarget(), {
    paused: true,
    readyState: 0,
    error: null,
    playCalls: 0,
    play() {
      this.playCalls += 1;
      this.paused = false;
      return Promise.resolve();
    },
    pause() {
      this.paused = true;
      this.dispatch('pause');
    },
  });
  const documentRef = Object.assign(eventTarget(), { hidden: false });
  const windowRef = { setTimeout: () => 1, clearTimeout: () => {} };

  const dispose = createVideoPlayback(video, documentRef, windowRef);
  assert.equal(video.playCalls, 0, 'do not start before a video frame is available');

  video.readyState = 2;
  video.dispatch('loadeddata');
  await Promise.resolve();
  assert.equal(video.playCalls, 1);

  documentRef.hidden = true;
  documentRef.dispatch('visibilitychange');
  assert.equal(video.paused, true);

  documentRef.hidden = false;
  documentRef.dispatch('visibilitychange');
  await Promise.resolve();
  assert.equal(video.playCalls, 2);
  assert.equal(video.paused, false);

  dispose();
  assert.equal(video.listenerCount('canplay'), 0);
  assert.equal(documentRef.listenerCount('visibilitychange'), 0);
});

test('video retries a rejected play request a limited number of times', async () => {
  const timers = [];
  const video = Object.assign(eventTarget(), {
    paused: true,
    readyState: 2,
    error: null,
    playCalls: 0,
    play() {
      this.playCalls += 1;
      if (this.playCalls === 1) return Promise.reject(new Error('temporary playback failure'));
      this.paused = false;
      return Promise.resolve();
    },
    pause() {
      this.paused = true;
      this.dispatch('pause');
    },
  });
  const documentRef = Object.assign(eventTarget(), { hidden: false });
  const windowRef = {
    setTimeout(callback) {
      timers.push(callback);
      return timers.length;
    },
    clearTimeout: () => {},
  };

  const dispose = createVideoPlayback(video, documentRef, windowRef);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(timers.length, 1);

  timers[0]();
  await Promise.resolve();
  assert.equal(video.playCalls, 2);
  assert.equal(video.paused, false);
  dispose();
});
