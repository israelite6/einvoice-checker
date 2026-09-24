import { useEffect, useState, type ReactNode } from 'react';
import { FAQ, IMPRESSUM, PRIVACY } from '../content';
import { useI18n } from '../i18n';
import { IconChevron } from './icons';

export function Faq() {
  const { t, lang } = useI18n();
  return (
    <section aria-labelledby="faq" className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h2 id="faq" className="text-2xl font-bold tracking-tight sm:text-3xl">{t.faqTitle}</h2>
      <div className="mt-6 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
        {FAQ[lang].map((item) => (
          <details key={item.q} className="group">
            <summary className="flex min-h-14 items-center justify-between gap-4 px-5 py-4 font-medium">
              {item.q}
              <IconChevron className="size-5 shrink-0 text-slate-400 transition-transform duration-300 group-open:rotate-180" />
            </summary>
            <div className="details-body px-5 pb-5 text-slate-600 dark:text-slate-300">{item.a}</div>
          </details>
        ))}
      </div>
    </section>
  );
}

function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:mt-2 [&_p]:leading-relaxed [&_p]:text-slate-700 dark:[&_p]:text-slate-300 [&_pre]:mt-3 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-slate-100 [&_pre]:p-4 [&_pre]:text-xs dark:[&_pre]:bg-slate-900 [&_li]:mt-1">
      {children}
    </div>
  );
}

function Licences() {
  const { lang } = useI18n();
  const [saxon, setSaxon] = useState('');
  useEffect(() => { fetch('/vendor/LICENSE-SaxonJS.txt').then((r) => r.text()).then(setSaxon).catch(() => {}); }, []);
  const rows: [string, string, string][] = [
    ['KoSIT XRechnung validator configuration, schematron and visualization', 'Apache-2.0', 'https://github.com/itplr-kosit'],
    ['CEN/TC 434 EN 16931 validation artefacts', 'EUPL-1.2', 'https://github.com/ConnectingEurope/eInvoicing-EN16931'],
    ['SaxonJS 2.7 (Saxonica Ltd)', 'Saxonica licence (freeware, see below)', 'https://www.saxonica.com/saxonjs/'],
    ['xmllint-wasm / libxml2', 'MIT', 'https://github.com/noppa/xmllint-wasm'],
    ['React', 'MIT', 'https://react.dev'],
    ['Inter typeface', 'SIL Open Font License 1.1', 'https://rsms.me/inter/'],
  ];
  return (
    <Prose>
      <h1>{lang === 'de' ? 'Lizenzen' : 'Licences'}</h1>
      <p>{lang === 'de'
        ? 'Dieses Werkzeug nutzt die folgenden Komponenten. Die offiziellen Prüfregeln werden unverändert verwendet. Die für SaxonJS kompilierten EN-16931-Regeln stehen unter der EUPL-1.2.'
        : 'This tool uses the following components. The official validation rules are used unmodified. The EN 16931 rules compiled for SaxonJS are licensed under EUPL-1.2.'}</p>
      <ul className="mt-4 list-disc pl-5">
        {rows.map(([n, l, u]) => <li key={n}><a className="underline underline-offset-4" href={u} rel="noopener noreferrer">{n}</a> — {l}</li>)}
      </ul>
      <h2>SaxonJS</h2>
      <pre>{saxon || '…'}</pre>
    </Prose>
  );
}

export function LegalPage({ page }: { page: 'impressum' | 'datenschutz' | 'lizenzen' }) {
  const { t, lang } = useI18n();
  return (
    <main id="main" className="animate-fade">
      <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-6">
        <a href="#" className="text-sm font-medium text-brand-600 underline-offset-4 hover:underline dark:text-brand-100">← {t.back}</a>
      </div>
      {page === 'lizenzen' ? <Licences /> : <Prose>{page === 'impressum' ? IMPRESSUM[lang] : PRIVACY[lang]}</Prose>}
    </main>
  );
}

export function Footer({ rules }: { rules: string }) {
  const { t } = useI18n();
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-slate-500 sm:px-6 md:flex-row md:items-center md:justify-between dark:text-slate-400">
        <p className="max-w-xl">{t.footerIndependent}</p>
        <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Footer">
          <a className="hover:text-slate-900 dark:hover:text-white" href="#impressum">{t.impressum}</a>
          <a className="hover:text-slate-900 dark:hover:text-white" href="#datenschutz">{t.privacy}</a>
          <a className="hover:text-slate-900 dark:hover:text-white" href="#lizenzen">{t.licences}</a>
          <span>{t.rulesVersion}: {rules}</span>
        </nav>
      </div>
    </footer>
  );
}
