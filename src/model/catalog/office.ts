import { type Part, type Vec3, bandAround, bez, bookRow, box, cushion, cyl, ext, flutes, lathe, leafAt, rand, rbox, rod, rotateX, shellProfile, sz, torus, tube } from './kit';
import { knob } from './bedroom';
import { bowl, vase } from './living';
import type { CatalogItem } from './types';

/** Writing desk: thin top with raised lip, reeded apron with two drawers, long tapered legs flaring into the apron, side stretchers, brass sabots. */
export function writingDesk(w: number, d: number, h: number): Part[] {
  const parts: Part[] = [];
  const topT = 0.034;
  const apronH = 0.11;
  const ay = h - topT - apronH / 2;
  parts.push(rbox(0, h - topT / 2, 0, w, topT, d, 0.014, 'primary'));
  // raised lip along the back and sides
  parts.push(rbox(0, h + 0.012, -d / 2 + 0.01, w - 0.01, 0.024, 0.016, 0.006, 'primary'));
  for (const sx of [-1, 1]) parts.push(rbox(sx * (w / 2 - 0.008), h + 0.012, -d * 0.15, 0.016, 0.024, d * 0.68, 0.006, 'primary'));
  // apron box: reeded front with two drawers on the left half
  parts.push(box(0, ay, -0.01, w - 0.04, apronH, d - 0.06, 'primary'));
  const zf = d / 2 - 0.03;
  const dw = w * 0.22;
  for (let i = 0; i < 2; i++) {
    const x = -w / 2 + 0.03 + dw / 2 + i * (dw + 0.006);
    parts.push(rbox(x, ay, zf + 0.004, dw, apronH - 0.016, 0.014, 0.003, 'primary'));
    parts.push(knob(x, ay, zf + 0.011, 0.02));
  }
  const rx0 = -w / 2 + 0.03 + 2 * dw + 0.012;
  parts.push(...flutes(rx0, w / 2 - 0.03, ay - apronH / 2 + 0.008, ay + apronH / 2 - 0.008, zf + 0.002, 0.016, 'primary'));
  // legs: long, tapered, flaring outward at the top into the apron corners
  const lx = w / 2 - 0.06;
  const lz = d / 2 - 0.07;
  for (const sx of [-1, 1])
    for (const sz2 of [-1, 1]) {
      const path: Vec3[] = [
        [sx * (lx - 0.02), 0.02, sz2 * (lz - 0.01)],
        [sx * (lx - 0.012), h * 0.55, sz2 * lz],
        [sx * lx, ay - apronH * 0.3, sz2 * lz],
        [sx * (lx + 0.03), ay, sz2 * (lz + 0.012)],
      ];
      parts.push(tube(path, 0.017, 'primary', { smooth: true, rs: 12 }));
      parts.push(cyl(sx * (lx - 0.02), 0.012, sz2 * (lz - 0.01), 0.026, 0.024, 0.026, 'brass', { seg: 12 }));
    }
  // side stretchers
  for (const sx of [-1, 1]) parts.push(rod([sx * (lx - 0.018), h * 0.2, -lz], [sx * (lx - 0.018), h * 0.2, lz], 0.016, 'primary', { seg: 10 }));
  return parts;
}

