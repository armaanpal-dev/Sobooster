import type { FacetCounts, FacetDef, FacetValues, Filters, PriceBounds, Product, SortKey } from '../types';
import { computeFacets } from './facets';
import type { Matcher } from './search';
import { sortProducts } from './sort';

export interface QueryResult {
  results: Product[];
  counts: FacetCounts;
  priceBounds: PriceBounds | null;
  total: number;
}

/** The whole page as one derivation: search + filter + counts, then sort. */
export function runQuery(
  products: readonly Product[],
  facets: readonly FacetDef[],
  facetValues: FacetValues,
  matcher: Matcher,
  filters: Filters,
  query: string,
  sort: SortKey,
): QueryResult {
  const { results, counts, priceBounds } = computeFacets(products, filters, query, facets, facetValues, matcher);
  return { results: sortProducts(results, sort), counts, priceBounds, total: results.length };
}
