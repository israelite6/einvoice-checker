import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildPayload, PAYLOAD_KEYS, referrerClass } from '../../src/analytics';
import { cleanNaN } from '../../src/engine/visualize';
import { plainTitle } from '../../src/explanations';
import { decodeXml } from '../../src/files';
import { parseEvent } from '../../shared/parse-event';
import { amountVariants, compareWithPicture, dateVariants, isCalendarDate, keyFieldsFromCii } from '../../src/engine/consistency';
import { maxDeclaredXmlAttachmentSize, profileOf } from '../../src/engine/pdf';
// @ts-expect-error plain ESM build script
import { minify } from '../../scripts/build-frame-helper.mjs';

describe('event parsing (server whitelist)', () => {
  it('accepts a check event and keeps only known values', () => {
    const e = parseEvent(JSON.stringify({ e: 'check', s: 'invalid', x: 'cii', sample: false, ms: 812, r: ['BR-CO-16', 'XSD', '<script>', 'BR-DE-15'], extra: 'dropped' }));
    expect(e).toEqual({ event: 'check', status: 'invalid', syntax: 'cii', sample: false, rules: 'BR-CO-16,XSD,BR-DE-15', ref: '', format: '', profile: '', ms: 812, n: 0 });
  });
  it('rejects non-objects and unknown events', () => {
    for (const body of ['null', '[]', '"x"', '{}', '{"e":"hack"}', 'not json']) expect(parseEvent(body)).toBeNull();
  });
  it('clamps numbers and drops unknown enums', () => {
    const e = parseEvent(JSON.stringify({ e: 'check', s: 'owned', x: 'pdf', ms: 1e12, n: -5, ref: 'evil.example' }))!;
    expect([e.status, e.syntax, e.ms, e.n, e.ref]).toEqual(['', '', 600000, 0, '']);
  });
});

describe('client payloads', () => {
  it('only ever uses whitelisted keys', () => {
    const payloads = [
      buildPayload('view', { ref: 'search' }),
      buildPayload('check', { status: 'valid', syntax: 'ubl-invoice', sample: true, ms: 12.6, rules: [] }),
      buildPayload('multi', { n: 3 }),
      buildPayload('pdf'),
      buildPayload('interest'),
    ];
    for (const p of payloads) for (const k of Object.keys(p)) expect(PAYLOAD_KEYS).toContain(k);
  });
  it('classifies referrers coarsely', () => {
    expect(referrerClass('', 'x.dev')).toBe('direct');
    expect(referrerClass('https://www.google.de/search?q=secret', 'x.dev')).toBe('search');
    expect(referrerClass('https://github.com/a/b', 'x.dev')).toBe('github');
    expect(referrerClass('https://x.dev/#impressum', 'x.dev')).toBe('internal');
    expect(referrerClass('https://blog.example/post', 'x.dev')).toBe('other');
  });
});

describe('file decoding', () => {
  it('honours the XML encoding declaration', () => {
    const latin1 = Uint8Array.from([...'<?xml version="1.0" encoding="ISO-8859-1"?><a>'].map((c) => c.charCodeAt(0)).concat([0xfc, 0x3c, 0x2f, 0x61, 0x3e]));
    expect(decodeXml(latin1)).toContain('<a>ü</a>');
  });
  it('strips a UTF-8 BOM', () => {
    expect(decodeXml(Uint8Array.from([0xef, 0xbb, 0xbf, 0x3c, 0x61, 0x2f, 0x3e]))).toBe('<a/>');
  });
});

describe('display helpers', () => {
  it('blanks formatted empty amounts only', () => {
    expect(cleanNaN('<td>NaN</td><td> NaN </td><td>NaNa</td>')).toBe('<td></td><td></td><td>NaNa</td>');
  });
  it('has plain-language titles in both languages', () => {
    expect(plainTitle('BR-CO-16', 'de')).toMatch(/fällige Betrag/);
    expect(plainTitle('BR-CO-16', 'en')).toMatch(/amount due/);
    expect(plainTitle('UNKNOWN', 'de')).toBeNull();
  });
});

