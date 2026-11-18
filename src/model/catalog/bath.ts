import { type Part, type Vec3, box, cushion, cyl, ellipse, ext, lathe, loft, rbox, rod, roundRect, squircle, sz, torus, tube } from './kit';
import { barPull, pullDownFaucet, shakerFront } from './kitchen';
import type { CatalogItem } from './types';

/** Section of a solid of revolution stretched into an ellipse (bowl rim, seat). */
function ovalRing(x: number, y: number, z: number, rx: number, rz: number, tube2: number, slot: Part['slot'], tint?: Vec3): Part {
  return { s: 'torus', p: [x, y, z], R: 1, rad: tube2, slot, r: [Math.PI / 2, 0, 0], tint, sxz: [rx, rz] } as unknown as Part;
}
void ovalRing;

/** One-piece skirted toilet. The body is a side-profile extrusion (tank flowing into the skirt), rounded by a bevel;
 *  the bowl top, seat and lid are plan-view extrusions laid flat. */
export function skirtedToilet(w: number, d: number, h: number): Part[] {
  const parts: Part[] = [];
  const seatY = Math.min(0.42, h * 0.55);
  const tankD = 0.2;
  const zb = -d / 2;
  const zf = d / 2;
  // side profile in (z, y): back of tank, tank top, step down to the deck, bowl rim, front curve sweeping in to the foot
  const prof: [number, number][] = [];
  const P = (z: number, y: number) => prof.push([z, y]);
  P(zb + 0.03, 0);
  P(zb, 0.06);
  P(zb, h - 0.03);
  P(zb + tankD, h - 0.03);
  P(zb + tankD, seatY + 0.01);
  P(zf - 0.06, seatY);
  // front curve down and inward (quarter ellipse)
  for (let i = 1; i <= 10; i++) {
    const t = (i / 10) * (Math.PI / 2);
    P(zf - 0.06 + Math.sin(t) * 0.06 - (1 - Math.cos(t)) * 0.0, seatY - (1 - Math.cos(t)) * 0.07);
  }
  for (let i = 1; i <= 12; i++) {
    const t = i / 12;
    P(zf - 0.002 - (zf - (zb + d * 0.68)) * Math.pow(t, 1.8), seatY - 0.07 - (seatY - 0.07) * t);
  }
  const bodyW = w * 0.9;
  parts.push(ext(0, 0, 0, prof.map(([z, y]) => [z, y] as [number, number]), bodyW, 'ceramic', { r: [0, -Math.PI / 2, 0], bevel: 0.045, curveSeg: 6 }));
  // tank lid with a small reveal
  parts.push(rbox(0, h - 0.014, zb + tankD / 2, bodyW + 0.012, 0.028, tankD + 0.014, 0.008, 'ceramic', { tint: [0.99, 0.99, 0.99] }));
  parts.push(box(0, h - 0.031, zb + tankD / 2, bodyW - 0.01, 0.004, tankD - 0.01, 'rubber', { tint: [0.75, 0.75, 0.75] }));
  // elongated bowl opening, water
  const bowlL = zf - (zb + tankD) - 0.02;
  const bz = zb + tankD + bowlL / 2 + 0.005;
  parts.push(ext(0, seatY + 0.001, bz, squircle(w * 0.3, bowlL * 0.38, 2.2, 40), 0.002, 'water', { r: [-Math.PI / 2, 0, 0] }));
  // seat (ring) and closed lid, hinged at the back
  const outline = squircle(w / 2 - 0.01, bowlL / 2, 2.4, 48);
  const hole = squircle(w * 0.3, bowlL * 0.36, 2.2, 40).map(([x, y]) => [x, y - 0.01] as [number, number]);
  parts.push(ext(0, seatY + 0.016, bz, outline, 0.022, 'ceramic', { r: [-Math.PI / 2, 0, 0], holes: [hole], bevel: 0.008, curveSeg: 4, tint: [0.98, 0.98, 0.98] }));
  parts.push(ext(0, seatY + 0.042, bz - 0.004, outline, 0.024, 'ceramic', { r: [-Math.PI / 2, 0, 0], bevel: 0.01, curveSeg: 4 }));
  for (const sx of [-1, 1]) parts.push(rbox(sx * 0.07, seatY + 0.02, zb + tankD + 0.02, 0.045, 0.03, 0.045, 0.01, 'chrome'));
  // chrome trip lever on the tank side
  const lz = zb + tankD - 0.05;
  parts.push(cyl(-bodyW / 2 - 0.004, h - 0.08, lz, 0.034, 0.012, 0.034, 'chrome', { r: [0, 0, Math.PI / 2] }));
  parts.push(rod([-bodyW / 2 - 0.012, h - 0.08, lz], [-bodyW / 2 - 0.02, h - 0.085, lz + 0.06], 0.012, 'chrome'));
  return parts;
}

