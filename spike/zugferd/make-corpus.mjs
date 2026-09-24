// Builds ZUGFeRD / Factur-X test corpora from the official CII test files (valid + generated broken).
//   PROFILE=xrechnung (default) | en16931   re-tags the guideline ID (BT-24) for the EN 16931 profile path
//   RENDERER=kosit (default) | mustang       visible PDF from the KoSIT visualization (Chromium) or Mustang/Apache FOP
//   SUBSET=all (default) | valid            only the valid official files (for the slower Mustang renderer)
// Embedding: factur-x.xml via pdf-lib (AFRelationship Alternative). Not PDF/A: out of scope for our checker.
// Output: spike/zugferd/corpus-<profile>-<renderer>/ and manifest-<profile>-<renderer>.json
// (pdf, xml, ref: the KoSIT report to compare against).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { chromium } from '@playwright/test';
import { AFRelationship, PDFDocument } from 'pdf-lib';

const require = createRequire(import.meta.url);
const SaxonJS = require('../node_modules/saxon-js');
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const SPIKE = path.join(ROOT, 'spike');
const VIZ = path.join(ROOT, 'public/rules/viz');
const MUSTANG = path.join(SPIKE, 'vendor/zugferd/Mustang-CLI-2.26.0.jar');
const KOSIT = path.join(SPIKE, 'vendor/validator-1.6.3-standalone.jar');
const CFG = path.join(SPIKE, 'vendor/xrechnung-3.0.2-validator-configuration-2026-08-31');
const PROFILE = process.env.PROFILE ?? 'xrechnung';
const RENDERER = process.env.RENDERER ?? 'kosit';
const SUBSET = process.env.SUBSET ?? 'all';
const TAG = `${PROFILE}-${RENDERER}`;
const OUT = path.join(SPIKE, 'zugferd', `corpus-${TAG}`);
const XML_OUT = path.join(SPIKE, 'zugferd', `xml-${PROFILE}`);
const REF_OUT = path.join(SPIKE, 'zugferd', `ref-${PROFILE}`);
for (const d of [OUT, XML_OUT, REF_OUT]) fs.mkdirSync(d, { recursive: true });

const isCii = (f) => /uncefact/i.test(path.basename(f));
const valid = fs.readFileSync(path.join(SPIKE, 'testfiles.txt'), 'utf8').trim().split('\n').map((f) => path.join(SPIKE, f));
const broken = fs.readdirSync(path.join(SPIKE, 'mutants')).map((f) => path.join(SPIKE, 'mutants', f));
const sources = (SUBSET === 'valid' ? valid : [...valid, ...broken]).filter(isCii);

// 1. XML per profile (re-tagged for EN 16931) and the official KoSIT reference for exactly that XML.
const xmlFor = (src) => {
  if (PROFILE === 'xrechnung') return src;
  const out = path.join(XML_OUT, path.basename(src));
  if (!fs.existsSync(out)) {
    const xml = fs.readFileSync(src, 'utf8').replace(/(<(?:\w+:)?GuidelineSpecifiedDocumentContextParameter>\s*<(?:\w+:)?ID>)[^<]+/, '$1urn:cen.eu:en16931:2017');
    fs.writeFileSync(out, xml);
  }
  return out;
};
const xmls = sources.map(xmlFor);
const refOf = (xml) => {
  if (PROFILE === 'xrechnung') return path.join(SPIKE, xml.includes('/mutants/') ? 'ref-mut' : 'ref', path.basename(xml, '.xml') + '-report.xml');
  return path.join(REF_OUT, path.basename(xml, '.xml') + '-report.xml');
};
if (PROFILE !== 'xrechnung') {
  const todo = xmls.filter((x) => !fs.existsSync(refOf(x)));
  for (let i = 0; i < todo.length; i += 100) {
    try { execFileSync('java', ['-jar', KOSIT, '-s', path.join(CFG, 'scenarios.xml'), '-r', CFG, '-o', REF_OUT, ...todo.slice(i, i + 100)], { stdio: 'ignore' }); } catch { /* non-zero when files are rejected */ }
  }
}

// 2. Visible PDF + embedded XML.
async function renderKosit(page, xml) {
  const xr = await SaxonJS.transform({ stylesheetFileName: path.join(VIZ, 'cii-xr.sef.json'), sourceText: xml, destination: 'document' }, 'async');
  const html = await SaxonJS.transform({ stylesheetFileName: path.join(VIZ, 'xrechnung-html.sef.json'), sourceNode: xr.principalResult, stylesheetParams: { lang: 'de' }, destination: 'serialized' }, 'async');
  await page.setContent(String(html.principalResult).replace(/>\s*NaN\s*</g, '><'), { waitUntil: 'load' });
  return page.pdf({ format: 'A4', printBackground: true });
}
function renderMustang(xmlPath, name) {
  const tmp = path.join(OUT, name + '.render.pdf');
  execFileSync('java', ['-jar', MUSTANG, '--action', 'pdf', '--language', 'de', '--source', xmlPath, '--out', tmp, '--disable-file-logging'], { stdio: 'ignore' });
  const bytes = fs.readFileSync(tmp);
  fs.rmSync(tmp);
  return bytes;
}

const browser = RENDERER === 'kosit' ? await chromium.launch() : null;
const page = browser ? await browser.newPage() : null;
const manifest = [];
let failed = 0;
for (const xmlPath of xmls) {
  const name = path.basename(xmlPath, '.xml');
  const out = path.join(OUT, name + '.pdf');
  if (!fs.existsSync(out)) {
    try {
      const xml = fs.readFileSync(xmlPath, 'utf8');
      const visual = RENDERER === 'kosit' ? await renderKosit(page, xml) : renderMustang(xmlPath, name);
      const doc = await PDFDocument.load(visual);
      await doc.attach(Buffer.from(xml, 'utf8'), 'factur-x.xml', { mimeType: 'text/xml', description: 'Factur-X/ZUGFeRD invoice', afRelationship: AFRelationship.Alternative });
      fs.writeFileSync(out, await doc.save());
    } catch (e) {
      failed++;
      console.error('FAILED', name, String(e).slice(0, 160));
      continue;
    }
  }
  manifest.push({ pdf: path.relative(SPIKE, out), xml: path.relative(SPIKE, xmlPath), ref: path.relative(SPIKE, refOf(xmlPath)) });
}
await browser?.close();
fs.writeFileSync(path.join(SPIKE, 'zugferd', `manifest-${TAG}.json`), JSON.stringify(manifest, null, 1));
console.log(JSON.stringify({ tag: TAG, sources: sources.length, built: manifest.length, failed }));
