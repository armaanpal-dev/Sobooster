import { useCatalog } from '../catalog';
import { formatPrice } from '../lib/format';
import type { Product } from '../types';
import { AddToCart } from './AddToCart';

export function ProductCard({ product }: { product: Product }) {
  const { cards } = useCatalog().config;
  const onSale = product.compare_at_price !== undefined && product.compare_at_price > product.price;
  const content = (
    <>
      <div className="sb-card__media">
        {product.image && (
          <img src={product.image} alt={product.title} width={400} height={500} loading="lazy" decoding="async" />
        )}
        {!product.availability && cards.showSoldOutBadge && <span className="sb-badge sb-badge--muted">Sold out</span>}
        {product.availability && onSale && cards.showSaleBadge && <span className="sb-badge">Sale</span>}
      </div>
      <div className="sb-card__body">
        {cards.showVendor && product.vendor && <p className="sb-card__vendor">{product.vendor}</p>}
        <h3 className="sb-card__title">{product.title}</h3>
        <p className="sb-card__price">
          <span className={onSale ? 'sb-price sb-price--sale' : 'sb-price'}>{formatPrice(product.price)}</span>
          {onSale && product.compare_at_price !== undefined && (
            <s className="sb-price sb-price--was">
              <span className="sb-visually-hidden">Was </span>
              {formatPrice(product.compare_at_price)}
            </s>
          )}
        </p>
        {cards.showSizes && product.size.length > 0 && <p className="sb-card__sizes">{product.size.join(' · ')}</p>}
      </div>
    </>
  );
  return (
    <article className="sb-card">
      {product.url ? (
        <a className="sb-card__link" href={product.url}>
          {content}
        </a>
      ) : (
        content
      )}
      <AddToCart product={product} />
    </article>
  );
}
