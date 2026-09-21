import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { cardStyleVars } from '../cardStyle';
import { buildCatalog, CatalogProvider } from '../catalog';
import { ProductCard } from '../components/ProductCard';
import type { AppConfig, CardSettings } from '../config/appConfig';
import { SORT_LABELS } from '../lib/sort';
import { StoreServicesProvider, type StoreServices } from '../services';
import { SORT_KEYS, type Product } from '../types';
import type { PageProps } from './AdminApp';
import { loadPreviewProducts } from './adminApi';
import { Card, Checkbox, Select, TextField } from './ui';

/** Up to four of the shop's products: one on sale, one sold out, the rest regular. */
function sampleProducts(all: readonly Product[]): Product[] {
  const onSale = all.find((p) => p.availability && p.compare_at_price);
  const soldOut = all.find((p) => !p.availability);
  const regular = all.filter((p) => p !== onSale && p !== soldOut).slice(0, 4 - Number(!!onSale) - Number(!!soldOut));
  return [onSale, ...regular, soldOut].filter((p): p is Product => p !== undefined);
}

/** In the preview, Add to cart pretends to work so merchants can see every button state. */
const previewServices: StoreServices = {
  addToCart: () => new Promise((resolve) => window.setTimeout(resolve, 500)),
  loadVariants: async () => [
    { id: 1, title: 'S', available: true },
    { id: 2, title: 'M', available: true },
    { id: 3, title: 'L', available: false },
  ],
};

