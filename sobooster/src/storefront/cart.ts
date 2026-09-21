import type { CartSettings } from '../config/appConfig';
import type { PageLink, StoreServices, VariantChoice } from '../services';
import type { Product } from '../types';

/**
 * Storefront services over Shopify's Ajax APIs: same origin, no token, and
 * they work on password-protected stores once the visitor is in.
 * - Cart:            POST /cart/add.js, then GET /cart.js for the new count
 * - Variants:        GET  /products/{handle}.js
 * - Recommendations: GET  /recommendations/products.json
 * - Pages:           GET  /search/suggest.json (predictive search: pages, articles)
 */
interface Options {
  rootUrl: string;
  cartUrl: string;
  cart: CartSettings;
}

/**
 * Dawn-family sections refreshed in the same request (Section Rendering API):
 * the header cart count and the cart drawer's contents.
 */
const CART_SECTIONS = ['cart-icon-bubble', 'cart-drawer'];

/** Common cart-count elements in other themes; only text-only elements are touched. */
const COUNT_SELECTORS = '[data-cart-count], .cart-count, .cart__count, .header__cart-count, .cart-link__bubble-num, .js-cart-count';

interface AjaxCart {
  token: string;
  item_count: number;
  items: { key: string; quantity: number }[];
}

const innerOf = (html: string, selector: string) =>
  new DOMParser().parseFromString(html, 'text/html').querySelector(selector)?.innerHTML;

/** Dawn and its forks: swap in the re-rendered cart icon and drawer. */
function refreshDawnSections(sections: Record<string, string | null> | undefined) {
  const bubbleHtml = sections?.['cart-icon-bubble'];
  const bubble = document.getElementById('cart-icon-bubble');
  if (bubbleHtml && bubble) {
    const inner = innerOf(bubbleHtml, '.shopify-section');
    if (inner !== undefined) bubble.innerHTML = inner;
  }

  const drawerHtml = sections?.['cart-drawer'];
  const drawer = document.getElementById('CartDrawer');
  if (drawerHtml && drawer) {
    const inner = innerOf(drawerHtml, '#CartDrawer');
    if (inner !== undefined) drawer.innerHTML = inner;
    document.querySelector('cart-drawer')?.classList.remove('is-empty');
  }
}

/**
 * Shopify's standard storefront event, which Horizon and newer themes listen
 * for to update the cart icon and re-render the cart drawer. Built by hand to
 * match https://cdn.shopify.com/storefront/standard-events.js, so there is no
 * dependency on that module being loaded.
 */
function dispatchStandardCartEvent(variantId: number, cart: AjaxCart) {
  const event = new Event('shopify:cart:lines-update', { bubbles: true, cancelable: true });
  Object.assign(event, {
    action: 'add',
    lines: [{ merchandiseId: `gid://shopify/ProductVariant/${variantId}`, quantity: 1 }],
    promise: Promise.resolve({
      cart: {
        id: `gid://shopify/Cart/${cart.token}`,
        totalQuantity: cart.item_count,
        lines: cart.items.map((item) => ({ id: item.key, quantity: item.quantity })),
      },
      detail: { itemCount: cart.item_count },
    }),
  });
  document.dispatchEvent(event);
}

/**
 * Horizon's drawer opens itself on the standard cart event, but only when it
 * carries the `auto-open` attribute (the theme's "Auto-open cart drawer"
 * setting). It reads the attribute synchronously, so it is set just for the
 * dispatch. Returns the drawer if this theme has one.
 */
function withHorizonAutoOpen(open: boolean, dispatch: () => void): boolean {
  const drawer = document.querySelector('cart-drawer-component');
  const added = open && drawer !== null && !drawer.hasAttribute('auto-open');
  if (added) drawer.setAttribute('auto-open', '');
  try {
    dispatch();
  } finally {
    if (added) drawer.removeAttribute('auto-open');
  }
  return drawer !== null;
}

/**
 * Themes without Horizon's drawer:
 * - Dawn and its family (Sense, Craft, Refresh, Studio…): <cart-drawer> has a public open().
 * - The merchant's selector from Settings, for any theme whose cart icon opens a drawer.
 * - A cart toggle button that declares the drawer it controls. Only buttons are
 *   clicked automatically, because clicking a cart link would leave the page.
 */
function openOtherDrawer(selector: string): boolean {
  const dawn = document.querySelector('cart-drawer') as (HTMLElement & { open?: () => void }) | null;
  if (dawn && typeof dawn.open === 'function') {
    dawn.open();
    return true;
  }
  let trigger: HTMLElement | null = null;
  try {
    trigger = selector ? document.querySelector<HTMLElement>(selector) : null;
  } catch {
    console.warn(`[SoBooster] Invalid cart drawer selector "${selector}"`);
  }
  trigger ??= document.querySelector<HTMLElement>('button[aria-controls*="cart" i]');
  trigger?.click();
  return trigger !== null;
}

/** Our instant-search overlay is a modal; close it so the drawer isn't hidden behind it. */
function closeSearchOverlay() {
  document.querySelector<HTMLDialogElement>('.sb-root--overlay dialog[open]')?.close();
}

/** Any other theme: set the number in its count element, if it has a plain one. */
function updateCountElements(count: number) {
  document.querySelectorAll<HTMLElement>(COUNT_SELECTORS).forEach((element) => {
    if (element.children.length === 0) element.textContent = String(count);
  });
}

export function createStoreServices({ rootUrl, cartUrl, cart: settings }: Options): StoreServices {
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

      refreshDawnSections(body.sections);
      const cart = await fetch(`${root}/cart.js`, { headers: { Accept: 'application/json' } })
        .then((r) => (r.ok ? (r.json() as Promise<AjaxCart>) : null))
        .catch(() => null);
      const openDrawer = settings.afterAdd === 'drawer';
      if (openDrawer) closeSearchOverlay();
      let horizon = false;
      if (cart) {
        horizon = withHorizonAutoOpen(openDrawer, () => dispatchStandardCartEvent(variantId, cart));
        updateCountElements(cart.item_count);
      }
      if (openDrawer && !horizon) openOtherDrawer(settings.drawerSelector);
      // Older themes and other apps listen for these.
      document.dispatchEvent(new CustomEvent('cart:refresh', { bubbles: true, detail: cart }));
      document.dispatchEvent(new CustomEvent('sobooster:cart:added', { detail: { variantId } }));
      if (settings.afterAdd === 'cart') window.location.assign(cartUrl);
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
