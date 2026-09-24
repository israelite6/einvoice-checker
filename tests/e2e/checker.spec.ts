import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const SAMPLE_VALID = fs.readFileSync(path.resolve('public/samples/valid.xml'), 'utf8');
const INVOICE_NUMBER = /<cbc:ID>([^<]+)<\/cbc:ID>/.exec(SAMPLE_VALID)![1];

/** Collects CSP violations and page errors so every test can assert there were none. */
async function watch(page: Page) {
  const problems: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error' && /Content Security Policy|Refused/i.test(m.text())) problems.push(m.text()); });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => console.error(`Refused (CSP): ${e.violatedDirective} ${e.blockedURI}`));
  });
  return problems;
}

test('valid sample: verdict, readable invoice, no CSP violations', async ({ page }) => {
  const problems = await watch(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Gültige Rechnung' }).click();
  await expect(page.getByRole('heading', { name: 'Gültig', exact: true })).toBeVisible({ timeout: 30_000 });
  const frame = page.frameLocator('iframe[title="Rechnung ansehen"]');
  await expect(frame.getByText('Käuferreferenz').first()).toBeVisible({ timeout: 30_000 });
  await expect(frame.getByText('NaN')).toHaveCount(0);
  expect(problems).toEqual([]);
});

test('invalid sample: shows the failed rule in plain language', async ({ page }) => {
  const problems = await watch(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Rechnung mit Fehler' }).click();
  await expect(page.getByRole('heading', { name: 'Nicht gültig' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('BR-CO-16', { exact: true })).toBeVisible();
  await expect(page.getByText('Der fällige Betrag passt nicht')).toBeVisible();
  expect(problems).toEqual([]);
});

test('privacy: a user file never leaves the browser', async ({ page }) => {
  const outbound: string[] = [];
  page.on('request', (req) => {
    const body = req.postData() ?? '';
    const url = new URL(req.url());
    if (url.hostname !== 'localhost' || body.includes(INVOICE_NUMBER) || body.includes('<cbc:')) {
      outbound.push(`${req.method()} ${req.url()} ${body.slice(0, 80)}`);
    }
  });
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles({ name: 'meine-rechnung.xml', mimeType: 'application/xml', buffer: Buffer.from(SAMPLE_VALID) });
  await expect(page.getByRole('heading', { name: 'Gültig', exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.frameLocator('iframe[title="Rechnung ansehen"]').getByText('Käuferreferenz').first()).toBeVisible({ timeout: 30_000 });
  expect(outbound).toEqual([]);
});

test('PDF shows the coming-soon state', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles({ name: 'rechnung.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7') });
  await expect(page.getByRole('heading', { name: 'ZUGFeRD-PDF: bald verfügbar' })).toBeVisible();
});

test('theme toggle switches and persists', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await page.getByRole('button', { name: 'Dunkles Design aktivieren' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
});

test('language toggle switches to English', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Switch to English' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Check and read German e-invoices');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('no horizontal scroll', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Rechnung mit Fehler' }).click();
  await expect(page.getByText('BR-CO-16', { exact: true })).toBeVisible({ timeout: 30_000 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

for (const scheme of ['light', 'dark'] as const) {
  test(`accessibility (${scheme}): no serious or critical axe issues`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/');
    await page.getByRole('button', { name: 'Rechnung mit Fehler' }).click();
    await expect(page.getByText('BR-CO-16', { exact: true })).toBeVisible({ timeout: 30_000 });
    const results = await new AxeBuilder({ page }).exclude('iframe').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
  });
}

test('legal pages are reachable', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Impressum' }).click();
  await expect(page.getByRole('heading', { name: 'Impressum' })).toBeVisible();
  await expect(page.getByText('israel.hmis@gmail.com')).toBeVisible();
  await page.goto('/#datenschutz');
  await expect(page.getByRole('heading', { name: 'Datenschutzerklärung' })).toBeVisible();
  await page.goto('/#lizenzen');
  await expect(page.getByText('Saxonica')).toBeVisible();
});

test('works offline after the first check', async ({ page, context }) => {
  await page.goto('/');
  // Wait until the service worker controls the page, then do one online check to cache the rules.
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), null, { timeout: 30_000 });
  await page.getByRole('button', { name: 'Rechnung mit Fehler' }).click();
  await expect(page.getByText('BR-CO-16', { exact: true })).toBeVisible({ timeout: 30_000 });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText(/Offline/)).toBeVisible();
  await page.locator('input[type=file]').setInputFiles({ name: 'offline.xml', mimeType: 'application/xml', buffer: Buffer.from(SAMPLE_VALID) });
  await expect(page.getByRole('heading', { name: 'Gültig', exact: true })).toBeVisible({ timeout: 30_000 });
  await context.setOffline(false);
});

// ---- Release-gate additions (qa-release-r1) ----

/** Waits until the auto-sizing invoice frame stops changing height (avoids clicking mid-layout-shift). */
async function settled(page: Page) {
  let last = '';
  for (let i = 0; i < 20; i++) {
    const h = await page.locator('iframe[title="Rechnung ansehen"]').evaluate((f) => (f as HTMLIFrameElement).style.height);
    if (h === last) break;
    last = h;
    await page.waitForTimeout(150);
  }
  // Keep the frame's tab bar below the sticky header so clicks are not intercepted by it.
  await page.locator('iframe[title="Rechnung ansehen"]').evaluate((f) => window.scrollTo({ top: f.getBoundingClientRect().top + window.scrollY - 120 }));
}

const fixture = (f: string) => fs.readFileSync(path.resolve('tests/fixtures', f), 'utf8');

test('B1: viewer tabs and attachment downloads work under the CSP', async ({ page }) => {
  const problems = await watch(page);
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles({ name: 'anhang.xml', mimeType: 'application/xml', buffer: Buffer.from(fixture('attachment-ubl.xml')) });
  const frame = page.frameLocator('iframe[title="Rechnung ansehen"]');
  await expect(frame.locator('#uebersicht')).toBeVisible({ timeout: 30_000 });
  await expect(frame.locator('html[data-helper="ready"]')).toHaveCount(1);
  // Every tab must be the element actually hit at its own centre (no overlap on narrow screens).
  const overlaps = await frame.locator('body').evaluate(() => [...document.querySelectorAll('[role=tab]')].filter((b) => {
    const r = b.getBoundingClientRect();
    return !b.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  }).map((b) => b.id));
  expect(overlaps).toEqual([]);
  // End on "Anlagen" so the download link is on screen (the frame resizes as panels change height).
  for (const [button, panel] of [['#menueDetails', '#details'], ['#menueZusaetze', '#zusaetze'], ['#menueLaufzettel', '#laufzettel'], ['#menueUebersicht', '#uebersicht'], ['#menueAnlagen', '#anlagen']]) {
    await settled(page);
    await frame.locator(button).click();
    await expect(frame.locator(panel)).toBeVisible();
  }
  await settled(page);
  const download = page.waitForEvent('download', { timeout: 10_000 });
  await frame.locator('#anlagen a[href^="#"]').first().click();
  expect((await download).suggestedFilename().length).toBeGreaterThan(0);
  expect(problems).toEqual([]);
});

test('B2: production analytics path sends only whitelisted fields, never file content', async ({ page }) => {
  // 127.0.0.1 is not "localhost", so analytics is active exactly as in production.
  await page.addInitScript(() => {
    const w = window as unknown as { __beacons: string[] };
    w.__beacons = [];
    const orig = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url: string | URL, data?: BodyInit | null) => {
      if (data instanceof Blob) data.text().then((t) => w.__beacons.push(`${url} ${t}`));
      else w.__beacons.push(`${url} ${String(data)}`);
      return orig(url, data);
    };
  });
  const urls: string[] = [];
  page.on('request', (r) => urls.push(new URL(r.url()).pathname + ' ' + new URL(r.url()).host));
  await page.goto('http://127.0.0.1:8788/');
  const files: [string, string][] = [
    ['geheim-kunde-4711.xml', SAMPLE_VALID],
    ['geheim-cii-4711.xml', fixture('valid-cii.xml')],
    ['geheim-fehler-4711.xml', fs.readFileSync(path.resolve('public/samples/invalid.xml'), 'utf8')],
    ['geheim-schema-4711.xml', fixture('xsd-invalid-ubl.xml')],
  ];
  for (const [name, xml] of files) {
    await page.locator('input[type=file]').setInputFiles({ name, mimeType: 'application/xml', buffer: Buffer.from(xml) });
    await expect(page.getByText(name)).toBeVisible();
    await page.waitForTimeout(3000);
  }
  await page.waitForTimeout(1000);
  const beacons: string[] = await page.evaluate(() => (window as unknown as { __beacons: string[] }).__beacons);
  expect(beacons.length).toBeGreaterThanOrEqual(5); // view + 4 checks (+ multi)
  const allowed = new Set(['e', 's', 'x', 'sample', 'ms', 'r', 'n', 'ref']);
  for (const b of beacons) {
    const [url, body] = [b.slice(0, b.indexOf(' ')), b.slice(b.indexOf(' ') + 1)];
    expect(url).toMatch(/\/api\/event$/);
    for (const k of Object.keys(JSON.parse(body))) expect(allowed.has(k), `unexpected key ${k}`).toBe(true);
    for (const canary of ['geheim', '4711', INVOICE_NUMBER, 'DE79000000001234567890', 'Seller name', 'Buyer name', '<']) {
      expect(body.includes(canary), `beacon leaked ${canary}: ${body}`).toBe(false);
    }
  }
  expect(urls.filter((u) => !u.endsWith(' 127.0.0.1:8788'))).toEqual([]);
});

test('B4: engine load failure is not reported as a broken file, and retry works', async ({ page }) => {
  await page.goto('/');
  await page.route('**/rules/validation/**', (r) => r.abort());
  await page.getByRole('button', { name: 'Rechnung mit Fehler' }).click();
  await expect(page.getByRole('heading', { name: 'Prüfmodul konnte nicht geladen werden' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Keine lesbare XML-Datei')).toHaveCount(0);
  await page.unroute('**/rules/validation/**');
  await page.getByRole('button', { name: 'Erneut versuchen' }).click();
  await expect(page.getByRole('heading', { name: 'Nicht gültig' })).toBeVisible({ timeout: 30_000 });
});

test('M13: skip link on a legal page keeps the route', async ({ page }) => {
  await page.goto('/#impressum');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Impressum' })).toBeVisible();
  expect(new URL(page.url()).hash).toBe('#impressum');
});

test('M1: invoice view also works offline after the first visit', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) await page.reload();
  // Give the idle prefetch time to cache all rule files, without any check online.
  await page.waitForFunction(async () => (await caches.keys()).some((k) => k.startsWith('rules-')) && (await (await caches.open((await caches.keys()).find((k) => k.startsWith('rules-'))!)).keys()).length >= 10, null, { timeout: 30_000 });
  await context.setOffline(true);
  await page.reload();
  await page.locator('input[type=file]').setInputFiles({ name: 'offline-cii.xml', mimeType: 'application/xml', buffer: Buffer.from(fixture('valid-cii.xml')) });
  await expect(page.getByRole('heading', { name: 'Gültig', exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.frameLocator('iframe[title="Rechnung ansehen"]').getByText('Käuferreferenz').first()).toBeVisible({ timeout: 30_000 });
  await context.setOffline(false);
});

for (const target of ['/#impressum', '/#datenschutz', '/#lizenzen']) {
  test(`accessibility: ${target}`, async ({ page }) => {
    await page.goto(target);
    await page.waitForTimeout(300);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);
  });
}

test('accessibility: valid result with invoice view', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Gültige Rechnung' }).click();
  await expect(page.getByRole('heading', { name: 'Gültig', exact: true })).toBeVisible({ timeout: 30_000 });
  const results = await new AxeBuilder({ page }).exclude('iframe').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)).toEqual([]);
});
