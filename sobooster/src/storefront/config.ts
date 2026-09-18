import { normalizeAppConfig, type AppConfig } from '../config/appConfig';

/** Rendered by the Liquid blocks into a data attribute or JSON script tag. */
export interface StorefrontConfig {
  /** Restrict results to one collection (collection pages, or the block's setting). */
  collection: string | null;
  /** "collection" hides the search box and recommendations; filters and sorting stay. */
  mode: 'search' | 'collection';
  /** Shopper's market, so prices come back in their currency. */
  country: string | null;
  language: string | null;
  /** For number formatting, e.g. "en-GB". */
  locale: string | null;
  /** Market-aware root, "/" or "/fr/". Product links are built from it. */
  rootUrl: string;
  cartUrl: string;
  /** Shop's base currency; /products.json prices are in it. */
  shopCurrency: string;
  heading: string | null;
  /** Embed only: where to mount, replacing the theme's own results. */
  selector?: string | null;
  /** Everything configured in the admin (app-data metafield), with defaults filled in. */
  app: AppConfig;
}

const asString = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value : null);

export function parseConfig(json: string | null | undefined): StorefrontConfig {
  let raw: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(json ?? '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) raw = parsed as Record<string, unknown>;
  } catch {
    // Malformed config: fall back to defaults rather than rendering nothing.
  }
  const rootUrl = asString(raw.rootUrl) ?? '/';
  return {
    collection: asString(raw.collection),
    mode: raw.mode === 'collection' ? 'collection' : 'search',
    country: asString(raw.country),
    language: asString(raw.language),
    locale: asString(raw.locale),
    rootUrl,
    cartUrl: asString(raw.cartUrl) ?? `${rootUrl.replace(/\/$/, '')}/cart`,
    shopCurrency: asString(raw.shopCurrency) ?? 'USD',
    heading: asString(raw.heading),
    selector: asString(raw.selector),
    app: normalizeAppConfig(raw.app),
  };
}
