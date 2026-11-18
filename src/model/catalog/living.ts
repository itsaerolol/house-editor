import { type Part, type Vec3, beam, blob, bookRow, box, cushion, cyl, ext, flutes, lathe, leafAt, ledgestone, rand, rbox, rod, rotateX, sph, subtractRects, sz, torus, tube, welt } from './kit';
import type { CatalogItem } from './types';

/* ------------------------------------------------------------------ sofa family */

export interface SofaOpts {
  /** seat cushions across */
  seats: number;
  /** back pillows across */
  backs: number;
  /** arm thickness as a share of width */
  armRatio?: number;
  /** leg height in m */
  legH?: number;
  /** arm top height as a share of total height */
  armTop?: number;
}

/** Track-arm sofa: square upholstered arms, bench or split seat with welting, loose back pillows, splayed tapered legs. */
export function trackArmSofa(w: number, d: number, h: number, o: SofaOpts): Part[] {
  const parts: Part[] = [];
  const legH = o.legH ?? Math.min(0.17, h * 0.19);
  const a = Math.min(0.17, Math.max(0.1, w * (o.armRatio ?? 0.062)));
  const railH = 0.075;
  const deck = legH + railH;
  const ct = 0.175;
  const seatTop = deck + ct;
  const armTop = h * (o.armTop ?? 0.71);
  const bt = 0.15; // back frame thickness
  const backTop = Math.min(h - 0.12, armTop + 0.08);
  const sw = w - 2 * a;

  // legs: tapered, splayed, set in from the corners
  const lx = w / 2 - 0.07;
  const lz = d / 2 - 0.07;
  for (const sx of [-1, 1])
    for (const sz2 of [-1, 1])
      parts.push(cyl(sx * lx, legH / 2, sz2 * lz, 0.03, legH, 0.03, 'secondary', { taper: 1.55, r: [sz2 * 0.09, 0, -sx * 0.09] }));

  // seat rail (upholstered) and arms
  parts.push(rbox(0, legH + railH / 2, 0, sw + 0.004, railH, d - 0.004, 0.02, 'primary'));
  for (const sx of [-1, 1]) {
    parts.push(cushion(sx * (w / 2 - a / 2), legH + (armTop - legH) / 2, 0, a, armTop - legH, d, 0.035, 0.006, 'primary'));
    // welt along the arm's top outer edges
    parts.push(tube([[sx * (w / 2 - 0.004), armTop - 0.012, d / 2 - 0.02], [sx * (w / 2 - 0.004), armTop - 0.012, -d / 2 + 0.02]], 0.005, 'primary'));
    parts.push(tube([[sx * (w / 2 - a + 0.004), armTop - 0.012, d / 2 - 0.02], [sx * (w / 2 - a + 0.004), armTop - 0.012, -d / 2 + 0.02]], 0.005, 'primary'));
  }
  // back frame
  parts.push(cushion(0, deck + (backTop - deck) / 2, -d / 2 + bt / 2, sw, backTop - deck, bt, 0.04, 0.01, 'primary'));

  // seat cushions with welting on the front edges
  const cd = d - bt - 0.01;
  const cz = -d / 2 + bt + cd / 2;
  const gap = 0.006;
  const cw = (sw - gap * (o.seats - 1)) / o.seats;
  for (let i = 0; i < o.seats; i++) {
    const x = -sw / 2 + cw / 2 + i * (cw + gap);
    parts.push(cushion(x, deck + ct / 2, cz, cw, ct, cd, 0.035, 0.016, 'primary', { sag: 0.012 }));
    for (const y of [seatTop - 0.008, deck + 0.012])
      parts.push(tube([[x - cw / 2 + 0.03, y, d / 2 - 0.012], [x + cw / 2 - 0.03, y, d / 2 - 0.012]], 0.0055, 'primary'));
  }

  // loose back pillows, leaning back
  const pt = 0.2;
  const ph = h - seatTop + 0.01;
  const pw = (sw - 0.012 * (o.backs - 1)) / o.backs;
  for (let i = 0; i < o.backs; i++) {
    const x = -sw / 2 + pw / 2 + i * (pw + 0.012);
    parts.push(cushion(x, seatTop + ph / 2 - 0.02, -d / 2 + bt + pt / 2 - 0.02, pw - 0.01, ph, pt, 0.075, 0.045, 'primary', { r: [-0.13, 0, 0] }));
  }
  return parts;
}

