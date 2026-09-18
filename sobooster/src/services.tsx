import { createContext, useContext, type ReactNode } from 'react';
import type { Product } from './types';

export interface PageLink {
  title: string;
  url: string;
}

export interface VariantChoice {
  id: number;
  title: string;
  available: boolean;
}

/**
 * Capabilities that only exist on a real storefront. The standalone demo
 * provides none, and the UI simply leaves out Add to cart and falls back to
 * "popular products" for recommendations.
 */
export interface StoreServices {
  /** Adds one unit of a variant; resolves when the cart has been updated. */
  addToCart?: (variantId: number) => Promise<void>;
  /** Variants of a multi-variant product, for the card's picker. */
  loadVariants?: (product: Product) => Promise<VariantChoice[]>;
  /** Products Shopify recommends alongside the given one (ids only; matched against the catalogue). */
  recommendFor?: (product: Product, limit: number) => Promise<number[]>;
  /** Store pages and blog posts matching a query (Shopify predictive search). */
  searchPages?: (query: string, signal: AbortSignal) => Promise<PageLink[]>;
  cartUrl?: string;
}

const ServicesContext = createContext<StoreServices>({});

export function StoreServicesProvider({ value, children }: { value: StoreServices; children: ReactNode }) {
  return <ServicesContext.Provider value={value}>{children}</ServicesContext.Provider>;
}

export function useStoreServices(): StoreServices {
  return useContext(ServicesContext);
}
