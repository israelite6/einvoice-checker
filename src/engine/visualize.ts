// Renders an e-invoice as readable HTML with the official KoSIT XRechnung visualization:
// syntax → XR intermediate format → HTML. Runs in the browser; nothing is uploaded.
import { saxon } from './saxon';
import { rulesUrl, type ValidationResult } from './validate';

const FIRST_STEP: Record<NonNullable<ValidationResult['syntax']>, string> = {
  'ubl-invoice': 'ubl-invoice-xr',
  'ubl-creditnote': 'ubl-creditnote-xr',
  cii: 'cii-xr',
};

// Files the official viewer reads at runtime (unparsed-text / doc). SaxonJS would fetch them with
// synchronous requests, which bypass the service worker; we fetch them ourselves (SW-cached, so this
// works offline) and hand them to SaxonJS as resource pools keyed by their absolute URL.
const VIEWER_TEXT = ['xrechnung-viewer.css', 'FileSaver-v2.0.5.js', 'xrechnung-viewer.js'];
const VIEWER_DOCS = ['l10n/de.xml', 'l10n/en.xml'];
let pools: Promise<{ text: Record<string, string>; docs: Record<string, unknown> }> | null = null;

function viewerPools() {
  pools ??= (async () => {
    const S = await saxon();
    const base = new URL('/rules/viz/', location.origin);
    const get = async (f: string) => {
      const r = await fetch(new URL(f, base));
      if (!r.ok) throw new Error(`${f}: ${r.status}`);
      return r.text();
    };
    const text = Object.fromEntries(await Promise.all(VIEWER_TEXT.map(async (f) => [new URL(f, base).href, await get(f)])));
    const docs = Object.fromEntries(await Promise.all(VIEWER_DOCS.map(async (f) => [new URL(f, base).href, await S.getResource({ text: await get(f), type: 'xml' })])));
    return { text, docs };
  })();
  pools.catch(() => { pools = null; });
  return pools;
}

export async function renderInvoice(xmlText: string, syntax: NonNullable<ValidationResult['syntax']>, lang: 'de' | 'en'): Promise<string> {
  const S = await saxon();
  const { text, docs } = await viewerPools();
  const xr = await S.transform({
    stylesheetLocation: rulesUrl(`viz/${FIRST_STEP[syntax]}.sef.json`), sourceText: xmlText, destination: 'document',
  }, 'async');
  const html = await S.transform({
    stylesheetLocation: rulesUrl('viz/xrechnung-html.sef.json'),
    sourceNode: xr.principalResult,
    stylesheetParams: { lang },
    textResourcePool: text,
    documentPool: docs,
    destination: 'serialized',
  }, 'async');
  // The official stylesheet declares <xsl:decimal-format NaN=""/> so missing amounts render empty.
  // SaxonJS ignores that attribute and prints "NaN"; restore the intended empty output. This only
  // touches text nodes that are exactly "NaN" (a formatted empty amount), never other content.
  return cleanNaN(String(html.principalResult));
}

/** Blanks text nodes that are exactly "NaN" (formatted empty amounts); leaves all other content untouched. */
export function cleanNaN(html: string): string {
  return html.replace(/>\s*NaN\s*</g, '><');
}
