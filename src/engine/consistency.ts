// "Picture vs XML": for hybrid invoices (ZUGFeRD / Factur-X) the XML is legally authoritative
// (BMF FAQ, question 12a). This check looks for key XML values anywhere in the PDF's visible text
// and reports values that do not appear. It is a helpful comparison, not an official rule: a value
// "not found" can also mean the picture prints it in a format we do not recognise.
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

const MONTHS_DE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** yyyymmdd (CII format 102) in numeric and written-out German/English forms. */
export function dateVariants(v: string): string[] {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (!m) return [v];
  const [, y, mo, d] = m;
  const dn = Number(d), mn = Number(mo);
  const de = MONTHS_DE[mn - 1], en = MONTHS_EN[mn - 1];
  return [
    `${d}.${mo}.${y}`, `${dn}.${mn}.${y}`, `${y}-${mo}-${d}`, `${d}/${mo}/${y}`, `${d}.${mo}.${y.slice(2)}`,
    `${dn}. ${de} ${y}`, `${d}. ${de} ${y}`, `${dn} ${en} ${y}`, `${en} ${dn}, ${y}`, `${en} ${d}, ${y}`,
  ];
}

export function isCalendarDate(v: string): boolean {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

export function keyFieldsFromCii(raw: string): KeyField[] {
  // XML comments must not hide or split values (e.g. between the account element and the IBAN).
  const xml = raw.replace(/<!--[\s\S]*?-->/g, '');
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
  // Only the payee's account (credit transfer); a direct debit carries the buyer's account instead.
  const directDebit = /<(?:\w+:)?SpecifiedTradeSettlementPaymentMeans>\s*<(?:\w+:)?TypeCode>59</.test(xml);
  const iban = directDebit ? null : first(xml, /<(?:\w+:)?PayeePartyCreditorFinancialAccount>\s*<(?:\w+:)?IBANID>([^<]+)</);
  if (iban) fields.push({ code: 'PDF-XML-IBAN', value: iban, variants: [iban] });
  return fields;
}

const squash = (s: string) => s.toLowerCase().replace(/\s+/g, '');

/** Returns findings for XML values not found in the visible PDF text. */
export function compareWithPicture(xml: string, pdfText: string): Finding[] {
  const text = squash(pdfText);
  const note = (code: string): Finding => ({ code, level: 'information', rawLevel: 'information', text: '', picture: true });
  if (text.length < 20) return [note('PDF-XML-NOTEXT')];
  const fields = keyFieldsFromCii(xml);
  const missing = fields.filter((f) => !f.variants.some((v) => text.includes(squash(v))));
  // Nothing matched at all: one neutral warning (the picture may show other data or print it differently).
  if (fields.length > 1 && missing.length === fields.length) {
    return [{ code: 'PDF-XML-NOMATCH', level: 'warning', rawLevel: 'warning', text: '', picture: true }];
  }
  return missing.map((f) => ({ code: f.code, level: 'warning' as const, rawLevel: 'warning' as const, text: '', value: f.value, picture: true }));
}
