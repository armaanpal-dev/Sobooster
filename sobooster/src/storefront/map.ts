import type { Product } from '../types';

/** The Product fields requested from the Storefront API (see STOREFRONT_PRODUCT_FIELDS). */
export interface StorefrontProduct {
  id: string;
  handle: string;
  title: string;
  vendor: string;
  productType: string;
  tags: string[];
  availableForSale: boolean;
  priceRange: { minVariantPrice: { amount: string; currencyCode: string } };
  compareAtPriceRange: { maxVariantPrice: { amount: string } };
  options: { name: string; optionValues: { name: string }[] }[];
  featuredImage: { url: string } | null;
  publishedAt?: string;
  selectedOrFirstAvailableVariant?: { id: string; availableForSale: boolean } | null;
  collections?: { nodes: { title: string }[] };
}

/** A product from the storefront's own /products.json (the Ajax API shape). */
export interface AjaxProduct {
  id: number;
  handle: string;
  title: string;
  vendor: string;
  product_type?: string;
  type?: string;
  tags: string[] | string;
  options: { name: string; values: string[] }[] | string[];
  variants: { id: number; title?: string; price: string | number; compare_at_price: string | number | null; available: boolean }[];
  images: ({ src: string } | string)[];
  published_at?: string;
}

// Validated against the Storefront API schema.
export const STOREFRONT_PRODUCT_FIELDS = `
  id handle title vendor productType tags availableForSale publishedAt
  priceRange { minVariantPrice { amount currencyCode } }
  compareAtPriceRange { maxVariantPrice { amount } }
  options { name optionValues { name } }
  featuredImage { url(transform: { maxWidth: 480 }) }
  selectedOrFirstAvailableVariant { id availableForSale }
`;

type RawOption = { name: string; values: readonly string[] };

// Stores name options "Color", "color" or "Colour" interchangeably.
const COLOR_OPTIONS = new Set(['color', 'colour']);
const SIZE_OPTIONS = new Set(['size']);

/** Every option by lower-cased name, so any option can become a filter (Admin > Filters). */
function optionMap(options: readonly RawOption[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const option of options) {
    const values = option.values.map((v) => v.trim()).filter(Boolean);
    // Shopify's placeholder option for products without real options.
    if (option.name === 'Title' && values.length === 1 && values[0] === 'Default Title') continue;
    map[option.name.trim().toLowerCase()] = values;
  }
  return map;
}

function optionValues(options: readonly RawOption[], names: Set<string>): string[] {
  const values = new Set<string>();
  for (const option of options) {
    if (!names.has(option.name.trim().toLowerCase())) continue;
    for (const value of option.values) if (value.trim()) values.add(value.trim());
  }
  return [...values];
}

/** "gid://shopify/Product/123" -> 123. Used as the stable sort tiebreaker and for cart variant ids. */
export function numericId(gid: string): number {
  const match = /(\d+)$/.exec(gid);
  return match ? Number(match[1]) : 0;
}

const productUrl = (rootUrl: string, handle: string) => `${rootUrl.replace(/\/$/, '')}/products/${handle}`;

const toNumber = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

function withCompareAt(product: Product, compareAt: number | null): Product {
  return compareAt !== null && compareAt > product.price ? { ...product, compare_at_price: compareAt } : product;
}

export function mapStorefrontProduct(node: StorefrontProduct, rootUrl: string): Product {
  const options = node.options.map((o) => ({ name: o.name, values: o.optionValues.map((v) => v.name) }));
  const collections = node.collections?.nodes.map((c) => c.title) ?? [];
  const variant = node.selectedOrFirstAvailableVariant;
  const product: Product = {
    id: numericId(node.id),
    title: node.title,
    price: toNumber(node.priceRange.minVariantPrice.amount) ?? 0,
    vendor: node.vendor,
    product_type: node.productType,
    collection: collections[0] ?? '',
    collections,
    color: optionValues(options, COLOR_OPTIONS),
    size: optionValues(options, SIZE_OPTIONS),
    availability: node.availableForSale,
    tags: node.tags,
    image: node.featuredImage?.url ?? '',
    url: productUrl(rootUrl, node.handle),
    handle: node.handle,
    options: optionMap(options),
    // Every option has a single value -> exactly one variant, so it can be added without a picker.
    singleVariant: options.every((o) => o.values.length <= 1),
    ...(variant ? { variantId: numericId(variant.id) } : {}),
    ...(node.publishedAt ? { published_at: node.publishedAt } : {}),
  };
  return withCompareAt(product, toNumber(node.compareAtPriceRange.maxVariantPrice.amount));
}

/** A product from /products.json, where prices are decimal strings ("25.00"). */
export function mapAjaxProduct(raw: AjaxProduct, rootUrl: string): Product {
  const prices = raw.variants.map((v) => toNumber(v.price)).filter((n): n is number => n !== null);
  const min = prices.length > 0 ? Math.min(...prices) : 0;
  const cheapest = raw.variants.find((v) => toNumber(v.price) === min);
  const firstAvailable = raw.variants.find((v) => v.available) ?? raw.variants[0];
  const tags = Array.isArray(raw.tags) ? raw.tags : raw.tags.split(',').map((t) => t.trim()).filter(Boolean);
  const options: RawOption[] = raw.options.flatMap((o) => (typeof o === 'string' ? [] : [{ name: o.name, values: o.values }]));
  const firstImage = raw.images[0];
  const image = typeof firstImage === 'string' ? firstImage : (firstImage?.src ?? '');
  const product: Product = {
    id: raw.id,
    title: raw.title,
    price: min,
    vendor: raw.vendor,
    product_type: raw.product_type ?? raw.type ?? '',
    collection: '',
    collections: [],
    color: optionValues(options, COLOR_OPTIONS),
    size: optionValues(options, SIZE_OPTIONS),
    availability: raw.variants.some((v) => v.available),
    tags,
    image: image ? `${image}${image.includes('?') ? '&' : '?'}width=480` : '',
    url: productUrl(rootUrl, raw.handle),
    handle: raw.handle,
    options: optionMap(options),
    singleVariant: raw.variants.length === 1,
    ...(firstAvailable ? { variantId: firstAvailable.id } : {}),
    ...(raw.published_at ? { published_at: raw.published_at } : {}),
  };
  return withCompareAt(product, toNumber(cheapest?.compare_at_price ?? null));
}