/** Chaise sectional (chaise on the right, +x): low track arms, tall boxy back cushions, deep plinth, block feet. */
export function chaiseSectional(w: number, d: number, h: number): Part[] {
  const parts: Part[] = [];
  const foot = 0.045;
  const deck = h * 0.36;
  const ct = h * 0.17;
  const seatTop = deck + ct;
  const armTop = h * 0.71;
  const a = Math.min(0.16, w * 0.05);
  const bd = Math.min(d, 1.0); // depth of the back section
  const bt = 0.17;
  const cw = Math.min(1.0, w * 0.32); // chaise width
  const zb = -d / 2; // back plane
  const zf = zb + bd; // front of the back section
  // block feet
  for (const [x, z] of [
    [-w / 2 + 0.06, zb + 0.06],
    [-w / 2 + 0.06, zf - 0.06],
    [w / 2 - 0.06, zb + 0.06],
    [w / 2 - 0.06, d / 2 - 0.06],
    [w / 2 - cw + 0.06, d / 2 - 0.06],
    [0, zb + 0.06],
  ] as [number, number][])
    parts.push(rbox(x, foot / 2, z, 0.05, foot, 0.05, 0.006, 'secondary'));
  // plinth bases
  parts.push(cushion(-cw / 2, foot + (deck - foot) / 2, zb + bd / 2, w - cw, deck - foot, bd, 0.025, 0.004, 'primary'));
  parts.push(cushion(w / 2 - cw / 2, foot + (deck - foot) / 2, (zb + d / 2) / 2, cw, deck - foot, d, 0.025, 0.004, 'primary'));
  // arms (the right arm sits beside the chaise back only)
  for (const sx of [-1, 1]) {
    const x = sx * (w / 2 - a / 2);
    parts.push(cushion(x, deck + (armTop - deck) / 2 - 0.001, zb + bd / 2, a, armTop - deck, bd, 0.035, 0.008, 'primary'));
    parts.push(tube([[x - a / 2 + 0.006, armTop - 0.01, zf - 0.02], [x - a / 2 + 0.006, armTop - 0.01, zb + 0.02]], 0.005, 'primary'));
    parts.push(tube([[x + a / 2 - 0.006, armTop - 0.01, zf - 0.02], [x + a / 2 - 0.006, armTop - 0.01, zb + 0.02]], 0.005, 'primary'));
  }
  // back frame between the arms
  const backTop = armTop + 0.04;
  parts.push(cushion(0, deck + (backTop - deck) / 2, zb + bt / 2, w - 2 * a, backTop - deck, bt, 0.04, 0.008, 'primary'));
  // seat cushions: two on the sofa run, one long chaise cushion
  const runW = w - cw - a;
  const sw = (runW - 0.008) / 2;
  for (let i = 0; i < 2; i++) {
    const x = -w / 2 + a + sw / 2 + i * (sw + 0.008);
    parts.push(cushion(x, deck + ct / 2, zb + bt + (bd - bt) / 2, sw, ct, bd - bt - 0.004, 0.045, 0.024, 'primary', { sag: 0.01 }));
  }
  const chx = w / 2 - cw / 2 - 0.002;
  parts.push(cushion(chx - a / 2, deck + ct / 2, zb + bt + (bd - bt) / 2, cw - a - 0.006, ct, bd - bt - 0.004, 0.04, 0.018, 'primary', { sag: 0.006 }));
  parts.push(cushion(chx, deck + ct / 2, (zf + d / 2) / 2, cw - 0.004, ct, d / 2 - zf - 0.004, 0.04, 0.018, 'primary', { sag: 0.008 }));
  // three tall, boxy back cushions across the full back
  const bw = (w - 2 * a - 0.016) / 3;
  const ph = h - seatTop + 0.015;
  for (let i = 0; i < 3; i++) {
    const x = -w / 2 + a + bw / 2 + i * (bw + 0.008);
    parts.push(cushion(x, seatTop + ph / 2 - 0.02, zb + bt + 0.08, bw - 0.004, ph, 0.22, 0.075, 0.042, 'primary', { r: [-0.12, 0, 0] }));
  }
  return parts;
}

/** Mid-century lounge chair: exposed hardwood frame, flat arm boards, welted box cushions. */
export function woodFrameLounge(w: number, d: number, h: number): Part[] {
  const parts: Part[] = [];
  const xs = w / 2 - 0.03;
  const seatY = h * 0.455;
  const armY = h * 0.69;
  const zf = d / 2 - 0.13;
  const zr = -d / 2 + 0.1;
  const zPost = -d / 2 + 0.2;
  for (const sx of [-1, 1]) {
    const x = sx * xs;
    // front leg, leaning back slightly as it rises to the arm
    parts.push(beam([x, 0, zf], [x, seatY - 0.06, zf - 0.015], 0.035, 0.045, 'secondary', 0.006));
    // arm support springing forward from the seat rail to the arm board
    parts.push(beam([x, seatY - 0.12, zf - 0.04], [x, armY + 0.004, zf + 0.04], 0.032, 0.04, 'secondary', 0.006));
    // rear leg rising forward, then the back post leaning back
    const knee: Vec3 = [x, seatY - 0.08, zPost];
    parts.push(beam([x, 0, zr], knee, 0.035, 0.045, 'secondary', 0.006));
    parts.push(beam(knee, [x, h - 0.16, -d / 2 + 0.06], 0.035, 0.045, 'secondary', 0.006));
    // flat arm board, slightly rising toward its rounded front
    parts.push(beam([x, armY - 0.004, zPost - 0.04], [x, armY + 0.012, d / 2 - 0.02], 0.075, 0.028, 'secondary', 0.012));
    // side seat rail
    parts.push(beam([x, seatY - 0.12, zf - 0.03], [x, seatY - 0.1, zPost + 0.01], 0.03, 0.065, 'secondary', 0.005));
  }
  // front and rear aprons, back support rail
  parts.push(beam([-xs, seatY - 0.12, zf - 0.02], [xs, seatY - 0.12, zf - 0.02], 0.065, 0.028, 'secondary', 0.005));
  parts.push(beam([-xs, seatY - 0.12, zPost], [xs, seatY - 0.12, zPost], 0.065, 0.028, 'secondary', 0.005));
  parts.push(beam([-xs, armY + 0.02, -d / 2 + 0.11], [xs, armY + 0.02, -d / 2 + 0.11], 0.05, 0.025, 'secondary', 0.005));

  // seat cushion with top and bottom welting
  const cw = w - 0.105;
  const cd = d - 0.29;
  const ct = 0.15;
  const cy = seatY - ct / 2 + 0.025;
  const cz = 0.035;
  parts.push(cushion(0, cy, cz, cw, ct, cd, 0.03, 0.012, 'primary', { sag: 0.008 }));
  parts.push(welt([0, cy + ct / 2 - 0.004, cz], cw - 0.012, cd - 0.012, 0.0055, 'primary', 0.03));
  parts.push(welt([0, cy - ct / 2 + 0.006, cz], cw - 0.01, cd - 0.01, 0.0055, 'primary', 0.03));

  // reclined back cushion with welting on its front face
  const tilt = -0.27;
  const bh = h - seatY + 0.02;
  const bt = 0.115;
  const bc: Vec3 = [0, seatY + bh / 2 - 0.02, -d / 2 + 0.15];
  parts.push(cushion(bc[0], bc[1], bc[2], cw - 0.01, bh, bt, 0.045, 0.016, 'primary', { r: [tilt, 0, 0] }));
  const off = bt / 2 - 0.004;
  parts.push(welt([bc[0], bc[1] - Math.sin(tilt) * off, bc[2] + Math.cos(tilt) * off], cw - 0.03, bh - 0.04, 0.0055, 'primary', 0.03, [tilt + Math.PI / 2, 0, 0]));
  return parts;
}

/** Bowtie (butterfly) key inlay outline. */
export function bowtie(len: number, wid: number): [number, number][] {
  const n = wid * 0.32;
  return [
    [-len / 2, -wid / 2],
    [0, -n / 2],
    [len / 2, -wid / 2],
    [len / 2, wid / 2],
    [0, n / 2],
    [-len / 2, wid / 2],
  ];
}

