import { type Part, type Vec3, beam, box, cyl, ext, lathe, rand, rbox, rod, roundRect, sz, tube } from './kit';
import type { CatalogItem } from './types';

/** Open-front stackable storage bin (hopper front), opening facing +z. */
export function hopperBin(x: number, y: number, z: number, w: number, d: number, h: number, slot: Part['slot'] = 'rubber', tint?: Vec3): Part[] {
  const t = 0.006;
  const front = h * 0.45;
  return [
    box(x, y + t / 2, z, w, t, d, slot, { tint }),
    box(x, y + h / 2, z - d / 2 + t / 2, w, h, t, slot, { tint }),
    // sloped sides: extruded side profile
    ...[-1, 1].map((s) =>
      ext(x + s * (w / 2 - t / 2), y, z, [[-d / 2, 0], [d / 2, 0], [d / 2, front], [d / 2 - d * 0.35, h], [-d / 2, h]], t, slot, { r: [0, -Math.PI / 2, 0], tint }),
    ),
    box(x, y + front / 2, z + d / 2 - t / 2, w, front, t, slot, { tint }),
    // rolled top rim and a hand slot in the back wall
    box(x, y + h - 0.006, z - d * 0.17, w + 0.006, 0.012, d * 0.68, slot, { tint }),
    box(x, y + front - 0.004, z + d / 2 - 0.002, w + 0.004, 0.012, 0.012, slot, { tint }),
  ];
}

/** Boltless steel shelving: slotted angle uprights, step beams, particle-board decks, side X braces, loaded with bins and boxes. */
export function steelShelving(w: number, d: number, h: number, levels = 4, stocked = true): Part[] {
  const parts: Part[] = [];
  const up = 0.04;
  const xs = [-w / 2 + up / 2, w / 2 - up / 2];
  const zs = [-d / 2 + up / 2, d / 2 - up / 2];
  for (const x of xs)
    for (const z of zs) {
      parts.push(box(x, h / 2, z, up, h, 0.004, 'primary'));
      parts.push(box(x + (x < 0 ? 1 : -1) * 0.0, h / 2, z, 0.004, h, up, 'primary'));
      // slot pattern on the face
      for (let k = 0; k < Math.floor(h / 0.05); k++) parts.push(box(x, 0.03 + k * 0.05, z + (z > 0 ? 0.0025 : -0.0025), 0.008, 0.022, 0.001, 'rubber', { tint: [0.3, 0.3, 0.3] }));
      parts.push(rbox(x, 0.006, z, up + 0.012, 0.012, up + 0.012, 0.003, 'rubber'));
    }
  const rnd = rand(17);
  for (let i = 0; i < levels; i++) {
    const y = 0.12 + (i * (h - 0.16)) / (levels - 1);
    // step beams front and back, side beams
    for (const z of zs) parts.push(box(0, y - 0.025, z, w - up * 2, 0.05, 0.03, 'primary'));
    for (const x of xs) parts.push(box(x, y - 0.025, 0, 0.03, 0.05, d - up * 2, 'primary'));
    parts.push(box(0, y - 0.004, 0, w - up * 2, 0.016, d - up * 2, 'secondary'));
    if (!stocked || i === levels - 1 || y > h - 0.1) continue;
    const bay = (h - 0.16) / (levels - 1) - 0.06;
    let x = -w / 2 + up + 0.02;
    while (x < w / 2 - up - 0.2) {
      const kind = rnd();
      if (kind < 0.45) {
        const bw = Math.min(0.38, w / 2 - up - x - 0.01);
        parts.push(...hopperBin(x + bw / 2, y + 0.004, 0.02, bw, d - 0.12, Math.min(0.22, bay * 0.6), 'rubber'));
        x += bw + 0.03;
      } else if (kind < 0.8) {
        const bw = Math.min(0.3 + rnd() * 0.15, w / 2 - up - x - 0.01);
        const bh = Math.min(bay * 0.85, 0.2 + rnd() * 0.15);
        parts.push(rbox(x + bw / 2, y + 0.004 + bh / 2, 0, bw, bh, d - 0.14, 0.004, 'paper', { tint: [0.72, 0.58, 0.4] }));
        parts.push(box(x + bw / 2, y + 0.004 + bh - 0.03, d / 2 - 0.069, bw, 0.03, 0.002, 'paper', { tint: [0.6, 0.48, 0.32] }));
        x += bw + 0.025;
      } else {
        // paint cans
        for (let k = 0; k < 2; k++) parts.push(cyl(x + 0.09 + k * 0.18, y + 0.1, 0.02, 0.16, 0.19, 0.16, 'chrome', { tint: [0.85, 0.85, 0.85] }));
        x += 0.4;
      }
    }
  }
  // side X braces
  for (const x of xs) {
    parts.push(rod([x, 0.12, -d / 2 + up], [x, h * 0.55, d / 2 - up], 0.008, 'primary'));
    parts.push(rod([x, 0.12, d / 2 - up], [x, h * 0.55, -d / 2 + up], 0.008, 'primary'));
  }
  return parts;
}

