import { useState } from 'react';
import type { Finding, Level, Step, ValidationResult } from '../engine/validate';
import { plainTitle } from '../explanations';
import { useI18n } from '../i18n';
import { IconAlert, IconCheck, IconChevron, IconFile, IconInfo, IconPrinter, IconX } from './icons';
import { InvoiceFrame } from './InvoiceFrame';
import { shortLocation } from '../location';

export interface FileResult {
  id: string;
  name: string;
  sample: boolean;
  state: 'checking' | 'done' | 'pdf' | 'engine-error' | 'too-large';
  step?: Step;
  result?: ValidationResult;
  xml?: string;
}

type Tone = 'ok' | 'warn' | 'bad' | 'neutral';

function tone(r: FileResult): Tone {
  if (r.state === 'engine-error') return 'warn';
  if (r.state !== 'done') return 'neutral';
  switch (r.result?.status) {
    case 'valid': return 'ok';
    case 'valid-with-notes': return 'warn';
    case 'invalid': return 'bad';
    default: return 'neutral';
  }
}

const TONE_STYLES: Record<Tone, { ring: string; icon: string; bar: string }> = {
  ok: { ring: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', icon: '', bar: 'bg-emerald-500' },
  warn: { ring: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', icon: '', bar: 'bg-amber-500' },
  bad: { ring: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300', icon: '', bar: 'bg-rose-500' },
  neutral: { ring: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', icon: '', bar: 'bg-slate-400' },
};

function StatusIcon({ t, className }: { t: Tone; className?: string }) {
  if (t === 'ok') return <IconCheck className={className} />;
  if (t === 'bad') return <IconX className={className} />;
  if (t === 'warn') return <IconAlert className={className} />;
  return <IconInfo className={className} />;
}

function Progress({ step }: { step?: Step }) {
  const { t } = useI18n();
  const steps: { id: Step; label: string }[] = [
    { id: 'schema', label: 'XML-Schema' },
    { id: 'en16931', label: 'EN 16931' },
    { id: 'xrechnung', label: 'XRechnung' },
  ];
  const idx = step ? steps.findIndex((s) => s.id === step) : -1;
  return (
    <div className="animate-fade">
      <p className="font-semibold">{idx < 0 ? t.loadingEngine : t.checking}</p>
      <p className="text-sm text-slate-500 dark:text-slate-400">{t.checkingDetail}</p>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
        <div className="h-full rounded-full bg-brand-500 transition-[width] duration-500 ease-out" style={{ width: `${Math.max(12, ((idx + 1) / steps.length) * 100)}%` }} />
      </div>
      <ol className="mt-3 flex flex-wrap gap-2 text-xs">
        {steps.map((s, i) => (
          <li key={s.id} className={`flex items-center gap-1 rounded-full px-2.5 py-1 transition-colors duration-300 ${i < idx ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : i === idx ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
            {i < idx && <IconCheck className="size-3.5" />}{s.label}
          </li>
        ))}
      </ol>
    </div>
  );
}

function counts(findings: Finding[]) {
  return {
    error: findings.filter((f) => f.level === 'error').length,
    warning: findings.filter((f) => f.level === 'warning').length,
    information: findings.filter((f) => f.level === 'information').length,
  };
}

function Verdict({ r, onRetry }: { r: FileResult; onRetry?: () => void }) {
  const { t, lang } = useI18n();
  const tn = tone(r);
  const st = TONE_STYLES[tn];
  const res = r.result;
  const title = r.state === 'engine-error' ? t.statusEngine
    : r.state === 'too-large' ? t.tooLarge
    : r.state === 'pdf' ? t.statusPdf
    : res?.status === 'valid' ? t.statusValid
    : res?.status === 'valid-with-notes' ? t.statusValidNotes
    : res?.status === 'invalid' ? t.statusInvalid
    : res?.status === 'not-xml' ? t.statusNotXml : t.statusUnsupported;
  const body = r.state === 'engine-error' ? t.verdictEngine
    : r.state === 'too-large' ? t.verdictTooLarge
    : r.state === 'pdf' ? t.verdictPdf
    : res?.status === 'valid' ? t.verdictValid
    : res?.status === 'valid-with-notes' ? t.verdictValidNotes
    : res?.status === 'invalid' ? t.verdictInvalid
    : res?.status === 'not-xml' ? t.verdictNotXml : t.verdictUnsupported;
  const c = counts(res?.findings ?? []);
  return (
    <div className="flex flex-col items-start gap-4 sm:flex-row">
      <div className={`grid size-14 shrink-0 animate-pop place-items-center rounded-2xl ${st.ring}`}>
        <StatusIcon t={tn} className="size-7" />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
        <p className="mt-1 text-slate-600 dark:text-slate-300">{body}</p>
        {r.state === 'engine-error' && onRetry && (
          <button type="button" onClick={onRetry} className="mt-3 min-h-11 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 dark:bg-white dark:text-slate-900">{t.retry}</button>
        )}
        {res?.scenario && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            {c.error > 0 && <span className="rounded-full bg-rose-100 px-2.5 py-1 font-medium text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">{c.error} {c.error === 1 ? t.error1 : t.errors}</span>}
            {c.warning > 0 && <span className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">{c.warning} {c.warning === 1 ? t.warning1 : t.warnings}</span>}
            {c.information > 0 && <span className="rounded-full bg-sky-100 px-2.5 py-1 font-medium text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">{c.information} {c.information === 1 ? t.info1 : t.infos}</span>}
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300">{res.scenario}</span>
            <span className="text-slate-500 dark:text-slate-400">{t.checkedIn} {(res.ms / 1000).toLocaleString(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} {t.seconds}</span>
          </div>
        )}
      </div>
    </div>
  );
}

const LEVEL_ORDER: Level[] = ['error', 'warning', 'information'];


function Findings({ findings }: { findings: Finding[] }) {
  const { t, lang } = useI18n();
  if (!findings.length) return <p className="py-6 text-center text-slate-500 dark:text-slate-400">{t.noFindings}</p>;
  const label: Record<Level, string> = { error: t.errors, warning: t.warnings, information: t.infos };
  const dot: Record<Level, string> = { error: 'bg-rose-500', warning: 'bg-amber-500', information: 'bg-sky-500' };
  return (
    <div className="space-y-6">
      {LEVEL_ORDER.filter((l) => findings.some((f) => f.level === l)).map((level) => (
        <section key={level}>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <span className={`size-2 rounded-full ${dot[level]}`} aria-hidden="true" />{label[level]}
          </h3>
          <ul className="space-y-2">
            {findings.filter((f) => f.level === level).map((f, i) => (
              <li key={f.code + i} className="animate-rise" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                <details className="group rounded-2xl border border-slate-200 bg-white transition-shadow hover:shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <summary className="flex items-start gap-3 p-4">
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{plainTitle(f.code, lang) ?? f.text}</span>
                      <span className="mt-1 inline-block rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">{f.code === 'XSD' ? 'Schema' : f.code}</span>
                    </span>
                    <IconChevron className="mt-0.5 size-5 shrink-0 text-slate-400 transition-transform duration-300 group-open:rotate-180" />
                  </summary>
                  <div className="details-body border-t border-slate-100 px-4 pb-4 pt-3 text-sm dark:border-slate-800">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{t.officialText}</p>
                    <p className="mt-1 text-slate-700 dark:text-slate-300">{f.text}</p>
                    {f.location && (
                      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400"><span className="font-semibold">{t.where}:</span> <span className="break-all font-mono">{shortLocation(f.location)?.replace(/^line /, `${t.line} `)}</span></p>
                    )}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function ResultPanel({ r, onRetry }: { r: FileResult; onRetry?: () => void }) {
  const { t } = useI18n();
  const canView = r.state === 'done' && r.result?.syntax && r.xml;
  // Until the user picks a tab, invalid invoices open on the findings and valid ones on the invoice.
  const [chosen, setTab] = useState<'view' | 'findings' | null>(null);
  const [printer, setPrinter] = useState<(() => void) | null>(null);
  // Stable card height from the start of a check through the verdict, so content below does not jump (CLS).
  const reserve = r.state === 'checking' || (r.state === 'done' && Boolean(r.result?.scenario));
  const tab = chosen ?? (r.result?.status === 'invalid' ? 'findings' : 'view');
  const active = canView ? tab : 'findings';

  return (
    <article className={`animate-rise overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 ${reserve ? 'min-h-[70vh]' : ''}`}>
      <div className={`h-1 ${r.state === 'checking' ? 'bg-brand-500' : TONE_STYLES[tone(r)].bar}`} />
      {/* Reserve the verdict's height while checking, so the tabs and invoice view below do not jump (CLS). */}
      <div className={`p-5 sm:p-7 ${reserve ? 'min-h-72 sm:min-h-48' : ''}`}>
        <p className="mb-4 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400"><IconFile className="size-4" /><span className="truncate">{r.name}</span></p>
        {r.state === 'checking' ? <Progress step={r.step} /> : <Verdict r={r} onRetry={onRetry} />}
      </div>
      {r.state === 'checking' && (
        // Same footprint as the result section below (tab row + 640px panel), so nothing jumps when it arrives.
        <div className="border-t border-slate-200 dark:border-slate-800" aria-hidden="true">
          <div className="px-5 pt-4 sm:px-7"><div className="h-12 w-72 max-w-full animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" /></div>
          <div className="p-5 sm:p-7"><div className="h-160 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" /></div>
        </div>
      )}
      {r.state === 'done' && r.result?.scenario && (
        <div className="border-t border-slate-200 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 sm:px-7">
            {canView && (
              <div role="tablist" aria-label={t.tabView} className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                {(['view', 'findings'] as const).map((id) => (
                  <button
                    key={id}
                    id={`tab-${r.id}-${id}`}
                    role="tab"
                    type="button"
                    aria-selected={active === id}
                    aria-controls={`panel-${r.id}`}
                    tabIndex={active === id ? 0 : -1}
                    onClick={() => setTab(id)}
                    onKeyDown={(e) => {
                      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
                      const next = id === 'view' ? 'findings' : 'view';
                      setTab(next);
                      document.getElementById(`tab-${r.id}-${next}`)?.focus();
                    }}
                    className={`min-h-11 rounded-lg px-4 text-sm font-medium transition-all duration-200 ${active === id ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'}`}
                  >
                    {id === 'view' ? t.tabView : `${t.tabFindings} (${r.result!.findings.length})`}
                  </button>
                ))}
              </div>
            )}
            {active === 'view' && printer && (
              <button type="button" onClick={printer} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-medium transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                <IconPrinter className="size-4" />{t.print}
              </button>
            )}
          </div>
          <div className="min-h-[calc(40rem+2.5rem)] p-5 sm:min-h-[calc(40rem+3.5rem)] sm:p-7" role="tabpanel" id={`panel-${r.id}`} aria-labelledby={`tab-${r.id}-${active}`}>
            {active === 'view' && canView
              ? <InvoiceFrame xml={r.xml!} syntax={r.result!.syntax!} onPrintReady={(fn) => setPrinter(() => fn)} />
              : <Findings findings={r.result!.findings} />}
          </div>
        </div>
      )}
    </article>
  );
}
