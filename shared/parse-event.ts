// Pure validation of an event payload (unit-tested). Returns null for anything not whitelisted.

const EVENTS = new Set(['view', 'check', 'interest', 'multi', 'pdf']);
const STATUSES = new Set(['valid', 'valid-with-notes', 'invalid', 'unsupported', 'not-xml']);
const SYNTAXES = new Set(['ubl-invoice', 'ubl-creditnote', 'cii']);
const REFS = new Set(['direct', 'internal', 'search', 'github', 'directory', 'other']);
const RULE = /^(XSD|[A-Z]{2,4}(-[A-Z0-9]{1,6}){1,4})$/;

export interface ParsedEvent {
  event: string;
  status: string;
  syntax: string;
  sample: boolean;
  rules: string;
  ref: string;
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
    ms: num(b.ms, 600_000),
    n: num(b.n, 100),
  };
}
