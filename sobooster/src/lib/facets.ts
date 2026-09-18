import type { FacetCounts, FacetDef, FacetValues, Filters, PriceBounds, Product } from '../types';
import { valuesOf } from './facetValues';
import { failingFacets } from './filter';
import { defaultMatcher, type Matcher } from './search';

export interface FacetResult {
  /** Products matching search and every facet, in input order. */
  results: Product[];
  /** Per facet: value -> products it would yield, ignoring that facet's own selection. */
  counts: FacetCounts;
  /** Price span of products matching everything except the price range; null if none. */
  priceBounds: PriceBounds | null;
}

/**
 * The facet-count rule:
 *
 *   countsFor(facet) = products matching search + every filter EXCEPT `facet`
 *
 * Without the exception, selecting Colour=Black would show every other colour
 * as 0 and the shopper could never widen the selection.
 *
 * This is one pass over the products rather than one filter run per facet:
 * - fails no facet      -> a result, and counts towards every facet
 * - fails exactly one F -> not a result, but still counts towards F, because
 *                          F's own selection is ignored when counting F
 * - fails two or more   -> counts nowhere
 */
export function computeFacets(
  products: readonly Product[],
  filters: Filters,
  query: string,
  facets: readonly FacetDef[],
  facetValues: FacetValues,
  matcher: Matcher = defaultMatcher,
): FacetResult {
  const valueFacets = facets.filter((f) => f.source !== 'price');
  const priceKey = facets.find((f) => f.source === 'price')?.key;
  const byKey = new Map(valueFacets.map((f) => [f.key, f]));

  const counts: FacetCounts = {};
  for (const facet of valueFacets) counts[facet.key] = new Map((facetValues[facet.key] ?? []).map((value) => [value, 0]));

  const tally = (product: Product, facet: FacetDef) => {
    const map = counts[facet.key];
    if (!map) return;
    for (const value of valuesOf(product, facet)) map.set(value, (map.get(value) ?? 0) + 1);
  };

  const groups = matcher.expand(query);
  const results: Product[] = [];
  let min = Infinity;
  let max = -Infinity;

  for (const product of products) {
    if (!matcher.matches(product, groups)) continue;
    const failing = failingFacets(product, filters, facets);
    const [onlyFailure] = failing;

    if (failing.length === 0) {
      results.push(product);
      for (const facet of valueFacets) tally(product, facet);
    } else if (failing.length === 1 && onlyFailure !== undefined) {
      const facet = byKey.get(onlyFailure);
      if (facet) tally(product, facet);
    }

    if (failing.length === 0 || (failing.length === 1 && onlyFailure === priceKey)) {
      min = Math.min(min, product.price);
      max = Math.max(max, product.price);
    }
  }

  return { results, counts, priceBounds: min <= max ? { min, max } : null };
}
