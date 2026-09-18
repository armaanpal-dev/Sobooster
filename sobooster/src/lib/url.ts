import { SORT_KEYS, type FacetDef, type FacetValues, type Filters, type SortKey } from '../types';

export interface SearchState {
  query: string;
  filters: Filters;
  sort: SortKey;
}

/** facet key -> (url slug -> value), e.g. collection: "prom-dresses" -> "Prom Dresses". */
export type SlugIndex = Record<string, Map<string, string>>;

export const QUERY_PARAM = 'q';
const MIN_PRICE_PARAM = 'min_price';
const MAX_PRICE_PARAM = 'max_price';
const SORT_PARAM = 'sort';

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '');
}

export function buildSlugIndex(facetValues: FacetValues): SlugIndex {
  const index: SlugIndex = {};
  for (const [key, values] of Object.entries(facetValues)) {
    index[key] = new Map(values.map((value) => [slugify(value), value]));
  }
  return index;
}

function parsePrice(raw: string | null): number | null {
  if (raw === null || raw.trim() === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/**
 * URL -> state. Unknown slugs, unknown facets and malformed numbers are dropped
 * rather than erroring, so a stale or hand-edited link still renders.
 */
export function parseSearchState(
  params: URLSearchParams,
  index: SlugIndex,
  facets: readonly FacetDef[],
  defaultSort: SortKey = 'featured',
): SearchState {
  const values: Record<string, string[]> = {};
  for (const facet of facets) {
    if (facet.source === 'price') continue;
    const slugs = (params.get(facet.key) ?? '').split(',').filter(Boolean);
    const selected = slugs.flatMap((slug) => index[facet.key]?.get(slug) ?? []);
    if (selected.length > 0) values[facet.key] = [...new Set(selected)];
  }

  let minPrice = parsePrice(params.get(MIN_PRICE_PARAM));
  let maxPrice = parsePrice(params.get(MAX_PRICE_PARAM));
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) [minPrice, maxPrice] = [maxPrice, minPrice];

  const rawSort = params.get(SORT_PARAM);
  const sort = SORT_KEYS.find((key) => key === rawSort) ?? defaultSort;

  return { query: params.get(QUERY_PARAM) ?? '', filters: { values, minPrice, maxPrice }, sort };
}

/** State -> URL. Defaults are omitted, so the empty state is the bare path. */
export function serializeSearchState(
  state: SearchState,
  facets: readonly FacetDef[],
  defaultSort: SortKey = 'featured',
): URLSearchParams {
  const params = new URLSearchParams();
  const query = state.query.trim();
  if (query) params.set(QUERY_PARAM, query);
  for (const facet of facets) {
    const selected = state.filters.values[facet.key];
    if (selected && selected.length > 0) params.set(facet.key, selected.map(slugify).join(','));
  }
  if (state.filters.minPrice !== null) params.set(MIN_PRICE_PARAM, String(state.filters.minPrice));
  if (state.filters.maxPrice !== null) params.set(MAX_PRICE_PARAM, String(state.filters.maxPrice));
  if (state.sort !== defaultSort) params.set(SORT_PARAM, state.sort);
  return params;
}

/** URLSearchParams encodes commas as %2C; keep the list separator readable. */
export function toSearchString(params: URLSearchParams): string {
  const search = params.toString().replace(/%2C/gi, ',');
  return search ? `?${search}` : '';
}

export function countActiveFilters(filters: Filters): number {
  const values = Object.values(filters.values).reduce((sum, selected) => sum + selected.length, 0);
  return values + (filters.minPrice !== null || filters.maxPrice !== null ? 1 : 0);
}
