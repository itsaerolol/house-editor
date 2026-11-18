import { type Part, type Vec3, box, cyl, ext, lathe, rbox, rod, rotateY, roundRect, squircle, sz, torus, tube } from './kit';
import type { CatalogItem } from './types';

/* ------------------------------------------------------------------ cabinet kit */

const RAIL = 0.06; // shaker frame width
const FT_THK = 0.019; // door thickness

/** Five-piece shaker door or drawer face, face plane at z (front at z + FT_THK). */
export function shakerFront(x: number, y: number, z: number, w: number, h: number, slot: Part['slot'] = 'primary', slab = false): Part[] {
  if (slab || h < 0.17 || w < 0.17) return [rbox(x, y, z + FT_THK / 2, w, h, FT_THK, 0.003, slot)];
  const r = Math.min(RAIL, w * 0.2, h * 0.2);
  return [
    // recessed centre panel
    box(x, y, z + 0.004, w - 2 * r + 0.004, h - 2 * r + 0.004, 0.008, slot, { tint: [0.8, 0.8, 0.8], gv: true }),
    // inner shadow line around the panel
    box(x, y + h / 2 - r - 0.003, z + 0.009, w - 2 * r, 0.006, 0.002, 'rubber', { tint: [0.5, 0.45, 0.42] }),
    // stiles and rails, with a slight bevel so the frame catches light
    rbox(x - w / 2 + r / 2, y, z + FT_THK / 2, r, h, FT_THK, 0.002, slot, { gv: true }),
    rbox(x + w / 2 - r / 2, y, z + FT_THK / 2, r, h, FT_THK, 0.002, slot, { gv: true }),
    rbox(x, y + h / 2 - r / 2, z + FT_THK / 2, w - 2 * r + 0.002, r, FT_THK, 0.002, slot),
    rbox(x, y - h / 2 + r / 2, z + FT_THK / 2, w - 2 * r + 0.002, r, FT_THK, 0.002, slot),
  ];
}

/** Matte black bar pull, horizontal (len along x) or vertical. Front face at z. */
export function barPull(x: number, y: number, z: number, len: number, vertical = false, slot: Part['slot'] = 'metal'): Part[] {
  const sd = 0.03;
  const r = 0.0065;
  if (vertical)
    return [
      rod([x, y - len / 2, z + sd], [x, y + len / 2, z + sd], r * 2, slot, { seg: 10 }),
      rod([x, y - len / 2 + 0.02, z], [x, y - len / 2 + 0.02, z + sd], r * 1.6, slot, { seg: 8 }),
      rod([x, y + len / 2 - 0.02, z], [x, y + len / 2 - 0.02, z + sd], r * 1.6, slot, { seg: 8 }),
    ];
  return [
    rod([x - len / 2, y, z + sd], [x + len / 2, y, z + sd], r * 2, slot, { seg: 10 }),
    rod([x - len / 2 + 0.02, y, z], [x - len / 2 + 0.02, y, z + sd], r * 1.6, slot, { seg: 8 }),
    rod([x + len / 2 - 0.02, y, z], [x + len / 2 - 0.02, y, z + sd], r * 1.6, slot, { seg: 8 }),
  ];
}

export interface BaseOpts {
  /** 'door' | 'doors' (pair) | 'drawers' (stack) */
  layout?: 'door' | 'doors' | 'drawers' | 'sink' | 'open';
  drawers?: number;
  /** countertop thickness and overhang; 0 for none */
  counterT?: number;
  overhang?: number;
  /** z of the cabinet's back (default -d/2) and front (default d/2) */
  kick?: number;
}

