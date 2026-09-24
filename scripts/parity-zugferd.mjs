// ZUGFeRD / Factur-X parity of the SHIPPED engine: the built app's validatePdf in Chromium over the
// generated corpus (spike/zugferd/manifest.json). The embedded XML's verdict must equal the official
// KoSIT report for the same XML; generated PDFs show their own XML, so picture-vs-XML must not warn.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';

const BASE = process.env.BASE ?? 'http://localhost:8788';
const SPIKE = path.resolve('spike');
const manifest = JSON.parse(fs.readFileSync(path.join(SPIKE, 'zugferd/manifest.json'), 'utf8'));
const refOf = (xmlRel) => {
  const dir = xmlRel.startsWith('mutants/') ? 'ref-mut' : 'ref';
  const s = fs.readFileSync(path.join(SPIKE, dir, path.basename(xmlRel, '.xml') + '-report.xml'), 'utf8');
  const msgs = [...s.matchAll(/<rep:message [^>]*>/g)].map((m) => ({
    level: (m[0].match(/level="([a-z]+)"/) || [])[1], code: (m[0].match(/code="([^"]+)"/) || [])[1] || 'XSD',
  }));
  return { accept: /<rep:assessment>\s*<rep:accept>/.test(s), xsd: /id="val-xsd" valid="true"/.test(s), msgs };
};
const key = (msgs, level) => [...new Set(msgs.filter((m) => m.level === level && m.code !== 'XSD').map((m) => m.code))].sort().join(',');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${BASE}/?parity&test`);
await page.waitForFunction(() => '__einvoice' in window, null, { timeout: 60_000 });
let total = 0, same = 0, pictureWarnings = 0; const diffs = [];
for (const { pdf, xml } of manifest) {
  const r = refOf(xml);
  const bytes = [...fs.readFileSync(path.join(SPIKE, pdf))];
  const o = await page.evaluate(async (b) => window.__einvoice.validatePdf(new Uint8Array(b)), bytes);
  const pic = o.findings.filter((f) => f.code.startsWith('PDF-XML'));
  pictureWarnings += pic.length;
  const ruleFindings = o.findings.filter((f) => !f.code.startsWith('PDF-XML'));
  const accept = !ruleFindings.some((f) => f.level === 'error') && o.xsdValid === true;
  const eq = o.xml === fs.readFileSync(path.join(SPIKE, xml), 'utf8').replace(/^﻿/, '') &&
    r.accept === accept && r.xsd === o.xsdValid &&
    (r.xsd === false || ['error', 'warning', 'information'].every((l) => key(r.msgs, l) === key(ruleFindings.map((m) => ({ code: m.code, level: m.rawLevel })), l)));
  total++; if (eq) same++; else diffs.push({ pdf: path.basename(pdf), status: o.status, ref: { accept: r.accept, e: key(r.msgs, 'error') }, ours: { accept, e: key(ruleFindings.map((m) => ({ code: m.code, level: m.rawLevel })), 'error') } });
  if (pic.length) diffs.push({ pdf: path.basename(pdf), pictureFalseAlarm: pic.map((f) => f.code) });
}
await browser.close();
console.log(JSON.stringify({ engine: 'shipped validatePdf (browser)', total, identical: same, mismatches: total - same, pictureFalseAlarms: pictureWarnings }));
if (diffs.length) { console.error(JSON.stringify(process.env.ALL ? diffs : diffs.slice(0, 12), null, 1)); process.exit(1); }
