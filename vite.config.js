import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// In development the guest house has to answer at the same address it does in production, `/guest/`, or the
// page cannot be looked at (and src/guest.js reads the path, not a query). Vite has no route table for that, so
// this rewrites the path to the entry point before Vite looks at it. The build does not use it: GitHub Pages is
// served from dist/guest/index.html, made by scripts/build-pages.mjs.
function guestPageInDev() {
  return {
    name: 'guest-page-in-dev',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (/^\/guest(\/|\?|$)/.test(req.url || '')) req.url = '/guest.html';
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [guestPageInDev()],
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
