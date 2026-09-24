// Renders an e-invoice as readable HTML with the official KoSIT XRechnung visualization:
// syntax → XR intermediate format → HTML. Runs in the browser; nothing is uploaded.
import { saxon } from './saxon';
import { rulesUrl, type ValidationResult } from './validate';

const FIRST_STEP: Record<NonNullable<ValidationResult['syntax']>, string> = {
  'ubl-invoice': 'ubl-invoice-xr',
  'ubl-creditnote': 'ubl-creditnote-xr',
  cii: 'cii-xr',
};

export async function renderInvoice(xmlText: string, syntax: NonNullable<ValidationResult['syntax']>, lang: 'de' | 'en'): Promise<string> {
  const S = await saxon();
  const xr = await S.transform({
    stylesheetLocation: rulesUrl(`viz/${FIRST_STEP[syntax]}.sef.json`), sourceText: xmlText, destination: 'document',
  }, 'async');
  const html = await S.transform({
    stylesheetLocation: rulesUrl('viz/xrechnung-html.sef.json'),
    sourceNode: xr.principalResult,
    stylesheetParams: { lang },
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
