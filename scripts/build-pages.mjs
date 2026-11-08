// Builds the site GitHub Pages serves:
//
//   dist/index.html        the personal house, at /NANA/
//   dist/guest/index.html  the personal guest house, at /NANA/guest/
//   dist/sale/             the standalone commercial edition, at /NANA/sale/
//   dist/sale/guest/       its short visit, at /NANA/sale/guest/
//
// The personal pages share one `assets/` folder. The sale edition keeps its own assets and
// media inside dist/sale, so publishing it never replaces or mixes with the personal files.

import { readFile, writeFile, mkdir, rm, cp, access } from 'node:fs/promises';
import { join } from 'node:path';

const dist = 'dist';
const guestDir = join(dist, 'guest');

const html = await readFile(join(dist, 'guest.html'), 'utf8');
const rebased = html.replace(/(href|src)="\.\//g, '$1="../');

await mkdir(guestDir, { recursive: true });
await writeFile(join(guestDir, 'index.html'), rebased, 'utf8');
await rm(join(dist, 'guest.html'));
console.log('guest page written to dist/guest/index.html');

// The sale build is a complete, relative-path static site. Nesting the whole directory
// preserves its own assets/ and sale/ media URLs at /NANA/sale/ and /NANA/sale/guest/.
await access(join('dist-sale', 'index.html'));
await access(join('dist-sale', 'guest', 'index.html'));
await cp('dist-sale', join(dist, 'sale'), { recursive: true });
console.log('sale pages written to dist/sale/index.html and dist/sale/guest/index.html');
