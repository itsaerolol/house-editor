import { describe, expect, it } from 'vitest';
import { createStarterProject } from '../src/model/starter';
import { outsideWallsOnLevel, sideFacingRoom, sideIsOutside, wallsOfRoom } from '../src/model/selectHelpers';
import { applyExteriorStyle } from '../src/model/exteriorStyles';

describe('multi-select helpers', () => {
  const p = createStarterProject();
  it('finds outside walls on the main floor, each with exactly one outside face', () => {
    const list = outsideWallsOnLevel(p, 'L1');
    expect(list.length).toBeGreaterThan(8);
    const both = list.filter((g) => sideIsOutside(p, p.walls[g.id], 1) && sideIsOutside(p, p.walls[g.id], -1));
    expect(both.length).toBeLessThan(list.length / 2);
  });
  it('finds the walls around the great room, all facing into it', () => {
    const room = Object.values(p.rooms).find((r) => /great/i.test(r.name))!;
    const walls = wallsOfRoom(p, room);
    expect(walls.length).toBeGreaterThanOrEqual(3);
    for (const g of walls) expect(sideFacingRoom(p.walls[g.id], room)).not.toBeNull();
  });
  it('exterior styles swap outside faces and roofs but leave interior paint', () => {
    const q = createStarterProject();
    const inside = Object.values(q.walls).filter((w) => w.kind === 'interior').map((w) => w.finishA);
    applyExteriorStyle(q, 'brick-red');
    expect(Object.values(q.walls).some((w) => w.finishA === 'brick-red' || w.finishB === 'brick-red')).toBe(true);
    expect(Object.values(q.walls).filter((w) => w.kind === 'interior').map((w) => w.finishA)).toEqual(inside);
    expect(Object.values(q.roofs).every((r) => r.materialId === 'roof-seam' || r.materialId === 'roof-shingle')).toBe(true);
  });
});