export function SettingsPage({ config, update }: PageProps) {
  const cards = config.cards;
  const setCards = (change: Partial<CardSettings>) => update((c) => ({ ...c, cards: { ...c.cards, ...change } }));
  const setSection = <K extends 'search' | 'layout' | 'cart'>(key: K, change: Partial<AppConfig[K]>) =>
    update((c) => ({ ...c, [key]: { ...c[key], ...change } }));

  const [storeProducts, setStoreProducts] = useState<Product[] | null>(null);
  useEffect(() => {
    let active = true;
    loadPreviewProducts()
      .then((products) => active && setStoreProducts(products))
      .catch(() => active && setStoreProducts([]));
    return () => {
      active = false;
    };
  }, []);

  const sample = useMemo(() => sampleProducts(storeProducts ?? []), [storeProducts]);
  const previewCatalog = useMemo(() => buildCatalog(sample, config), [sample, config]);
  const previewGrid = { gridTemplateColumns: `repeat(${Math.min(cards.columnsDesktop, 4)}, minmax(0, 1fr))` } as CSSProperties;

  return (
    <>
      <h1>Settings</h1>

      <div className="sb-admin__split">
        <div>
          <Card title="Product cards">
            <div className="sb-admin__grid">
              <Select
                label="Image shape"
                value={cards.imageRatio}
                options={[
                  { value: 'portrait', label: 'Portrait (4:5)' },
                  { value: 'square', label: 'Square (1:1)' },
                  { value: 'landscape', label: 'Landscape (4:3)' },
                ]}
                onChange={(imageRatio) => setCards({ imageRatio })}
              />
              <Select
                label="Image fit"
                value={cards.imageFit}
                options={[
                  { value: 'cover', label: 'Fill (crop)' },
                  { value: 'contain', label: 'Fit (no crop)' },
                ]}
                onChange={(imageFit) => setCards({ imageFit })}
              />
              <TextField
                label="Products per row (desktop)"
                type="number"
                min={2}
                max={6}
                value={cards.columnsDesktop}
                onChange={(v) => setCards({ columnsDesktop: Math.min(6, Math.max(2, Number(v) || 4)) })}
              />
              <Select
                label="Products per row (mobile)"
                value={String(cards.columnsMobile) as '1' | '2'}
                options={[
                  { value: '1', label: '1' },
                  { value: '2', label: '2' },
                ]}
                onChange={(v) => setCards({ columnsMobile: Number(v) })}
              />
              <TextField
                label={`Corner radius (${cards.radius}px)`}
                type="number"
                min={0}
                max={32}
                value={cards.radius}
                onChange={(v) => setCards({ radius: Math.min(32, Math.max(0, Number(v) || 0)) })}
              />
              <Select
                label="Text alignment"
                value={cards.textAlign}
                options={[
                  { value: 'left', label: 'Left' },
                  { value: 'center', label: 'Centre' },
                ]}
                onChange={(textAlign) => setCards({ textAlign })}
              />
            </div>
            <h3>Show on cards</h3>
            <div className="sb-admin__grid">
              <Checkbox label="Vendor" checked={cards.showVendor} onChange={(showVendor) => setCards({ showVendor })} />
              <Checkbox label="Sale badge" checked={cards.showSaleBadge} onChange={(showSaleBadge) => setCards({ showSaleBadge })} />
              <Checkbox
                label="Sold-out badge"
                checked={cards.showSoldOutBadge}
                onChange={(showSoldOutBadge) => setCards({ showSoldOutBadge })}
              />
              <Checkbox label="Available sizes" checked={cards.showSizes} onChange={(showSizes) => setCards({ showSizes })} />
              <Checkbox
                label="Add to cart button"
                help="Multi-variant products open a size/option picker."
                checked={cards.showAddToCart}
                onChange={(showAddToCart) => setCards({ showAddToCart })}
              />
            </div>
            <h3>Button &amp; colours</h3>
            <div className="sb-admin__grid">
              <Select
                label="Button style"
                value={cards.buttonStyle}
                options={[
                  { value: 'filled', label: 'Filled' },
                  { value: 'outline', label: 'Outline' },
                ]}
                onChange={(buttonStyle) => setCards({ buttonStyle })}
              />
              <TextField label="Button text" value={cards.buttonLabel} onChange={(buttonLabel) => setCards({ buttonLabel })} />
              <TextField label="Button colour" type="color" value={cards.buttonColor} onChange={(buttonColor) => setCards({ buttonColor })} />
              <TextField
                label="Button text colour"
                type="color"
                value={cards.buttonTextColor}
                onChange={(buttonTextColor) => setCards({ buttonTextColor })}
              />
              <TextField
                label="Accent (sale price, badges, chips)"
                type="color"
                value={cards.accentColor}
                onChange={(accentColor) => setCards({ accentColor })}
              />
            </div>
          </Card>
        </div>

        <div className="sb-admin__preview-col">
          <Card title="Preview">
            <CatalogProvider catalog={previewCatalog}>
              <StoreServicesProvider value={previewServices}>
                <div className="sb-root sb-admin__preview">
                  <div className={`sb-page sb-cards--${cards.textAlign}`} style={cardStyleVars(cards)}>
                    {storeProducts === null && <p>Loading products…</p>}
                    {storeProducts !== null && sample.length === 0 && <p>Add an active product to your store to see the preview.</p>}
                    <ul className="sb-grid" style={previewGrid}>
                      {sample.map((product) => (
                        <li key={product.id}>
                          <ProductCard product={product} />
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </StoreServicesProvider>
            </CatalogProvider>
          </Card>
        </div>
      </div>

      <Card title="Search">
        <div className="sb-admin__grid">
          <Checkbox
            label="Search suggestions"
            help="Matching terms and products under the search box as shoppers type."
            checked={config.search.suggestions}
            onChange={(suggestions) => setSection('search', { suggestions })}
          />
          <Checkbox
            label="Pages in instant results"
            help="Store pages and blog posts matching the search, from Shopify's predictive search."
            checked={config.search.showPages}
            onChange={(showPages) => setSection('search', { showPages })}
          />
          <TextField
            label="Products in instant results"
            type="number"
            min={0}
            max={8}
            value={config.search.suggestionProducts}
            onChange={(v) => setSection('search', { suggestionProducts: Math.min(8, Math.max(0, Number(v) || 0)) })}
          />
          <Checkbox
            label="Recent searches"
            help="Each shopper's last 5 searches, stored in their browser."
            checked={config.search.recentSearches}
            onChange={(recentSearches) => setSection('search', { recentSearches })}
          />
          <Checkbox
            label="Product recommendations"
            help="“You may also like” under results, from Shopify's recommendations for the top result; popular products when nothing matches."
            checked={config.search.recommendations}
            onChange={(recommendations) => setSection('search', { recommendations })}
          />
          <TextField
            label="Recommendations shown"
            type="number"
            min={2}
            max={12}
            value={config.search.recommendationCount}
            onChange={(v) => setSection('search', { recommendationCount: Math.min(12, Math.max(2, Number(v) || 4)) })}
          />
        </div>
      </Card>

      <Card title="Results & cart">
        <div className="sb-admin__grid">
          <TextField
            label="Products per page"
            type="number"
            min={8}
            max={96}
            value={config.layout.productsPerPage}
            help="More load with “Show more”."
            onChange={(v) => setSection('layout', { productsPerPage: Math.min(96, Math.max(8, Number(v) || 24)) })}
          />
          <Select
            label="Default sort"
            value={config.layout.defaultSort}
            options={SORT_KEYS.map((key) => ({ value: key, label: SORT_LABELS[key] }))}
            onChange={(defaultSort) => setSection('layout', { defaultSort })}
          />
          <Select
            label="After Add to cart"
            value={config.cart.afterAdd}
            options={[
              { value: 'drawer', label: 'Open the cart drawer' },
              { value: 'notify', label: 'Stay on the page' },
              { value: 'cart', label: 'Go to the cart' },
            ]}
            onChange={(afterAdd) => setSection('cart', { afterAdd })}
          />
          {config.cart.afterAdd === 'drawer' && (
            <TextField
              label="Cart drawer button (CSS selector)"
              value={config.cart.drawerSelector}
              help="Leave empty for Horizon, Dawn and Dawn-based themes. For other themes, the element that opens the cart drawer, e.g. .header__cart-toggle."
              onChange={(drawerSelector) => setSection('cart', { drawerSelector })}
            />
          )}
        </div>
      </Card>
    </>
  );
}
