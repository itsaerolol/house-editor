import { type Part, type Vec3, bandAround, bez, beam, cushion, cyl, ext, liveEdge, rbox, rod, rotateX, sz, tube } from './kit';
import type { CatalogItem } from './types';

/** Live-edge slab dining table on two curved-X steel trestle bases. */
export function liveEdgeTrestle(w: number, d: number, h: number): Part[] {
  const parts: Part[] = [];
  const t = 0.05;
  // slab: live edge outline extruded vertically
  parts.push(ext(0, h - t / 2, 0, liveEdge(w, d * 0.94, 5, 0.03), t, 'primary', { r: [-Math.PI / 2, 0, 0], bevel: 0.008, curveSeg: 4 }));
  const bx = w / 2 - Math.min(0.38, w * 0.2);
  const reach = d * 0.36;
  const yTop = h - t;
  for (const sx of [-1, 1]) {
    const x = sx * bx;
    // hourglass pedestal: two curved plates pinched at a waist collar, flaring to foot and top
    const waist = yTop * 0.42;
    for (const s of [-1, 1]) {
      const lower = bez([s * reach, 0.012], [s * 0.04, 0.03], [s * 0.035, waist], 18);
      const upper = bez([s * 0.035, waist], [s * 0.03, yTop * 0.88], [s * reach * 0.62, yTop - 0.012], 18);
      parts.push(ext(x, 0, 0, bandAround([...lower, ...upper.slice(1)], 0.028), 0.08, 'metal', { r: [0, Math.PI / 2, 0], curveSeg: 2 }));
    }
    parts.push(rbox(x, waist, 0, 0.1, 0.07, 0.11, 0.008, 'metal'));
    parts.push(beam([x, yTop - 0.012, -reach * 0.66], [x, yTop - 0.012, reach * 0.66], 0.085, 0.024, 'metal', 0.004));
    // levelers
    for (const s of [-1, 1]) parts.push(rbox(x, 0.003, s * (reach + 0.01), 0.06, 0.006, 0.05, 0.002, 'rubber'));
  }
  return parts;
}

/** Fan-back dining chair: curved rear posts, bowed crest rail, fanned flat slats, saddle seat, stretchers. */
export function fanBackChair(w: number, d: number, h: number): Part[] {
  const parts: Part[] = [];
  const seatY = h * 0.49;
  const st = 0.04;
  const fx = w / 2 - 0.04;
  const fz = d / 2 - 0.05;
  const bx = w / 2 - 0.05;
  const bz = -d / 2 + 0.05;
  // saddle seat with a shallow dish
  parts.push(cushion(0, seatY - st / 2, 0.01, w, st, d - 0.02, 0.014, 0.0, 'primary', { sag: 0.014 }));
  // apron under the seat
  parts.push(rbox(0, seatY - st - 0.03, fz - 0.015, w - 0.08, 0.055, 0.02, 0.004, 'secondary'));
  for (const sx of [-1, 1]) parts.push(rbox(sx * (fx - 0.01), seatY - st - 0.03, 0, 0.02, 0.055, d - 0.14, 0.004, 'secondary'));
  // front legs: tapered, slight splay
  for (const sx of [-1, 1]) parts.push(rod([sx * (fx + 0.008), 0, fz + 0.008], [sx * fx, seatY - st, fz], 0.03, 'secondary', { taper: 1.35, seg: 8 }));
  // rear legs sweeping up into the back posts
  const crestY = h - 0.03;
  const crestZ = -d / 2 - 0.045;
  for (const sx of [-1, 1]) {
    const path: Vec3[] = [
      [sx * (bx + 0.01), 0, bz - 0.04],
      [sx * bx, seatY * 0.5, bz],
      [sx * bx, seatY - st, bz + 0.01],
      [sx * (bx - 0.004), seatY + (crestY - seatY) * 0.45, bz - 0.01],
      [sx * (bx - 0.01), crestY, crestZ],
    ];
    parts.push(tube(path, 0.0155, 'secondary', { smooth: true, rs: 8 }));
  }
  // bowed crest rail (wide board bent in plan)
  const arc = bez([-bx + 0.005, crestZ], [0, crestZ - 0.06], [bx - 0.005, crestZ], 16);
  parts.push(ext(0, crestY + 0.002, 0, bandAround(arc.map(([x, z]) => [x, -z] as [number, number]), 0.022), 0.065, 'secondary', { r: [-Math.PI / 2, 0, 0], curveSeg: 2 }));
  // lower back rail holding the slats
  const lowY = seatY + 0.04;
  parts.push(beam([-bx, lowY, bz + 0.005], [bx, lowY, bz + 0.005], 0.03, 0.022, 'secondary', 0.004));
  // seven flat slats fanning out from the low rail to the crest
  const n = 7;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const xb = -bx * 0.62 + t * bx * 1.24;
    const xt = -bx * 0.86 + t * bx * 1.72;
    const zt = crestZ - 0.06 * 4 * t * (1 - t) * 0.95;
    parts.push(beam([xb, lowY + 0.012, bz + 0.004], [xt, crestY - 0.03, zt + 0.004], 0.022, 0.009, 'secondary', 0.003));
  }
  return parts;
}

