import { useEffect, useState, type ReactNode } from 'react';
import { setStatsOptOut, statsOptedOut } from '../analytics';
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
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 [&_h1]:text-3xl [&_h1]:font-bold [&_h1]:hyphens-auto [&_h1]:break-words [&_p]:break-words [&_h1]:tracking-tight [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:mt-2 [&_p]:leading-relaxed [&_p]:text-slate-700 dark:[&_p]:text-slate-300 [&_pre]:mt-3 [&_pre]:whitespace-pre-wrap [&_pre]:break-words [&_pre]:rounded-xl [&_pre]:bg-slate-100 [&_pre]:p-4 [&_pre]:text-xs dark:[&_pre]:bg-slate-900 [&_li]:mt-1">
      {children}
    </div>
  );
}

function StatsSwitch() {
  const { lang } = useI18n();
  const [off, setOff] = useState(statsOptedOut);
  const label = lang === 'de' ? 'Anonyme Statistik auf diesem Gerät abschalten' : 'Turn off anonymous statistics on this device';
  return (
    <label className="mt-6 flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <input type="checkbox" className="size-5 accent-brand-600" checked={off} onChange={(e) => { setStatsOptOut(e.target.checked); setOff(e.target.checked); }} />
      <span className="font-medium">{label}</span>
    </label>
  );
}

const MIT = `Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`;

function Licences() {
  const { lang } = useI18n();
  const [saxon, setSaxon] = useState('');
  useEffect(() => { fetch(`/vendor/LICENSE-SaxonJS.txt?v=${__RULES_VERSION__}`).then((r) => r.text()).then(setSaxon).catch(() => {}); }, []);
  const rows: [string, string, string][] = [
    ['KoSIT XRechnung validator configuration, schematron and visualization', 'Apache-2.0', 'https://github.com/itplr-kosit'],
    ['CEN/TC 434 EN 16931 validation artefacts', 'EUPL-1.2', 'https://github.com/ConnectingEurope/eInvoicing-EN16931'],
    ['SaxonJS 2.7 (Saxonica Ltd)', 'Saxonica licence (freeware, see below)', 'https://www.saxonica.com/saxonjs/'],
    ['xmllint-wasm / libxml2', 'MIT', 'https://github.com/noppa/xmllint-wasm'],
    ['PDF.js (Mozilla)', 'Apache-2.0', 'https://mozilla.github.io/pdf.js/'],
    ['FileSaver.js (in the KoSIT visualization)', 'MIT', 'https://github.com/eligrey/FileSaver.js'],
    ['React, React DOM', 'MIT', 'https://react.dev'],
    ['Workbox (service worker, via vite-plugin-pwa)', 'MIT', 'https://github.com/GoogleChrome/workbox'],
    ['Tailwind CSS', 'MIT', 'https://tailwindcss.com'],
    ['Inter typeface (Fontsource)', 'SIL Open Font License 1.1', 'https://rsms.me/inter/'],
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
      <h2>MIT License (React, Workbox, Tailwind CSS, FileSaver.js, xmllint-wasm/libxml2)</h2>
      <pre>{MIT}</pre>
      <h2>Apache License 2.0 / EUPL 1.2</h2>
      <p><a className="underline underline-offset-4" href="https://www.apache.org/licenses/LICENSE-2.0" rel="noopener noreferrer">Apache License 2.0</a> · <a className="underline underline-offset-4" href="https://interoperable-europe.ec.europa.eu/collection/eupl/eupl-text-eupl-12" rel="noopener noreferrer">EUPL 1.2</a></p>
      <h2>SaxonJS</h2>
      <pre>{saxon || '…'}</pre>
    </Prose>
  );
}

export function LegalPage({ page }: { page: 'impressum' | 'datenschutz' | 'lizenzen' }) {
  const { t, lang } = useI18n();
  return (
    <main id="main" tabIndex={-1} className="animate-fade outline-none">
      <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-6">
        <a href="#" className="text-sm font-medium text-brand-600 underline-offset-4 hover:underline dark:text-brand-100">← {t.back}</a>
      </div>
      {page === 'lizenzen' ? <Licences /> : <Prose>{page === 'impressum' ? IMPRESSUM[lang] : <>{PRIVACY[lang]}<StatsSwitch /></>}</Prose>}
    </main>
  );
}

export function Footer({ rules }: { rules: string }) {
  const { t } = useI18n();
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-slate-500 sm:px-6 md:flex-row md:items-center md:justify-between dark:text-slate-400">
        <p className="max-w-xl">{t.footerIndependent}</p>
        <nav className="flex flex-wrap items-center gap-x-5" aria-label="Footer">
          <a className="inline-flex min-h-11 items-center hover:text-slate-900 dark:hover:text-white" href="#impressum">{t.impressum}</a>
          <a className="inline-flex min-h-11 items-center hover:text-slate-900 dark:hover:text-white" href="#datenschutz">{t.privacy}</a>
          <a className="inline-flex min-h-11 items-center hover:text-slate-900 dark:hover:text-white" href="#lizenzen">{t.licences}</a>
          <span className="inline-flex min-h-11 items-center">{t.rulesVersion}: {rules}</span>
        </nav>
      </div>
    </footer>
  );
}
