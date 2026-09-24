import { useEffect, useRef, useState } from 'react';
import type { ValidationResult } from '../engine/validate';
import { renderInvoice } from '../engine/visualize';
import helper from '../engine/frame-helper.txt?raw';
import overrides from '../engine/frame-overrides.css?raw';
import { useI18n } from '../i18n';

// The official HTML view is shown in a sandboxed iframe: its scripts run in an opaque origin,
// cannot touch this page, and remain bound by this page's Content-Security-Policy.
export function InvoiceFrame({ xml, syntax, onPrintReady }: {
  xml: string;
  syntax: NonNullable<ValidationResult['syntax']>;
  onPrintReady: (print: () => void) => void;
}) {
  const { t, lang } = useI18n();
  const frame = useRef<HTMLIFrameElement>(null);
  // Rendered output is tagged with its inputs so a language change shows the skeleton, not stale HTML.
  const [out, setOut] = useState<{ key: string; html: string } | null>(null);
  const [height, setHeight] = useState(640);
  const [failed, setFailed] = useState(false);
  const printReady = useRef(onPrintReady);
  useEffect(() => { printReady.current = onPrintReady; });
  const key = `${lang}:${syntax}:${xml.length}`;
  const html = out?.key === key ? out.html : null;

  useEffect(() => {
    let alive = true;
    renderInvoice(xml, syntax, lang)
      .then((h) => { if (alive) setOut({ key: `${lang}:${syntax}:${xml.length}`, html: h.replace('</head>', `<style>${overrides}</style></head>`).replace('</body>', `<script>${helper}</script></body>`) }); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [xml, syntax, lang]);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.source === frame.current?.contentWindow && e.data?.type === 'xr-height') {
        setHeight(Math.min(Math.max(Number(e.data.h) || 0, 320), 20000));
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  useEffect(() => {
    if (html) printReady.current(() => frame.current?.contentWindow?.postMessage('xr-print', '*'));
  }, [html]);

  if (failed) return <p className="text-slate-500">{t.errorGeneric}</p>;
  if (!html) {
    return (
      <div className="space-y-3" role="status" aria-live="polite">
        <span className="sr-only">{t.rendering}</span>
        {[70, 90, 55, 80].map((w, i) => (
          <div key={i} className="h-4 animate-pulse rounded bg-slate-200 dark:bg-slate-800" style={{ width: `${w}%` }} />
        ))}
      </div>
    );
  }
  return (
    <div className="animate-fade overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 dark:ring-slate-700">
      <iframe
        ref={frame}
        title={t.tabView}
        srcDoc={html}
        sandbox="allow-scripts allow-modals allow-downloads"
        className="block w-full border-0 bg-white"
        style={{ height }}
      />
    </div>
  );
}
