// Validates an XRechnung / EN 16931 XML invoice entirely in the browser, following the official
// KoSIT validator configuration (scenarios.xml): XML Schema, then EN 16931 and XRechnung schematron.
// Parity with the official Java validator: 678/678 files (spike/RESULTS.md).
import { saxon, type SaxonNode } from './saxon';

export type Level = 'error' | 'warning' | 'information';

export interface Finding {
  code: string;
  /** Severity after the scenario's customLevel overrides (drives the verdict and the UI). */
  level: Level;
  /** The rule's own severity, as the official KoSIT report lists it (used for parity tests). */
  rawLevel: Level;
  text: string;
  location?: string;
  /** Picture-vs-XML comparison (not an official rule), shown under its own heading. */
  picture?: boolean;
  /** The XML value a picture-vs-XML finding refers to. */
  value?: string;
}

/** The checker itself could not load (network/offline), as opposed to a problem with the user's file.
 *  `reload` means a code module failed to load: browsers keep that failure until the page is reloaded. */
export class EngineError extends Error {
  readonly reload: boolean;
  constructor(message: string, reload = false) {
    super(message);
    this.reload = reload;
  }
}

/** Versioned URL for rule files, so returning users receive rule updates (cache key changes per release). */
export const rulesUrl = (path: string) => `/rules/${path}?v=${__RULES_VERSION__}`;

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

export interface ValidationResult {
  status: 'valid' | 'valid-with-notes' | 'invalid' | 'unsupported' | 'not-xml'
    | 'pdf-no-xml' | 'pdf-unreadable' | 'profile-incomplete' | 'profile-unsupported' | 'embedded-unknown';
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
    fetch(rulesUrl('scenarios.xml')).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.text(); }),
    fetch(rulesUrl('xsd.json')).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<XsdFile[]>; }),
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
export function warmUp(): Promise<unknown> {
  if (!config) {
    config = loadConfig();
    config.catch(() => { config = null; });
    // Fetch the schema validator (module + wasm) in parallel; failures surface later as EngineError.
    import('xmllint-wasm').catch(() => undefined);
  }
  return config;
}

function sefUrl(xslLocation: string): string {
  return rulesUrl('validation/' + xslLocation.split('/').pop()!.replace(/\.xsl$/, '.sef.json'));
}

function syntaxOf(scenarioName: string): ValidationResult['syntax'] {
  if (scenarioName.includes('CII')) return 'cii';
  if (scenarioName.includes('CreditNote')) return 'ubl-creditnote';
  return 'ubl-invoice';
}

export type Step = 'schema' | 'en16931' | 'xrechnung';

export async function validateInvoice(xmlText: string, onStep?: (step: Step) => void): Promise<ValidationResult> {
  const t0 = performance.now();
  let S: Awaited<ReturnType<typeof saxon>>;
  let scenarios: Scenario[];
  let xsd: XsdFile[];
  try {
    S = await saxon();
    ({ scenarios, xsd } = await (warmUp() as NonNullable<typeof config>));
  } catch (e) {
    throw new EngineError(String(e));
  }
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
  await tick();
  // Loaded on demand; the package brings its own Web Worker and wasm binary (bundled by Vite).
  let validateXML: typeof import('xmllint-wasm').validateXML;
  try {
    ({ validateXML } = await import('xmllint-wasm'));
  } catch (e) {
    throw new EngineError(String(e));
  }
  const schemaResult = await validateXML({
    xml: [{ fileName: 'invoice.xml', contents: xmlText }],
    schema: [xsd.find((f) => f.fileName === scenario.xsd)!],
    preload: xsd.filter((f) => f.fileName !== scenario.xsd),
  });

  const findings: Finding[] = [];
  if (!schemaResult.valid) {
    for (const e of schemaResult.errors) {
      findings.push({ code: 'XSD', level: 'error', rawLevel: 'error', text: e.message, location: e.loc ? `line ${e.loc.lineNumber}` : undefined });
    }
  } else {
    // The official validator runs schematron only on schema-valid documents.
    for (const loc of scenario.schematron) {
      onStep?.(loc.includes('XRechnung') ? 'xrechnung' : 'en16931');
      await tick();
      let res: { principalResult: unknown };
      try {
        res = await S.transform({ stylesheetLocation: sefUrl(loc), sourceText: xmlText, destination: 'document' }, 'async');
      } catch (e) {
        // A rule file that fails to load is an engine problem, never a verdict about the user's file.
        if (/fetch|network|load|404|Failed/i.test(String(e))) throw new EngineError(String(e));
        throw e;
      }
      const nodes = S.XPath.evaluate('//svrl:failed-assert | //svrl:successful-report', res.principalResult, { namespaceContext: SVRL, resultForm: 'array' }) as SaxonNode[];
      for (const n of nodes) {
        const code = n.getAttribute('id') ?? '?';
        const rawLevel = SVRL_LEVEL[n.getAttribute('flag') ?? ''] ?? 'error';
        findings.push({
          code,
          level: scenario.customLevels[code] ?? rawLevel,
          rawLevel,
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
