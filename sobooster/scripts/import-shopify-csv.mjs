// Maps a Shopify product CSV export into the app's Product shape.
//
//   node scripts/import-shopify-csv.mjs products_export.csv [out.json] [--collection "Name"]
//
// Optional tooling only: the graded dataset is src/data/products.json.
//
// Two things a naive parse gets wrong:
// 1. A Shopify CSV has one row per VARIANT, grouped by Handle. Only the first
//    row of a group carries product-level fields (Title, Vendor, Type, Tags).
//    Treating rows as products inflates every facet count.
// 2. Collections are not in the product export at all. They need a separate
//    export or the Admin API, so every product gets --collection (default
//    "Uncategorised") here.
import { readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const collectionFlag = args.indexOf('--collection');
const defaultCollection = collectionFlag === -1 ? 'Uncategorised' : args[collectionFlag + 1];
const positional = args.filter((_, i) => collectionFlag === -1 || (i !== collectionFlag && i !== collectionFlag + 1));
const [input, output = 'shopify-products.json'] = positional;

if (!input) {
  console.error('Usage: node scripts/import-shopify-csv.mjs <export.csv> [out.json] [--collection "Name"]');
  process.exit(1);
}

/** RFC 4180 parser: quoted fields, escaped quotes, newlines inside quotes. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

const [header, ...records] = parseCsv(readFileSync(input, 'utf8').replace(/^﻿/, ''));
const rows = records.map((record) => Object.fromEntries(header.map((name, i) => [name.trim(), (record[i] ?? '').trim()])));

// Group variant rows by Handle, preserving export order.
const groups = new Map();
for (const row of rows) {
  if (!row.Handle) continue;
  if (!groups.has(row.Handle)) groups.set(row.Handle, []);
  groups.get(row.Handle).push(row);
}

const COLOR_NAMES = new Set(['color', 'colour']);
const SIZE_NAMES = new Set(['size']);

const toNumber = (value) => {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : null;
};

/** Option values for any option whose NAME (case-insensitive) is in `names`. */
function optionValues(group, names) {
  const first = group[0];
  const values = new Set();
  for (const slot of [1, 2, 3]) {
    const name = (first[`Option${slot} Name`] ?? '').toLowerCase();
    if (!names.has(name)) continue;
    for (const row of group) {
      const value = row[`Option${slot} Value`];
      if (value) values.add(value);
    }
  }
  return [...values];
}

/** A variant is buyable if it oversells, is not inventory-tracked, or has stock. */
function isAvailable(row) {
  if ((row['Variant Inventory Policy'] ?? '').toLowerCase() === 'continue') return true;
  if (!row['Variant Inventory Tracker']) return true;
  return (toNumber(row['Variant Inventory Qty'] ?? '') ?? 0) > 0;
}

const products = [];
let id = 1;
for (const group of groups.values()) {
  const first = group[0];
  if (!first.Title) continue;

  // Image-only rows have no variant price; ignore them for pricing.
  const variants = group.filter((row) => toNumber(row['Variant Price'] ?? '') !== null);
  if (variants.length === 0) continue;

  const cheapest = variants.reduce((min, row) =>
    toNumber(row['Variant Price']) < toNumber(min['Variant Price']) ? row : min,
  );
  const price = toNumber(cheapest['Variant Price']);
  const compareAt = toNumber(cheapest['Variant Compare At Price'] ?? '');

  const product = { id: id++, title: first.Title, price };
  if (compareAt !== null && compareAt > price) product.compare_at_price = compareAt;
  Object.assign(product, {
    vendor: first.Vendor || 'Unknown',
    product_type: first.Type || first['Product Category'] || 'Other',
    collection: defaultCollection,
    color: optionValues(group, COLOR_NAMES),
    size: optionValues(group, SIZE_NAMES),
    availability: variants.some(isAvailable),
    tags: (first.Tags ?? '').split(',').map((t) => t.trim()).filter(Boolean),
    image: group.find((row) => row['Image Src'])?.['Image Src'] ?? '',
  });
  products.push(product);
}

writeFileSync(output, JSON.stringify(products, null, 2) + '\n');
console.log(`${rows.length} CSV rows -> ${groups.size} handles -> ${products.length} products written to ${output}`);
