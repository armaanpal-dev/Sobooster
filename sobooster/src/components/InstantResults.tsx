import { useEffect, useMemo, useState } from 'react';
import { useCatalog } from '../catalog';
import { formatPrice } from '../lib/format';
import { buildVocabulary, matchCollections, matchTerms, previewProducts, type Preview } from '../lib/suggest';
import { useStoreServices, type PageLink } from '../services';

interface Props {
  /** What the shopper has typed (not yet committed). */
  text: string;
  /** Run a full search (a suggestion, a recent search, or "View all"). */
  onSearch: (query: string) => void;
  /** Recent searches, shown while the box is empty. */
  recent?: readonly string[];
  onClearRecent?: () => void;
}

const MAX_SUGGESTIONS = 6;
const PAGES_DEBOUNCE_MS = 200;

/** Suggestion text with the typed part emphasised, as in the theme's predictive search. */
function Highlight({ text, match }: { text: string; match: string }) {
  const needle = match.trim().toLowerCase();
  const at = needle ? text.toLowerCase().indexOf(needle) : -1;
  if (at === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark>{text.slice(at, at + needle.length)}</mark>
      {text.slice(at + needle.length)}
    </>
  );
}

/**
 * Instant results: an inline "Suggestions:" row, a product grid, matching
 * store pages, and "View all search results". Hovering (or focusing) a
 * suggestion swaps the products to that suggestion's results.
 */
export function InstantResults({ text, onSearch, recent = [], onClearRecent }: Props) {
  const { products, matcher, config } = useCatalog();
  const { searchPages } = useStoreServices();
  const limit = Math.max(1, config.search.suggestionProducts);
  const query = text.trim();

  const vocabulary = useMemo(() => buildVocabulary(products), [products]);
  const suggestions = useMemo(() => {
    if (!query) return [];
    const terms = matchTerms(query, vocabulary, MAX_SUGGESTIONS);
    const collections = matchCollections(query, vocabulary, MAX_SUGGESTIONS).map((c) => c.name);
    return [...new Set([...terms, ...collections])].slice(0, MAX_SUGGESTIONS);
  }, [query, vocabulary]);

  // The suggestion being hovered decides which products show; otherwise the typed text does.
  const [hovered, setHovered] = useState<string | null>(null);
  useEffect(() => setHovered(null), [query]);
  const active = hovered ?? query;

  const shown = useMemo(() => {
    if (!active) return { products: products.slice(0, limit), total: 0 };
    const preview: Preview = vocabulary.collections.some((c) => c.name === active)
      ? { kind: 'collection', name: active }
      : { kind: 'search', query: active };
    return previewProducts(preview, products, matcher, limit);
  }, [active, products, matcher, limit, vocabulary]);

  // Store pages (and blog posts) from Shopify's predictive search, when on a storefront.
  const [pages, setPages] = useState<PageLink[]>([]);
  useEffect(() => {
    setPages([]);
    if (!searchPages || !query || !config.search.showPages) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      searchPages(query, controller.signal)
        .then(setPages)
        .catch(() => undefined);
    }, PAGES_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, searchPages, config.search.showPages]);

  const row = query ? suggestions : [...recent];

  return (
    <div className="sb-instant">
      {row.length > 0 && (
        <div className="sb-instant__suggestions">
          <span className="sb-instant__label">{query ? 'Suggestions:' : 'Recent searches:'}</span>
          <ul>
            {row.map((term) => (
              <li key={term}>
                <button
                  type="button"
                  className={hovered === term ? 'sb-instant__suggestion is-active' : 'sb-instant__suggestion'}
                  onMouseEnter={() => setHovered(term)}
                  onFocus={() => setHovered(term)}
                  onClick={() => onSearch(term)}
                >
                  <Highlight text={term} match={query} />
                </button>
              </li>
            ))}
          </ul>
          {!query && onClearRecent && (
            <button type="button" className="sb-instant__clear" onClick={onClearRecent}>
              Clear
            </button>
          )}
        </div>
      )}

      {!query && <p className="sb-instant__heading">Popular products</p>}
      {shown.products.length > 0 ? (
        <ul className="sb-instant__products" aria-live="polite" aria-label={active ? `Products for ${active}` : 'Popular products'}>
          {shown.products.map((product) => {
            const onSale = product.compare_at_price !== undefined && product.compare_at_price > product.price;
            return (
              <li key={product.id}>
                <a
                  className="sb-instant__product"
                  href={product.url ?? '#'}
                  onClick={(event) => {
                    if (!product.url) {
                      event.preventDefault();
                      onSearch(product.title);
                    }
                  }}
                >
                  <span className="sb-instant__image">{product.image && <img src={product.image} alt="" loading="lazy" />}</span>
                  <span className="sb-instant__title">{product.title}</span>
                  <span className="sb-instant__price">
                    {formatPrice(product.price)}
                    {onSale && product.compare_at_price !== undefined && <s>{formatPrice(product.compare_at_price)}</s>}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="sb-instant__empty">No products found for “{active}”.</p>
      )}

      {pages.length > 0 && (
        <section className="sb-instant__pages" aria-label="Pages">
          <h3>Pages</h3>
          <ul>
            {pages.map((page) => (
              <li key={page.url}>
                <a href={page.url}>{page.title}</a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {query && (
        <div className="sb-instant__footer">
          <button type="button" className="sb-instant__all" onClick={() => onSearch(query)}>
            View all search results
          </button>
        </div>
      )}
    </div>
  );
}
