// Thin typed access to the SaxonJS browser runtime (loaded as a classic script from /vendor).
// SaxonJS is Saxonica freeware: shipped unmodified, never committed (see README).

export interface SaxonNode {
  getAttribute(name: string): string | null;
  textContent: string | null;
}

interface SaxonJSApi {
  getResource(opts: { text?: string; location?: string; type: 'xml' | 'json' | 'text' }): Promise<unknown>;
  transform(opts: Record<string, unknown>, mode: 'async'): Promise<{ principalResult: unknown }>;
  XPath: {
    evaluate(xpath: string, context: unknown, opts?: { namespaceContext?: Record<string, string>; resultForm?: 'array' | 'default' }): unknown;
  };
  serialize(node: unknown, opts?: Record<string, unknown>): string;
}

declare global {
  interface Window { SaxonJS?: SaxonJSApi }
}

let loading: Promise<SaxonJSApi> | null = null;

export function saxon(): Promise<SaxonJSApi> {
  if (window.SaxonJS) return Promise.resolve(window.SaxonJS);
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `/vendor/SaxonJS2.rt.js?v=${__RULES_VERSION__}`;
    s.async = true;
    s.onload = () => (window.SaxonJS ? resolve(window.SaxonJS) : reject(new Error('SaxonJS failed to initialise')));
    s.onerror = () => { s.remove(); reject(new Error('SaxonJS failed to load')); };
    document.head.appendChild(s);
  });
  // A failed load must not be cached: the next check retries (e.g. after reconnecting).
  loading.catch(() => { loading = null; });
  return loading;
}
