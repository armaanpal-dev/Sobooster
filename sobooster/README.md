# SoBooster

A Shopify app for product search and filtering, built in React + TypeScript.
It runs on the store's own products: debounced search, filters with live
counts, sorting, state kept in the URL, and a mobile filter drawer.

It has two parts:

- a theme app extension (app embed + app block) that puts the search on the
  store's search and collection pages
- admin pages inside Shopify for the index, filters, synonyms and card styling

There's no backend. Products are loaded from the store once per session and
filtered in the shopper's browser, which works well for small and mid-size
stores. The last section covers what I'd change for a 150,000-product store.

## Running it

Node 20+ and the Shopify CLI, with a dev store. Run everything from this
`sobooster/` folder, not the repository root, or the CLI won't find
`shopify.app.toml`.

```bash
cd sobooster
npm install
shopify app dev   # installs on the dev store and rebuilds the storefront script on save
npm test          # 34 unit tests
npm run build     # type-check + build admin and storefront script
npm run deploy    # build, then shopify app deploy
```

After installing, turn on the "Search & filters" app embed in the theme editor
(the app's Home page has a link that does it).

The admin pages are a static build in `dist/`, so they can go on any static
host. `vercel.json` and `public/_redirects` are included for Vercel or Netlify.

## Where each requirement is

1. Search (title, vendor, type, tags), debounced 250 ms, empty state:
   `SearchBar`, `lib/search.ts`, `EmptyState`
2. Filters, OR within a filter and AND across filters: `FilterPanel`,
   `FacetGroup`, `PriceRange`, `lib/filter.ts`
3. Live counts: `lib/facets.ts` (see below)
4. Sorting: `lib/sort.ts`, `SortSelect`
5. URL state, refresh/share/Back/Forward, Clear all: `lib/url.ts`,
   `useProductQuery`, `ActiveChips`
6. Responsive + mobile drawer: `MobileFilterDrawer`, container queries in
   `styles.css`
7. Production write-up: last section
8. Optional extras: "Show more" pagination, autocomplete (`InstantResults`,
   `lib/suggest.ts`), last 5 recent searches in `localStorage`

I also added active-filter chips and a "Newest" sort (only shown when products
have publish dates).

## How it works

The URL is the only place search, filter and sort state lives.
`useProductQuery` parses the query string and derives results, counts and
price bounds in one `useMemo`. Every action writes a new URL. Since there's
one copy of the state, refresh, sharing and Back/Forward just work.

Typing replaces the history entry; filter and sort changes push one. So Back
undoes filter clicks, not keystrokes.

Everything in `lib/` is plain functions with no React, so it's easy to test
and could move to a server as is.

Example URL on the store's search page:

```
/search?q=dress&color=black,red&size=m&min_price=100&max_price=200&sort=price_asc
```

Unknown values in the URL are ignored and a reversed price range is swapped, so
old or hand-edited links still work. Filter names that clash with Shopify's own
parameters (`type`, `page`) are renamed automatically.

### Facet counts

A filter's counts come from products matching the search and every *other*
filter, ignoring that filter's own selection.

If you applied a filter's own selection to its counts, picking Black would
show every other colour as 0 and you couldn't add Red. Ignoring it means each
number answers "how many results if I tick this too?". Other filters still
narrow it, so picking a vendor lowers the colour counts.

`computeFacets` does this in one pass. For each product that matches the
search, it checks which filters it fails:

- none: it's a result and counts everywhere
- exactly one: it counts only toward that filter
- two or more: it counts nowhere

Zero-count options stay visible but disabled so the list doesn't jump around.
Selected options are never disabled. `facets.test.ts` checks this against a
brute-force version.

## Shopify app

Storefront:

- **App embed** (theme settings → App embeds): replaces the theme's search
  pop-up with instant search and takes over `/search` and collection pages.
  On other pages only a ~1 KB loader runs; the full script loads when the
  shopper hovers or clicks search.
- **App block**: the same UI anywhere in a template, optionally limited to one
  collection.

Search results have filters on the left, sorting, chips, product cards with
Add to cart, suggestions and "You may also like". On mobile the filters go in
a drawer.

Admin pages:

- **Index**: which fields are searchable, hide out-of-stock or tagged
  products, scan the catalogue, rebuild the index
- **Filters**: show/hide, rename, reorder, add filters from product options or
  tag prefixes (`fabric:Silk`), list or colour swatches
- **Synonyms**: two-way (`sweater, jumper`) and one-way (`tee → t-shirt`), with
  a test box
- **Settings**: product card styling with a live preview, suggestions,
  recommendations, page size, default sort, Add to cart behaviour

How it fits together:

- Still no backend. The admin calls the Admin GraphQL API directly from the
  browser (Direct API access through App Bridge) and saves all settings as one
  JSON app-data metafield. The theme extension reads that metafield in Liquid
  and passes it to the script. The only scope is `read_products`.
- Products come from the store itself, through the tokenless Storefront API with
  `@inContext(country, language)` for local prices, falling back to
  `/products.json` on password-protected stores. They're cached in
  `sessionStorage` for 10 minutes; "Rebuild index" busts the cache.
- Add to cart uses `/cart/add.js`. Products with several variants open a small
  picker. The theme's cart count updates through the Section Rendering API.
- Recommendations come from Shopify's Product Recommendations API, topped up
  with popular in-stock products.
- The CSS is prefixed `sb-` and scoped under `.sb-root`, resets use `:where()`,
  and breakpoints are container queries, so it doesn't fight the theme.
- The storefront bundle uses Preact instead of React: 22 KB gzipped.

Code layout:

```
extensions/sobooster-search/   theme app extension (blocks, snippet, built assets)
src/config/appConfig.ts        settings types, defaults, validation
src/admin/                     admin pages
src/storefront/                storefront entry, product loading, cart, Shopify mapping
src/lib/                       search, filter, facets, sort, URL
```

Testing: besides the unit tests, I ran the storefront, admin and instant
search in Chrome against a mock shop (with deliberately messy theme CSS) and a
mocked Admin API. `shopify theme check` and `shopify app build` pass.

## Assumptions

- Prices are shown in the shopper's currency where the Storefront API is
  available, and in the store's base currency on the `/products.json`
  fallback.
- Search splits on spaces and every word has to match somewhere, so "black
  gown" finds "Black Satin Gown".
- Clear all resets search and sort too.

## Trade-offs

- **Filtering in the browser.** For a few thousand products it's one fast pass
  (a few ms per click). A server would add latency, hosting and failure points
  and gain nothing at that size.
- **Substring matching, not fuzzy.** Predictable and no false positives. Typo
  tolerance belongs in a real search engine.
- **Native `<dialog>` for the drawer.** It gives focus trapping and Escape for
  free.
- **Price applies on Enter, blur or Apply**, not on every keystroke.
- **"Show more" instead of numbered pages.** Keeps the URL clean, but a refresh
  goes back to the first 48 results.

## Known limitations

- No component tests. I checked the flows with a Playwright script during
  development but it isn't in the repo.
- The whole catalogue loads into the browser, capped at 5,000 products.
- Compare-at price uses the highest variant's value.
- No typo tolerance in suggestions or synonyms.

## Production at 150,000 products

Loading everything into the browser works up to maybe 5–10k products. At
150k it's tens of MB of JSON and every filter click costs too much on a cheap
phone. So search moves to a server and the storefront asks for one page of
results plus counts.

### Database and search engine

I'd start with Postgres. One `products` table for all shops, keyed by
`shop_id`, with each product stored as a flat row: searchable text, plus all
variant colours and sizes, min/max price and "any variant in stock" rolled up
onto the product so filters don't need joins.

- full-text search with a weighted `tsvector` (title highest) and a GIN index
- `pg_trgm` for typo tolerance
- GIN indexes on the colour/size arrays, B-tree on price and date
- other tables: `shops`, `collections`, `product_collections`, `synonyms`,
  `filter_config`, `sync_runs`
- hash-partition by `shop_id` once there are many large shops

Well indexed, that's tens of milliseconds for one shop's 150k products, and
there's one source of truth.

I'd add Elasticsearch/OpenSearch, Typesense or Algolia only when Postgres
can't keep up: better relevance tuning, per-language analysers, lots of
high-cardinality filters, or millions of documents across shops. Postgres
stays the source of truth and the engine is a copy that can be rebuilt. The
catch is keeping two stores in sync, so I'd write changes to an outbox table
in the same transaction and have a worker push them to the engine.

### Indexing

The sync worker builds each product's search document, not the storefront.
Synonyms and which metafields count as filters are applied at index time, so
changing them triggers a reindex. Build the new index in the background and
swap an alias so there's no downtime.

### Shopify APIs and GraphQL

- **Admin GraphQL API** for syncing, with a pinned API version upgraded on a
  schedule. Only request the fields you index, since nested connections drive
  up query cost.
- **Bulk operations for the first sync.** Paging 150k products at 100 a page is
  1,500+ calls. `bulkOperationRunQuery` runs on Shopify's side and returns a
  JSONL file. Child rows (variants, collections) point to their parent with
  `__parentId`, so I'd stream the file, group children under their parent and
  upsert in batches. Only one bulk job per shop can run at a time.
- **Storefront API** for things that must be exact for the shopper: market
  prices and cart.
- **App Proxy** for storefront search requests (`shop.com/apps/search`): same
  origin, no CORS, and Shopify signs each request.
- Mandatory GDPR webhooks and `app/uninstalled` for cleanup.

### Webhooks and incremental sync

Subscribe to `products/create`, `products/update`, `products/delete`,
collection updates and inventory level updates. The handler checks the HMAC,
puts the payload on a queue and returns 200 straight away; a worker does the
rest. Webhooks can arrive twice or out of order, so upserts only apply if
`updated_at` is newer than what's stored.

Webhooks aren't guaranteed, so a nightly job pulls IDs and `updatedAt` for all
products and fixes anything that drifted.

### Rate limits

The Admin GraphQL API limits by query cost per shop. I'd read
`throttleStatus` from each response and slow down before hitting the limit,
back off with jitter on `THROTTLED`, and run a queue per shop so one big
merchant can't block the rest. Bulk operations barely use the budget, which is
another reason to use them for full syncs.

### Background jobs

A queue (BullMQ or similar) keyed per shop for: the first bulk sync, webhook
processing, the nightly reconcile, reindexing after settings changes, and
deleting data on uninstall.

### Pagination

Cursor (keyset) pagination, not `OFFSET`. `OFFSET 10000` still reads 10,000
rows and results shift if data changes. The cursor holds the last row's sort
value plus its ID as a tiebreaker, otherwise products with the same price can
repeat or get skipped. The current app already breaks ties on ID.

### Facet counts

Same rule as now, but computed in the same query as the results so they
always agree: one `GROUP BY` per filter, each skipping its own condition (or
filtered aggregations in Elasticsearch). This gets expensive with many filters
and values, so:

- show the top N values per filter and load the rest on demand
- precompute counts for each collection with no filters applied, since that's
  the most common view, and refresh them from webhooks
- cache popular filter combinations briefly

### Caching

- shop settings (filters, synonyms) in Redis, cleared on save
- storefront JS/CSS on a CDN with hashed filenames
- search responses cached for a short time, keyed on shop + normalised query +
  filters + sort + cursor + currency, and purged when that shop's products
  change

### Search performance

- Target under 50 ms for autocomplete and under 150 ms for a results page, at
  p95, measured per shop.
- Autocomplete gets its own lightweight prefix index and returns a few products
  and terms, not a full filtered search on every keystroke. Debounce on the
  client and cancel old requests with `AbortController`.
- Return 24–48 products per request, never the whole catalogue.
- Load test with 150k products before launch, and again after synonym or
  analyser changes.

### Storefront performance

- Keep it a theme app extension rather than a ScriptTag, so merchants can
  place it in the theme editor and it goes away cleanly on uninstall.
- Render the first page of results on the server through the App Proxy, then
  load the filter script with `defer`.
- Reserve image and sidebar space so nothing shifts while loading.
- Keep the same URL state and debounce as now.

## Libraries and tools

React and React DOM. The storefront bundle swaps in Preact. No
UI kit or CSS framework. Dev tools: Vite, TypeScript (strict), Vitest, Shopify
CLI.

Built with Claude Code (Anthropic, Claude Opus 5).
