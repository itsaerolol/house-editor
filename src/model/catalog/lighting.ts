import { type Part, type Vec3, cyl, lathe, rand, rbox, rod, sph, sz, torus, tube } from './kit';
import type { CatalogItem } from './types';

/** Open drum shade: thin linen wall (lathe shell), top and bottom wire rings, spider arms to a harp finial; warm glow inside. */
export function drumShade(x: number, y: number, z: number, dTop: number, dBot: number, hgt: number): Part[] {
  const t = 0.004;
  return [
    lathe(x, y, z, [[dBot / 2, 0], [dTop / 2, hgt], [dTop / 2 - t, hgt], [dBot / 2 - t, 0]], 'shade', { seg: 48 }),
    torus(x, y + hgt, z, dTop / 2 - t / 2, 0.003, 'brass', { r: [Math.PI / 2, 0, 0] }),
    torus(x, y, z, dBot / 2 - t / 2, 0.003, 'brass', { r: [Math.PI / 2, 0, 0] }),
    // inner glow so the shade lights up from inside
    lathe(x, y + 0.01, z, [[dBot / 2 - 0.01, 0], [dTop / 2 - 0.01, hgt - 0.02], [0, hgt - 0.02]], 'glow', { seg: 32, tint: [0.7, 0.7, 0.7] }),
  ];
}

/** Brass column floor lamp: weighted round base, ringed column with a mid knuckle, socket, harp and a linen drum shade. */
export function columnFloorLamp(w: number, _d: number, h: number): Part[] {
  const parts: Part[] = [];
  const shadeH = Math.min(0.32, h * 0.2);
  const shadeD = Math.min(w, 0.5);
  const colTop = h - shadeH * 0.85;
  parts.push(lathe(0, 0, 0, [[0, 0], [0.13, 0], [0.135, 0.008], [0.13, 0.022], [0.09, 0.03], [0.05, 0.036], [0.03, 0.05], [0, 0.05]], 'primary', { seg: 40 }));
  // column: slim tube with rings and a knuckle a third of the way up
  parts.push(cyl(0, (0.05 + colTop) / 2, 0, 0.034, colTop - 0.05, 0.034, 'primary'));
  for (const y of [0.09, colTop * 0.36, colTop * 0.38, colTop * 0.64, colTop - 0.06])
    parts.push(lathe(0, y, 0, [[0, 0], [0.018, 0], [0.021, 0.008], [0.021, 0.022], [0.018, 0.03], [0, 0.03]], 'primary', { seg: 20 }));
  // socket, harp, finial
  parts.push(lathe(0, colTop, 0, [[0, 0], [0.02, 0], [0.022, 0.05], [0.017, 0.07], [0, 0.07]], 'primary', { seg: 20 }));
  parts.push(sph(0, colTop + 0.1, 0, 0.06, 0.07, 0.06, 'glow'));
  parts.push(tube([[-0.06, colTop + 0.03, 0], [-0.07, colTop + shadeH * 0.6, 0], [0, h - 0.01, 0], [0.07, colTop + shadeH * 0.6, 0], [0.06, colTop + 0.03, 0]], 0.0025, 'primary', { smooth: true }));
  parts.push(sph(0, h + 0.012, 0, 0.025, 0.025, 0.025, 'primary'));
  parts.push(...drumShade(0, h - shadeH, 0, shadeD, shadeD, shadeH));
  // cord
  parts.push(tube([[0.02, 0.04, -0.12], [0.1, 0.005, -0.25], [0.2, 0.003, -0.4]], 0.003, 'rubber', { smooth: true }));
  return parts;
}

