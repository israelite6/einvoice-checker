// Receives anonymous experiment events (EXP-2026-001) and writes them to Workers Analytics Engine.
// Accepts only same-origin beacons with whitelisted fields. Never stores IP addresses, file names,
// or invoice content. Bot-like requests are flagged so they can be excluded (measurement-plan.md).
import { parseEvent } from '../../shared/parse-event';

interface Env {
  EVENTS?: AnalyticsEngineDataset;
}

const BOT_UA = /bot|crawl|spider|slurp|headless|phantom|puppeteer|playwright|selenium|curl|wget|python|axios|node-fetch|go-http/i;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // Browsers send Sec-Fetch-Site on beacons; cross-site or missing means it did not come from our page.
  if (request.headers.get('Sec-Fetch-Site') !== 'same-origin') return new Response(null, { status: 403 });
  if (!(request.headers.get('Content-Type') ?? '').startsWith('application/json')) return new Response(null, { status: 415 });
  const text = await request.text();
  if (text.length > 4096) return new Response(null, { status: 413 });
  const ev = parseEvent(text);
  if (!ev) return new Response(null, { status: 400 });

  const cf = (request as Request & { cf?: { country?: string; asn?: number } }).cf;
  const ua = request.headers.get('User-Agent') ?? '';
  const bot = BOT_UA.test(ua) || !request.headers.get('Accept-Language') ? 'bot' : 'human';
  // Only the production hostname counts for the experiment; previews and local runs are tagged apart.
  const deployment = new URL(request.url).hostname === 'e-rechnung-pruefen.pages.dev' ? 'prod' : 'preview';

  env.EVENTS?.writeDataPoint({
    indexes: [ev.event],
    blobs: [ev.event, ev.status, ev.syntax, ev.sample ? 'sample' : 'user', cf?.country ?? '', ev.rules, bot, ev.ref, String(cf?.asn ?? ''), deployment],
    doubles: [ev.ms, ev.n],
  });
  return new Response(null, { status: 204 });
};
