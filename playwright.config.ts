import { defineConfig, devices } from '@playwright/test';

// End-to-end tests run against the production build served like Cloudflare Pages
// (headers, CSP and functions active).
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  // E2E_BASE_URL runs the suite against a deployment (e.g. the Cloudflare preview) instead of a local server.
  use: { baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:8788', locale: 'de-DE' },
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: 'npx wrangler pages dev dist --port 8788',
    url: 'http://localhost:8788',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