/** Rectangular steel loop leg (square tube) in the local YZ plane at x. */
export function loopLeg(x: number, y0: number, y1: number, z0: number, z1: number, t: number, slot: Part['slot']): Part[] {
  const h = t / 2;
  return [
    beam([x, y0 + h, z0], [x, y0 + h, z1], t, t, slot, 0.002),
    beam([x, y1 - h, z0], [x, y1 - h, z1], t, t, slot, 0.002),
    beam([x, y0, z0 + h], [x, y1, z0 + h], t, t, slot, 0.002),
    beam([x, y0, z1 - h], [x, y1, z1 - h], t, t, slot, 0.002),
  ];
}

/** Thick walnut slab on two square-tube loop legs, with bowtie keys across a check. */
export function slabTable(w: number, d: number, h: number, slabT = 0.05, keys = 2): Part[] {
  const parts: Part[] = [];
  parts.push(rbox(0, h - slabT / 2, 0, w, slabT, d, 0.006, 'primary'));
  const li = Math.min(0.1, w * 0.06);
  for (const sx of [-1, 1]) parts.push(...loopLeg(sx * (w / 2 - li), 0, h - slabT, -d / 2 + 0.04, d / 2 - 0.04, 0.025, 'secondary'));
  // a natural check filled with amber resin, plus a few dark knots
  const y = h + 0.0004;
  parts.push(tube([[-w * 0.4, y, d * 0.05], [-w * 0.14, y, d * 0.11], [w * 0.12, y, d * 0.06], [w * 0.36, y, -d * 0.06]], 0.0035, 'brass', { smooth: true, rs: 4 }));
  const knots: [number, number, number, number][] = [
    [-w * 0.3, -d * 0.18, 0.03, 0.02],
    [w * 0.42, d * 0.33, 0.022, 0.014],
    [-w * 0.44, -d * 0.4, 0.018, 0.012],
    [w * 0.2, -d * 0.3, 0.014, 0.01],
  ];
  for (const [kx, kz, a1, a2] of knots.slice(0, keys + 2)) parts.push(cyl(kx, h - 0.0005, kz, a1 * 2, 0.0025, a2 * 2, 'rubber', { seg: 14, tint: [0.75, 0.6, 0.5] }));
  return parts;
}

/** Mid-century tripod side table: round top with a chamfered underside, three splayed tapered legs. */
export function tripodTable(w: number, d: number, h: number): Part[] {
  const r = Math.min(w, d) / 2;
  const parts: Part[] = [];
  parts.push(
    lathe(0, 0, 0, [
      [0, h - 0.03],
      [r - 0.035, h - 0.03],
      [r - 0.004, h - 0.021],
      [r, h - 0.016],
      [r, h - 0.005],
      [r - 0.004, h],
      [0, h],
    ], 'primary', { sx: w / 2 / r, sz: d / 2 / r }),
  );
  parts.push(cyl(0, h - 0.04, 0, r * 1.05, 0.02, r * 1.05, 'secondary'));
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 2 + (i * 2 * Math.PI) / 3;
    const top: Vec3 = [Math.cos(a) * r * 0.4, h - 0.04, Math.sin(a) * r * 0.4];
    const foot: Vec3 = [Math.cos(a) * r * 0.9, 0.012, Math.sin(a) * r * 0.9];
    parts.push(rod(foot, top, 0.02, 'secondary', { taper: 1.8 }));
    parts.push(rod([foot[0], 0, foot[2]], foot, 0.019, 'rubber', { seg: 12 }));
  }
  return parts;
}

/** Small ceramic bud vase. */
export function vase(x: number, y: number, z: number, hgt: number, slot: Part['slot'] = 'ceramic', tint?: Vec3): Part {
  const r = hgt * 0.32;
  return lathe(x, y, z, [
    [0, 0],
    [r * 0.7, 0],
    [r, hgt * 0.25],
    [r * 0.95, hgt * 0.55],
    [r * 0.42, hgt * 0.85],
    [r * 0.45, hgt],
    [r * 0.36, hgt],
    [r * 0.3, hgt * 0.88],
  ], slot, { tint });
}

/** Shallow bowl. */
export function bowl(x: number, y: number, z: number, dia: number, slot: Part['slot'] = 'ceramic', tint?: Vec3): Part {
  const r = dia / 2;
  return lathe(x, y, z, [
    [0, 0],
    [r * 0.35, 0],
    [r * 0.8, r * 0.18],
    [r, r * 0.42],
    [r * 0.94, r * 0.42],
    [r * 0.75, r * 0.22],
    [0, r * 0.18],
  ], slot, { tint });
}

