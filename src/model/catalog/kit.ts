import { FT } from '../units';

/**
 * Pure-data modeling kit for catalog items. Parts are plain objects (no Three.js) that the render
 * layer turns into geometry. Every part is placed in item space: origin at the bottom centre of the
 * footprint, +y up, +z toward the item's front.
 */

export type Vec3 = [number, number, number];

/** User slots (overridable) and fixed slots (each maps to one built-in material). */
export type Slot =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'metal'
  | 'glass'
  | 'glow'
  | 'fire'
  | 'foliage'
  | 'bark'
  | 'screen'
  | 'chrome'
  | 'rubber'
  | 'soil'
  | 'paper'
  | 'shade'
  | 'plastic'
  | 'leaf'
  | 'leafdark'
  | 'needle'
  | 'amber'
  | 'ceramic'
  | 'cloth'
  | 'mirror'
  | 'water'
  | 'ember'
  | 'brass';

interface Base {
  slot: Slot;
  /** position of the part's local origin */
  p: Vec3;
  /** Euler rotation XYZ in radians, applied before translation */
  r?: Vec3;
  /** vertex colour multiplier (0..1.5 per channel), for variation within one material */
  tint?: Vec3;
  /** extra rotation about world Y (through p), applied after r: used to turn whole groups */
  yaw?: number;
  /** map the texture once across the part's footprint (rugs, art, labels) */
  uvFit?: boolean;
  /** run the texture grain vertically on side faces (stiles, doors, legs) */
  gv?: boolean;
  /** Euler order for r (default XYZ, leaves YXZ) */
  ro?: 'XYZ' | 'YXZ' | 'ZXY' | 'ZYX' | 'XZY' | 'YZX';
}

export type Part =
  /** primitives scaled to z (cyl and cone: x,z diameters, y height). taper: top/bottom radius ratio for cyl */
  | (Base & { s: 'box' | 'cyl' | 'sph' | 'cone'; z: Vec3; taper?: number; seg?: number })
  /** box with rounded edges of radius rad */
  | (Base & { s: 'rbox'; z: Vec3; rad: number })
  /** upholstered cushion: rounded box whose faces bulge by puff (m) and sag slightly in the middle */
  | (Base & { s: 'cushion'; z: Vec3; rad: number; puff: number; sag?: number })
  /** surface of revolution around local y; prof = [radius, y] from bottom to top. sx/sz stretch it */
  | (Base & { s: 'lathe'; prof: [number, number][]; seg?: number; sx?: number; sz?: number; arc?: number; phi0?: number })
  /** swept circle along a path (local coordinates). cr rounds polyline corners; smooth uses a spline */
  | (Base & { s: 'tube'; path: Vec3[]; rad: number; cr?: number; smooth?: boolean; closed?: boolean; rs?: number; flat?: number; ts?: number })
  /** torus in the local XY plane; arc in radians */
  | (Base & { s: 'torus'; R: number; rad: number; arc?: number })
  /** polygon in local XY extruded along z, centred on z=0 */
  | (Base & { s: 'ext'; shape: [number, number][]; holes?: [number, number][][]; depth: number; bevel?: number; curveSeg?: number })
  /** loft between two closed outlines (same point count) in XZ at heights y0 and y1; inner outlines (optional) make a hollow shell with a rim */
  | (Base & { s: 'loft'; bot: [number, number][]; top: [number, number][]; y0: number; y1: number; inBot?: [number, number][]; inTop?: [number, number][]; rings?: number })
  /** a single leaf blade growing along local +y, face toward +z. fold: V crease (rad); droop: tip bend (rad) */
  | (Base & {
      s: 'leaf';
      len: number;
      wid: number;
      shape?: 'lance' | 'oval' | 'heart' | 'strap' | 'needle' | 'fan' | 'split' | 'fiddle' | 'round' | 'spray';
      fold?: number;
      droop?: number;
      curl?: number;
      twist?: number;
      seg?: number;
    })
  /** noisy ellipsoid for foliage masses, stones and soil */
  | (Base & { s: 'blob'; z: Vec3; seed: number; rough?: number; detail?: number; flatBottom?: boolean });

