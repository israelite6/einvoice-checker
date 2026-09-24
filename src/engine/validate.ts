// Validates an XRechnung / EN 16931 XML invoice entirely in the browser, following the official
// KoSIT validator configuration (scenarios.xml): XML Schema, then EN 16931 and XRechnung schematron.
// Parity with the official Java validator: 678/678 files (spike/RESULTS.md).
import { saxon, type SaxonNode } from './saxon';

export type Level = 'error' | 'warning' | 'information';

export interface Finding {
  code: string;
  level: Level;
  text: string;
  location?: string;
}

export interface ValidationResult {
  status: 'valid' | 'valid-with-notes' | 'invalid' | 'unsupported' | 'not-xml';
  scenario: string | null;
  syntax: 'ubl-invoice' | 'ubl-creditnote' | 'cii' | null;
  xsdValid: boolean | null;
  findings: Finding[];
  ms: number;
}

interface Scenario {
  name: string;
  namespaces: Record<string, string>;
  match: string;
  xsd: string;
  schematron: string[];
  customLevels: Record<string, Level>;
}

interface XsdFile { fileName: string; contents: string }

const SVRL_LEVEL: Record<string, Level> = { fatal: 'error', error: 'error', warning: 'warning', information: 'information' };
const SCN = { s: 'http://www.xoev.de/de/validator/framework/1/scenarios' };
const SVRL = { svrl: 'http://purl.oclc.org/dsdl/svrl' };

let config: Promise<{ scenarios: Scenario[]; xsd: XsdFile[] }> | null = null;

async function loadConfig() {
  const S = await saxon();
  const [scenariosXml, xsd] = await Promise.all([
    fetch('/rules/scenarios.xml').then((r) => r.text()),
    fetch('/rules/xsd.json').then((r) => r.json() as Promise<XsdFile[]>),
  ]);
  const doc = await S.getResource({ text: scenariosXml, type: 'xml' });
  const ev = (xp: string, ctx: unknown) => S.XPath.evaluate(xp, ctx, { namespaceContext: SCN, resultForm: 'array' }) as SaxonNode[];
  const str = (xp: string, ctx: unknown) => String(S.XPath.evaluate(`string(${xp})`, ctx, { namespaceContext: SCN })).trim();
  const scenarios = ev('//s:scenario', doc).map((sc) => ({
    name: str('s:name', sc),
    namespaces: Object.fromEntries(ev('s:namespace', sc).map((n) => [n.getAttribute('prefix') ?? '', (n.textContent ?? '').trim()])),
    match: str('s:match', sc),
    xsd: str('s:validateWithXmlSchema/s:resource/s:location', sc),
    schematron: ev('s:validateWithSchematron/s:resource/s:location', sc).map((l) => (l.textContent ?? '').trim()),
    customLevels: Object.fromEntries(ev('s:createReport/s:customLevel', sc).map((c) => [(c.textContent ?? '').trim(), c.getAttribute('level') as Level])),
  }));
  return { scenarios, xsd };
}

/** Starts loading the engine in the background so the first check is fast. */
export function warmUp(): void {
  config ??= loadConfig();
}

function sefUrl(xslLocation: string): string {
  return '/rules/validation/' + xslLocation.split('/').pop()!.replace(/\.xsl$/, '.sef.json');
}

function syntaxOf(scenarioName: string): ValidationResult['syntax'] {
  if (scenarioName.includes('CII')) return 'cii';
  if (scenarioName.includes('CreditNote')) return 'ubl-creditnote';
  return 'ubl-invoice';
}

export type Step = 'schema' | 'en16931' | 'xrechnung';

export async function validateInvoice(xmlText: string, onStep?: (step: Step) => void): Promise<ValidationResult> {
  const t0 = performance.now();
  const S = await saxon();
  warmUp();
  const { scenarios, xsd } = await config!;
  const done = (r: Omit<ValidationResult, 'ms'>): ValidationResult => ({ ...r, ms: Math.round(performance.now() - t0) });

  let doc: unknown;
  try {
    doc = await S.getResource({ text: xmlText, type: 'xml' });
  } catch {
    return done({ status: 'not-xml', scenario: null, syntax: null, xsdValid: null, findings: [] });
  }
  const scenario = scenarios.find((sc) => Boolean(S.XPath.evaluate(sc.match, doc, { namespaceContext: sc.namespaces })));
  if (!scenario) return done({ status: 'unsupported', scenario: null, syntax: null, xsdValid: null, findings: [] });

  onStep?.('schema');
  // Loaded on demand; the package brings its own Web Worker and wasm binary (bundled by Vite).
  const { validateXML } = await import('xmllint-wasm');
  const schemaResult = await validateXML({
    xml: [{ fileName: 'invoice.xml', contents: xmlText }],
    schema: [xsd.find((f) => f.fileName === scenario.xsd)!],
    preload: xsd.filter((f) => f.fileName !== scenario.xsd),
  });

  const findings: Finding[] = [];
  if (!schemaResult.valid) {
    for (const e of schemaResult.errors) {
      findings.push({ code: 'XSD', level: 'error', text: e.message, location: e.loc ? `Zeile ${e.loc.lineNumber}` : undefined });
    }
  } else {
    // The official validator runs schematron only on schema-valid documents.
    for (const loc of scenario.schematron) {
      onStep?.(loc.includes('XRechnung') ? 'xrechnung' : 'en16931');
      const res = await S.transform({ stylesheetLocation: sefUrl(loc), sourceText: xmlText, destination: 'document' }, 'async');
      const nodes = S.XPath.evaluate('//svrl:failed-assert | //svrl:successful-report', res.principalResult, { namespaceContext: SVRL, resultForm: 'array' }) as SaxonNode[];
      for (const n of nodes) {
        const code = n.getAttribute('id') ?? '?';
        findings.push({
          code,
          level: scenario.customLevels[code] ?? SVRL_LEVEL[n.getAttribute('flag') ?? ''] ?? 'error',
          text: String(S.XPath.evaluate('normalize-space(svrl:text)', n, { namespaceContext: SVRL })),
          location: n.getAttribute('location') ?? undefined,
        });
      }
    }
  }
  const hasError = findings.some((f) => f.level === 'error');
  // Information-level findings are recommendations; only warnings change the headline.
  const hasNotes = findings.some((f) => f.level === 'warning');
  return done({
    status: hasError ? 'invalid' : hasNotes ? 'valid-with-notes' : 'valid',
    scenario: scenario.name,
    syntax: syntaxOf(scenario.name),
    xsdValid: schemaResult.valid,
    findings,
  });
}
