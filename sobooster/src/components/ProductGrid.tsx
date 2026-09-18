import { useState } from 'react';
import { useCatalog } from '../catalog';
import type { Product } from '../types';
import { ProductCard } from './ProductCard';

interface Props {
  products: readonly Product[];
  /** When this changes (new search, filter or sort), paging starts again from the first page. */
  resetKey: string;
}

/**
 * Renders a page at a time. Paging resets by comparing `resetKey` during
 * render rather than remounting the grid: remounting rebuilt every card and
 * image on each filter click, which cost far more than the filtering itself.
 */
export function ProductGrid({ products, resetKey }: Props) {
  const pageSize = useCatalog().config.layout.productsPerPage;
  const [paging, setPaging] = useState({ key: resetKey, visible: pageSize });
  const visible = paging.key === resetKey ? paging.visible : pageSize;
  const shown = products.slice(0, visible);
  const remaining = products.length - shown.length;

  return (
    <>
      <ul className="sb-grid">
        {shown.map((product) => (
          <li key={product.id}>
            <ProductCard product={product} />
          </li>
        ))}
      </ul>
      {remaining > 0 && (
        <div className="sb-more">
          <p>
            Showing {shown.length} of {products.length}
          </p>
          <button type="button" className="sb-button" onClick={() => setPaging({ key: resetKey, visible: visible + pageSize })}>
            Show {Math.min(pageSize, remaining)} more
          </button>
        </div>
      )}
    </>
  );
}
