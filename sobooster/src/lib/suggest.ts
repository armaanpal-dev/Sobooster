import type { Product } from '../types';
import type { Matcher } from './search';

/** Words a shopper might mean, split into collections and everything else. */
export interface Vocabulary {
  /** Vendors, product types and tags. */
  terms: string[];
  /** Collection names with product counts, largest first. */
  collections: { name: string; count: number }[];
}

export function buildVocabulary(products: readonly Product[]): Vocabulary {
  const collections = new Map<string, { name: string; count: number }>();
  const terms = new Map<string, string>();
  const addTerm = (term: string) => {
    const clean = term.trim();
    if (clean.length > 1 && !terms.has(clean.toLowerCase())) terms.set(clean.toLowerCase(), clean);
  };
  for (const p of products) {
    for (const name of p.collections ?? (p.collection ? [p.collection] : [])) {
      const entry = collections.get(name) ?? { name, count: 0 };
      entry.count++;
      collections.set(name, entry);
    }
    addTerm(p.vendor);
    addTerm(p.product_type);
    p.tags.forEach(addTerm);
  }
  for (const name of collections.keys()) terms.delete(name.toLowerCase());
  return { terms: [...terms.values()], collections: [...collections.values()].sort((a, b) => b.count - a.count) };
}

/** Items containing the text: prefix matches first, then shorter, then alphabetical. */
function rankMatches<T>(items: readonly T[], text: string, nameOf: (item: T) => string, limit: number): T[] {
  const needle = text.trim().toLowerCase();
  if (!needle) return [];
  return items
    .map((item) => ({ item, name: nameOf(item), at: nameOf(item).toLowerCase().indexOf(needle) }))
    .filter(({ name, at }) => at !== -1 && name.toLowerCase() !== needle)
    .sort((a, b) => Number(a.at !== 0) - Number(b.at !== 0) || a.name.length - b.name.length || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(({ item }) => item);
}

export function matchTerms(input: string, vocabulary: Vocabulary, limit: number): string[] {
  return rankMatches(vocabulary.terms, input, (t) => t, limit);
}

export function matchCollections(input: string, vocabulary: Vocabulary, limit: number): { name: string; count: number }[] {
  return rankMatches(vocabulary.collections, input, (c) => c.name, limit);
}

/** What the right-hand side of the search panel is showing products for. */
export type Preview = { kind: 'search'; query: string } | { kind: 'collection'; name: string };

/** The first products for a preview, plus how many there are in total. */
export function previewProducts(
  preview: Preview,
  products: readonly Product[],
  matcher: Matcher,
  limit: number,
): { products: Product[]; total: number } {
  const found: Product[] = [];
  let total = 0;
  const groups = preview.kind === 'search' ? matcher.expand(preview.query) : [];
  for (const product of products) {
    const hit =
      preview.kind === 'search'
        ? groups.length > 0 && matcher.matches(product, groups)
        : (product.collections ?? [product.collection]).includes(preview.name);
    if (!hit) continue;
    total++;
    if (found.length < limit) found.push(product);
  }
  return { products: found, total };
}

const RECENT_KEY = 'sobooster:recent-searches';
const RECENT_LIMIT = 5;

export function readRecentSearches(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string').slice(0, RECENT_LIMIT) : [];
  } catch {
    return [];
  }
}

export function saveRecentSearch(query: string): string[] {
  const clean = query.trim();
  if (!clean) return readRecentSearches();
  const next = [clean, ...readRecentSearches().filter((q) => q.toLowerCase() !== clean.toLowerCase())].slice(0, RECENT_LIMIT);
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Storage blocked: recent searches just don't persist.
  }
  return next;
}

export function clearRecentSearches(): void {
  try {
    window.localStorage.removeItem(RECENT_KEY);
  } catch {
    // Nothing to clear.
  }
}