/** Fluted vessel bowl (ridged outside, smooth inside). */
export function flutedVessel(x: number, y: number, z: number, dia: number, hgt: number, slot: Part['slot'] = 'rubber', oval = 1): Part[] {
  const r = dia / 2;
  const parts: Part[] = [lathe(x, y, z, [[0, 0], [r * 0.82, 0], [r * 0.97, hgt * 0.3], [r, hgt * 0.92], [r * 0.96, hgt], [r * 0.9, hgt], [r * 0.88, hgt * 0.2], [r * 0.3, hgt * 0.1], [0, hgt * 0.1]], slot, { sz: 1 / oval })];
  const n = 44;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    parts.push(cyl(x + Math.cos(a) * r * 0.975, y + hgt * 0.55, z + (Math.sin(a) * r * 0.975) / oval, 0.014, hgt * 0.8, 0.014, slot, { seg: 6 }));
  }
  parts.push(cyl(x, y + hgt * 0.1 + 0.002, z, 0.04, 0.003, 0.04, 'chrome'));
  return parts;
}

/** Tall vessel faucet: round base, straight riser, gentle arc spout, side lever. */
export function vesselFaucet(x: number, y: number, z: number, height: number, reach: number, slot: Part['slot'] = 'metal'): Part[] {
  return [
    lathe(x, y, z, [[0, 0], [0.028, 0], [0.028, 0.005], [0.016, 0.01], [0.015, height - 0.02], [0, height - 0.02]], slot),
    tube([[x, y + height - 0.03, z], [x, y + height, z + reach * 0.3], [x, y + height - 0.01, z + reach * 0.85], [x, y + height - 0.05, z + reach]], 0.011, slot, { smooth: true, rs: 10 }),
    rod([x + 0.015, y + height * 0.7, z], [x + 0.065, y + height * 0.72, z], 0.009, slot),
  ];
}

/** Round mirror with thin brass frame and warm halo backlight, centred at (x,y,z) on a wall facing +z. */
export function roundMirror(x: number, y: number, z: number, dia: number): Part[] {
  return [
    cyl(x, y, z + 0.01, dia, 0.012, dia, 'mirror', { r: [Math.PI / 2, 0, 0], seg: 48 }),
    torus(x, y, z + 0.016, dia / 2, 0.007, 'brass'),
    torus(x, y, z + 0.002, dia / 2 + 0.012, 0.012, 'glow'),
  ];
}

