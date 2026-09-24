// ZUGFeRD / Factur-X: extract the embedded XML, decide what can be checked objectively, and run the
// same official validation as for XML files. Profiles without official rules in our rule set are
// shown (readable view) but explicitly marked as not checked; we never guess a verdict.
import { compareWithPicture } from './consistency';
import { readPdf, type Profile } from './pdf';
import { validateInvoice, type Step, type ValidationResult } from './validate';

/** Profiles whose XML the official EN 16931 / XRechnung rules cover. */
const CHECKABLE: Profile[] = ['en16931', 'xrechnung'];
/** Profiles that by design do not contain a full EN 16931 invoice. */
const INCOMPLETE: Profile[] = ['minimum', 'basic-wl'];

export interface PdfResult extends ValidationResult {
  pdf: { profile: Profile; attachment: string | null };
  /** The embedded XML (for the readable view), if found. */
  xml: string | null;
}

export async function validatePdf(bytes: Uint8Array, onStep?: (step: Step) => void): Promise<PdfResult> {
  const t0 = performance.now();
  const content = await readPdf(bytes);
  const base = { scenario: null, syntax: null, xsdValid: null, findings: [] as ValidationResult['findings'] };
  const done = (r: Omit<PdfResult, 'ms'>): PdfResult => ({ ...r, ms: Math.round(performance.now() - t0) });

  if (!content.xml) {
    return done({ ...base, status: 'pdf-no-xml', pdf: { profile: 'unknown', attachment: null }, xml: null });
  }
  const pdf = { profile: content.profile, attachment: content.attachmentName };
  if (INCOMPLETE.includes(content.profile)) {
    return done({ ...base, status: 'profile-incomplete', syntax: 'cii', pdf, xml: content.xml });
  }
  if (!CHECKABLE.includes(content.profile)) {
    // ZUGFeRD 1 uses an older schema the official viewer cannot render: no readable view for it.
    const viewable = content.profile !== 'zugferd1' && content.profile !== 'unknown';
    return done({ ...base, status: 'profile-unsupported', syntax: viewable ? 'cii' : null, pdf, xml: content.xml });
  }

  const res = await validateInvoice(content.xml, onStep);
  if (!res.scenario) return done({ ...res, pdf, xml: content.xml });
  const picture = compareWithPicture(content.xml, content.text);
  const findings = [...res.findings, ...picture];
  const hasError = findings.some((f) => f.level === 'error');
  const hasWarning = findings.some((f) => f.level === 'warning');
  return done({
    ...res,
    status: hasError ? 'invalid' : hasWarning ? 'valid-with-notes' : 'valid',
    findings,
    pdf,
    xml: content.xml,
  });
}
