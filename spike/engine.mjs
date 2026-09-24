// Feasibility spike: validate XRechnung files with the official KoSIT configuration,
// using SaxonJS (schematron XSLT) and libxml2/wasm (XSD), with no Java and no server.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { validateXML } from 'xmllint-wasm';

const require = createRequire(import.meta.url);
const SaxonJS = require('saxon-js');

const HERE = path.dirname(new URL(import.meta.url).pathname);
export const CONFIG_DIR = path.join(HERE, 'vendor/xrechnung-3.0.2-validator-configuration-2026-08-31');
const BUILD_DIR = path.join(HERE, 'build');

const SVRL_LEVEL = { fatal: 'error', error: 'error', warning: 'warning', information: 'information' };

// Parse scenarios.xml once: namespaces, match expression, XSD, schematron steps, custom levels.
async function loadScenarios() {
  const xml = fs.readFileSync(path.join(CONFIG_DIR, 'scenarios.xml'), 'utf8');
  const doc = await SaxonJS.getResource({ text: xml, type: 'xml' });
  const ns = { s: 'http://www.xoev.de/de/validator/framework/1/scenarios' };
  const ev = (xp, ctx) => SaxonJS.XPath.evaluate(xp, ctx, { namespaceContext: ns, resultForm: 'array' });
  return ev('//s:scenario', doc).map((sc) => {
    const namespaces = {};
    for (const n of ev('s:namespace', sc)) namespaces[n.getAttribute('prefix')] = n.textContent.trim();
    return {
      name: ev('string(s:name)', sc)[0],
      namespaces,
      match: ev('string(s:match)', sc)[0].trim(),
      xsd: ev('string(s:validateWithXmlSchema/s:resource/s:location)', sc)[0].trim(),
      schematron: ev('s:validateWithSchematron/s:resource/s:location', sc).map((l) => l.textContent.trim()),
      customLevels: Object.fromEntries(ev('s:createReport/s:customLevel', sc).map((c) => [c.textContent.trim(), c.getAttribute('level')])),
    };
  });
}

export const SCENARIOS = await loadScenarios();

// All XSDs are preloaded into the wasm filesystem with their relative paths so imports resolve.
function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listFiles(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}
export const XSD_FILES = listFiles(path.join(CONFIG_DIR, 'resources')).filter((f) => f.endsWith('.xsd'))
  .map((f) => ({ fileName: path.relative(CONFIG_DIR, f), contents: fs.readFileSync(f, 'utf8') }));

function sefFor(xslLocation) {
  return path.join(BUILD_DIR, path.basename(xslLocation, '.xsl') + '.sef.json');
}

export async function validate(xmlText) {
  const timings = {};
  let t = performance.now();
  const doc = await SaxonJS.getResource({ text: xmlText, type: 'xml' });
  const scenario = SCENARIOS.find((sc) =>
    SaxonJS.XPath.evaluate(sc.match, doc, { namespaceContext: sc.namespaces }));
  timings.detect = performance.now() - t;
  if (!scenario) return { scenario: null, accept: false, xsdValid: null, messages: [], timings };

  t = performance.now();
  const xsd = await validateXML({
    xml: [{ fileName: 'input.xml', contents: xmlText }],
    schema: [XSD_FILES.find((f) => f.fileName === scenario.xsd)],
    preload: XSD_FILES.filter((f) => f.fileName !== scenario.xsd),
  });
  timings.xsd = performance.now() - t;

  const messages = [];
  if (!xsd.valid) for (const e of xsd.errors) messages.push({ code: 'XSD', level: 'error', rawLevel: 'error', text: e.message || e.rawMessage });

  // KoSIT runs schematron only on schema-valid documents.
  if (xsd.valid) {
    for (const loc of scenario.schematron) {
      t = performance.now();
      const res = await SaxonJS.transform({
        stylesheetFileName: sefFor(loc), sourceText: xmlText, destination: 'document',
      }, 'async');
      timings[path.basename(loc, '.xsl')] = performance.now() - t;
      const svrl = { svrl: 'http://purl.oclc.org/dsdl/svrl' };
      for (const fa of SaxonJS.XPath.evaluate('//svrl:failed-assert | //svrl:successful-report', res.principalResult, { namespaceContext: svrl, resultForm: 'array' })) {
        const code = fa.getAttribute('id');
        // rawLevel is the rule's own severity; level applies the scenario's customLevel override (used for the verdict and UI).
        const rawLevel = SVRL_LEVEL[fa.getAttribute('flag')] || 'error';
        const level = scenario.customLevels[code] || rawLevel;
        messages.push({ code, level, rawLevel, text: SaxonJS.XPath.evaluate('normalize-space(svrl:text)', fa, { namespaceContext: svrl }) });
      }
    }
  }
  const accept = xsd.valid && !messages.some((m) => m.level === 'error');
  return { scenario: scenario.name, accept, xsdValid: xsd.valid, messages, timings };
}