/** Double-gourd ceramic table lamp with brass neck and a tapered empire shade. */
export function gourdTableLamp(w: number, _d: number, h: number): Part[] {
  const parts: Part[] = [];
  const shadeH = h * 0.42;
  const baseH = h - shadeH * 0.8;
  const r = Math.min(w * 0.3, 0.14);
  const g = baseH * 0.82;
  // smooth gourd profile from control radii (catmull-rom through them)
  const ctrl: [number, number][] = [[0.62, 0], [0.92, 0.07], [1.0, 0.18], [0.9, 0.3], [0.52, 0.42], [0.4, 0.48], [0.5, 0.6], [0.52, 0.72], [0.36, 0.86], [0.2, 0.96], [0.18, 1]];
  const prof: [number, number][] = [[0, 0]];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = ctrl[Math.max(0, i - 1)];
    const p1 = ctrl[i];
    const p2 = ctrl[i + 1];
    const p3 = ctrl[Math.min(ctrl.length - 1, i + 2)];
    for (let k = 0; k < 6; k++) {
      const t = k / 6;
      const t2 = t * t;
      const t3 = t2 * t;
      const cr = (a: number, b: number, c: number, d2: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d2) * t2 + (-a + 3 * b - 3 * c + d2) * t3);
      prof.push([r * cr(p0[0], p1[0], p2[0], p3[0]), g * cr(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  prof.push([r * 0.18, g], [0, g]);
  parts.push(lathe(0, 0, 0, prof, 'primary', { seg: 40 }));
  // brass neck, socket, bulb, harp, finial
  parts.push(lathe(0, g, 0, [[0, 0], [r * 0.24, 0], [r * 0.24, 0.012], [0.012, 0.03], [0.012, baseH - g - 0.03], [0.018, baseH - g - 0.02], [0.018, baseH - g + 0.03], [0, baseH - g + 0.03]], 'brass', { seg: 24 }));
  parts.push(sph(0, baseH + 0.07, 0, 0.055, 0.065, 0.055, 'glow'));
  parts.push(tube([[-0.05, baseH + 0.01, 0], [-0.06, h - shadeH * 0.4, 0], [0, h - 0.01, 0], [0.06, h - shadeH * 0.4, 0], [0.05, baseH + 0.01, 0]], 0.0022, 'brass', { smooth: true }));
  parts.push(sph(0, h + 0.012, 0, 0.026, 0.026, 0.026, 'brass'));
  parts.push(...drumShade(0, h - shadeH, 0, w * 0.6, w * 0.98, shadeH));
  return parts;
}

/** Dome pendant: canopy, cord, brass cage neck, matte black dome with brass lining and a bright diffuser. Origin at the dome's bottom rim; h = drop to ceiling. */
export function domePendant(w: number, _d: number, h: number): Part[] {
  const parts: Part[] = [];
  const R = w / 2;
  const domeH = R * 0.66;
  const t = 0.006;
  // dome shell: outer black, inner brass, open at the bottom
  const outer: [number, number][] = [];
  const inner: [number, number][] = [];
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * (Math.PI / 2);
    outer.push([R * Math.cos(a) + 0.0001, domeH * Math.sin(a)]);
    inner.push([(R - t) * Math.cos(a) + 0.0001, (domeH - t) * Math.sin(a)]);
  }
  parts.push(lathe(0, 0, 0, [...outer, [0.03, domeH + 0.004]], 'primary', { seg: 48 }));
  parts.push(lathe(0, 0.001, 0, [...inner.map(([r, y]) => [r, y] as [number, number])], 'brass', { seg: 48 }));
  parts.push(torus(0, 0.002, 0, R - t / 2, 0.004, 'primary', { r: [Math.PI / 2, 0, 0] }));
  // diffuser disc and bulb glow
  parts.push(cyl(0, domeH * 0.35, 0, R * 0.55, 0.004, R * 0.55, 'glow'));
  parts.push(sph(0, domeH * 0.45, 0, R * 0.32, R * 0.3, R * 0.32, 'glow'));
  // brass collar on the dome, then a brass cage neck (two flat straps meeting at a top cap)
  const ny = domeH;
  const nh = Math.min(0.11, R * 0.55);
  parts.push(lathe(0, ny - 0.006, 0, [[0, 0], [0.07, 0], [0.065, 0.018], [0.045, 0.026], [0, 0.026]], 'brass', { seg: 32 }));
  for (const a of [0, Math.PI / 2]) {
    const c = Math.cos(a);
    const sn = Math.sin(a);
    parts.push(tube([[-c * 0.045, ny + 0.015, -sn * 0.045], [-c * 0.04, ny + nh * 0.75, -sn * 0.04], [0, ny + nh, 0], [c * 0.04, ny + nh * 0.75, sn * 0.04], [c * 0.045, ny + 0.015, sn * 0.045]], 0.005, 'brass', { smooth: true, rs: 6, flat: 1 }));
  }
  parts.push(cyl(0, ny + nh + 0.01, 0, 0.026, 0.024, 0.026, 'brass'));
  parts.push(cyl(0, ny + 0.06, 0, 0.03, 0.05, 0.03, 'brass', { tint: [0.8, 0.8, 0.8] }));
  // cord and canopy
  parts.push(cyl(0, (ny + nh + 0.04 + h - 0.03) / 2, 0, 0.006, h - 0.03 - ny - nh - 0.04, 0.006, 'rubber', { seg: 8 }));
  parts.push(lathe(0, h - 0.035, 0, [[0, 0], [0.012, 0], [0.06, 0.025], [0.065, 0.035], [0, 0.035]], 'primary', { seg: 32 }));
  return parts;
}

/** Edison bulb: brass socket, amber glass globe or teardrop, glowing filament inside. Top of socket at (x,y,z). */
export function edisonBulb(x: number, y: number, z: number, kind: number): Part[] {
  const g = kind % 3;
  const prof: [number, number][] =
    g === 0
      ? [[0, 0], [0.012, 0], [0.016, -0.02], [0.034, -0.05], [0.038, -0.075], [0.03, -0.1], [0.012, -0.112], [0, -0.114]]
      : g === 1
        ? [[0, 0], [0.012, 0], [0.014, -0.02], [0.024, -0.06], [0.03, -0.11], [0.024, -0.14], [0, -0.15]]
        : [[0, 0], [0.012, 0], [0.018, -0.015], [0.05, -0.05], [0.055, -0.08], [0.045, -0.115], [0.02, -0.13], [0, -0.132]];
  return [
    cyl(x, y - 0.02, z, 0.026, 0.04, 0.026, 'rubber', { seg: 14 }),
    cyl(x, y - 0.042, z, 0.024, 0.006, 0.024, 'brass', { seg: 14 }),
    lathe(x, y - 0.04, z, prof, 'amber', { seg: 18 }),
    cyl(x, y - 0.04 + prof[prof.length - 1][1] * 0.45, z, 0.004, -prof[prof.length - 1][1] * 0.5, 0.004, 'ember', { seg: 4 }),
  ];
}

/** Wood beam chandelier: rough timber beam, black pulley brackets on chains, many cloth cords looping to Edison bulbs. Origin at the lowest bulb, h = drop to ceiling. */
export function beamChandelier(w: number, d: number, h: number, seed = 51): Part[] {
  const rnd = rand(seed);
  const parts: Part[] = [];
  const beamY = h * 0.48;
  const bw = w * 0.92;
  const bh = 0.16;
  const bd = Math.min(0.16, d * 0.25);
  parts.push(rbox(0, beamY, 0, bw, bh, bd, 0.012, 'secondary'));
  // pulley brackets, wheels and chains to the ceiling
  for (const sx of [-1, 1]) {
    const x = sx * bw * 0.36;
    for (const sz2 of [-1, 1]) parts.push(rbox(x, beamY + 0.02, sz2 * (bd / 2 + 0.006), 0.12, bh + 0.08, 0.008, 0.004, 'primary'));
    for (const sz2 of [-1, 1]) for (const by of [beamY - 0.03, beamY + 0.05]) parts.push(cyl(x - 0.035, by, sz2 * (bd / 2 + 0.012), 0.02, 0.01, 0.02, 'primary', { r: [Math.PI / 2, 0, 0], seg: 8 }));
    const wy = beamY + bh / 2 + 0.1;
    parts.push(torus(x, wy, 0, 0.07, 0.014, 'primary'));
    parts.push(cyl(x, wy, 0, 0.12, 0.02, 0.12, 'primary', { r: [Math.PI / 2, 0, 0], tint: [0.6, 0.6, 0.6] }));
    parts.push(cyl(x, wy, 0, 0.03, 0.05, 0.03, 'primary', { r: [Math.PI / 2, 0, 0] }));
    for (let k = 0; wy + 0.08 + k * 0.05 < h - 0.02; k++) parts.push(torus(x, wy + 0.08 + k * 0.05, 0, 0.016, 0.004, 'primary', { r: [0, k % 2 ? Math.PI / 2 : 0, 0] }));
    parts.push(cyl(x, h - 0.012, 0, 0.1, 0.024, 0.1, 'primary'));
  }
  // cords: each leaves the beam underside, loops down in a catenary and ends at a bulb
  const n = Math.round(bw / 0.05);
  for (let i = 0; i < n; i++) {
    const x0 = -bw * 0.42 + (i / (n - 1)) * bw * 0.84 + (rnd() - 0.5) * 0.02;
    const z0 = (rnd() - 0.5) * bd * 0.6;
    const drop = 0.15 + rnd() * (beamY - 0.2);
    const bx = x0 + (rnd() - 0.5) * 0.12;
    const bz = z0 + (rnd() - 0.5) * 0.18;
    const end: Vec3 = [bx, beamY - bh / 2 - drop, bz];
    const sag: Vec3 = [x0 + (bx - x0) * 0.5 + (rnd() - 0.5) * 0.1, beamY - bh / 2 - drop * 0.55, z0 + (bz - z0) * 0.5 + (rnd() - 0.5) * 0.05];
    // the cord wraps once over the beam before it drops
    const wrap: Vec3[] = [];
    for (let k = 0; k <= 10; k++) {
      const a = Math.PI * 0.5 + (k / 10) * Math.PI * 2;
      wrap.push([x0 + (k / 10) * 0.05 - 0.025, beamY + Math.sin(a) * (bh / 2 + 0.008), Math.cos(a) * (bd / 2 + 0.008)]);
    }
    parts.push(tube([...wrap, [x0 + 0.03, beamY - bh / 2 - 0.05, z0], sag, end], 0.0045, 'rubber', { smooth: true, rs: 5 }));
    parts.push(...edisonBulb(end[0], end[1], end[2], i));
  }
  return parts;
}

export const LIGHTING: CatalogItem[] = [
  {
    id: 'floor-lamp',
    name: 'Floor lamp',
    category: 'Lighting',
    size: sz(1.6, 1.6, 5.3),
    slots: { primary: { label: 'Metal', default: 'brass' } },
    parts: (w, d, h) => columnFloorLamp(w, d, h),
    solid: false,
    ref: 'Antique-brass column floor lamp with linen drum shade (Bed Bath & Beyond)',
  },
  {
    id: 'table-lamp',
    name: 'Table lamp',
    category: 'Lighting',
    size: sz(1.3, 1.3, 2.1),
    slots: { primary: { label: 'Ceramic', default: 'glaze-olive' } },
    parts: (w, d, h) => gourdTableLamp(w, d, h),
    solid: false,
    ref: 'Serena & Lily Como double-gourd table lamp with tapered shade',
  },
  {
    id: 'pendant',
    name: 'Dome pendant',
    category: 'Lighting',
    size: sz(1.2, 1.2, 3),
    slots: { primary: { label: 'Shade', default: 'black-metal' } },
    parts: (w, d, h) => domePendant(w, d, h),
    solid: false,
    defaultElevation: 1.6,
    ref: 'Black dome pendant with brass lining and brass cage neck (Home Depot)',
  },
  {
    id: 'chandelier',
    name: 'Timber chandelier',
    category: 'Lighting',
    size: sz(4.5, 1.6, 3.5),
    slots: { primary: { label: 'Hardware', default: 'black-metal' }, secondary: { label: 'Beam', default: 'timber-dark' } },
    parts: (w, d, h) => beamChandelier(w, d, h),
    solid: false,
    defaultElevation: 3,
    ref: 'Moonshine Lamp Co. wood beam farmhouse chandelier: pulleys, cloth cords, Edison bulbs',
  },
];

void rand;
void rbox;
void rod;
void ([] as Vec3[]);
