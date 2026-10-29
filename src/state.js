import { defaults } from './memories.js';

const STORAGE_KEY = 'our-home-v8';
const HEX = /^#[0-9a-f]{6}$/i;

function clampText(value, fallback, max) {
  const text = typeof value === 'string' ? value.trim().slice(0, max) : '';
  return text || fallback;
}

function sanitize(raw) {
  return {
    fromName: clampText(raw.fromName, defaults.fromName, 24),
    toName: clampText(raw.toName, defaults.toName, 24),
    dedication: clampText(raw.dedication, defaults.dedication, 90),
    anniversaryMsg: clampText(raw.anniversaryMsg, defaults.anniversaryMsg, 120),
    avatarColor: HEX.test(raw.avatarColor) ? raw.avatarColor : defaults.avatarColor,
  };
}

function read() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
    return sanitize(parsed && typeof parsed === 'object' ? parsed : {});
  } catch {
    return sanitize({});
  }
}

function write(state) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage can be full or blocked (private mode). The game still works without it.
  }
}

export function createStore() {
  let state = read();
  const listeners = new Set();
  return {
    get: () => state,
    set(patch) {
      state = sanitize({ ...state, ...patch });
      write(state);
      listeners.forEach((fn) => fn(state));
      return state;
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

export const formatNumber = (n) => new Intl.NumberFormat('fa-IR').format(n);