/** Base cabinet carcass with face frame, toe kick, fronts, hardware and a countertop slab. */
export function baseCabinet(w: number, d: number, h: number, o: BaseOpts = {}): Part[] {
  const parts: Part[] = [];
  const kick = o.kick ?? 0.1;
  const ct = o.counterT ?? 0.032;
  const oh = o.overhang ?? 0.025;
  const boxH = h - ct;
  const zf = d / 2 - oh - FT_THK; // face-frame plane
  const zb = -d / 2;
  // carcass and recessed toe kick
  parts.push(box(0, kick + (boxH - kick) / 2, (zf + zb) / 2, w - 0.004, boxH - kick, zf - zb, 'primary', { tint: [0.85, 0.85, 0.85], gv: true }));
  parts.push(box(0, kick / 2, (zf - 0.07 + zb) / 2, w - 0.02, kick, zf - 0.07 - zb, 'rubber', { tint: [0.8, 0.78, 0.76] }));
  // countertop with an eased front edge
  if (ct > 0) parts.push(rbox(0, h - ct / 2, oh / 2 - 0.0, w + 0.004, ct, d + 0.0, 0.004, 'accent'));
  // fronts
  const fx0 = -w / 2 + 0.004;
  const fx1 = w / 2 - 0.004;
  const fy0 = kick + 0.003;
  const fy1 = boxH - 0.006;
  const gap = 0.004;
  const fw = fx1 - fx0;
  const fh = fy1 - fy0;
  const layout = o.layout ?? (w > 0.75 ? 'doors' : 'door');
  if (layout === 'open') return parts;
  if (layout === 'drawers') {
    const n = o.drawers ?? 3;
    // graduated: top drawer shortest
    const weights = n === 3 ? [0.22, 0.34, 0.44] : n === 4 ? [0.18, 0.24, 0.27, 0.31] : Array(n).fill(1 / n);
    let y = fy1;
    for (let i = 0; i < n; i++) {
      const hh = fh * weights[i] - gap;
      parts.push(...shakerFront(0, y - hh / 2, zf, fw, hh, 'primary', i === 0));
      parts.push(...barPull(0, y - Math.min(0.06, hh * 0.3), zf + FT_THK, Math.min(0.3, fw * 0.45)));
      y -= hh + gap;
    }
    return parts;
  }
  // drawer over door(s)
  const dh = layout === 'sink' ? 0.16 : 0.15;
  parts.push(...shakerFront(0, fy1 - dh / 2, zf, fw, dh, 'primary', true));
  if (layout === 'sink') {
    // false front: no pull on a tilt-out panel, just a small knob pair for the tilt trays
  } else parts.push(...barPull(0, fy1 - dh / 2, zf + FT_THK, Math.min(0.3, fw * 0.45)));
  const doorTop = fy1 - dh - gap;
  const doorH = doorTop - fy0;
  if (layout === 'door') {
    parts.push(...shakerFront(0, fy0 + doorH / 2, zf, fw, doorH));
    parts.push(...barPull(fw / 2 - 0.045, doorTop - 0.12, zf + FT_THK, 0.13, true));
  } else {
    const dw = (fw - gap) / 2;
    for (const sx of [-1, 1]) {
      parts.push(...shakerFront(sx * (dw / 2 + gap / 2), fy0 + doorH / 2, zf, dw, doorH));
      parts.push(...barPull(sx * (gap / 2 + 0.045), doorTop - 0.12, zf + FT_THK, 0.13, true));
    }
  }
  return parts;
}

/* ------------------------------------------------------------------ fixtures */

/** Matte black pull-down faucet with arched spout and side lever, base at (x,y,z), spout pointing +z. */
export function pullDownFaucet(x: number, y: number, z: number, reach = 0.22, height = 0.42, slot: Part['slot'] = 'metal'): Part[] {
  return [
    lathe(x, y, z, [[0, 0], [0.034, 0], [0.034, 0.006], [0.025, 0.012], [0.023, 0.15], [0.016, 0.165], [0, 0.165]], slot),
    tube([[x, y + 0.15, z], [x, y + height * 0.8, z], [x, y + height, z + reach * 0.35], [x, y + height * 0.92, z + reach * 0.8], [x, y + height * 0.72, z + reach]], 0.012, slot, { smooth: true, rs: 12 }),
    lathe(x, y + height * 0.6, z + reach, [[0, 0], [0.013, 0], [0.017, 0.012], [0.017, 0.075], [0.019, 0.08], [0.019, 0.095], [0.0125, 0.12], [0, 0.12]], slot),
    // side lever: hub on the body and a long handle rising parallel to it
    cyl(x + 0.028, y + 0.07, z, 0.03, 0.03, 0.03, slot, { r: [0, 0, Math.PI / 2], seg: 14 }),
    rod([x + 0.042, y + 0.07, z], [x + 0.05, y + 0.17, z - 0.008], 0.013, slot, { taper: 0.8 }),
  ];
}

