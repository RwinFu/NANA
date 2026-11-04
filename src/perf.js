// The frame-rate work, and the switch that turns it off.
//
// The game ships with the weld on (see merge-static.js): the world is built from two thousand small
// meshes, each one a draw call, and welding the static ones per material takes roughly a quarter of the
// draw calls out of the frame without moving a vertex. It is on because it is the fix, not an experiment.
//
// The switch is there so the two builds can still be compared, by eye, whenever anyone doubts it:
//
//   (no parameter)  the weld, as shipped
//   ?perf=0         the plain scene, every mesh on its own -- the old build
//   ?perf=merge     the same as no parameter, said out loud
//
// A link keeps every other parameter, so `?pref=...` style links elsewhere in the game survive.
// Read without assuming a browser: the tests import this module in Node, where there is no window.

const search = typeof window !== 'undefined' && window.location ? window.location.search : '';
const choice = (new URLSearchParams(search).get('perf') || '').toLowerCase();

export const perf = {
  merge: choice !== '0',
  // true only when a parameter overrode the default, which is when the badge is worth showing
  overridden: choice === '0',
};

// The link that would build the scene the other way, keeping every other parameter as it is.
export function perfHref(merge) {
  const next = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  if (merge) next.delete('perf');
  else next.set('perf', '0');
  const query = next.toString();
  const path = typeof window !== 'undefined' ? window.location.pathname : '/';
  return `${path}${query ? `?${query}` : ''}`;
}

// A corner badge, only while the URL overrides the shipped build: it says so and offers the way back.
export function showPerfBadge() {
  if (!perf.overridden) return;
  const el = document.createElement('div');
  el.className = 'perf-badge';
  const text = document.createElement('span');
  text.textContent = 'حالت مقایسه: بدون یکی‌سازی مش‌ها';
  const link = document.createElement('a');
  link.href = perfHref(true);
  link.textContent = 'برگشت به حالت عادی';
  el.append(text, link);
  document.body.appendChild(el);
}
