import { defineConfig, type HmrOptions, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Under `shopify app dev` the CLI passes the tunnel URL as HOST, which Vite
// would otherwise treat as its bind address.
if (process.env.HOST && (!process.env.SHOPIFY_APP_URL || process.env.SHOPIFY_APP_URL === process.env.HOST)) {
  process.env.SHOPIFY_APP_URL = process.env.HOST;
  delete process.env.HOST;
}

const appUrl = process.env.SHOPIFY_APP_URL;
const tunnelHost = appUrl ? new URL(appUrl).hostname : null;

const hmr: HmrOptions | undefined =
  tunnelHost && tunnelHost !== 'localhost'
    ? { protocol: 'wss', host: tunnelHost, port: Number(process.env.FRONTEND_PORT) || 8002, clientPort: 443 }
    : undefined;

/**
 * Loads App Bridge when running embedded in the Shopify admin. It must be the
 * first script on the page and read the API key from a meta tag before it runs.
 * Without SHOPIFY_API_KEY (plain `npm run dev`) nothing is added.
 */
function shopifyAppBridge(apiKey: string | undefined): Plugin {
  return {
    name: 'shopify-app-bridge',
    transformIndexHtml() {
      if (!apiKey) return [];
      return [
        { tag: 'meta', attrs: { name: 'shopify-api-key', content: apiKey }, injectTo: 'head-prepend' },
        { tag: 'script', attrs: { src: 'https://cdn.shopify.com/shopifycloud/app-bridge.js' }, injectTo: 'head-prepend' },
      ];
    },
  };
}

export default defineConfig({
  plugins: [react(), shopifyAppBridge(process.env.SHOPIFY_API_KEY)],
  server: {
    port: Number(process.env.PORT) || 5173,
    strictPort: Boolean(process.env.PORT),
    allowedHosts: tunnelHost ? [tunnelHost] : [],
    hmr,
  },
});
