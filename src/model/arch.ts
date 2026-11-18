import type { Id, Level, Opening, Project, Stair, Vec2, Wall } from './types';

export function wallVec(w: Wall) {
  const dx = w.end.x - w.start.x;
  const dz = w.end.z - w.start.z;
  const len = Math.hypot(dx, dz);
  const tx = len > 0 ? dx / len : 1;
  const tz = len > 0 ? dz / len : 0;
  // side A normal; side B is the opposite
  return { len, tx, tz, nx: tz, nz: -tx };
}

export const wallLength = (w: Wall) => wallVec(w).len;

export function wallBase(w: Wall, level: Level): number {
  const off = w.baseOffset ?? (w.kind === 'exterior' ? -level.slabThickness : 0);
  return level.elevation + off;
}

export function wallTop(w: Wall, level: Level, levels: Record<Id, Level>): number {
  if (w.topLevelId && levels[w.topLevelId]) {
    const t = levels[w.topLevelId];
    return t.elevation + t.ceilingHeight;
  }
  return level.elevation + (w.height ?? level.ceilingHeight);
}

/** Wall height measured from the level floor (what the user edits). */
export function wallClearHeight(w: Wall, level: Level, levels: Record<Id, Level>): number {
  return wallTop(w, level, levels) - level.elevation;
}

export interface WallBox {
  a0: number;
  a1: number;
  y0: number;
  y1: number;
  kind: 'solid' | 'glass' | 'door';
  mat: 'wall' | 'plinth';
  openingId?: Id;
}

export interface WallBoxOptions {
  /** absolute world height at which the wall is sectioned (plan / cutaway) */
  cutY?: number;
  /** include window panes and closed door leaves as blockers */
  collision?: boolean;
}

export function computeWallBoxes(
  wall: Wall,
  openings: Opening[],
  level: Level,
  levels: Record<Id, Level>,
  opts: WallBoxOptions = {},
): WallBox[] {
  const L = wallLength(wall);
  const base = wallBase(wall, level);
  const top = wallTop(wall, level, levels);
  const boxes: WallBox[] = [];
  if (L <= 1e-6 || top <= base) return boxes;

  const ops = openings
    .filter((o) => o.wallId === wall.id)
    .map((o) => {
      const a0 = Math.max(0, Math.min(L, o.offset));
      const a1 = Math.max(0, Math.min(L, o.offset + o.width));
      const y0 = Math.max(base, Math.min(top, level.elevation + o.sill));
      const y1 = Math.max(y0, Math.min(top, level.elevation + o.sill + o.height));
      return { o, a0, a1, y0, y1 };
    })
    .filter((x) => x.a1 - x.a0 > 1e-4 && x.y1 - x.y0 > 1e-4)
    .sort((p, q) => p.a0 - q.a0);

  let cursor = 0;
  for (const { o, a0: rawA0, a1, y0, y1 } of ops) {
    const a0 = Math.max(rawA0, cursor);
    if (a1 <= cursor + 1e-6) continue; // fully overlapped, ignore
    if (a0 > cursor + 1e-6) boxes.push({ a0: cursor, a1: a0, y0: base, y1: top, kind: 'solid', mat: 'wall' });
    if (y0 > base + 1e-4) boxes.push({ a0, a1, y0: base, y1: y0, kind: 'solid', mat: 'wall', openingId: o.id });
    if (top > y1 + 1e-4) boxes.push({ a0, a1, y0: y1, y1: top, kind: 'solid', mat: 'wall', openingId: o.id });
    if (opts.collision) {
      if (o.kind === 'window') boxes.push({ a0, a1, y0, y1, kind: 'glass', mat: 'wall', openingId: o.id });
      else if (!o.open && o.style !== 'cased') boxes.push({ a0, a1, y0, y1, kind: 'door', mat: 'wall', openingId: o.id });
    }
    cursor = a1;
  }
  if (cursor < L - 1e-6) boxes.push({ a0: cursor, a1: L, y0: base, y1: top, kind: 'solid', mat: 'wall' });

  // plinth split
  let out: WallBox[] = boxes;
  if (wall.plinth) {
    const py = level.elevation + wall.plinth.top;
    out = [];
    for (const b of boxes) {
      if (b.kind !== 'solid') {
        out.push(b);
      } else if (b.y1 <= py + 1e-6) {
        out.push({ ...b, mat: 'plinth' });
      } else if (b.y0 >= py - 1e-6) {
        out.push(b);
      } else {
        out.push({ ...b, y1: py, mat: 'plinth' });
        out.push({ ...b, y0: py });
      }
    }
  }

  if (opts.cutY !== undefined) {
    const cut = opts.cutY;
    out = out
      .filter((b) => b.y0 < cut - 1e-6)
      .map((b) => (b.y1 > cut ? { ...b, y1: cut } : b));
  }
  return out;
}

