import { LEGACY_CATALOG } from './legacy';
import type { CatalogCategory, CatalogItem } from './types';
import { DETAILED } from './items';

export type { CatalogCategory, CatalogItem } from './types';
export type { Part, Slot, Vec3 } from './kit';

const detailedById = new Map(DETAILED.map((c) => [c.id, c]));

/** Detailed items replace their legacy versions; order follows the legacy list, then any new ids. */
export const CATALOG: CatalogItem[] = [
  ...LEGACY_CATALOG.map((c) => detailedById.get(c.id) ?? c),
  ...DETAILED.filter((c) => !LEGACY_CATALOG.some((l) => l.id === c.id)),
];

export const CATALOG_BY_ID: Record<string, CatalogItem> = Object.fromEntries(CATALOG.map((c) => [c.id, c]));

export const CATEGORIES: CatalogCategory[] = ['Living', 'Dining', 'Bedroom', 'Office', 'Kitchen', 'Bathroom', 'Storage', 'Lighting', 'Decor', 'Site'];

/** Fixed (non-overridable) material for every non-user slot. */
export const FIXED_SLOT_MATERIAL: Record<string, string> = {
  metal: 'black-metal',
  glass: 'glass',
  glow: 'glow',
  fire: 'fire',
  foliage: 'foliage',
  bark: 'bark',
  screen: 'screen',
  chrome: 'chrome',
  rubber: 'rubber',
  soil: 'soil',
  paper: 'paper',
  shade: 'shade-linen',
  plastic: 'plastic',
  leaf: 'leaf-green',
  leafdark: 'leaf-shadow',
  needle: 'spruce-needle',
  amber: 'amber-glass',
  ceramic: 'ceramic-white',
  cloth: 'fabric-cream',
  mirror: 'mirror',
  water: 'water',
  ember: 'ember',
  brass: 'brass',
};
