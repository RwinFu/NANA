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
// A refused play() is retried a few times, spaced out, never in a loop.
const RETRY_MS = 700;
const MAX_RETRIES = 2;

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

// Keeps one <video> in sync with the game: waits for decoded data, retries a rejected play
// request a limited number of times, pauses while the page is hidden and resumes when it is
// back, and never calls play() on a video that is already playing.
export function createVideoPlayback(video, documentRef = document, windowRef = window) {
  let wanted = true; // the game wants this playing (sync() narrows it)
  let retries = 0;
  let retryTimer = null;
  let disposed = false;

  function playNow() {
    if (disposed || !video || !wanted) return;
    if (documentRef.hidden || video.error) return;
    if (!video.paused) return; // already playing
    if (video.readyState < 2) return; // 'loadeddata' / 'canplay' comes back here
    let result;
    try {
      result = video.play();
    } catch {
      scheduleRetry();
      return;
    }
    if (!result || typeof result.then !== 'function') {
      retries = 0;
      return;
    }
    result.then(
      () => { retries = 0; },
      () => scheduleRetry(), // refused (autoplay policy, decoder busy): try again later
    );
  }

  function scheduleRetry() {
    if (disposed || documentRef.hidden || retryTimer !== null || retries >= MAX_RETRIES) return;
    retries += 1;
    retryTimer = windowRef.setTimeout(() => {
      retryTimer = null;
      playNow();
    }, RETRY_MS);
  }

  function pauseNow() {
    if (retryTimer !== null) {
      windowRef.clearTimeout(retryTimer);
      retryTimer = null;
    }
    if (video && !video.paused) video.pause();
  }

  function onReady() {
    playNow();
  }

  function onPlaying() {
    retries = 0;
  }

  // A pause we did not ask for (the browser's own memory saving, a phone call) resumes by itself,
  // unless the game no longer wants it playing.
  function onPause() {
    if (wanted && !documentRef.hidden) playNow();
  }

  function onVisibilityChange() {
    if (documentRef.hidden) {
      pauseNow();
      return;
    }
    retries = 0;
    playNow();
  }

  video?.addEventListener('loadeddata', onReady);
  video?.addEventListener('canplay', onReady);
  video?.addEventListener('playing', onPlaying);
  video?.addEventListener('pause', onPause);
  documentRef?.addEventListener('visibilitychange', onVisibilityChange);
  playNow();

  return {
    // Called every frame; cheap when nothing changes.
    sync(shouldPlayIn) {
      if (disposed || !video) return;
      if (shouldPlayIn) {
        if (!wanted) {
          wanted = true;
          retries = 0; // a new viewing: a fresh set of retries
        }
        playNow();
      } else if (wanted) {
        wanted = false;
        pauseNow();
      }
    },
    get playing() {
      return !!(video && !video.paused);
    },
    dispose() {
      disposed = true;
      wanted = false;
      pauseNow();
      video?.removeEventListener('loadeddata', onReady);
      video?.removeEventListener('canplay', onReady);
      video?.removeEventListener('playing', onPlaying);
      video?.removeEventListener('pause', onPause);
      documentRef?.removeEventListener('visibilitychange', onVisibilityChange);
    },
  };
}
