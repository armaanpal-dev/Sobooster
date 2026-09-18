import type { FacetDef, Filters, Product } from '../types';
import { valuesOf } from './facetValues';
import { defaultMatcher, type Matcher } from './search';

export function matchesValueFacet(product: Product, facet: FacetDef, selected: readonly string[] | undefined): boolean {
  if (!selected || selected.length === 0) return true;
  return valuesOf(product, facet).some((value) => selected.includes(value));
}

export function matchesPrice(product: Product, filters: Filters): boolean {
  if (filters.minPrice !== null && product.price < filters.minPrice) return false;
  if (filters.maxPrice !== null && product.price > filters.maxPrice) return false;
  return true;
}

/** Keys of the facets a product fails under the current filters (search not included). */
export function failingFacets(product: Product, filters: Filters, facets: readonly FacetDef[]): string[] {
  const failing: string[] = [];
  for (const facet of facets) {
    const passes = facet.source === 'price' ? matchesPrice(product, filters) : matchesValueFacet(product, facet, filters.values[facet.key]);
    if (!passes) failing.push(facet.key);
  }
  return failing;
}

/**
 * Search AND every facet, OR within a facet. Preserves input order.
 * `except` ignores one facet's selection.
 */
export function applyFilters(
  products: readonly Product[],
  filters: Filters,
  query: string,
  facets: readonly FacetDef[],
  options: { except?: string; matcher?: Matcher } = {},
): Product[] {
  const matcher = options.matcher ?? defaultMatcher;
  const groups = matcher.expand(query);
  return products.filter(
    (product) =>
      matcher.matches(product, groups) && failingFacets(product, filters, facets).every((key) => key === options.except),
  );
}
