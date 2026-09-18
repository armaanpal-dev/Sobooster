import { describe, expect, it } from 'vitest';
import { activeFacets, DEFAULT_CONFIG } from '../config/appConfig';
import { EMPTY_FILTERS, type FacetDef, type Filters, type Product } from '../types';
import { collectFacetValues, valuesOf } from './facetValues';
import { computeFacets } from './facets';
import { applyFilters } from './filter';
import { createMatcher } from './search';

function product(overrides: Partial<Product> & Pick<Product, 'id'>): Product {
  return {
    title: `Product ${overrides.id}`,
    price: 50,
    vendor: 'Vendor A',
    product_type: 'Dress',
    collection: 'Dresses',
    color: ['Black'],
    size: ['M'],
    availability: true,
    tags: [],
    image: '',
    ...overrides,
  };
}

const products: Product[] = [
  product({ id: 1, color: ['Black'], size: ['S', 'M'], vendor: 'Vendor A', price: 40 }),
  product({ id: 2, color: ['Black', 'Red'], size: ['M'], vendor: 'Vendor B', price: 120 }),
  product({ id: 3, color: ['Red'], size: ['L'], vendor: 'Vendor A', price: 80 }),
  product({ id: 4, color: ['White'], size: ['S'], vendor: 'Vendor B', price: 200, availability: false }),
  product({ id: 5, color: ['Blue'], size: ['XL'], vendor: 'Halcyon', price: 60, title: 'Blue Sequin Gown' }),
];
const facets = activeFacets(DEFAULT_CONFIG);
const facetValues = collectFacetValues(products, facets);

const withFilters = (values: Filters['values'], price: Partial<Omit<Filters, 'values'>> = {}): Filters => ({
  ...EMPTY_FILTERS,
  ...price,
  values,
});
const run = (filters: Filters, query = '') => computeFacets(products, filters, query, facets, facetValues);
const countsOf = (map: Map<string, number> | undefined) => Object.fromEntries(map ?? []);

describe('computeFacets', () => {
  it("computes a facet's counts without its own selection, so other values stay selectable", () => {
    const { results, counts } = run(withFilters({ color: ['Black'] }));

    expect(results.map((p) => p.id)).toEqual([1, 2]);
    // Colour ignores the Colour=Black selection: Red still offers 2, not 0.
    expect(countsOf(counts.color)).toEqual({ Black: 2, Blue: 1, Red: 2, White: 1 });
    // Other facets are narrowed by the Colour selection.
    expect(countsOf(counts.size)).toEqual({ S: 1, M: 2, L: 0, XL: 0 });
    expect(countsOf(counts.vendor)).toEqual({ 'Vendor A': 1, 'Vendor B': 1, Halcyon: 0 });
  });

  it("still narrows a facet's counts by every other facet", () => {
    const { results, counts } = run(withFilters({ color: ['Black'], vendor: ['Vendor A'] }));

    expect(results.map((p) => p.id)).toEqual([1]);
    // Colour counts: Vendor A applies, Colour does not -> products 1 and 3.
    expect(countsOf(counts.color)).toEqual({ Black: 1, Blue: 0, Red: 1, White: 0 });
    // Vendor counts: Colour applies, Vendor does not -> products 1 and 2.
    expect(countsOf(counts.vendor)).toEqual({ 'Vendor A': 1, 'Vendor B': 1, Halcyon: 0 });
  });

  it('matches a brute-force filter-per-facet computation', () => {
    const filters = withFilters({ color: ['Black', 'Red'], size: ['M', 'L'] }, { maxPrice: 150 });
    const { counts } = run(filters);

    for (const facet of facets.filter((f) => f.source !== 'price')) {
      const base = applyFilters(products, filters, '', facets, { except: facet.key });
      for (const [value, count] of counts[facet.key] ?? []) {
        const expected = base.filter((p) => valuesOf(p, facet).includes(value)).length;
        expect(count, `${facet.key}=${value}`).toBe(expected);
      }
    }
  });

  it('applies search to every count and reports price bounds without the price filter', () => {
    const { results, counts, priceBounds } = run(withFilters({}, { minPrice: 100 }), 'sequin');
    expect(results).toEqual([]);
    expect(countsOf(counts.color)).toEqual({ Black: 0, Blue: 0, Red: 0, White: 0 });
    expect(priceBounds).toEqual({ min: 60, max: 60 });
  });
});

describe('configurable facets', () => {
  const shopify: Product[] = [
    product({ id: 10, options: { material: ['Silk'], colour: ['Green'] }, tags: ['fit:Slim', 'sale'], collections: ['New', 'Sale'] }),
    product({ id: 11, options: { material: ['Linen'] }, tags: ['fit:Relaxed'], collections: ['New'] }),
  ];

  it('reads any product option by name, treating Color and Colour alike', () => {
    const material: FacetDef = { key: 'material', label: 'Material', source: 'option', option: 'Material', display: 'checkbox' };
    const color: FacetDef = { key: 'color', label: 'Colour', source: 'option', option: 'Color', display: 'swatch' };
    expect(collectFacetValues(shopify, [material, color])).toEqual({ material: ['Linen', 'Silk'], color: ['Black', 'Green'] });
  });

  it('turns prefixed tags into a facet, stripping the prefix', () => {
    const fit: FacetDef = { key: 'fit', label: 'Fit', source: 'tag', tagPrefix: 'fit:', display: 'checkbox' };
    expect(collectFacetValues(shopify, [fit])).toEqual({ fit: ['Relaxed', 'Slim'] });
  });

  it('counts a product under every collection it belongs to', () => {
    const collection: FacetDef = { key: 'collection', label: 'Collection', source: 'collection', display: 'checkbox' };
    const values = collectFacetValues(shopify, [collection]);
    const { counts } = computeFacets(shopify, EMPTY_FILTERS, '', [collection], values);
    expect(countsOf(counts.collection)).toEqual({ New: 2, Sale: 1 });
  });
});

describe('applyFilters', () => {
  it('ORs values within a facet and ANDs across facets', () => {
    const filters = withFilters({ color: ['Black', 'White'], availability: ['In stock'] });
    expect(applyFilters(products, filters, '', facets).map((p) => p.id)).toEqual([1, 2]);
  });

  it('matches every search token case-insensitively across title, vendor, type and tags', () => {
    expect(applyFilters(products, EMPTY_FILTERS, 'GOWN blue', facets).map((p) => p.id)).toEqual([5]);
    expect(applyFilters(products, EMPTY_FILTERS, 'HALCYON', facets).map((p) => p.id)).toEqual([5]);
    expect(applyFilters(products, EMPTY_FILTERS, 'gown red', facets)).toEqual([]);
  });

  it('searches only the configured fields', () => {
    const titleOnly = createMatcher({ title: true, vendor: false, productType: false, tags: false, options: false });
    expect(applyFilters(products, EMPTY_FILTERS, 'halcyon', facets, { matcher: titleOnly })).toEqual([]);
  });
});