/** Workbench: wood top, black steel frame with drawer apron, two lower shelves stocked with bins and toolboxes, black pegboard hood with canopy and colourful tools. */
export function workbench(w: number, d: number, h: number): Part[] {
  const parts: Part[] = [];
  const t = 0.035;
  const rnd = rand(5);
  // wood top in strips
  const strips = Math.round(d / 0.06);
  for (let i = 0; i < strips; i++) {
    const z = -d / 2 + (i + 0.5) * (d / strips);
    parts.push(rbox(0, h - t / 2, z, w, t, d / strips - 0.0008, 0.002, 'primary', { tint: [0.92 + (i % 3) * 0.05, 0.92 + (i % 2) * 0.04, 0.9] }));
  }
  // frame: four square legs, casters
  const lx = w / 2 - 0.03;
  const lz = d / 2 - 0.03;
  const castH = 0.09;
  for (const sx of [-1, 1])
    for (const sz2 of [-1, 1]) {
      parts.push(box(sx * lx, castH + (h - t - castH) / 2, sz2 * lz, 0.04, h - t - castH, 0.04, 'secondary'));
      parts.push(box(sx * lx, castH - 0.006, sz2 * lz, 0.06, 0.008, 0.06, 'chrome'));
      parts.push(cyl(sx * lx, castH - 0.03, sz2 * lz, 0.03, 0.04, 0.03, 'chrome'));
      parts.push(cyl(sx * lx, 0.035, sz2 * lz + 0.015, 0.07, 0.03, 0.07, 'rubber', { r: [0, 0, Math.PI / 2] }));
    }
  // drawer apron with two drawers and chrome label pulls
  const apY = h - t - 0.07;
  parts.push(box(0, apY, 0, w - 0.08, 0.13, d - 0.06, 'secondary'));
  for (const sx of [-1, 1]) {
    parts.push(rbox(sx * w * 0.24, apY, d / 2 - 0.028, w * 0.44, 0.11, 0.012, 0.003, 'secondary', { tint: [1.2, 1.2, 1.2] }));
    parts.push(rbox(sx * w * 0.24, apY, d / 2 - 0.018, 0.12, 0.03, 0.01, 0.004, 'chrome'));
  }
  // two shelves with lips
  for (const y of [0.18, h * 0.5]) {
    parts.push(box(0, y, 0, w - 0.06, 0.02, d - 0.06, 'secondary', { tint: [1.4, 1.4, 1.4] }));
    for (const sz2 of [-1, 1]) parts.push(box(0, y + 0.015, sz2 * (d / 2 - 0.035), w - 0.06, 0.03, 0.012, 'secondary'));
  }
  // middle shelf: coloured stacking bins; bottom shelf: toolboxes
  const binCols: Vec3[] = [[0.2, 0.35, 0.85], [0.95, 0.75, 0.15], [0.85, 0.15, 0.12], [0.2, 0.35, 0.85]];
  for (let i = 0; i < 3; i++) parts.push(...hopperBin(-w * 0.32 + i * 0.16, h * 0.5 + 0.01, 0.02, 0.15, Math.min(0.28, d - 0.12), 0.15, 'plastic', binCols[i]));
  parts.push(rbox(w * 0.18, h * 0.5 + 0.06, 0, 0.18, 0.1, 0.06, 0.012, 'plastic', { tint: [0.95, 0.75, 0.15] }));
  parts.push(rbox(-w * 0.28, 0.32, 0, 0.42, 0.18, d * 0.6, 0.015, 'rubber'));
  parts.push(rbox(-w * 0.28, 0.42, 0, 0.18, 0.025, 0.04, 0.01, 'rubber'));
  parts.push(rbox(w * 0.15, 0.3, 0, 0.32, 0.22, d * 0.55, 0.015, 'rubber', { tint: [1.5, 1.5, 1.5] }));
  parts.push(rbox(w * 0.36, 0.28, 0, 0.14, 0.18, 0.12, 0.012, 'rubber'));
  // pegboard hood: side posts, black pegboard, canopy with light
  const ph = 0.75;
  const pz = -d / 2 + 0.02;
  for (const sx of [-1, 1]) parts.push(box(sx * lx, h + ph / 2, pz, 0.035, ph, 0.035, 'secondary'));
  parts.push(box(0, h + ph / 2, pz, w - 0.06, ph - 0.02, 0.012, 'secondary', { tint: [1.3, 1.3, 1.3] }));
  for (let i = 0; i < 28; i++) for (let j = 0; j < 9; j++) parts.push(box(-w * 0.45 + (i * w * 0.9) / 27, h + 0.06 + j * 0.075, pz + 0.007, 0.008, 0.008, 0.001, 'paper', { tint: [0.15, 0.15, 0.15] }));
  parts.push(ext(0, h + ph, pz + 0.06, [[-w / 2, 0], [w / 2, 0], [w / 2, 0.012], [-w / 2, 0.012]], 0.16, 'secondary', { r: [-0.25, 0, 0] }));
  parts.push(box(0, h + ph - 0.03, pz + 0.07, w * 0.8, 0.006, 0.02, 'glow'));
  // tools hanging on the board
  const tools: { x: number; y: number; parts: Part[] }[] = [];
  const tool = (x: number, y: number, ps: Part[]) => tools.push({ x, y, parts: ps });
  tool(-0.42, 0.55, [rbox(0, 0, 0, 0.025, 0.2, 0.02, 0.005, 'plastic', { tint: [0.85, 0.15, 0.1] }), box(0, 0.13, 0, 0.09, 0.025, 0.02, 'chrome')]);
  tool(-0.34, 0.5, [rod([-0.02, -0.08, 0], [0.01, 0.08, 0], 0.014, 'plastic', { tint: [0.85, 0.15, 0.1] }), rod([0.02, -0.08, 0], [-0.01, 0.08, 0], 0.014, 'plastic', { tint: [0.85, 0.15, 0.1] }), box(0, 0.11, 0, 0.02, 0.05, 0.012, 'chrome')]);
  tool(-0.26, 0.52, [rbox(0, 0, 0, 0.03, 0.12, 0.025, 0.008, 'plastic', { tint: [0.95, 0.75, 0.1] }), rod([0, 0.06, 0], [0, 0.18, 0], 0.008, 'chrome')]);
  tool(-0.18, 0.52, [rbox(0, 0, 0, 0.03, 0.12, 0.025, 0.008, 'plastic', { tint: [0.95, 0.75, 0.1] }), rod([0, 0.06, 0], [0, 0.16, 0], 0.008, 'chrome')]);
  tool(-0.08, 0.6, [rbox(0, 0, 0, 0.3, 0.025, 0.02, 0.006, 'plastic', { tint: [0.2, 0.55, 0.85] })]);
  tool(-0.05, 0.38, [rbox(0, 0, 0, 0.1, 0.08, 0.05, 0.01, 'plastic', { tint: [0.55, 0.8, 0.2] }), rbox(0.02, -0.07, 0, 0.035, 0.1, 0.035, 0.008, 'plastic', { tint: [0.15, 0.15, 0.15] })]);
  tool(0.08, 0.45, [torus2(0, 0, 0, 0.05, 0.012)]);
  for (let k = 0; k < 6; k++) tool(0.16 + k * 0.035, 0.5, [rod([0, -0.08, 0], [0, 0.08, 0], 0.008, 'chrome'), rbox(0, 0.09, 0, 0.018, 0.03, 0.01, 0.003, 'chrome')]);
  tool(0.42, 0.42, [rbox(0, 0, 0, 0.14, 0.1, 0.07, 0.015, 'plastic', { tint: [0.95, 0.75, 0.1] }), rod([0.07, 0.03, 0], [0.18, 0.03, 0], 0.012, 'chrome'), rbox(-0.02, -0.08, 0, 0.04, 0.12, 0.04, 0.01, 'plastic', { tint: [0.15, 0.15, 0.15] })]);
  for (const tl of tools) {
    const ox = tl.x * w;
    const oy = h + 0.04 + tl.y * ph * 0.8;
    for (const p of tl.parts) parts.push({ ...p, p: [p.p[0] + ox, p.p[1] + oy, p.p[2] + pz + 0.03] as Vec3 });
  }
  // a drill and tape on the bench top
  parts.push(rbox(w * 0.3, h + 0.07, 0.05, 0.14, 0.1, 0.06, 0.02, 'plastic', { tint: [0.95, 0.75, 0.1] }));
  parts.push(cyl(-w * 0.15, h + 0.03, 0.08, 0.06, 0.06, 0.06, 'plastic', { tint: [0.95, 0.75, 0.1] }));
  void rnd;
  return parts;
}

