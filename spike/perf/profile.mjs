// Phase breakdown of one cold check (needs a build with PERF console.debug marks). URL=… KIND=pdf|xml RUNS=2
import { chromium, devices } from '@playwright/test';
const URL = process.env.URL, KIND = process.env.KIND ?? 'pdf', RUNS = Number(process.env.RUNS ?? 2);
const browser = await chromium.launch();
for (let i = 0; i < RUNS; i++) {
  const ctx = await browser.newContext({ ...devices['Pixel 7'], locale: 'de-DE', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const marks = [];
  page.on('console', (m) => { const t = m.text(); if (t.startsWith('PERF')) marks.push(t.slice(5)); });
  const reqs = [];
  page.on('requestfinished', async (r) => { const t = r.timing(); if (/sef|worker|saxon|pdf-|xmllint|scenarios|xsd/.test(r.url())) reqs.push(`${r.url().split('/').pop().split('?')[0]} ${Math.round(t.responseEnd)}ms`); });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1.6e6 / 8, uploadThroughput: 750e3 / 8 });
  await page.goto(URL + '/?test');
  await page.waitForTimeout(1500);
  const t0 = await page.evaluate(() => Math.round(performance.now()));
  if (KIND === 'pdf') { await page.getByRole('button', { name: 'ZUGFeRD-PDF' }).click(); await page.getByRole('heading', { name: /^Gültig/ }).waitFor({ timeout: 90_000 }); }
  else { await page.getByRole('button', { name: 'Rechnung mit Fehler' }).click(); await page.getByRole('heading', { name: 'Nicht gültig' }).waitFor({ timeout: 90_000 }); }
  const t1 = await page.evaluate(() => Math.round(performance.now()));
  console.log(`run ${i}: total ${t1 - t0} ms`);
  for (const m of marks) { const [l, t] = m.split(' '); console.log(`  ${l.padEnd(20)} +${Number(t) - t0}`); }
  console.log('  requests (duration):', reqs.join(', '));
  await ctx.close();
}
await browser.close();
