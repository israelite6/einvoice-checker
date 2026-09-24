// Downloads the official rule and visualization releases plus the SaxonJS browser runtime,
// compiles the XSLT to SaxonJS SEF, and writes everything the app loads into public/.
// Nothing produced here is committed (see .gitignore); rule logic is never modified.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { unzipSync } from 'fflate';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CACHE = path.join(ROOT, '.cache');
const OUT_RULES = path.join(ROOT, 'public/rules');
const OUT_VENDOR = path.join(ROOT, 'public/vendor');

const RELEASES = {
  config: {
    url: 'https://github.com/itplr-kosit/validator-configuration-xrechnung/releases/download/v2026-08-31/xrechnung-3.0.2-validator-configuration-2026-08-31.zip',
    label: 'KoSIT validator configuration XRechnung 3.0.2 (2026-08-31)',
  },
  viz: {
    url: 'https://github.com/itplr-kosit/xrechnung-visualization/releases/download/v2026-08-31/xrechnung-3.0.2-visualization-2026-08-31.zip',
    label: 'KoSIT XRechnung visualization 3.0.2 (2026-08-31)',
  },
  saxon: {
    url: 'https://downloads.saxonica.com/SaxonJS/2/SaxonJS-2.7.zip',
    label: 'SaxonJS 2.7 (Saxonica, freeware licence)',
  },
};

async function fetchZip(name) {
  fs.mkdirSync(CACHE, { recursive: true });
  const file = path.join(CACHE, name + '.zip');
  if (!fs.existsSync(file)) {
    const res = await fetch(RELEASES[name].url);
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  const dir = path.join(CACHE, name);
  if (!fs.existsSync(dir)) {
    for (const [p, data] of Object.entries(unzipSync(fs.readFileSync(file)))) {
      if (p.endsWith('/')) continue;
      fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true });
      fs.writeFileSync(path.join(dir, p), data);
    }
  }
  return dir;
}

function findUp(dir, name) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isFile() && e.name === name) return p;
    if (e.isDirectory()) { const r = findUp(p, name); if (r) return r; }
  }
  return null;
}

function compile(xsl, sef) {
  fs.mkdirSync(path.dirname(sef), { recursive: true });
  execFileSync(path.join(ROOT, 'node_modules/.bin/xslt3'), [`-xsl:${xsl}`, `-export:${sef}`, '-nogo', '-relocate:on'], { stdio: 'inherit' });
}

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listFiles(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}

fs.rmSync(OUT_RULES, { recursive: true, force: true });
fs.rmSync(OUT_VENDOR, { recursive: true, force: true });
fs.mkdirSync(OUT_RULES, { recursive: true });
fs.mkdirSync(OUT_VENDOR, { recursive: true });

// 1. Validation: scenarios, XSDs, schematron SEFs.
const cfgDir = path.dirname(findUp(await fetchZip('config'), 'scenarios.xml'));
const scenariosXml = fs.readFileSync(path.join(cfgDir, 'scenarios.xml'), 'utf8');
const xsl = listFiles(path.join(cfgDir, 'resources')).filter((f) => /\/xsl\/[^/]+-validation\.xsl$/.test(f));
for (const f of xsl) compile(f, path.join(OUT_RULES, 'validation', path.basename(f, '.xsl') + '.sef.json'));
const xsd = listFiles(path.join(cfgDir, 'resources')).filter((f) => f.endsWith('.xsd'))
  .map((f) => ({ fileName: path.relative(cfgDir, f), contents: fs.readFileSync(f, 'utf8') }));
fs.writeFileSync(path.join(OUT_RULES, 'scenarios.xml'), scenariosXml);
fs.writeFileSync(path.join(OUT_RULES, 'xsd.json'), JSON.stringify(xsd));
const cfgLicence = findUp(path.join(CACHE, 'config'), 'LICENSE') || findUp(path.join(CACHE, 'config'), 'LICENSE.txt');
if (cfgLicence) fs.copyFileSync(cfgLicence, path.join(OUT_RULES, 'LICENSE-kosit-validator-configuration.txt'));

// 2. Visualization: XR transforms, HTML view, and the files they read at runtime.
const vizXsl = path.dirname(findUp(await fetchZip('viz'), 'xrechnung-html.xsl'));
for (const n of ['ubl-invoice-xr', 'ubl-creditnote-xr', 'cii-xr', 'xrechnung-html']) {
  compile(path.join(vizXsl, n + '.xsl'), path.join(OUT_RULES, 'viz', n + '.sef.json'));
}
for (const f of fs.readdirSync(vizXsl)) {
  if (/\.(js|css)$/.test(f)) fs.copyFileSync(path.join(vizXsl, f), path.join(OUT_RULES, 'viz', f));
}
fs.cpSync(path.join(vizXsl, 'l10n'), path.join(OUT_RULES, 'viz', 'l10n'), { recursive: true });
const vizLicence = findUp(path.join(CACHE, 'viz'), 'LICENSE');
if (vizLicence) fs.copyFileSync(vizLicence, path.join(OUT_RULES, 'LICENSE-kosit-visualization.txt'));

// 3. Runtime: SaxonJS (freeware, shipped unmodified with its licence). libxml2/wasm is bundled by Vite.
const saxonRt = findUp(await fetchZip('saxon'), 'SaxonJS2.rt.js');
fs.copyFileSync(saxonRt, path.join(OUT_VENDOR, 'SaxonJS2.rt.js'));
fs.copyFileSync(path.join(path.dirname(saxonRt), 'LICENSE.txt'), path.join(OUT_VENDOR, 'LICENSE-SaxonJS.txt'));

fs.writeFileSync(path.join(OUT_RULES, 'manifest.json'), JSON.stringify({
  xrechnung: '3.0.2', en16931: '1.3.16', builtAt: new Date().toISOString().slice(0, 10),
  sources: Object.values(RELEASES).map((r) => r.label),
}, null, 1));
console.log('rules and vendor files written to public/');
