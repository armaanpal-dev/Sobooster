import { useId } from 'react';
import { SORT_LABELS } from '../lib/sort';
import type { SortKey } from '../types';

interface Props {
  value: SortKey;
  options: readonly SortKey[];
  onChange: (sort: SortKey) => void;
}

export function SortSelect({ value, options, onChange }: Props) {
  const id = useId();
  return (
    <div className="sb-sort">
      <label htmlFor={id}>Sort by</label>
      <select id={id} value={value} onChange={(event) => onChange(options.find((key) => key === event.target.value) ?? value)}>
        {options.map((key) => (
          <option key={key} value={key}>
            {SORT_LABELS[key]}
          </option>
        ))}
      </select>
    </div>
  );
}
