// Receives anonymous experiment events (EXP-2026-001) and writes them to Workers Analytics Engine.
// Accepts only whitelisted fields; never stores IP addresses, file names, or invoice content.

interface Env {
  EVENTS?: AnalyticsEngineDataset;
}

const EVENTS = new Set(['check', 'interest', 'multi']);
const STATUSES = new Set(['valid', 'valid-with-notes', 'invalid', 'unsupported', 'not-xml']);
const SYNTAXES = new Set(['ubl-invoice', 'ubl-creditnote', 'cii']);
const RULE = /^[A-Z]{2,4}(-[A-Z0-9]{1,6}){1,4}$/;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let body: Record<string, unknown>;
  try {
    const text = await request.text();
    if (text.length > 4096) return new Response(null, { status: 413 });
    body = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }
  const event = String(body.e ?? '');
  if (!EVENTS.has(event)) return new Response(null, { status: 400 });

  const status = STATUSES.has(String(body.s)) ? String(body.s) : '';
  const syntax = SYNTAXES.has(String(body.x)) ? String(body.x) : '';
  const rules = Array.isArray(body.r) ? body.r.map(String).filter((r) => RULE.test(r)).slice(0, 20).join(',') : '';
  const country = (request as Request & { cf?: { country?: string } }).cf?.country ?? '';

  env.EVENTS?.writeDataPoint({
    indexes: [event],
    blobs: [event, status, syntax, body.sample === true ? 'sample' : 'user', country, rules],
    doubles: [Math.max(0, Math.min(Number(body.ms) || 0, 600000)), Math.max(0, Math.min(Number(body.n) || 0, 100))],
  });
  return new Response(null, { status: 204 });
};
