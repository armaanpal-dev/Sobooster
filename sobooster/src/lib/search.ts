import type { IndexConfig, SynonymRule } from '../config/appConfig';
import type { Product } from '../types';

export type SearchFields = IndexConfig['fields'];

export const ALL_FIELDS: SearchFields = { title: true, vendor: true, productType: true, tags: true, options: false };

/**
 * term -> terms it also matches. Two-way rules connect every term; one-way
 * rules let the first term also match the others, but not the reverse
 * ("tee" -> "t-shirt" does not make "t-shirt" match "tee").
 */
export function buildSynonymMap(rules: readonly SynonymRule[]): Map<string, string[]> {
  const map = new Map<string, Set<string>>();
  const link = (from: string, to: string) => {
    if (from === to) return;
    if (!map.has(from)) map.set(from, new Set());
    map.get(from)?.add(to);
  };
  for (const rule of rules) {
    const terms = rule.terms.map((t) => t.toLowerCase().trim()).filter(Boolean);
    const [head, ...rest] = terms;
    if (head === undefined) continue;
    if (rule.oneWay) rest.forEach((t) => link(head, t));
    else terms.forEach((a) => terms.forEach((b) => link(a, b)));
  }
  return new Map([...map].map(([k, v]) => [k, [...v]]));
}

/**
 * The query as groups of alternatives: every group must match (AND), any
 * alternative within a group will do (OR). Multi-word synonyms are matched as
 * phrases, so "little black dress" -> "lbd" works when the whole phrase is typed.
 */
export function expandQuery(query: string, synonyms: ReadonlyMap<string, string[]>): string[][] {
  let text = query.toLowerCase().trim();
  if (!text) return [];
  const groups: string[][] = [];
  // Phrases first, longest first, so they are not split into single words.
  const phrases = [...synonyms.keys()].filter((k) => k.includes(' ')).sort((a, b) => b.length - a.length);
  for (const phrase of phrases) {
    const at = text.indexOf(phrase);
    if (at === -1) continue;
    groups.push([phrase, ...(synonyms.get(phrase) ?? [])]);
    text = `${text.slice(0, at)} ${text.slice(at + phrase.length)}`;
  }
  for (const token of text.split(/\s+/).filter(Boolean)) {
    groups.push([token, ...(synonyms.get(token) ?? [])]);
  }
  return groups;
}

export interface Matcher {
  /** True when the product matches every group of the (expanded) query. */
  matches(product: Product, groups: readonly string[][]): boolean;
  expand(query: string): string[][];
}

/** Case-insensitive substring matching over the configured fields, with per-product text cached. */
export function createMatcher(fields: SearchFields = ALL_FIELDS, synonymRules: readonly SynonymRule[] = []): Matcher {
  const synonyms = buildSynonymMap(synonymRules);
  const cache = new WeakMap<Product, string>();
  const textOf = (product: Product) => {
    let text = cache.get(product);
    if (text === undefined) {
      const parts: string[] = [];
      if (fields.title) parts.push(product.title);
      if (fields.vendor) parts.push(product.vendor);
      if (fields.productType) parts.push(product.product_type);
      if (fields.tags) parts.push(...product.tags);
      if (fields.options) {
        parts.push(...product.color, ...product.size);
        for (const values of Object.values(product.options ?? {})) parts.push(...values);
      }
      text = parts.join('\n').toLowerCase();
      cache.set(product, text);
    }
    return text;
  };
  return {
    expand: (query) => expandQuery(query, synonyms),
    matches: (product, groups) => {
      if (groups.length === 0) return true;
      const text = textOf(product);
      return groups.every((alternatives) => alternatives.some((term) => text.includes(term)));
    },
  };
}

export const defaultMatcher = createMatcher();
