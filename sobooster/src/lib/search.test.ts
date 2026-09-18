import { describe, expect, it } from 'vitest';
import type { Product } from '../types';
import { buildSynonymMap, createMatcher, expandQuery } from './search';
import { buildVocabulary, matchCollections, matchTerms, previewProducts } from './suggest';

const item = (id: number, title: string, tags: string[] = []): Product => ({
  id,
  title,
  price: 10,
  vendor: 'V',
  product_type: 'T',
  collection: 'Tops',
  color: [],
  size: [],
  availability: true,
  tags,
  image: '',
});

const catalog = [item(1, 'Cotton T-Shirt'), item(2, 'Wool Sweater', ['jumper']), item(3, 'Little Black Dress')];

describe('synonyms', () => {
  it('two-way rules connect every term', () => {
    const map = buildSynonymMap([{ id: 'a', terms: ['sweater', 'jumper', 'pullover'], oneWay: false }]);
    expect(map.get('pullover')?.sort()).toEqual(['jumper', 'sweater']);
  });

  it('one-way rules only expand the first term', () => {
    const matcher = createMatcher(undefined, [{ id: 'b', terms: ['tee', 't-shirt'], oneWay: true }]);
    const find = (q: string) => catalog.filter((p) => matcher.matches(p, matcher.expand(q))).map((p) => p.id);
    expect(find('tee')).toEqual([1]);
    expect(find('t-shirt')).toEqual([1]);
    // "t-shirt" does not expand back to "tee": searching "tee" alone found product 1 only via the rule.
    expect(buildSynonymMap([{ id: 'b', terms: ['tee', 't-shirt'], oneWay: true }]).has('t-shirt')).toBe(false);
  });

  it('matches multi-word synonyms as phrases', () => {
    const map = buildSynonymMap([{ id: 'c', terms: ['lbd', 'little black dress'], oneWay: false }]);
    expect(expandQuery('red lbd', map)).toEqual([['red'], ['lbd', 'little black dress']]);
    expect(expandQuery('little black dress sale', map)).toEqual([['little black dress', 'lbd'], ['sale']]);
  });
});

describe('search panel suggestions', () => {
  const matcher = createMatcher();
  const vocabulary = buildVocabulary(catalog);

  it('keeps collections apart from other terms, with counts', () => {
    expect(vocabulary.collections).toEqual([{ name: 'Tops', count: 3 }]);
    expect(vocabulary.terms).not.toContain('Tops');
  });

  it('ranks prefix matches first', () => {
    expect(matchTerms('jump', vocabulary, 3)).toEqual(['jumper']);
    expect(matchCollections('op', vocabulary, 3).map((c) => c.name)).toEqual(['Tops']);
  });

  it('previews products for a search or a collection, with totals', () => {
    expect(previewProducts({ kind: 'search', query: 'wool' }, catalog, matcher, 3)).toMatchObject({ total: 1 });
    const inTops = previewProducts({ kind: 'collection', name: 'Tops' }, catalog, matcher, 2);
    expect(inTops.products.map((p) => p.id)).toEqual([1, 2]);
    expect(inTops.total).toBe(3);
  });
});
