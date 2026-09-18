import { SORT_KEYS, type FacetDef, type FacetSource, type SortKey } from '../types';

/**
 * Everything a merchant configures in the admin (Index, Filters, Synonyms,
 * Settings). Saved as one JSON app-data metafield on the app installation and
 * read by the theme extension's Liquid, so the storefront gets it with the page
 * and no backend is involved.
 */
export interface FacetConfig extends FacetDef {
  enabled: boolean;
}

export interface SynonymRule {
  id: string;
  /** Two-way: every term matches every other. One-way: the first term also matches the rest. */
  terms: string[];
  oneWay: boolean;
}

export interface IndexConfig {
  fields: { title: boolean; vendor: boolean; productType: boolean; tags: boolean; options: boolean };
  excludeOutOfStock: boolean;
  /** Products carrying any of these tags are left out of search and filters. */
  excludedTags: string[];
  /** Bumped by "Rebuild index"; part of the storefront cache key, so shoppers get fresh data. */
  version: number;
  lastIndexedAt: string | null;
}

export interface CardSettings {
  imageRatio: 'portrait' | 'square' | 'landscape';
  imageFit: 'cover' | 'contain';
  columnsDesktop: number;
  columnsMobile: number;
  radius: number;
  textAlign: 'left' | 'center';
  showVendor: boolean;
  showSaleBadge: boolean;
  showSoldOutBadge: boolean;
  showSizes: boolean;
  showAddToCart: boolean;
  buttonStyle: 'filled' | 'outline';
  buttonLabel: string;
  accentColor: string;
  buttonColor: string;
  buttonTextColor: string;
}

export interface SearchSettings {
  suggestions: boolean;
  /** Store pages and blog posts under instant results. */
  showPages: boolean;
  suggestionProducts: number;
  recentSearches: boolean;
  recommendations: boolean;
  recommendationCount: number;
}

export interface LayoutSettings {
  productsPerPage: number;
  defaultSort: SortKey;
}

export interface CartSettings {
  /** What happens after Add to cart: a notification, or go straight to the cart page. */
  afterAdd: 'notify' | 'cart';
}

export interface AppConfig {
  index: IndexConfig;
  filters: FacetConfig[];
  synonyms: SynonymRule[];
  cards: CardSettings;
  search: SearchSettings;
  layout: LayoutSettings;
  cart: CartSettings;
}

export const DEFAULT_FILTERS: FacetConfig[] = [
  { key: 'collection', label: 'Collection', source: 'collection', display: 'checkbox', enabled: true },
  { key: 'vendor', label: 'Vendor', source: 'vendor', display: 'checkbox', enabled: true },
  { key: 'product_type', label: 'Product type', source: 'product_type', display: 'checkbox', enabled: false },
  { key: 'color', label: 'Colour', source: 'option', option: 'color', display: 'swatch', enabled: true },
  { key: 'size', label: 'Size', source: 'option', option: 'size', display: 'checkbox', enabled: true },
  { key: 'price', label: 'Price', source: 'price', display: 'checkbox', enabled: true },
  { key: 'availability', label: 'Availability', source: 'availability', display: 'checkbox', enabled: true },
];

export const DEFAULT_CONFIG: AppConfig = {
  index: {
    fields: { title: true, vendor: true, productType: true, tags: true, options: false },
    excludeOutOfStock: false,
    excludedTags: [],
    version: 1,
    lastIndexedAt: null,
  },
  filters: DEFAULT_FILTERS,
  synonyms: [],
  cards: {
    imageRatio: 'portrait',
    imageFit: 'cover',
    columnsDesktop: 4,
    columnsMobile: 2,
    radius: 10,
    textAlign: 'left',
    showVendor: true,
    showSaleBadge: true,
    showSoldOutBadge: true,
    showSizes: true,
    showAddToCart: true,
    buttonStyle: 'filled',
    buttonLabel: 'Add to cart',
    accentColor: '#b0275a',
    buttonColor: '#1b1a1f',
    buttonTextColor: '#ffffff',
  },
  search: { suggestions: true, showPages: true, suggestionProducts: 5, recentSearches: true, recommendations: true, recommendationCount: 4 },
  layout: { productsPerPage: 24, defaultSort: 'featured' },
  cart: { afterAdd: 'notify' },
};

/** URL parameters the app or Shopify already use; facet keys must avoid them. */
export const RESERVED_PARAMS = new Set(['q', 'sort', 'min_price', 'max_price', 'page', 'type', 'options', 'view']);

export function facetKeyFor(name: string, taken: ReadonlySet<string>): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'filter';
  let key = RESERVED_PARAMS.has(base) ? `f_${base}` : base;
  for (let i = 2; taken.has(key); i++) key = `${base}_${i}`;
  return key;
}

// ---------- Validation: stored config is untrusted input from an older version or a hand edit ----------

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
const str = (v: unknown, fallback: string, max = 200) => (typeof v === 'string' ? v.slice(0, max) : fallback);
const int = (v: unknown, fallback: number, min: number, max: number) =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : fallback;
const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T =>
  options.find((o) => o === v) ?? fallback;
const color = (v: unknown, fallback: string) => (typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v) ? v : fallback);
const strings = (v: unknown, maxItems = 100) =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string' && s.trim() !== '').map((s) => s.trim()).slice(0, maxItems) : [];

const SOURCES: readonly FacetSource[] = ['collection', 'vendor', 'product_type', 'option', 'tag', 'availability', 'price'];