/** Media console: fluted walnut doors either side of an open shelf bay, splayed black legs, thin TV above. */
export function mediaConsole(w: number, d: number, h: number): Part[] {
  const parts: Part[] = [];
  const legH = 0.13;
  const top = 0.025;
  const ch = h - legH; // carcass height
  const y0 = legH;
  const zf = d / 2;
  const sideT = 0.02;
  // carcass
  parts.push(rbox(0, h - top / 2, 0, w, top, d, 0.004, 'accent'));
  parts.push(rbox(0, y0 + 0.01, 0, w - 0.01, 0.02, d - 0.01, 0.002, 'primary'));
  for (const sx of [-1, 1]) parts.push(rbox(sx * (w / 2 - sideT / 2), y0 + ch / 2 - top / 2, 0, sideT, ch - top, d - 0.004, 0.003, 'primary'));
  parts.push(box(0, y0 + ch / 2, -d / 2 + 0.006, w - 0.02, ch - 0.01, 0.012, 'primary', { tint: [0.55, 0.5, 0.48] }));
  // doors: fluted panels on the outer thirds
  const dw = w * 0.32;
  const doorY0 = y0 + 0.025;
  const doorY1 = h - top - 0.004;
  for (const sx of [-1, 1]) {
    const xc = sx * (w / 2 - sideT - dw / 2);
    parts.push(box(xc, (doorY0 + doorY1) / 2, zf - 0.012, dw - 0.006, doorY1 - doorY0, 0.018, 'primary'));
    parts.push(...flutes(xc - dw / 2 + 0.004, xc + dw / 2 - 0.004, doorY0 + 0.004, doorY1 - 0.004, zf - 0.002, 0.036, 'primary'));
    // dividers and bar pull on the inner edge
    parts.push(box(xc - sx * (dw / 2 + 0.008), y0 + ch / 2, 0, 0.018, ch - top - 0.02, d - 0.03, 'primary'));
    parts.push(rbox(xc - sx * (dw / 2 - 0.03), (doorY0 + doorY1) / 2 + 0.02, zf + 0.012, 0.011, 0.1, 0.012, 0.005, 'metal'));
  }
  // open bay: middle shelf, books and a few objects
  const bayW = w - 2 * (sideT + dw + 0.017);
  const shelfY = y0 + ch * 0.48;
  parts.push(box(0, shelfY, 0.01, bayW, 0.018, d - 0.05, 'primary'));
  parts.push(...bookRow(-bayW / 2 + 0.02, -bayW * 0.05, shelfY + 0.009, zf - 0.07, 0.17, ch * 0.42, 7));
  parts.push(rbox(bayW * 0.25, shelfY + 0.03, 0.02, 0.14, 0.04, 0.2, 0.004, 'paper', { tint: [0.9, 0.88, 0.82] }));
  parts.push(rbox(bayW * 0.25, shelfY + 0.065, 0.02, 0.12, 0.03, 0.17, 0.004, 'paper', { tint: [0.2, 0.2, 0.22] }));
  parts.push(vase(bayW * 0.3, y0 + 0.02, 0.02, 0.14, 'ceramic', [0.62, 0.6, 0.56]));
  parts.push(...bookRow(bayW * 0.06, bayW / 2 - 0.02, y0 + 0.02, zf - 0.07, 0.16, ch * 0.4, 21));
  // legs: black, tapered, splayed
  for (const lx of [-1, 0, 1])
    for (const sz2 of [-1, 1]) {
      const inset = lx === 0 ? 0 : w / 2 - 0.09;
      const top3: Vec3 = [lx * inset, y0 + 0.005, sz2 * (d / 2 - 0.075)];
      const foot: Vec3 = [lx * (inset + (lx ? 0.045 : 0)), 0, sz2 * (d / 2 - 0.035)];
      parts.push(rod(foot, top3, 0.016, 'metal', { taper: 2 }));
    }
  // styled top: sculptural vase and a bowl of fruit
  parts.push(vase(-w * 0.36, h, 0, 0.22, 'ceramic', [0.9, 0.87, 0.8]));
  parts.push(bowl(w * 0.34, h, 0.02, 0.2, 'ceramic', [0.36, 0.26, 0.2]));
  for (const [fx, fz] of [[w * 0.33, 0.0], [w * 0.36, 0.05], [w * 0.31, 0.04]]) parts.push(sph(fx, h + 0.06, fz, 0.07, 0.065, 0.07, 'ceramic', { tint: [0.55, 0.62, 0.25] }));
  // thin-bezel TV hung above, on the wall plane behind the console
  const tvW = Math.min(w * 0.82, 1.45);
  const tvH = tvW * 0.5625;
  const tvY = h + 0.3 + tvH / 2;
  parts.push(rbox(0, tvY, -d / 2 + 0.02, tvW, tvH, 0.028, 0.004, 'metal'));
  parts.push(box(0, tvY, -d / 2 + 0.0345, tvW - 0.012, tvH - 0.012, 0.002, 'screen'));
  parts.push(box(0, tvY, -d / 2 + 0.0, tvW * 0.35, tvH * 0.4, 0.02, 'metal'));
  return parts;
}

/** Candlestick with pillar candle and a lit flame. */
export function candlestick(x: number, y: number, z: number, hgt: number, slot: Part['slot'] = 'metal'): Part[] {
  const r = 0.035;
  return [
    lathe(x, y, z, [
      [0, 0],
      [r * 1.4, 0],
      [r * 1.4, 0.012],
      [r * 0.5, 0.03],
      [r * 0.45, hgt * 0.3],
      [r * 0.8, hgt * 0.36],
      [r * 0.4, hgt * 0.42],
      [r * 0.35, hgt * 0.82],
      [r * 0.9, hgt * 0.9],
      [r * 1.1, hgt],
      [0, hgt],
    ], slot),
    cyl(x, y + hgt + 0.09, z, 0.075, 0.18, 0.075, 'paper', { tint: [1, 0.97, 0.9] }),
    leafAt([x, y + hgt + 0.18, z], 0, 0, 0.035, 0.014, 'glow', { shape: 'oval', fold: 0, droop: 0 }),
    leafAt([x, y + hgt + 0.18, z], Math.PI / 2, 0, 0.035, 0.014, 'glow', { shape: 'oval', fold: 0, droop: 0 }),
  ];
}

/** Glass jar vase holding leafy branches. */
export function greeneryVase(x: number, y: number, z: number, hgt: number, seed: number): Part[] {
  const rnd = rand(seed);
  const parts: Part[] = [];
  const vh = hgt * 0.38;
  const r = vh * 0.32;
  parts.push(lathe(x, y, z, [[0, 0], [r, 0.004], [r * 1.05, vh * 0.6], [r * 0.7, vh * 0.92], [r * 0.75, vh]], 'glass'));
  parts.push(cyl(x, y + vh * 0.35, z, r * 1.7, vh * 0.68, r * 1.7, 'water'));
  for (let i = 0; i < 9; i++) {
    const yaw = rnd() * Math.PI * 2;
    const lean = 0.15 + rnd() * 0.45;
    const len = hgt * (0.55 + rnd() * 0.45);
    const tip: Vec3 = [x + Math.sin(yaw) * Math.sin(lean) * len, y + vh * 0.3 + Math.cos(lean) * len, z + Math.cos(yaw) * Math.sin(lean) * len];
    parts.push(rod([x, y + vh * 0.2, z], tip, 0.004, 'bark'));
    for (let k = 0; k < 7; k++) {
      const t = 0.35 + (k / 7) * 0.65;
      const base: Vec3 = [x + (tip[0] - x) * t, y + vh * 0.2 + (tip[1] - y - vh * 0.2) * t, z + (tip[2] - z) * t];
      parts.push(leafAt(base, yaw + (k % 2 ? 1.4 : -1.4) + rnd() * 0.5, 0.9 + rnd() * 0.5, 0.045 + rnd() * 0.02, 0.022, 'leaf', { shape: 'oval', fold: 0.25, droop: 0.4, tint: [0.6 + rnd() * 0.3, 0.7 + rnd() * 0.25, 0.55] }));
    }
  }
  return parts;
}

