// Side-by-side timing (release-gate protocol, DEC-2026-023 (a)): production build vs candidate build,
// served locally, same emulation, alternating runs. Usage:
//   A=http://localhost:8791 B=http://localhost:8790 RUNS=4 KIND=pdf|xml node spike/perf/ab.mjs
// Pass rule: candidate median <= 1.03 x production median.
import { chromium, devices } from '@playwright/test';
const A = process.env.A, B = process.env.B, RUNS = Number(process.env.RUNS ?? 4), KIND = process.env.KIND ?? 'pdf';
if (!A || !B) { console.error('set A (production) and B (candidate) base URLs'); process.exit(2); }
const browser = await chromium.launch();
const out = { A: [], B: [] };
for (let i = 0; i < RUNS; i++) for (const [k, url] of [['A', A], ['B', B]]) {
  const ctx = await browser.newContext({ ...devices['Pixel 7'], locale: 'de-DE', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 });
  await cdp.send('Network.clearBrowserCache');
  await page.goto(url + '/?test');
  await page.waitForTimeout(1500);
  const t0 = Date.now();
  if (KIND === 'pdf') {
    await page.getByRole('button', { name: 'ZUGFeRD-PDF' }).click();
    await page.getByRole('heading', { name: /^Gültig/ }).waitFor({ timeout: 90_000 });
  } else {
    await page.getByRole('button', { name: 'Rechnung mit Fehler' }).click();
    await page.getByRole('heading', { name: 'Nicht gültig' }).waitFor({ timeout: 90_000 });
  }
  out[k].push(Date.now() - t0);
  await ctx.close();
}
await browser.close();
const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const ratio = med(out.B) / med(out.A);
console.log(JSON.stringify({ kind: KIND, production: out.A, candidate: out.B, medianA: med(out.A), medianB: med(out.B), ratio: Number(ratio.toFixed(3)), pass: ratio <= 1.03 }));
