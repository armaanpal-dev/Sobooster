import { useState } from 'react';
import type { PageProps } from './AdminApp';
import { scanCatalog } from './adminApi';
import { Badge, Button, Card, Checkbox, TextField, toast } from './ui';

const FIELD_LABELS = [
  ['title', 'Product title'],
  ['vendor', 'Vendor'],
  ['productType', 'Product type'],
  ['tags', 'Tags'],
  ['options', 'Option values', 'Colour, size, material… so "silk" finds products with a Silk option.'],
] as const;

export function IndexPage({ config, update, scan, setScan, saveNow }: PageProps) {
  const [scanning, setScanning] = useState(false);
  const [tagsDraft, setTagsDraft] = useState(config.index.excludedTags.join(', '));
  const { index } = config;

  const runScan = async () => {
    setScanning(true);
    try {
      setScan(await scanCatalog());
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Scan failed', true);
    } finally {
      setScanning(false);
    }
  };

  const rebuild = async () => {
    await saveNow({ ...config, index: { ...index, version: index.version + 1, lastIndexedAt: new Date().toISOString() } });
  };

  return (
    <>
      <h1>Index</h1>
      <p className="sb-admin__lead">
        What SoBooster searches, and which products it includes. Each shopper's browser builds the index from your live
        catalogue and keeps it for 10 minutes; rebuilding makes every shopper fetch it fresh.
      </p>

      <Card
        title="Index status"
        actions={
          <Button variant="primary" onClick={() => void rebuild()}>
            Rebuild index
          </Button>
        }
      >
        <dl className="sb-admin__stats">
          <div>
            <dt>Status</dt>
            <dd>
              <Badge tone="success">Live</Badge>
            </dd>
          </div>
          <div>
            <dt>Index version</dt>
            <dd>{index.version}</dd>
          </div>
          <div>
            <dt>Last rebuilt</dt>
            <dd>{index.lastIndexedAt ? new Date(index.lastIndexedAt).toLocaleString() : 'Never'}</dd>
          </div>
          <div>
            <dt>Products in store</dt>
            <dd>{scan ? scan.productCount.toLocaleString() : '—'}</dd>
          </div>
        </dl>
      </Card>

      <Card
        title="Catalogue scan"
        description="Reads up to 2,500 products to find the options and tags you can filter by."
        actions={
          <Button onClick={() => void runScan()} disabled={scanning}>
            {scanning ? 'Scanning…' : scan ? 'Scan again' : 'Scan catalogue'}
          </Button>
        }
      >
        {scan ? (
          <>
            <dl className="sb-admin__stats">
              <div>
                <dt>Scanned</dt>
                <dd>{scan.scanned.toLocaleString()}</dd>
              </div>
              <div>
                <dt>Collections</dt>
                <dd>{scan.collectionCount.toLocaleString()}</dd>
              </div>
              <div>
                <dt>Not active (hidden)</dt>
                <dd>{scan.drafts.toLocaleString()}</dd>
              </div>
              <div>
                <dt>No inventory</dt>
                <dd>{scan.outOfStock.toLocaleString()}</dd>
              </div>
            </dl>
            {scan.productCount > 5000 && (
              <p className="sb-admin__warning">
                Your store has more than 5,000 products. SoBooster indexes the first 5,000 (best-selling first).
              </p>
            )}
            <h3>Product options</h3>
            <p className="sb-admin__muted">
              {scan.options.length > 0
                ? scan.options.map((o) => `${o.name} (${o.products})`).join(' · ')
                : 'No product options found.'}
            </p>
            <h3>Tag prefixes</h3>
            <p className="sb-admin__muted">
              {scan.tagPrefixes.length > 0
                ? scan.tagPrefixes.map((t) => `${t.prefix} (${t.products})`).join(' · ')
                : 'No tags of the form "name:value" found.'}
            </p>
          </>
        ) : (
          <p className="sb-admin__muted">Not scanned yet.</p>
        )}
      </Card>

      <Card title="Searchable fields" description="Search matches every word the shopper types in any of these fields.">
        {FIELD_LABELS.map(([key, label, help]) => (
          <Checkbox
            key={key}
            label={label}
            help={help}
            checked={index.fields[key]}
            onChange={(checked) => update((c) => ({ ...c, index: { ...c.index, fields: { ...c.index.fields, [key]: checked } } }))}
          />
        ))}
      </Card>

      <Card title="Exclusions">
        <Checkbox
          label="Hide out-of-stock products"
          help="Removes them from results, counts and suggestions."
          checked={index.excludeOutOfStock}
          onChange={(checked) => update((c) => ({ ...c, index: { ...c.index, excludeOutOfStock: checked } }))}
        />
        <TextField
          label="Exclude products tagged"
          value={tagsDraft}
          placeholder="hidden, wholesale"
          help="Comma-separated tags. Products with any of them never appear in search or filters."
          onChange={(value) => {
            setTagsDraft(value);
            const tags = value.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
            update((c) => ({ ...c, index: { ...c.index, excludedTags: tags } }));
          }}
        />
      </Card>
    </>
  );
}
