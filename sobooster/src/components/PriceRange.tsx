import { useEffect, useId, useState, type FormEvent } from 'react';
import type { PriceBounds } from '../types';

interface Props {
  label: string;
  min: number | null;
  max: number | null;
  /** Span of prices available under the other filters, used as placeholders. */
  bounds: PriceBounds | null;
  onChange: (min: number | null, max: number | null) => void;
}

const toDraft = (value: number | null) => (value === null ? '' : String(value));

function parseDraft(draft: string): number | null {
  if (draft.trim() === '') return null;
  const value = Number(draft);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

/** Applied on submit or blur rather than per keystroke, so typing "150" is one history entry. */
export function PriceRange({ label, min, max, bounds, onChange }: Props) {
  const id = useId();
  const [minDraft, setMinDraft] = useState(toDraft(min));
  const [maxDraft, setMaxDraft] = useState(toDraft(max));

  useEffect(() => setMinDraft(toDraft(min)), [min]);
  useEffect(() => setMaxDraft(toDraft(max)), [max]);

  const apply = () => {
    let nextMin = parseDraft(minDraft);
    let nextMax = parseDraft(maxDraft);
    if (nextMin !== null && nextMax !== null && nextMin > nextMax) [nextMin, nextMax] = [nextMax, nextMin];
    setMinDraft(toDraft(nextMin));
    setMaxDraft(toDraft(nextMax));
    if (nextMin !== min || nextMax !== max) onChange(nextMin, nextMax);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    apply();
  };

  return (
    <fieldset className="sb-facet">
      <legend className="sb-facet__title">{label}</legend>
      <form className="sb-price-range" onSubmit={submit} onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) apply();
      }}>
        <label htmlFor={`${id}-min`} className="sb-visually-hidden">
          Minimum price
        </label>
        <input
          id={`${id}-min`}
          type="number"
          inputMode="decimal"
          min={0}
          value={minDraft}
          placeholder={bounds ? String(Math.floor(bounds.min)) : 'Min'}
          onChange={(event) => setMinDraft(event.target.value)}
        />
        <span aria-hidden="true">–</span>
        <label htmlFor={`${id}-max`} className="sb-visually-hidden">
          Maximum price
        </label>
        <input
          id={`${id}-max`}
          type="number"
          inputMode="decimal"
          min={0}
          value={maxDraft}
          placeholder={bounds ? String(Math.ceil(bounds.max)) : 'Max'}
          onChange={(event) => setMaxDraft(event.target.value)}
        />
        <button type="submit" className="sb-button sb-button--small">
          Apply
        </button>
      </form>
    </fieldset>
  );
}