export function sortedLevels(p: Pick<Project, 'levelOrder' | 'levels'>): Level[] {
  return p.levelOrder.map((id) => p.levels[id]).filter(Boolean);
}

/** Overall footprint extents and height of all visible architecture (meters). */
export function projectBounds(p: Project, levelIds?: Id[]) {
  let minX = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxZ = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const ok = (id: Id) => !levelIds || levelIds.includes(id);
  const addPt = (x: number, z: number) => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  };
  for (const w of Object.values(p.walls)) {
    if (!ok(w.levelId)) continue;
    const lv = p.levels[w.levelId];
    if (!lv) continue;
    addPt(w.start.x, w.start.z);
    addPt(w.end.x, w.end.z);
    minY = Math.min(minY, wallBase(w, lv));
    maxY = Math.max(maxY, wallTop(w, lv, p.levels));
  }
  for (const s of Object.values(p.slabs)) {
    if (!ok(s.levelId)) continue;
    const lv = p.levels[s.levelId];
    if (!lv || s.kind === 'path' || s.kind === 'drive' || s.kind === 'patio') continue;
    for (const pt of s.outline) addPt(pt.x, pt.z);
    minY = Math.min(minY, lv.elevation - (s.thickness ?? lv.slabThickness));
    maxY = Math.max(maxY, lv.elevation);
  }
  for (const r of Object.values(p.roofs)) {
    if (!ok(r.levelId)) continue;
    const lv = p.levels[r.levelId];
    if (!lv) continue;
    const hx = r.size.x / 2 + (r.ridgeAxis === 'x' ? r.rakeOverhang : r.eaveOverhang);
    const hz = r.size.z / 2 + (r.ridgeAxis === 'z' ? r.rakeOverhang : r.eaveOverhang);
    addPt(r.center.x - hx, r.center.z - hz);
    addPt(r.center.x + hx, r.center.z + hz);
    const span = r.ridgeAxis === 'x' ? r.size.z : r.size.x;
    maxY = Math.max(maxY, lv.elevation + lv.ceilingHeight + r.baseOffset + (r.kind === 'gable' ? span / 2 : span) * r.pitch);
  }
  if (!Number.isFinite(minX)) return { minX: -10, maxX: 10, minZ: -10, maxZ: 10, minY: 0, maxY: 10 };
  return { minX, maxX, minZ, maxZ, minY, maxY };
}

export type { Stair, Vec2 };

/**
 * For every wall: is the start / end point free (not buried in another wall on the same level)?
 * Joined ends are extended by half a thickness so corners close without notches.
 */
export function wallEndsFree(walls: Wall[]): Record<Id, [boolean, boolean]> {
  const out: Record<Id, [boolean, boolean]> = {};
  const byLevel: Record<Id, Wall[]> = {};
  for (const w of walls) (byLevel[w.levelId] ??= []).push(w);
  const inside = (p: Vec2, o: Wall) => {
    const { len, tx, tz, nx, nz } = wallVec(o);
    if (len < 1e-6) return false;
    const dx = p.x - o.start.x;
    const dz = p.z - o.start.z;
    const a = dx * tx + dz * tz;
    const s = dx * nx + dz * nz;
    const e = o.thickness / 2 + 1e-3;
    return a >= -e && a <= len + e && Math.abs(s) <= e;
  };
  for (const w of walls) {
    const others = (byLevel[w.levelId] ?? []).filter((o) => o.id !== w.id && o.kind !== 'rail');
    const free = (p: Vec2) => w.kind === 'rail' || !others.some((o) => inside(p, o));
    out[w.id] = [free(w.start), free(w.end)];
  }
  return out;
}