function normalizeFilters(v: unknown): FacetConfig[] {
  if (!Array.isArray(v)) return DEFAULT_FILTERS;
  const seen = new Set<string>();
  const filters: FacetConfig[] = [];
  for (const item of v) {
    if (!isObject(item)) continue;
    const source = oneOf(item.source, SOURCES, 'vendor');
    if (source === 'option' && !str(item.option, '').trim()) continue;
    if (source === 'tag' && !str(item.tagPrefix, '').trim()) continue;
    const key = str(item.key, '', 40);
    if (!/^[a-z0-9_]+$/.test(key) || seen.has(key) || RESERVED_PARAMS.has(key)) continue;
    seen.add(key);
    filters.push({
      key,
      label: str(item.label, key, 60) || key,
      source,
      ...(source === 'option' ? { option: str(item.option, '', 60).trim() } : {}),
      ...(source === 'tag' ? { tagPrefix: str(item.tagPrefix, '', 60).trim() } : {}),
      display: oneOf(item.display, ['checkbox', 'swatch'] as const, 'checkbox'),
      enabled: bool(item.enabled, true),
    });
  }
  return filters;
}

function normalizeSynonyms(v: unknown): SynonymRule[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter(isObject)
    .map((item, i) => ({
      id: str(item.id, `rule-${i}`, 40) || `rule-${i}`,
      terms: strings(item.terms, 20).map((t) => t.toLowerCase().slice(0, 60)),
      oneWay: bool(item.oneWay, false),
    }))
    .filter((rule) => rule.terms.length >= 2)
    .slice(0, 500);
}

export function normalizeAppConfig(raw: unknown): AppConfig {
  const c = isObject(raw) ? raw : {};
  const d = DEFAULT_CONFIG;
  const index = isObject(c.index) ? c.index : {};
  const fields = isObject(index.fields) ? index.fields : {};
  const cards = isObject(c.cards) ? c.cards : {};
  const search = isObject(c.search) ? c.search : {};
  const layout = isObject(c.layout) ? c.layout : {};
  const cart = isObject(c.cart) ? c.cart : {};

  return {
    index: {
      fields: {
        title: bool(fields.title, d.index.fields.title),
        vendor: bool(fields.vendor, d.index.fields.vendor),
        productType: bool(fields.productType, d.index.fields.productType),
        tags: bool(fields.tags, d.index.fields.tags),
        options: bool(fields.options, d.index.fields.options),
      },
      excludeOutOfStock: bool(index.excludeOutOfStock, d.index.excludeOutOfStock),
      excludedTags: strings(index.excludedTags).map((t) => t.toLowerCase()),
      version: int(index.version, d.index.version, 1, Number.MAX_SAFE_INTEGER),
      lastIndexedAt: typeof index.lastIndexedAt === 'string' ? index.lastIndexedAt : null,
    },
    filters: 'filters' in c ? normalizeFilters(c.filters) : d.filters,
    synonyms: normalizeSynonyms(c.synonyms),
    cards: {
      imageRatio: oneOf(cards.imageRatio, ['portrait', 'square', 'landscape'] as const, d.cards.imageRatio),
      imageFit: oneOf(cards.imageFit, ['cover', 'contain'] as const, d.cards.imageFit),
      columnsDesktop: int(cards.columnsDesktop, d.cards.columnsDesktop, 2, 6),
      columnsMobile: int(cards.columnsMobile, d.cards.columnsMobile, 1, 2),
      radius: int(cards.radius, d.cards.radius, 0, 32),
      textAlign: oneOf(cards.textAlign, ['left', 'center'] as const, d.cards.textAlign),
      showVendor: bool(cards.showVendor, d.cards.showVendor),
      showSaleBadge: bool(cards.showSaleBadge, d.cards.showSaleBadge),
      showSoldOutBadge: bool(cards.showSoldOutBadge, d.cards.showSoldOutBadge),
      showSizes: bool(cards.showSizes, d.cards.showSizes),
      showAddToCart: bool(cards.showAddToCart, d.cards.showAddToCart),
      buttonStyle: oneOf(cards.buttonStyle, ['filled', 'outline'] as const, d.cards.buttonStyle),
      buttonLabel: str(cards.buttonLabel, d.cards.buttonLabel, 40).trim() || d.cards.buttonLabel,
      accentColor: color(cards.accentColor, d.cards.accentColor),
      buttonColor: color(cards.buttonColor, d.cards.buttonColor),
      buttonTextColor: color(cards.buttonTextColor, d.cards.buttonTextColor),
    },
    search: {
      suggestions: bool(search.suggestions, d.search.suggestions),
      showPages: bool(search.showPages, d.search.showPages),
      suggestionProducts: int(search.suggestionProducts, d.search.suggestionProducts, 0, 8),
      recentSearches: bool(search.recentSearches, d.search.recentSearches),
      recommendations: bool(search.recommendations, d.search.recommendations),
      recommendationCount: int(search.recommendationCount, d.search.recommendationCount, 2, 12),
    },
    layout: {
      productsPerPage: int(layout.productsPerPage, d.layout.productsPerPage, 8, 96),
      defaultSort: oneOf(layout.defaultSort, SORT_KEYS, d.layout.defaultSort),
    },
    cart: { afterAdd: oneOf(cart.afterAdd, ['notify', 'cart'] as const, d.cart.afterAdd) },
  };
}

/** The enabled filters, as the engine consumes them. */
export function activeFacets(config: AppConfig): FacetDef[] {
  return config.filters.filter((f) => f.enabled).map(({ enabled: _enabled, ...def }) => def);
}
