import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const OUT_DIR = 'extensions/sobooster-search/assets';

/**
 * Writes an output file only when its bytes changed. `shopify app dev` rebundles
 * the theme extension whenever a file in it is touched; rewriting identical
 * assets on startup started a second bundle while the first was still copying,
 * which failed with ENOENT. With this, startup writes nothing and each real
 * change triggers exactly one rebundle.
 */
function writeIfChanged(outDir: string): Plugin {
  return {
    name: 'sobooster-write-if-changed',
    generateBundle: {
      // After Vite's own plugins, so the extracted stylesheet is in the bundle too.
      order: 'post',
      handler(_options, bundle) {
        for (const [fileName, output] of Object.entries(bundle)) {
          const content = output.type === 'chunk' ? output.code : output.source;
          const target = join(outDir, fileName);
          const next = Buffer.from(content);
          if (!existsSync(target) || !readFileSync(target).equals(next)) {
            mkdirSync(dirname(target), { recursive: true });
            writeFileSync(target, next);
          }
        }
      },
    },
  };
}

/**
 * Builds the storefront script into the theme app extension's assets:
 * one self-contained IIFE plus one stylesheet, which Shopify serves from its
 * CDN. Run with --watch during `shopify app dev`.
 *
 * React is aliased to preact/compat here only: same components, ~10x smaller
 * runtime, which matters for a script on every search page of a live store.
 */
export default defineConfig({
  plugins: [react(), writeIfChanged(OUT_DIR)],
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  publicDir: false,
  resolve: {
    alias: [
      { find: /^react-dom\/client$/, replacement: 'preact/compat/client' },
      { find: /^react-dom$/, replacement: 'preact/compat' },
      { find: /^react\/jsx-runtime$/, replacement: 'preact/jsx-runtime' },
      { find: /^react$/, replacement: 'preact/compat' },
    ],
  },
  build: {
    outDir: OUT_DIR,
    emptyOutDir: false,
    // Files are written by writeIfChanged, not by Vite.
    write: false,
    cssCodeSplit: false,
    lib: {
      entry: 'src/storefront/main.tsx',
      formats: ['iife'],
      name: 'SoBooster',
      fileName: () => 'sobooster.js',
      cssFileName: 'sobooster',
    },
  },
});
