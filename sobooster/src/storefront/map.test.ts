import { describe, expect, it } from 'vitest';
import { collectFacetValues } from '../lib/facetValues';
import { mapAjaxProduct, mapStorefrontProduct, numericId, type AjaxProduct, type StorefrontProduct } from './map';

const node: StorefrontProduct = {
  id: 'gid://shopify/Product/8123',
  handle: 'black-sequin-dress',
  title: 'Black Sequin Dress',
  vendor: 'Designer A',
  productType: 'Dress',
  tags: ['prom', 'sequin'],
  availableForSale: true,
  priceRange: { minVariantPrice: { amount: '189.99', currencyCode: 'EUR' } },
  compareAtPriceRange: { maxVariantPrice: { amount: '249.99' } },
  options: [
    { name: 'Colour', optionValues: [{ name: 'Black' }, { name: 'Red' }] },
    { name: 'size', optionValues: [{ name: 'S' }, { name: 'M' }] },
    { name: 'Material', optionValues: [{ name: 'Satin' }] },
  ],
  featuredImage: { url: 'https://cdn.shopify.com/a.jpg' },
  collections: { nodes: [{ title: 'Prom' }, { title: 'Sale' }] },
};

describe('mapStorefrontProduct', () => {
  it('maps Storefront API fields onto Product, matching option names case-insensitively', () => {
    const product = mapStorefrontProduct(node, '/fr/');
    expect(product).toMatchObject({
      id: 8123,
      price: 189.99,
      compare_at_price: 249.99,
      color: ['Black', 'Red'],
      size: ['S', 'M'],
      collections: ['Prom', 'Sale'],
      url: '/fr/products/black-sequin-dress',
      options: { colour: ['Black', 'Red'], size: ['S', 'M'], material: ['Satin'] },
      singleVariant: false,
    });
  });

  it('drops a compare-at price that is not above the price', () => {
    const product = mapStorefrontProduct({ ...node, compareAtPriceRange: { maxVariantPrice: { amount: '0.0' } } }, '/');
    expect(product.compare_at_price).toBeUndefined();
  });

  it('lets one product count under several collections', () => {
    const values = collectFacetValues([mapStorefrontProduct(node, '/')], [{ key: 'collection', label: 'Collection', source: 'collection', display: 'checkbox' }]);
    expect(values.collection).toEqual(['Prom', 'Sale']);
  });
});

it('treats a product whose options all have one value as single-variant, with its variant id', () => {
  const single = mapStorefrontProduct({ ...node, options: [{ name: 'Title', optionValues: [{ name: 'Default Title' }] }], selectedOrFirstAvailableVariant: { id: 'gid://shopify/ProductVariant/77', availableForSale: true } }, '/');
  expect(single).toMatchObject({ singleVariant: true, variantId: 77, options: {} });
});

describe('mapAjaxProduct', () => {
  const raw: AjaxProduct = {
    id: 42,
    handle: 'tee',
    title: 'Tee',
    vendor: 'V',
    product_type: 'Top',
    tags: 'summer, basics',
    options: [{ name: 'Color', values: ['White'] }, { name: 'Size', values: ['M', 'L'] }],
    variants: [
      { id: 901, price: '30.00', compare_at_price: null, available: false },
      { id: 902, price: '25.00', compare_at_price: '35.00', available: true },
    ],
    images: [{ src: 'https://cdn.shopify.com/t.jpg?v=1' }],
  };

  it('uses the cheapest variant, any-variant availability, and split tags', () => {
    expect(mapAjaxProduct(raw, '/')).toMatchObject({
      price: 25,
      compare_at_price: 35,
      availability: true,
      tags: ['summer', 'basics'],
      color: ['White'],
      size: ['M', 'L'],
      image: 'https://cdn.shopify.com/t.jpg?v=1&width=480',
      variantId: 902,
      singleVariant: false,
      options: { color: ['White'], size: ['M', 'L'] },
    });
  });
});

it('numericId reads the trailing number of a GID', () => {
  expect(numericId('gid://shopify/Product/99')).toBe(99);
});
