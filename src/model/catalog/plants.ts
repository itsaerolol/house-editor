import { type Part, type Slot, type Vec3, blob, box, cyl, lathe, leafAt, rand, rbox, sph, tube } from './kit';

/** Point along a polyline path at parameter t (0..1, by segment count). */
export function along(path: Vec3[], t: number): Vec3 {
  const n = path.length - 1;
  const f = Math.min(n - 1e-6, Math.max(0, t * n));
  const i = Math.floor(f);
  const k = f - i;
  const a = path[i];
  const b = path[i + 1];
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

/** Tapered pot with a rolled rim and soil, returns parts and the soil height. */
export function pot(x: number, z: number, r: number, h: number, slot: Slot, seed: number, style: 'taper' | 'cylinder' | 'bowl' = 'taper'): { parts: Part[]; soilY: number } {
  const prof: [number, number][] =
    style === 'bowl'
      ? [[0, 0], [r * 0.55, 0], [r * 0.6, 0.01], [r * 0.92, h * 0.45], [r, h * 0.85], [r, h], [r * 0.93, h], [r * 0.9, h - 0.03], [0, h - 0.03]]
      : style === 'cylinder'
        ? [[0, 0], [r * 0.96, 0], [r, 0.012], [r, h], [r * 0.93, h], [r * 0.93, h - 0.03], [0, h - 0.03]]
        : [[0, 0], [r * 0.7, 0], [r * 0.72, 0.012], [r, h - 0.02], [r * 1.03, h - 0.012], [r * 1.03, h], [r * 0.95, h], [r * 0.93, h - 0.03], [0, h - 0.03]];
  const soilY = h - 0.035;
  return {
    parts: [
      lathe(x, 0, z, prof, slot, { seg: 40 }),
      blob(x, soilY, z, r * 1.8, 0.03, r * 1.8, seed, 'soil', { rough: 0.35, flatBottom: true, detail: 2 }),
    ],
    soilY,
  };
}

/** Fiddle-leaf fig: three slender trunks rising from the pot, short side branches, big violin leaves clustered on the upper half. */
export function fiddleLeafFig(w: number, d: number, h: number, seed = 3, potSlot: Slot = 'primary'): Part[] {
  const rnd = rand(seed);
  const r = Math.min(w, d) * 0.3;
  const potH = h * 0.24;
  const { parts, soilY } = pot(0, 0, r, potH, potSlot, seed);
  const leafLen = Math.min(0.27, h * 0.18);
  const green = (): Vec3 => {
    const k = 0.55 + rnd() * 0.45;
    return [k * (0.8 + rnd() * 0.2), k * (0.92 + rnd() * 0.12), k * (0.7 + rnd() * 0.15)];
  };
  const trunks = 3;
  // single stem to a split point, then three leaders
  const split: Vec3 = [0.01, soilY + (h - soilY) * 0.33, 0.0];
  parts.push(tube([[0, soilY, 0], [0.006, soilY + (split[1] - soilY) * 0.5, 0], split], 0.0085, 'bark', { smooth: true, rs: 8, tint: [1.25, 1.3, 1.0] }));
  for (let t = 0; t < trunks; t++) {
    const a0 = (t / trunks) * Math.PI * 2 + rnd() * 0.6;
    const lean = 0.3 + rnd() * 0.2;
    const top = h * (0.84 + rnd() * 0.16);
    const base: Vec3 = split;
    const path: Vec3[] = [
      base,
      [base[0] + Math.cos(a0) * lean * 0.25, base[1] + (top - base[1]) * 0.3, base[2] + Math.sin(a0) * lean * 0.25],
      [base[0] + Math.cos(a0) * lean * 0.55 + (rnd() - 0.5) * 0.03, base[1] + (top - base[1]) * 0.68, base[2] + Math.sin(a0) * lean * 0.55],
      [base[0] + Math.cos(a0) * lean * 0.7, top, base[2] + Math.sin(a0) * lean * 0.7],
    ];
    parts.push(tube(path, 0.0065 + rnd() * 0.002, 'bark', { smooth: true, rs: 7, tint: [1.25, 1.3, 1.0] }));
    // leaves spiralling up the upper part of each trunk
    const nodes = 13 + Math.floor(rnd() * 4);
    for (let k = 0; k < nodes; k++) {
      const u = 0.12 + (k / nodes) * 0.88;
      const p = along(path, u);
      const yaw = a0 + k * 2.4 + rnd() * 0.5;
      const pitch = (u > 0.85 ? 0.35 : 0.75) + (1 - u) * 0.6 + rnd() * 0.4;
      const len = leafLen * (0.7 + rnd() * 0.45) * (u > 0.92 ? 0.65 : 1);
      const tn = green();
      if (u > 0.85) { tn[0] *= 1.45; tn[1] *= 1.4; }
      parts.push(leafAt(p, yaw, pitch, len, len * 0.86, 'leaf', { shape: 'fiddle', fold: 0.14, droop: 0.3 + rnd() * 0.35, curl: (rnd() - 0.5) * 0.4, twist: (rnd() - 0.5) * 0.5, tint: tn }));
    }
    // two short side branches with their own leaf clusters
    for (let b = 0; b < 2; b++) {
      const u = 0.5 + b * 0.18 + rnd() * 0.05;
      const p0 = along(path, u);
      const ya = a0 + (b ? 2.2 : -2.0) + rnd() * 0.5;
      const bl = 0.12 + rnd() * 0.08;
      const p1: Vec3 = [p0[0] + Math.cos(ya) * bl, p0[1] + bl * 0.9, p0[2] + Math.sin(ya) * bl];
      parts.push(tube([p0, [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2 + 0.01, (p0[2] + p1[2]) / 2], p1], 0.0045, 'bark', { smooth: true, rs: 6, tint: [1.25, 1.3, 1.0] }));
      for (let k = 0; k < 5; k++) {
        const q = along([p0, p1], 0.35 + k * 0.16);
        parts.push(leafAt(q, ya + (k % 2 ? 1.1 : -1.1) + rnd() * 0.4, 0.7 + rnd() * 0.5, leafLen * (0.65 + rnd() * 0.35), leafLen * 0.6, 'leaf', { shape: 'fiddle', fold: 0.14, droop: 0.4, curl: (rnd() - 0.5) * 0.4, tint: green() }));
      }
      parts.push(leafAt(p1, ya, 0.25, leafLen * 0.55, leafLen * 0.3, 'leaf', { shape: 'fiddle', fold: 0.3, droop: 0.2, tint: green() }));
    }
  }
  return parts;
}

/** Snake plant: stiff upright strap leaves with banding, in a cylinder pot. */
export function snakePlant(w: number, d: number, h: number, seed = 8, potSlot: Slot = 'primary'): Part[] {
  const rnd = rand(seed);
  const r = Math.min(w, d) * 0.4;
  const { parts, soilY } = pot(0, 0, r, h * 0.3, potSlot, seed, 'cylinder');
  for (let i = 0; i < 14; i++) {
    const a = rnd() * Math.PI * 2;
    const rr = rnd() * r * 0.6;
    const len = (h - soilY) * (0.55 + rnd() * 0.45);
    parts.push(leafAt([Math.cos(a) * rr, soilY, Math.sin(a) * rr], a, 0.05 + rnd() * 0.2, len, len * 0.13, 'foliage', { shape: 'lance', fold: 0.5, droop: 0.05, twist: (rnd() - 0.5) * 1.2, tint: [0.75 + rnd() * 0.3, 1.0 + rnd() * 0.3, 0.6] }));
  }
  return parts;
}

/** Distance from origin o along unit dir u to where it leaves the ellipsoid (centre c, full size r); -1 if it misses. */
function exitT(o: Vec3, u: Vec3, c: Vec3, r: Vec3): number {
  const ox = (o[0] - c[0]) / (r[0] / 2);
  const oy = (o[1] - c[1]) / (r[1] / 2);
  const oz = (o[2] - c[2]) / (r[2] / 2);
  const ux = u[0] / (r[0] / 2);
  const uy = u[1] / (r[1] / 2);
  const uz = u[2] / (r[2] / 2);
  const A = ux * ux + uy * uy + uz * uz;
  const B = 2 * (ox * ux + oy * uy + oz * uz);
  const C = ox * ox + oy * oy + oz * oz - 1;
  const disc = B * B - 4 * A * C;
  if (disc < 0) return -1;
  return (-B + Math.sqrt(disc)) / (2 * A);
}

/** Leafy shrub (boxwood style): a dark inner mass, a skin of small leaf rosettes on the outer envelope, lighter sprigs out of the top. */
export function shrub(w: number, d: number, h: number, seed = 11, opts: { leaf?: number; clumps?: number; tintBase?: Vec3; shape?: 'round' | 'lance' | 'oval'; density?: number } = {}): Part[] {
  const rnd = rand(seed);
  const parts: Part[] = [];
  const nc = opts.clumps ?? 6;
  const tb = opts.tintBase ?? [0.9, 0.95, 0.8];
  const centres: { c: Vec3; r: Vec3 }[] = [];
  for (let i = 0; i < nc; i++) {
    const a = (i / nc) * Math.PI * 2 + rnd();
    const rr = i === 0 ? 0 : 0.16 + rnd() * 0.08;
    const c: Vec3 = [Math.cos(a) * rr * w, h * (0.5 + rnd() * 0.05) - (i === 0 ? 0 : h * 0.08), Math.sin(a) * rr * d];
    const s2: Vec3 = [w * (0.66 + rnd() * 0.1), h * (0.86 + rnd() * 0.1), d * (0.66 + rnd() * 0.1)];
    centres.push({ c, r: s2 });
    // core, kept inside the leaf skin
    parts.push(blob(c[0], c[1], c[2], s2[0] * 0.86, s2[1] * 0.86, s2[2] * 0.86, seed * 13 + i, 'leafdark', { rough: 0.12, detail: 2 }));
  }
  const o: Vec3 = [0, h * 0.42, 0];
  const surf = (minUp = -0.75, depth = 1): { p: Vec3; dir: Vec3 } => {
    const uy = minUp + rnd() * (1 - minUp);
    const th = rnd() * Math.PI * 2;
    const sxy = Math.sqrt(Math.max(0, 1 - uy * uy));
    const dir: Vec3 = [sxy * Math.cos(th), uy, sxy * Math.sin(th)];
    let t = 0;
    for (const cl of centres) t = Math.max(t, exitT(o, dir, cl.c, cl.r));
    t *= (0.97 + rnd() * 0.05) * depth;
    return { p: [o[0] + dir[0] * t, Math.max(0.02, o[1] + dir[1] * t), o[2] + dir[2] * t], dir };
  };
  const leaf = opts.leaf ?? Math.max(0.06, Math.min(w, h) * 0.105);
  // enough leaves to cover the envelope about (density/50) times over
  const S = Math.PI * ((w + d) / 2) * h;
  const n = Math.round(((opts.density ?? 100) / 50) * S / (leaf * leaf * 0.62 * 0.55) / 4.5);
  const inner = Math.round(n * 0.45);
  for (let i = 0; i < n + inner; i++) {
    const deep = i >= n;
    const { p, dir } = surf(-0.75, deep ? 0.86 : 1);
    if (p[1] < 0.035) continue;
    const yaw0 = Math.atan2(dir[0], dir[2]);
    const th = Math.acos(Math.max(-1, Math.min(1, dir[1])));
    const m = 4 + Math.floor(rnd() * 2);
    // sun-facing leaves are lighter, undersides darker
    const k = (0.62 + rnd() * 0.45) * (0.8 + 0.45 * Math.max(0, dir[1])) * (deep ? 0.5 : 1);
    for (let j = 0; j < m; j++) {
      // spine runs up along the surface tipped out ~25 deg; over the crown leaves angle up and out
      const yaw = yaw0 + (j - (m - 1) / 2) * 0.55 + (rnd() - 0.5) * 0.4;
      const base = th < Math.PI / 2 ? 0.95 - (th / (Math.PI / 2)) * 0.5 : 0.45 - ((th - Math.PI / 2) / (Math.PI / 2)) * 0.3;
      const pitch = Math.max(0.1, Math.min(1.25, base + (rnd() - 0.5) * 0.5));
      parts.push(leafAt(p, yaw, pitch, leaf * (0.75 + rnd() * 0.5), leaf * 0.66, 'leaf', { shape: opts.shape ?? 'oval', fold: 0.12, droop: 0.3, seg: 4, tint: [k * tb[0] * (0.95 + rnd() * 0.12), k * tb[1] * (1 + rnd() * 0.15), k * tb[2] * 0.9] }));
    }
  }
  // lighter sprigs of new growth out of the upper half
  const sprigs = Math.round(n * 0.06);
  for (let i = 0; i < sprigs; i++) {
    const { p, dir } = surf(0.25);
    const len = leaf * (1.8 + rnd() * 1.6);
    const tip: Vec3 = [p[0] + dir[0] * len * 0.5, p[1] + Math.max(0.5, dir[1]) * len, p[2] + dir[2] * len * 0.5];
    parts.push(tube([p, tip], 0.0022, 'leaf', { rs: 3, tint: [tb[0] * 1.2, tb[1] * 1.3, tb[2] * 0.9] }));
    for (let j = 0; j < 4; j++) {
      const q = along([p, tip], 0.3 + j * 0.22);
      parts.push(leafAt(q, rnd() * Math.PI * 2, 0.6 + rnd() * 0.5, leaf * 0.85, leaf * 0.52, 'leaf', { shape: 'oval', fold: 0.15, droop: 0.2, seg: 4, tint: [tb[0] * 1.3, tb[1] * 1.35, tb[2] * 0.95] }));
    }
  }
  return parts;
}

/** Spruce: tapering trunk, whorls of near-horizontal branches that droop and lift at the tips, each carrying flat needle fronds; conical silhouette and an upright leader. */
export function spruce(w: number, _d: number, h: number, seed = 21, q = 2): Part[] {
  const rnd = rand(seed);
  const parts: Part[] = [];
  const R = w / 2;
  const trunkR = Math.max(0.07, h * 0.016);
  parts.push(lathe(0, 0, 0, [[0, 0], [trunkR * 1.6, 0], [trunkR * 1.1, h * 0.04], [trunkR, h * 0.15], [trunkR * 0.3, h * 0.97], [0, h]], 'bark', { seg: 12 }));
  parts.push(blob(0, -0.005, 0, R * 1.2, 0.025, R * 1.2, seed, 'soil', { rough: 0.3, flatBottom: true, detail: 2, tint: [1.1, 1.0, 0.85] }));
  const firstY = h * 0.14;
  const spacing = q >= 2 ? 0.42 : q === 1 ? 0.55 : 0.75;
  const whorls = Math.max(6, Math.round((h * 0.88 - firstY) / spacing));
  const T = (k: number): Vec3 => {
    const v = 0.8 + rnd() * 0.4;
    return [v * k, v * k, v * k * (0.96 + rnd() * 0.08)];
  };
  for (let i = 0; i < whorls; i++) {
    const t = i / (whorls - 1);
    const y = firstY + t * (h * 0.9 - firstY);
    const len = R * Math.pow(1 - t, 0.85) * (0.88 + rnd() * 0.22) + 0.1;
    const nb = Math.max(4, Math.round(6 + (1 - t) * 3));
    const off = rnd() * Math.PI * 2;
    // dark core inside the tier so gaps read as depth
    if (len > 0.35 && i % 2 === 0) parts.push(blob(0, y - 0.12, 0, len * 0.9, spacing * 1.6, len * 0.9, seed + i, 'needle', { rough: 0.45, detail: 1, tint: [0.32, 0.36, 0.38] }));
    for (let b = 0; b < nb; b++) {
      const a = off + (b / nb) * Math.PI * 2 + (rnd() - 0.5) * 0.45;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const sag = (0.08 + (1 - t) * 0.16) * len;
      const p0: Vec3 = [ca * trunkR, y, sa * trunkR];
      const p1: Vec3 = [ca * len * 0.5, y - sag, sa * len * 0.5];
      const p2: Vec3 = [ca * len, y - sag * 0.6, sa * len];
      const path: Vec3[] = [p0, p1, p2];
      if (q >= 1 && len > 0.3) parts.push(tube(path, Math.max(0.008, trunkR * 0.2 * (1 - t * 0.6)), 'bark', { smooth: true, rs: 4, ts: q >= 2 ? 8 : 5 }));
      // needle mass hugging the branch: a flattened, lumpy volume that the fronds fringe
      if (len > 0.25) {
        const mid = along(path, 0.62);
        parts.push(blob(mid[0], mid[1] - 0.01, mid[2], len * 0.3, Math.min(0.22, 0.07 + len * 0.06), len * 0.75, seed * 7 + i * 31 + b, 'needle', { rough: 0.6, detail: 1, r: [0, Math.PI / 2 - a, 0], tint: T(0.5) }));
      }
      // fronds: flat needle sprays fanned left, right and up along the branch
      const nf = Math.max(2, Math.round(len / (q >= 2 ? 0.24 : 0.3)));
      for (let k = 0; k < nf; k++) {
        const u = 0.25 + (k / nf) * 0.75;
        const p = along(path, u);
        const fl = Math.min(0.6, 0.25 + len * 0.3) * (1 - u * 0.3);
        const fw = fl * 0.55;
        const tn = T(1 - t * 0.1);
        for (const side of [-1, 1]) parts.push(leafAt([p[0], p[1] + 0.03, p[2]], a + side * (0.6 + rnd() * 0.5), 0.9 + rnd() * 0.55, fl, fw, 'needle', { shape: 'spray', fold: 0.35, droop: 0.75, seg: 5, tint: tn }));
        parts.push(leafAt([p[0], p[1] + 0.05, p[2]], a + (rnd() - 0.5) * 0.6, 0.55 + rnd() * 0.4, fl * 0.8, fw * 0.85, 'needle', { shape: 'spray', fold: 0.4, droop: 0.55, seg: 6, tint: T(1.05) }));
        if (k % 3 === 1) parts.push(leafAt([p[0], p[1] - 0.02, p[2]], a + (rnd() - 0.5) * 1.2, 1.7 + rnd() * 0.3, fl * 0.7, fw * 0.8, 'needle', { shape: 'spray', fold: 0.3, droop: 0.3, seg: 6, tint: T(0.75) }));
      }
      // tip frond, a little lighter (new growth)
      const tl = Math.min(0.4, 0.18 + len * 0.15);
      parts.push(leafAt(p2, a, 1.15, tl, tl * 0.5, 'needle', { shape: 'spray', fold: 0.2, droop: 0.15, seg: 8, tint: T(1.18) }));
    }
  }
  // leader and top tuft
  for (let k = 0; k < 6; k++) parts.push(leafAt([0, h * 0.9 + k * h * 0.012, 0], k * 2.1, 0.6, 0.22, 0.1, 'needle', { shape: 'spray', fold: 0.25, droop: 0.2, seg: 6, tint: T(1.2) }));
  parts.push(leafAt([0, h * 0.94, 0], 0, 0.02, h * 0.06, 0.07, 'needle', { shape: 'spray', fold: 0.3, droop: 0, seg: 6, tint: T(1.1) }));
  parts.push(leafAt([0, h * 0.94, 0], Math.PI / 2, 0.02, h * 0.06, 0.07, 'needle', { shape: 'spray', fold: 0.3, droop: 0, seg: 6, tint: T(1.1) }));
  return parts;
}

/** Broadleaf shade tree: thick trunk with root flare splitting into scaffold limbs that branch twice, ending in clumped leaf masses
 *  (dark core plus a skin of large leaf cards) that together make a broad rounded crown. */
export function shadeTree(w: number, d: number, h: number, seed = 31, q = 2): Part[] {
  const rnd = rand(seed);
  const parts: Part[] = [];
  const R = Math.min(w, d) / 2;
  const trunkH = h * 0.26;
  const tr = Math.max(0.12, h * 0.028);
  parts.push(lathe(0, 0, 0, [[0, 0], [tr * 2.1, 0], [tr * 1.5, 0.15], [tr * 1.15, 0.5], [tr, trunkH * 0.7], [tr * 0.95, trunkH], [0, trunkH]], 'bark', { seg: 16 }));
  // root flares
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + rnd() * 0.5;
    parts.push(tube([[Math.cos(a) * tr * 0.6, 0.35, Math.sin(a) * tr * 0.6], [Math.cos(a) * tr * 1.6, 0.08, Math.sin(a) * tr * 1.6], [Math.cos(a) * tr * 2.6, -0.02, Math.sin(a) * tr * 2.6]], tr * 0.35, 'bark', { smooth: true, rs: 6 }));
  }
  const tips: { p: Vec3; s: number; rad: number }[] = [];
  const limb = (from: Vec3, dir: Vec3, len: number, rad: number, depth: number) => {
    const l = Math.hypot(dir[0], dir[1], dir[2]);
    const u: Vec3 = [dir[0] / l, dir[1] / l, dir[2] / l];
    const mid: Vec3 = [from[0] + u[0] * len * 0.5 + (rnd() - 0.5) * len * 0.12, from[1] + u[1] * len * 0.5 + len * 0.05, from[2] + u[2] * len * 0.5 + (rnd() - 0.5) * len * 0.12];
    const end: Vec3 = [from[0] + u[0] * len, from[1] + u[1] * len, from[2] + u[2] * len];
    parts.push(tube([from, mid, end], rad, 'bark', { smooth: true, rs: depth === 0 ? 10 : 6, ts: depth === 0 ? undefined : q >= 2 ? 12 : 8 }));
    if (depth >= 2) {
      tips.push({ p: end, s: len * 1.15, rad });
      return;
    }
    const kids = depth === 0 ? 3 : 2 + (rnd() > 0.35 ? 1 : 0);
    for (let k = 0; k < kids; k++) {
      const ya = Math.atan2(u[2], u[0]) + (k - (kids - 1) / 2) * 0.75 + (rnd() - 0.5) * 0.4;
      const up = 0.35 + rnd() * 0.5;
      limb(end, [Math.cos(ya), up, Math.sin(ya)], len * (0.62 + rnd() * 0.15), rad * 0.58, depth + 1);
    }
  };
  const scaff = 4 + Math.floor(rnd() * 2);
  const crownTop = h * 0.98;
  for (let i = 0; i < scaff; i++) {
    const a = (i / scaff) * Math.PI * 2 + rnd() * 0.5;
    const up = 1.1 + rnd() * 0.6;
    limb([0, trunkH - 0.1, 0], [Math.cos(a), up, Math.sin(a)], (crownTop - trunkH) * 0.38, tr * 0.62, 0);
  }
  // leaf clumps: every tip is mapped onto a shell inside the crown ellipsoid and joined with a twig, so the crown is full and rounded
  const ry = (crownTop - trunkH) * 0.55;
  const cy = crownTop - ry;
  const leaf = Math.max(0.24, R * 0.11);
  const perClump = q >= 2 ? 92 : q === 1 ? 52 : 24;
  // stratify clump heights over the crown (tips themselves all sit high), keep each tip's azimuth
  const order = tips.map((t, i) => i).sort((p1, p2) => tips[p1].p[1] - tips[p2].p[1]);
  const rank = new Map(order.map((ti, r) => [ti, r]));
  tips.push({ p: [0, crownTop - ry * 0.5, 0], s: 1, rad: tr * 0.2 });
  tips.forEach((tp, ti) => {
    const last = ti === tips.length - 1;
    const r0 = rank.get(ti) ?? 0;
    const dy = last ? 0.85 : -0.8 + ((r0 + 0.5) / (tips.length - 1)) * 1.6 + (rnd() - 0.5) * 0.12;
    const az = Math.atan2(tp.p[2], tp.p[0]) + (rnd() - 0.5) * 0.3;
    const hor = Math.sqrt(Math.max(0.35, 1 - Math.min(0.95, dy * dy)));
    const shell = last ? 0.2 : 0.66 + rnd() * 0.12;
    const c: Vec3 = [Math.cos(az) * hor * R * shell, cy + dy * ry * shell, Math.sin(az) * hor * R * shell];
    parts.push(tube([tp.p, [(tp.p[0] + c[0]) / 2, (tp.p[1] + c[1]) / 2 + 0.15, (tp.p[2] + c[2]) / 2], c], Math.max(0.02, tp.rad * 0.7), 'bark', { smooth: true, rs: 5, ts: q >= 2 ? 8 : 5 }));
    const rr = R * (0.38 + rnd() * 0.1);
    const sz3: Vec3 = [rr * 2, rr * 1.55, rr * 2];
    parts.push(blob(c[0], c[1], c[2], sz3[0] * 0.76, sz3[1] * 0.76, sz3[2] * 0.76, seed + ti, 'leafdark', { rough: 0.3, detail: 1 }));
    for (let i = 0; i < perClump; i++) {
      const uy = -0.55 + rnd() * 1.55;
      const th = rnd() * Math.PI * 2;
      const cyv = Math.max(-1, Math.min(1, uy));
      const sxy = Math.sqrt(Math.max(0, 1 - cyv * cyv));
      const dir: Vec3 = [sxy * Math.cos(th), cyv, sxy * Math.sin(th)];
      const p: Vec3 = [c[0] + (dir[0] * sz3[0]) / 2 * (0.9 + rnd() * 0.12), c[1] + (dir[1] * sz3[1]) / 2 * (0.9 + rnd() * 0.12), c[2] + (dir[2] * sz3[2]) / 2 * (0.9 + rnd() * 0.12)];
      const thA = Math.acos(cyv);
      const base = thA < Math.PI / 2 ? 0.95 - (thA / (Math.PI / 2)) * 0.5 : 0.45;
      const kk = (0.6 + rnd() * 0.5) * (0.75 + 0.5 * Math.max(0, dir[1]));
      const yaw0 = Math.atan2(dir[0], dir[2]);
      for (let j = 0; j < 2; j++)
        parts.push(leafAt(p, yaw0 + (j - 0.5) * 0.8 + (rnd() - 0.5) * 0.4, Math.max(0.15, base + (rnd() - 0.5) * 0.6), leaf * (0.7 + rnd() * 0.6), leaf * 0.62, 'leaf', { shape: 'oval', fold: 0.2, droop: 0.35, seg: 4, tint: [kk * 1.45, kk * 1.3, kk * 0.42] }));
    }
  });
  return parts;
}

