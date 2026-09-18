import { buildCatalog } from '../catalog';
import { DEFAULT_CONFIG } from '../config/appConfig';
import type { Product } from '../types';
import data from './products.json';

/** The standalone demo's dataset, loaded once at startup, with the default app config. */
const products: readonly Product[] = data;
export const demoCatalog = buildCatalog(products, DEFAULT_CONFIG);
