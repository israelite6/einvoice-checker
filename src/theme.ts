import { useCallback, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

function systemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function savedTheme(): Theme | null {
  try {
    const v = localStorage.getItem('theme');
    return v === 'light' || v === 'dark' ? v : null;
  } catch { return null; }
}

/** Follows the device theme until the user picks one; the explicit choice is remembered. */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => savedTheme() ?? systemTheme());

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const onChange = () => { if (!savedTheme()) setTheme(systemTheme()); };
    mq?.addEventListener('change', onChange);
    return () => mq?.removeEventListener('change', onChange);
  }, []);

  const toggle = useCallback(() => {
    setTheme((t) => {
      const next: Theme = t === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('theme', next); } catch { /* storage unavailable */ }
      return next;
    });
  }, []);

  return [theme, toggle];
}
