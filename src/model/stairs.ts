import type { Id, Level, Stair, Vec2 } from './types';

export interface StairBox {
  kind: 'tread' | 'landing';
  /** along the run and across the lanes, local meters */
  a0: number;
  a1: number;
  c0: number;
  c1: number;
  top: number;
  bottom: number;
  pair: number;
}

export function stairTotalAcross(s: Stair): number {
  return s.laneWidth * 2 + s.gap;
}

export function stairTotalAlong(s: Stair): number {
  return (s.risersPerFlight - 1) * s.treadDepth + s.landingDepth;
}

export function stairToWorld(s: Stair, along: number, across: number): Vec2 {
  return {
    x: s.origin.x + s.dir.x * along + s.side.x * across,
    z: s.origin.z + s.dir.z * along + s.side.z * across,
  };
}

export function stairToLocal(s: Stair, x: number, z: number): { along: number; across: number } {
  const dx = x - s.origin.x;
  const dz = z - s.origin.z;
  return { along: dx * s.dir.x + dz * s.dir.z, across: dx * s.side.x + dz * s.side.z };
}

/** World polygon of the stair core footprint (use it for slab holes). */
export function stairCorePolygon(s: Stair): Vec2[] {
  const A = stairTotalAlong(s);
  const C = stairTotalAcross(s);
  return [stairToWorld(s, 0, 0), stairToWorld(s, A, 0), stairToWorld(s, A, C), stairToWorld(s, 0, C)];
}

export function stairBoxes(s: Stair, levels: Record<Id, Level>): StairBox[] {
  const boxes: StairBox[] = [];
  const n = s.risersPerFlight;
  const t = s.treadDepth;
  const W = s.laneWidth;
  const C = stairTotalAcross(s);
  for (let k = 0; k + 1 < s.levelIds.length; k++) {
    const lo = levels[s.levelIds[k]];
    const hi = levels[s.levelIds[k + 1]];
    if (!lo || !hi) continue;
    const rise = (hi.elevation - lo.elevation) / (2 * n);
    const base = lo.elevation;
    for (let i = 1; i <= n - 1; i++) {
      const top = base + i * rise;
      boxes.push({ kind: 'tread', a0: (i - 1) * t, a1: i * t, c0: 0, c1: W, top, bottom: top - 0.28, pair: k });
    }
    const landTop = base + n * rise;
    boxes.push({
      kind: 'landing',
      a0: (n - 1) * t,
      a1: (n - 1) * t + s.landingDepth,
      c0: 0,
      c1: C,
      top: landTop,
      bottom: landTop - 0.3,
      pair: k,
    });
    for (let j = 1; j <= n - 1; j++) {
      const top = base + (n + j) * rise;
      boxes.push({
        kind: 'tread',
        a0: (n - 1 - j) * t,
        a1: (n - j) * t,
        c0: W + s.gap,
        c1: C,
        top,
        bottom: top - 0.28,
        pair: k,
      });
    }
  }
  return boxes;
}

export function defaultStairParams() {
  return { laneWidth: 1.0, gap: 0.15, treadDepth: 0.28, landingDepth: 1.1, risersPerFlight: 8 };
}
