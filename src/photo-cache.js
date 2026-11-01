// One download per photo, shared by everything that wants it.
//
// The gallery's photos are the point of the house, so they are asked for as early as the page can ask:
// main.js starts every one of them the moment its first line runs, which is before the world is built
// (that takes half a second of main thread, during which the network would otherwise be idle). Each
// request is made once and the resulting <img> is handed to three.js as a texture, so a photo is never
// fetched twice — the old code let the world's TextureLoader make its own request for every frame, and
// a preload with the same URL could have doubled it.
//
// There is no "start it later" here on purpose: a photo that is not on screen yet is still wanted, and
// these are the pictures the whole game exists to show.

const images = new Map(); // url -> Promise<HTMLImageElement>

function fetchImage(url) {
  return new Promise((resolve, reject) => {
    if (typeof Image !== 'function') {
      reject(new Error(`no Image in this environment: ${url}`));
      return;
    }
    const img = new Image();
    // decode off the main thread where the browser allows it, so a photo arriving mid-frame does not
    // stop the game for a moment
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`photo failed to load: ${url}`));
    img.src = url;
  });
}

// Ask for a photo now. Repeated calls share the one request.
export function photoImage(url) {
  if (!url) return Promise.reject(new Error('no photo url'));
  let pending = images.get(url);
  if (!pending) {
    pending = fetchImage(url);
    // a failed photo must not leave an unhandled rejection behind (the frames show their own card)
    pending.catch(() => {});
    images.set(url, pending);
  }
  return pending;
}

// Start a set of downloads without waiting for them (the frames pick them up as they land).
export function startPhotos(urls) {
  for (const url of urls) photoImage(url);
}

// For tests and for the loading state: what has been asked for, and what has arrived.
export function photoState() {
  return { requested: images.size };
}

export function forgetPhotos() {
  images.clear();
}
