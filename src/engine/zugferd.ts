// ZUGFeRD / Factur-X: extract the embedded XML, decide what can be checked objectively, and run the
// same official validation as for XML files. Profiles without official rules in our rule set are
// shown (readable view) but explicitly marked as not checked; we never guess a verdict.
import { compareWithPicture } from './consistency';
import { readPdf, type PdfContent, type Profile } from './pdf';
import { rulesUrl, validateInvoice, warmUp, type Step, type ValidationResult } from './validate';

/** Profiles whose XML the official EN 16931 / XRechnung rules cover. */
const CHECKABLE: Profile[] = ['en16931', 'xrechnung', 'ubl'];
/** Profiles that by design do not contain a full EN 16931 invoice. */
const INCOMPLETE: Profile[] = ['minimum', 'basic-wl'];

export interface PdfResult extends ValidationResult {
  pdf: { profile: Profile; attachment: string | null; others?: string[] };
  /** The embedded XML (for the readable view), if found. */
  xml: string | null;
}

export async function validatePdf(bytes: Uint8Array, onStep?: (step: Step) => void): Promise<PdfResult> {
  const t0 = performance.now();
  // Performance: while the PDF is parsed, load the validation engine and the CII rule files the verdict
  // needs (ZUGFeRD/Factur-X is CII). Viewer files are not needed for the verdict and are not fetched here.
  void warmUp().catch(() => undefined);
  void fetch(rulesUrl('validation/EN16931-CII-validation.sef.json')).catch(() => undefined);
  const content = await readPdf(bytes);
  const base = { scenario: null, syntax: null, xsdValid: null, findings: [] as ValidationResult['findings'] };
  const done = (r: Omit<PdfResult, 'ms'>): PdfResult => ({ ...r, ms: Math.round(performance.now() - t0) });

  if (!content.xml) {
    return done({ ...base, status: 'pdf-no-xml', pdf: { profile: 'unknown', attachment: null }, xml: null });
  }
  const pdf = { profile: content.profile, attachment: content.attachmentName, others: content.otherInvoiceAttachments };
  if (INCOMPLETE.includes(content.profile)) {
    return done({ ...base, status: 'profile-incomplete', syntax: 'cii', pdf, xml: content.xml });
  }
  if (content.profile === 'unknown') {
    // Not a recognised ZUGFeRD/Factur-X profile: try the official scenarios (e.g. plain EN 16931 CII);
    // if none applies, say so instead of guessing.
    const res = await validateInvoice(content.xml, onStep);
    if (!res.scenario) return done({ ...base, status: 'embedded-unknown', pdf, xml: content.xml });
    return done(withPicture(res, content, pdf));
  }
  if (!CHECKABLE.includes(content.profile)) {
    // ZUGFeRD 1 uses an older schema the official viewer cannot render: no readable view for it.
    const viewable = content.profile !== 'zugferd1';
    return done({ ...base, status: 'profile-unsupported', syntax: viewable ? 'cii' : null, pdf, xml: content.xml });
  }

  const res = await validateInvoice(content.xml, onStep);
  if (!res.scenario) return done({ ...res, pdf, xml: content.xml });
  return done(withPicture(res, content, pdf));
}

/** Adds the picture-vs-XML comparison (CII only) and notes about further invoice attachments. */
function withPicture(res: ValidationResult, content: PdfContent, pdf: PdfResult['pdf']): Omit<PdfResult, 'ms'> {
  const extra = res.syntax === 'cii' ? compareWithPicture(content.xml!, content.text) : [];
  const findings = [...res.findings, ...extra];
  const hasError = findings.some((f) => f.level === 'error');
  const hasWarning = findings.some((f) => f.level === 'warning');
  return { ...res, status: hasError ? 'invalid' : hasWarning ? 'valid-with-notes' : 'valid', findings, pdf, xml: content.xml };
}
