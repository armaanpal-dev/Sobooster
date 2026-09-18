import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles.css';
import { parseConfig } from './config';
import { SearchOverlay } from './SearchOverlay';
import { StorefrontApp } from './StorefrontApp';

/**
 * Storefront entry, served from the theme app extension's assets.
 *
 * - App block: renders <div data-sobooster-root data-config="…">; we mount there.
 * - App embed: renders <script id="sobooster-embed-config">; we replace the
 *   theme's results container (config.selector) with the app, unless the
 *   merchant has also placed the block on this page, in which case it wins.
 * - Instant search: the embed renders <script id="sobooster-overlay-config"> on
 *   every page plus a tiny inline loader that intercepts the theme's search
 *   icon; we mount the overlay that the loader then opens.
 */

const MOUNTED = 'soboosterMounted';

function mount(element: HTMLElement, configJson: string | null | undefined) {
  if (element.dataset[MOUNTED]) return;
  element.dataset[MOUNTED] = 'true';
  createRoot(element).render(
    <StrictMode>
      <StorefrontApp config={parseConfig(configJson)} />
    </StrictMode>,
  );
}

function mountBlocks(): number {
  const blocks = document.querySelectorAll<HTMLElement>('[data-sobooster-root]');
  blocks.forEach((element) => mount(element, element.dataset.config));
  return blocks.length;
}

function mountEmbed() {
  const script = document.getElementById('sobooster-embed-config');
  if (!script) return;
  const config = parseConfig(script.textContent);
  const target = document.querySelector<HTMLElement>(config.selector ?? '#MainContent, main');
  if (!target) {
    console.warn(`[SoBooster] App embed: no element matches "${config.selector ?? '#MainContent, main'}".`);
    return;
  }
  const container = document.createElement('div');
  container.className = 'sb-mount';
  target.replaceChildren(container);
  mount(container, script.textContent);
}

function mountOverlay() {
  const script = document.getElementById('sobooster-overlay-config');
  if (!script) return;
  const host = document.createElement('div');
  host.className = 'sb-root sb-root--overlay';
  document.body.appendChild(host);
  createRoot(host).render(
    <StrictMode>
      <SearchOverlay config={parseConfig(script.textContent)} />
    </StrictMode>,
  );
}

function start() {
  if (mountBlocks() === 0) mountEmbed();
  mountOverlay();
}

declare global {
  interface Window {
    __sobooster?: boolean;
  }
}

// The block (schema "javascript") and the embed (<script>) can both include this file.
if (!window.__sobooster) {
  window.__sobooster = true;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
  // Theme editor re-renders sections in place; mount any block it adds.
  document.addEventListener('shopify:section:load', mountBlocks);
}
