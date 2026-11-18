import type { UnitSystem } from './types';

export const FT = 0.3048;
export const IN = 0.0254;

export const ftToM = (ft: number) => ft * FT;
export const mToFt = (m: number) => m / FT;

/** Format a length in meters for display. */
export function formatLength(m: number, units: UnitSystem): string {
  if (!Number.isFinite(m)) return '-';
  if (units === 'metric') {
    if (Math.abs(m) >= 1) return `${(Math.round(m * 1000) / 1000).toFixed(2)} m`;
    return `${Math.round(m * 100)} cm`;
  }
  const sign = m < 0 ? '-' : '';
  let totalQuarterIn = Math.round((Math.abs(m) / IN) * 4);
  const feet = Math.floor(totalQuarterIn / 48);
  totalQuarterIn -= feet * 48;
  const inches = Math.floor(totalQuarterIn / 4);
  const quarters = totalQuarterIn % 4;
  const frac = quarters === 0 ? '' : quarters === 2 ? ' 1/2' : quarters === 1 ? ' 1/4' : ' 3/4';
  if (feet === 0) return `${sign}${inches}${frac}"`;
  if (inches === 0 && quarters === 0) return `${sign}${feet}'`;
  return `${sign}${feet}' ${inches}${frac}"`;
}

export function formatArea(m2: number, units: UnitSystem): string {
  if (units === 'metric') return `${m2.toFixed(1)} m²`;
  return `${Math.round(m2 / (FT * FT)).toLocaleString('en-US')} sf`;
}

/**
 * Parse user length input. Accepts: 12' 6", 12'6, 12 ft, 150 cm, 3.2 m, 36 in, 36".
 * Bare numbers use the current display unit (feet for imperial, meters for metric).
 * Returns null when it cannot be parsed.
 */
export function parseLength(input: string, units: UnitSystem): number | null {
  const s = input.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!s) return null;
  const num = '(-?\\d+(?:\\.\\d+)?)';
  let m: RegExpMatchArray | null;
  if ((m = s.match(new RegExp(`^${num} ?(?:m|meters?|metres?)$`)))) return parseFloat(m[1]);
  if ((m = s.match(new RegExp(`^${num} ?(?:cm)$`)))) return parseFloat(m[1]) / 100;
  if ((m = s.match(new RegExp(`^${num} ?(?:mm)$`)))) return parseFloat(m[1]) / 1000;
  // feet + inches, optional fraction in inches
  if (
    (m = s.match(
      new RegExp(`^${num} ?(?:'|ft|feet|foot)(?: ?${num}(?: (\\d+)/(\\d+))? ?(?:"|in|inch|inches)?)?$`),
    ))
  ) {
    const ft = parseFloat(m[1]);
    const inch = m[2] ? parseFloat(m[2]) : 0;
    const frac = m[3] && m[4] ? parseInt(m[3], 10) / parseInt(m[4], 10) : 0;
    const sign = ft < 0 ? -1 : 1;
    return ft * FT + sign * (inch + frac) * IN;
  }
  if ((m = s.match(new RegExp(`^${num}(?: (\\d+)/(\\d+))? ?(?:"|in|inch|inches)$`)))) {
    const frac = m[2] && m[3] ? parseInt(m[2], 10) / parseInt(m[3], 10) : 0;
    return (parseFloat(m[1]) + frac) * IN;
  }
  if ((m = s.match(new RegExp(`^${num}$`)))) {
    const v = parseFloat(m[1]);
    return units === 'imperial' ? v * FT : v;
  }
  return null;
}

export const degToRad = (d: number) => (d * Math.PI) / 180;
export const radToDeg = (r: number) => (r * 180) / Math.PI;
export function normalizeAngle(r: number): number {
  const t = Math.PI * 2;
  let a = r % t;
  if (a > Math.PI) a -= t;
  if (a <= -Math.PI) a += t;
  return a;
}
