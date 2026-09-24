import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildPayload, PAYLOAD_KEYS, referrerClass } from '../../src/analytics';
import { cleanNaN } from '../../src/engine/visualize';
import { plainTitle } from '../../src/explanations';
import { decodeXml } from '../../src/files';
import { parseEvent } from '../../shared/parse-event';
// @ts-expect-error plain ESM build script
import { minify } from '../../scripts/build-frame-helper.mjs';

describe('event parsing (server whitelist)', () => {
  it('accepts a check event and keeps only known values', () => {
    const e = parseEvent(JSON.stringify({ e: 'check', s: 'invalid', x: 'cii', sample: false, ms: 812, r: ['BR-CO-16', 'XSD', '<script>', 'BR-DE-15'], extra: 'dropped' }));
    expect(e).toEqual({ event: 'check', status: 'invalid', syntax: 'cii', sample: false, rules: 'BR-CO-16,XSD,BR-DE-15', ref: '', ms: 812, n: 0 });
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