/** Undermount or apron-front basin opening: rim shadow plus a basin sunk into the counter. top = counter top y. */
export function basin(x: number, top: number, z: number, w: number, d: number, depth: number, slot: Part['slot'] = 'chrome'): Part[] {
  return [
    // basin walls as a squircle lathe-like extrusion, open top
    ext(x, top - depth / 2 - 0.001, z, squircle(w / 2, d / 2, 6, 40), depth, slot, { r: [Math.PI / 2, 0, 0], holes: [squircle(w / 2 - 0.008, d / 2 - 0.008, 6, 40)] }),
    ext(x, top - depth, z, squircle(w / 2, d / 2, 6, 40), 0.006, slot, { r: [Math.PI / 2, 0, 0] }),
    // drain
    cyl(x, top - depth + 0.004, z + d * 0.15, 0.06, 0.004, 0.06, 'chrome'),
    cyl(x, top - depth + 0.005, z + d * 0.15, 0.03, 0.004, 0.03, 'rubber'),
  ];
}

/** Fireclay apron-front farmhouse sink with a tilt-out false front and doors below, black pull-down faucet. */
export function farmhouseSinkCabinet(w: number, d: number, h: number): Part[] {
  const parts: Part[] = [];
  const ct = 0.032;
  const oh = 0.025;
  const kick = 0.1;
  const apronH = 0.24;
  const sinkW = Math.min(w - 0.1, 0.84);
  const zf = d / 2 - oh - FT_THK;
  // cabinet with doors below the apron
  const doorTop0 = h - ct - apronH - 0.01;
  parts.push(box(0, kick + (doorTop0 - kick) / 2, (zf - d / 2) / 2, w - 0.004, doorTop0 - kick, zf + d / 2, 'primary', { tint: [0.85, 0.85, 0.85], gv: true }));
  for (const sx of [-1, 1]) parts.push(box(sx * (w / 2 - 0.01), (doorTop0 + h - ct) / 2, (zf - d / 2) / 2, 0.02, h - ct - doorTop0, zf + d / 2, 'primary', { gv: true }));
  parts.push(box(0, kick / 2, (zf - 0.07 - d / 2) / 2, w - 0.02, kick, zf - 0.07 + d / 2, 'rubber', { tint: [0.8, 0.78, 0.76] }));
  const doorTop = h - ct - apronH - 0.01;
  const dh = doorTop - kick - 0.004;
  const dw = (w - 0.012) / 2;
  for (const sx of [-1, 1]) {
    parts.push(...shakerFront(sx * (dw / 2 + 0.002), kick + 0.003 + dh / 2, zf, dw, dh));
    parts.push(...barPull(sx * 0.047, doorTop - 0.12, zf + FT_THK, 0.13, true));
  }
  // counter returns either side of the apron
  const side = (w - sinkW) / 2;
  for (const sx of [-1, 1]) {
    parts.push(rbox(sx * (w / 2 - side / 2), h - ct / 2, oh / 2, side + 0.002, ct, d, 0.004, 'accent'));
    parts.push(box(sx * (w / 2 - side / 2), h - ct - apronH / 2, zf + FT_THK / 2, side, apronH, FT_THK, 'primary', { gv: true }));
  }
  parts.push(rbox(0, h - ct / 2, -d / 2 + 0.06, sinkW, ct, 0.12, 0.004, 'accent'));
  // fireclay sink: apron front, thick rim, deep basin
  const sd = d - 0.2;
  const zs = zf + FT_THK - sd / 2;
  const outer = roundRect(sinkW, sd, 0.03, 4);
  const inner = roundRect(sinkW - 0.05, sd - 0.05, 0.05, 6);
  parts.push(ext(0, h - 0.004 - apronH / 2 + 0.002, zs, outer, apronH + 0.004, 'ceramic', { r: [Math.PI / 2, 0, 0], holes: [inner], bevel: 0.006 }));
  parts.push(rbox(0, h - apronH + 0.012, zs, sinkW - 0.04, 0.02, sd - 0.04, 0.008, 'ceramic', { tint: [0.95, 0.95, 0.95] }));
  parts.push(cyl(0, h - apronH + 0.024, zs + 0.02, 0.09, 0.004, 0.09, 'chrome'));
  parts.push(cyl(0, h - apronH + 0.025, zs + 0.02, 0.045, 0.004, 0.045, 'rubber'));
  // faucet behind the sink
  parts.push(...pullDownFaucet(0.0, h, -d / 2 + 0.07, 0.24, 0.42));
  return parts;
}