function torus2(x: number, y: number, z: number, R: number, r: number): Part {
  return { s: 'torus', p: [x, y, z], R, rad: r, slot: 'plastic', tint: [0.9, 0.5, 0.1] } as Part;
}

/** Tall steel storage cabinet: two full-height louvered doors (angled slats in a frame), short vertical handles, key lock, plinth. */
export function steelCabinet(w: number, d: number, h: number): Part[] {
  const parts: Part[] = [];
  const plinth = 0.06;
  parts.push(box(0, plinth / 2, -0.01, w - 0.02, plinth, d - 0.04, 'primary', { tint: [0.8, 0.8, 0.8] }));
  parts.push(rbox(0, plinth + (h - plinth) / 2, 0, w, h - plinth, d, 0.004, 'primary'));
  const gap = 0.004;
  const dw = (w - 0.02 - gap) / 2;
  const y0 = plinth + 0.015;
  const y1 = h - 0.015;
  const fr = 0.03;
  for (const sx of [-1, 1]) {
    const x = sx * (dw / 2 + gap / 2);
    const zf = d / 2 + 0.006;
    // door frame
    parts.push(box(x, y1 - fr / 2, zf, dw, fr, 0.012, 'primary', { tint: [1.1, 1.1, 1.1] }));
    parts.push(box(x, y0 + fr / 2, zf, dw, fr, 0.012, 'primary', { tint: [1.1, 1.1, 1.1] }));
    parts.push(box(x - dw / 2 + fr / 2, (y0 + y1) / 2, zf, fr, y1 - y0, 0.012, 'primary', { tint: [1.1, 1.1, 1.1] }));
    parts.push(box(x + dw / 2 - fr / 2, (y0 + y1) / 2, zf, fr, y1 - y0, 0.012, 'primary', { tint: [1.1, 1.1, 1.1] }));
    // dark cavity behind the louvers, then angled slats
    parts.push(box(x, (y0 + y1) / 2, zf - 0.008, dw - 2 * fr, y1 - y0 - 2 * fr, 0.004, 'rubber'));
    const n = Math.floor((y1 - y0 - 2 * fr) / 0.042);
    for (let i = 0; i < n; i++) {
      const y = y0 + fr + 0.021 + i * ((y1 - y0 - 2 * fr) / n);
      parts.push(box(x, y, zf - 0.002, dw - 2 * fr, 0.038, 0.004, 'primary', { r: [-0.55, 0, 0], tint: [1.2, 1.2, 1.2] }));
    }
    parts.push(rbox(sx * 0.035, h * 0.52, d / 2 + 0.03, 0.016, 0.15, 0.016, 0.006, 'rubber'));
    for (const e of [-1, 1]) parts.push(rod([sx * 0.035, h * 0.52 + e * 0.055, d / 2 + 0.012], [sx * 0.035, h * 0.52 + e * 0.055, d / 2 + 0.03], 0.012, 'rubber'));
  }
  parts.push(cyl(0.035, h * 0.45, d / 2 + 0.014, 0.022, 0.012, 0.022, 'chrome', { r: [Math.PI / 2, 0, 0] }));
  parts.push(box(0.035, h * 0.45, d / 2 + 0.021, 0.003, 0.012, 0.002, 'rubber'));
  return parts;
}

