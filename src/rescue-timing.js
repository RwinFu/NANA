// Pure helpers shared by gameplay, rendering and tests.
export const VICTORY_WALK_START = 1.15;
export const VICTORY_GATE_CUE = 3.1;
export const PORTAL_ZOOM_START = 4.3;
export const PORTAL_ZOOM_DURATION = 2.8;
export const VICTORY_EXIT = PORTAL_ZOOM_START + PORTAL_ZOOM_DURATION;

export function smoothStep(value) {
  const x = Math.max(0, Math.min(1, value));
  return x * x * (3 - 2 * x);
}

export function portalZoom(time) {
  return 1 + 24 * smoothStep((time - PORTAL_ZOOM_START) / PORTAL_ZOOM_DURATION);
}

// Screen-space camera pose: settle the doorway at the centre while zooming.
export function portalCamera(time, gateX, camX, width, height) {
  const progress = smoothStep((time - PORTAL_ZOOM_START) / PORTAL_ZOOM_DURATION);
  const x = gateX + 60 - camX;
  const y = 307;
  return {
    x, y,
    targetX: x + (width / 2 - x) * progress,
    targetY: y + (height / 2 - y) * progress,
    zoom: portalZoom(time),
    hudOpacity: 1 - smoothStep((time - PORTAL_ZOOM_START) / 0.8),
  };
}

export function portalCharacterOpacity(x, gateX) {
  return 1 - smoothStep((x - (gateX - 4)) / 36);
}
export const ROCK_WARNING = 0.75;

export function ledgeX(ledge, time) {
  return ledge.x + (ledge.sway || 0) * Math.sin(time * (ledge.speed || 0.7));
}

export function helpAfterLoss(failures, checkpoint) {
  if (failures < 2) return 'از آخرین نقطه‌ی امن ادامه بده.';
  if (checkpoint < 900) return 'نزدیک گیسوی طلایی بایست و دکمه‌ی پرش را نگه دار.';
  if (checkpoint < 2180) return 'برای اژدها از جرقه استفاده کن؛ بین حمله‌ها جاخالی بده.';
  return 'به علامت سنگ‌ها نگاه کن و برای عبور دوباره در هوا بپر.';
}