export const f = (feet: number) => feet * FT;
export const inch = (n: number) => (n * FT) / 12;
export const sz = (w: number, d: number, h: number) => ({ w: f(w), d: f(d), h: f(h) });

export const box = (x: number, y: number, z: number, sx: number, sy: number, sz: number, slot: Slot, extra: Partial<Base> = {}): Part => ({ s: 'box', p: [x, y, z], z: [sx, sy, sz], slot, ...extra });
export const cyl = (x: number, y: number, z: number, dx: number, sy: number, dz: number, slot: Slot, extra: Partial<Base> & { taper?: number; seg?: number } = {}): Part => ({ s: 'cyl', p: [x, y, z], z: [dx, sy, dz], slot, ...extra });
export const sph = (x: number, y: number, z: number, dx: number, dy: number, dz: number, slot: Slot, extra: Partial<Base> = {}): Part => ({ s: 'sph', p: [x, y, z], z: [dx, dy, dz], slot, ...extra });
export const cone = (x: number, y: number, z: number, dx: number, sy: number, dz: number, slot: Slot, extra: Partial<Base> = {}): Part => ({ s: 'cone', p: [x, y, z], z: [dx, sy, dz], slot, ...extra });
export const rbox = (x: number, y: number, z: number, sx: number, sy: number, sz: number, rad: number, slot: Slot, extra: Partial<Base> = {}): Part => ({ s: 'rbox', p: [x, y, z], z: [sx, sy, sz], rad, slot, ...extra });
export const cushion = (x: number, y: number, z: number, sx: number, sy: number, sz: number, rad: number, puff: number, slot: Slot, extra: Partial<Base> & { sag?: number } = {}): Part => ({ s: 'cushion', p: [x, y, z], z: [sx, sy, sz], rad, puff, slot, ...extra });
export const lathe = (x: number, y: number, z: number, prof: [number, number][], slot: Slot, extra: Partial<Base> & { seg?: number; sx?: number; sz?: number; arc?: number; phi0?: number } = {}): Part => ({ s: 'lathe', p: [x, y, z], prof, slot, ...extra });
export const tube = (path: Vec3[], rad: number, slot: Slot, extra: Partial<Base> & { cr?: number; smooth?: boolean; closed?: boolean; rs?: number; flat?: number; ts?: number } = {}): Part => ({ s: 'tube', p: [0, 0, 0], path, rad, slot, ...extra });
export const torus = (x: number, y: number, z: number, R: number, rad: number, slot: Slot, extra: Partial<Base> & { arc?: number } = {}): Part => ({ s: 'torus', p: [x, y, z], R, rad, slot, ...extra });
export const ext = (x: number, y: number, z: number, shape: [number, number][], depth: number, slot: Slot, extra: Partial<Base> & { holes?: [number, number][][]; bevel?: number; curveSeg?: number } = {}): Part => ({ s: 'ext', p: [x, y, z], shape, depth, slot, ...extra });
export const blob = (x: number, y: number, z: number, sx: number, sy: number, sz: number, seed: number, slot: Slot, extra: Partial<Base> & { rough?: number; detail?: number; flatBottom?: boolean } = {}): Part => ({ s: 'blob', p: [x, y, z], z: [sx, sy, sz], seed, slot, ...extra });

/** Leaf with its base at p, pointing along yaw (around y, 0 = +z) and pitch (0 = straight up, pi/2 = horizontal). */
export function leafAt(
  p: Vec3,
  yaw: number,
  pitch: number,
  len: number,
  wid: number,
  slot: Slot,
  extra: Partial<Extract<Part, { s: 'leaf' }>> = {},
): Part {
  // Euler YXZ with a negative pitch: yaw 0 points +z, pitch tips it outward, the face looks up and droop bends the tip down
  return { s: 'leaf', p, r: [-pitch, yaw + Math.PI, 0], len, wid, slot, ...extra } as Part;
}

