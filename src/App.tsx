import { useCallback, useEffect, useMemo, useState } from 'react';
import { trackCheck, trackInterest, trackMultiFile } from './analytics';
import { DropZone } from './components/DropZone';
import { Header } from './components/Header';
import { IconShield, IconWifiOff } from './components/icons';
import { Faq, Footer, LegalPage } from './components/Pages';
import { ResultPanel, type FileResult } from './components/Results';
import { validateInvoice, warmUp } from './engine/validate';
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

const uid = () => Math.random().toString(36).slice(2);

function Checker() {
  const { t } = useI18n();
  const [results, setResults] = useState<FileResult[]>([]);
  const [interest, setInterest] = useState(false);

  useEffect(() => {
    // Load the checker quietly after first paint so the first check feels instant.
    const id = window.setTimeout(warmUp, 600);
    return () => window.clearTimeout(id);
  }, []);

  const patch = (id: string, p: Partial<FileResult>) => setResults((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));

  const check = useCallback(async (files: { name: string; text: () => Promise<string>; pdf: boolean; sample: boolean }[]) => {
    const entries: FileResult[] = files.map((f) => ({ id: uid(), name: f.name, sample: f.sample, state: f.pdf ? 'pdf' : 'checking' }));
    setResults((rs) => [...entries, ...rs]);
    if (files.length > 1) trackMultiFile(files.length);
    document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    for (const [i, f] of files.entries()) {
      const e = entries[i];
      if (f.pdf) continue;
      try {
        const xml = await f.text();
        const result = await validateInvoice(xml, (step) => patch(e.id, { step }));
        patch(e.id, { state: 'done', result, xml });
        trackCheck({ status: result.status, syntax: result.syntax, sample: f.sample, ms: result.ms, rules: result.findings.filter((x) => x.level === 'error').map((x) => x.code) });
      } catch {
        patch(e.id, { state: 'done', result: { status: 'not-xml', scenario: null, syntax: null, xsdValid: null, findings: [], ms: 0 } });
      }
    }
  }, []);

  const onFiles = (files: File[]) => check(files.map((f) => ({
    name: f.name,
    text: () => f.text(),
    pdf: f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'),
    sample: false,
  })));

  const sample = (kind: 'valid' | 'invalid') => check([{
    name: kind === 'valid' ? 'beispiel-gueltig.xml' : 'beispiel-fehler.xml',
    text: () => fetch(`/samples/${kind}.xml`).then((r) => r.text()),
    pdf: false,
    sample: true,
  }]);

  return (
    <main id="main">
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
            <button type="button" onClick={() => sample('valid')} className="min-h-10 rounded-full border border-slate-200 bg-white px-4 font-medium transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:hover:border-emerald-500/50">{t.sampleValid}</button>
            <button type="button" onClick={() => sample('invalid')} className="min-h-10 rounded-full border border-slate-200 bg-white px-4 font-medium transition-all hover:-translate-y-0.5 hover:border-rose-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:hover:border-rose-500/50">{t.sampleInvalid}</button>
          </div>
          <p className="mx-auto mt-6 max-w-xl text-sm text-slate-500 dark:text-slate-400">{t.privacyDetail}</p>
        </div>
      </section>

      <section id="results" aria-label={t.filesChecked} className="mx-auto max-w-4xl scroll-mt-20 space-y-6 px-4 sm:px-6">
        {results.map((r) => <ResultPanel key={r.id} r={r} />)}
        {results.some((r) => r.state === 'done') && (
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
  const [rules, setRules] = useState('XRechnung 3.0.2 · EN 16931 1.3.16');

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem('lang', l); } catch { /* storage unavailable */ }
  }, []);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  useEffect(() => {
    fetch('/rules/manifest.json').then((r) => r.json())
      .then((m: { xrechnung: string; en16931: string; builtAt: string }) => setRules(`XRechnung ${m.xrechnung} · EN 16931 ${m.en16931} · ${m.builtAt}`))
      .catch(() => {});
  }, []);

  const ctx = useMemo(() => ({ lang, t: DICTS[lang], setLang }), [lang, setLang]);

  return (
    <LangContext.Provider value={ctx}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow-lg dark:focus:bg-slate-900">{ctx.t.skip}</a>
      <Header theme={theme} onToggleTheme={toggleTheme} />
      {!online && (
        <div className="animate-fade border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100" role="status">
          <IconWifiOff className="mr-2 inline size-4 align-[-2px]" />{ctx.t.offline}
        </div>
      )}
      {route === 'home' ? <Checker /> : <LegalPage page={route} />}
      <Footer rules={rules} />
    </LangContext.Provider>
  );
}