/** Swivel tub office chair: upholstered shell wrapping into flared arms, seat cushion, chrome gas lift and five-star base on casters. */
export function tubOfficeChair(w: number, d: number, h: number): Part[] {
  const parts: Part[] = [];
  const seatY = h * 0.5;
  const R = w * 0.48;
  // five-star base, casters, gas lift
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + Math.PI / 2;
    const tip: Vec3 = [Math.cos(a) * R, 0.075, Math.sin(a) * R];
    parts.push(beam5([0, 0.1, 0], tip));
    // caster: hood and twin wheels
    parts.push(rbox(tip[0], 0.058, tip[2], 0.035, 0.03, 0.05, 0.01, 'rubber', { r: [0, -a, 0] }));
    for (const s of [-1, 1]) parts.push(cyl(tip[0] + Math.cos(a + Math.PI / 2) * s * 0.012, 0.026, tip[2] + Math.sin(a + Math.PI / 2) * s * 0.012, 0.05, 0.012, 0.05, 'rubber', { r: [0, -a, Math.PI / 2], ro: 'YXZ', seg: 14 }));
  }
  parts.push(cyl(0, 0.1, 0, 0.07, 0.04, 0.07, 'chrome'));
  parts.push(cyl(0, 0.1 + (seatY - 0.17) / 2, 0, 0.05, seatY - 0.17, 0.05, 'chrome'));
  parts.push(cyl(0, seatY - 0.06, 0, 0.032, 0.08, 0.032, 'rubber'));
  parts.push(rbox(0, seatY - 0.045, 0, 0.22, 0.03, 0.22, 0.008, 'rubber'));
  parts.push(rod([0.1, seatY - 0.05, -0.02], [0.17, seatY - 0.06, 0.06], 0.012, 'rubber'));
  // seat cushion
  parts.push(cushion(0, seatY + 0.02, 0.03, w * 0.78, 0.09, d * 0.74, 0.04, 0.025, 'primary', { sag: 0.01 }));
  // tub shell: lathe arcs open at the front. Arm-height wrap plus a taller back section.
  const rx = w * 0.47;
  const armH = (h - seatY) * 0.42;
  const gap = 0.95; // half-angle of the front opening (rad)
  parts.push(lathe(0, seatY - 0.04, -0.02, shellProfile(rx * 0.86, rx, 0, armH, 0.07), 'primary', { phi0: gap, arc: Math.PI * 2 - 2 * gap, sx: 1, sz: (d * 0.5) / rx }));
  const backArc = 1.25;
  parts.push(lathe(0, seatY - 0.04, -0.02, shellProfile(rx * 0.9, rx * 0.92, 0, h - seatY + 0.04, 0.075), 'primary', { phi0: Math.PI - backArc, arc: backArc * 2, sx: 1, sz: (d * 0.5) / rx }));
  // rounded caps on the open arm ends and back-section edges
  const ez = (d * 0.5) / rx;
  for (const sx of [-1, 1]) {
    const ex = Math.sin(gap) * rx * 0.94 * sx;
    const ezz = Math.cos(gap) * rx * 0.94 * ez - 0.02;
    parts.push(cushion(ex, seatY - 0.04 + armH / 2, ezz, 0.075, armH + 0.06, 0.075, 0.035, 0.0, 'primary', { r: [0, sx * gap, 0] }));
    const bx = Math.sin(Math.PI - backArc) * rx * 0.91 * sx;
    const bz = Math.cos(Math.PI - backArc) * rx * 0.91 * ez - 0.02;
    parts.push(cushion(bx, seatY - 0.04 + (h - seatY + 0.04) / 2, bz, 0.08, h - seatY + 0.11, 0.08, 0.038, 0.0, 'primary', { r: [0, sx * (Math.PI - backArc), 0] }));
  }
  // bottom pan under the seat
  parts.push(lathe(0, seatY - 0.045, -0.02, [[0, 0], [rx * 0.86, 0], [rx * 0.86, 0.02], [0, 0.02]], 'primary', { sz: (d * 0.5) / rx }));
  return parts;
}

function beam5(a: Vec3, b: Vec3): Part {
  return rod(a, b, 0.034, 'chrome', { seg: 10, taper: 0.7 });
}

/** Small potted plant for shelf styling: ceramic pot and a tuft of leaves. */
export function shelfPlant(x: number, y: number, z: number, hgt: number, seed: number): Part[] {
  const rnd = rand(seed);
  const pr = hgt * 0.22;
  const parts: Part[] = [lathe(x, y, z, [[0, 0], [pr * 0.8, 0], [pr, hgt * 0.35], [pr * 1.02, hgt * 0.38], [pr * 0.9, hgt * 0.38], [0, hgt * 0.34]], 'ceramic', { tint: [0.92, 0.9, 0.86] })];
  for (let i = 0; i < 9; i++) {
    const yaw = (i / 9) * Math.PI * 2 + rnd();
    parts.push(leafAt([x, y + hgt * 0.34, z], yaw, 0.35 + rnd() * 0.6, hgt * (0.45 + rnd() * 0.3), hgt * 0.16, 'leaf', { shape: 'oval', fold: 0.25, droop: 0.6, tint: [0.65 + rnd() * 0.35, 0.75 + rnd() * 0.3, 0.6] }));
  }
  return parts;
}

