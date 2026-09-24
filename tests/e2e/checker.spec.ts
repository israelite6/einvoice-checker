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
