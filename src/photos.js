// When the room's clip is allowed to start.
//
// The seventeen photos are downloaded from the page's first line (see photo-cache.js) — they are the
// visit. The clip on the photo room's screen is not a photo: it is 1.08 MB of video and a live decoder,
// and it used to start downloading and playing at the first frame of the game, through the whole gate,
// for a screen nobody had walked up to. It waits until the couple is near it.

// How near (in metres, on the ground plane) the couple has to be before the room's clip may start.
// The screen faces east into the small room; the doorway is at x ≈ -4, z ≈ -20.
export const VIDEO_TRIGGER = { x: -6.6, z: -20, radius: 20 };

const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

// A latch: false until `start()` is called, then true for good — walking away does not undo it.
export function createLatch(start, test) {
  let on = false;
  return {
    get started() { return on; },
    start() {
      if (on) return false;
      on = true;
      start();
      return true;
    },
    // Called from the walk with where the couple is. Returns true on the frame it starts.
    update(position) {
      if (on || !position) return false;
      if (!test(position)) return false;
      return this.start();
    },
  };
}

// The clip may start once the couple is within the trigger. Safe to call every frame or once a second.
export function createVideoLatch(start) {
  return createLatch(start, (p) => flat(p, VIDEO_TRIGGER) <= VIDEO_TRIGGER.radius);
}