describe('frame helper', () => {
  it('inlined copy matches its source (CSP hash stays in sync)', () => {
    const src = fs.readFileSync('src/engine/frame-helper.src.js', 'utf8');
    expect(fs.readFileSync('src/engine/frame-helper.txt', 'utf8')).toBe(minify(src));
  });
});

describe('ZUGFeRD profiles', () => {
  it('maps guideline IDs to profiles', () => {
    expect(profileOf('urn:factur-x.eu:1p0:minimum')).toBe('minimum');
    expect(profileOf('urn:factur-x.eu:1p0:basicwl')).toBe('basic-wl');
    expect(profileOf('urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:basic')).toBe('basic');
    expect(profileOf('urn:cen.eu:en16931:2017')).toBe('en16931');
    expect(profileOf('urn:cen.eu:en16931:2017#conformant#urn:factur-x.eu:1p0:extended')).toBe('extended');
    expect(profileOf('urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0')).toBe('xrechnung');
    expect(profileOf('urn:ferd:CrossIndustryDocument:invoice:1p0:basic')).toBe('zugferd1');
    expect(profileOf(null)).toBe('unknown');
  });
});

describe('picture vs XML', () => {
  const xml = `<rsm:CrossIndustryInvoice><rsm:ExchangedDocument><ram:ID>RE-2026-042</ram:ID><ram:IssueDateTime><udt:DateTimeString format="102">20260915</udt:DateTimeString></ram:IssueDateTime></rsm:ExchangedDocument>
    <ram:IBANID>DE02120300000000202051</ram:IBANID><ram:GrandTotalAmount>1234.50</ram:GrandTotalAmount><ram:DuePayableAmount>1234.50</ram:DuePayableAmount></rsm:CrossIndustryInvoice>`;
  it('prints amounts and dates in common formats', () => {
    expect(amountVariants('1234.5')).toEqual(expect.arrayContaining(['1.234,50', '1234,50', '1,234.50', '1234.50']));
    expect(dateVariants('20260915')).toEqual(expect.arrayContaining(['15.09.2026', '2026-09-15']));
  });
  it('finds nothing to report when the picture shows the XML values', () => {
    const text = 'Rechnung Nr. RE-2026-042 vom 15.09.2026 · Gesamt 1.234,50 € · IBAN DE02 1203 0000 0000 2020 51';
    expect(compareWithPicture(xml, text)).toEqual([]);
  });
  it('warns about values missing from the picture', () => {
    const text = 'Rechnung Nr. RE-2026-043 vom 15.09.2026 · Gesamt 999,00 € · IBAN DE02 1203 0000 0000 2020 51 lorem ipsum';
    expect(compareWithPicture(xml, text).map((f) => f.code).sort()).toEqual(['PDF-XML-NR', 'PDF-XML-TOTAL']);
  });
  it('says when there is no readable text', () => {
    expect(compareWithPicture(xml, '   ')[0].code).toBe('PDF-XML-NOTEXT');
  });
});

describe('picture vs XML: edge cases found by the ZUGFeRD corpus', () => {
  it('takes BT-1 only from directly inside ExchangedDocument', () => {
    const noNr = '<rsm:ExchangedDocument><ram:TypeCode>380</ram:TypeCode></rsm:ExchangedDocument><ram:SellerTradeParty><ram:ID>123</ram:ID></ram:SellerTradeParty>';
    expect(keyFieldsFromCii(noNr).find((f) => f.code === 'PDF-XML-NR')).toBeUndefined();
  });
  it('ignores impossible dates', () => {
    expect(isCalendarDate('20261345')).toBe(false);
    expect(isCalendarDate('20260230')).toBe(false);
    expect(isCalendarDate('20240229')).toBe(true);
  });
});

