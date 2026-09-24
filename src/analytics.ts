// Anonymous experiment events (EXP-2026-001). Never contains file names, invoice content,
// amounts, or parties: only the whitelisted fields below. No cookies, no device identifiers.

export type EventName = 'check' | 'interest' | 'multi';

export interface CheckEvent {
  status: string;
  syntax: string | null;
  sample: boolean;
  ms: number;
  rules: string[];
}

const disabled = (() => {
  try {
    return new URLSearchParams(location.search).has('test') || location.hostname === 'localhost';
  } catch { return true; }
})();

function send(name: EventName, data: Record<string, unknown>): void {
  if (disabled) return;
  const body = JSON.stringify({ e: name, ...data });
  try {
    navigator.sendBeacon?.('/api/event', new Blob([body], { type: 'application/json' }));
  } catch { /* analytics must never break the tool */ }
}

export function trackCheck(ev: CheckEvent): void {
  send('check', { s: ev.status, x: ev.syntax, sample: ev.sample, ms: ev.ms, r: ev.rules.slice(0, 20) });
}

export function trackInterest(): void { send('interest', {}); }
export function trackMultiFile(count: number): void { send('multi', { n: Math.min(count, 100) }); }
