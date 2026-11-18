import type { Id, Project } from './types';

/** Whole-house exterior looks. Each one remaps the outside face of exterior walls, the stone plinth, gables and roofing. */
export type ExteriorStyleId = 'farmhouse' | 'limestone' | 'brick-red' | 'brick-white';

export interface ExteriorStyle {
  id: ExteriorStyleId;
  name: string;
  blurb: string;
  swatches: string[];
  body: (isLowest: boolean) => Id;
  plinth: Id;
  gable: Id;
  roof: (wasSeam: boolean) => Id;
}

export const EXTERIOR_STYLES: ExteriorStyle[] = [
  {
    id: 'farmhouse',
    name: 'Black farmhouse',
    blurb: 'Black board and batten, dark stone base, charcoal roof',
    swatches: ['#2a2b2d', '#6a6561', '#232426'],
    body: (low) => (low ? 'stone-dark' : 'siding-black'),
    plinth: 'stone-dark',
    gable: 'siding-black',
    roof: (seam) => (seam ? 'roof-seam' : 'roof-shingle'),
  },
  {
    id: 'limestone',
    name: 'Limestone & bronze',
    blurb: 'Cream sawn limestone all round, dark bronze standing seam',
    swatches: ['#e4d9c4', '#5a4532', '#a8673a'],
    body: () => 'limestone-cream',
    plinth: 'limestone-cream',
    gable: 'limestone-cream',
    roof: () => 'roof-bronze',
  },
  {
    id: 'brick-red',
    name: 'Red brick',
    blurb: 'Red running-bond brick on a stone base, black roof',
    swatches: ['#93503a', '#6a6561', '#232426'],
    body: () => 'brick-red',
    plinth: 'stone-dark',
    gable: 'brick-red',
    roof: (seam) => (seam ? 'roof-seam' : 'roof-shingle'),
  },
  {
    id: 'brick-white',
    name: 'Limewashed brick',
    blurb: 'Soft white brick, dark base, black metal roof',
    swatches: ['#dcd6cc', '#6a6561', '#232426'],
    body: () => 'brick-white',
    plinth: 'stone-dark',
    gable: 'brick-white',
    roof: () => 'roof-seam',
  },
];

/** Materials that count as an outside wall face (anything else on an exterior wall is an interior finish and is left alone). */
export const EXTERIOR_FINISHES = new Set<Id>(['siding-black', 'stone-dark', 'limestone-cream', 'brick-red', 'brick-white', 'brick-black', 'brick-tan']);
const SEAMS = new Set<Id>(['roof-seam', 'roof-bronze']);

export function applyExteriorStyle(d: Project, id: ExteriorStyleId): void {
  const st = EXTERIOR_STYLES.find((s) => s.id === id);
  if (!st) return;
  const lowest = d.levelOrder[0];
  for (const w of Object.values(d.walls)) {
    if (w.kind !== 'exterior') continue;
    const body = st.body(w.levelId === lowest);
    if (EXTERIOR_FINISHES.has(w.finishA)) w.finishA = body;
    if (EXTERIOR_FINISHES.has(w.finishB)) w.finishB = body;
    if (w.plinth) w.plinth = { ...w.plinth, materialId: st.plinth };
  }
  for (const r of Object.values(d.roofs)) {
    r.materialId = st.roof(SEAMS.has(r.materialId));
    if (EXTERIOR_FINISHES.has(r.gableMaterialId)) r.gableMaterialId = st.gable;
  }
}

/** Which style the house currently matches best, by its most common outside finish. */
export function currentExteriorStyle(p: Project): ExteriorStyleId | null {
  const n: Record<string, number> = {};
  for (const w of Object.values(p.walls)) {
    if (w.kind !== 'exterior') continue;
    for (const f of [w.finishA, w.finishB]) if (EXTERIOR_FINISHES.has(f)) n[f] = (n[f] ?? 0) + 1;
  }
  const top = Object.entries(n).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!top) return null;
  if (top === 'limestone-cream') return 'limestone';
  if (top === 'brick-red') return 'brick-red';
  if (top === 'brick-white') return 'brick-white';
  if (top === 'siding-black' || top === 'stone-dark') return 'farmhouse';
  return null;
}