/** Deterministic PRNG so every rebuild of an item is identical. */
export function rand(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Shift a set of parts. */
export function moved(parts: Part[], dx: number, dy: number, dz: number): Part[] {
  return parts.map((p) => {
    if (p.s === 'tube') return { ...p, path: p.path.map(([x, y, z]) => [x + dx, y + dy, z + dz] as Vec3) };
    return { ...p, p: [p.p[0] + dx, p.p[1] + dy, p.p[2] + dz] as Vec3 };
  });
}

/** Mirror a set of parts across x = 0 (for symmetric pieces). */
export function mirrorX(parts: Part[]): Part[] {
  return parts.map((p) => {
    if (p.s === 'tube') return { ...p, path: p.path.map(([x, y, z]) => [-x, y, z] as Vec3) };
    const r = p.r ? ([p.r[0], -p.r[1], -p.r[2]] as Vec3) : undefined;
    return { ...p, p: [-p.p[0], p.p[1], p.p[2]] as Vec3, r };
  });
}

/** Rounded-rectangle outline (for ext parts). */
export function roundRect(w: number, h: number, r: number, seg = 5): [number, number][] {
  const pts: [number, number][] = [];
  const rr = Math.min(r, w / 2, h / 2);
  const corners: [number, number, number][] = [
    [w / 2 - rr, h / 2 - rr, 0],
    [-w / 2 + rr, h / 2 - rr, Math.PI / 2],
    [-w / 2 + rr, -h / 2 + rr, Math.PI],
    [w / 2 - rr, -h / 2 + rr, (3 * Math.PI) / 2],
  ];
  for (const [cx, cy, a0] of corners) for (let i = 0; i <= seg; i++) {
    const a = a0 + (i / seg) * (Math.PI / 2);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return pts;
}

/** Ellipse / circle outline. */
export function ellipse(rx: number, ry: number, n = 32, cx = 0, cy = 0): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return pts;
}

/** Superellipse ("squircle") outline, e.g. for a soft rectangular basin. */
export function squircle(rx: number, ry: number, k = 4, n = 48): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    pts.push([Math.sign(c) * Math.abs(c) ** (2 / k) * rx, Math.sign(s) * Math.abs(s) ** (2 / k) * ry]);
  }
  return pts;
}

/** Euler XYZ that rotates local +y onto the direction (dx,dy,dz). */
export function eulerFromY(dx: number, dy: number, dz: number): Vec3 {
  const l = Math.hypot(dx, dy, dz) || 1;
  const ux = dx / l;
  const uy = dy / l;
  const uz = dz / l;
  // axis = y x u = (uz, 0, -ux)
  let ax = uz;
  let az = -ux;
  const al = Math.hypot(ax, az);
  const ang = Math.acos(Math.max(-1, Math.min(1, uy)));
  if (al < 1e-9) return uy > 0 ? [0, 0, 0] : [Math.PI, 0, 0];
  ax /= al;
  az /= al;
  const s = Math.sin(ang / 2);
  const x = ax * s;
  const y = 0;
  const z = az * s;
  const w = Math.cos(ang / 2);
  const m11 = 1 - 2 * (y * y + z * z);
  const m12 = 2 * (x * y - z * w);
  const m13 = 2 * (x * z + y * w);
  const m22 = 1 - 2 * (x * x + z * z);
  const m23 = 2 * (y * z - x * w);
  const m32 = 2 * (y * z + x * w);
  const m33 = 1 - 2 * (x * x + y * y);
  const ey = Math.asin(Math.max(-1, Math.min(1, m13)));
  if (Math.abs(m13) < 0.9999999) return [Math.atan2(-m23, m33), ey, Math.atan2(-m12, m11)];
  return [Math.atan2(m32, m22), ey, 0];
}

