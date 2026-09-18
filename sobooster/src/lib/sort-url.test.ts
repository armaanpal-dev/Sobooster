import { describe, expect, it } from 'vitest';
import { activeFacets, DEFAULT_CONFIG } from '../config/appConfig';
import { EMPTY_FILTERS, type FacetValues, type Product } from '../types';
import { sortProducts } from './sort';
import { buildSlugIndex, parseSearchState, serializeSearchState, toSearchString } from './url';

const make = (id: number, price: number, title: string, published_at?: string): Product => ({
  id,
  title,
  price,
  vendor: 'V',
  product_type: 'T',
  collection: 'C',
  color: [],
  size: [],
  availability: true,
  tags: [],
  image: '',
  ...(published_at ? { published_at } : {}),
});

describe('sortProducts', () => {
  const products = [make(3, 20, 'b', '2026-01-01'), make(1, 20, 'a', '2026-03-01'), make(2, 10, 'B', '2026-02-01')];

  it('breaks price ties on id so the order is stable', () => {
    expect(sortProducts(products, 'price_asc').map((p) => p.id)).toEqual([2, 1, 3]);
    expect(sortProducts(products, 'price_desc').map((p) => p.id)).toEqual([1, 3, 2]);
  });

  it('sorts names case-insensitively, ties on id', () => {
    expect(sortProducts(products, 'name_asc').map((p) => p.id)).toEqual([1, 2, 3]);
  });

  it('sorts newest first by publish date', () => {
    expect(sortProducts(products, 'newest').map((p) => p.id)).toEqual([1, 2, 3]);
  });

  it('keeps input order for featured and never mutates the input', () => {
    expect(sortProducts(products, 'featured').map((p) => p.id)).toEqual([3, 1, 2]);
    expect(products.map((p) => p.id)).toEqual([3, 1, 2]);
  });
});

describe('url state', () => {
  const facets = activeFacets(DEFAULT_CONFIG);
  const facetValues: FacetValues = {
    collection: ['Prom Dresses'],
    vendor: ['Velvet & Vine'],
    color: ['Black', 'Red'],
    size: ['M'],
    availability: ['In stock', 'Out of stock'],
  };
  const index = buildSlugIndex(facetValues);

  it('round-trips the documented URL shape', () => {
    const search = '?q=dress&collection=prom-dresses&color=black,red&size=m&min_price=100&max_price=200&sort=price_asc';
    const state = parseSearchState(new URLSearchParams(search), index, facets);

    expect(state.filters.values.color).toEqual(['Black', 'Red']);
    expect(state.filters.values.collection).toEqual(['Prom Dresses']);
    expect(state.filters.minPrice).toBe(100);
    expect(toSearchString(serializeSearchState(state, facets))).toBe(search);
  });

  it("drops unknown values and malformed input, and ignores Shopify's own params", () => {
    const state = parseSearchState(
      new URLSearchParams('color=black,chartreuse&min_price=abc&sort=random&vendor=velvet-and-vine&type=product'),
      index,
      facets,
    );
    expect(state.filters.values).toEqual({ color: ['Black'], vendor: ['Velvet & Vine'] });
    expect(state.filters.minPrice).toBeNull();
    expect(state.sort).toBe('featured');
  });

  it('omits the configured default sort, so the empty state is the bare path', () => {
    const state = { query: ' ', filters: EMPTY_FILTERS, sort: 'newest' as const };
    expect(toSearchString(serializeSearchState(state, facets, 'newest'))).toBe('');
    expect(parseSearchState(new URLSearchParams(''), index, facets, 'newest').sort).toBe('newest');
  });
});