/* ------------------------------------------------------------------ appliances */

/** Stainless French-door refrigerator with bottom freezer drawer, tall bar handles, ice and water dispenser. */
export function frenchDoorFridge(w: number, d: number, h: number): Part[] {
  const parts: Part[] = [];
  const zf = d / 2 - 0.035;
  const kick = 0.06;
  parts.push(rbox(0, kick + (h - kick) / 2, -0.03, w - 0.006, h - kick, d - 0.06, 0.01, 'secondary', { tint: [0.35, 0.35, 0.35] }));
  parts.push(box(0, kick / 2, 0, w - 0.03, kick, d - 0.12, 'rubber'));
  parts.push(box(0, kick * 0.6, zf - 0.02, w - 0.08, 0.035, 0.01, 'rubber', { tint: [0.6, 0.6, 0.6] }));
  const freezerH = (h - kick) * 0.37;
  const yF = kick + 0.004;
  const gap = 0.005;
  // freezer drawer
  parts.push(rbox(0, yF + freezerH / 2, zf + 0.025, w - 0.008, freezerH - gap, 0.05, 0.01, 'primary'));
  parts.push(rbox(0, yF + freezerH - 0.05, zf + 0.075, w * 0.72, 0.03, 0.022, 0.008, 'chrome'));
  for (const sx of [-1, 1]) parts.push(rbox(sx * w * 0.34, yF + freezerH - 0.05, zf + 0.058, 0.03, 0.026, 0.02, 0.006, 'chrome'));
  // French doors
  const y0 = yF + freezerH;
  const dh = h - y0 - 0.006;
  const dw = (w - 0.008 - gap) / 2;
  for (const sx of [-1, 1]) {
    const x = sx * (dw / 2 + gap / 2);
    parts.push(rbox(x, y0 + dh / 2, zf + 0.025, dw, dh, 0.05, 0.01, 'primary'));
    const hy = y0 + dh * 0.55;
    parts.push(rbox(sx * (gap / 2 + 0.035), hy, zf + 0.078, 0.04, dh * 0.55, 0.022, 0.008, 'chrome'));
    for (const e of [-1, 1]) parts.push(rbox(sx * (gap / 2 + 0.035), hy + e * dh * 0.25, zf + 0.06, 0.03, 0.03, 0.02, 0.006, 'chrome'));
  }
  // dispenser recess on the left door
  const dx = -(dw / 2 + gap / 2);
  parts.push(rbox(dx - 0.02, y0 + dh * 0.5, zf + 0.051, 0.2, 0.32, 0.004, 0.012, 'rubber'));
  parts.push(box(dx - 0.02, y0 + dh * 0.5 + 0.13, zf + 0.054, 0.16, 0.04, 0.002, 'screen'));
  parts.push(box(dx - 0.02, y0 + dh * 0.5 - 0.02, zf + 0.0525, 0.17, 0.22, 0.002, 'paper', { tint: [0.82, 0.88, 0.95] }));
  parts.push(box(dx - 0.02, y0 + dh * 0.5 + 0.03, zf + 0.055, 0.04, 0.08, 0.004, 'chrome'));
  parts.push(box(dx - 0.02, y0 + dh * 0.5 - 0.13, zf + 0.056, 0.16, 0.01, 0.03, 'rubber'));
  return parts;
}

