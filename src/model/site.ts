import type { Id, Project, Vec2 } from './types';

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Ground height (meters) at world position. Grade ramps from the front level down to the walkout level. */
export function terrainHeight(p: Pick<Project, 'site' | 'levels'>, _x: number, z: number): number {
  const s = p.site;
  const front = (p.levels[s.frontLevelId]?.elevation ?? 3.05) - s.frontDrop;
  const rear = (p.levels[s.rearLevelId]?.elevation ?? 0) - s.rearDrop;
  if (z <= s.rampStartZ) return front;
  if (z >= s.rampEndZ) return rear;
  const t = (z - s.rampStartZ) / (s.rampEndZ - s.rampStartZ);
  return front + (rear - front) * smooth(t);
}

/** Footprints of the lowest level floor: the terrain is dug out under these. */
export function pitPolygons(p: Project): Vec2[][] {
  const lowest: Id | undefined = p.levelOrder[0];
  return Object.values(p.slabs)
    .filter((s) => s.levelId === lowest && s.kind === 'floor')
    .map((s) => s.outline);
}