/** Floating vanity: rounded walnut cabinet with fluted doors, solid-surface top, vessel sinks, tall faucets, round mirrors. */
export function floatingVanity(w: number, d: number, h: number, sinks = 1): Part[] {
  const parts: Part[] = [];
  const cabH = 0.42;
  const y0 = h - cabH;
  // wall cleat behind (it floats)
  parts.push(box(0, y0 + 0.1, -d / 2 + 0.01, w * 0.6, 0.06, 0.02, 'rubber'));
  const topT = 0.03;
  // cabinet with rounded front corners
  parts.push(ext(0, y0 + (cabH - topT) / 2, 0, roundRect(w, d, 0.07, 6).map(([px, pz]) => [px, pz] as [number, number]), cabH - topT, 'primary', { r: [Math.PI / 2, 0, 0], bevel: 0.006 }));
  // fluted doors
  const n = sinks === 1 ? 1 : 2;
  const dw = (w - 0.16) / n;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 0.08 + dw / 2 + i * dw;
    const fl = Math.round(dw / 0.022);
    for (let k = 0; k < fl; k++) parts.push(cyl(x - dw / 2 + (k + 0.5) * (dw / fl), y0 + (cabH - topT) / 2, d / 2 + 0.004, (dw / fl) * 0.8, cabH - topT - 0.04, 0.014, 'primary', { seg: 8, gv: true }));
    if (n === 2 && i === 0) parts.push(box(x + dw / 2, y0 + (cabH - topT) / 2, d / 2 + 0.006, 0.004, cabH - topT - 0.04, 0.004, 'rubber'));
  }
  // top: solid surface, rounded to match
  parts.push(ext(0, h - topT / 2, 0.005, roundRect(w + 0.01, d + 0.012, 0.075, 6), topT, 'ceramic', { r: [Math.PI / 2, 0, 0], bevel: 0.006 }));
  // sinks, faucets and mirrors
  const xs = sinks === 1 ? [0] : [-w * 0.25, w * 0.25];
  for (const x of xs) {
    parts.push(...flutedVessel(x, h, 0.02, Math.min(0.56, w / xs.length - 0.12), 0.13, 'rubber', 1.45));
    parts.push(...vesselFaucet(x, h, -d / 2 + 0.06, 0.32, 0.17));
    parts.push(...roundMirror(x, h + 0.66, -d / 2, Math.min(0.66, w / xs.length - 0.06)));
  }
  // small styling: soap bottle and a tiny plant on the top
  parts.push(lathe(w / 2 - 0.07, h, -d * 0.2, [[0, 0], [0.025, 0], [0.026, 0.11], [0.012, 0.13], [0.008, 0.16], [0, 0.16]], 'ceramic', { tint: [0.35, 0.22, 0.12] }));
  return parts;
}

/** Freestanding oval soaking tub with a flared rim, floor-mount filler and a towel draped over the edge. */
export function freestandingTub(w: number, d: number, h: number): Part[] {
  const parts: Part[] = [];
  const t = 0.035;
  // capsule plan (superellipse k=2.6), walls nearly vertical with a slight outward flare toward the rim
  const k = 2.6;
  const outerTop = squircle(w / 2, d / 2, k, 72);
  const innerTop = squircle(w / 2 - t, d / 2 - t, k, 72);
  const outerBase = squircle(w / 2 - 0.05, d / 2 - 0.04, k, 72);
  // lower band (base to mid) slightly narrower, upper band full size: two bevelled extrusions read as a gentle flare
  const innerBase = squircle(w / 2 - 0.12, d / 2 - 0.1, k, 72);
  parts.push(loft(0, 0, outerBase, outerTop, 0, h, 'ceramic', { inBot: innerBase, inTop: innerTop, rings: 16 }));
  // rolled rim
  parts.push(ext(0, h - 0.008, 0, squircle(w / 2 + 0.004, d / 2 + 0.004, k, 72), 0.016, 'ceramic', { r: [-Math.PI / 2, 0, 0], holes: [squircle(w / 2 - t - 0.004, d / 2 - t - 0.004, k, 72)], bevel: 0.007, curveSeg: 3 }));
  // inner basin floor and walls stepping in
  parts.push(ext(0, h * 0.6, 0, squircle(w / 2 - t * 0.6, d / 2 - t * 0.6, k, 64), 0.004, 'water', { r: [-Math.PI / 2, 0, 0] }));
  parts.push(cyl(w * 0.3, 0.045, 0, 0.05, 0.004, 0.05, 'chrome'));
  // floor-mount filler behind the tub, centred, matte black
  const fz = -d / 2 - 0.15;
  parts.push(cyl(0, 0.005, fz, 0.11, 0.01, 0.11, 'metal'));
  parts.push(tube([[0, 0.01, fz], [0, h + 0.17, fz], [0, h + 0.28, fz + 0.04], [0, h + 0.24, fz + 0.14], [0, h + 0.15, fz + 0.18]], 0.014, 'metal', { smooth: true, rs: 12 }));
  parts.push(rod([0.015, h + 0.02, fz], [0.07, h + 0.06, fz], 0.012, 'metal'));
  parts.push(rbox(0.035, h * 0.55, fz, 0.04, 0.18, 0.04, 0.018, 'metal'));
  // towel draped over the front rim: top fold resting on the rim, hanging leaf against the outside wall
  const tx = -w * 0.22;
  parts.push(cushion(tx, h + 0.008, d / 2 - t / 2, 0.3, 0.014, t + 0.03, 0.006, 0.004, 'cloth', { tint: [1.08, 1.06, 1.02] }));
  parts.push(cushion(tx, h - 0.16, d / 2 + 0.012, 0.3, 0.32, 0.014, 0.006, 0.003, 'cloth', { tint: [1.08, 1.06, 1.02] }));
  for (let i = 0; i < 3; i++) parts.push(box(tx, h - 0.27 + i * 0.012, d / 2 + 0.02, 0.3, 0.005, 0.002, 'cloth', { tint: [0.6, 0.6, 0.62] }));
  return parts;
}

