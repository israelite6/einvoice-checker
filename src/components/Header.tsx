import { useI18n } from '../i18n';
import type { Theme } from '../theme';
import { IconMoon, IconSun } from './icons';

export function Header({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  const { t, lang, setLang } = useI18n();
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur-md dark:border-slate-800/70 dark:bg-slate-950/75">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <a href="#" className="group flex items-center gap-2.5 rounded-lg font-semibold tracking-tight" aria-label={t.brand}>
          <span className="grid size-8 place-items-center rounded-lg bg-brand-600 text-white shadow-sm transition-transform duration-300 group-hover:-rotate-6">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M7 3h7l5 5v13H7z" /><path d="M10 14l2 2 4-4" /></svg>
          </span>
          <span className="text-[15px]">{t.brand}</span>
        </a>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setLang(lang === 'de' ? 'en' : 'de')}
            aria-label={t.langSwitchLabel}
            className="h-10 rounded-lg px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <span lang={lang === 'de' ? 'en' : 'de'}>{t.langSwitch}</span>
          </button>
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? t.themeToLight : t.themeToDark}
            title={theme === 'dark' ? t.themeToLight : t.themeToDark}
            className="relative grid size-10 place-items-center overflow-hidden rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <IconSun className={`absolute size-5 transition-all duration-500 ${theme === 'dark' ? 'rotate-0 scale-100 opacity-100' : 'rotate-90 scale-0 opacity-0'}`} />
            <IconMoon className={`absolute size-5 transition-all duration-500 ${theme === 'dark' ? '-rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'}`} />
          </button>
        </div>
      </div>
    </header>
  );
}
