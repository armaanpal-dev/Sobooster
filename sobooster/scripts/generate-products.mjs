// Generates src/data/products.json: ~800 products in the documented shape.
// Seeded, so re-running produces the same file. Distributions are deliberately
// uneven (Black on hundreds of products, Champagne on a handful) so facet-count
// bugs are visible rather than hidden by uniform data.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const COUNT = 800;
const FIRST_ID = 1001;

function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260918);

function weighted(entries) {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = rand() * total;
  for (const [value, w] of entries) {
    r -= w;
    if (r <= 0) return value;
  }
  return entries[entries.length - 1][0];
}
const pick = (list) => list[Math.floor(rand() * list.length)];

// [collection, weight, product types, price floor, price ceiling, occasion tags]
const COLLECTIONS = [
  ['Prom Dresses', 22, ['Prom Dress'], 60, 450, ['prom', 'formal']],
  ['Evening Gowns', 12, ['Evening Gown', 'Maxi Dress'], 90, 450, ['evening', 'formal']],
  ['Cocktail Dresses', 18, ['Cocktail Dress', 'Mini Dress', 'Midi Dress'], 35, 260, ['party', 'cocktail']],
  ['Bridesmaid Dresses', 9, ['Bridesmaid Dress'], 55, 220, ['wedding', 'bridesmaid']],
  ['Party Tops', 16, ['Top', 'Blouse', 'Bodysuit', 'Camisole'], 15, 90, ['party', 'going-out']],
  ['Jumpsuits', 7, ['Jumpsuit', 'Playsuit'], 30, 160, ['party', 'occasion']],
  ['Outerwear', 6, ['Blazer', 'Faux Fur Jacket', 'Cape', 'Coat'], 45, 320, ['layering', 'outerwear']],
  ['Skirts', 10, ['Midi Skirt', 'Mini Skirt', 'Maxi Skirt'], 18, 120, ['going-out']],
];

const VENDORS = [
  ['Designer A', 20], ['Maison Lune', 16], ['Velvet & Vine', 13], ['Northbound', 11],
  ['Atelier Nine', 9], ['Studio Rosa', 8], ['Kite & Co', 6], ['Halcyon', 4], ['Oberon London', 2],
];

const COLORS = [
  ['Black', 30], ['Navy', 12], ['Red', 10], ['White', 9], ['Blush', 8], ['Ivory', 6],
  ['Emerald', 5], ['Gold', 4], ['Silver', 3], ['Lilac', 3], ['Burgundy', 2], ['Champagne', 0.5],
];

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const MATERIALS = ['Sequin', 'Satin', 'Chiffon', 'Velvet', 'Lace', 'Crepe', 'Tulle', 'Jersey', 'Beaded', 'Metallic'];
const STYLES = ['', '', '', 'Off-Shoulder', 'Halter', 'Wrap', 'Pleated', 'One-Shoulder', 'Corset', 'Ruched', 'Cut-Out'];

const round2 = (n) => Math.round(n * 100) / 100;

function priceFor(floor, ceiling) {
  // Squared skew: most products sit near the floor, a long tail runs to the ceiling.
  const raw = floor + (ceiling - floor) * rand() ** 2.2;
  const whole = Math.max(15, Math.min(450, Math.floor(raw)));
  return rand() < 0.7 ? whole + 0.99 : whole;
}

function colorsFor() {
  const n = weighted([[1, 70], [2, 25], [3, 5]]);
  const set = new Set();
  while (set.size < n) set.add(weighted(COLORS));
  return [...set];
}

function sizesFor() {
  const length = weighted([[2, 10], [3, 20], [4, 30], [5, 25], [6, 15]]);
  const start = Math.floor(rand() * (SIZES.length - length + 1));
  return SIZES.slice(start, start + length);
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const products = [];
for (let i = 0; i < COUNT; i++) {
  const id = FIRST_ID + i;
  const [collection, , types, floor, ceiling, occasionTags] = weighted(
    COLLECTIONS.map((c) => [c, c[1]]),
  );
  const product_type = pick(types);
  const color = colorsFor();
  const material = pick(MATERIALS);
  const style = pick(STYLES);
  const title = [color[0], style, material, product_type].filter(Boolean).join(' ');
  const price = priceFor(floor, ceiling);

  const product = {
    id,
    title,
    price,
  };
  const onSale = rand() < 0.2;
  if (onSale) product.compare_at_price = round2(Math.ceil(price * (1.15 + rand() * 0.45)) - 0.01);
  Object.assign(product, {
    vendor: weighted(VENDORS),
    product_type,
    collection,
    color,
    size: sizesFor(),
    availability: rand() >= 0.15,
    tags: [
      ...occasionTags,
      slug(material),
      ...color.map(slug),
      ...(style ? [slug(style)] : []),
      ...(onSale ? ['sale'] : []),
    ],
    image: `https://picsum.photos/seed/${id}/400/500`,
  });
  products.push(product);
}

const out = fileURLToPath(new URL('../src/data/products.json', import.meta.url));
writeFileSync(out, JSON.stringify(products, null, 2) + '\n');
console.log(`Wrote ${products.length} products to ${out}`);