/** Frameless glass shower: two glass panels (fixed and hinged door), black hinges and handle, rain head on an arm, valve with hand shower on a bar, tiled curb and floor. */
export function glassShower(w: number, d: number, h: number): Part[] {
  const parts: Part[] = [];
  const g = 0.01;
  // floor pan with linear drain, low curb on the open sides
  parts.push(box(0, 0.02, 0, w, 0.04, d, 'primary'));
  parts.push(box(0, 0.041, d / 2 - 0.04, w, 0.002, 0.04, 'rubber', { tint: [0.45, 0.45, 0.45] }));
  parts.push(box(0, 0.042, -d / 2 + 0.08, w * 0.7, 0.002, 0.03, 'chrome'));
  // glass: front (door + fixed), side fixed
  const doorW = Math.min(0.7, w * 0.6);
  parts.push(box(-w / 2 + (w - doorW) / 2, 0.04 + (h - 0.04) / 2, d / 2 - g / 2, w - doorW - 0.008, h - 0.06, g, 'glass'));
  parts.push(box(w / 2 - doorW / 2, 0.04 + (h - 0.04) / 2, d / 2 - g / 2, doorW - 0.008, h - 0.06, g, 'glass'));
  parts.push(box(w / 2 - g / 2, 0.04 + (h - 0.04) / 2, 0, g, h - 0.06, d - 0.01, 'glass'));
  // hardware: hinges, clamps, handle, header bar
  const hx = w / 2 - doorW;
  for (const y of [0.3, h - 0.3]) parts.push(rbox(hx, y, d / 2 - g / 2, 0.05, 0.08, 0.03, 0.006, 'metal'));
  for (const y of [0.25, h - 0.25]) parts.push(rbox(w / 2 - 0.01, y, d / 2 - 0.02, 0.03, 0.05, 0.03, 0.006, 'metal'));
  parts.push(rod([w / 2 - 0.08, h * 0.45, d / 2 + 0.03], [w / 2 - 0.08, h * 0.62, d / 2 + 0.03], 0.018, 'metal'));
  for (const yy of [h * 0.47, h * 0.6]) parts.push(rod([w / 2 - 0.08, yy, d / 2], [w / 2 - 0.08, yy, d / 2 + 0.03], 0.012, 'metal'));
  // tiled back wall panel and plumbing
  parts.push(box(0, h / 2 + 0.02, -d / 2 + 0.005, w, h - 0.04, 0.01, 'primary', { tint: [1.05, 1.05, 1.05] }));
  const vx = -w * 0.2;
  parts.push(tube([[vx, h - 0.12, -d / 2 + 0.01], [vx, h - 0.12, -d / 2 + 0.3], [vx, h - 0.17, -d / 2 + 0.32]], 0.01, 'metal', { cr: 0.03 }));
  parts.push(cyl(vx, h - 0.18, -d / 2 + 0.32, 0.22, 0.014, 0.22, 'metal'));
  parts.push(cyl(vx, 1.15, -d / 2 + 0.018, 0.13, 0.016, 0.13, 'metal', { r: [Math.PI / 2, 0, 0] }));
  parts.push(rod([vx, 1.15, -d / 2 + 0.03], [vx + 0.09, 1.15, -d / 2 + 0.05], 0.014, 'metal'));
  parts.push(rod([vx + 0.18, 0.9, -d / 2 + 0.03], [vx + 0.18, 1.6, -d / 2 + 0.03], 0.016, 'metal'));
  parts.push(rod([vx + 0.18, 1.45, -d / 2 + 0.05], [vx + 0.18, 1.65, -d / 2 + 0.08], 0.02, 'metal', { taper: 1.3 }));
  parts.push(tube([[vx + 0.18, 1.0, -d / 2 + 0.04], [vx + 0.24, 0.75, -d / 2 + 0.06], [vx + 0.2, 0.62, -d / 2 + 0.05], [vx + 0.18, 1.45, -d / 2 + 0.05]], 0.006, 'metal', { smooth: true }));
  // niche with bottles
  parts.push(box(w * 0.25, 1.25, -d / 2 + 0.006, 0.3, 0.32, 0.012, 'rubber', { tint: [0.5, 0.5, 0.5] }));
  for (const [bx2, c] of [[0.17, [0.9, 0.88, 0.84]], [0.24, [0.3, 0.32, 0.3]], [0.31, [0.6, 0.45, 0.3]]] as [number, Vec3][])
    parts.push(lathe(w * bx2, 1.1, -d / 2 + 0.05, [[0, 0], [0.025, 0], [0.026, 0.15], [0.012, 0.17], [0.01, 0.2], [0, 0.2]], 'ceramic', { tint: c }));
  return parts;
}

