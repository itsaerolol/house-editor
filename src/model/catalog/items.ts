import { BATH } from './bath';
import { BEDROOM } from './bedroom';
import { DECOR } from './decor';
import { DINING } from './dining';
import { KITCHEN } from './kitchen';
import { LIGHTING } from './lighting';
import { LIVING } from './living';
import { OFFICE } from './office';
import { SITE } from './site';
import { STORAGE } from './storage';
import type { CatalogItem } from './types';

/** Every rebuilt, reference-matched item. Grows one item at a time. */
export const DETAILED: CatalogItem[] = [...LIVING, ...DINING, ...BEDROOM, ...OFFICE, ...KITCHEN, ...BATH, ...STORAGE, ...DECOR, ...SITE, ...LIGHTING];
