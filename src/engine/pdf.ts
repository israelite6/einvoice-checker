// Reads ZUGFeRD / Factur-X PDFs in the browser: finds the embedded e-invoice XML and extracts the
// visible text (for the "picture vs XML" consistency check). Nothing is uploaded.
// pdf.js 6 contains no eval; our CSP also forbids it. XFA and scripting stay off; only attachments and text are read.
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { decodeXml } from '../files';
import { EngineError } from './validate';

/** Standard attachment names (ZUGFeRD 1/2, Factur-X, XRechnung-in-PDF), in order of preference. */
const XML_NAMES = ['factur-x.xml', 'zugferd-invoice.xml', 'xrechnung.xml', 'zugferd_invoice.xml'];
/** Embedded invoice XML larger than this is not processed (decompression-bomb guard). */
const MAX_XML_BYTES = 10 * 1024 * 1024;
/** Visible text is read from at most this many pages (long invoices have totals on later pages). */
const MAX_TEXT_PAGES = 50;
const PARSE_TIMEOUT_MS = 30_000;

export type Profile =
  | 'minimum' | 'basic-wl' | 'basic' | 'en16931' | 'xrechnung' | 'extended' | 'zugferd1' | 'ubl' | 'unknown';

export interface PdfContent {
  xml: string | null;
  attachmentName: string | null;
  /** Other invoice-like XML attachments that were not used (reported to the user). */
  otherInvoiceAttachments: string[];
  profile: Profile;
  /** Visible text of the pages, for comparison with the XML. */
  text: string;
}

/** The file itself is not a readable PDF (damaged, not a PDF, or password-protected). */
export class PdfUnreadable extends Error {}
/** Processing took too long (slow device or a hostile file); says nothing about the file being damaged. */
export class PdfTimeout extends Error {}
/** An embedded invoice XML exceeds the size limit (declared or actual); it is not unpacked. */
export class PdfAttachmentTooLarge extends Error {}

/** Largest uncompressed size declared by embedded files that could be the invoice XML, read without unpacking.
 *  Only XML candidates count (an .xml file name in the file specification, or an XML subtype on the stream):
 *  Factur-X allows other large attachments (e.g. a scanned delivery note), which must not be rejected.
 *  Embedded-file stream dictionaries cannot live inside compressed object streams, so they are plain text;
 *  anything not visible here (e.g. indirect sizes) falls back to the check after unpacking. */
export function maxDeclaredXmlAttachmentSize(bytes: Uint8Array): number {
  const text = new TextDecoder('latin1').decode(bytes);
  // Object numbers of embedded-file streams referenced by an .xml file specification.
  const xmlRefs = new Set<string>();
  for (const m of text.matchAll(/<<((?:(?!<<|>>)[\s\S]){0,600}?\/(?:UF|F)\s*\((?:[^)\\]|\\.)*\.xml\)(?:(?!>>)[\s\S]){0,600}?)>>/gi)) {
    const ef = /\/EF\s*<<[^>]*?\/(?:F|UF)\s+(\d+)\s+\d+\s+R/.exec(m[0]) ?? /\/(?:F|UF)\s+(\d+)\s+\d+\s+R/.exec(m[1]);
    if (ef) xmlRefs.add(ef[1]);
  }
  // Also catch EF dictionaries that follow the file-spec string (common layout).
  for (const m of text.matchAll(/\/(?:UF|F)\s*\((?:[^)\\]|\\.)*\.xml\)[\s\S]{0,300}?\/EF\s*<<[^>]*?\/(?:F|UF)\s+(\d+)\s+\d+\s+R/gi)) xmlRefs.add(m[1]);
  let max = 0;
  for (const m of text.matchAll(/(\d+)\s+\d+\s+obj\s*<<([\s\S]{0,1200}?)>>\s*stream/g)) {
    const [, num, dict] = m;
    if (!/\/Type\s*\/EmbeddedFile/.test(dict)) continue;
    const xmlish = xmlRefs.has(num) || /\/Subtype\s*\/(?:text|application)#2F(?:[a-z.+-]*\+)?xml\b/i.test(dict);
    if (!xmlish) continue;
    const size = /\/Params\s*<<[^>]*?\/Size\s+(\d+)/.exec(dict);
    if (size) max = Math.max(max, Number(size[1]));
  }
  return max;
}

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

/** The document element's start tag, skipping the XML declaration, comments and processing instructions. */
function rootTag(xml: string): string {
  const head = xml.slice(0, 65536).replace(/<\?[\s\S]*?\?>/g, '').replace(/<!--[\s\S]*?-->/g, '');
  return /<[^!?][^>]*>/.exec(head)?.[0] ?? '';
}

