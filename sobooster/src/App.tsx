import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { cardStyleVars } from './cardStyle';
import { useCatalog } from './catalog';
import { ActiveChips } from './components/ActiveChips';
import { EmptyState } from './components/EmptyState';
import { FilterPanel } from './components/FilterPanel';
import { MobileFilterDrawer } from './components/MobileFilterDrawer';
import { ProductGrid } from './components/ProductGrid';
import { Recommendations } from './components/Recommendations';
import { SearchBar } from './components/SearchBar';
import { SortSelect } from './components/SortSelect';
import { useProductQuery } from './hooks/useProductQuery';
import { availableSorts } from './lib/sort';
import { countActiveFilters } from './lib/url';

interface Props {
  /** Shown beside the search box: the demo's brand link, or a storefront heading. */
  masthead?: ReactNode;
  /** Standalone demo pins the search bar; on a storefront the theme owns the header. */
  stickyMasthead?: boolean;
  /** Collection pages browse rather than search: no search box, no recommendations. */
  mode?: 'search' | 'collection';
}

export function App({ masthead, stickyMasthead = false, mode = 'search' }: Props) {
  const { products, facets, facetValues, config } = useCatalog();
  const view = useProductQuery();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const activeCount = countActiveFilters(view.filters);
  const sorts = useMemo(() => availableSorts(products), [products]);
  const style = useMemo(() => cardStyleVars(config.cards), [config.cards]);

  const panel = (
    <FilterPanel
      facets={facets}
      facetValues={facetValues}
      counts={view.counts}
      filters={view.filters}
      priceBounds={view.priceBounds}
      onToggle={view.toggleValue}
      onPriceChange={view.setPriceRange}
    />
  );

  const showSearch = mode === 'search';

  return (
    <div className={`sb-page sb-page--${mode} sb-cards--${config.cards.textAlign}`} style={style}>
      {(showSearch || masthead) && (
        <header className={stickyMasthead ? 'sb-masthead sb-masthead--sticky' : 'sb-masthead'}>
          {masthead}
          {showSearch && (
            <SearchBar
              query={view.query}
              onQueryChange={view.setQuery}
              onSubmit={view.submitQuery}
            />
          )}
        </header>
      )}

      <div className="sb-layout">
        <aside className="sb-sidebar" aria-label="Filters">
          <h2 className="sb-sidebar__title">Filters</h2>
          {panel}
        </aside>

        <div className="sb-results">
          <div className="sb-toolbar">
            <p className="sb-toolbar__count" aria-live="polite" aria-atomic="true">
              <strong>{view.total}</strong> of {products.length} products
            </p>
            <button
              type="button"
              className="sb-button sb-button--ghost sb-filters-button"
              onClick={() => setDrawerOpen(true)}
              aria-haspopup="dialog"
            >
              Filters{activeCount > 0 && <span className="sb-filters-button__count">{activeCount}</span>}
            </button>
            <SortSelect value={view.sort} options={sorts} onChange={view.setSort} />
          </div>

          <ActiveChips
            query={view.query}
            facets={facets}
            filters={view.filters}
            onToggle={view.toggleValue}
            onClearPrice={() => view.setPriceRange(null, null)}
            onClearQuery={() => view.setQuery('')}
            onClearAll={view.clearAll}
          />

          {view.results.length > 0 ? (
            <>
              <ProductGrid resetKey={view.searchKey} products={view.results} />
              {showSearch && view.query && <Recommendations results={view.results} />}
            </>
          ) : (
            <EmptyState query={view.query} onClearAll={view.clearAll} />
          )}
        </div>
      </div>

      <MobileFilterDrawer open={drawerOpen} onClose={closeDrawer} resultCount={view.total}>
        {panel}
      </MobileFilterDrawer>
    </div>
  );
}
