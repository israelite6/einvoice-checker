// Cross-check on real ZUGFeRD / Factur-X samples: our shipped validatePdf vs Mustang (reference).
// Compares whether embedded XML is found, the profile, and the XML-part verdict (not PDF/A, which we
// deliberately do not check).
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
const BASE = process.env.BASE ?? 'http://localhost:8788';
const dir = 'spike/vendor/zugferd/samples';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${BASE}/?parity&test`);
await page.waitForFunction(() => '__einvoice' in window, null, { timeout: 60_000 });
const rows = [];
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.pdf'))) {
  const rep = fs.readFileSync(path.join('spike/zugferd/mustang-reports', f.replace('.pdf', '.xml')), 'utf8');
  const xmlPart = /<xml>[\s\S]*?<summary status="([a-z]+)"/.exec(rep)?.[1] ?? (rep.includes('<xml>') ? '?' : 'no-xml');
  const mProfile = /<profile>([^<]+)<\/profile>/.exec(rep)?.[1] ?? '';
  const o = await page.evaluate(async (b) => window.__einvoice.validatePdf(new Uint8Array(b)), [...fs.readFileSync(path.join(dir, f))]);
  rows.push({ file: f, mustangXml: xmlPart, mustangProfile: mProfile.slice(-40), ours: o.status, ourProfile: o.pdf?.profile, errors: o.findings.filter((x) => x.level === 'error').map((x) => x.code).join(',') });
}
await browser.close();
console.table(rows);
