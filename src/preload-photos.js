// The first thing the page does: ask for the photos.
//
// This module exists so the requests can start at the top of module evaluation, before the world is
// built. Imported first in main.js it is the first of the app's own modules to run (the bare imports
// above it are packages), which is early enough: building the world takes about half a second of main
// thread, and without this that half second would be spent with nothing downloading.
//
// Every picture in the house is asked for here: the twelve on the hall's walls and the fifteen in the
// photo room, plus the clip's poster. They are the visit. Only the clip itself waits (1.08 MB of video,
// a screen nobody has walked up to yet); see video-screen.js.

import { allMemories, soloVideo } from './memories.js';
import { startPhotos } from './photo-cache.js';

export const photoUrls = [...allMemories.map((memory) => memory.image), soloVideo.poster];

startPhotos(photoUrls);
