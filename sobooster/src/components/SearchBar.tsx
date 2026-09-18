import { useEffect, useId, useRef, useState, type FocusEvent, type FormEvent } from 'react';
import { useCatalog } from '../catalog';
import { useDebounced } from '../hooks/useDebounced';
import { clearRecentSearches, readRecentSearches, saveRecentSearch } from '../lib/suggest';
import { InstantResults } from './InstantResults';

interface Props {
  /** The committed query, from the URL. */
  query: string;
  /** Called (debounced) while typing; replaces the history entry. */
  onQueryChange: (query: string) => void;
  /** Called on Enter or when a suggestion is picked; a new history entry. */
  onSubmit: (query: string) => void;
}

const DEBOUNCE_MS = 250;

export function SearchBar({ query, onQueryChange, onSubmit }: Props) {
  const { config } = useCatalog();
  const settings = config.search;
  const inputId = useId();
  const panelId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(query);
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>(() => (settings.recentSearches ? readRecentSearches() : []));
  const debounced = useDebounced(value, DEBOUNCE_MS);

  // Keep the latest callback without re-running the debounce effect when the
  // URL changes; otherwise Back would immediately re-apply the stale input.
  const onChangeRef = useRef(onQueryChange);
  useEffect(() => {
    onChangeRef.current = onQueryChange;
  });
  useEffect(() => {
    onChangeRef.current(debounced);
  }, [debounced]);

  // URL changed from outside (Back/Forward, Clear all): reflect it in the box.
  // Compare trimmed so a trailing space the user is still typing survives.
  useEffect(() => {
    setValue((current) => (current.trim() === query ? current : query));
  }, [query]);

  const expanded = open && settings.suggestions;

  const commit = (next: string) => {
    setValue(next);
    setOpen(false);
    onSubmit(next);
    if (settings.recentSearches && next.trim()) setRecent(saveRecentSearch(next));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    commit(value);
  };

  // Close only when focus leaves the whole search (input and results).
  const onBlur = (event: FocusEvent<HTMLFormElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  };

  return (
    <form
      className="sb-search"
      role="search"
      onSubmit={submit}
      onBlur={onBlur}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          setOpen(false);
          inputRef.current?.focus();
        }
      }}
    >
      <label htmlFor={inputId} className="sb-visually-hidden">
        Search products
      </label>
      <div className="sb-search__field">
        <svg className="sb-search__icon" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M8.5 3a5.5 5.5 0 0 1 4.38 8.83l3.65 3.64-1.06 1.06-3.64-3.65A5.5 5.5 0 1 1 8.5 3Zm0 1.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
        </svg>
        <input
          ref={inputRef}
          id={inputId}
          type="search"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search products, brands, styles…"
          autoComplete="off"
          spellCheck={false}
          aria-expanded={expanded}
          aria-controls={panelId}
        />
        {value && (
          <button
            type="button"
            className="sb-search__clear"
            aria-label="Clear search"
            onClick={() => {
              setValue('');
              onQueryChange('');
              inputRef.current?.focus();
            }}
          >
            ×
          </button>
        )}
      </div>
      <div id={panelId} className="sb-suggest" hidden={!expanded}>
        {expanded && (
          <InstantResults
            text={value}
            onSearch={commit}
            recent={recent}
            onClearRecent={() => {
              clearRecentSearches();
              setRecent([]);
            }}
          />
        )}
      </div>
    </form>
  );
}
