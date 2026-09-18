import { createContext, useContext, type ReactNode } from 'react';
import { activeFacets, DEFAULT_CONFIG, type AppConfig } from './config/appConfig';
import { collectFacetValues } from './lib/facetValues';
import { createMatcher, type Matcher } from './lib/search';
import { buildSlugIndex, type SlugIndex } from './lib/url';
import type { FacetDef, FacetValues, Product } from './types';

/** A loaded product set plus everything derived from it and the app config, once. */
export interface Catalog {
  products: readonly Product[];
  facets: readonly FacetDef[];
  facetValues: FacetValues;
  slugIndex: SlugIndex;
  matcher: Matcher;
  config: AppConfig;
}

/** Applies the Index settings (exclusions, searchable fields, synonyms) and the enabled filters. */
export function buildCatalog(all: readonly Product[], config: AppConfig = DEFAULT_CONFIG): Catalog {
  const excluded = new Set(config.index.excludedTags);
  const products = all.filter(
    (p) =>
      !(config.index.excludeOutOfStock && !p.availability) &&
      !(excluded.size > 0 && p.tags.some((t) => excluded.has(t.toLowerCase()))),
  );
  const facets = activeFacets(config);
  const facetValues = collectFacetValues(products, facets);
  return {
    products,
    facets,
    facetValues,
    slugIndex: buildSlugIndex(facetValues),
    matcher: createMatcher(config.index.fields, config.synonyms),
    config,
  };
}

const CatalogContext = createContext<Catalog | null>(null);

export function CatalogProvider({ catalog, children }: { catalog: Catalog; children: ReactNode }) {
  return <CatalogContext.Provider value={catalog}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): Catalog {
  const catalog = useContext(CatalogContext);
  if (!catalog) throw new Error('useCatalog must be used inside <CatalogProvider>');
  return catalog;
}
