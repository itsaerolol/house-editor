import { CATALOG_BY_ID } from '../model/catalog';
import { wallVec } from '../model/arch';
import { sideIsOutside } from '../model/selectHelpers';
import type { Id, Project, Selection } from '../model/types';
import { slotMaterialId } from '../render/furnitureGeometry';

/** One thing the finish picker can paint: a label, the current material(s), and how to apply a new one. */
export interface FinishTarget {
  key: string;
  label: string;
  current: Id[];
  apply: (d: Project, id: Id) => void;
}

/** Where the walker stands, so a wall face can be "the side you are looking at". */
function walker(): { x: number; z: number } | null {
  const w = (window as unknown as { __walk?: { current: { x: number; z: number } } }).__walk;
  return w ? { x: w.current.x, z: w.current.z } : null;
}

function wallSideTowardViewer(p: Project, id: Id): 'A' | 'B' {
  const w = p.walls[id];
  const me = walker();
  if (!me) return 'A';
  const { nx, nz } = wallVec(w);
  const mx = (w.start.x + w.end.x) / 2;
  const mz = (w.start.z + w.end.z) / 2;
  return (me.x - mx) * nx + (me.z - mz) * nz >= 0 ? 'A' : 'B';
}

export function finishTargets(p: Project, sel: Selection | null, group: Selection[]): FinishTarget[] {
  const list = group.length > 1 ? group : sel ? [sel] : [];
  if (!list.length) return [];
  const kinds = new Set(list.map((g) => g.kind));
  if (kinds.size > 1) {
    // mixed selection: only offer what every member has, which is nothing reliable; paint furniture primaries and wall faces toward you
    return [];
  }
  const kind = list[0].kind;
  if (kind === 'wall') {
    const faces = list.map((g) => ({ id: g.id, side: wallSideTowardViewer(p, g.id) }));
    const other = faces.map((f) => ({ id: f.id, side: f.side === 'A' ? ('B' as const) : ('A' as const) }));
    const cur = (fs: { id: Id; side: 'A' | 'B' }[]) => fs.map((f) => (f.side === 'A' ? p.walls[f.id].finishA : p.walls[f.id].finishB));
    const set = (fs: { id: Id; side: 'A' | 'B' }[]) => (d: Project, id: Id) => {
      for (const f of fs) {
        const w = d.walls[f.id];
        if (!w || w.locked) continue;
        if (f.side === 'A') w.finishA = id;
        else w.finishB = id;
      }
    };
    const facingOut = faces.every((f) => sideIsOutside(p, p.walls[f.id], f.side === 'A' ? 1 : -1));
    return [
      { key: 'near', label: faces.length > 1 ? 'Sides facing you' : facingOut ? 'This side (outside)' : 'This side', current: cur(faces), apply: set(faces) },
      { key: 'far', label: 'Other side', current: cur(other), apply: set(other) },
      { key: 'both', label: 'Both sides', current: [...cur(faces), ...cur(other)], apply: set([...faces, ...other]) },
    ];
  }
  if (kind === 'furniture') {
    const first = p.furniture[list[0].id];
    const item = first && CATALOG_BY_ID[first.catalogId];
    if (!item) return [];
    return (['primary', 'secondary', 'accent'] as const)
      .filter((slot) => item.slots[slot])
      .map((slot) => ({
        key: slot,
        label: item.slots[slot]!.label,
        current: list.map((g) => slotMaterialId(p.furniture[g.id], slot)),
        apply: (d: Project, id: Id) => {
          for (const g of list) {
            const f = d.furniture[g.id];
            if (f && !f.locked && CATALOG_BY_ID[f.catalogId]?.slots[slot]) f.materialOverrides[slot] = id;
          }
        },
      }));
  }
  if (kind === 'room') {
    return [
      { key: 'floor', label: 'Floor', current: list.map((g) => p.rooms[g.id].floorMaterialId), apply: (d, id) => list.forEach((g) => void (d.rooms[g.id].floorMaterialId = id)) },
      { key: 'ceil', label: 'Ceiling', current: list.map((g) => p.rooms[g.id].ceilingMaterialId), apply: (d, id) => list.forEach((g) => void (d.rooms[g.id].ceilingMaterialId = id)) },
    ];
  }
  if (kind === 'opening') {
    const out: FinishTarget[] = [];
    const doors = list.filter((g) => p.openings[g.id]?.kind === 'door');
    if (doors.length)
      out.push({
        key: 'leaf',
        label: 'Door',
        current: doors.map((g) => (p.openings[g.id] as { leafMaterialId: Id }).leafMaterialId),
        apply: (d, id) => doors.forEach((g) => void ((d.openings[g.id] as { leafMaterialId: Id }).leafMaterialId = id)),
      });
    out.push({ key: 'frame', label: 'Frame', current: list.map((g) => p.openings[g.id].frameMaterialId), apply: (d, id) => list.forEach((g) => void (d.openings[g.id].frameMaterialId = id)) });
    return out;
  }
  if (kind === 'slab')
    return [
      { key: 'top', label: 'Top', current: list.map((g) => p.slabs[g.id].topMaterialId), apply: (d, id) => list.forEach((g) => void (d.slabs[g.id].topMaterialId = id)) },
      { key: 'edge', label: 'Edge', current: list.map((g) => p.slabs[g.id].sideMaterialId), apply: (d, id) => list.forEach((g) => void (d.slabs[g.id].sideMaterialId = id)) },
    ];
  if (kind === 'roof') return [{ key: 'roof', label: 'Roofing', current: list.map((g) => p.roofs[g.id].materialId), apply: (d, id) => list.forEach((g) => void (d.roofs[g.id].materialId = id)) }];
  if (kind === 'stair') return [{ key: 'stair', label: 'Stair', current: list.map((g) => p.stairs[g.id].materialId), apply: (d, id) => list.forEach((g) => void (d.stairs[g.id].materialId = id)) }];
  return [];
}

export function canDelete(sel: Selection | null, group: Selection[]): boolean {
  const list = group.length > 1 ? group : sel ? [sel] : [];
  return list.some((g) => !['level', 'room', 'roof', 'stair', 'slab'].includes(g.kind));
}
