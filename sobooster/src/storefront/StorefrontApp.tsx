import { useEffect, useMemo, useState } from 'react';
import { App } from '../App';
import { buildCatalog, CatalogProvider, type Catalog } from '../catalog';
import { configureCurrency } from '../lib/format';
import { StoreServicesProvider } from '../services';
import { HistoryUrlProvider } from '../url-state';
import { createStoreServices } from './cart';
import type { StorefrontConfig } from './config';
import { loadProducts } from './loadProducts';

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; catalog: Catalog };

export function StorefrontApp({ config }: { config: StorefrontConfig }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    loadProducts(config)
      .then(({ products, currencyCode }) => {
        if (cancelled) return;
        configureCurrency(currencyCode, config.locale ?? undefined);
        setState({ status: 'ready', catalog: buildCatalog(products, config.app) });
      })
      .catch((error: unknown) => {
        console.error('[SoBooster] Could not load products:', error);
        if (!cancelled) setState({ status: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [config]);

  const services = useMemo(
    () => createStoreServices({ rootUrl: config.rootUrl, cartUrl: config.cartUrl, cart: config.app.cart }),
    [config],
  );

  return (
    <div className="sb-root sb-root--storefront">
      {state.status === 'loading' && (
        <div className="sb-page" aria-busy="true">
          <p className="sb-visually-hidden" role="status">
            Loading products…
          </p>
          <div className="sb-skeleton" aria-hidden="true">
            {Array.from({ length: 8 }, (_, i) => (
              <span key={i} />
            ))}
          </div>
        </div>
      )}
      {state.status === 'error' && (
        <p className="sb-status" role="alert">
          Products couldn't be loaded. Please refresh the page.
        </p>
      )}
      {state.status === 'ready' && (
        <CatalogProvider catalog={state.catalog}>
          <StoreServicesProvider value={services}>
            <HistoryUrlProvider>
              <App
                mode={config.mode}
                masthead={config.heading ? <h1 className="sb-heading">{config.heading}</h1> : undefined}
              />
            </HistoryUrlProvider>
          </StoreServicesProvider>
        </CatalogProvider>
      )}
    </div>
  );
}
