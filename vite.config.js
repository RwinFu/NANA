import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  // Relative paths work both on the domain root and GitHub Pages project subpaths.
  base: './',
  build: {
    rollupOptions: {
      // Two pages, one build. `index.html` is the house the family uses; `guest.html` is the same house for
      // friends (see src/guest.js), emitted as `/guest/index.html` by scripts/build-pages.mjs so that the
      // link can be `/NANA/guest/`. The main page is untouched by the guest one.
      input: {
        main: resolve(__dirname, 'index.html'),
        guest: resolve(__dirname, 'guest.html'),
      },
    },
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
