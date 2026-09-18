import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { AppConfig } from '../config/appConfig';
import { configureCurrency } from '../lib/format';
import './admin.css';
import { loadConfig, saveConfig, type CatalogScan, type LoadedConfig } from './adminApi';
import { FiltersPage } from './FiltersPage';
import { HomePage } from './HomePage';
import { IndexPage } from './IndexPage';
import { SettingsPage } from './SettingsPage';
import { SynonymsPage } from './SynonymsPage';
import { Button, Card, toast } from './ui';

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      /** App Bridge: the app's pages in the Shopify admin's left navigation. */
      'ui-nav-menu': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement>;
    }
  }
}

// ---- Routing: App Bridge's nav menu changes the iframe URL; follow it without a router. ----
const LOCATION_EVENT = 'sobooster:location';
let historyPatched = false;
function patchHistory() {
  if (historyPatched) return;
  historyPatched = true;
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = window.history[method].bind(window.history);
    window.history[method] = (...args: Parameters<History['pushState']>) => {
      original(...args);
      window.dispatchEvent(new Event(LOCATION_EVENT));
    };
  }
}
function subscribe(onChange: () => void) {
  patchHistory();
  window.addEventListener('popstate', onChange);
  window.addEventListener(LOCATION_EVENT, onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(LOCATION_EVENT, onChange);
  };
}
const usePathname = () => useSyncExternalStore(subscribe, () => window.location.pathname);

/** Internal links keep Shopify's query params (shop, host) so a reload still embeds correctly. */
export function navigate(path: string) {
  window.history.pushState(null, '', `${path}${window.location.search}`);
}

const PAGES = [
  { path: '/index', label: 'Index' },
  { path: '/filters', label: 'Filters' },
  { path: '/synonyms', label: 'Synonyms' },
  { path: '/settings', label: 'Settings' },
] as const;

export interface PageProps {
  config: AppConfig;
  update: (change: (draft: AppConfig) => AppConfig) => void;
  shop: LoadedConfig['shop'];
  scan: CatalogScan | null;
  setScan: (scan: CatalogScan) => void;
  /** Saves immediately (used by Rebuild index), bypassing the save bar. */
  saveNow: (config: AppConfig) => Promise<void>;
}

type Load = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; loaded: LoadedConfig };

export function AdminApp() {
  const pathname = usePathname();
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [draft, setDraft] = useState<AppConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [scan, setScan] = useState<CatalogScan | null>(null);

  useEffect(() => {
    loadConfig()
      .then((loaded) => {
        configureCurrency(loaded.shop.currency);
        setLoad({ status: 'ready', loaded });
        setDraft(loaded.config);
      })
      .catch((error: unknown) => setLoad({ status: 'error', message: error instanceof Error ? error.message : String(error) }));
  }, []);

  const saved = load.status === 'ready' ? load.loaded.config : null;
  const dirty = useMemo(() => draft !== null && saved !== null && JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);

  const persist = useCallback(
    async (config: AppConfig) => {
      if (load.status !== 'ready') return;
      setSaving(true);
      try {
        const updatedAt = await saveConfig(load.loaded.installationId, config);
        setLoad({ status: 'ready', loaded: { ...load.loaded, config, updatedAt } });
        setDraft(config);
        toast('Saved. Your storefront uses the new settings on the next page load.');
      } catch (error) {
        toast(error instanceof Error ? error.message : 'Could not save', true);
      } finally {
        setSaving(false);
      }
    },
    [load],
  );

  const update = useCallback((change: (d: AppConfig) => AppConfig) => setDraft((d) => (d ? change(d) : d)), []);

  // Leaving with unsaved changes loses them; warn like the Shopify admin does.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const nav = (
    <ui-nav-menu>
      <a href="/" rel="home">
        Home
      </a>
      {PAGES.map((p) => (
        <a key={p.path} href={p.path}>
          {p.label}
        </a>
      ))}
    </ui-nav-menu>
  );

  if (load.status === 'loading' || !draft) {
    return (
      <main className="sb-admin" aria-busy={load.status === 'loading'}>
        {nav}
        {load.status === 'error' ? (
          <Card title="SoBooster couldn't load its settings">
            <p className="sb-admin__muted">{load.message}</p>
            <p className="sb-admin__muted">
              Open the app from your Shopify admin (Apps → Sobooster). If it still fails, restart <code>shopify app dev</code> so
              the new access scopes are applied.
            </p>
          </Card>
        ) : (
          <p className="sb-admin__muted">Loading…</p>
        )}
      </main>
    );
  }

  const shop = load.status === 'ready' ? load.loaded.shop : { name: '', domain: '', currency: 'USD' };
  const props: PageProps = { config: draft, update, shop, scan, setScan, saveNow: persist };
  const page = PAGES.find((p) => pathname.startsWith(p.path));

  return (
    <main className="sb-admin">
      {nav}
      {dirty && (
        <div className="sb-admin__savebar" role="region" aria-label="Unsaved changes">
          <span>Unsaved changes</span>
          <div className="sb-admin__row">
            <Button onClick={() => saved && setDraft(saved)} disabled={saving}>
              Discard
            </Button>
            <Button variant="primary" onClick={() => void persist(draft)} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      )}
      <nav className="sb-admin__tabs" aria-label="SoBooster sections">
        {[{ path: '/', label: 'Home' }, ...PAGES].map((p) => {
          const current = p.path === '/' ? !page : page?.path === p.path;
          return (
            <a
              key={p.path}
              href={p.path}
              aria-current={current ? 'page' : undefined}
              onClick={(event) => {
                event.preventDefault();
                navigate(p.path);
              }}
            >
              {p.label}
            </a>
          );
        })}
      </nav>
      {page?.path === '/index' && <IndexPage {...props} />}
      {page?.path === '/filters' && <FiltersPage {...props} />}
      {page?.path === '/synonyms' && <SynonymsPage {...props} />}
      {page?.path === '/settings' && <SettingsPage {...props} />}
      {!page && <HomePage {...props} />}
    </main>
  );
}
