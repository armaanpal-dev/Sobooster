import type { Product, SortKey } from '../types';

export const SORT_LABELS: Record<SortKey, string> = {
  featured: 'Featured',
  newest: 'Newest',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
  name_asc: 'Name: A to Z',
  name_desc: 'Name: Z to A',
};

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

const publishedTime = (p: Product) => (p.published_at ? Date.parse(p.published_at) || 0 : 0);

const COMPARATORS: Record<Exclude<SortKey, 'featured'>, (a: Product, b: Product) => number> = {
  newest: (a, b) => publishedTime(b) - publishedTime(a),
  price_asc: (a, b) => a.price - b.price,
  price_desc: (a, b) => b.price - a.price,
  name_asc: (a, b) => collator.compare(a.title, b.title),
  name_desc: (a, b) => collator.compare(b.title, a.title),
};

/**
 * Returns a new array. Featured is the input order: best-selling for the whole
 * catalogue, the merchant's order on a collection. Every other order breaks
 * ties on id, so equal prices or titles never reshuffle.
 */
export function sortProducts(products: readonly Product[], sort: SortKey): Product[] {
  if (sort === 'featured') return [...products];
  const compare = COMPARATORS[sort];
  return [...products].sort((a, b) => compare(a, b) || a.id - b.id);
}

/** Sorts that make sense for this catalogue: Newest needs publish dates. */
export function availableSorts(products: readonly Product[]): SortKey[] {
  const hasDates = products.some((p) => p.published_at);
  return (Object.keys(SORT_LABELS) as SortKey[]).filter((key) => key !== 'newest' || hasDates);
}
