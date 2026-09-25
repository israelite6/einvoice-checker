import { chromium, devices } from '@playwright/test';
const U = 'https://preview.e-rechnung-pruefen.pages.dev';
const b = await chromium.launch(); const res = [];
for (const [label, wait, kind] of [['PDF cold 1.5 s (run 1)', 1500, 'pdf'], ['PDF cold 1.5 s (run 2)', 1500, 'pdf'], ['PDF after 20 s', 20000, 'pdf'], ['XML cold 1.5 s (control)', 1500, 'xml']]) {
  const ctx = await b.newContext({ ...devices['Pixel 7'], locale: 'de-DE', serviceWorkers: 'block' });
  const page = await ctx.newPage(); const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 });
  await cdp.send('Network.clearBrowserCache');
  await page.goto(U + '/?test'); await page.waitForTimeout(wait);
  const t0 = Date.now();
  if (kind === 'pdf') { await page.getByRole('button', { name: 'ZUGFeRD-PDF' }).click(); await page.getByRole('heading', { name: /^Gültig/ }).waitFor({ timeout: 90000 }); }
  else { await page.getByRole('button', { name: 'Rechnung mit Fehler' }).click(); await page.getByRole('heading', { name: 'Nicht gültig' }).waitFor({ timeout: 90000 }); }
  res.push(`${label}: ${Date.now() - t0} ms`); await ctx.close();
}
await b.close(); console.log(res.join('\n'));
