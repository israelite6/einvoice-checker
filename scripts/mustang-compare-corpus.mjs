// Independent reference for the EN 16931 ZUGFeRD path: Mustang validates each corpus PDF; we compare
// its XML-part verdict with our shipped engine's verdict (and KoSIT's). PDF/A results are ignored
// (the corpus PDFs are intentionally not PDF/A, and our checker makes no PDF/A claim).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';
const SPIKE = path.resolve('spike');
const MANIFEST = process.env.MANIFEST ?? 'manifest-en16931-kosit.json';
const OUTDIR = path.join(SPIKE, 'zugferd', 'mustang-' + MANIFEST.replace(/^manifest-|\.json$/g, ''));
fs.mkdirSync(OUTDIR, { recursive: true });
const manifest = JSON.parse(fs.readFileSync(path.join(SPIKE, 'zugferd', MANIFEST), 'utf8'));
const jar = path.join(SPIKE, 'vendor/zugferd/Mustang-CLI-2.26.0.jar');
for (const { pdf } of manifest) {
  const rep = path.join(OUTDIR, path.basename(pdf, '.pdf') + '.xml');
  if (!fs.existsSync(rep)) {
    let out = '';
    try { out = execFileSync('java', ['-jar', jar, '--action', 'validate', '--source', path.join(SPIKE, pdf), '--disable-file-logging'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); }
    catch (e) { out = e.stdout ?? ''; }
    fs.writeFileSync(rep, out);
  }
}
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${process.env.BASE ?? 'http://localhost:8788'}/?parity&test`);
await page.waitForFunction(() => '__einvoice' in window, null, { timeout: 60_000 });
let agree = 0; const disagree = [];
for (const { pdf, ref } of manifest) {
  const rep = fs.readFileSync(path.join(OUTDIR, path.basename(pdf, '.pdf') + '.xml'), 'utf8');
  const mXml = /<xml>[\s\S]*?<summary status="([a-z]+)"/.exec(rep)?.[1] ?? 'none';
  const kosit = /<rep:assessment>\s*<rep:accept>/.test(fs.readFileSync(path.join(SPIKE, ref), 'utf8')) ? 'valid' : 'invalid';
  const o = await page.evaluate(async (b) => window.__einvoice.validatePdf(new Uint8Array(b)), [...fs.readFileSync(path.join(SPIKE, pdf))]);
  const ours = o.findings.some((f) => f.level === 'error' && !f.picture) || o.xsdValid === false ? 'invalid' : 'valid';
  if (ours === mXml && ours === kosit) agree++;
  else disagree.push({ pdf: path.basename(pdf), mustang: mXml, kosit, ours, mustangErrors: [...rep.matchAll(/<error[^>]*>([^<]{0,120})/g)].map((m) => m[1]).slice(0, 2) });
}
await browser.close();
console.log(JSON.stringify({ corpus: MANIFEST, total: manifest.length, allThreeAgree: agree, disagreements: disagree.length }));
if (disagree.length) console.log(JSON.stringify(disagree.slice(0, 15), null, 1));
