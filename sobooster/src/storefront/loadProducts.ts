import type { Product } from '../types';
import type { StorefrontConfig } from './config';
import {
  mapAjaxProduct,
  mapStorefrontProduct,
  STOREFRONT_PRODUCT_FIELDS,
  type AjaxProduct,
  type StorefrontProduct,
} from './map';

const API_VERSION = '2026-07';
/** Past this the in-memory approach stops being right; see README "Production". */
const MAX_PRODUCTS = 5000;
const CACHE_TTL_MS = 10 * 60 * 1000;

export interface LoadedProducts {
  products: Product[];
  currencyCode: string;
  source: 'storefront-api' | 'products-json';
}

interface ProductPage {
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  nodes: StorefrontProduct[];
}

interface GraphQLResponse {
  data?: { products?: ProductPage; collection?: { products: ProductPage } | null };
  errors?: { message: string }[];
}

/** Storefront API wants EN or PT_BR; Liquid gives "en" / "pt-BR". */
const languageCode = (iso: string) => iso.toUpperCase().replace('-', '_');

function buildQuery(config: StorefrontConfig): string {
  const vars = ['$first: Int!', '$after: String'];
  const context: string[] = [];
  if (config.country) {
    vars.push('$country: CountryCode');
    context.push('country: $country');
  }
  if (config.language) {
    vars.push('$language: LanguageCode');
    context.push('language: $language');
  }
  if (config.collection) vars.push('$handle: String!');
  const inContext = context.length > 0 ? ` @inContext(${context.join(', ')})` : '';

  const connection = config.collection
    ? `collection(handle: $handle) { products(first: $first, after: $after, sortKey: COLLECTION_DEFAULT) { ...Page } }`
    : `products(first: $first, after: $after, sortKey: BEST_SELLING) { ...Page }`;
  // Collection membership is only needed (and only affordable) for the whole-catalogue view.
  const collections = config.collection ? '' : 'collections(first: 10) { nodes { title } }';

  return `query Catalog(${vars.join(', ')})${inContext} {
    ${connection}
  }
  fragment Page on ProductConnection {
    pageInfo { hasNextPage endCursor }
    nodes { ${STOREFRONT_PRODUCT_FIELDS} ${collections} }
  }`;
}

/**
 * Tokenless Storefront API from the storefront's own origin: no app backend,
 * no access token, and prices in the shopper's market currency.
 */
async function loadFromStorefrontApi(config: StorefrontConfig): Promise<LoadedProducts> {
  const query = buildQuery(config);
  const products: Product[] = [];
  let currencyCode = config.shopCurrency;
  let after: string | null = null;
  // Tokenless requests have a query-cost ceiling; shrink the page until it fits.
  let first = 100;

  for (;;) {
    const variables: Record<string, unknown> = { first, after };
    if (config.country) variables.country = config.country;
    if (config.language) variables.language = languageCode(config.language);
    if (config.collection) variables.handle = config.collection;

    const response = await fetch(`/api/${API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) throw new Error(`Storefront API responded ${response.status}`);
    const body = (await response.json()) as GraphQLResponse;

    if (body.errors?.length) {
      const message = body.errors.map((e) => e.message).join('; ');
      if (/complex|cost/i.test(message) && first > 10) {
        first = Math.floor(first / 2);
        continue;
      }
      throw new Error(message);
    }

    const page = config.collection ? body.data?.collection?.products : body.data?.products;
    if (!page) throw new Error(config.collection ? `Collection "${config.collection}" not found` : 'No products returned');

    for (const node of page.nodes) {
      products.push(mapStorefrontProduct(node, config.rootUrl));
      currencyCode = node.priceRange.minVariantPrice.currencyCode;
    }
    if (!page.pageInfo.hasNextPage || products.length >= MAX_PRODUCTS) break;
    after = page.pageInfo.endCursor;
  }

  return { products, currencyCode, source: 'storefront-api' };
}

const MAX_FALLBACK_COLLECTIONS = 50;

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`${url} responded ${response.status}`);
  return (await response.json()) as T;
}

async function fetchAllProductsJson(base: string): Promise<AjaxProduct[]> {
  const all: AjaxProduct[] = [];
  for (let page = 1; all.length < MAX_PRODUCTS; page++) {
    const body = await getJson<{ products?: AjaxProduct[] }>(`${base}/products.json?limit=250&page=${page}`);
    const batch = body.products ?? [];
    all.push(...batch);
    if (batch.length < 250) break;
  }
  return all;
}

/** product id -> collection titles, from /collections.json plus each collection's product list. */
async function fetchCollectionMembership(root: string): Promise<Map<number, string[]>> {
  const membership = new Map<number, string[]>();
  const { collections = [] } = await getJson<{ collections?: { handle: string; title: string }[] }>(
    `${root}/collections.json?limit=${MAX_FALLBACK_COLLECTIONS}`,
  );
  const lists = await Promise.all(
    collections.map(async (c) => ({ title: c.title, products: await fetchAllProductsJson(`${root}/collections/${c.handle}`) })),
  );
  for (const { title, products } of lists) {
    for (const product of products) membership.set(product.id, [...(membership.get(product.id) ?? []), title]);
  }
  return membership;
}

/**
 * Fallback: the storefront's public /products.json. Same origin, so it works on
 * a password-protected store once the visitor has entered the password. Prices
 * are in the shop's base currency, and collection membership costs one extra
 * request per collection, so it is only fetched for the whole-catalogue view.
 */
async function loadFromProductsJson(config: StorefrontConfig): Promise<LoadedProducts> {
  const root = config.rootUrl.replace(/\/$/, '');
  const base = config.collection ? `${root}/collections/${encodeURIComponent(config.collection)}` : root;
  const [raw, membership] = await Promise.all([
    fetchAllProductsJson(base),
    config.collection ? Promise.resolve(null) : fetchCollectionMembership(root).catch(() => null),
  ]);

  const products = raw.map((item) => {
    const product = mapAjaxProduct(item, config.rootUrl);
    const collections = membership?.get(item.id) ?? [];
    return { ...product, collections, collection: collections[0] ?? '' };
  });
  return { products, currencyCode: config.shopCurrency, source: 'products-json' };
}

/** Includes the index version, so "Rebuild index" in the admin invalidates every shopper's cache. */
function cacheKey(config: StorefrontConfig): string {
  return ['sobooster:v2', config.app.index.version, config.collection ?? '*', config.country ?? '', config.language ?? ''].join(':');
}

function readCache(key: string): LoadedProducts | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const cached = JSON.parse(raw) as { at: number; value: LoadedProducts };
    return Date.now() - cached.at < CACHE_TTL_MS ? cached.value : null;
  } catch {
    return null;
  }
}

function writeCache(key: string, value: LoadedProducts): void {
  try {
    window.sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), value }));
  } catch {
    // Storage full or blocked: the catalogue simply reloads next page view.
  }
}

/** Loads the catalogue once per session (10 min), preferring the Storefront API. */
export async function loadProducts(config: StorefrontConfig): Promise<LoadedProducts> {
  const key = cacheKey(config);
  const cached = readCache(key);
  if (cached) return cached;

  let loaded: LoadedProducts;
  try {
    loaded = await loadFromStorefrontApi(config);
  } catch (apiError) {
    console.warn('[SoBooster] Storefront API unavailable, using /products.json:', apiError);
    loaded = await loadFromProductsJson(config);
  }
  writeCache(key, loaded);
  return loaded;
}
