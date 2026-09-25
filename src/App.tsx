import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { trackCheck, trackInterest, trackView } from './analytics';
import { DropZone } from './components/DropZone';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Header } from './components/Header';
import { IconShield, IconWifiOff } from './components/icons';
import { Faq, Footer, LegalPage } from './components/Pages';
import { ResultPanel, type FileResult } from './components/Results';
import { EngineError, rulesUrl, validateInvoice, warmUp, type ValidationResult } from './engine/validate';
import { MAX_BYTES, readXmlFile } from './files';
import { PdfAttachmentTooLarge, PdfTimeout, PdfUnreadable } from './engine/pdf';
import { DICTS, LangContext, initialLang, useI18n, type Lang } from './i18n';
import { useTheme } from './theme';

type Route = 'home' | 'impressum' | 'datenschutz' | 'lizenzen';
const routeOf = (h: string): Route => (['impressum', 'datenschutz', 'lizenzen'].includes(h.slice(1)) ? (h.slice(1) as Route) : 'home');

function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => routeOf(location.hash));
  useEffect(() => {
    const on = () => { setRoute(routeOf(location.hash)); window.scrollTo({ top: 0 }); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

function useOnline(): boolean {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true); const down = () => setOnline(false);
    window.addEventListener('online', up); window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);
  return online;
}

/** True when a new app version's service worker takes over a page that an older version controlled. */
function useUpdateNotice(): boolean {
  const [updated, setUpdated] = useState(false);
  useEffect(() => {
    const sw = navigator.serviceWorker;
    if (!sw?.controller) return; // first visit: taking control is expected, not an update
    const on = () => setUpdated(true);
    sw.addEventListener('controllerchange', on);
    return () => sw.removeEventListener('controllerchange', on);
  }, []);
  return updated;
}

const uid = () => Math.random().toString(36).slice(2);

const RULE_FILES = [
  'validation/EN16931-UBL-validation.sef.json', 'validation/EN16931-CII-validation.sef.json',
  'validation/XRechnung-UBL-validation.sef.json', 'validation/XRechnung-CII-validation.sef.json',
  'viz/ubl-invoice-xr.sef.json', 'viz/ubl-creditnote-xr.sef.json', 'viz/cii-xr.sef.json', 'viz/xrechnung-html.sef.json',
];

// Loaded before the service worker controls a first visit; fetched again so they are cached offline too.
const CORE_FILES = [rulesUrl('scenarios.xml'), rulesUrl('xsd.json'), rulesUrl('manifest.json'), `/vendor/SaxonJS2.rt.js?v=${__RULES_VERSION__}`, `/vendor/LICENSE-SaxonJS.txt?v=${__RULES_VERSION__}`, '/samples/valid.xml', '/samples/invalid.xml', '/samples/zugferd.pdf'];

const VIEWER_RUNTIME_FILES = ['viz/FileSaver-v2.0.5.js', 'viz/xrechnung-viewer.js', 'viz/xrechnung-viewer.css', 'viz/l10n/de.xml', 'viz/l10n/en.xml'];

interface Input { name: string; text: () => Promise<string>; bytes?: () => Promise<Uint8Array>; kind: 'xml' | 'pdf' | 'too-large'; sample: boolean }

function announce(t: ReturnType<typeof useI18n>['t'], res: ValidationResult): string {
  return res.status === 'valid' ? t.statusValid
    : res.status === 'valid-with-notes' ? t.statusValidNotes
    : res.status === 'invalid' ? `${t.statusInvalid}: ${res.findings.filter((f) => f.level === 'error').length} ${t.errors}`
    : res.status === 'pdf-no-xml' ? t.statusPdfNoXml
    : res.status === 'profile-incomplete' ? t.statusProfileIncomplete
    : res.status === 'profile-unsupported' ? t.statusProfileUnsupported
    : res.status === 'embedded-unknown' ? t.statusEmbeddedUnknown
    : res.status === 'not-xml' ? t.statusNotXml : t.statusUnsupported;
}

function Checker({ onAnnounce }: { onAnnounce: (msg: string) => void }) {
  const { t } = useI18n();
  const [results, setResults] = useState<FileResult[]>([]);
  const [interest, setInterest] = useState(false);
  const inputs = useRef(new Map<string, Input>());

  useEffect(() => {
    trackView();
    // After first paint: load the engine, then fetch every rule file into the offline cache
    // (the service worker stores them), so later checks and the invoice view also work offline.
    const idle = (cb: () => void) => (typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback(cb) : setTimeout(cb, 800));
    const prefetch = () => Promise.all([
      // PDF engine (pdf.js, worker, ZUGFeRD module): cached for offline use and a faster first PDF check.
      import('./engine/pdf').then((m) => m.prefetchPdfEngine()).catch(() => undefined),
      import('./engine/zugferd').catch(() => undefined),
      ...CORE_FILES.map((u) => fetch(u).catch(() => undefined)),
      ...RULE_FILES.map((f) => fetch(rulesUrl(f)).catch(() => undefined)),
      // The viewer stylesheets load these at runtime by relative path (no version query).
      ...VIEWER_RUNTIME_FILES.map((f) => fetch(`/rules/${f}`).catch(() => undefined)),
    ]);
    // Core engine first (needed by every check). The full offline prefetch waits until the first check
    // is done or the page has been idle for 15 s, so it never competes with the files a check needs now.
    idle(() => { warmUp().catch(() => undefined); });
    let prefetched = false;
    const prefetchOnce = () => { if (!prefetched) { prefetched = true; void prefetch(); } };
    const timer = setTimeout(prefetchOnce, 15000);
    window.addEventListener('einvoice:checked', prefetchOnce, { once: true });
    // On a first visit the service worker only takes control after install; fetch again then, so the
    // files land in its offline cache (not just the HTTP cache). Cached responses make this cheap.
    const sw = navigator.serviceWorker;
    const onControl = () => { if (prefetched) void prefetch(); };
    sw?.addEventListener('controllerchange', onControl, { once: true });
    return () => { clearTimeout(timer); sw?.removeEventListener('controllerchange', onControl); window.removeEventListener('einvoice:checked', prefetchOnce); };
  }, []);

  const patch = (id: string, p: Partial<FileResult>) => setResults((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));

  const run = useCallback(async (id: string, f: Input) => {
    patch(id, { state: 'checking', step: undefined });
    try {
      let result: ValidationResult & { pdf?: { profile: string; attachment: string | null } };
      let xml: string | undefined;
      if (f.kind === 'pdf' && f.bytes) {
        // ZUGFeRD / Factur-X: loaded on demand; a failed load is an engine problem, not a verdict on the file.
        let validatePdf: typeof import('./engine/zugferd').validatePdf;
        try {
          ({ validatePdf } = await import('./engine/zugferd'));
        } catch (err) {
          throw new EngineError(String(err), true);
        }
        const r = await validatePdf(await f.bytes(), (step) => patch(id, { step }));
        result = r;
        xml = r.xml ?? undefined;
      } else {
        xml = await f.text();
        result = await validateInvoice(xml, (step) => patch(id, { step }));
      }
      patch(id, { state: 'done', result, xml });
      onAnnounce(announce(t, result));
      window.dispatchEvent(new Event('einvoice:checked'));
      trackCheck({ status: result.status, syntax: result.syntax, sample: f.sample, ms: result.ms, rules: result.findings.filter((x) => x.level === 'error').map((x) => x.code), format: f.kind === 'pdf' ? 'pdf' : 'xml', profile: result.pdf?.profile });
    } catch (e) {
      if (e instanceof PdfTimeout) {
        patch(id, { state: 'timeout' });
        onAnnounce(t.statusTimeout);
      } else if (e instanceof PdfAttachmentTooLarge) {
        patch(id, { state: 'done', result: { status: 'embedded-too-large', scenario: null, syntax: null, xsdValid: null, findings: [], ms: 0 } });
        onAnnounce(t.statusEmbeddedTooLarge);
      } else if (e instanceof PdfUnreadable) {
        patch(id, { state: 'done', result: { status: 'pdf-unreadable', scenario: null, syntax: null, xsdValid: null, findings: [], ms: 0 } });
        onAnnounce(t.statusPdfUnreadable);
      } else if (e instanceof EngineError) {
        patch(id, { state: 'engine-error', reloadNeeded: e.reload });
        onAnnounce(t.statusEngine);
      } else {
        patch(id, { state: 'done', result: { status: 'not-xml', scenario: null, syntax: null, xsdValid: null, findings: [], ms: 0 } });
        onAnnounce(t.statusNotXml);
      }
    }
  }, [onAnnounce, t]);

  const check = useCallback(async (files: Input[]) => {
    const entries: FileResult[] = files.map((f) => ({ id: uid(), name: f.name, sample: f.sample, state: f.kind === 'too-large' ? 'too-large' : 'checking' }));
    setResults((rs) => [...entries, ...rs]);
    document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    for (const [i, f] of files.entries()) {
      inputs.current.set(entries[i].id, f);
      if (f.kind === 'too-large') { onAnnounce(t.tooLarge); continue; }
      await run(entries[i].id, f);
    }
  }, [run, onAnnounce, t]);

  const onFiles = (files: File[]) => check(files.map((f) => ({
    name: f.name,
    text: () => readXmlFile(f),
    bytes: async () => new Uint8Array(await f.arrayBuffer()),
    kind: f.size > MAX_BYTES ? 'too-large' : f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'xml',
    sample: false,
  })));

  const sample = (kind: 'valid' | 'invalid' | 'zugferd') => check([kind === 'zugferd' ? {
    name: 'beispiel-zugferd.pdf',
    text: async () => '',
    bytes: () => fetch('/samples/zugferd.pdf').then(async (r) => { if (!r.ok) throw new EngineError(String(r.status)); return new Uint8Array(await r.arrayBuffer()); }),
    kind: 'pdf',
    sample: true,
  } : {
    name: kind === 'valid' ? 'beispiel-gueltig.xml' : 'beispiel-fehler.xml',
    text: () => fetch(`/samples/${kind}.xml`).then((r) => { if (!r.ok) throw new EngineError(String(r.status)); return r.text(); }),
    kind: 'xml',
    sample: true,
  }]);

  const retry = (id: string) => { const f = inputs.current.get(id); if (f) void run(id, f); };

  return (
    <main id="main" tabIndex={-1} className="outline-none">
      <section className="relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-40 -z-10 flex justify-center">
          <div className="h-130 w-225 rounded-full bg-linear-to-br from-brand-500/25 via-sky-400/15 to-emerald-400/20 blur-3xl dark:from-brand-500/20 dark:via-sky-500/10 dark:to-emerald-500/10" />
        </div>
        <div className="mx-auto max-w-3xl px-4 pb-10 pt-12 text-center sm:px-6 sm:pt-20">
          <p className="mx-auto inline-flex animate-rise items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
            <IconShield className="size-4" />{t.privacyBadge}
          </p>
          <h1 className="mt-6 animate-rise text-4xl font-extrabold tracking-tight text-balance [animation-delay:60ms] sm:text-5xl">{t.heroTitle}</h1>
          <p className="mx-auto mt-4 max-w-2xl animate-rise text-lg text-pretty text-slate-600 [animation-delay:120ms] dark:text-slate-300">{t.heroLead}</p>
          <div className="mt-8 animate-rise [animation-delay:180ms]">
            <DropZone onFiles={onFiles} compact={results.length > 0} />
          </div>
          <div className="mt-4 flex animate-rise flex-wrap items-center justify-center gap-2 text-sm [animation-delay:240ms]">
            <span className="text-slate-500 dark:text-slate-400">{t.samplesLabel}</span>
            <button type="button" onClick={() => sample('valid')} className="min-h-11 rounded-full border border-slate-200 bg-white px-4 font-medium transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:hover:border-emerald-500/50">{t.sampleValid}</button>
            <button type="button" onClick={() => sample('invalid')} className="min-h-11 rounded-full border border-slate-200 bg-white px-4 font-medium transition-all hover:-translate-y-0.5 hover:border-rose-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:hover:border-rose-500/50">{t.sampleInvalid}</button>
            <button type="button" onClick={() => sample('zugferd')} className="min-h-11 rounded-full border border-slate-200 bg-white px-4 font-medium transition-all hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:hover:border-violet-500/50">{t.sampleZugferd}</button>
          </div>
          <p className="mx-auto mt-6 max-w-xl text-sm text-slate-500 dark:text-slate-400">{t.privacyDetail}</p>
        </div>
      </section>

      <section id="results" aria-label={t.filesChecked} className="mx-auto max-w-4xl scroll-mt-20 space-y-6 px-4 sm:px-6">
        {results.map((r) => (
          <ErrorBoundary key={r.id} fallback={() => <p className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">{t.errorGeneric}</p>}>
            <ResultPanel r={r} onRetry={() => retry(r.id)} />
          </ErrorBoundary>
        ))}
        {results.length > 0 && (
          <div className="animate-rise rounded-3xl border border-brand-100 bg-brand-50/60 p-5 sm:p-7 dark:border-brand-500/20 dark:bg-brand-500/10">
            <h2 className="font-semibold">{t.interestTitle}</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t.interestBody}</p>
            {interest
              ? <p className="mt-3 animate-fade text-sm font-medium text-emerald-700 dark:text-emerald-300" role="status">{t.interestThanks}</p>
              : <button type="button" onClick={() => { setInterest(true); trackInterest(); }} className="mt-3 min-h-11 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-md">{t.interestButton}</button>}
          </div>
        )}
        {results.length > 0 && <p className="text-center text-xs text-slate-500 dark:text-slate-400">{t.disclaimer}</p>}
      </section>

      <Faq />
    </main>
  );
}

export default function App() {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const [theme, toggleTheme] = useTheme();
  const route = useRoute();
  const online = useOnline();
  const updated = useUpdateNotice();
  const [rules, setRules] = useState('XRechnung 3.0.2 · EN 16931 1.3.16');
  const [liveMsg, setLiveMsg] = useState('');
  const onAnnounce = useCallback((msg: string) => { setLiveMsg(''); window.setTimeout(() => setLiveMsg(msg), 50); }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem('lang', l); } catch { /* storage unavailable */ }
  }, []);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  useEffect(() => {
    const t = DICTS[lang];
    const titles = { home: t.titleHome, impressum: t.impressum, datenschutz: t.privacy, lizenzen: t.licences };
    document.title = route === 'home' ? titles.home : `${titles[route]} – ${t.brand}`;
  }, [lang, route]);
  useEffect(() => {
    fetch(rulesUrl('manifest.json')).then((r) => r.json())
      .then((m: { xrechnung: string; en16931: string; configDate: string }) => setRules(`XRechnung ${m.xrechnung} · EN 16931 ${m.en16931} · ${m.configDate}`))
      .catch(() => {});
  }, []);

  const ctx = useMemo(() => ({ lang, t: DICTS[lang], setLang }), [lang, setLang]);

  return (
    <LangContext.Provider value={ctx}>
      <a href="#main" onClick={(e) => { e.preventDefault(); const m = document.getElementById('main'); m?.focus(); m?.scrollIntoView(); }} className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow-lg dark:focus:bg-slate-900">{ctx.t.skip}</a>
      <Header theme={theme} onToggleTheme={toggleTheme} />
      {updated && (
        <div className="animate-fade border-b border-brand-100 bg-brand-50 px-4 py-2 text-center text-sm dark:border-brand-500/30 dark:bg-brand-500/10" role="status">
          {ctx.t.updateAvailable}{' '}
          <button type="button" onClick={() => location.reload()} className="ml-2 inline-flex min-h-11 items-center font-semibold text-brand-700 underline underline-offset-4 dark:text-brand-100">{ctx.t.reload}</button>
        </div>
      )}
      {!online && (
        <div className="animate-fade border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100" role="status">
          <IconWifiOff className="mr-2 inline size-4 align-[-2px]" />{ctx.t.offline}
        </div>
      )}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{liveMsg}</div>
      <ErrorBoundary fallback={() => (
        <main id="main" className="mx-auto max-w-xl px-4 py-24 text-center">
          <h1 className="text-2xl font-bold">{ctx.t.crashTitle}</h1>
          <p className="mt-3 text-slate-600 dark:text-slate-300">{ctx.t.crashBody}</p>
          <button type="button" onClick={() => location.reload()} className="mt-6 min-h-11 rounded-xl bg-brand-600 px-5 font-semibold text-white">{ctx.t.reload}</button>
        </main>
      )}>
        {route === 'home' ? <Checker onAnnounce={onAnnounce} /> : <LegalPage page={route} />}
      </ErrorBoundary>
      <Footer rules={rules} />
    </LangContext.Provider>
  );
}