/** Pro-style dual-fuel range: knob row, glass-window oven door with towel-bar handle, sealed burners and cast grates; box hood above. */
export function proRange(w: number, d: number, h: number, hood = true): Part[] {
  const parts: Part[] = [];
  const zf = d / 2 - 0.04;
  parts.push(box(0, h / 2, -0.03, w - 0.006, h - 0.004, d - 0.08, 'primary'));
  parts.push(box(0, 0.05, zf - 0.04, w - 0.06, 0.1, 0.02, 'rubber'));
  // control panel with knobs
  const panelY = h - 0.07;
  parts.push(rbox(0, panelY, zf + 0.005, w, 0.12, 0.05, 0.006, 'primary'));
  const kn = w > 0.85 ? 7 : 5;
  for (let i = 0; i < kn; i++) {
    const x = -w * 0.36 + (i * w * 0.72) / (kn - 1);
    parts.push(lathe(x, panelY, zf + 0.03, [[0, 0], [0.026, 0], [0.026, 0.008], [0.022, 0.03], [0.02, 0.036], [0, 0.036]], 'rubber', { r: [Math.PI / 2, 0, 0] }));
    parts.push(torus(x, panelY, zf + 0.034, 0.026, 0.004, 'chrome'));
    parts.push(box(x, panelY + 0.003, zf + 0.0625, 0.004, 0.022, 0.002, 'rubber'));
  }
  // oven door: frame, dark glass window, towel bar handle on standoffs
  const doorTop = panelY - 0.07;
  const doorBot = 0.12;
  const dh = doorTop - doorBot;
  parts.push(rbox(0, doorBot + dh / 2, zf + 0.02, w - 0.012, dh, 0.04, 0.008, 'primary'));
  parts.push(rbox(0, doorBot + dh * 0.45, zf + 0.041, w * 0.8, dh * 0.62, 0.006, 0.014, 'chrome'));
  parts.push(rbox(0, doorBot + dh * 0.45, zf + 0.044, w * 0.76, dh * 0.57, 0.004, 0.012, 'screen'));
  for (let i = 0; i < 3; i++) parts.push(box(0, doorBot + dh * (0.3 + i * 0.13), zf + 0.035, w * 0.7, 0.004, 0.004, 'chrome', { tint: [0.4, 0.4, 0.4] }));
  parts.push(rod([-w * 0.43, doorTop - 0.045, zf + 0.085], [w * 0.43, doorTop - 0.045, zf + 0.085], 0.03, 'chrome'));
  for (const sx of [-1, 1]) parts.push(rbox(sx * w * 0.43, doorTop - 0.045, zf + 0.06, 0.04, 0.04, 0.06, 0.012, 'chrome'));
  // cooktop: black tray, burners, cast iron grates
  parts.push(box(0, h - 0.003, 0, w - 0.01, 0.006, d - 0.04, 'rubber', { tint: [0.6, 0.6, 0.6] }));
  const wide = w > 0.85;
  const bx = wide ? [-w * 0.34, w * 0.34] : [-w * 0.22, w * 0.22];
  if (wide) {
    parts.push(rbox(0, h + 0.012, 0, w * 0.3, 0.018, d * 0.72, 0.004, 'rubber', { tint: [0.7, 0.7, 0.7] }));
    for (let i = 0; i < 9; i++) parts.push(box(-w * 0.13 + (i * w * 0.26) / 8, h + 0.0215, 0, 0.012, 0.004, d * 0.66, 'rubber'));
  }
  for (const x of bx)
    for (const z of [-d * 0.2, d * 0.17]) {
      parts.push(cyl(x, h + 0.008, z, 0.1, 0.014, 0.1, 'rubber'));
      parts.push(cyl(x, h + 0.017, z, 0.06, 0.006, 0.06, 'brass', { tint: [0.6, 0.55, 0.5] }));
    }
  const gw = wide ? w * 0.34 : w / bx.length;
  for (let i = 0; i < bx.length; i++) {
    const gx = bx[i];
    for (const z of [-d * 0.36, -d * 0.02, d * 0.33]) parts.push(rbox(gx, h + 0.03, z, gw - 0.02, 0.012, 0.012, 0.004, 'rubber'));
    for (const xo of [-gw * 0.45, -gw * 0.15, gw * 0.15, gw * 0.45]) parts.push(rbox(gx + xo, h + 0.03, 0, 0.012, 0.012, d * 0.68, 0.004, 'rubber'));
  }
  parts.push(rbox(0, h + 0.03, -d / 2 + 0.05, w, 0.06, 0.04, 0.006, 'primary'));
  if (hood) {
    // matte black box hood with liner, set high on the wall behind
    const hy = 1.87 - 0.91 + h; // hood bottom ~ 66 in above floor when range is 36 in
    const hh = 0.85;
    parts.push(rbox(0, hy + hh / 2, -d / 2 + 0.24, w + 0.08, hh, 0.48, 0.006, 'rubber', { tint: [0.45, 0.45, 0.45] }));
    parts.push(box(0, hy + 0.005, -d / 2 + 0.24, w - 0.02, 0.01, 0.44, 'chrome', { tint: [0.6, 0.6, 0.6] }));
    for (const x of [-w * 0.25, w * 0.25]) parts.push(cyl(x, hy - 0.001, -d / 2 + 0.26, 0.06, 0.004, 0.06, 'glow'));
  }
  return parts;
}