/** Front-load washer or dryer: detergent drawer, dial and control strip, chrome-ringed porthole door, bottom access panel. */
export function frontLoader(w: number, d: number, h: number, dryer = false): Part[] {
  const parts: Part[] = [];
  const zf = d / 2;
  parts.push(rbox(0, h / 2, 0, w, h, d, 0.012, 'primary'));
  // control strip
  const cy = h - 0.08;
  parts.push(box(0, cy - 0.065, zf + 0.001, w - 0.02, 0.003, 0.002, 'rubber', { tint: [0.75, 0.75, 0.75] }));
  if (!dryer) {
    parts.push(rbox(-w * 0.31, cy, zf + 0.004, w * 0.3, 0.09, 0.012, 0.006, 'primary'));
    parts.push(box(-w * 0.31, cy - 0.025, zf + 0.011, w * 0.22, 0.012, 0.002, 'rubber', { tint: [0.6, 0.6, 0.6] }));
  }
  parts.push(lathe(0, cy, zf, [[0, 0], [0.042, 0], [0.042, 0.012], [0.036, 0.03], [0, 0.03]], 'ceramic', { r: [Math.PI / 2, 0, 0] }));
  parts.push(torus(0, cy, zf + 0.006, 0.046, 0.004, 'chrome'));
  parts.push(box(w * 0.25, cy, zf + 0.002, w * 0.3, 0.05, 0.004, 'screen'));
  for (let i = 0; i < 4; i++) parts.push(cyl(w * 0.15 + i * 0.05, cy - 0.04, zf + 0.003, 0.016, 0.004, 0.016, 'rubber', { r: [Math.PI / 2, 0, 0], tint: [0.7, 0.7, 0.7] }));
  // porthole door
  const dy = h * 0.5;
  const R = w * 0.42;
  parts.push(lathe(0, dy, zf, [[R * 0.7, 0], [R, 0], [R + 0.004, 0.02], [R * 0.96, 0.05], [R * 0.82, 0.06], [R * 0.74, 0.045]], 'primary', { r: [Math.PI / 2, 0, 0], seg: 48 }));
  parts.push(torus(0, dy, zf + 0.022, R, 0.005, 'chrome'));
  parts.push(torus(0, dy, zf + 0.048, R * 0.76, 0.006, 'chrome'));
  parts.push(lathe(0, dy, zf + 0.02, [[0, 0.04], [R * 0.4, 0.03], [R * 0.74, 0.0], [R * 0.74, -0.01], [0, 0.0]], 'screen', { r: [Math.PI / 2, 0, 0], seg: 40, tint: dryer ? [1, 1, 1] : [2.2, 2.3, 2.4] }));
  parts.push(cyl(0, dy, zf - 0.08, R * 1.4, 0.004, R * 1.4, 'rubber', { r: [Math.PI / 2, 0, 0], tint: [0.4, 0.4, 0.42] }));
  if (!dryer) parts.push(lathe(0, dy, zf - 0.02, [[0, -0.1], [R * 0.72, -0.08], [R * 0.78, 0.0], [R * 0.68, 0.0], [0, -0.09]], 'chrome', { r: [Math.PI / 2, 0, 0], tint: [0.55, 0.55, 0.55] }));
  
  // bottom access panel
  parts.push(rbox(-w * 0.34, 0.08, zf + 0.002, w * 0.18, 0.09, 0.004, 0.006, 'primary', { tint: [0.92, 0.92, 0.92] }));
  for (const sx of [-1, 1]) parts.push(cyl(sx * (w / 2 - 0.05), 0.01, zf - 0.05, 0.05, 0.02, 0.05, 'rubber'));
  return parts;
}

