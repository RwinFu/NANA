// The room's video screen. The clip is the only moving image in the world, so it is kept
// cheap on purpose: it stays paused until the couple is near enough to watch it, it is left
// alone when the camera cannot see it, and its texture is only re-uploaded when the video
// really has a new frame.
//
// three.js re-uploads a new video frame by itself, on the browser's video-frame callback.
// Setting `texture.needsUpdate` from the render loop uploads the same picture again every
// frame, which made weaker phones drop frames and the video look stuck.

// How near the couple must be to the screen before it starts playing, and how far before it stops.
export const WATCH_RADIUS = 14;
export const STOP_RADIUS = 19;
// A screen this far outside the camera's view is left alone (culling):
export const CULL_MARGIN = 34;
// How long to wait after a refused play() before asking again.
const RETRY_MS = 250;

// Whether the screen should play, from the distance to the screen and where the camera is.
// `distance` is from the couple to the screen's middle, `cameraDistance` from the camera.
// Unknown distances (opening screens, first frames) play, so the clip is ready.
export function shouldPlayVideo({ distance, cameraDistance, playing }) {
  const known = (d) => typeof d === 'number' && Number.isFinite(d);
  if (known(cameraDistance) && cameraDistance > CULL_MARGIN) return false;
  if (!known(distance)) return true; // before the tour starts: keep it ready
  if (distance <= WATCH_RADIUS) return true;
  if (distance >= STOP_RADIUS) return false;
  return !!playing; // in the band between the two radii: hold the current state
}

// Keeps one <video> in sync with the game: no play() storms, no work while paused,
// and nothing thrown at a browser that refuses to start it.
export function createVideoPlayback(video, { now = () => performance.now() } = {}) {
  let wantWhenReady = false;
  let retryAt = 0;
  let listening = false;

  const onReady = () => {
    if (wantWhenReady) start();
  };

  function start() {
    if (!video) return;
    if (video.readyState < 2) {
      // Nothing decoded yet: play as soon as there is a frame to play.
      wantWhenReady = true;
      if (!listening) {
        video.addEventListener('canplay', onReady);
        listening = true;
      }
      return;
    }
    wantWhenReady = false;
    retryAt = now() + RETRY_MS; // a quiet period if this attempt is refused
    const attempt = video.play();
    if (attempt && typeof attempt.then === 'function') {
      attempt.then(
        () => { retryAt = 0; },
        () => {}, // refused (autoplay policy, decoder busy): the cooldown stays
      );
    }
  }

  return {
    // Called every frame; cheap when nothing changes.
    sync(shouldPlayIn) {
      if (!video) return;
      if (shouldPlayIn) {
        if (!video.paused) return; // already playing
        if (now() < retryAt) return; // waiting out a refusal
        start();
      } else if (!video.paused) {
        wantWhenReady = false;
        video.pause();
      }
    },
    get playing() {
      return !!(video && !video.paused);
    },
    dispose() {
      wantWhenReady = false;
      if (video) {
        if (!video.paused) video.pause();
        if (listening) video.removeEventListener('canplay', onReady);
      }
      listening = false;
    },
  };
}
