// "Picture vs XML": for hybrid invoices (ZUGFeRD / Factur-X) the XML is legally authoritative
// (BMF FAQ, question 12a). This objective check looks for key XML values in the PDF's visible text
// and reports values that do not appear, so the recipient can see where the picture may differ.
import type { Finding } from './validate';

export interface KeyField { code: string; value: string; variants: string[] }

const first = (xml: string, re: RegExp) => re.exec(xml)?.[1]?.trim() ?? null;

/** All common ways an amount may be printed (German and English grouping, with/without grouping). */
export function amountVariants(v: string): string[] {
  const n = Number(v);
  if (!Number.isFinite(n)) return [v];
  const fixed = n.toFixed(2);
  const [int, dec] = fixed.split('.');
  const grouped = (sep: string) => int.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
  return [...new Set([`${int},${dec}`, `${grouped('.')},${dec}`, `${int}.${dec}`, `${grouped(',')}.${dec}`])];
}

/** yyyymmdd (CII format 102) printed as dd.mm.yyyy, d.m.yyyy, yyyy-mm-dd or dd/mm/yyyy. */
export function dateVariants(v: string): string[] {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (!m) return [v];
  const [, y, mo, d] = m;
  return [`${d}.${mo}.${y}`, `${Number(d)}.${Number(mo)}.${y}`, `${y}-${mo}-${d}`, `${d}/${mo}/${y}`, `${d}.${mo}.${y.slice(2)}`];
}

export function isCalendarDate(v: string): boolean {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

export function keyFieldsFromCii(xml: string): KeyField[] {
  const fields: KeyField[] = [];
  // BT-1 is the ID directly inside ExchangedDocument (not any later ID element).
  const nr = first(xml, /<(?:\w+:)?ExchangedDocument>\s*<(?:\w+:)?ID>([^<]+)</);
  if (nr) fields.push({ code: 'PDF-XML-NR', value: nr, variants: [nr] });
  const date = first(xml, /<(?:\w+:)?IssueDateTime>\s*<(?:\w+:)?DateTimeString[^>]*>([^<]+)</);
  // An impossible date (e.g. month 13) cannot be printed; the rule check already reports it.
  if (date && isCalendarDate(date)) fields.push({ code: 'PDF-XML-DATE', value: date, variants: dateVariants(date) });
  const total = first(xml, /<(?:\w+:)?GrandTotalAmount[^>]*>([^<]+)</);
  if (total) fields.push({ code: 'PDF-XML-TOTAL', value: total, variants: amountVariants(total) });
  const due = first(xml, /<(?:\w+:)?DuePayableAmount[^>]*>([^<]+)</);
  if (due && due !== total) fields.push({ code: 'PDF-XML-DUE', value: due, variants: amountVariants(due) });
  const iban = first(xml, /<(?:\w+:)?IBANID>([^<]+)</);
  if (iban) fields.push({ code: 'PDF-XML-IBAN', value: iban, variants: [iban] });
  return fields;
}

const squash = (s: string) => s.toLowerCase().replace(/\s+/g, '');

/** Returns warnings for XML values not found in the visible PDF text. */
export function compareWithPicture(xml: string, pdfText: string): Finding[] {
  const text = squash(pdfText);
  if (text.length < 20) {
    return [{ code: 'PDF-XML-NOTEXT', level: 'information', rawLevel: 'information', text: 'The PDF has no readable text (for example a scanned image), so the picture could not be compared with the XML.' }];
  }
  return keyFieldsFromCii(xml)
    .filter((f) => !f.variants.some((v) => text.includes(squash(v))))
    .map((f) => ({ code: f.code, level: 'warning' as const, rawLevel: 'warning' as const, text: `XML value "${f.value}" was not found in the visible PDF.` }));
}
