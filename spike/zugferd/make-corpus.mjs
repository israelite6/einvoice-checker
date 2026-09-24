// Builds a ZUGFeRD / Factur-X test corpus from the official CII test files (valid + generated broken):
// XML -> official KoSIT visualization (HTML) -> PDF (Chromium) -> factur-x.xml embedded with pdf-lib
// (AFRelationship Alternative, as Factur-X/ZUGFeRD 2 specify). Not PDF/A: PDF/A conformance is out of scope
// for our checker; Mustang is used as the independent reference for the XML part.
// Output: spike/zugferd/corpus/<name>.pdf and a manifest with the source XML path per PDF.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from '@playwright/test';
import { AFRelationship, PDFDocument } from 'pdf-lib';

const require = createRequire(import.meta.url);
const SaxonJS = require('../node_modules/saxon-js');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const SPIKE = path.join(ROOT, 'spike');
const VIZ = path.join(ROOT, 'public/rules/viz');
const OUT = path.join(SPIKE, 'zugferd/corpus');
fs.mkdirSync(OUT, { recursive: true });

const isCii = (f) => /uncefact/i.test(path.basename(f));
const sources = [
  ...fs.readFileSync(path.join(SPIKE, 'testfiles.txt'), 'utf8').trim().split('\n').map((f) => path.join(SPIKE, f)),
  ...fs.readdirSync(path.join(SPIKE, 'mutants')).map((f) => path.join(SPIKE, 'mutants', f)),
].filter(isCii);

async function render(xml) {
  const xr = await SaxonJS.transform({ stylesheetFileName: path.join(VIZ, 'cii-xr.sef.json'), sourceText: xml, destination: 'document' }, 'async');
  const html = await SaxonJS.transform({ stylesheetFileName: path.join(VIZ, 'xrechnung-html.sef.json'), sourceNode: xr.principalResult, stylesheetParams: { lang: 'de' }, destination: 'serialized' }, 'async');
  return String(html.principalResult).replace(/>\s*NaN\s*</g, '><');
}

const browser = await chromium.launch();
const page = await browser.newPage();
const manifest = [];
let n = 0, failed = 0;
for (const src of sources) {
  const name = path.basename(src, '.xml');
  const out = path.join(OUT, name + '.pdf');
  if (!fs.existsSync(out)) {
    try {
      const xml = fs.readFileSync(src, 'utf8');
      await page.setContent(await render(xml), { waitUntil: 'load' });
      const visual = await page.pdf({ format: 'A4', printBackground: true });
      const doc = await PDFDocument.load(visual);
      await doc.attach(Buffer.from(xml, 'utf8'), 'factur-x.xml', { mimeType: 'text/xml', description: 'Factur-X/ZUGFeRD invoice', afRelationship: AFRelationship.Alternative });
      fs.writeFileSync(out, await doc.save());
    } catch (e) {
      failed++;
      console.error('FAILED', name, String(e).slice(0, 200));
      continue;
    }
  }
  manifest.push({ pdf: path.relative(SPIKE, out), xml: path.relative(SPIKE, src) });
  if (++n % 25 === 0) console.log(n, 'of', sources.length);
}
await browser.close();
fs.writeFileSync(path.join(SPIKE, 'zugferd/manifest.json'), JSON.stringify(manifest, null, 1));
console.log(JSON.stringify({ sources: sources.length, built: manifest.length, failed }));