/** Panel-ready dishwasher: walnut panel matching the run, hidden controls, bar pull. */
export function panelDishwasher(w: number, d: number, h: number): Part[] {
  const parts = baseCabinet(w, d, h, { layout: 'open' });
  const kick = 0.1;
  const zf = d / 2 - 0.025 - FT_THK;
  parts.push(...shakerFront(0, kick + (h - 0.032 - kick) / 2 - 0.04, zf, w - 0.008, h - 0.032 - kick - 0.088));
  parts.push(...shakerFront(0, h - 0.032 - 0.045, zf, w - 0.008, 0.08, 'primary', true));
  parts.push(...barPull(0, h - 0.032 - 0.045, zf + FT_THK, Math.min(0.36, w * 0.6)));
  parts.push(box(0, h - 0.032 - 0.004, zf - 0.002, w - 0.04, 0.006, 0.01, 'rubber'));
  return parts;
}

/** Wall cabinet: shaker doors, bottom light rail with warm under-cabinet light. */
export function wallCabinet(w: number, d: number, h: number): Part[] {
  const parts: Part[] = [];
  const zf = d / 2 - FT_THK;
  parts.push(box(0, h / 2, -FT_THK / 2, w - 0.004, h, d - FT_THK, 'primary', { tint: [0.85, 0.85, 0.85] }));
  // stepped crown: fillet, cove, cap
  parts.push(rbox(0, h - 0.04, 0.006, w + 0.012, 0.02, d + 0.012, 0.003, 'primary'));
  parts.push(rbox(0, h - 0.022, 0.016, w + 0.04, 0.02, d + 0.032, 0.008, 'primary'));
  parts.push(rbox(0, h - 0.006, 0.024, w + 0.064, 0.014, d + 0.048, 0.003, 'primary'));
  const n = w > 0.7 ? 2 : 1;
  const gap = 0.004;
  const fw = (w - 0.008 - gap * (n - 1)) / n;
  const fh = h - 0.066;
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 0.004 + fw / 2 + i * (fw + gap);
    parts.push(...shakerFront(x, 0.016 + fh / 2, zf, fw, fh));
    const hx = n === 1 ? fw / 2 - 0.045 : i === 0 ? fw / 2 - 0.045 : -fw / 2 + 0.045;
    parts.push(...barPull(x + hx, 0.016 + 0.11, zf + FT_THK, 0.13, true));
  }
  parts.push(box(0, 0.004, 0.0, w - 0.06, 0.006, d * 0.5, 'glow'));
  return parts;
}

