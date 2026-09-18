import { useCallback, useMemo } from 'react';
import { useCatalog } from '../catalog';
import { runQuery } from '../lib/query';
import { parseSearchState, serializeSearchState, toSearchString, type SearchState } from '../lib/url';
import type { Filters, SortKey } from '../types';
import { useUrlState } from '../url-state';

/**
 * The URL is the only store of search, filter and sort state. This hook parses
 * it, runs the single derivation, and writes changes back to it.
 *
 * History policy: typing replaces the current entry; filter and sort changes
 * push a new one, so Back steps through filter changes, not keystrokes.
 */
export function useProductQuery() {
  const { products, facets, facetValues, slugIndex, matcher, config } = useCatalog();
  const defaultSort = config.layout.defaultSort;
  const { search, navigate } = useUrlState();

  const state = useMemo(
    () => parseSearchState(new URLSearchParams(search), slugIndex, facets, defaultSort),
    [search, slugIndex, facets, defaultSort],
  );

  const result = useMemo(
    () => runQuery(products, facets, facetValues, matcher, state.filters, state.query, state.sort),
    [products, facets, facetValues, matcher, state],
  );

  const commit = useCallback(
    (next: SearchState, replace: boolean) =>
      navigate(toSearchString(serializeSearchState(next, facets, defaultSort)), { replace }),
    [navigate, facets, defaultSort],
  );

  const setQuery = useCallback(
    (query: string) => {
      if (query.trim() !== state.query) commit({ ...state, query }, true);
    },
    [commit, state],
  );

  /** A committed search (Enter, a suggestion) is its own history entry. */
  const submitQuery = useCallback((query: string) => commit({ ...state, query }, false), [commit, state]);

  const setFilters = useCallback((filters: Filters) => commit({ ...state, filters }, false), [commit, state]);

  const toggleValue = useCallback(
    (facetKey: string, value: string) => {
      const current = state.filters.values[facetKey] ?? [];
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      setFilters({ ...state.filters, values: { ...state.filters.values, [facetKey]: next } });
    },
    [setFilters, state.filters],
  );

  const setPriceRange = useCallback(
    (minPrice: number | null, maxPrice: number | null) => setFilters({ ...state.filters, minPrice, maxPrice }),
    [setFilters, state.filters],
  );

  const setSort = useCallback((sort: SortKey) => commit({ ...state, sort }, false), [commit, state]);

  const clearAll = useCallback(() => navigate('', { replace: false }), [navigate]);


  return { ...state, ...result, searchKey: search, setQuery, submitQuery, toggleValue, setPriceRange, setSort, clearAll };
}
