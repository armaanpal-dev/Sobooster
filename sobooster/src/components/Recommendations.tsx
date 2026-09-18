import { useEffect, useMemo, useState } from 'react';
import { useCatalog } from '../catalog';
import { useStoreServices } from '../services';
import type { Product } from '../types';
import { ProductCard } from './ProductCard';

interface Props {
  /** Current results: the top one anchors the recommendations, and the first page is not repeated. */
  results: readonly Product[];
  heading?: string;
}

/**
 * "You may also like": Shopify's related-product recommendations for the top
 * result, topped up with popular (best-selling, in-stock) products. With no
 * results, or no recommendations service, it shows popular products.
 */
export function Recommendations({ results, heading }: Props) {
  const { products, config } = useCatalog();
  const { recommendFor } = useStoreServices();
  const { recommendations: enabled, recommendationCount: count } = config.search;
  const anchor = results[0];
  const [related, setRelated] = useState<number[]>([]);

  useEffect(() => {
    setRelated([]);
    if (!enabled || !anchor || !recommendFor) return;
    let cancelled = false;
    recommendFor(anchor, count * 2)
      .then((ids) => !cancelled && setRelated(ids))
      .catch(() => !cancelled && setRelated([]));
    return () => {
      cancelled = true;
    };
  }, [enabled, anchor, recommendFor, count]);

  const shown = useMemo(() => {
    const seen = new Set(results.slice(0, config.layout.productsPerPage).map((p) => p.id));
    const byId = new Map(products.map((p) => [p.id, p]));
    const picks: Product[] = [];
    const take = (p: Product | undefined) => {
      if (p && !seen.has(p.id) && picks.length < count) {
        seen.add(p.id);
        picks.push(p);
      }
    };
    related.forEach((id) => take(byId.get(id)));
    products.filter((p) => p.availability).forEach(take);
    return picks;
  }, [related, results, products, count, config.layout.productsPerPage]);

  if (!enabled || shown.length === 0) return null;
  const title = heading ?? (related.length > 0 ? 'You may also like' : 'Popular products');

  return (
    <section className="sb-recs" aria-label={title}>
      <h2 className="sb-recs__title">{title}</h2>
      <ul className="sb-grid">
        {shown.map((product) => (
          <li key={product.id}>
            <ProductCard product={product} />
          </li>
        ))}
      </ul>
    </section>
  );
}
