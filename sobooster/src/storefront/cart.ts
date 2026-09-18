import type { PageLink, StoreServices, VariantChoice } from '../services';
import type { Product } from '../types';

/**
 * Storefront services over Shopify's Ajax APIs: same origin, no token, and
 * they work on password-protected stores once the visitor is in.
 * - Cart:            POST /cart/add.js
 * - Variants:        GET  /products/{handle}.js
 * - Recommendations: GET  /recommendations/products.json
 * - Pages:           GET  /search/suggest.json (predictive search: pages, articles)
 */
interface Options {
  rootUrl: string;
  cartUrl: string;
  afterAdd: 'notify' | 'cart';
}

/** Theme sections that commonly show the cart count, refreshed in the same request (Section Rendering API). */
const CART_SECTIONS = ['cart-icon-bubble', 'cart-notification-button', 'header'];

function refreshCartSections(sections: Record<string, string | null> | undefined) {
  if (!sections) return;
  const html = sections['cart-icon-bubble'];
  const bubble = document.getElementById('cart-icon-bubble');
  if (html && bubble) {
    const fresh = new DOMParser().parseFromString(html, 'text/html').querySelector('.shopify-section');
    if (fresh) bubble.innerHTML = fresh.innerHTML;
  }
}

export function createStoreServices({ rootUrl, cartUrl, afterAdd }: Options): StoreServices {
  const root = rootUrl.replace(/\/$/, '');

  return {
    cartUrl,

    async addToCart(variantId: number) {
      const response = await fetch(`${root}/cart/add.js`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ items: [{ id: variantId, quantity: 1 }], sections: CART_SECTIONS.join(',') }),
      });
      const body = (await response.json().catch(() => ({}))) as { description?: string; sections?: Record<string, string | null> };
      if (!response.ok) throw new Error(body.description ?? 'Could not add to cart');

      refreshCartSections(body.sections);
      // Let the theme and other apps react (many themes listen for one of these).
      document.dispatchEvent(new CustomEvent('cart:refresh', { bubbles: true }));
      document.dispatchEvent(new CustomEvent('sobooster:cart:added', { detail: { variantId } }));
      if (afterAdd === 'cart') window.location.assign(cartUrl);
    },

    async loadVariants(product: Product): Promise<VariantChoice[]> {
      if (!product.handle) return [];
      const response = await fetch(`${root}/products/${product.handle}.js`, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`Variants responded ${response.status}`);
      const body = (await response.json()) as { variants?: { id: number; title: string; available: boolean }[] };
      return (body.variants ?? []).map((v) => ({ id: v.id, title: v.title, available: v.available }));
    },

    async recommendFor(product: Product, limit: number): Promise<number[]> {
      const response = await fetch(
        `${root}/recommendations/products.json?product_id=${product.id}&limit=${limit}&intent=related`,
        { headers: { Accept: 'application/json' } },
      );
      if (!response.ok) return [];
      const body = (await response.json()) as { products?: { id: number }[] };
      return (body.products ?? []).map((p) => p.id);
    },

    async searchPages(query: string, signal: AbortSignal): Promise<PageLink[]> {
      const params = new URLSearchParams({ q: query, 'resources[type]': 'page,article', 'resources[limit]': '4' });
      const response = await fetch(`${root}/search/suggest.json?${params}`, { signal, headers: { Accept: 'application/json' } });
      if (!response.ok) return [];
      const body = (await response.json()) as {
        resources?: { results?: { pages?: { title: string; url: string }[]; articles?: { title: string; url: string }[] } };
      };
      const results = body.resources?.results;
      return [...(results?.pages ?? []), ...(results?.articles ?? [])].map((p) => ({ title: p.title, url: p.url }));
    },
  };
}