/** Profile of an embedded XML: CII by guideline ID; UBL invoices are recognised as such. */
export function embeddedProfile(xml: string): Profile {
  if (/^<(?:\w+:)?(Invoice|CreditNote)\b[^>]*urn:oasis:names:specification:ubl/.test(rootTag(xml))) return 'ubl';
  return profileOf(guidelineIdOf(xml));
}

const looksLikeInvoice = (xml: string) => /^<(?:\w+:)?(CrossIndustryInvoice|CrossIndustryDocument|Invoice|CreditNote)\b/.test(rootTag(xml));

/** pdf.js error classes that mean "this file is not a readable PDF", as opposed to an engine failure. */
function isFileError(e: unknown): boolean {
  const name = (e as { name?: string })?.name ?? '';
  return name === 'InvalidPDFException' || name === 'PasswordException' || name === 'FormatError';
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new PdfTimeout('timeout')), ms); });
  try { return await Promise.race([p, timeout]); } finally { clearTimeout(timer); }
}

/** Loads pdf.js; a failure here (offline, blocked) is an engine problem, never a verdict on the file. */
async function loadPdfJs() {
  try {
    const pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    return pdfjs;
  } catch (e) {
    throw new EngineError(String(e), true);
  }
}

/** Fetches pdf.js and its worker ahead of time (offline cache, faster first PDF check). */
export function prefetchPdfEngine(): void {
  void import('pdfjs-dist').catch(() => undefined);
  void fetch(workerUrl).catch(() => undefined);
  // import() does not request a module again once loaded. If pdf.js loaded before the service worker took
  // control, fetch it by URL so it also lands in the offline cache.
  for (const e of performance.getEntriesByType('resource')) {
    if (/\/assets\/pdf-[^/]*\.js$/.test(new URL(e.name).pathname)) void fetch(e.name).catch(() => undefined);
  }
}

export async function readPdf(bytes: Uint8Array): Promise<PdfContent> {
  // Decompression-bomb guard before anything is unpacked.
  if (maxDeclaredXmlAttachmentSize(bytes) > MAX_XML_BYTES) throw new PdfAttachmentTooLarge('declared size');
  // Download the worker while the pdf.js module loads (otherwise it starts only after the module is ready).
  void fetch(workerUrl).catch(() => undefined);
  const pdfjs = await loadPdfJs();
  const task = pdfjs.getDocument({ data: bytes, enableXfa: false, useSystemFonts: false, disableFontFace: true, stopAtErrors: false });
  let doc;
  try {
    doc = await withTimeout(task.promise, PARSE_TIMEOUT_MS);
  } catch (e) {
    void task.destroy();
    if (e instanceof PdfTimeout) throw e;
    if (isFileError(e)) throw new PdfUnreadable(String(e));
    throw new EngineError(String(e)); // worker failed to start, etc.
  }
  try {
    return await withTimeout((async () => {
      // pdf.js 6: a Map of attachment metadata by id; content is fetched separately.
      const attachments = [...((await doc.getAttachments()) ?? new Map())];
      const candidates: { name: string; xml: string }[] = [];
      for (const [id, a] of attachments) {
        const name = String(a.filename);
        if (!name.toLowerCase().endsWith('.xml')) continue;
        const content = a.content ?? (await doc.getAttachmentContent(id));
        if (!content) continue;
        if (content.length > MAX_XML_BYTES) throw new PdfAttachmentTooLarge('actual size');
        const xml = decodeXml(content);
        if (looksLikeInvoice(xml)) candidates.push({ name, xml });
      }
      // Prefer the standard names; otherwise any invoice-like XML attachment.
      candidates.sort((x, y) => rank(x.name) - rank(y.name));
      const chosen = candidates[0] ?? null;
      const parts: string[] = [];
      for (let i = 1; i <= Math.min(doc.numPages, MAX_TEXT_PAGES); i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        parts.push(content.items.map((it) => ('str' in it ? it.str : '')).join(' '));
      }
      return {
        xml: chosen?.xml ?? null,
        attachmentName: chosen?.name ?? null,
        otherInvoiceAttachments: candidates.slice(1).map((c) => c.name),
        profile: chosen ? embeddedProfile(chosen.xml) : 'unknown',
        text: parts.join('\n'),
      };
    })(), PARSE_TIMEOUT_MS);
  } finally {
    void task.destroy();
  }
}

function rank(name: string): number {
  const i = XML_NAMES.indexOf(name.toLowerCase());
  return i < 0 ? XML_NAMES.length : i;
}
