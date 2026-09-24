// Renders an e-invoice as readable HTML with the official KoSIT XRechnung visualization:
// syntax → XR intermediate format → HTML. Runs in the browser; nothing is uploaded.
import { saxon } from './saxon';
import type { ValidationResult } from './validate';

const FIRST_STEP: Record<NonNullable<ValidationResult['syntax']>, string> = {
  'ubl-invoice': 'ubl-invoice-xr',
  'ubl-creditnote': 'ubl-creditnote-xr',
  cii: 'cii-xr',
};

export async function renderInvoice(xmlText: string, syntax: NonNullable<ValidationResult['syntax']>, lang: 'de' | 'en'): Promise<string> {
  const S = await saxon();
  const xr = await S.transform({
    stylesheetLocation: `/rules/viz/${FIRST_STEP[syntax]}.sef.json`, sourceText: xmlText, destination: 'document',
  }, 'async');
  const html = await S.transform({
    stylesheetLocation: '/rules/viz/xrechnung-html.sef.json',
    sourceNode: xr.principalResult,
    stylesheetParams: { lang },
    destination: 'serialized',
  }, 'async');
  // The official stylesheet declares <xsl:decimal-format NaN=""/> so missing amounts render empty.
  // SaxonJS ignores that attribute and prints "NaN"; restore the intended empty output.
  return String(html.principalResult).replace(/>\s*NaN\s*</g, '><');
}