/** Kitchen island: shaker cabinet run on the work side, stone top with prep sink, solid walnut ledge with a waterfall leg on the seating side. */
export function island(w: number, d: number, h: number): Part[] {
  const parts: Part[] = [];
  const cabD = 0.61;
  const ct = 0.035;
  const ledgeD = Math.max(0.25, d - cabD - 0.08);
  const ledgeT = 0.065;
  const zc = -d / 2 + cabD / 2;
  // work side faces -z: build cabinets facing +z, then turn them round
  const run: Part[] = [];
  const units = Math.max(2, Math.round((w - 0.12) / 0.75));
  const uw = (w - 0.12) / units;
  for (let i = 0; i < units; i++) {
    const x = -w / 2 + 0.04 + uw / 2 + i * uw;
    const layout = i === 0 || i === units - 1 ? 'drawers' : 'sink';
    run.push(...baseCabinet(uw, cabD, h - ct, { layout, counterT: 0, overhang: 0 }).map((p) => (p.s === 'tube' && !p.r && p.p[0] === 0 ? { ...p, path: p.path.map(([px, py, pz]) => [px + x, py, pz] as Vec3) } : { ...p, p: [p.p[0] + x, p.p[1], p.p[2]] as Vec3 })));
  }
  parts.push(...rotateY(run, Math.PI).map((p) => (p.s === 'tube' && !p.yaw ? { ...p, path: p.path.map(([px, py, pz]) => [px, py, pz + zc] as Vec3) } : { ...p, p: [p.p[0], p.p[1], p.p[2] + zc] as Vec3 })));
  // seating side: flat slab panels with vertical reveals, recessed for knees under the ledge
  const zs = -d / 2 + cabD + 0.01;
  parts.push(box(-0.04, 0.05, zs - 0.05, w - 0.16, 0.1, 0.02, 'rubber', { tint: [0.6, 0.58, 0.56] }));
  parts.push(box(-0.04, (h - ct) / 2 + 0.05, zs, w - 0.16, h - ct - 0.1, 0.02, 'primary', { gv: true }));
  const panels = Math.max(2, Math.round((w - 0.16) / 0.45));
  for (let i = 1; i < panels; i++) parts.push(box(-0.04 - (w - 0.16) / 2 + (i * (w - 0.16)) / panels, (h - ct) / 2 + 0.05, zs + 0.0105, 0.007, h - ct - 0.12, 0.002, 'rubber', { tint: [0.25, 0.24, 0.23] }));
  // stone top over the cabinets with a small overhang, end panel at -x
  parts.push(rbox(-0.03, h - ct / 2, -d / 2 + (cabD + 0.06) / 2 - 0.02, w - 0.06, ct, cabD + 0.06, 0.004, 'accent'));
  parts.push(rbox(-w / 2 + 0.02, (h - ct) / 2, -d / 2 + cabD / 2 + 0.01, 0.04, h - ct, cabD + 0.02, 0.004, 'accent'));
  // walnut ledge and waterfall leg at +x
  const zl = d / 2 - ledgeD / 2;
  const l0 = -w / 2 + Math.min(0.35, w * 0.14);
  parts.push(rbox((l0 + w / 2) / 2, h - ledgeT / 2, zl, w / 2 - l0, ledgeT, ledgeD, 0.008, 'secondary'));
  parts.push(rbox(w / 2 - ledgeT / 2, (h - ledgeT) / 2, zl - 0.02, ledgeT, h - ledgeT, ledgeD + 0.04, 0.008, 'secondary', { gv: true }));
  // prep sink and brass faucet on the work side
  const sx = w * 0.05;
  const sz0 = -d / 2 + cabD * 0.45;
  parts.push(rbox(sx, h + 0.0005, sz0, 0.46, 0.002, 0.36, 0.004, 'rubber'));
  parts.push(box(sx, h - 0.09, sz0, 0.42, 0.18, 0.32, 'rubber', { tint: [0.3, 0.3, 0.3] }));
  parts.push(...pullDownFaucet(sx, h, -d / 2 + 0.07, 0.2, 0.36, 'brass').map((p) => p));
  return parts;
}

