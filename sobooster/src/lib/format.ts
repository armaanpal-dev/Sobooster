// Default until configureCurrency is called with the shop's currency.
let currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** On a storefront, prices are formatted in the shopper's currency and locale. */
export function configureCurrency(currencyCode: string, locale?: string): void {
  try {
    currency = new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode });
  } catch {
    currency = new Intl.NumberFormat(undefined, { style: 'currency', currency: currencyCode });
  }
}

export function formatPrice(value: number): string {
  return currency.format(value);
}
