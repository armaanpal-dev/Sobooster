# SoBooster — Product Search & Filter

A React + TypeScript product search with debounced search, six facets with live
counts, sorting, URL state that survives refresh and Back/Forward, and a
responsive layout with a mobile filter drawer. There is no backend: the
catalogue loads once and every view is derived from it in memory. At this size
that is the right engineering choice, and the section on
[going to 150,000 products](#production-this-as-a-shopify-app-with-150000-products)
explains what changes when it stops being right.

The same UI runs in two places:

- **Standalone demo** over a generated 800-product dataset (`npm run dev`).
- **Shopify app**: a theme app extension (app embed + app block) that puts the
  search on real search and collection pages, using that store's products,
  with an admin for the index, filters, synonyms and card styling. See
  [Shopify app](#shopify-app).

**Live demo:** _not deployed yet — run locally (below), or `npx vercel` / drag
`dist/` into Netlify. SPA rewrites for both are already in `vercel.json` and
`public/_redirects`._

## Setup

```bash
npm install
npm run dev        # http://localhost:5173 (redirects to /products)
npm test           # 34 unit tests: filtering, facet counts, sorting, URL, synonyms, config
npm run build      # type-check + production build into dist/
```

Node 20+.

| Script | What it does |
|---|---|
| `npm run generate` | Regenerates `src/data/products.json` (seeded, so the output is deterministic) |
| `npm run build:storefront` | Builds the storefront script into the theme extension's `assets/` |
| `npm run deploy` | Full build, then `shopify app deploy` |
| `npm run import:shopify -- export.csv out.json --collection "Name"` | Optional: maps a Shopify product CSV export to the same shape |

## Shopify app

```bash
shopify app dev      # dev store preview; rebuilds the storefront script on save
npm run deploy       # release a new app version (theme extension + config)
```

### What the merchant gets

**On the storefront**

| Surface | Where | What it does |
|---|---|---|
| **App embed** "Search & filters" | Theme settings → App embeds | Replaces the theme's header search pop-up with instant search, and the `/search` page and collection pages with the full results (each can be switched off). Other pages load only a ~1 KB loader. |
| **App block** "Search & filters" | Any template, via *Add block → Apps* | The same UI wherever it's placed. It can be limited to one collection, and on a collection page it browses that collection by default. |

Search and collection pages share one layout: **filters on the left** with live
counts, sorting, active-filter chips, and **product cards with Add to cart**. On
mobile, the filters move into a drawer. Search pages add the search box with
**suggestions** and "**You may also like**" **recommendations**. Collection
pages show the collection title instead of a search box. If both the embed and
a block are on the same page, the block wins, and only one instance mounts.

**In the admin** (Apps → Sobooster, with pages in Shopify's left nav)

| Page | What the merchant controls |
|---|---|
| **Home** | Deep links that open the theme editor with the embed turned on, or the block added; a summary of the other pages. |
| **Index** | **Searchable fields** (title, vendor, type, tags, option values), **exclusions** (hide out-of-stock, exclude tagged products), a **catalogue scan** (product and collection counts, inactive and no-inventory products, which options and tag prefixes exist), and **Rebuild index**. |
| **Filters** | Show or hide, rename and reorder every filter. **Add filters** from any product option (Material, Fit…) or tag prefix (`fabric:Silk`), with suggestions from the scan. Choose list or colour-swatch display. |
| **Synonyms** | Two-way groups (`sweater, jumper, pullover`) and one-way rules (`tee → t-shirt`), including multi-word phrases, with a live "Try it" box. |
| **Settings** | **Product card styling** with a live preview built from the real storefront card: image shape and fit, products per row (desktop and mobile), corner radius, alignment, what appears on the card, and the button's style, text and colours. Also: suggestions, recent searches and recommendations; products per page and default sort; and what happens after Add to cart. |

### How it works

```
Admin (embedded, App Bridge)  ──Direct API access──►  app-data metafield  sobooster.config (JSON)
                                                              │ Liquid: app.metafields.sobooster.config
                                                              ▼
Theme extension (embed/block) ──config JSON──►  storefront script ──► Storefront API / Ajax APIs
```

```
extensions/sobooster-search/        theme app extension (served from Shopify's CDN)
  blocks/search-embed.liquid        app embed  → <script type="application/json"> config
  blocks/search-filter.liquid       app block  → <div data-sobooster-root data-config>
  snippets/sobooster-config.liquid  market, locale, currency, collection, mode + the admin config
  assets/sobooster.js|css           built from src/storefront/ by npm run build:storefront
src/config/appConfig.ts             the admin config: types, defaults, validation (shared by all three)
src/admin/                          Index, Filters, Synonyms, Settings pages + Admin API client
src/storefront/
  main.tsx          mounts into blocks, or the embed's container
  loadProducts.ts   Storefront API (tokenless) → fallback /products.json; session cache
  cart.ts           /cart/add.js, /products/{handle}.js, /recommendations/products.json
  map.ts            Shopify product → Product (every option, variant id, publish date)
```

- **Still no backend.** The admin pages call the Admin GraphQL API straight from
  the browser with Shopify's **Direct API access** (`shopify:admin/…`); App
  Bridge authenticates the calls. Settings are saved as one JSON **app-data
  metafield** on the app installation. The theme extension reads it in Liquid
  (`app.metafields.sobooster.config`) and passes it to the script with the page,
  so a change applies on the next page load. Every Admin and Storefront
  operation was validated against Shopify's schema. The only scope is
  `read_products`, for the catalogue scan.
- **Products.** The script reads the catalogue from the **tokenless Storefront
  API** on the shop's own origin, with `@inContext(country, language)` so prices
  are in the shopper's currency. It falls back to `/products.json` plus
  `/collections.json` when the API is unavailable, for example on a
  password-protected dev store. It pages within the tokenless cost limit and
  caches in `sessionStorage` for 10 minutes. The index version is part of the
  cache key, so **Rebuild index** refreshes every shopper's cache.
- **Add to cart.** Single-variant products go straight in (`/cart/add.js`).
  Multi-variant products open a compact variant picker, loaded on demand from
  `/products/{handle}.js` so the catalogue query stays light. The same request
  asks for the theme's cart-count section (Section Rendering API), so a Dawn-style
  header count updates in place. `cart:refresh` and `sobooster:cart:added`
  events let other themes react. Settings can send shoppers straight to the
  cart instead.
- **Instant search** replaces the theme's own header search pop-up, in the same
  layout.
  - **Layout:** a centred search box with a close button. Under it, an inline
    "Suggestions:" row (with the typed letters emphasised), a product grid
    (image, title, price), matching store **Pages**, and "View all search
    results". With an empty box it shows recent searches (last 5,
    `localStorage`) and popular products.
  - **Hovering or focusing a suggestion swaps the products** to that
    suggestion's results.
  - **Where it runs:** it opens from the theme's search icon. The embed's
    *Search icon* setting holds the selector; the default suits Dawn-style
    themes.
  - **Pages** come from Shopify's predictive search (`/search/suggest.json`).
    Products and suggestions come from SoBooster's own index, so synonyms and
    exclusions apply.
  - **Load cost:** only a ~1 KB inline loader runs on every page. The full
    script loads when the shopper hovers, focuses or clicks search ("import on
    interaction"). A click before it has loaded is queued, not lost.
  - **Built on a modal `<dialog>`:** focus stays inside, Escape and clicks on
    the dimmed page close it, and on mobile it fills the screen.
  - **The search page's own search box** shows the same instant results as a
    dropdown across the page.
- **Recommendations** come from Shopify's Product Recommendations API for the
  top result, matched back to the loaded catalogue and topped up with popular
  in-stock products. They also fill the "no results" state.
- **Same engine and URL model as the demo.** The facet-count rule, OR within a
  facet, AND across facets, and URL-only state all carry over unchanged; facets
  are now configurable instead of fixed. Shopify's own `?q=` drives the search
  box. Facet keys that would clash with Shopify's parameters (`type`, `page`…)
  are renamed automatically.
- **Works inside any theme.**
  - Every class is prefixed `sb-` and all CSS is scoped under `.sb-root`.
  - Resets use `:where()` (zero specificity), so they never beat a component
    rule.
  - The app inherits the theme's font.
  - Breakpoints are **container queries**, so the layout follows the column the
    theme gives it, not the viewport.
  - Card settings become CSS custom properties.
- **Size.** The storefront bundle aliases React to **Preact**: **22.2 KB
  gzipped** with instant search, recommendations and the cart. It loads with
  `defer` on search and collection pages, and on other pages only once the
  shopper reaches for search.
- **Speed.** A filter click repaints in about 30–90 ms in the production build.
  The grid updates in place rather than remounting, which profiling showed had
  been the dominant cost. Filtering and counting take about 2–3 ms of that.

### Tested

Beyond the 34 unit tests (engine, synonyms, search panel, config validation,
Shopify mapping), everything was driven in Chrome:

- **Storefront.** A mock shop with deliberately hostile theme CSS, a fake
  Storefront API, and Ajax cart, variant and recommendation endpoints. **46
  checks passed in both data modes** (API and locked fallback):
  - Settings from the admin config: columns, button colours and labels.
  - Filters in the configured order, with option and tag facets.
  - Synonyms and the Newest sort.
  - The search page's instant results: suggestions and products, picking a
    suggestion, recent and popular.
  - Recommendations and the popular fallback.
  - Add to cart: a single variant goes straight in and the theme cart count
    updates; a multi-variant product adds the chosen variant; sold-out buttons
    are disabled.
  - Collection pages: scoped, no search box, filters on the left, sorting and
    facets combining.
  - Mobile, and the session cache.
- **Admin.** The Admin API mocked in the browser. **29 checks passed**:
  - Adding option and tag filters from the scan, reordering, and enabling.
  - Synonyms with "Try it".
  - Settings with the live preview (columns, text, colour, shape, variant
    picker), Discard, and Save.
  - Index fields and exclusions, and Rebuild index.
  - A reload restoring everything.
  - Only the three validated operations are used.
- **Instant search.** The mock theme has a Dawn-style header search icon, and
  its inline loader is extracted from the real Liquid. **26 checks passed in
  both data modes**:
  - No script on page load; hovering preloads it; a click opens SoBooster and
    the theme's own modal stays shut.
  - The "Suggestions:" row lines up under the input, with the configured
    number of products, Pages, and "View all".
  - Hovering or Tab-focusing a suggestion swaps the products.
  - Focus is trapped; Escape and backdrop clicks close it.
  - "View all" opens the search page.
  - A click before the script loads is queued.
  - The search page's dropdown uses the same layout, across the page.
  - On mobile it's full-screen with 2 products per row.
- **Validators.** `shopify theme check` reports no offenses and
  `shopify app build` succeeds.

## Requirements → where they live

Numbered as in the machine-test brief.

| # | Requirement | Implementation |
|---|---|---|
| 1 | Search by title, vendor, product type and tags; no full-page refresh; debounced (250 ms); clear "No products found" state | [`SearchBar`](src/components/SearchBar.tsx), [`lib/search.ts`](src/lib/search.ts), [`EmptyState`](src/components/EmptyState.tsx) |
| 2 | Filters: Collection, Vendor, Color, Size, Price, Availability, applied together (AND across filters, OR within one) | [`FilterPanel`](src/components/FilterPanel.tsx), [`FacetGroup`](src/components/FacetGroup.tsx), [`PriceRange`](src/components/PriceRange.tsx), [`lib/filter.ts`](src/lib/filter.ts) |
| 3 | Dynamic counts per filter option, updating as other filters change | [`lib/facets.ts`](src/lib/facets.ts); see [the rule](#the-facet-count-rule) |
| 4 | Sorting: Featured, Price Low → High, Price High → Low, Name A → Z, Name Z → A, combined with search and filters | [`lib/sort.ts`](src/lib/sort.ts), [`SortSelect`](src/components/SortSelect.tsx) |
| 5 | URL state (`/products?color=black&size=m&min_price=100&max_price=200`); refresh and share reproduce the view; Back/Forward; Clear All resets the URL | [`lib/url.ts`](src/lib/url.ts), [`useProductQuery`](src/hooks/useProductQuery.ts), [`ActiveChips`](src/components/ActiveChips.tsx) |
| 6 | Responsive on desktop, tablet and mobile; filters in a drawer on mobile | [`MobileFilterDrawer`](src/components/MobileFilterDrawer.tsx), container queries in [`styles.css`](src/styles.css) |
| 7 | Production essay for a 150,000-product Shopify app | [Production](#production-this-as-a-shopify-app-with-150000-products) below; the [Shopify app](#shopify-app) above implements part of it |
| 8 | Optional: pagination | "Show more", a page at a time ([`ProductGrid`](src/components/ProductGrid.tsx)) |
| 8 | Optional: search suggestions (autocomplete) | Instant results with a suggestions row and product previews ([`InstantResults`](src/components/InstantResults.tsx), [`lib/suggest.ts`](src/lib/suggest.ts)) |
| 8 | Optional: recent searches, last 5, stored locally | `localStorage`, shown when the search box is empty ([`lib/suggest.ts`](src/lib/suggest.ts)) |

Beyond the brief: active-filter chips, a "Newest" sort (offered only when
products have publish dates, so the demo shows exactly the five sorts above),
and in the Shopify app synonyms, configurable filters, Add to cart and
recommendations.

## Architecture

```
URL (?q=…&color=…&sort=…)            ← the only store of search/filter/sort state
   │ parseSearchState (lib/url.ts)
   ▼
{ query, filters, sort }
   │ runQuery (lib/query.ts) — a single useMemo
   ▼
{ results, counts, priceBounds, total } ──► components render; user actions
                                            serialise back into the URL
```

**The URL is the single source of truth.** Search, filter and sort state is never
held in `useState`. `useProductQuery` reads the query string (through
react-router's `useSearchParams` in the demo, and the History API on a
storefront), parses it, and derives everything in one `useMemo`. Every action serialises a new state into the
URL. With only one copy of the state, the URL and the UI cannot drift apart, and
refresh, share, Back and Forward work without any extra code. The only local
state is transient UI: the drawer's open flag, the search box's in-progress text,
the price inputs before you apply them, and how many cards "Show more" has revealed.

**History policy.** Typing *replaces* the current history entry. Filter and sort
changes *push* a new one. So Back steps through filter changes rather than
keystrokes. Clear all navigates to the bare `/products`.

**`lib/` is pure.** Filtering, facet counting, sorting and URL parsing are plain
functions over plain data, with no React imports. That keeps them unit-testable
in isolation, and they are the parts a server would reuse if this moved there.

**URL format** follows the brief, with readable slugs:

```
/products?q=dress&collection=prom-dresses&color=black,red&size=m&min_price=100&max_price=200&sort=price_asc
```

Slugs are mapped back to dataset values through an index built from the data.
Unknown slugs and malformed numbers are dropped silently, so a stale or
hand-edited link still renders something sensible. A reversed price range is
swapped. Defaults (`featured`, empty facets) are left out, so the empty state is
the bare path.

## The facet-count rule

> **A facet's counts are computed from the products matching the search and
> every *other* facet's filter — excluding that facet's own selection.**
>
> `countsFor(facet) = count(products matching search + all filters EXCEPT facet)`

**Why.** If a facet's own selection were applied to its own counts, selecting
Colour = Black would show `Black: 327` and every other colour `0`. The shopper
could never widen to Black *or* Red, and the filter would become a dead end.
Excluding the facet's own selection means each count answers the question the
shopper is actually asking: *"if I also tick this, how many products will I
get?"* Every other facet still narrows the counts, so selecting Vendor = Halcyon
correctly reduces every colour count.

**How.** Running the filter once per facet would work, but [`computeFacets`](src/lib/facets.ts)
does it in a single pass. For each product that matches the search, it
collects the facets the product *fails*:

- **fails none** — it is a result, and it counts towards every facet;
- **fails exactly one facet F** — it is not a result, but it still counts towards
  F, because F's own selection is ignored when counting F;
- **fails two or more** — it counts nowhere.

The same logic gives the price-range placeholders: they show the price span of
products matching everything *except* the price filter.

**UI details.** Zero-count values stay in place, greyed out and disabled, instead
of disappearing, so the list doesn't reflow on every click. A selected value is
never disabled, even at zero, so you can always untick it.

[`facets.test.ts`](src/lib/facets.test.ts) proves this. It checks that selecting
Black leaves Red's count unchanged, that other facets still narrow the count, and
that the single pass gives the same numbers as a brute-force filter-per-facet
computation.

## Assumptions

- **No dataset was supplied, so the data is generated.** [`scripts/generate-products.mjs`](scripts/generate-products.mjs)
  writes 800 products in exactly the documented shape. It uses 8 collections, 9
  vendors, 12 colours and sizes XS–XXL. Prices run from $15 to $449, skewed low
  (median about $89). About 20% of products have a `compare_at_price` and about
  14% are out of stock. The distribution is **deliberately uneven**: Black
  appears on 327 products and Champagne on 7, and Designer A has 198 products
  while Oberon London has 15. A uniform dataset would hide count bugs. To use a
  supplied dataset instead, drop it in as `src/data/products.json`; nothing else
  changes.
- Images are `picsum.photos` placeholders. They are random photos, not clothing.
- A product with several colours is titled by its first colour. So a "Red …"
  product can correctly appear under Colour = Black if Black is its second colour.
- Prices are shown in US dollars, matching the brief's examples. On a Shopify store they use the shop's and shopper's currency.
- Search splits the query into whitespace-separated tokens, and **every token**
  must appear somewhere in the title, vendor, type or tags. Matching is a
  case-insensitive substring match. So "black gown" finds "Black Satin Evening
  Gown", which a match on the whole phrase would miss.
- Clear all resets everything, including search and sort, to the bare path, as
  the brief specifies.

## Trade-offs

- **In-memory filtering.** At 800 products a full recompute (search, all counts,
  sort) is one linear pass over the data, too fast to notice. A server,
  database or search index would add latency, a deploy target and failure modes,
  and buy nothing at this size. The dataset is bundled into the JS (about 110 kB
  gzipped). That's fine for a demo. In production the data would come from an
  API instead.
- **Substring over fuzzy matching.** Substring matching is predictable, costs
  nothing to explain, and has no false positives. Fuzzy matching (typo
  tolerance, stemming, synonyms) matters more as catalogues grow. That's the
  search engine's job at production scale, not 30 lines of client code.
- **Native `<dialog>` for the drawer.** `showModal()` makes the rest of the page
  inert, which gives a real focus trap. Escape closes it natively. Focus returns
  to the Filters button on close. A backdrop click closes it too. All of this
  comes with no focus-trap library.
- **Price applies on Enter, on blur, or with the Apply button, not per
  keystroke.** Typing "150" is then one history entry and one recompute, not
  three.
- **Pagination is "Show more", not numbered pages.** It keeps the URL about
  *what* you're looking at, not how far you've scrolled. The trade-off is that a
  refresh returns you to the first 48 results.

## Limitations / with more time

- Component/integration tests (React Testing Library or Playwright). During
  development the app was checked end to end with a Playwright script: facet
  counts, OR/AND, sort order, Back/Forward, no history entries while typing,
  refresh reproducing the view, empty state, price chips, drawer focus trap,
  Escape and backdrop close, and no console errors. That script isn't in the
  repo.
- A price histogram or slider instead of two number inputs.
- A `page` parameter in the URL, if deep result positions need to be shareable.
- Real product images, plus `srcset` for responsive sizes.
- Collapsible facet groups, and "show more" inside long facet lists.
- **Shopify app limits, by design of the no-backend approach:**
  - The whole catalogue loads into the browser, capped at 5,000 products. That
    suits small and mid-size shops. Larger ones need the server-side design
    below.
  - The compare-at price is the product's highest variant compare-at, an
    approximation.
  - In fallback mode, prices are in the shop's base currency.
  - Suggestions and synonyms match substrings, with no typo tolerance.
- Hosting for the admin pages (any static host). The storefront feature is
  served entirely by Shopify from the theme extension.

## Production: this as a Shopify app with 150,000 products

**In-memory filtering is correct at 1,000 products and wrong at 150,000.** At
150k products the payload alone is tens of MB of JSON. Filtering and counting
take tens of milliseconds per keystroke on a mid-range phone, and the full
catalogue would be shipped to every shopper. The crossover is somewhere around
**5,000–10,000 products, or ~1–2 MB of payload**. That's roughly where the
first-load cost and the per-interaction cost on low-end mobile outgrow a
server round-trip. Beyond it, the storefront sends a query and receives one page
of results plus the facet counts.

### Initial index: Bulk Operations, not pagination

Paging 150k products through the GraphQL Admin API at 100 per page is 1,500+
calls, each spending cost-based rate-limit budget. With variants, metafields and
collections nested inside, it's far more. Instead, run one
**`bulkOperationRunQuery`** job. Shopify executes it on their side and delivers a
**JSONL** file. Nested connections (variants, collections, metafields) come back
as separate lines linked to their parent by **`__parentId`**. So the ingester
streams the file line by line, buffers children under their parent ID, and
upserts complete products in batches. It never loads the file into memory. Bulk
jobs finish asynchronously, via the `bulk_operations/finish` webhook or by
polling, and only one runs per shop at a time. The ingester has to respect that.

### Incremental sync: webhooks plus reconciliation

Subscribe to `products/create`, `products/update` and `products/delete`,
`collections/*`, and inventory-level updates. The webhook handler verifies the
HMAC, enqueues the payload, and returns 200 immediately. Processing happens in a
worker, because Shopify times out slow responders and eventually drops the
subscription. Workers must be idempotent. Deliveries can be duplicated or arrive
out of order, so compare the payload's `updated_at` with the stored row and
ignore anything older. **Webhook delivery is not guaranteed**, so run a nightly
reconcile: a bulk query of IDs and `updatedAt` diffed against the index to
repair drift.

### Rate limits

The GraphQL Admin API uses **cost-based throttling**: a leaky bucket of query
cost points per shop. Read `extensions.cost.throttleStatus` on each response and
pace calls to keep within the budget. Don't wait for an error. Bulk operations
move the heavy lifting to Shopify's side and barely touch the bucket, which is
the main reason to use them for full syncs. On `429`/`THROTTLED`, back off
exponentially with jitter and honour `Retry-After`. Make the queue per-shop, so
one noisy merchant can't starve the others.

### Search engine: Postgres first, a dedicated engine when it earns its place

**Postgres gets a long way.** Use a weighted `tsvector` (title > type/vendor >
tags) with a **GIN** index for full-text search, plus **`pg_trgm`** with a GIN
trigram index for typo tolerance and substring match. Facet values go in
normalised columns or arrays: `text[]` for colour and size with GIN, B-tree for
price and availability. At 150k products for one shop, well-indexed queries
return in tens of milliseconds, and there is **one source of truth**. Writes
from webhooks are transactional and immediately visible.

**When to move the read path** to Elasticsearch/OpenSearch, Algolia or
Typesense: when you need relevance tuning, synonyms, per-language analysers,
merchandising rules or vector search; when facet aggregation across many
high-cardinality facets gets slow; or when the multi-tenant total (thousands of
shops, tens of millions of documents) makes Postgres p95 latency hard to hold.
Postgres stays the write side and the system of record. The engine is a
**derived, rebuildable read model**.

**A second datastore is not free.** It's a sync-drift risk. Every write now has
to reach two places. A missed update means a shopper sees a product that's out
of stock or deleted, or a wrong price. You need an outbox or change-data-capture
to propagate changes, drift monitoring, and a full reindex path, and the
operational surface doubles. Only take that on when Postgres demonstrably can't
meet the requirement.

### Facet counts at scale

The rule above doesn't change. Computing counts **in the same query or request
as the results** is what guarantees they agree: the counts can never promise 12
Red dresses when the grid shows 9. In Postgres that's a CTE for the filtered
set, with one `GROUP BY` per facet, each skipping its own predicate. In an
engine it's a filtered aggregation per facet (`post_filter` plus per-facet
aggregation filters in Elasticsearch). It stops being cheap as the number of
facets × the number of values × concurrent queries grows, and with
high-cardinality facets like vendor or tag. At that point:

- Cap facet lists (top N plus "show more", fetched lazily).
- **Pre-aggregate** counts for the common no-search state per collection. They
  are the most-requested counts and are cacheable, and are invalidated by product
  webhooks.
- Put hot filter combinations in a short-TTL cache.
- Where approximate counts are acceptable (very large result sets), say so in
  the UI rather than paying for exactness.

### Pagination

Use **keyset** (cursor) pagination rather than `OFFSET`. `OFFSET 10000` still
reads and discards 10,000 rows, and results shift if data changes between pages.
The cursor encodes the last row's sort key **plus a unique tiebreaker**, for
example `(price, id)` or `(score, id)`. Without the tiebreaker, products with
equal prices or relevance scores can reshuffle between requests, showing
duplicates and skipping items. This app already breaks ties on `id` for the
same reason.

### Caching

- **Per-shop config cache** (facet setup, synonyms, merchandising rules) in
  memory or Redis, invalidated on settings save.
- **CDN** for the storefront JS and CSS, with content-hashed filenames and
  immutable cache headers.
- **Response cache** for search results, with keys that include the shop, the
  *normalised* filter state (sorted params, lower-cased query), sort, page cursor,
  and locale or currency. Keep TTLs short and purge per shop on product
  webhooks.

### Background jobs

A job queue (BullMQ, Sidekiq-style, or cloud tasks), keyed per shop, handles:
initial bulk sync; webhook processing; nightly reconcile; **full re-index** when
a merchant changes language or market settings or analyser configuration
(build a new index in the background, then swap an alias, so there's no
downtime); **embedding backfill** if semantic search is added (batched,
rate-limited, resumable); and uninstall cleanup (`app/uninstalled`, plus the
GDPR `shop/redact` webhook).

### Search performance

- **Set budgets and measure against them.** Typeahead should answer server-side
  in under 50 ms at p95, and a filtered results page in under 150 ms. Track p95
  and p99 per shop, not averages. One merchant with 150k products and heavy
  traffic is the case that breaks.
- **Typeahead gets its own path.** Use an edge-n-gram or prefix index over
  titles, vendors, types and a curated term list. Return a few products and
  terms from that path, not a full faceted query per keystroke. Clients debounce
  (as this app does, at 250 ms) and cancel superseded requests with
  `AbortController`.
- **Keep result sets small.** Fetch one page (24–48 products) plus the facet
  counts; never ship the catalogue to the browser at this size. Use keyset
  cursors for deep pages, and cap how deep offset-style access can go.
- **Make facets cheap.** Cap the values per facet, and store filterable
  attributes denormalised on the product document or row. Pre-aggregate counts
  for the most common views (a collection with no filters). When a search
  matches most of the catalogue, use approximate counts and say so.
- **Cache hot queries** under a normalised cache key (see Caching), and warm
  the cache for a shop's top queries after each re-index.
- **Load-test before launch** at 150k products with realistic query mixes and
  concurrency. Re-test after analyser or synonym changes, since those change
  index size and query cost.
- **At this demo's size**, the whole pipeline runs in the browser. Filtering and
  counting 800 products takes about 2–3 ms per interaction, and a filter click
  repaints in roughly 30–90 ms.

### Storefront performance

- Ship the UI as a **theme app extension** (app blocks and embeds), not a
  `ScriptTag`. Merchants can place and remove it in the theme editor, it's
  versioned with the app, and it doesn't linger after uninstall.
- Route search requests through an **App Proxy**
  (`shop.com/apps/search/...`). They stay first-party: same origin, no CORS
  preflight, no third-party cookie issues. Shopify signs each request, so the
  backend can verify which shop it came from.
- **No render-blocking JS.** Server-render the first page of results in Liquid
  or HTML through the proxy, then hydrate the interactive filters with a small
  `defer` or `type="module"` script.
- **No layout shift.** Reserve image aspect ratios (`width`/`height` or
  `aspect-ratio`, as this app does), and reserve space for the facet sidebar
  and result count before data arrives.
- Keep the same debounce and URL-state behaviour as here, so shared links and
  Back/Forward work on the storefront too. Use `AbortController` to cancel
  in-flight searches when a newer one supersedes them.

## Optional Shopify CSV importer

[`scripts/import-shopify-csv.mjs`](scripts/import-shopify-csv.mjs) maps a
Shopify product CSV export into the same `Product` shape. It is optional tooling
and is **not** the source of the graded dataset. It uses no dependencies, and
its CSV parser handles quoted fields, escaped quotes and embedded newlines.

| `Product` field | From the Shopify export |
|---|---|
| `title`, `vendor`, `product_type` | `Title`, `Vendor`, `Type` |
| `tags` | `Tags`, split on commas and trimmed |
| `color`, `size` | `Option1/2/3 Name` + `Value`, matched on the option **name** case-insensitively (`Color`, `color`, `Colour`) |
| `price` | **Minimum** `Variant Price` across the product's variant rows |
| `compare_at_price` | That variant's `Variant Compare At Price`, only when it is higher than `price` |
| `availability` | True if **any** variant is buyable: inventory > 0, inventory not tracked, or policy `continue` |
| `image` | First `Image Src` for the handle |
| `collection` | **Not in the export**: set by the `--collection` flag |

Two gotchas it handles:

1. **One row per variant, not per product.** Rows are grouped by `Handle`, and
   only the first row carries the product-level fields. A naive parse turns
   every variant into a "product" and inflates every facet count.
2. **Collections are absent from the product CSV.** They need a separate export
   or an Admin API call. That's one of the reasons a real app syncs through the
   Admin API rather than CSV.

## Libraries and AI tools used

**Runtime:** `react`, `react-dom`, `react-router` (for `useSearchParams` and
navigation in the demo). In the storefront bundle, `preact` stands in for React
via `preact/compat`. Nothing else: no UI kit, state library or CSS framework.
Shopify App Bridge is loaded from Shopify's CDN on the admin page only.

**Development:** `vite`, `@vitejs/plugin-react`, `typescript` (strict, plus
`noUncheckedIndexedAccess`), `vitest`, `@types/*`, and Shopify CLI.
`playwright-core` was used locally, outside the repo, to drive the demo, the
admin page and a mock storefront in Chrome for end-to-end checks.

**AI tools:** this project was built with **Claude Code (Anthropic, Claude Opus
5 model)**, working from a written brief. Claude Code scaffolded the project,
wrote the code, tests, scripts and this README, and ran the type-check, unit
tests, build and browser verification. The design decisions are documented
above so they can be reviewed on their merits.
