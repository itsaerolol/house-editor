import type { Part } from './kit';

export type CatalogCategory = 'Living' | 'Dining' | 'Bedroom' | 'Office' | 'Kitchen' | 'Bathroom' | 'Storage' | 'Lighting' | 'Decor' | 'Site';

export interface CatalogItem {
  id: string;
  name: string;
  category: CatalogCategory;
  /** default size in meters */
  size: { w: number; d: number; h: number };
  /** material slots users can override with defaults (material ids) */
  slots: Partial<Record<'primary' | 'secondary' | 'accent', { label: string; default: string }>>;
  /** parts built from the current size (and quality 0..2) so resizing is dimension-aware */
  parts: (w: number, d: number, h: number, q: number) => Part[];
  /** does the player collide with it */
  solid: boolean;
  /** floor mats: never blocks */
  flat?: boolean;
  /** cosmetic: item hangs on a wall or ceiling; default elevation */
  defaultElevation?: number;
  /** reference used to model it (shown in the detail log) */
  /** Heavy organic items drop a quality tier with camera distance. */
  lod?: boolean;
  ref?: string;
}
