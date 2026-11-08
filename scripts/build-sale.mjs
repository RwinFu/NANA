// Turn the two Vite entries into a standalone static site:
// dist-sale/index.html and dist-sale/guest/index.html.
// No files from the personal public/ directory are copied.
import { readFile, writeFile, mkdir, rm, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { checkSale } from './check-sale.mjs';

const dist = 'dist-sale';
const html = await readFile(join(dist, 'sale-guest.html'), 'utf8');
await mkdir(join(dist, 'guest'), { recursive: true });
await writeFile(join(dist, 'guest/index.html'), html.replace(/(href|src)="\.\//g, '$1="../'), 'utf8');
await rm(join(dist, 'sale-guest.html'));
await rename(join(dist, 'sale.html'), join(dist, 'index.html'));
await checkSale(dist);
console.log('Sale site ready: dist-sale/index.html + dist-sale/guest/index.html');
