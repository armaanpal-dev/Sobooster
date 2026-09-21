import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, facetKeyFor, normalizeAppConfig } from './appConfig';

describe('normalizeAppConfig', () => {
  it('opens the cart drawer by default and keeps a valid after-add choice', () => {
    expect(normalizeAppConfig({}).cart).toEqual({ afterAdd: 'drawer', drawerSelector: '' });
    expect(normalizeAppConfig({ cart: { afterAdd: 'notify', drawerSelector: '  .cart-toggle ' } }).cart).toEqual({
      afterAdd: 'notify',
      drawerSelector: '.cart-toggle',
    });
    expect(normalizeAppConfig({ cart: { afterAdd: 'popup' } }).cart.afterAdd).toBe('drawer');
  });

  it('returns the defaults for missing or garbage input', () => {
    expect(normalizeAppConfig(undefined)).toEqual(DEFAULT_CONFIG);
    expect(normalizeAppConfig('nope')).toEqual(DEFAULT_CONFIG);
  });

  it('keeps valid values and repairs invalid ones', () => {
    const config = normalizeAppConfig({
      cards: { columnsDesktop: 9, radius: -4, accentColor: 'red; background:url(x)', buttonStyle: 'outline' },
      layout: { defaultSort: 'price_desc', productsPerPage: 3 },
    });
    expect(config.cards.columnsDesktop).toBe(6);
    expect(config.cards.radius).toBe(0);
    expect(config.cards.accentColor).toBe(DEFAULT_CONFIG.cards.accentColor);
    expect(config.cards.buttonStyle).toBe('outline');
    expect(config.layout).toEqual({ defaultSort: 'price_desc', productsPerPage: 8 });
  });

  it('drops malformed filters, duplicate keys and keys that clash with URL params', () => {
    const config = normalizeAppConfig({
      filters: [
        { key: 'material', label: 'Material', source: 'option', option: 'Material' },
        { key: 'material', label: 'Dup', source: 'vendor' },
        { key: 'q', label: 'Bad', source: 'vendor' },
        { key: 'fit', label: 'Fit', source: 'tag' },
      ],
    });
    expect(config.filters.map((f) => f.key)).toEqual(['material']);
    expect(config.filters[0]).toMatchObject({ enabled: true, display: 'checkbox', option: 'Material' });
  });

  it('keeps synonym rules with at least two terms, lower-cased', () => {
    const config = normalizeAppConfig({ synonyms: [{ id: 'a', terms: ['Tee', 'T-Shirt'] }, { id: 'b', terms: ['solo'] }] });
    expect(config.synonyms).toEqual([{ id: 'a', terms: ['tee', 't-shirt'], oneWay: false }]);
  });
});

it('facetKeyFor avoids reserved and taken keys', () => {
  expect(facetKeyFor('Material', new Set())).toBe('material');
  expect(facetKeyFor('Type', new Set())).toBe('f_type');
  expect(facetKeyFor('Material', new Set(['material']))).toBe('material_2');
});
