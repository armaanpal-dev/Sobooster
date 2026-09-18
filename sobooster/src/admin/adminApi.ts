import { normalizeAppConfig, type AppConfig } from '../config/appConfig';
import type { Product } from '../types';

/**
 * Admin GraphQL from the browser via Direct API access: App Bridge
 * authenticates `shopify:admin/...` requests, so there is no app backend.
 * Every operation here was validated against the Admin schema.
 */
const ENDPOINT = 'shopify:admin/api/2026-07/graphql.json';
export const CONFIG_NAMESPACE = 'sobooster';
export const CONFIG_KEY = 'config';

interface GraphQLResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

export async function adminGraphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) throw new Error(`Admin API responded ${response.status}`);
  const body = (await response.json()) as GraphQLResponse<T>;
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join('; '));
  if (!body.data) throw new Error('Admin API returned no data');
  return body.data;
}

export interface LoadedConfig {
  installationId: string;
  config: AppConfig;
  shop: { name: string; domain: string; currency: string };
  updatedAt: string | null;
}

export async function loadConfig(): Promise<LoadedConfig> {
  const data = await adminGraphql<{
    currentAppInstallation: { id: string; metafield: { value: string; updatedAt: string } | null };
    shop: { name: string; myshopifyDomain: string; currencyCode: string };
  }>(`query LoadConfig {
    currentAppInstallation {
      id
      metafield(namespace: "${CONFIG_NAMESPACE}", key: "${CONFIG_KEY}") { value updatedAt }
    }
    shop { name myshopifyDomain currencyCode }
  }`);
  const raw = data.currentAppInstallation.metafield?.value;
  let parsed: unknown;
  try {
    parsed = raw ? JSON.parse(raw) : undefined;
  } catch {
    parsed = undefined;
  }
  return {
    installationId: data.currentAppInstallation.id,
    config: normalizeAppConfig(parsed),
    shop: { name: data.shop.name, domain: data.shop.myshopifyDomain, currency: data.shop.currencyCode },
    updatedAt: data.currentAppInstallation.metafield?.updatedAt ?? null,
  };
}

/** Saves the whole config as one JSON app-data metafield; the theme extension reads it via app.metafields. */
export async function saveConfig(installationId: string, config: AppConfig): Promise<string | null> {
  const data = await adminGraphql<{
    metafieldsSet: { metafields: { updatedAt: string }[] | null; userErrors: { field: string[] | null; message: string }[] };
  }>(
    `mutation SaveConfig($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { id updatedAt }
        userErrors { field message }
      }
    }`,
    {
      metafields: [
        { ownerId: installationId, namespace: CONFIG_NAMESPACE, key: CONFIG_KEY, type: 'json', value: JSON.stringify(config) },
      ],
    },
  );
  const [error] = data.metafieldsSet.userErrors;
  if (error) throw new Error(error.message);
  return data.metafieldsSet.metafields?.[0]?.updatedAt ?? null;
}

export interface CatalogScan {
  productCount: number;
  collectionCount: number;
  scanned: number;
  drafts: number;
  outOfStock: number;
  /** Option name (as merchants wrote it) -> products using it. */
  options: { name: string; products: number }[];
  /** "prefix:" -> products with a tag of that shape, e.g. "fit:" from "fit:Slim". */
  tagPrefixes: { prefix: string; products: number }[];
}

const SCAN_PAGES = 10;

