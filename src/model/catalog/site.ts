import { type Part, beam, box, cyl, ledgestone, rbox, sz } from './kit';
import { plankPlanter, shadeTree, shrub, spruce } from './plants';
import type { CatalogItem } from './types';

/** Timber porch post: chamfered square post, two knee braces, black steel standoff base with bolts, top strap ties. */
export function timberPost(w: number, d: number, h: number): Part[] {
  const parts: Part[] = [];
  const t = Math.min(w, d);
  const base = 0.09;
  parts.push(rbox(0, base + (h - base) / 2, 0, t, h - base, t, 0.012, 'primary', { gv: true }));
  // standoff base: plate, stem, cup with bolts
  parts.push(box(0, 0.006, 0, t * 1.3, 0.012, t * 1.3, 'metal'));
  parts.push(cyl(0, base / 2, 0, 0.05, base - 0.02, 0.05, 'metal'));
  for (const sx of [-1, 1]) {
    parts.push(box(sx * (t / 2 + 0.004), base + 0.09, 0, 0.008, 0.18, t * 0.75, 'metal'));
    for (const y of [base + 0.05, base + 0.13]) parts.push(cyl(sx * (t / 2 + 0.012), y, 0, 0.022, 0.012, 0.022, 'metal', { r: [0, 0, Math.PI / 2], seg: 6 }));
  }
  parts.push(box(0, base + 0.004, 0, t * 0.78, 0.008, t + 0.01, 'metal'));
  // knee braces along x, meeting a short top plate
  const bl = Math.min(0.5, h * 0.2);
  for (const sx of [-1, 1]) {
    parts.push(beam([sx * t * 0.45, h - bl * 0.75, 0], [sx * (t / 2 + bl * 0.72), h - 0.03, 0], t * 0.62, t * 0.62, 'primary', 0.008));
    parts.push(box(sx * (t / 2 + 0.002), h - bl * 0.72, 0, 0.006, 0.12, t * 0.5, 'metal'));
  }
  parts.push(box(0, h - 0.06, 0, t + 0.012, 0.1, t + 0.012, 'metal'));
  return parts;
}

/** Masonry chimney above the roof: ledgestone veneer, stone cap with drip edge, black flue pots and a spark arrestor. */
export function stoneChimney(w: number, d: number, h: number): Part[] {
  const parts: Part[] = [];
  parts.push(box(0, h / 2, 0, w - 0.06, h, d - 0.06, 'primary', { tint: [0.45, 0.43, 0.41] }));
  parts.push(...ledgestone('z', d / 2 - 0.03, 1, -w / 2 + 0.01, w / 2 - 0.01, 0, h - 0.15, 61, 'primary'));
  parts.push(...ledgestone('z', -d / 2 + 0.03, -1, -w / 2 + 0.01, w / 2 - 0.01, 0, h - 0.15, 62, 'primary'));
  parts.push(...ledgestone('x', w / 2 - 0.03, 1, -d / 2 + 0.01, d / 2 - 0.01, 0, h - 0.15, 63, 'primary'));
  parts.push(...ledgestone('x', -w / 2 + 0.03, -1, -d / 2 + 0.01, d / 2 - 0.01, 0, h - 0.15, 64, 'primary'));
  // cap: thick slab with a drip overhang
  parts.push(rbox(0, h - 0.06, 0, w + 0.12, 0.12, d + 0.12, 0.012, 'primary', { tint: [0.75, 0.73, 0.7] }));
  // flue liners and caps
  for (const sx of [-1, 1]) {
    const x = sx * w * 0.2;
    parts.push(box(x, h + 0.12, 0, 0.26, 0.24, 0.26, 'ceramic', { tint: [0.55, 0.45, 0.38] }));
    parts.push(box(x, h + 0.36, 0, 0.32, 0.24, 0.32, 'metal', { tint: [0.6, 0.6, 0.6] }));
    parts.push(box(x, h + 0.5, 0, 0.42, 0.03, 0.42, 'metal'));
  }
  return parts;
}

export const SITE: CatalogItem[] = [
  {
    id: 'shrub',
    name: 'Boxwood shrub',
    category: 'Site',
    size: sz(3.5, 3.5, 3),
    slots: {},
    parts: (w, d, h, q) => shrub(w, d, h, 11, { density: q >= 2 ? 92 : q === 1 ? 50 : 24 }),
    solid: false,
    lod: true,
    ref: 'Round boxwood: dense small-leaf rosettes with new sprigs (Dreamstime)',
  },
  {
    id: 'tree-conifer',
    name: 'Blue spruce',
    category: 'Site',
    size: sz(16, 16, 30),
    slots: {},
    parts: (w, d, h, q) => spruce(w, d, h, 21, q),
    solid: true,
    lod: true,
    ref: 'Blue spruce, isolated full tree (Adobe Stock, MITURANI)',
  },
  {
    id: 'tree-oak',
    name: 'Shade tree (oak)',
    category: 'Site',
    size: sz(26, 26, 28),
    slots: {},
    parts: (w, d, h, q) => shadeTree(w, d, h, 31, q),
    solid: true,
    lod: true,
    ref: 'Mature summer oak, isolated (Dreamstime)',
  },
  {
    id: 'planter',
    name: 'Timber planter',
    category: 'Site',
    size: sz(6, 2, 1.6),
    slots: { primary: { label: 'Timber', default: 'timber-dark' } },
    parts: (w, d, h, q) => plankPlanter(w, d, h, 41, q),
    solid: true,
    ref: 'Eartheasy cedar plank planter box with herbs and nasturtiums',
  },
  {
    id: 'post',
    name: 'Timber post',
    category: 'Site',
    size: { w: 0.2, d: 0.2, h: 2.3 },
    slots: { primary: { label: 'Timber', default: 'timber' } },
    parts: (w, d, h) => timberPost(w, d, h),
    solid: true,
    ref: 'Cedar porch posts with knee braces on a modern farmhouse (Nikki\'s Plate)',
  },
  {
    id: 'chimney',
    name: 'Stone chimney',
    category: 'Site',
    size: { w: 7 * 0.3048, d: 3 * 0.3048, h: 9.8 },
    slots: { primary: { label: 'Stone', default: 'stone-dark' } },
    parts: (w, d, h) => stoneChimney(w, d, h),
    solid: true,
    ref: 'Ledgestone chimney with stone cap and black flue caps, matching the fireplace',
  },
];
