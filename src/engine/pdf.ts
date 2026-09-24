// Reads ZUGFeRD / Factur-X PDFs in the browser: finds the embedded e-invoice XML and extracts the
// visible text (for the "picture vs XML" consistency check). Nothing is uploaded.
// pdf.js 6 contains no eval; our CSP also forbids it. XFA and scripting stay off; only attachments and text are read.
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

/** Attachment names used by ZUGFeRD 1/2, Factur-X and XRechnung-in-PDF. */
const XML_NAMES = ['factur-x.xml', 'zugferd-invoice.xml', 'xrechnung.xml', 'zugferd_invoice.xml', 'order-x.xml'];

export type Profile =
  | 'minimum' | 'basic-wl' | 'basic' | 'en16931' | 'xrechnung' | 'extended' | 'zugferd1' | 'unknown';

export interface PdfContent {
  xml: string | null;
  attachmentName: string | null;
  profile: Profile;
  /** Visible text of the first pages, for comparison with the XML. */
  text: string;
}

export class PdfUnreadable extends Error {}

/** Maps the CII guideline ID (BT-24) to a ZUGFeRD / Factur-X profile. */
export function profileOf(guidelineId: string | null): Profile {
  const id = (guidelineId ?? '').trim().toLowerCase();
  if (!id) return 'unknown';
  // ZUGFeRD 1 (older schema) first: its IDs also contain ":basic"/":extended".
  if (id.includes('ferd:crossindustrydocument:invoice:1p0')) return 'zugferd1';
  if (id.includes('xeinkauf.de:kosit:xrechnung')) return 'xrechnung';
  if (id.includes(':minimum')) return 'minimum';
  if (id.includes(':basicwl')) return 'basic-wl';
  if (id.includes(':extended')) return 'extended';
  if (id.includes(':basic')) return 'basic';
  if (id === 'urn:cen.eu:en16931:2017' || id.startsWith('urn:cen.eu:en16931:2017#compliant#urn:zugferd.de:2p')) return 'en16931';
  return 'unknown';
}

export function guidelineIdOf(xml: string): string | null {
  const m = /<(?:\w+:)?GuidelineSpecifiedDocumentContextParameter>\s*<(?:\w+:)?ID[^>]*>([^<]+)</.exec(xml);
  return m ? m[1] : null;
}

export async function readPdf(bytes: Uint8Array, maxTextPages = 6): Promise<PdfContent> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const task = pdfjs.getDocument({
    data: bytes,
    enableXfa: false,
    useSystemFonts: false,
    disableFontFace: true,
    stopAtErrors: false,
  });
  let doc;
  try {
    doc = await task.promise;
  } catch (e) {
    void task.destroy();
    throw new PdfUnreadable(String(e));
  }
  try {
    // pdf.js 6: a Map of attachment metadata by id; content is fetched separately (only for the invoice XML).
    const attachments = await doc.getAttachments();
    let xml: string | null = null;
    let attachmentName: string | null = null;
    for (const [id, a] of attachments ?? new Map()) {
      if (XML_NAMES.includes(String(a.filename).toLowerCase())) {
        const content = a.content ?? (await doc.getAttachmentContent(id));
        if (content) {
          xml = new TextDecoder('utf-8').decode(content).replace(/^\uFEFF/, '');
          attachmentName = a.filename;
          break;
        }
      }
    }
    const parts: string[] = [];
    for (let i = 1; i <= Math.min(doc.numPages, maxTextPages); i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      parts.push(content.items.map((it) => ('str' in it ? it.str : '')).join(' '));
    }
    return { xml, attachmentName, profile: xml ? profileOf(guidelineIdOf(xml)) : 'unknown', text: parts.join('\n') };
  } finally {
    void task.destroy();
  }
}
