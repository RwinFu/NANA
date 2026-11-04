// The frame-rate experiments, behind one switch, in the preview only.
//
// Nothing changes unless the URL asks for it, so the game as shipped is untouched:
//
//   (no parameter)  the game exactly as it has always been
//   ?perf=lights    folds the hall's chandeliers (see fewer-lights.js)
//   ?perf=merge     welds static world meshes (see merge-static.js)
//   ?perf=both      both
//   ?perf=0         the plain game, said out loud
//
// The URL carries the choice so it survives a reload and can be shared, and a corner badge says which
// build is on screen and links to the other one.

// Read without assuming a browser: these modules are imported by the tests in Node, where there is no
// window, and there the answer is simply "off".
const search = typeof window !== 'undefined' && window.location ? window.location.search : '';
const choice = (new URLSearchParams(search).get('perf') || '').toLowerCase();

export const perf = {
  lights: choice === 'lights' || choice === 'both',
  merge: choice === 'merge' || choice === 'both',
  get any() { return this.lights || this.merge; },
};

// The link that would turn a build on or off, keeping every other parameter as it is.
export function perfHref(lights, merge) {
  const next = new URLSearchParams(window.location.search);
  if (!lights && !merge) next.delete('perf');
  else next.set('perf', lights && merge ? 'both' : lights ? 'lights' : 'merge');
  const query = next.toString();
  return `${window.location.pathname}${query ? `?${query}` : ''}`;
}

// A corner badge, only while an experiment is on: it names the build and offers the way back.
export function showPerfBadge() {
  if (!perf.any) return;
  const label = perf.lights && perf.merge ? 'لامپ کمتر + مش یکجا' : perf.lights ? 'لامپ کمتر' : 'مش یکجا';
  const el = document.createElement('div');
  el.className = 'perf-badge';
  const text = document.createElement('span');
  text.textContent = `حالت آزمایشی: ${label}`;
  const link = document.createElement('a');
  link.href = perfHref(false, false);
  link.textContent = 'برگشت به حالت عادی';
  el.append(text, link);
  document.body.appendChild(el);
}
