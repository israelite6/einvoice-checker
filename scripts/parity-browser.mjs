// Parity of the SHIPPED engine: runs the built app's validateInvoice in Chromium over the official
// test suite plus generated broken files, and compares with the official KoSIT Java reports.
// Prerequisites: spike/run-parity.sh has produced spike/ref, spike/ref-mut, spike/mutants; the built
// app is served at $BASE (default http://localhost:8788, e.g. `npx wrangler pages dev dist --port 8788`).
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:8788';
const SPIKE = path.resolve('spike');
const refOf = (reportPath) => {
  const s = fs.readFileSync(reportPath, 'utf8');
  const msgs = [...s.matchAll(/<rep:message [^>]*>/g)].map((m) => ({
    level: (m[0].match(/level="([a-z]+)"/) || [])[1],
    code: (m[0].match(/code="([^"]+)"/) || [])[1] || 'XSD',
  }));
  return { accept: /<rep:assessment>\s*<rep:accept>/.test(s), xsd: /id="val-xsd" valid="true"/.test(s), msgs };
};
const key = (msgs, level) => [...new Set(msgs.filter((m) => m.level === level && m.code !== 'XSD').map((m) => m.code))].sort().join(',');

const sets = [
  { files: fs.readFileSync(path.join(SPIKE, 'testfiles.txt'), 'utf8').trim().split('\n').map((f) => path.join(SPIKE, f)), ref: 'ref' },
  { files: fs.readdirSync(path.join(SPIKE, 'mutants')).map((f) => path.join(SPIKE, 'mutants', f)), ref: 'ref-mut' },
];

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${BASE}/?parity&test`);
await page.waitForFunction(() => 'SaxonJS' in window || '__einvoice' in window, null, { timeout: 60_000 });
let total = 0, same = 0; const diffs = [];
for (const { files, ref } of sets) {
  for (const f of files) {
    const r = refOf(path.join(SPIKE, ref, path.basename(f, '.xml') + '-report.xml'));
    const xml = fs.readFileSync(f, 'utf8');
    const o = await page.evaluate((x) => window.__einvoice.validateInvoice(x), xml);
    const ours = { accept: o.status === 'valid' || o.status === 'valid-with-notes', xsd: o.xsdValid, msgs: o.findings.map((m) => ({ code: m.code, level: m.rawLevel })) };
    // Schema-invalid files: both engines must reject; message wording differs between Xerces and libxml2.
    const eq = r.accept === ours.accept && r.xsd === ours.xsd &&
      (r.xsd === false || ['error', 'warning', 'information'].every((l) => key(r.msgs, l) === key(ours.msgs, l)));
    total++; if (eq) same++; else diffs.push({ file: path.basename(f), ref: { accept: r.accept, xsd: r.xsd, e: key(r.msgs, 'error') }, ours: { accept: ours.accept, xsd: ours.xsd, e: key(ours.msgs, 'error') } });
  }
}
await browser.close();
console.log(JSON.stringify({ engine: 'shipped (dist, browser)', total, identical: same, mismatches: diffs.length }));
if (diffs.length) { console.error(JSON.stringify(diffs.slice(0, 10), null, 1)); process.exit(1); }
