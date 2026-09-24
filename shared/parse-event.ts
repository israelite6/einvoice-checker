// Pure validation of an event payload (unit-tested). Returns null for anything not whitelisted.

const EVENTS = new Set(['view', 'check', 'interest', 'multi', 'pdf']);
const STATUSES = new Set(['valid', 'valid-with-notes', 'invalid', 'unsupported', 'not-xml', 'pdf-no-xml', 'pdf-unreadable', 'profile-incomplete', 'profile-unsupported']);
const FORMATS = new Set(['xml', 'pdf']);
const PROFILES = new Set(['minimum', 'basic-wl', 'basic', 'en16931', 'xrechnung', 'extended', 'zugferd1', 'unknown']);
const SYNTAXES = new Set(['ubl-invoice', 'ubl-creditnote', 'cii']);
const REFS = new Set(['direct', 'internal', 'search', 'github', 'directory', 'other']);
const RULE = /^(XSD|[A-Z]{2,4}(-[A-Z0-9]{1,6}){1,4})$/;  // also matches PDF-XML-* codes

export interface ParsedEvent {
  event: string;
  status: string;
  syntax: string;
  sample: boolean;
  rules: string;
  ref: string;
  format: string;
  profile: string;
  ms: number;
  n: number;
}

export function parseEvent(text: string): ParsedEvent | null {
  let body: unknown;
  try { body = JSON.parse(text); } catch { return null; }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  const event = String(b.e ?? '');
  if (!EVENTS.has(event)) return null;
  const num = (v: unknown, max: number) => Math.max(0, Math.min(Number(v) || 0, max));
  return {
    event,
    status: STATUSES.has(String(b.s)) ? String(b.s) : '',
    syntax: SYNTAXES.has(String(b.x)) ? String(b.x) : '',
    sample: b.sample === true,
    rules: Array.isArray(b.r) ? b.r.map(String).filter((r) => RULE.test(r)).slice(0, 20).join(',') : '',
    ref: REFS.has(String(b.ref)) ? String(b.ref) : '',
    format: FORMATS.has(String(b.f)) ? String(b.f) : '',
    profile: PROFILES.has(String(b.p)) ? String(b.p) : '',
    ms: num(b.ms, 600_000),
    n: num(b.n, 100),
  };
}