export const KITCHEN: CatalogItem[] = [
  {
    id: 'base-cabinet',
    name: 'Base cabinet',
    category: 'Kitchen',
    size: sz(3, 2, 3),
    slots: { primary: { label: 'Cabinet', default: 'walnut' }, accent: { label: 'Counter', default: 'soapstone' } },
    parts: (w, d, h) => baseCabinet(w, d, h, { layout: w > 0.85 ? 'doors' : w < 0.62 ? 'drawers' : 'door' }),
    solid: true,
    ref: 'Shaker base cabinet: drawer over door, face frame, recessed toe kick; matte black bar pulls',
  },
  {
    id: 'wall-cabinet',
    name: 'Wall cabinet',
    category: 'Kitchen',
    size: sz(3, 1.1, 2.6),
    slots: { primary: { label: 'Cabinet', default: 'walnut' } },
    parts: (w, d, h) => wallCabinet(w, d, h),
    solid: false,
    defaultElevation: 1.45,
    ref: 'Shaker upper cabinet with crown cap and under-cabinet light',
  },
  {
    id: 'island',
    name: 'Kitchen island',
    category: 'Kitchen',
    size: sz(8, 3.5, 3),
    slots: { primary: { label: 'Cabinet', default: 'walnut' }, secondary: { label: 'Ledge', default: 'walnut-furniture' }, accent: { label: 'Counter', default: 'soapstone' } },
    parts: (w, d, h) => island(w, d, h),
    solid: true,
    ref: 'Island with stone top, prep sink, brass faucet and a solid walnut waterfall ledge (Etsy custom island)',
  },
  {
    id: 'refrigerator',
    name: 'Refrigerator',
    category: 'Kitchen',
    size: sz(3, 2.6, 5.9),
    slots: { primary: { label: 'Finish', default: 'steel' }, secondary: { label: 'Case', default: 'black-metal' } },
    parts: (w, d, h) => frenchDoorFridge(w, d, h),
    solid: true,
    ref: 'Stainless French-door refrigerator, bottom freezer drawer, tall bar handles, dispenser',
  },
  {
    id: 'range',
    name: 'Range with hood',
    category: 'Kitchen',
    size: sz(3, 2.4, 3),
    slots: { primary: { label: 'Finish', default: 'steel' } },
    parts: (w, d, h) => proRange(w, d, h),
    solid: true,
    ref: 'Pro-style range with knob row, grates, towel-bar handle; matte black box hood',
  },
  {
    id: 'sink',
    name: 'Farmhouse sink cabinet',
    category: 'Kitchen',
    size: sz(3, 2, 3),
    slots: { primary: { label: 'Cabinet', default: 'walnut' }, accent: { label: 'Counter', default: 'soapstone' } },
    parts: (w, d, h) => farmhouseSinkCabinet(w, d, h),
    solid: true,
    ref: 'Fireclay apron-front sink, black pull-down faucet, shaker doors',
  },
  {
    id: 'dishwasher',
    name: 'Dishwasher (panel)',
    category: 'Kitchen',
    size: sz(2, 2, 3),
    slots: { primary: { label: 'Panel', default: 'walnut' }, accent: { label: 'Counter', default: 'soapstone' } },
    parts: (w, d, h) => panelDishwasher(w, d, h),
    solid: true,
    ref: 'Panel-ready dishwasher in a matching walnut shaker panel',
  },
];

void torus;
