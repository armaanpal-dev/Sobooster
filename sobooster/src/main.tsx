import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router';
import { AdminApp } from './admin/AdminApp';
import { App } from './App';
import { CatalogProvider } from './catalog';
import { demoCatalog } from './data/catalog';
import { RouterUrlProvider } from './router-url-state';
import './styles.css';

/**
 * One bundle, two entry points:
 * - Inside the Shopify admin (App Bridge's API-key meta tag is injected by
 *   vite.config.ts when the CLI runs the app): the SoBooster admin.
 * - Otherwise: the standalone demo at /products over the generated dataset.
 */
const inShopifyAdmin =
  document.querySelector('meta[name="shopify-api-key"]') !== null && !window.location.pathname.startsWith('/products');

function Demo() {
  return (
    <CatalogProvider catalog={demoCatalog}>
      <RouterUrlProvider>
        <main className="sb-root sb-root--standalone">
          <App
            stickyMasthead
            masthead={
              <Link className="sb-brand" to="/products">
                SoBooster<span>.</span>
              </Link>
            }
          />
        </main>
      </RouterUrlProvider>
    </CatalogProvider>
  );
}

function ToDemo() {
  const { search } = useLocation();
  return <Navigate to={{ pathname: '/products', search }} replace />;
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    {inShopifyAdmin ? (
      <AdminApp />
    ) : (
      <BrowserRouter>
        <Routes>
          <Route path="/products" element={<Demo />} />
          <Route path="*" element={<ToDemo />} />
        </Routes>
      </BrowserRouter>
    )}
  </StrictMode>,
);
