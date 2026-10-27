import { defineConfig } from 'vite';

export default defineConfig({
  // Relative paths work both on the domain root and GitHub Pages project subpaths.
  base: './',
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