/** Plank planter box: corner posts, horizontal boards with shadow gaps, cap rail, soil, overflowing herbs, flowers and grasses. */
export function plankPlanter(w: number, d: number, h: number, seed = 41, q = 2): Part[] {
  const rnd = rand(seed);
  const parts: Part[] = [];
  const post = 0.07;
  const capT = 0.025;
  const bh = h - capT;
  // corner posts and a centre post on long sides
  for (const sx of [-1, 1])
    for (const sz2 of [-1, 1]) parts.push(box(sx * (w / 2 - post / 2), bh / 2, sz2 * (d / 2 - post / 2), post, bh, post, 'primary', { gv: true, tint: [1.05, 1.02, 1] }));
  if (w > 1.2) for (const sz2 of [-1, 1]) parts.push(box(0, bh / 2, sz2 * (d / 2 - 0.012), post, bh, 0.024, 'primary', { gv: true }));
  // boards with gaps
  const nb = Math.max(2, Math.round(bh / 0.14));
  const bt = bh / nb;
  for (let i = 0; i < nb; i++) {
    const y = i * bt + bt / 2;
    const k = 0.9 + rnd() * 0.2;
    for (const sz2 of [-1, 1]) parts.push(box(0, y, sz2 * (d / 2 - 0.02), w - post * 2 + 0.01, bt - 0.006, 0.02, 'primary', { tint: [k, k * 0.98, k * 0.95] }));
    for (const sx of [-1, 1]) parts.push(box(sx * (w / 2 - 0.02), y, 0, 0.02, bt - 0.006, d - post * 2 + 0.01, 'primary', { tint: [k, k * 0.98, k * 0.95] }));
  }
  // dark gaps behind boards
  parts.push(box(0, bh / 2, 0, w - 0.05, bh - 0.02, d - 0.05, 'soil', { tint: [0.5, 0.45, 0.4] }));
  // cap rail with mitred overhang
  parts.push(rbox(0, h - capT / 2, d / 2 - 0.035, w + 0.03, capT, 0.09, 0.004, 'primary'));
  parts.push(rbox(0, h - capT / 2, -d / 2 + 0.035, w + 0.03, capT, 0.09, 0.004, 'primary'));
  for (const sx of [-1, 1]) parts.push(rbox(sx * (w / 2 - 0.035), h - capT / 2, 0, 0.09, capT, d - 0.04, 0.004, 'primary'));
  // soil and planting: a low leafy mound, flowers, a few grass clumps
  const sy = h - 0.04;
  parts.push(blob(0, sy, 0, w - 0.12, 0.05, d - 0.12, seed, 'soil', { rough: 0.3, flatBottom: true, detail: 2 }));
  // a row of small overlapping plant mounds
  const nm = Math.max(2, Math.round((w - 0.14) / 0.4));
  const mh = Math.min(0.4, h * 0.75);
  const tops: Vec3[] = [];
  for (let m = 0; m < nm; m++) {
    const mx = -w / 2 + 0.07 + ((m + 0.5) * (w - 0.14)) / nm + (rnd() - 0.5) * 0.06;
    const sw = (w - 0.14) / nm + 0.12;
    const hh = mh * (0.7 + rnd() * 0.45);
    const mound = shrub(sw, d - 0.1, hh, seed + 3 + m, { density: q >= 2 ? 72 : q === 1 ? 40 : 18, clumps: 3, leaf: 0.07 });
    for (const p of mound) parts.push(p.s === 'tube' ? { ...p, path: p.path.map(([x, y, z]) => [x + mx, y + sy, z] as Vec3) } : { ...p, p: [p.p[0] + mx, p.p[1] + sy, p.p[2]] as Vec3 });
    tops.push([mx, hh, sw]);
  }
  // nasturtium flowers sitting on the mound surfaces
  const flowers = Math.round(w * 10);
  for (let i = 0; i < flowers; i++) {
    const [mx, hh, sw] = tops[Math.floor(rnd() * tops.length)];
    const uy = 0.25 + rnd() * 0.7;
    const a = rnd() * Math.PI * 2;
    const sxy = Math.sqrt(1 - uy * uy);
    const x = mx + Math.cos(a) * sxy * sw * 0.5 * 1.12;
    const z = Math.sin(a) * sxy * (d - 0.1) * 0.5 * 1.12;
    const y = sy + hh * 0.42 + uy * hh * 0.62;
    const col: Vec3 = rnd() > 0.45 ? [1.0, 0.42, 0.04] : [1.0, 0.72, 0.08];
    for (let k = 0; k < 5; k++) parts.push(leafAt([x, y, z], (k / 5) * Math.PI * 2 + a, 0.75, 0.065, 0.06, 'plastic', { shape: 'round', fold: 0.1, droop: 0.15, seg: 4, tint: col }));
    parts.push(sph(x, y + 0.008, z, 0.018, 0.012, 0.018, 'plastic', { tint: [0.6, 0.3, 0.05] }));
  }
  for (let g = 0; g < Math.round(w * 2); g++) {
    const x = (rnd() - 0.5) * (w - 0.3);
    for (let k = 0; k < 9; k++) parts.push(leafAt([x, sy, (rnd() - 0.5) * 0.1], rnd() * Math.PI * 2, 0.15 + rnd() * 0.5, 0.35 + rnd() * 0.25, 0.012, 'leaf', { shape: 'needle', fold: 0.3, droop: 0.9, tint: [1.15, 1.2, 0.7] }));
  }
  return parts;
}

void cyl;
