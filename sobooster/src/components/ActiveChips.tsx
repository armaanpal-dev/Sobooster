import { formatPrice } from '../lib/format';
import type { FacetDef, Filters } from '../types';

interface Props {
  query: string;
  facets: readonly FacetDef[];
  filters: Filters;
  onToggle: (facetKey: string, value: string) => void;
  onClearPrice: () => void;
  onClearQuery: () => void;
  onClearAll: () => void;
}

function priceLabel({ minPrice, maxPrice }: Filters): string {
  if (minPrice !== null && maxPrice !== null) return `${formatPrice(minPrice)} – ${formatPrice(maxPrice)}`;
  if (minPrice !== null) return `From ${formatPrice(minPrice)}`;
  return `Up to ${formatPrice(maxPrice ?? 0)}`;
}

export function ActiveChips({ query, facets, filters, onToggle, onClearPrice, onClearQuery, onClearAll }: Props) {
  const chips = facets.flatMap((facet) =>
    (filters.values[facet.key] ?? []).map((value) => ({
      key: `${facet.key}:${value}`,
      label: `${facet.label}: ${value}`,
      onRemove: () => onToggle(facet.key, value),
    })),
  );
  if (filters.minPrice !== null || filters.maxPrice !== null) {
    const label = facets.find((f) => f.source === 'price')?.label ?? 'Price';
    chips.push({ key: 'price', label: `${label}: ${priceLabel(filters)}`, onRemove: onClearPrice });
  }
  if (query) chips.unshift({ key: 'query', label: `Search: “${query}”`, onRemove: onClearQuery });

  if (chips.length === 0) return null;

  return (
    <div className="sb-chips" aria-label="Active filters">
      <ul>
        {chips.map((chip) => (
          <li key={chip.key}>
            <button type="button" className="sb-chip" onClick={chip.onRemove} aria-label={`Remove ${chip.label}`}>
              {chip.label}
              <span aria-hidden="true">×</span>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="sb-link-button" onClick={onClearAll}>
        Clear all
      </button>
    </div>
  );
}
