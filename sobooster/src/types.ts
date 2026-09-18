export interface Product {
  id: number;
  title: string;
  price: number;
  compare_at_price?: number;
  vendor: string;
  product_type: string;
  collection: string;
  color: string[];
  size: string[];
  availability: boolean;
  tags: string[];
  image: string;
  /**
   * Every collection the product is in. Shopify products can sit in several;
   * when absent the single `collection` is used.
   */
  collections?: string[];
  /** Product page URL, when running on a storefront. */
  url?: string;
  /** Storefront handle, used to fetch variants for the add-to-cart picker. */
  handle?: string;
  /** Every product option, keyed by lower-cased option name ("material" -> ["Satin"]). */
  options?: Record<string, string[]>;
  /** Numeric variant id to add to cart when the product has a single variant. */
  variantId?: number;
  /** True when the product has exactly one variant, so it can be added without a picker. */
  singleVariant?: boolean;
  /** ISO date, for the Newest sort. */
  published_at?: string;
}

/** Where a facet's values come from. */
export type FacetSource = 'collection' | 'vendor' | 'product_type' | 'option' | 'tag' | 'availability' | 'price';

/** A facet as the engine sees it: enabled filters from the app config. */
export interface FacetDef {
  /** URL parameter and state key, e.g. "color". */
  key: string;
  label: string;
  source: FacetSource;
  /** source "option": the option name, matched case-insensitively ("Colour" == "color"). */
  option?: string;
  /** source "tag": only tags starting with this prefix, which is stripped ("material:Silk" -> "Silk"). */
  tagPrefix?: string;
  display: 'checkbox' | 'swatch';
}

export interface Filters {
  /** Selected values per value facet key. OR within a facet, AND across facets. */
  values: Record<string, string[]>;
  minPrice: number | null;
  maxPrice: number | null;
}

export const SORT_KEYS = ['featured', 'newest', 'price_asc', 'price_desc', 'name_asc', 'name_desc'] as const;
export type SortKey = (typeof SORT_KEYS)[number];

/** facet key -> every value it can take, in display order. */
export type FacetValues = Record<string, readonly string[]>;
/** facet key -> value -> products it would yield. */
export type FacetCounts = Record<string, Map<string, number>>;

export interface PriceBounds {
  min: number;
  max: number;
}

export const EMPTY_FILTERS: Filters = { values: {}, minPrice: null, maxPrice: null };