export const BATH: CatalogItem[] = [
  {
    id: 'toilet',
    name: 'Toilet',
    category: 'Bathroom',
    size: sz(1.25, 2.3, 2.45),
    slots: { primary: { label: 'Porcelain', default: 'porcelain' } },
    parts: (w, d, h) => skirtedToilet(w, d, h),
    solid: true,
    ref: 'Signature Hardware one-piece skirted elongated toilet',
  },
  {
    id: 'vanity',
    name: 'Vanity (single)',
    category: 'Bathroom',
    size: sz(2.5, 1.6, 2.8),
    slots: { primary: { label: 'Cabinet', default: 'walnut-furniture' }, accent: { label: 'Top', default: 'ceramic-white' } },
    parts: (w, d, h) => floatingVanity(w, d, h, 1),
    solid: true,
    ref: 'Roomfitters 24 in floating walnut vanity, fluted door, black fluted vessel, round backlit mirror',
  },
  {
    id: 'vanity-double',
    name: 'Vanity (double)',
    category: 'Bathroom',
    size: sz(6, 1.8, 2.8),
    slots: { primary: { label: 'Cabinet', default: 'walnut-furniture' }, accent: { label: 'Top', default: 'ceramic-white' } },
    parts: (w, d, h) => floatingVanity(w, d, h, 2),
    solid: true,
    ref: 'Double version of the floating fluted walnut vanity, two vessels and mirrors',
  },
  {
    id: 'bathtub',
    name: 'Freestanding tub',
    category: 'Bathroom',
    size: sz(5.5, 2.7, 1.9),
    slots: { primary: { label: 'Finish', default: 'ceramic-white' } },
    parts: (w, d, h) => freestandingTub(w, d, h),
    solid: true,
    ref: 'Oval freestanding soaking tub with matte black floor-mount filler (DecorPad bathroom)',
  },
  {
    id: 'shower',
    name: 'Glass shower',
    category: 'Bathroom',
    size: sz(3.5, 3.5, 7),
    slots: { primary: { label: 'Tile', default: 'tile-cream' } },
    parts: (w, d, h) => glassShower(w, d, h),
    solid: true,
    ref: 'Frameless glass shower, black rain head, valve, hand shower and hardware (DecorPad bathroom)',
  },
  {
    id: 'washer',
    name: 'Washer',
    category: 'Bathroom',
    size: sz(2.25, 2.4, 3.2),
    slots: { primary: { label: 'Finish', default: 'painted-white' } },
    parts: (w, d, h) => frontLoader(w, d, h, false),
    solid: true,
    ref: 'LG front-load washer (AJ Madison listing)',
  },
  {
    id: 'dryer',
    name: 'Dryer',
    category: 'Bathroom',
    size: sz(2.25, 2.4, 3.2),
    slots: { primary: { label: 'Finish', default: 'painted-white' } },
    parts: (w, d, h) => frontLoader(w, d, h, true),
    solid: true,
    ref: 'LG front-load electric dryer (AJ Madison listing)',
  },
];

void barPull;
void box;
void cushion;
void ellipse;
void lathe;
void pullDownFaucet;
void roundRect;
void shakerFront;
void torus;
void tube;