/** Floor-to-ceiling ledgestone fireplace with beam mantel, glass-front firebox, logs and flames. */
export function stoneFireplace(w: number, d: number, h: number): Part[] {
  const parts: Part[] = [];
  const bodyD = Math.min(0.36, d * 0.7);
  const zs = -d / 2 + bodyD; // stone face
  const hearthH = 0.32;
  const fbW = Math.min(1.0, w * 0.46);
  const fbY0 = hearthH + 0.06;
  const fbY1 = fbY0 + 0.62;
  const mantelY = 1.4;
  // stone body (core) and veneer on front and sides
  const coreZ0 = -d / 2;
  const coreZ1 = zs - 0.03;
  const opening: [number, number, number, number] = [-fbW / 2 - 0.035, fbW / 2 + 0.035, fbY0 - 0.035, fbY1 + 0.035];
  for (const [c0, c1, cy0, cy1] of subtractRects([-w / 2 + 0.03, w / 2 - 0.03, 0, h], [opening]))
    parts.push(box((c0 + c1) / 2, (cy0 + cy1) / 2, (coreZ0 + coreZ1) / 2, c1 - c0, cy1 - cy0, coreZ1 - coreZ0, 'primary', { tint: [0.4, 0.38, 0.36] }));
  parts.push(box(0, (fbY0 + fbY1) / 2, coreZ0 + 0.04, fbW + 0.1, fbY1 - fbY0 + 0.1, 0.08, 'primary', { tint: [0.4, 0.38, 0.36] }));
  parts.push(...ledgestone('z', zs - 0.012, 1, -w / 2 + 0.02, w / 2 - 0.02, hearthH, h, 11, 'primary', [[-fbW / 2 - 0.02, fbW / 2 + 0.02, fbY0 - 0.02, fbY1 + 0.03], [-w, w, mantelY - 0.02, mantelY + 0.21]]));
  for (const sx of [-1, 1]) parts.push(...ledgestone('x', sx * (w / 2 - 0.042), sx as 1 | -1, -d / 2, zs - 0.02, hearthH, h, 30 + sx, 'primary'));
  // raised hearth: stacked face with a thick flagstone cap
  parts.push(...ledgestone('z', d / 2 - 0.05, 1, -w / 2 + 0.02, w / 2 - 0.02, 0, hearthH - 0.06, 5, 'primary'));
  parts.push(box(0, (hearthH - 0.06) / 2, (zs + d / 2) / 2 - 0.03, w - 0.05, hearthH - 0.06, d / 2 - zs - 0.02, 'primary', { tint: [0.4, 0.38, 0.36] }));
  parts.push(rbox(0, hearthH - 0.03, (zs + d / 2) / 2 - 0.005, w, 0.065, d / 2 - zs + 0.03, 0.01, 'primary', { tint: [0.7, 0.68, 0.66] }));
  // firebox: black steel frame, dark interior, logs, flames, embers, glass
  const fz = zs + 0.012;
  const fwid = 0.04;
  parts.push(rbox(0, fbY1 + fwid / 2 - 0.005, fz, fbW + 2 * fwid, fwid, 0.025, 0.004, 'metal'));
  parts.push(rbox(0, fbY0 - fwid / 2 + 0.005, fz, fbW + 2 * fwid, fwid, 0.025, 0.004, 'metal'));
  for (const sx of [-1, 1]) parts.push(rbox(sx * (fbW / 2 + fwid / 2 - 0.005), (fbY0 + fbY1) / 2, fz, fwid, fbY1 - fbY0, 0.025, 0.004, 'metal'));
  parts.push(box(0, (fbY0 + fbY1) / 2, fz - 0.2, fbW, fbY1 - fbY0, 0.02, 'rubber'));
  parts.push(box(0, fbY0 + 0.005, fz - 0.1, fbW, 0.01, 0.2, 'rubber'));
  for (const sx of [-1, 1]) parts.push(box(sx * (fbW / 2 - 0.005), (fbY0 + fbY1) / 2, fz - 0.1, 0.01, fbY1 - fbY0, 0.2, 'rubber', { tint: [0.7, 0.6, 0.55] }));
  parts.push(blob(0, fbY0 + 0.012, fz - 0.1, fbW * 0.8, 0.03, 0.14, 4, 'ember', { rough: 0.4, flatBottom: true }));
  parts.push(rod([-fbW * 0.34, fbY0 + 0.04, fz - 0.06], [fbW * 0.3, fbY0 + 0.05, fz - 0.13], 0.075, 'bark', { tint: [0.55, 0.5, 0.48] }));
  parts.push(rod([-fbW * 0.3, fbY0 + 0.05, fz - 0.15], [fbW * 0.34, fbY0 + 0.04, fz - 0.08], 0.07, 'bark', { tint: [0.5, 0.46, 0.44] }));
  parts.push(rod([-fbW * 0.2, fbY0 + 0.11, fz - 0.11], [fbW * 0.22, fbY0 + 0.115, fz - 0.1], 0.06, 'bark', { tint: [0.45, 0.42, 0.4] }));
  const fr = rand(3);
  for (let i = 0; i < 11; i++) {
    const fx = -fbW * 0.32 + (i / 10) * fbW * 0.64;
    const edge = 1 - Math.abs(fx) / (fbW * 0.5);
    const hgt = 0.1 + fr() * 0.14 * edge + 0.05 * edge;
    const zj = fz - 0.11 + (fr() - 0.5) * 0.05;
    parts.push(leafAt([fx, fbY0 + 0.07, zj], fr() * 0.6 - 0.3, (fr() - 0.5) * 0.25, hgt, 0.085 + fr() * 0.04, 'fire', { shape: 'lance', fold: 0.5, droop: (fr() - 0.5) * 0.7, twist: (fr() - 0.5) * 1.2 }));
    if (i % 2 === 0) parts.push(leafAt([fx + 0.01, fbY0 + 0.075, zj + 0.025], fr() * 0.6, (fr() - 0.5) * 0.2, hgt * 0.6, 0.05, 'glow', { shape: 'lance', fold: 0.4, droop: (fr() - 0.5) * 0.5 }));
  }
  // rough-sawn beam mantel
  const mw = w * 0.97;
  parts.push(rbox(0, mantelY + 0.1, zs + 0.11 - 0.012, mw, 0.2, 0.23, 0.014, 'secondary'));
  // mantel styling
  const my = mantelY + 0.2;
  parts.push(...candlestick(-mw * 0.4, my, zs + 0.09, 0.42));
  parts.push(...candlestick(-mw * 0.31, my, zs + 0.09, 0.3));
  parts.push(...greeneryVase(mw * 0.14, my, zs + 0.09, 0.78, 9));
  parts.push(rbox(mw * 0.33, my + 0.11, zs + 0.06, 0.2, 0.22, 0.02, 0.004, 'secondary', { r: [-0.15, 0, 0] }));
  parts.push(box(mw * 0.33, my + 0.11, zs + 0.072, 0.15, 0.16, 0.002, 'paper', { tint: [0.6, 0.66, 0.6], r: [-0.15, 0, 0] }));
  return parts;
}