describe('picture vs XML: QA r2 findings (RM1)', () => {
  const base = (extra: string) => `<rsm:ExchangedDocument><ram:ID>R-1</ram:ID><ram:IssueDateTime><udt:DateTimeString format="102">20160404</udt:DateTimeString></ram:IssueDateTime></rsm:ExchangedDocument>${extra}<ram:GrandTotalAmount>100.00</ram:GrandTotalAmount>`;
  it('recognises written-out dates in German and English', () => {
    expect(compareWithPicture(base(''), 'Rechnung R-1 vom 4. April 2016, Summe 100,00 EUR, vielen Dank')).toEqual([]);
    expect(compareWithPicture(base(''), 'Invoice R-1 dated April 4, 2016 total 100.00 EUR thank you')).toEqual([]);
  });
  it('compares only the payee IBAN and skips direct debit', () => {
    const payee = '<ram:SpecifiedTradeSettlementPaymentMeans><ram:TypeCode>58</ram:TypeCode><ram:PayeePartyCreditorFinancialAccount><ram:IBANID>DE11111111111111111111</ram:IBANID></ram:PayeePartyCreditorFinancialAccount></ram:SpecifiedTradeSettlementPaymentMeans>';
    const debit = '<ram:SpecifiedTradeSettlementPaymentMeans><ram:TypeCode>59</ram:TypeCode><ram:PayerPartyDebtorFinancialAccount><ram:IBANID>DE22222222222222222222</ram:IBANID></ram:PayerPartyDebtorFinancialAccount></ram:SpecifiedTradeSettlementPaymentMeans>';
    expect(keyFieldsFromCii(base(payee)).find((f) => f.code === 'PDF-XML-IBAN')?.value).toBe('DE11111111111111111111');
    expect(keyFieldsFromCii(base(debit)).find((f) => f.code === 'PDF-XML-IBAN')).toBeUndefined();
  });
  it('gives one neutral finding when nothing can be matched (a warning since release 2.1)', () => {
    const r = compareWithPicture(base(''), 'Ganz anderes Layout ohne erkennbare Werte, nur Fließtext und Logos hier');
    expect(r.map((f) => f.code)).toEqual(['PDF-XML-NOMATCH']);
    expect(r[0].level).toBe('warning');
  });
});

describe('release 2.1 hardening (QA r2 delta items 4–8)', () => {
  it('ignores XML comments when reading the payee IBAN', () => {
    const xml = '<rsm:ExchangedDocument><ram:ID>R-9</ram:ID></rsm:ExchangedDocument><ram:PayeePartyCreditorFinancialAccount><!-- account --><ram:IBANID>DE33333333333333333333</ram:IBANID></ram:PayeePartyCreditorFinancialAccount>';
    expect(keyFieldsFromCii(xml).find((f) => f.code === 'PDF-XML-IBAN')?.value).toBe('DE33333333333333333333');
  });
  it('treats "no value matches at all" as a warning, not a note', () => {
    const xml = '<rsm:ExchangedDocument><ram:ID>R-1</ram:ID></rsm:ExchangedDocument><ram:GrandTotalAmount>100.00</ram:GrandTotalAmount>';
    expect(compareWithPicture(xml, 'Eine ganz andere Rechnung mit anderen Werten und viel Text hier')[0]).toMatchObject({ code: 'PDF-XML-NOMATCH', level: 'warning' });
  });
  it('reads declared sizes of XML embedded files only, without unpacking', () => {
    const enc = (t: string) => new TextEncoder().encode(t);
    const xmlBig = '5 0 obj << /Type /Filespec /F (factur-x.xml) /UF (factur-x.xml) /EF << /F 6 0 R /UF 6 0 R >> >> endobj 6 0 obj << /Type /EmbeddedFile /Subtype /text#2Fxml /Params << /Size 419430400 >> /Length 12 >> stream';
    const otherBig = '7 0 obj << /Type /Filespec /F (lieferschein.pdf) /EF << /F 8 0 R >> >> endobj 8 0 obj << /Type /EmbeddedFile /Subtype /application#2Fpdf /Params << /Size 12582912 >> /Length 12 >> stream';
    expect(maxDeclaredXmlAttachmentSize(enc(xmlBig))).toBe(419430400);
    expect(maxDeclaredXmlAttachmentSize(enc(otherBig))).toBe(0);
    expect(maxDeclaredXmlAttachmentSize(enc('%PDF-1.7 nothing'))).toBe(0);
  });});
