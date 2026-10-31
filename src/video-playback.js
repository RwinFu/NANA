// Keep a muted inline video playing, retrying transient autoplay failures and
// resuming it when the page becomes visible again.
export function createVideoPlayback(video, documentRef, windowRef) {
  let pending = false;
  let retries = 0;
  let retryTimer = null;
  let disposed = false;

  function playIfReady() {
    if (disposed || documentRef.hidden || video.error || !video.paused || pending || video.readyState < 2) return;
    pending = true;
    let result;
    try {
      result = video.play();
    } catch {
      onPlayFailure();
      return;
    }
    if (!result || typeof result.then !== 'function') {
      pending = false;
      retries = 0;
      return;
    }
    result.then(() => {
      pending = false;
      retries = 0;
    }).catch(onPlayFailure);
  }

  function onPlayFailure() {
    pending = false;
    if (disposed || documentRef.hidden || retryTimer !== null || retries >= 2) return;
    retries += 1;
    retryTimer = windowRef.setTimeout(() => {
      retryTimer = null;
      playIfReady();
    }, 700);
  }

  function onPlaying() {
    pending = false;
    retries = 0;
  }

  function onPause() {
    if (!documentRef.hidden) playIfReady();
  }

  function onVisibilityChange() {
    if (documentRef.hidden) {
      if (retryTimer !== null) windowRef.clearTimeout(retryTimer);
      retryTimer = null;
      pending = false;
      video.pause();
      return;
    }
    retries = 0;
    playIfReady();
  }

  video.addEventListener('loadeddata', playIfReady);
  video.addEventListener('canplay', playIfReady);
  video.addEventListener('playing', onPlaying);
  video.addEventListener('pause', onPause);
  documentRef.addEventListener('visibilitychange', onVisibilityChange);
  playIfReady();

  return function disposeVideoPlayback() {
    disposed = true;
    if (retryTimer !== null) windowRef.clearTimeout(retryTimer);
    video.removeEventListener('loadeddata', playIfReady);
    video.removeEventListener('canplay', playIfReady);
    video.removeEventListener('playing', onPlaying);
    video.removeEventListener('pause', onPause);
    documentRef.removeEventListener('visibilitychange', onVisibilityChange);
  };
}
