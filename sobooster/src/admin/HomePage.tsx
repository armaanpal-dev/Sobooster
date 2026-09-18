import { navigate, type PageProps } from './AdminApp';
import { Badge, Button, Card } from './ui';

/** Handles of the blocks in extensions/sobooster-search/blocks. */
const EMBED_HANDLE = 'search-embed';
const BLOCK_HANDLE = 'search-filter';

function apiKey(): string {
  return document.querySelector<HTMLMetaElement>('meta[name="shopify-api-key"]')?.content ?? '';
}

export function HomePage({ config, shop }: PageProps) {
  const key = apiKey();
  const editor = `https://${shop.domain}/admin/themes/current/editor`;
  const enabledFilters = config.filters.filter((f) => f.enabled).length;

  return (
    <>
      <h1>SoBooster Search &amp; Filter</h1>
      <p className="sb-admin__lead">
        Instant search, filters with live counts, and product cards with Add to cart on your search and collection pages.
      </p>

      <Card title="1. Turn on the app embed" description="Replaces your theme's search page and collection pages with SoBooster.">
        <div className="sb-admin__row">
          <Button variant="primary" href={`${editor}?context=apps&activateAppId=${key}/${EMBED_HANDLE}`} target="_top">
            Open theme editor with the embed enabled
          </Button>
        </div>
      </Card>

      <Card title="Or place the block yourself" description="Add the Search & filters app block to a specific template instead.">
        <div className="sb-admin__row">
          <Button href={`${editor}?template=search&addAppBlockId=${key}/${BLOCK_HANDLE}&target=newAppsSection`} target="_top">
            Add to search page
          </Button>
          <Button href={`${editor}?template=collection&addAppBlockId=${key}/${BLOCK_HANDLE}&target=newAppsSection`} target="_top">
            Add to collection page
          </Button>
        </div>
      </Card>

      <Card title="2. Tune it">
        <ul className="sb-admin__summary">
          <li>
            <a href="/index" onClick={(e) => (e.preventDefault(), navigate('/index'))}>Index</a>
            <span>
              Version {config.index.version}
              {config.index.lastIndexedAt && ` · rebuilt ${new Date(config.index.lastIndexedAt).toLocaleString()}`}
            </span>
          </li>
          <li>
            <a href="/filters" onClick={(e) => (e.preventDefault(), navigate('/filters'))}>Filters</a>
            <span>{enabledFilters} active</span>
          </li>
          <li>
            <a href="/synonyms" onClick={(e) => (e.preventDefault(), navigate('/synonyms'))}>Synonyms</a>
            <span>{config.synonyms.length} rules</span>
          </li>
          <li>
            <a href="/settings" onClick={(e) => (e.preventDefault(), navigate('/settings'))}>Settings</a>
            <span>
              {config.cards.columnsDesktop} per row · Add to cart{' '}
              <Badge tone={config.cards.showAddToCart ? 'success' : 'neutral'}>{config.cards.showAddToCart ? 'On' : 'Off'}</Badge>
            </span>
          </li>
        </ul>
      </Card>

      <Card title="3. Check your store">
        <div className="sb-admin__row">
          <Button href={`https://${shop.domain}/search`} target="_blank">
            View search page
          </Button>
          <Button href={`https://${shop.domain}/collections/all`} target="_blank">
            View a collection
          </Button>
        </div>
      </Card>
    </>
  );
}
