import { wallClearHeight, wallLength } from './arch';
import type { Id, Level, Opening, Wall } from './types';

const defaultFmt = (m: number) => `${m.toFixed(2)} m`;

export const MIN_OPENING_GAP = 0.02;

/**
 * Validate an opening against its host wall and the other openings on that wall.
 * Returns a list of human readable problems; empty = valid.
 */
export function validateOpening(
  op: Opening,
  wall: Wall | undefined,
  level: Level | undefined,
  levels: Record<Id, Level>,
  others: Opening[],
  fmt: (m: number) => string = defaultFmt,
): string[] {
  const errors: string[] = [];
  if (!wall) return [`Host wall "${op.wallId}" does not exist`];
  if (!level) return [`Host wall's level does not exist`];
  const nums: [string, number][] = [
    ['offset', op.offset],
    ['width', op.width],
    ['height', op.height],
    ['sill', op.sill],
  ];
  for (const [k, v] of nums) if (!Number.isFinite(v)) errors.push(`${k} must be a number`);
  if (errors.length) return errors;
  if (op.width <= 0) errors.push('Width must be greater than 0');
  if (op.height <= 0) errors.push('Height must be greater than 0');
  if (op.sill < 0) errors.push('Sill height cannot be negative');
  if (op.offset < 0) errors.push('Opening starts before the wall start');
  const L = wallLength(wall);
  if (op.offset + op.width > L + 1e-6)
    errors.push(`Opening ends ${fmt(op.offset + op.width - L)} past the end of the wall (wall length ${fmt(L)})`);
  const H = wallClearHeight(wall, level, levels);
  if (op.sill + op.height > H + 1e-6)
    errors.push(`Opening top (${fmt(op.sill + op.height)}) is above the wall height (${fmt(H)})`);
  for (const o of others) {
    if (o.id === op.id || o.wallId !== op.wallId) continue;
    const a0 = Math.max(op.offset, o.offset);
    const a1 = Math.min(op.offset + op.width, o.offset + o.width);
    if (a1 - a0 > -MIN_OPENING_GAP) {
      const v0 = Math.max(op.sill, o.sill);
      const v1 = Math.min(op.sill + op.height, o.sill + o.height);
      if (v1 - v0 > 0) errors.push(`Overlaps another opening on this wall (${o.name ?? o.id})`);
    }
  }
  return errors;
}

export function validateWall(w: Wall): string[] {
  const errors: string[] = [];
  if (!(w.thickness > 0)) errors.push('Thickness must be greater than 0');
  if (wallLength(w) < 0.05) errors.push('Wall length must be at least 5 cm');
  if (w.height !== null && !(w.height > 0)) errors.push('Height must be greater than 0');
  return errors;
}