/** Square-section member (rounded edges) running from a to b. t1 along local x, t2 along local z. */
export function beam(a: Vec3, b: Vec3, t1: number, t2: number, slot: Slot, rad = 0.004, extra: Partial<Base> = {}): Part {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  return { s: 'rbox', p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], z: [t1, len, t2], rad, r: eulerFromY(dx, dy, dz), slot, ...extra };
}

/** Round rod from a to b. */
export function rod(a: Vec3, b: Vec3, dia: number, slot: Slot, extra: Partial<Base> & { taper?: number; seg?: number } = {}): Part {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  return { s: 'cyl', p: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], z: [dia, len, dia], r: eulerFromY(dx, dy, dz), slot, ...extra };
}

/** Closed welting loop around a w x d rectangle (local XZ plane), centred on p, optionally rotated. */
export function welt(p: Vec3, w: number, d: number, rad: number, slot: Slot, cr = 0.03, r?: Vec3): Part {
  const hw = w / 2;
  const hd = d / 2;
  return { s: 'tube', p, r, path: [[-hw, 0, -hd], [hw, 0, -hd], [hw, 0, hd], [-hw, 0, hd], [-hw, 0, -hd], [hw, 0, -hd]], rad, cr, slot };
}

/** A row of books standing on a shelf at y, spanning x0..x1 along x, spines facing +z at zFront. */
export function bookRow(x0: number, x1: number, y: number, zFront: number, depth: number, maxH: number, seed: number, slot: Slot = 'paper'): Part[] {
  const rnd = rand(seed);
  const parts: Part[] = [];
  const palette: Vec3[] = [
    [0.55, 0.22, 0.16],
    [0.2, 0.28, 0.24],
    [0.82, 0.76, 0.64],
    [0.18, 0.2, 0.28],
    [0.62, 0.45, 0.24],
    [0.3, 0.3, 0.3],
    [0.9, 0.88, 0.82],
    [0.42, 0.18, 0.2],
  ];
  let x = x0;
  while (x < x1 - 0.015) {
    const t = Math.min(x1 - x, 0.016 + rnd() * 0.03);
    const hh = maxH * (0.72 + rnd() * 0.28);
    const dd = depth * (0.82 + rnd() * 0.18);
    const lean = x > x1 - 0.06 && rnd() > 0.5 ? 0.12 : 0;
    parts.push(box(x + t / 2, y + hh / 2, zFront - dd / 2, t - 0.0015, hh, dd, slot, { tint: palette[Math.floor(rnd() * palette.length)], r: [0, 0, -lean] }));
    x += t;
    if (rnd() > 0.86) x += 0.02 + rnd() * 0.04;
  }
  return parts;
}

/** Vertical flutes (half-round reeds) across a panel face. */
export function flutes(x0: number, x1: number, y0: number, y1: number, z: number, pitch: number, slot: Slot): Part[] {
  const parts: Part[] = [];
  const n = Math.max(1, Math.round((x1 - x0) / pitch));
  const p = (x1 - x0) / n;
  // dark recess behind, then rounded slats with visible gaps
  parts.push(box((x0 + x1) / 2, (y0 + y1) / 2, z - p * 0.32, x1 - x0, y1 - y0, 0.004, slot, { tint: [0.32, 0.28, 0.26] }));
  for (let i = 0; i < n; i++) parts.push(cyl(x0 + p * (i + 0.5), (y0 + y1) / 2, z, p * 0.76, y1 - y0, p * 0.6, slot, { seg: 12 }));
  return parts;
}

/**
 * Dry-stacked ledgestone veneer over a rectangle in a plane. axis 'z': face at z, spanning x0..x1, y0..y1, stones protrude toward +z*dir.
 * axis 'x': face at x, spanning z0..z1 (passed as x0..x1). Holes are skipped. Returns stones plus a dark mortar backer.
 */