/** Reads up to 2,500 products to report what can be indexed and filtered. */
export async function scanCatalog(): Promise<CatalogScan> {
  const options = new Map<string, { name: string; products: number }>();
  const prefixes = new Map<string, number>();
  let productCount = 0;
  let collectionCount = 0;
  let scanned = 0;
  let drafts = 0;
  let outOfStock = 0;
  let after: string | null = null;

  for (let page = 0; page < SCAN_PAGES; page++) {
    const data: {
      productsCount: { count: number };
      collectionsCount: { count: number };
      products: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        nodes: { status: string; totalInventory: number | null; tags: string[]; options: { name: string; values: string[] }[] }[];
      };
    } = await adminGraphql(
      `query IndexStats($first: Int!, $after: String) {
        productsCount { count }
        collectionsCount { count }
        products(first: $first, after: $after) {
          pageInfo { hasNextPage endCursor }
          nodes { status totalInventory tags options { name values } }
        }
      }`,
      { first: 250, after },
    );
    productCount = data.productsCount.count;
    collectionCount = data.collectionsCount.count;
    for (const product of data.products.nodes) {
      scanned++;
      if (product.status !== 'ACTIVE') drafts++;
      if ((product.totalInventory ?? 0) <= 0) outOfStock++;
      for (const option of product.options) {
        if (option.name === 'Title' && option.values.length === 1 && option.values[0] === 'Default Title') continue;
        const key = option.name.trim().toLowerCase();
        const entry = options.get(key) ?? { name: option.name.trim(), products: 0 };
        entry.products++;
        options.set(key, entry);
      }
      const seen = new Set<string>();
      for (const tag of product.tags) {
        const match = /^([^:]{1,30}:)\s*\S/.exec(tag);
        if (match?.[1]) seen.add(match[1].toLowerCase());
      }
      seen.forEach((p) => prefixes.set(p, (prefixes.get(p) ?? 0) + 1));
    }
    if (!data.products.pageInfo.hasNextPage) break;
    after = data.products.pageInfo.endCursor;
  }

  return {
    productCount,
    collectionCount,
    scanned,
    drafts,
    outOfStock,
    options: [...options.values()].sort((a, b) => b.products - a.products),
    tagPrefixes: [...prefixes].map(([prefix, products]) => ({ prefix, products })).sort((a, b) => b.products - a.products),
  };
}

interface PreviewNode {
  legacyResourceId: string;
  title: string;
  handle: string;
  vendor: string;
  productType: string;
  tags: string[];
  totalInventory: number | null;
  tracksInventory: boolean;
  featuredMedia: { preview: { image: { url: string } | null } | null } | null;
  priceRangeV2: { minVariantPrice: { amount: string } };
  compareAtPriceRange: { maxVariantCompareAtPrice: { amount: string } } | null;
  hasOnlyDefaultVariant: boolean;
  collections: { nodes: { title: string }[] };
  options: { name: string; values: string[] }[];
}

/** A handful of the shop's active products, for the Settings card preview. */
export async function loadPreviewProducts(): Promise<Product[]> {
  const data = await adminGraphql<{ products: { nodes: PreviewNode[] } }>(
    `query PreviewProducts {
      products(first: 20, query: "status:active", sortKey: UPDATED_AT, reverse: true) {
        nodes {
          legacyResourceId title handle vendor productType tags totalInventory tracksInventory hasOnlyDefaultVariant
          featuredMedia { preview { image { url(transform: { maxWidth: 600 }) } } }
          priceRangeV2 { minVariantPrice { amount } }
          compareAtPriceRange { maxVariantCompareAtPrice { amount } }
          collections(first: 5) { nodes { title } }
          options { name values }
        }
      }
    }`,
  );
  return data.products.nodes.map((node) => {
    const price = Number(node.priceRangeV2.minVariantPrice.amount);
    const compareAt = Number(node.compareAtPriceRange?.maxVariantCompareAtPrice.amount ?? 0);
    const options: Record<string, string[]> = {};
    for (const option of node.options) options[option.name.trim().toLowerCase()] = option.values;
    const collections = node.collections.nodes.map((c) => c.title);
    return {
      id: Number(node.legacyResourceId),
      title: node.title,
      handle: node.handle,
      price,
      compare_at_price: compareAt > price ? compareAt : undefined,
      vendor: node.vendor,
      product_type: node.productType,
      collection: collections[0] ?? '',
      collections,
      color: options.color ?? options.colour ?? [],
      size: options.size ?? [],
      availability: !node.tracksInventory || (node.totalInventory ?? 0) > 0,
      tags: node.tags,
      image: node.featuredMedia?.preview?.image?.url ?? '',
      options,
      singleVariant: node.hasOnlyDefaultVariant,
    };
  });
}
