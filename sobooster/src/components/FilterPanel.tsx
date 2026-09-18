import type { FacetCounts, FacetDef, FacetValues, Filters, PriceBounds } from '../types';
import { FacetGroup } from './FacetGroup';
import { PriceRange } from './PriceRange';

interface Props {
  facets: readonly FacetDef[];
  facetValues: FacetValues;
  counts: FacetCounts;
  filters: Filters;
  priceBounds: PriceBounds | null;
  onToggle: (facetKey: string, value: string) => void;
  onPriceChange: (min: number | null, max: number | null) => void;
}

/** Facets in the merchant's configured order. */
export function FilterPanel({ facets, facetValues, counts, filters, priceBounds, onToggle, onPriceChange }: Props) {
  return (
    <div className="sb-filters">
      {facets.map((facet) => {
        if (facet.source === 'price') {
          return (
            <PriceRange
              key={facet.key}
              label={facet.label}
              min={filters.minPrice}
              max={filters.maxPrice}
              bounds={priceBounds}
              onChange={onPriceChange}
            />
          );
        }
        const values = facetValues[facet.key] ?? [];
        // A store without, say, a Material option has no values for it; skip the empty group.
        if (values.length === 0) return null;
        return (
          <FacetGroup
            key={facet.key}
            facet={facet}
            values={values}
            counts={counts[facet.key]}
            selected={filters.values[facet.key] ?? []}
            onToggle={onToggle}
          />
        );
      })}
    </div>
  );
}
