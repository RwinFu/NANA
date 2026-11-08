import { defineConfig } from 'vite';
import { resolve, dirname } from 'node:path';

// A separate commercial build, not a skin over the personal site's public directory.
// Only sale-public is copied. The content module and door sign are replaced at resolution time,
// so neither personal photographs nor the personal letter enter the sale dependency graph.
const root = process.cwd();
const replacements = new Map([
  [resolve(root, 'src/memories.js'), resolve(root, 'src/sale-content.js')],
  [resolve(root, 'src/sign-outline.js'), resolve(root, 'src/sale-sign-outline.js')],
]);
function saleEdition() {
  return {
    name: 'mehr-sale-edition',
    enforce: 'pre',
    async resolveId(source, importer) {
      if (!importer || !source.startsWith('.')) return null;
      const id = resolve(dirname(importer.split('?')[0]), source);
      return replacements.get(id) || null;
    },
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        const url = req.url || '/';
        if (/^\/sale\/guest(?:\/?(?:\?|$)|\/index\.html(?:\?|$)|\.html(?:\?|$))/.test(url)) {
          req.url = '/sale-guest.html' + (url.includes('?') ? url.slice(url.indexOf('?')) : '');
        } else if (/^\/sale(?:\/?(?:\?|$)|\/index\.html(?:\?|$)|\.html(?:\?|$))/.test(url) || url === '/') {
          req.url = '/sale.html' + (url.includes('?') ? url.slice(url.indexOf('?')) : '');
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [saleEdition()],
  base: './',
  publicDir: 'sale-public',
  build: {
    outDir: 'dist-sale',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(root, 'sale.html'),
        guest: resolve(root, 'sale-guest.html'),
      },
    },
  },
  server: { host: '0.0.0.0', allowedHosts: true },
  preview: { host: '0.0.0.0', allowedHosts: true },
});
