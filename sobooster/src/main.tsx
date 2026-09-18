import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AdminApp } from './admin/AdminApp';
import './styles.css';

/**
 * The SoBooster admin. It runs embedded in the Shopify admin, where App Bridge
 * (injected by vite.config.ts under `shopify app dev`) authenticates its Admin
 * API calls. The storefront UI is a separate bundle: see src/storefront/.
 */
const inShopifyAdmin = document.querySelector('meta[name="shopify-api-key"]') !== null;

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    {inShopifyAdmin ? (
      <AdminApp />
    ) : (
      <main className="sb-root" style={{ padding: '2rem' }}>
        <h1>SoBooster</h1>
        <p>
          Open SoBooster from your Shopify admin. For development, run <code>shopify app dev</code>.
        </p>
      </main>
    )}
  </StrictMode>,
);
