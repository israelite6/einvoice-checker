import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
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
        globPatterns: ['**/*.{js,css,html,svg}', 'assets/inter-latin-wght-*.woff2'],
        globIgnores: ['rules/**', 'vendor/**', '_viztest.html'],
        navigateFallbackDenylist: [/^\/api\//],
        // Cloudflare Pages redirects /index.html to / (308); precache the page under "/" instead.
        navigateFallback: '/',
        manifestTransforms: [async (entries) => ({
          manifest: entries.map((e) => (e.url === 'index.html' ? { ...e, url: '/' } : e)),
          warnings: [],
        })],
        runtimeCaching: [{
          urlPattern: ({ url }) => url.pathname.startsWith('/rules/') || url.pathname.startsWith('/vendor/') || url.pathname.startsWith('/samples/'),
          handler: 'CacheFirst',
          options: { cacheName: 'rules-v1', expiration: { maxEntries: 60 } },
        }],
      },
    }),
  ],
  build: { target: 'es2022', sourcemap: false },
});
