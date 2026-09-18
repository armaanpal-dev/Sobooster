import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';

/**
 * Where search/filter/sort state lives: the page URL. Components read and
 * write it through this interface, so the same UI runs under react-router
 * (standalone demo) and on a Shopify storefront page (plain History API).
 */
export interface UrlState {
  /** Query string without the leading "?". */
  search: string;
  /** Replace the query string, keeping the current path. */
  navigate: (search: string, options: { replace: boolean }) => void;
}

const UrlContext = createContext<UrlState | null>(null);

export function UrlStateProvider({ value, children }: { value: UrlState; children: ReactNode }) {
  return <UrlContext.Provider value={value}>{children}</UrlContext.Provider>;
}

export function useUrlState(): UrlState {
  const state = useContext(UrlContext);
  if (!state) throw new Error('useUrlState must be used inside a URL state provider');
  return state;
}

const NAVIGATE_EVENT = 'sobooster:navigate';

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange);
  window.addEventListener(NAVIGATE_EVENT, onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(NAVIGATE_EVENT, onChange);
  };
}

const readSearch = () => window.location.search.replace(/^\?/, '');

/** Storefront implementation: pushState/replaceState on the current page, popstate for Back/Forward. */
export function HistoryUrlProvider({ children }: { children: ReactNode }) {
  const search = useSyncExternalStore(subscribe, readSearch, () => '');
  const value = useMemo<UrlState>(
    () => ({
      search,
      navigate: (next, { replace }) => {
        const url = `${window.location.pathname}${next}${window.location.hash}`;
        if (replace) window.history.replaceState(window.history.state, '', url);
        else window.history.pushState(window.history.state, '', url);
        window.dispatchEvent(new Event(NAVIGATE_EVENT));
      },
    }),
    [search],
  );
  return <UrlStateProvider value={value}>{children}</UrlStateProvider>;
}
