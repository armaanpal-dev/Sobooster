import { useState } from 'react';
import { facetKeyFor, type FacetConfig } from '../config/appConfig';
import type { PageProps } from './AdminApp';
import { scanCatalog } from './adminApi';
import { Button, Card, Select, TextField, toast } from './ui';

const BUILT_IN = new Set(['collection', 'vendor', 'product_type', 'price', 'availability']);

function describe(filter: FacetConfig): string {
  switch (filter.source) {
    case 'option':
      return `Product option “${filter.option}”`;
    case 'tag':
      return `Tags starting “${filter.tagPrefix}”`;
    case 'product_type':
      return 'Product type';
    case 'price':
      return 'Price range';
    default:
      return filter.source.charAt(0).toUpperCase() + filter.source.slice(1);
  }
}

export function FiltersPage({ config, update, scan, setScan }: PageProps) {
  const [kind, setKind] = useState<'option' | 'tag'>('option');
  const [name, setName] = useState('');
  const [label, setLabel] = useState('');
  const filters = config.filters;

  const setFilters = (next: FacetConfig[]) => update((c) => ({ ...c, filters: next }));
  const patch = (index: number, change: Partial<FacetConfig>) =>
    setFilters(filters.map((f, i) => (i === index ? { ...f, ...change } : f)));
  const move = (index: number, by: -1 | 1) => {
    const next = [...filters];
    const [item] = next.splice(index, 1);
    if (item) next.splice(index + by, 0, item);
    setFilters(next);
  };

  const add = () => {
    const source = name.trim();
    if (!source) return;
    const taken = new Set(filters.map((f) => f.key));
    const key = facetKeyFor(kind === 'tag' ? source.replace(/:$/, '') : source, taken);
    const niceLabel = label.trim() || source.replace(/:$/, '').replace(/^./, (c) => c.toUpperCase());
    const filter: FacetConfig =
      kind === 'option'
        ? { key, label: niceLabel, source: 'option', option: source, display: /colou?r/i.test(source) ? 'swatch' : 'checkbox', enabled: true }
        : { key, label: niceLabel, source: 'tag', tagPrefix: source.endsWith(':') ? source : `${source}:`, display: 'checkbox', enabled: true };
    // New filters go before Price, where shoppers expect attribute filters.
    const priceAt = filters.findIndex((f) => f.source === 'price');
    const next = [...filters];
    next.splice(priceAt === -1 ? next.length : priceAt, 0, filter);
    setFilters(next);
    setName('');
    setLabel('');
  };

  const loadSuggestions = async () => {
    try {
      setScan(await scanCatalog());
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Scan failed', true);
    }
  };

  const usedOptions = new Set(filters.filter((f) => f.source === 'option').map((f) => f.option?.toLowerCase()));
  const usedPrefixes = new Set(filters.filter((f) => f.source === 'tag').map((f) => f.tagPrefix?.toLowerCase()));
  const suggestions =
    kind === 'option'
      ? (scan?.options ?? []).filter((o) => !usedOptions.has(o.name.toLowerCase())).map((o) => ({ value: o.name, count: o.products }))
      : (scan?.tagPrefixes ?? []).filter((t) => !usedPrefixes.has(t.prefix)).map((t) => ({ value: t.prefix, count: t.products }));

  return (
    <>
      <h1>Filters</h1>
      <p className="sb-admin__lead">
        The filters shoppers see on the left of your search and collection pages, top to bottom. Counts update as they
        filter; a filter with no values on a page is hidden automatically.
      </p>

      <Card title="Active filters">
        <ol className="sb-admin__filters">
          {filters.map((filter, i) => (
            <li key={filter.key} className={filter.enabled ? '' : 'is-off'}>
              <input
                type="checkbox"
                aria-label={`Show ${filter.label}`}
                checked={filter.enabled}
                onChange={(e) => patch(i, { enabled: e.target.checked })}
              />
              <div className="sb-admin__filter-main">
                <input
                  className="sb-admin__inline-input"
                  aria-label={`Label for ${describe(filter)}`}
                  value={filter.label}
                  onChange={(e) => patch(i, { label: e.target.value })}
                />
                <span className="sb-admin__help">
                  {describe(filter)} · URL <code>?{filter.source === 'price' ? 'min_price=…&max_price=…' : `${filter.key}=…`}</code>
                </span>
              </div>
              {(filter.source === 'option' || filter.source === 'tag') && (
                <select
                  aria-label={`Display for ${filter.label}`}
                  value={filter.display}
                  onChange={(e) => patch(i, { display: e.target.value === 'swatch' ? 'swatch' : 'checkbox' })}
                >
                  <option value="checkbox">List</option>
                  <option value="swatch">Colour swatches</option>
                </select>
              )}
              <div className="sb-admin__row">
                <Button variant="plain" label={`Move ${filter.label} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                  ↑
                </Button>
                <Button variant="plain" label={`Move ${filter.label} down`} disabled={i === filters.length - 1} onClick={() => move(i, 1)}>
                  ↓
                </Button>
                {!BUILT_IN.has(filter.key) && (
                  <Button variant="critical" label={`Remove ${filter.label}`} onClick={() => setFilters(filters.filter((_, j) => j !== i))}>
                    Remove
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <Card
        title="Add a filter"
        description="From any product option (Material, Fit, Length…) or from tags written as name:value, e.g. fabric:Silk."
      >
        <div className="sb-admin__grid">
          <Select
            label="Source"
            value={kind}
            options={[
              { value: 'option', label: 'Product option' },
              { value: 'tag', label: 'Tag prefix' },
            ]}
            onChange={setKind}
          />
          <TextField
            label={kind === 'option' ? 'Option name' : 'Tag prefix'}
            value={name}
            placeholder={kind === 'option' ? 'Material' : 'fabric:'}
            onChange={setName}
          />
          <TextField label="Label shoppers see" value={label} placeholder="Optional" onChange={setLabel} />
        </div>
        {suggestions.length > 0 ? (
          <div className="sb-admin__suggestions">
            <span className="sb-admin__help">Found in your catalogue:</span>
            {suggestions.slice(0, 12).map((s) => (
              <button key={s.value} type="button" className="sb-admin__pill" onClick={() => setName(s.value)}>
                {s.value} <span>{s.count}</span>
              </button>
            ))}
          </div>
        ) : (
          !scan && (
            <p className="sb-admin__help">
              <button type="button" className="sb-admin__link" onClick={() => void loadSuggestions()}>
                Scan your catalogue
              </button>{' '}
              to see which options and tag prefixes you have.
            </p>
          )
        )}
        <div className="sb-admin__row">
          <Button variant="primary" onClick={add} disabled={!name.trim()}>
            Add filter
          </Button>
        </div>
      </Card>
    </>
  );
}