/** Theater riser: upholstered box with a soft top edge, a half-height step block at the +x end, warm step light. */
export function riserPlatform(w: number, d: number, h: number): Part[] {
  const stepW = Math.min(0.45, w * 0.15);
  const bw = w - stepW;
  const bx = -stepW / 2;
  return [
    box(bx, (h - 0.03) / 2, 0, bw, h - 0.03, d, 'secondary'),
    rbox(bx, h - 0.02, 0, bw + 0.006, 0.04, d + 0.006, 0.012, 'primary'),
    // step block at the end
    rbox(w / 2 - stepW / 2, h / 4, d / 2 - 0.3, stepW, h / 2, 0.6, 0.012, 'secondary'),
    rbox(w / 2 - stepW / 2, h / 2 - 0.01, d / 2 - 0.3, stepW + 0.004, 0.02, 0.604, 0.008, 'primary'),
    box(w / 2 - stepW / 2, h / 2 - 0.03, d / 2 + 0.002, stepW - 0.06, 0.01, 0.004, 'glow'),
    box(bx, h - 0.05, d / 2 + 0.002, bw - 0.06, 0.01, 0.004, 'glow'),
  ];
}

export const STORAGE: CatalogItem[] = [
  {
    id: 'shelving',
    name: 'Steel shelving',
    category: 'Storage',
    size: sz(6.4, 2, 6.4),
    slots: { primary: { label: 'Frame', default: 'powder-charcoal' }, secondary: { label: 'Decks', default: 'black-wood' } },
    parts: (w, d, h) => steelShelving(w, d, h, 4),
    solid: true,
    ref: 'Husky 77 in four-shelf black steel unit with stackable hopper bins (Home Depot)',
  },
  {
    id: 'workbench',
    name: 'Workbench',
    category: 'Storage',
    size: sz(6, 2, 3.1),
    slots: { primary: { label: 'Top', default: 'oak-natural' }, secondary: { label: 'Frame', default: 'black-metal' } },
    parts: (w, d, h) => workbench(w, d, h),
    solid: true,
    ref: 'Sunvasagoo rolling workbench: wood top, drawers, two shelves, black pegboard hood with tools (Home Depot)',
  },
  {
    id: 'storage-bin',
    name: 'Steel cabinet',
    category: 'Storage',
    size: sz(3, 1.6, 6.5),
    slots: { primary: { label: 'Body', default: 'powder-charcoal' } },
    parts: (w, d, h) => steelCabinet(w, d, h),
    solid: true,
    ref: 'Home Depot 71 in black steel garage cabinet with full louvered doors, lock',
  },
  {
    id: 'platform',
    name: 'Raised platform',
    category: 'Storage',
    size: { w: 12 * 0.3048, d: 5 * 0.3048, h: 0.4 },
    slots: { primary: { label: 'Top', default: 'fabric-charcoal' }, secondary: { label: 'Upholstery', default: 'black-wood' } },
    parts: (w, d, h) => riserPlatform(w, d, h),
    solid: false,
    flat: true,
    ref: 'Theater Seat Store upholstered riser platform with end step',
  },
];

void beam;
void lathe;
void roundRect;
