import type { FacetDef, FacetValues, Product } from '../types';

export const IN_STOCK = 'In stock';
export const OUT_OF_STOCK = 'Out of stock';

const COLOR_NAMES = new Set(['color', 'colour']);

/** Option values by name, case-insensitive, treating "Color" and "Colour" as one. */
function optionValues(product: Product, option: string): readonly string[] {
  const name = option.trim().toLowerCase();
  const fromOptions = product.options?.[name] ?? (COLOR_NAMES.has(name) ? (product.options?.color ?? product.options?.colour) : undefined);
  if (fromOptions) return fromOptions;
  // Fall back to the plain colour and size fields.
  if (COLOR_NAMES.has(name)) return product.color;
  if (name === 'size') return product.size;
  return [];
}

/**
 * The values a product contributes to a facet. Multi-valued sources (options,
 * Shopify collections, tags) contribute several; vendor one; availability maps
 * the boolean onto two display values. Price is a range, so it has none.
 */
export function valuesOf(product: Product, facet: FacetDef): readonly string[] {
  switch (facet.source) {
    case 'collection':
      return product.collections ?? (product.collection ? [product.collection] : []);
    case 'vendor':
      return product.vendor ? [product.vendor] : [];
    case 'product_type':
      return product.product_type ? [product.product_type] : [];
    case 'option':
      return optionValues(product, facet.option ?? '');
    case 'tag': {
      const prefix = (facet.tagPrefix ?? '').toLowerCase();
      return product.tags.filter((t) => t.toLowerCase().startsWith(prefix)).map((t) => t.slice(prefix.length).trim()).filter(Boolean);
    }
    case 'availability':
      return [product.availability ? IN_STOCK : OUT_OF_STOCK];
    case 'price':
      return [];
  }
}

const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '2XL', '3XL'];

function rank(list: readonly string[], value: string): number {
  const index = list.indexOf(value.toUpperCase());
  return index === -1 ? list.length : index;
}

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

function compareValues(facet: FacetDef, a: string, b: string): number {
  if (facet.source === 'availability') return rank([IN_STOCK.toUpperCase(), OUT_OF_STOCK.toUpperCase()], a) - rank([IN_STOCK.toUpperCase(), OUT_OF_STOCK.toUpperCase()], b);
  if (facet.source === 'option' && facet.option?.toLowerCase() === 'size') {
    return rank(SIZE_ORDER, a) - rank(SIZE_ORDER, b) || collator.compare(a, b);
  }
  return collator.compare(a, b);
}

/** Every value each value facet can take across the catalogue, in display order. */
export function collectFacetValues(products: readonly Product[], facets: readonly FacetDef[]): FacetValues {
  const result: Record<string, string[]> = {};
  for (const facet of facets) {
    if (facet.source === 'price') continue;
    const values = new Set<string>(facet.source === 'availability' ? [IN_STOCK, OUT_OF_STOCK] : []);
    for (const product of products) {
      for (const value of valuesOf(product, facet)) values.add(value);
    }
    result[facet.key] = [...values].sort((a, b) => compareValues(facet, a, b));
  }
  return result;
}
