import { useEffect, useId, useState } from 'react';
import { useCatalog } from '../catalog';
import { useStoreServices, type VariantChoice } from '../services';
import type { Product } from '../types';

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'picking'; variants: VariantChoice[]; selected: number }
  | { kind: 'adding' }
  | { kind: 'added' }
  | { kind: 'error'; message: string };

/**
 * Single-variant products go straight into the cart. Others open a compact
 * variant picker (loaded on demand, so the catalogue query stays light).
 */
export function AddToCart({ product }: { product: Product }) {
  const { addToCart, loadVariants, cartUrl } = useStoreServices();
  const { cards } = useCatalog().config;
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const selectId = useId();

  useEffect(() => {
    if (status.kind !== 'added') return;
    const timer = window.setTimeout(() => setStatus({ kind: 'idle' }), 3000);
    return () => window.clearTimeout(timer);
  }, [status.kind]);

  if (!addToCart || !cards.showAddToCart) return null;

  const buttonClass = `sb-atc sb-atc--${cards.buttonStyle}`;

  if (!product.availability) {
    // Same wrapper and status line as the active button, so buttons line up across a row.
    return (
      <div className="sb-atc-wrap">
        <button type="button" className={buttonClass} disabled>
          Sold out
        </button>
        <p className="sb-atc-status" />
      </div>
    );
  }

  const add = async (variantId: number) => {
    setStatus({ kind: 'adding' });
    try {
      await addToCart(variantId);
      setStatus({ kind: 'added' });
    } catch (error) {
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : 'Could not add to cart' });
    }
  };

  const start = async () => {
    if (product.singleVariant && product.variantId) return add(product.variantId);
    if (!loadVariants) return;
    setStatus({ kind: 'loading' });
    try {
      const variants = (await loadVariants(product)).filter((v) => v.available);
      const [first] = variants;
      if (!first) return setStatus({ kind: 'error', message: 'Sold out' });
      if (variants.length === 1) return add(first.id);
      setStatus({ kind: 'picking', variants, selected: first.id });
    } catch {
      setStatus({ kind: 'error', message: 'Could not load options' });
    }
  };

  if (status.kind === 'picking') {
    return (
      <div className="sb-atc-picker">
        <label htmlFor={selectId} className="sb-visually-hidden">
          Choose an option for {product.title}
        </label>
        <select
          id={selectId}
          value={status.selected}
          onChange={(event) => setStatus({ ...status, selected: Number(event.target.value) })}
        >
          {status.variants.map((v) => (
            <option key={v.id} value={v.id}>
              {v.title}
            </option>
          ))}
        </select>
        <button type="button" className={buttonClass} onClick={() => add(status.selected)}>
          Add
        </button>
        <button
          type="button"
          className="sb-icon-button sb-atc-picker__close"
          aria-label="Cancel"
          onClick={() => setStatus({ kind: 'idle' })}
        >
          ×
        </button>
      </div>
    );
  }

  const busy = status.kind === 'loading' || status.kind === 'adding';
  const label =
    status.kind === 'adding' ? 'Adding…' : status.kind === 'loading' ? 'Loading…' : status.kind === 'added' ? 'Added ✓' : cards.buttonLabel;

  return (
    <div className="sb-atc-wrap">
      <button type="button" className={buttonClass} onClick={start} disabled={busy} aria-busy={busy}>
        {label}
      </button>
      <p className="sb-atc-status" role="status">
        {status.kind === 'added' && cartUrl && (
          <a href={cartUrl} className="sb-link-button">
            View cart
          </a>
        )}
        {status.kind === 'error' && <span className="sb-atc-error">{status.message}</span>}
      </p>
    </div>
  );
}