/** Counter stool: molded bucket seat with wrap-around back on a bent-rod sled frame with footrest. */
export function sledStool(w: number, d: number, h: number): Part[] {
  const parts: Part[] = [];
  const seatY = h * 0.7;
  const r = 0.0085;
  const topX = w / 2 - 0.06;
  const botX = w / 2 - 0.015;
  const zf = d / 2 - 0.07;
  const zb = -d / 2 + 0.07;
  // sled sides
  for (const sx of [-1, 1]) {
    parts.push(tube([[sx * topX, seatY - 0.055, zf], [sx * botX, 0.01, d / 2 - 0.02], [sx * botX, 0.01, -d / 2 + 0.02], [sx * topX, seatY - 0.055, zb]], r, 'metal', { cr: 0.035 }));
    // side rail, landing exactly on the slanted legs
    const yr = h * 0.3;
    const t = 1 - yr / (seatY - 0.055);
    const xr = topX + (botX - topX) * t;
    parts.push(rod([sx * xr, yr, zf + (d / 2 - 0.02 - zf) * t], [sx * xr, yr, zb + (-d / 2 + 0.02 - zb) * t], 0.014, 'metal', { seg: 10 }));
    for (const z of [d / 2 - 0.02, -d / 2 + 0.02]) parts.push(cyl(sx * botX, 0.004, z, 0.022, 0.008, 0.022, 'rubber', { seg: 10 }));
  }
  // footrest and seat frame
  {
    const yf = h * 0.3;
    const t = 1 - yf / (seatY - 0.055);
    const xf = topX + (botX - topX) * t;
    parts.push(rod([-xf, yf, zf + (d / 2 - 0.02 - zf) * t], [xf, yf, zf + (d / 2 - 0.02 - zf) * t], 0.016, 'metal', { seg: 10 }));
  }
  parts.push(tube([[-topX, seatY - 0.055, zf], [topX, seatY - 0.055, zf], [topX, seatY - 0.055, zb], [-topX, seatY - 0.055, zb], [-topX, seatY - 0.055, zf], [topX, seatY - 0.055, zf]], r, 'metal', { cr: 0.02 }));
  // seat pad
  parts.push(cushion(0, seatY - 0.02, 0.015, w - 0.02, 0.055, d - 0.07, 0.025, 0.012, 'primary', { sag: 0.006 }));
  // wrap-around back shell, tilted back
  const bh = h - seatY + 0.03;
  const arc = bez([-(w / 2 - 0.02), -d * 0.12], [0, -d * 0.62], [w / 2 - 0.02, -d * 0.12], 20);
  const back: Part[] = [
    ext(0, seatY - 0.04 + bh / 2, 0, bandAround(arc.map(([x, z]) => [x, -z] as [number, number]), 0.035), bh, 'primary', { r: [-Math.PI / 2, 0, 0], bevel: 0.012, curveSeg: 3 }),
  ];
  const lip = bez([-(w / 2 - 0.022), -d * 0.12], [0, -d * 0.62], [w / 2 - 0.022, -d * 0.12], 20).map(([x, z]) => [x, seatY - 0.04 + bh - 0.01, z] as Vec3);
  back.push(tube(lip, 0.006, 'primary', { smooth: true }));
  parts.push(...rotateX(back, -0.16, [0, seatY, -d * 0.2]));
  return parts;
}