/** Turned leg profile scaled to height L and max radius R. */
export function turnedLeg(x: number, y: number, z: number, L: number, R: number, slot: Part['slot']): Part {
  const prof: [number, number][] = [
    [0, 0], [0.86, 0], [0.9, 0.04], [0.86, 0.07], [0.7, 0.1], [0.76, 0.13], [0.72, 0.16], [0.92, 0.22], [1.0, 0.34], [0.96, 0.48],
    [0.82, 0.6], [0.7, 0.66], [0.8, 0.7], [0.66, 0.74], [0.68, 0.84], [0.82, 0.9], [0.84, 0.94], [0.7, 0.97], [0.74, 1.0], [0, 1.0],
  ];
  return lathe(x, y, z, prof.map(([r, t]) => [r * R, t * L] as [number, number]), slot);
}

/** Classic slate pool table: turned legs, scalloped apron, sighted rails, felt cushions, six leather pockets. */
export function poolTable(w: number, d: number, h: number): Part[] {
  const parts: Part[] = [];
  const railW = 0.13;
  const railT = 0.07;
  const apronH = 0.24;
  const apronBot = h - railT - apronH;
  const iw = w - 2 * railW;
  const id = d - 2 * railW;
  // felt bed and cushions
  parts.push(box(0, h - 0.05, 0, iw + 0.02, 0.03, id + 0.02, 'primary'));
  const cush = 0.045;
  parts.push(rbox(0, h - 0.03, -id / 2 + cush / 2, iw - 0.2, 0.04, cush, 0.012, 'primary'));
  parts.push(rbox(0, h - 0.03, id / 2 - cush / 2, iw - 0.2, 0.04, cush, 0.012, 'primary'));
  for (const sx of [-1, 1]) {
    parts.push(rbox(sx * (iw / 4 + 0.03), h - 0.03, -id / 2 + cush / 2, iw / 2 - 0.2, 0.04, cush, 0.012, 'primary'));
    parts.push(rbox(sx * (iw / 4 + 0.03), h - 0.03, id / 2 - cush / 2, iw / 2 - 0.2, 0.04, cush, 0.012, 'primary'));
    parts.push(rbox(sx * (iw / 2 - cush / 2), h - 0.03, 0, cush, 0.04, id - 0.2, 0.012, 'primary'));
  }
  // wooden rails
  parts.push(rbox(0, h - railT / 2, -d / 2 + railW / 2, w, railT, railW, 0.012, 'secondary'));
  parts.push(rbox(0, h - railT / 2, d / 2 - railW / 2, w, railT, railW, 0.012, 'secondary'));
  for (const sx of [-1, 1]) parts.push(rbox(sx * (w / 2 - railW / 2), h - railT / 2, 0, railW, railT, d - 0.004, 0.012, 'secondary'));
  // diamond sights
  const diamond: [number, number][] = [[0, 0.012], [0.006, 0], [0, -0.012], [-0.006, 0]];
  for (let i = 1; i <= 7; i++) {
    if (i === 4) continue;
    const x = -iw / 2 + (iw * i) / 8;
    for (const sz2 of [-1, 1]) parts.push(ext(x, h + 0.0005, sz2 * (d / 2 - railW / 2), diamond, 0.002, 'paper', { r: [-Math.PI / 2, 0, 0], tint: [1, 0.98, 0.92] }));
  }
  for (let i = 1; i <= 3; i++) {
    const z = -id / 2 + (id * i) / 4;
    for (const sx of [-1, 1]) parts.push(ext(sx * (w / 2 - railW / 2), h + 0.0005, z, diamond, 0.002, 'paper', { r: [-Math.PI / 2, 0, Math.PI / 2], tint: [1, 0.98, 0.92] }));
  }
  // six pockets: dark mouth, leather basket, black corner casting
  const pockets: [number, number][] = [
    [-iw / 2 + 0.02, -id / 2 + 0.02], [iw / 2 - 0.02, -id / 2 + 0.02], [-iw / 2 + 0.02, id / 2 - 0.02], [iw / 2 - 0.02, id / 2 - 0.02], [0, -id / 2 - 0.01], [0, id / 2 + 0.01],
  ];
  for (const [px, pz] of pockets) {
    parts.push(cyl(px, h - 0.012, pz, 0.12, 0.03, 0.12, 'rubber', { seg: 20 }));
    parts.push(lathe(px, h - 0.2, pz, [[0, 0], [0.04, 0.0], [0.07, 0.04], [0.075, 0.12], [0.065, 0.17], [0.066, 0.18]], 'rubber'));
    const ox = Math.sign(px) * (Math.abs(px) > 0.01 ? 0.03 : 0);
    const oz = Math.sign(pz) * 0.03;
    parts.push(rbox(px + ox, h + 0.005, pz + oz, Math.abs(px) > 0.01 ? 0.2 : 0.2, 0.016, 0.14, 0.008, 'metal'));
    parts.push(rbox(px + ox * 1.6, h - 0.06, pz + oz * 1.6, 0.14, 0.11, 0.06, 0.02, 'metal'));
  }
  // scalloped apron: long sides and ends
  const scallop = (len: number, legsAt: number[]): [number, number][] => {
    const pts: [number, number][] = [[-len / 2, apronH / 2], [len / 2, apronH / 2], [len / 2, -apronH / 2]];
    const bays = [...legsAt].sort((a, b) => b - a);
    for (let i = 0; i + 1 < bays.length; i++) {
      const a0 = bays[i] - 0.12;
      const a1 = bays[i + 1] + 0.12;
      pts.push([a0, -apronH / 2]);
      for (let k = 1; k < 12; k++) {
        const t = k / 12;
        pts.push([a0 + (a1 - a0) * t, -apronH / 2 + Math.sin(Math.PI * t) * apronH * 0.42]);
      }
      pts.push([a1, -apronH / 2]);
    }
    pts.push([-len / 2, -apronH / 2]);
    return pts;
  };
  const ay = apronBot + apronH / 2;
  // flared apron: panels lean out at the top, shallow scallop between the legs
  const lx = w / 2 - 0.36;
  const lz = d / 2 - 0.3;
  const flare = 0.22;
  for (const sz2 of [-1, 1]) parts.push(ext(0, ay, sz2 * (d / 2 - 0.1), scallop(w - 0.16, [-lx, lx]), 0.035, 'secondary', { bevel: 0.006, r: [sz2 * flare, 0, 0] }));
  for (const sx of [-1, 1]) parts.push(ext(sx * (w / 2 - 0.1), ay, 0, scallop(d - 0.16, [-lz, lz]), 0.035, 'secondary', { bevel: 0.006, r: [sx * flare, Math.PI / 2, 0], ro: 'YXZ' }));
  // hidden frame and four chunky turned legs
  parts.push(box(0, ay, 0, w - 0.3, apronH * 0.9, d - 0.3, 'secondary', { tint: [0.6, 0.55, 0.5] }));
  const legH = apronBot + 0.04;
  for (const sx of [-1, 1])
    for (const sz2 of [-1, 1]) parts.push(turnedLeg(sx * lx, 0, sz2 * lz, legH, 0.105, 'secondary'));
  return parts;
}

