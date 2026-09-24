// Anonymous experiment events (EXP-2026-001). Only the whitelisted fields built below are ever
// sent: never file names, invoice content, amounts, parties, or device identifiers. No cookies.

export type EventName = 'view' | 'check' | 'interest' | 'multi' | 'pdf';

export interface CheckEvent {
  status: string;
  syntax: string | null;
  sample: boolean;
  ms: number;
  rules: string[];
  format?: 'xml' | 'pdf';
  profile?: string;
}

/** Allowed payload keys (the server enforces the same whitelist). */
export const PAYLOAD_KEYS = ['e', 's', 'x', 'sample', 'ms', 'r', 'n', 'ref', 'f', 'p'] as const;

/** Coarse referrer class only; never the full URL. */
export function referrerClass(referrer: string, ownHost: string): string {
  if (!referrer) return 'direct';
  try {
    const host = new URL(referrer).hostname;
    if (host === ownHost) return 'internal';
    if (/(^|\.)(google|bing|duckduckgo|ecosia|yahoo|qwant|startpage)\./.test(host)) return 'search';
    if (host.endsWith('github.com')) return 'github';
    if (host.endsWith('alternativeto.net')) return 'directory';
    return 'other';
  } catch { return 'other'; }
}

export function buildPayload(name: EventName, data: Partial<CheckEvent> & { n?: number; ref?: string } = {}): Record<string, unknown> {
  const p: Record<string, unknown> = { e: name };
  if (name === 'check') {
    p.s = data.status;
    p.x = data.syntax;
    p.sample = Boolean(data.sample);
    p.ms = Math.round(data.ms ?? 0);
    p.r = (data.rules ?? []).slice(0, 20);
    p.f = data.format ?? 'xml';
    if (data.profile) p.p = data.profile;
  }
  if (name === 'multi') p.n = Math.min(data.n ?? 0, 100);
  if (name === 'view') p.ref = data.ref;
  return p;
}

const OPT_OUT_KEY = 'noStats';

/** Opt-out: the switch on the privacy page, Global Privacy Control, or Do Not Track. */
export function statsOptedOut(): boolean {
  try {
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    return localStorage.getItem(OPT_OUT_KEY) === '1' || nav.globalPrivacyControl === true || nav.doNotTrack === '1';
  } catch { return false; }
}

export function setStatsOptOut(off: boolean): void {
  try { if (off) localStorage.setItem(OPT_OUT_KEY, '1'); else localStorage.removeItem(OPT_OUT_KEY); } catch { /* storage unavailable */ }
}

const disabled = (() => {
  try {
    return new URLSearchParams(location.search).has('test') || location.hostname === 'localhost';
  } catch { return true; }
})();

function send(payload: Record<string, unknown>): void {
  if (disabled || statsOptedOut()) return;
  try {
    navigator.sendBeacon?.('/api/event', new Blob([JSON.stringify(payload)], { type: 'application/json' }));
  } catch { /* analytics must never break the tool */ }
}

let viewSent = false;
let userChecks = 0;
let multiSent = false;

export function trackView(): void {
  if (viewSent) return;
  viewSent = true;
  send(buildPayload('view', { ref: referrerClass(document.referrer, location.hostname) }));
}

export function trackCheck(ev: CheckEvent): void {
  send(buildPayload('check', ev));
  // Multi-file use = 2+ completed user checks in one page load (EXP-2026-001 definition); sent once.
  if (!ev.sample && ++userChecks >= 2 && !multiSent) {
    multiSent = true;
    send(buildPayload('multi', { n: userChecks }));
  }
}

export function trackInterest(): void { send(buildPayload('interest')); }
