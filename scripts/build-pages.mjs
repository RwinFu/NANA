// Builds the site GitHub Pages serves, from the two entry points Vite emits:
//
//   dist/index.html   the main house, at /NANA/
//   dist/guest.html   the guest house, moved to /NANA/guest/index.html
//
// Both pages share one `assets/` folder, and `base: './'` makes every URL relative, so the guest page -- one
// level deeper -- needs its `./` prefixes changed to `../`. That is the only thing this script touches.

import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

const dist = 'dist';
const guestDir = join(dist, 'guest');

const html = await readFile(join(dist, 'guest.html'), 'utf8');
const rebased = html.replace(/(href|src)="\.\//g, '$1="../');

await mkdir(guestDir, { recursive: true });
await writeFile(join(guestDir, 'index.html'), rebased, 'utf8');
await rm(join(dist, 'guest.html'));
console.log('guest page written to dist/guest/index.html');