/** Power theater recliner: channel-stitched back, headrest, bolsters, cup-holder arms, tray, under-glow. */
export function theaterRecliner(w: number, d: number, h: number): Part[] {
  const parts: Part[] = [];
  const armW = Math.min(0.18, w * 0.22);
  const seatW = w - 2 * armW;
  const armTop = h * 0.58;
  const seatTop = h * 0.47;
  const bw = w * 0.76;
  const zb = -d / 2 + 0.2;
  // plinth and warm under-glow strip
  parts.push(rbox(0, 0.04, -0.02, w - 0.14, 0.06, d - 0.3, 0.01, 'rubber'));
  parts.push(box(0, 0.012, d / 2 - 0.13, w - 0.14, 0.012, 0.01, 'glow'));
  // arms with padded tops, cup holders
  for (const sx of [-1, 1]) {
    const x = sx * (w / 2 - armW / 2);
    parts.push(cushion(x, 0.08 + (armTop - 0.1) / 2, -0.02, armW, armTop - 0.1, d - 0.14, 0.05, 0.016, 'primary'));
    parts.push(cushion(x, armTop - 0.02, -0.03, armW + 0.012, 0.075, d - 0.12, 0.034, 0.014, 'primary'));
    parts.push(tube([[x - sx * (armW / 2 - 0.006), armTop - 0.05, d / 2 - 0.08], [x - sx * (armW / 2 - 0.006), 0.12, d / 2 - 0.08]], 0.005, 'primary'));
    parts.push(cyl(x, armTop + 0.012, d / 2 - 0.17, 0.085, 0.01, 0.085, 'rubber'));
    parts.push(torus(x, armTop + 0.016, d / 2 - 0.17, 0.043, 0.006, 'chrome', { r: [Math.PI / 2, 0, 0] }));
  }
  // seat cushion and leg-rest front panel
  parts.push(cushion(0, seatTop - 0.075, 0.04, seatW - 0.006, 0.17, d - 0.36, 0.06, 0.05, 'primary', { sag: 0.015 }));
  parts.push(tube([[-seatW / 2 + 0.03, seatTop - 0.005, d / 2 - 0.13], [seatW / 2 - 0.03, seatTop - 0.005, d / 2 - 0.13]], 0.005, 'primary'));
  parts.push(cushion(0, 0.1 + (seatTop - 0.2) / 2, d / 2 - 0.13, seatW - 0.012, seatTop - 0.2, 0.15, 0.05, 0.03, 'primary'));
  parts.push(tube([[-seatW / 2 + 0.02, 0.1 + (seatTop - 0.2) * 0.55, d / 2 - 0.05], [seatW / 2 - 0.02, 0.1 + (seatTop - 0.2) * 0.55, d / 2 - 0.05]], 0.004, 'primary'));
  // reclined back: shell, lumbar, side bolsters, channelled centre, headrest
  const back: Part[] = [];
  const bh = h - seatTop;
  back.push(rbox(0, seatTop + bh * 0.48, zb - 0.1, bw, bh * 0.95, 0.12, 0.05, 'primary'));
  back.push(cushion(0, seatTop + 0.1, zb + 0.02, bw * 0.86, 0.2, 0.16, 0.07, 0.04, 'primary'));
  for (const sx of [-1, 1]) back.push(cushion(sx * bw * 0.34, seatTop + bh * 0.48, zb + 0.0, bw * 0.3, bh * 0.64, 0.18, 0.07, 0.045, 'primary', { r: [0, -sx * 0.2, 0] }));
  back.push(cushion(0, seatTop + bh * 0.47, zb - 0.02, bw * 0.5, bh * 0.58, 0.14, 0.06, 0.035, 'primary'));
  for (const sx of [-1, 1])
    back.push(tube([[sx * bw * 0.22, seatTop + bh * 0.2, zb + 0.065], [sx * bw * 0.17, seatTop + bh * 0.45, zb + 0.055], [sx * bw * 0.22, seatTop + bh * 0.74, zb + 0.065]], 0.005, 'primary', { smooth: true }));
  back.push(cushion(0, h - bh * 0.14, zb + 0.0, bw * 0.92, bh * 0.28, 0.2, 0.08, 0.05, 'primary'));
  parts.push(...rotateX(back, -0.17, [0, seatTop, zb]));
  // swivel tray (left) and phone holder (right)
  const lx = -(w / 2 - armW / 2);
  parts.push(rod([lx, armTop + 0.02, d / 2 - 0.33], [lx, armTop + 0.1, d / 2 - 0.33], 0.016, 'chrome'));
  parts.push(rbox(lx + 0.12, armTop + 0.11, d / 2 - 0.3, 0.32, 0.016, 0.2, 0.01, 'rubber'));
  const rx = w / 2 - armW / 2;
  parts.push(rod([rx, armTop + 0.02, d / 2 - 0.33], [rx - 0.02, armTop + 0.16, d / 2 - 0.3], 0.014, 'rubber'));
  parts.push(rbox(rx - 0.03, armTop + 0.21, d / 2 - 0.3, 0.075, 0.13, 0.014, 0.008, 'rubber', { r: [-0.2, 0.4, 0] }));
  return parts;
}

