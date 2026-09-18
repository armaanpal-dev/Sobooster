import { Recommendations } from './Recommendations';

interface Props {
  query: string;
  onClearAll: () => void;
}

export function EmptyState({ query, onClearAll }: Props) {
  return (
    <>
      <div className="sb-empty">
        <h2>No products found</h2>
        <p>
          {query ? (
            <>
              Nothing matches <strong>“{query}”</strong> with the current filters.
            </>
          ) : (
            'Nothing matches the current filters.'
          )}{' '}
          Try removing a filter or searching for something broader.
        </p>
        <button type="button" className="sb-button" onClick={onClearAll}>
          Clear all
        </button>
      </div>
      <Recommendations results={[]} heading="Popular right now" />
    </>
  );
}
