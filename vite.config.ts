import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Rule URLs carry this version so updated rules bypass old caches (qa-release-r1 M2).
const manifest = JSON.parse(fs.readFileSync('public/rules/manifest.json', 'utf8')) as { version: string };

export default defineConfig({
  define: { __RULES_VERSION__: JSON.stringify(manifest.version) },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      manifest: {
        name: 'E-Rechnung prüfen',
        short_name: 'E-Rechnung',
        description: 'XRechnung prüfen und lesbar machen – kostenlos, ohne Upload.',
        lang: 'de',
        theme_color: '#1e40af',
        background_color: '#f8fafc',
        display: 'standalone',
        icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        // App shell is precached; rules and runtimes are cached on first use so checks work offline.
        globPatterns: ['**/*.{js,css,html,svg}', 'assets/*.wasm', 'assets/inter-latin-wght-*.woff2'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        // pdf.js (~1.7 MB) is only needed for PDFs: cached on first use instead of for every visitor.
        globIgnores: ['rules/**', 'vendor/**', '_viztest.html', 'assets/pdf*'],
        navigateFallbackDenylist: [/^\/api\//],
        // Cloudflare Pages redirects /index.html to / (308); precache the page under "/" instead.
        navigateFallback: '/',
        manifestTransforms: [async (entries) => ({
          manifest: entries.map((e) => (e.url === 'index.html' ? { ...e, url: '/' } : e)),
          warnings: [],
        })],
        // Rule files are requested with ?v=<rules version>, so a new release uses new cache keys;
        // the cache name also carries the version and older rule caches are removed on activate.
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [{
          urlPattern: ({ url }) => /^\/assets\/pdf[^/]*\.m?js$/.test(url.pathname),
          handler: 'CacheFirst',
          options: { cacheName: 'pdfjs', expiration: { maxEntries: 6 }, cacheableResponse: { statuses: [200] } },
        }, {
          urlPattern: ({ url }) => url.pathname.startsWith('/rules/') || url.pathname.startsWith('/vendor/') || url.pathname.startsWith('/samples/'),
          handler: 'CacheFirst',
          options: { cacheName: `rules-${manifest.version}`, expiration: { maxEntries: 40, purgeOnQuotaError: true }, cacheableResponse: { statuses: [200] } },
        }],
        importScripts: ['/sw-cleanup.js'],
      },
    }),
  ],
  build: { target: 'es2022', sourcemap: false },
});
