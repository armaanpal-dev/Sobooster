import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { buildCatalog, CatalogProvider, type Catalog } from '../catalog';
import { InstantResults } from '../components/InstantResults';
import { configureCurrency } from '../lib/format';
import { clearRecentSearches, readRecentSearches, saveRecentSearch } from '../lib/suggest';
import { StoreServicesProvider } from '../services';
import { createStoreServices } from './cart';
import type { StorefrontConfig } from './config';
import { loadProducts } from './loadProducts';

declare global {
  interface Window {
    /** Opens the instant-search overlay (called by the embed's inline loader). */
    __soboosterOpenSearch?: () => void;
    /** Set by the loader when the shopper clicked search before this script had loaded. */
    __soboosterPendingOpen?: boolean;
  }
}

type LoadState = { status: 'idle' | 'loading' | 'error' } | { status: 'ready'; catalog: Catalog };

/**
 * The theme's header search, replaced: a full-width panel with the search box,
 * a "Suggestions:" row, product results, store pages and "View all search
 * results". Built on a modal <dialog>, so focus is trapped, Escape and the
 * backdrop close it, and focus returns to the search icon afterwards.
 */
export function SearchOverlay({ config }: { config: StorefrontConfig }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [state, setState] = useState<LoadState>({ status: 'idle' });
  const [recent, setRecent] = useState<string[]>(() => (config.app.search.recentSearches ? readRecentSearches() : []));

  const services = useMemo(
    () => createStoreServices({ rootUrl: config.rootUrl, cartUrl: config.cartUrl, cart: config.app.cart }),
    [config],
  );
  const searchUrl = `${config.rootUrl.replace(/\/$/, '')}/search`;

  const show = useCallback(() => setOpen(true), []);

  // Expose open() to the inline loader, and honour a click that happened while this script loaded.
  useEffect(() => {
    window.__soboosterOpenSearch = show;
    if (window.__soboosterPendingOpen) {
      window.__soboosterPendingOpen = false;
      show();
    }
    return () => {
      if (window.__soboosterOpenSearch === show) delete window.__soboosterOpenSearch;
    };
  }, [show]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      inputRef.current?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // The catalogue loads on first open (shared session cache with the search page).
  useEffect(() => {
    if (!open || state.status !== 'idle') return;
    setState({ status: 'loading' });
    loadProducts(config)
      .then(({ products, currencyCode }) => {
        configureCurrency(currencyCode, config.locale ?? undefined);
        setState({ status: 'ready', catalog: buildCatalog(products, config.app) });
      })
      .catch(() => setState({ status: 'error' }));
  }, [open, state.status, config]);

  const search = (query: string) => {
    const q = query.trim();
    if (!q) return;
    if (config.app.search.recentSearches) setRecent(saveRecentSearch(q));
    window.location.assign(`${searchUrl}?q=${encodeURIComponent(q)}`);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    search(value);
  };

  return (
    <dialog
      ref={dialogRef}
      className="sb-overlay"
      aria-label="Search"
      onClose={() => setOpen(false)}
      onClick={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <div className="sb-overlay__panel">
        <form className="sb-overlay__form" role="search" action={searchUrl} onSubmit={submit}>
          <label htmlFor={inputId} className="sb-visually-hidden">
            Search
          </label>
          <input
            ref={inputRef}
            id={inputId}
            name="q"
            type="search"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="Search"
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" className="sb-overlay__submit" aria-label="Search">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M10.5 3a7.5 7.5 0 0 1 5.96 12.05l4.25 4.24-1.42 1.42-4.24-4.25A7.5 7.5 0 1 1 10.5 3Zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z" />
            </svg>
          </button>
        </form>
        <button type="button" className="sb-overlay__close" aria-label="Close search" onClick={() => setOpen(false)}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5.3 4 12 10.6 18.7 4 20 5.3 13.4 12l6.6 6.7-1.3 1.3-6.7-6.6L5.3 20 4 18.7l6.6-6.7L4 5.3 5.3 4Z" />
          </svg>
        </button>

        <div className="sb-overlay__body">
          {state.status === 'ready' && (
            <CatalogProvider catalog={state.catalog}>
              <StoreServicesProvider value={services}>
                <InstantResults
                  text={value}
                  onSearch={search}
                  recent={recent}
                  onClearRecent={() => {
                    clearRecentSearches();
                    setRecent([]);
                  }}
                />
              </StoreServicesProvider>
            </CatalogProvider>
          )}
          {(state.status === 'loading' || state.status === 'idle') && (
            <div className="sb-skeleton sb-overlay__skeleton" aria-hidden="true">
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} />
              ))}
            </div>
          )}
          {state.status === 'error' && <p className="sb-status">Search is unavailable right now. Press Enter to search the store.</p>}
        </div>
      </div>
    </dialog>
  );
}
