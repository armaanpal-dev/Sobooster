import { useId } from 'react';
import type { FacetDef } from '../types';

interface Props {
  facet: FacetDef;
  values: readonly string[];
  counts: Map<string, number> | undefined;
  selected: readonly string[];
  onToggle: (facetKey: string, value: string) => void;
}

/** Store colour names that aren't CSS colour keywords. */
const SWATCHES: Record<string, string> = {
  black: '#111',
  navy: '#1f2a44',
  blush: '#f4c2c2',
  emerald: '#1f7a4d',
  champagne: '#f7e7ce',
  burgundy: '#800020',
  nude: '#e3bc9a',
  cream: '#fffdd0',
  charcoal: '#36454f',
  khaki: '#c3b091',
  multi: 'conic-gradient(#e53935, #fdd835, #43a047, #1e88e5, #8e24aa, #e53935)',
};

function swatchFor(value: string): string {
  const name = value.trim().toLowerCase();
  if (SWATCHES[name]) return SWATCHES[name];
  const compact = name.replace(/\s+/g, '');
  if (typeof CSS !== 'undefined' && CSS.supports('color', compact)) return compact;
  return '#ddd';
}

export function FacetGroup({ facet, values, counts, selected, onToggle }: Props) {
  const id = useId();
  return (
    <fieldset className="sb-facet">
      <legend className="sb-facet__title">
        {facet.label}
        {selected.length > 0 && <span className="sb-facet__badge">{selected.length}</span>}
      </legend>
      <ul className="sb-facet__list">
        {values.map((value, i) => {
          const count = counts?.get(value) ?? 0;
          const checked = selected.includes(value);
          // Zero-count values stay in place (greyed) so the list never reflows;
          // a selected value is never disabled, so it can always be unticked.
          const disabled = count === 0 && !checked;
          const inputId = `${id}-${i}`;
          return (
            <li key={value} className={disabled ? 'sb-facet__option sb-is-disabled' : 'sb-facet__option'}>
              <input
                id={inputId}
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={() => onToggle(facet.key, value)}
              />
              <label htmlFor={inputId}>
                {facet.display === 'swatch' && (
                  <span className="sb-swatch" style={{ background: swatchFor(value) }} aria-hidden="true" />
                )}
                <span className="sb-facet__value">{value}</span>
                <span className="sb-facet__count" aria-label={`${count} products`}>
                  {count}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
