import type { CSSProperties } from 'react';
import type { CardSettings } from './config/appConfig';

const RATIOS: Record<CardSettings['imageRatio'], string> = { portrait: '4 / 5', square: '1 / 1', landscape: '4 / 3' };

/** Card settings as CSS custom properties, consumed by styles.css. Shared by the storefront and the admin preview. */
export function cardStyleVars(cards: CardSettings): CSSProperties {
  return {
    '--accent': cards.accentColor,
    '--radius': `${cards.radius}px`,
    '--sb-cols': String(cards.columnsDesktop),
    '--sb-cols-mobile': String(cards.columnsMobile),
    '--sb-ratio': RATIOS[cards.imageRatio],
    '--sb-fit': cards.imageFit,
    '--sb-align': cards.textAlign,
    '--sb-btn-bg': cards.buttonColor,
    '--sb-btn-fg': cards.buttonTextColor,
  } as CSSProperties;
}
