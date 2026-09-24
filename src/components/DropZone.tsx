import { useRef, useState, type DragEvent } from 'react';
import { useI18n } from '../i18n';
import { IconUpload } from './icons';

export function DropZone({ onFiles, compact = false }: { onFiles: (files: File[]) => void; compact?: boolean }) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const depth = useRef(0);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    depth.current = 0;
    setOver(false);
    const files = [...e.dataTransfer.files];
    if (files.length) onFiles(files);
  };

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault();
        depth.current++;
        setOver(true);
        // A PDF is on its way: start loading the PDF engine now, before the drop.
        if ([...e.dataTransfer.items].some((i) => i.type === 'application/pdf')) void import('../engine/pdf').then((m) => m.prefetchPdfEngine());
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={() => { depth.current = Math.max(0, depth.current - 1); if (!depth.current) setOver(false); }}
      onDrop={onDrop}
      className={[
        'relative rounded-3xl border-2 border-dashed text-center transition-all duration-300 ease-out',
        compact ? 'px-4 py-5' : 'px-6 py-10 sm:py-14',
        over
          ? 'scale-[1.01] border-brand-500 bg-brand-50 shadow-lg shadow-brand-500/10 dark:bg-brand-500/10'
          : 'border-slate-300 bg-white/70 hover:border-brand-500/60 dark:border-slate-700 dark:bg-slate-900/60',
      ].join(' ')}
    >
      <div className={`mx-auto grid place-items-center rounded-2xl bg-brand-600 text-white shadow-md transition-transform duration-300 ${compact ? 'mb-2 size-10' : 'mb-4 size-14'} ${over ? '-translate-y-1 scale-110' : ''}`}>
        <IconUpload className={compact ? 'size-5' : 'size-7'} />
      </div>
      <p className={`font-semibold ${compact ? 'text-base' : 'text-lg sm:text-xl'}`} aria-live="polite">
        {over ? t.dropActive : t.dropTitle}
      </p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        <span className="hidden sm:inline">{t.dropOr} </span>
        <button
          type="button"
          onClick={() => input.current?.click()}
          className="mt-2 inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-5 font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-md active:translate-y-0 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 sm:mt-0 sm:ml-1"
        >
          {t.dropButton}
        </button>
      </p>
      {!compact && <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">{t.dropHint}</p>}
      <input
        ref={input}
        type="file"
        accept=".xml,.pdf,application/xml,text/xml,application/pdf"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => { const f = [...(e.target.files ?? [])]; if (f.length) onFiles(f); e.target.value = ''; }}
      />
    </div>
  );
}