/** Sideboard: rounded carcass, four pillow-edged push-open doors, bronze base rail and tapered angular legs. */
export function pillowSideboard(w: number, d: number, h: number): Part[] {
  const parts: Part[] = [];
  const legH = 0.12;
  const ch = h - legH;
  // bronze base rail and legs
  parts.push(rbox(0, legH + 0.008, 0, w - 0.02, 0.016, d - 0.02, 0.006, 'brass'));
  for (const sx of [-1, 1])
    for (const sz2 of [-1, 1]) {
      const top: Vec3 = [sx * (w / 2 - 0.07), legH, sz2 * (d / 2 - 0.06)];
      const foot: Vec3 = [sx * (w / 2 - 0.055), 0, sz2 * (d / 2 - 0.05)];
      parts.push(beam(foot, top, 0.022, 0.03, 'brass', 0.004, { tint: [1, 1, 1] }));
      parts.push(beam([top[0], legH - 0.004, top[2]], [top[0] - sx * 0.06, legH - 0.004, top[2]], 0.03, 0.012, 'brass', 0.003));
    }
  // carcass with soft vertical corners
  parts.push(rbox(0, legH + 0.016 + (ch - 0.016) / 2, -0.012, w, ch - 0.016, d - 0.024, 0.045, 'primary'));
  // top: slim slab with a back lip
  parts.push(rbox(0, h - 0.012, -0.005, w - 0.03, 0.024, d - 0.02, 0.008, 'accent'));
  parts.push(rbox(0, h + 0.008, -d / 2 + 0.03, w - 0.05, 0.03, 0.025, 0.006, 'accent'));
  // four pillow doors
  const gap = 0.006;
  const dw = (w - 0.07 - gap * 3) / 4;
  for (let i = 0; i < 4; i++) {
    const x = -w / 2 + 0.035 + dw / 2 + i * (dw + gap);
    parts.push(cushion(x, legH + 0.03 + (ch - 0.07) / 2, d / 2 - 0.03, dw, ch - 0.07, 0.04, 0.03, 0.008, 'primary'));
  }
  return parts;
}

export const DINING: CatalogItem[] = [
  {
    id: 'dining-table',
    name: 'Live-edge dining table',
    category: 'Dining',
    size: sz(6.5, 3.3, 2.5),
    slots: { primary: { label: 'Top', default: 'walnut-furniture' }, secondary: { label: 'Base', default: 'black-metal' } },
    parts: (w, d, h) => liveEdgeTrestle(w, d, h),
    solid: true,
    ref: 'Live-edge walnut slab on curved-X black steel trestle bases',
  },
  {
    id: 'dining-chair',
    name: 'Fan-back dining chair',
    category: 'Dining',
    size: sz(1.5, 1.6, 3.1),
    slots: { primary: { label: 'Seat', default: 'leather-cognac' }, secondary: { label: 'Frame', default: 'black-wood' } },
    parts: (w, d, h) => fanBackChair(w, d, h),
    solid: true,
    ref: 'Amish fan-back dining chair, black frame, saddle seat',
  },
  {
    id: 'bar-stool',
    name: 'Counter stool',
    category: 'Dining',
    size: sz(1.45, 1.6, 3.2),
    slots: { primary: { label: 'Seat', default: 'leather-cognac' }, secondary: { label: 'Frame', default: 'black-metal' } },
    parts: (w, d, h) => sledStool(w, d, h),
    solid: true,
    ref: 'Cognac molded bucket counter stool on black sled frame',
  },
  {
    id: 'sideboard',
    name: 'Sideboard',
    category: 'Dining',
    size: sz(5.5, 1.6, 2.8),
    slots: { primary: { label: 'Body', default: 'walnut-burl' }, accent: { label: 'Top', default: 'walnut-furniture' } },
    parts: (w, d, h) => pillowSideboard(w, d, h),
    solid: true,
    ref: 'Burl sideboard, four pillow-edged doors, bronze base rail and angular legs',
  },
];
