import { type Part, box, ellipse, ext, lathe, rand, rbox, sph, sz } from './kit';
import { fiddleLeafFig } from './plants';
import type { CatalogItem } from './types';

/** Area rug: thin pile slab with the full design mapped once, a slightly raised bound edge, cotton fringe on the short ends. */
export function areaRug(w: number, d: number, h: number, q: number): Part[] {
  const rnd = rand(9);
  const t = Math.max(0.014, h);
  const parts: Part[] = [rbox(0, t / 2, 0, w, t, d, Math.min(0.004, t / 2.2), 'primary', { uvFit: true })];
  const n = Math.round(w / (q >= 2 ? 0.018 : q === 1 ? 0.03 : 0.06));
  for (const sz2 of [-1, 1])
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + 0.02 + (i / (n - 1)) * (w - 0.04);
      const len = 0.05 + rnd() * 0.025;
      const ang = (rnd() - 0.5) * 0.35;
      parts.push(box(x + Math.sin(ang) * len * 0.5 * sz2, 0.0015, sz2 * (d / 2 + len / 2 - 0.004), 0.004, 0.002, len, 'paper', { r: [0, ang, 0], tint: [1.02, 0.98, 0.9] }));
    }
  return parts;
}

/** Canvas in a thin floater frame: canvas stretched on a deep bar with a shadow gap to the frame. */
export function floaterFrame(w: number, d: number, h: number): Part[] {
  const fw = 0.018;
  const fd = Math.max(0.045, d);
  const gap = 0.008;
  const parts: Part[] = [];
  // frame (L-section): face lip and depth
  parts.push(rbox(0, h - fw / 2, 0, w, fw, fd, 0.002, 'primary'));
  parts.push(rbox(0, fw / 2, 0, w, fw, fd, 0.002, 'primary'));
  for (const sx of [-1, 1]) parts.push(rbox(sx * (w / 2 - fw / 2), h / 2, 0, fw, h - 2 * fw + 0.001, fd, 0.002, 'primary', { gv: true }));
  // shadow gap and back board
  parts.push(box(0, h / 2, -fd / 2 + 0.004, w - 2 * fw, h - 2 * fw, 0.006, 'rubber'));
  // stretched canvas, front face mapped once
  parts.push(box(0, h / 2, fd / 2 - 0.016, w - 2 * fw - gap * 2, h - 2 * fw - gap * 2, 0.03, 'accent', { uvFit: true }));
  return parts;
}

/** Arch outline (rectangle with a semicircular top) centred on x, from y0 to y1. */
function archShape(w: number, y0: number, y1: number, n = 32): [number, number][] {
  const r = w / 2;
  const pts: [number, number][] = [[-r, y0], [r, y0], [r, y1 - r]];
  for (let i = 1; i < n; i++) {
    const a = (i / n) * Math.PI;
    pts.push([Math.cos(a) * r, y1 - r + Math.sin(a) * r]);
  }
  pts.push([-r, y1 - r]);
  return pts;
}

/** Arched wall mirror: slim antique-brass frame with an inner bead, mirror glass, and a small carved rose crest. */
export function archMirror(w: number, d: number, h: number): Part[] {
  const fw = 0.028;
  const fd = Math.max(0.02, d * 0.5);
  const parts: Part[] = [];
  const outer = archShape(w, 0, h);
  const inner = archShape(w - 2 * fw, fw, h - fw);
  parts.push(ext(0, 0, 0, outer, fd, 'primary', { holes: [inner], bevel: 0.004, curveSeg: 4 }));
  parts.push(ext(0, 0, fd / 2 - 0.004, archShape(w - 2 * fw + 0.008, fw - 0.004, h - fw + 0.004), 0.004, 'primary', { holes: [archShape(w - 2 * fw - 0.004, fw + 0.002, h - fw - 0.002)], tint: [1.15, 1.1, 1.0] }));
  parts.push(ext(0, 0, -0.002, inner, 0.006, 'mirror'));
  parts.push(ext(0, 0, -fd / 2 + 0.002, outer, 0.004, 'rubber'));
  // carved crest: rosettes and leaves along the top of the arch
  const rnd = rand(4);
  const cy = h - 0.005;
  for (let i = -3; i <= 3; i++) {
    const a = Math.PI / 2 + i * 0.13;
    const x = Math.cos(a) * (w / 2);
    const y = h - w / 2 + Math.sin(a) * (w / 2);
    const rr = i === 0 ? 0.04 : 0.028 - Math.abs(i) * 0.002;
    parts.push(lathe(x, y, fd / 2 + 0.002, [[0, 0], [rr, 0], [rr * 0.95, rr * 0.4], [rr * 0.6, rr * 0.75], [0, rr * 0.85]], 'primary', { r: [Math.PI / 2, 0, 0], seg: 14 }));
    for (let k = 0; k < 3; k++) {
      const la = a - Math.PI / 2 + (k - 1) * 1.1 + (rnd() - 0.5) * 0.5;
      parts.push(ext(x - Math.sin(la) * rr * 1.1, y + Math.cos(la) * rr * 1.1, fd / 2 - 0.002, ellipse(rr * 0.5, rr * 1.15, 12), 0.008, 'primary', { r: [0, 0, la], bevel: 0.002 }));
    }
  }
  parts.push(sph(0, cy + 0.03, fd / 2, 0.03, 0.03, 0.02, 'primary'));
  return parts;
}

export const DECOR: CatalogItem[] = [
  {
    id: 'plant',
    name: 'Fiddle-leaf fig',
    category: 'Decor',
    size: sz(1.6, 1.6, 4.5),
    slots: { primary: { label: 'Pot', default: 'trim-black' } },
    parts: (w, d, h) => fiddleLeafFig(w, d, h),
    solid: false,
    ref: 'Fiddle-leaf fig tree in a tall tapered black planter (CFA Design Group)',
  },
  {
    id: 'rug',
    name: 'Area rug',
    category: 'Decor',
    size: { w: 8 * 0.3048, d: 10 * 0.3048, h: 0.012 },
    slots: { primary: { label: 'Rug', default: 'rug-persian' } },
    parts: (w, d, h, q) => areaRug(w, d, h, q),
    solid: false,
    flat: true,
    ref: 'Safavieh Vintage Persian rug, rust and navy, distressed, fringed (Home Depot)',
  },
  {
    id: 'wall-art',
    name: 'Wall art',
    category: 'Decor',
    size: sz(4, 0.15, 2.1),
    slots: { primary: { label: 'Frame', default: 'oak-furniture' }, accent: { label: 'Canvas', default: 'art-horizon' } },
    parts: (w, d, h) => floaterFrame(w, d, h),
    solid: false,
    defaultElevation: 1.2,
    ref: 'Moody abstract landscape canvas in a thin wood floater frame (Etsy)',
  },
  {
    id: 'mirror',
    name: 'Arched mirror',
    category: 'Decor',
    size: sz(2.2, 0.12, 3.9),
    slots: { primary: { label: 'Frame', default: 'brass' } },
    parts: (w, d, h) => archMirror(w, d, h),
    solid: false,
    defaultElevation: 0.9,
    ref: 'Arched antique-brass wall mirror with carved rose crest (Bed Bath & Beyond)',
  },
];