export function ledgestone(
  axis: 'x' | 'z',
  plane: number,
  dir: 1 | -1,
  a0: number,
  a1: number,
  y0: number,
  y1: number,
  seed: number,
  slot: Slot,
  holes: [number, number, number, number][] = [],
): Part[] {
  const rnd = rand(seed);
  const parts: Part[] = [];
  const mk = (a: number, y: number, len: number, hgt: number, t: number, tint: Vec3) =>
    axis === 'z'
      ? box(a, y, plane + (dir * t) / 2, len, hgt, t, slot, { tint })
      : box(plane + (dir * t) / 2, y, a, t, hgt, len, slot, { tint });
  // mortar backer, cut around the holes
  for (const [r0, r1, ry0, ry1] of subtractRects([a0, a1, y0, y1], holes)) parts.push(mk((r0 + r1) / 2, (ry0 + ry1) / 2, r1 - r0, ry1 - ry0, 0.012, [0.42, 0.4, 0.38]));
  let y = y0;
  let row = 0;
  while (y < y1 - 0.02) {
    const rh = Math.min(y1 - y, 0.045 + rnd() * 0.07);
    let a = a0 - (row % 2 ? rnd() * 0.12 : 0);
    while (a < a1 - 0.01) {
      const len = 0.12 + rnd() * 0.34;
      const s0 = Math.max(a, a0);
      const s1 = Math.min(a + len, a1);
      const yc = y + rh / 2;
      const inHole = holes.some(([h0, h1, hy0, hy1]) => s1 > h0 && s0 < h1 && yc > hy0 && yc < hy1);
      if (!inHole && s1 - s0 > 0.02) {
        const t = 0.022 + rnd() * 0.03;
        const k = 0.78 + rnd() * 0.4;
        const warm = rnd() * 0.08;
        parts.push(mk((s0 + s1) / 2, yc, s1 - s0 - 0.007, rh - 0.007, t, [k + warm, k, k - warm * 0.6]));
      }
      a += len;
    }
    y += rh;
    row++;
  }
  return parts;
}

/** Axis-aligned rectangle [a0,a1,y0,y1] minus holes, as a list of rectangles (band decomposition). */
export function subtractRects(r: [number, number, number, number], holes: [number, number, number, number][]): [number, number, number, number][] {
  const [a0, a1, y0, y1] = r;
  const ys = new Set<number>([y0, y1]);
  for (const [, , hy0, hy1] of holes) {
    if (hy0 > y0 && hy0 < y1) ys.add(hy0);
    if (hy1 > y0 && hy1 < y1) ys.add(hy1);
  }
  const yl = [...ys].sort((p, q) => p - q);
  const out: [number, number, number, number][] = [];
  for (let i = 0; i + 1 < yl.length; i++) {
    const b0 = yl[i];
    const b1 = yl[i + 1];
    const mid = (b0 + b1) / 2;
    const cuts = holes.filter(([, , hy0, hy1]) => mid > hy0 && mid < hy1).map(([h0, h1]) => [Math.max(a0, h0), Math.min(a1, h1)] as [number, number]).filter(([p, q]) => q > p).sort((p, q) => p[0] - q[0]);
    let a = a0;
    for (const [c0, c1] of cuts) {
      if (c0 > a + 1e-4) out.push([a, c0, b0, b1]);
      a = Math.max(a, c1);
    }
    if (a1 > a + 1e-4) out.push([a, a1, b0, b1]);
  }
  return out;
}

/** Rotate a group of parts about the x axis through pivot. Parts may only carry an x rotation themselves. */
export function rotateX(parts: Part[], ang: number, pivot: Vec3): Part[] {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const rot = ([x, y, z]: Vec3): Vec3 => {
    const dy = y - pivot[1];
    const dz = z - pivot[2];
    return [x, pivot[1] + dy * c - dz * s, pivot[2] + dy * s + dz * c];
  };
  return parts.map((p) => {
    if (p.s === 'tube' && !p.r && p.p[0] === 0 && p.p[1] === 0 && p.p[2] === 0) return { ...p, path: p.path.map(rot) };
    const r: Vec3 = p.r ? [p.r[0] + ang, p.r[1], p.r[2]] : [ang, 0, 0];
    return { ...p, p: rot(p.p), r };
  });
}