/** Five-shelf bookcase: crown cap, arched top opening, plinth, styled with books, bowls, vases and plants. */
export function archBookcase(w: number, d: number, h: number, styled = true): Part[] {
  const parts: Part[] = [];
  const side = 0.025;
  const plinth = 0.08;
  const capH = 0.05;
  for (const sx of [-1, 1]) parts.push(rbox(sx * (w / 2 - side / 2), h / 2 - capH / 2, 0, side, h - capH, d, 0.003, 'primary'));
  parts.push(rbox(0, h - capH / 2, 0.006, w + 0.03, capH, d + 0.016, 0.006, 'primary'));
  parts.push(rbox(0, h - capH - 0.008, 0.004, w + 0.012, 0.016, d + 0.008, 0.003, 'primary'));
  parts.push(rbox(0, plinth / 2, 0.006, w + 0.016, plinth, d + 0.012, 0.004, 'primary'));
  parts.push(box(0, h / 2, -d / 2 + 0.006, w - 2 * side, h - 0.02, 0.012, 'secondary', { tint: [0.75, 0.72, 0.7] }));
  // arched header under the cap
  const archH = 0.1;
  const archY = h - capH - archH / 2 - 0.01;
  const span = w - 2 * side;
  const arch: [number, number][] = [[-span / 2, archH / 2], [span / 2, archH / 2], [span / 2, -archH / 2]];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const x = span / 2 - t * span;
    const r = 0.06;
    const ex = Math.abs(x) > span / 2 - r ? Math.sqrt(Math.max(0, r * r - (Math.abs(x) - (span / 2 - r)) ** 2)) : r;
    arch.push([x, -archH / 2 + (r - ex) * 0 + Math.max(0, ex - r * 0.2) * 0.9]);
  }
  arch.push([-span / 2, -archH / 2]);
  parts.push(ext(0, archY, d / 2 - 0.012, arch, 0.024, 'primary', { bevel: 0.003 }));
  // shelves
  const n = 5;
  const y0 = plinth;
  const y1 = h - capH - archH;
  const bay = (y1 - y0) / n;
  const rnd = rand(31);
  for (let i = 0; i < n; i++) {
    const sy = y0 + i * bay;
    if (i > 0) parts.push(rbox(0, sy, 0.004, span, 0.022, d - 0.01, 0.003, 'primary'));
    if (!styled) continue;
    const top = sy + 0.011;
    const mh = bay - 0.03;
    const zf = d / 2 - 0.03;
    const kind = i % 3;
    if (kind === 0) {
      parts.push(...bookRow(-span / 2 + 0.01, span * 0.12, top, zf, d * 0.72, mh * 0.85, 40 + i));
      parts.push(...shelfPlant(span * 0.3, top, 0, Math.min(0.26, mh * 0.85), 7 + i));
    } else if (kind === 1) {
      parts.push(vase(-span * 0.3, top, 0, Math.min(0.24, mh * 0.8), 'ceramic', [0.42, 0.3, 0.22]));
      parts.push(rbox(span * 0.05, top + 0.022, 0.0, 0.2, 0.044, 0.14, 0.004, 'paper', { tint: [0.92, 0.9, 0.85] }));
      parts.push(rbox(span * 0.05, top + 0.055, 0.0, 0.17, 0.022, 0.12, 0.003, 'paper', { tint: [0.25, 0.3, 0.28] }));
      parts.push(...bookRow(span * 0.22, span / 2 - 0.01, top, zf, d * 0.72, mh * 0.82, 60 + i));
    } else {
      parts.push(...bookRow(-span / 2 + 0.01, -span * 0.05, top, zf, d * 0.72, mh * 0.8, 80 + i));
      parts.push(bowl(span * 0.24, top, 0.01, Math.min(0.2, span * 0.3), 'ceramic', [0.86, 0.84, 0.8]));
    }
    void rnd;
  }
  return parts;
}

export const OFFICE: CatalogItem[] = [
  {
    id: 'desk',
    name: 'Writing desk',
    category: 'Office',
    size: sz(4.5, 2, 2.5),
    slots: { primary: { label: 'Wood', default: 'walnut-furniture' }, secondary: { label: 'Accent', default: 'brass' } },
    parts: (w, d, h) => writingDesk(w, d, h),
    solid: true,
    ref: 'Scandinavian Designs walnut writing desk, reeded apron, two drawers, tapered legs, brass sabots',
  },
  {
    id: 'office-chair',
    name: 'Office chair',
    category: 'Office',
    size: sz(2.2, 2.2, 2.9),
    slots: { primary: { label: 'Upholstery', default: 'fabric-charcoal' }, secondary: { label: 'Base', default: 'chrome' } },
    parts: (w, d, h) => tubOfficeChair(w, d, h),
    solid: true,
    ref: 'Charcoal tub-shell swivel office chair, chrome five-star base, twin-wheel casters',
  },
  {
    id: 'bookshelf',
    name: 'Bookcase',
    category: 'Office',
    size: sz(3.5, 1.1, 7),
    slots: { primary: { label: 'Frame', default: 'walnut-furniture' }, secondary: { label: 'Back', default: 'walnut-furniture' } },
    parts: (w, d, h) => archBookcase(w, d, h),
    solid: true,
    ref: 'Sauder five-shelf Grand Walnut bookcase with crown and arched header, styled shelves',
  },
];