/** Fixed-frame projection screen: deep aluminium frame wrapped in black velvet, tensioned matte white surface. */
export function fixedFrameScreen(w: number, d: number, h: number): Part[] {
  const parts: Part[] = [];
  const b = Math.min(0.09, w * 0.03);
  const fd = Math.max(0.05, d * 0.8);
  // velvet border (four rails with soft rounded edges)
  parts.push(rbox(0, h - b / 2, 0, w, b, fd, 0.012, 'primary'));
  parts.push(rbox(0, b / 2, 0, w, b, fd, 0.012, 'primary'));
  for (const sx of [-1, 1]) parts.push(rbox(sx * (w / 2 - b / 2), h / 2, 0, b, h - 2 * b + 0.002, fd, 0.012, 'primary'));
  // screen surface, slightly recessed, with tension backing
  parts.push(box(0, h / 2, fd / 2 - 0.012, w - 2 * b + 0.01, h - 2 * b + 0.01, 0.004, 'paper', { tint: [1.02, 1.02, 1.03] }));
  parts.push(box(0, h / 2, -fd / 2 + 0.006, w - 0.02, h - 0.02, 0.006, 'rubber'));
  // wall brackets
  for (const sx of [-1, 1]) parts.push(box(sx * w * 0.3, h - b - 0.05, -fd / 2 - 0.004, 0.08, 0.05, 0.008, 'metal'));
  return parts;
}

export const LIVING: CatalogItem[] = [
  {
    id: 'sofa',
    name: 'Sofa',
    category: 'Living',
    size: sz(7.5, 3.2, 2.8),
    slots: { primary: { label: 'Upholstery', default: 'fabric-charcoal' }, secondary: { label: 'Legs', default: 'black-wood' } },
    parts: (w, d, h) => trackArmSofa(w, d, h, { seats: 1, backs: 2 }),
    solid: true,
    ref: 'Track-arm boucle sofa, bench seat, two loose back pillows, splayed tapered wood legs',
  },
  {
    id: 'sectional',
    name: 'Chaise sectional',
    category: 'Living',
    size: sz(10.5, 5.4, 2.8),
    slots: { primary: { label: 'Upholstery', default: 'fabric-cream' }, secondary: { label: 'Feet', default: 'black-wood' } },
    parts: (w, d, h) => chaiseSectional(w, d, h),
    solid: true,
    ref: 'Track-arm chaise sectional, right chaise, three boxy back cushions, plinth base, block feet',
  },
  {
    id: 'armchair',
    name: 'Lounge armchair',
    category: 'Living',
    size: sz(2.3, 2.7, 2.9),
    slots: { primary: { label: 'Upholstery', default: 'leather-cognac' }, secondary: { label: 'Frame', default: 'walnut-furniture' } },
    parts: (w, d, h) => woodFrameLounge(w, d, h),
    solid: true,
    ref: 'Mid-century wood-frame lounge chair, cognac leather welted cushions',
  },
  {
    id: 'coffee-table',
    name: 'Slab coffee table',
    category: 'Living',
    size: sz(4, 2.2, 1.5),
    slots: { primary: { label: 'Top', default: 'walnut-furniture' }, secondary: { label: 'Legs', default: 'black-metal' } },
    parts: (w, d, h) => slabTable(w, d, h),
    solid: true,
    ref: 'Walnut slab with knots and a stabilised check, square-tube loop legs',
  },
  {
    id: 'side-table',
    name: 'Tripod side table',
    category: 'Living',
    size: sz(1.6, 1.6, 2),
    slots: { primary: { label: 'Top', default: 'walnut-furniture' }, secondary: { label: 'Legs', default: 'walnut-furniture' } },
    parts: (w, d, h) => tripodTable(w, d, h),
    solid: true,
    ref: 'Mid-century round walnut side table, chamfered top, three splayed tapered legs',
  },
  {
    id: 'tv-console',
    name: 'Media console + TV',
    category: 'Living',
    size: sz(6, 1.6, 2),
    slots: { primary: { label: 'Body', default: 'walnut-furniture' }, accent: { label: 'Top', default: 'walnut-furniture' } },
    parts: (w, d, h) => mediaConsole(w, d, h),
    solid: true,
    ref: 'Fluted walnut media console, open centre bay, splayed black legs, wall TV above',
  },
  {
    id: 'fireplace',
    name: 'Stone fireplace',
    category: 'Living',
    size: sz(7, 1.6, 9),
    slots: { primary: { label: 'Stone', default: 'stone-dark' }, secondary: { label: 'Mantel', default: 'timber-dark' } },
    parts: (w, d, h) => stoneFireplace(w, d, h),
    solid: true,
    ref: 'Floor-to-ceiling ledgestone fireplace, rough beam mantel, glass firebox with logs and flame',
  },
  {
    id: 'pool-table',
    name: 'Pool table',
    category: 'Living',
    size: sz(8.5, 4.6, 2.65),
    slots: { primary: { label: 'Felt', default: 'paint-deep-green' }, secondary: { label: 'Frame', default: 'walnut-furniture' } },
    parts: (w, d, h) => poolTable(w, d, h),
    solid: true,
    ref: 'Classic slate pool table, turned legs, scalloped apron, leather pockets, diamond sights',
  },
  {
    id: 'theater-seat',
    name: 'Theater recliner',
    category: 'Living',
    size: sz(2.8, 3.4, 3.4),
    slots: { primary: { label: 'Upholstery', default: 'leather-cognac' }, secondary: { label: 'Base', default: 'black-wood' } },
    parts: (w, d, h) => theaterRecliner(w, d, h),
    solid: true,
    ref: 'Power theater recliner, channel-stitched back, headrest, cup holders, swivel tray',
  },
  {
    id: 'screen',
    name: 'Projection screen',
    category: 'Living',
    size: sz(11, 0.3, 6),
    slots: { primary: { label: 'Frame', default: 'rubber' } },
    parts: (w, d, h) => fixedFrameScreen(w, d, h),
    solid: false,
    defaultElevation: 0.6,
    ref: 'Fixed-frame projection screen with black velvet border',
  },
];