/** Outline of a band of thickness t around a 2D centreline (for bent flat bar). */
export function bandAround(pts: [number, number][], t: number): [number, number][] {
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    let nx = -(b[1] - a[1]);
    let ny = b[0] - a[0];
    const l = Math.hypot(nx, ny) || 1;
    nx /= l;
    ny /= l;
    left.push([pts[i][0] + (nx * t) / 2, pts[i][1] + (ny * t) / 2]);
    right.push([pts[i][0] - (nx * t) / 2, pts[i][1] - (ny * t) / 2]);
  }
  return [...left, ...right.reverse()];
}

/** Quadratic bezier sampled into points. */
export function bez(a: [number, number], c: [number, number], b: [number, number], n = 16): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
  }
  return out;
}

/** Live-edge slab outline (top view, local XY = world X,-Z). */
export function liveEdge(w: number, d: number, seed: number, amp = 0.025, n = 28): [number, number][] {
  const rnd = rand(seed);
  const pts: [number, number][] = [];
  const ph1 = rnd() * 6;
  const ph2 = rnd() * 6;
  const wob = (x: number, ph: number) => amp * (Math.sin(x * 3.1 + ph) * 0.6 + Math.sin(x * 7.3 + ph * 2) * 0.3 + (rnd() - 0.5) * 0.2);
  for (let i = 0; i <= n; i++) {
    const x = -w / 2 + (w * i) / n;
    pts.push([x, -d / 2 + wob(x, ph1) - amp * 0.4 * Math.cos((x / w) * Math.PI)]);
  }
  for (let i = n; i >= 0; i--) {
    const x = -w / 2 + (w * i) / n;
    pts.push([x, d / 2 + wob(x, ph2) + amp * 0.3 * Math.cos((x / w) * Math.PI)]);
  }
  return pts;
}

/** Profile (radius, y) for a shell wall of thickness t rising from y0 to y1 with a rounded rim; radius r0 at the bottom, r1 at the top. */
export function shellProfile(r0: number, r1: number, y0: number, y1: number, t: number): [number, number][] {
  const rim: [number, number][] = [];
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * Math.PI;
    rim.push([r1 - t / 2 + (Math.cos(a) * t) / 2, y1 + (Math.sin(a) * t) / 2]);
  }
  return [[r0 - t, y0], [r0, y0], [(r0 + r1) / 2 + t * 0.4, (y0 + y1) / 2], ...rim, [(r0 + r1) / 2 - t * 0.6, (y0 + y1) / 2], [r0 - t, y0 + 0.001]];
}

/** Rotate a group of parts about the vertical axis through pivot (exact, composes with each part's own rotation). */
export function rotateY(parts: Part[], ang: number, pivot: [number, number] = [0, 0]): Part[] {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const rot = (x: number, z: number): [number, number] => {
    const dx = x - pivot[0];
    const dz = z - pivot[1];
    return [pivot[0] + dx * c + dz * s, pivot[1] - dx * s + dz * c];
  };
  return parts.map((p) => {
    if (p.s === 'tube' && p.p[0] === 0 && p.p[1] === 0 && p.p[2] === 0 && !p.r) {
      return { ...p, path: p.path.map(([x, y, z]) => { const [nx, nz] = rot(x, z); return [nx, y, nz] as Vec3; }) };
    }
    const [nx, nz] = rot(p.p[0], p.p[2]);
    return { ...p, p: [nx, p.p[1], nz] as Vec3, yaw: (p.yaw ?? 0) + ang };
  });
}

/** Loft between two plan outlines (same number of points). Optional inner outlines make a hollow shell open at the top. */
export function loft(x: number, z: number, bot: [number, number][], top: [number, number][], y0: number, y1: number, slot: Slot, extra: Partial<Base> & { inBot?: [number, number][]; inTop?: [number, number][]; rings?: number } = {}): Part {
  return { s: 'loft', p: [x, 0, z], bot, top, y0, y1, slot, ...extra } as Part;
}
