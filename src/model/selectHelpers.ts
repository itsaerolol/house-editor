import { wallVec } from './arch';
import { pointInPoly } from './physics';
import type { Id, Project, Room, Selection, Wall } from './types';

/** True when side sgn (+1 = side A, -1 = side B) of a wall faces no room on its level, i.e. it is an outside face. */
export function sideIsOutside(p: Project, w: Wall, sgn: 1 | -1): boolean {
  const { nx, nz } = wallVec(w);
  const off = w.thickness / 2 + 0.25;
  const x = (w.start.x + w.end.x) / 2 + nx * off * sgn;
  const z = (w.start.z + w.end.z) / 2 + nz * off * sgn;
  return !Object.values(p.rooms).some((r) => r.levelId === w.levelId && pointInPoly(x, z, r.outline));
}

/** The side of a wall that faces into a given room, or null if the wall does not bound it. */
export function sideFacingRoom(w: Wall, room: Room): 1 | -1 | null {
  const { nx, nz } = wallVec(w);
  const off = w.thickness / 2 + 0.25;
  const mx = (w.start.x + w.end.x) / 2;
  const mz = (w.start.z + w.end.z) / 2;
  if (pointInPoly(mx + nx * off, mz + nz * off, room.outline)) return 1;
  if (pointInPoly(mx - nx * off, mz - nz * off, room.outline)) return -1;
  return null;
}

const wallSel = (id: Id): Selection => ({ kind: 'wall', id });

export function wallsOnLevel(p: Project, levelId: Id, filter: (w: Wall) => boolean = () => true): Selection[] {
  return Object.values(p.walls)
    .filter((w) => w.levelId === levelId && !w.hidden && w.kind !== 'rail' && filter(w))
    .map((w) => wallSel(w.id));
}

export function outsideWallsOnLevel(p: Project, levelId: Id): Selection[] {
  return wallsOnLevel(p, levelId, (w) => w.kind === 'exterior');
}

/** Walls that bound a room: some part of the wall touches the room's interior on one side. */
export function wallsOfRoom(p: Project, room: Room): Selection[] {
  return Object.values(p.walls)
    .filter((w) => w.levelId === room.levelId && w.kind !== 'rail' && !w.hidden && boundsRoom(w, room))
    .map((w) => wallSel(w.id));
}

function boundsRoom(w: Wall, room: Room): boolean {
  const { nx, nz, len } = wallVec(w);
  const off = w.thickness / 2 + 0.25;
  // sample along the wall so long walls that only partly bound the room still count
  const n = Math.max(1, Math.ceil(len / 0.6));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const x = w.start.x + (w.end.x - w.start.x) * t;
    const z = w.start.z + (w.end.z - w.start.z) * t;
    if (pointInPoly(x + nx * off, z + nz * off, room.outline) || pointInPoly(x - nx * off, z - nz * off, room.outline)) return true;
  }
  return false;
}
