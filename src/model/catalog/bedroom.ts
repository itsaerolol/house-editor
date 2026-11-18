import { type Part, type Vec3, beam, box, cushion, cyl, ext, lathe, liveEdge, rbox, rod, roundRect, sz, tube } from './kit';
import type { CatalogItem } from './types';

/** Styled bedding on a mattress whose top is at y, spanning w x d with the head at -z. */
export function bedding(w: number, d: number, y: number, zHead: number, opts: { shams?: number; throw?: boolean; book?: boolean; duvet?: Part['slot']; duvetTint?: Vec3; runner?: Vec3 } = {}): Part[] {
  const dv = opts.duvet ?? 'primary';
  const dt = opts.duvetTint;
  const parts: Part[] = [];
  const zFoot = zHead + d;
  // duvet: thick quilted top, draped sides and foot, folded back under the pillows
  const dTop = d * 0.74;
  const zd = zFoot - dTop / 2 + 0.03;
  parts.push(cushion(0, y + 0.03, zd, w + 0.06, 0.08, dTop, 0.04, 0.03, dv, { tint: dt }));
  for (const sx of [-1, 1]) parts.push(cushion(sx * (w / 2 + 0.02), y - 0.09, zd, 0.045, 0.24, dTop - 0.02, 0.02, 0.01, dv, { tint: dt }));
  parts.push(cushion(0, y - 0.1, zFoot + 0.02, w + 0.06, 0.24, 0.04, 0.018, 0.008, dv, { tint: dt }));
  parts.push(cushion(0, y + 0.05, zd - dTop / 2 + 0.06, w + 0.04, 0.09, 0.16, 0.04, 0.025, dv, { tint: dt ? [dt[0] * 0.92, dt[1] * 0.92, dt[2] * 0.92] : [0.92, 0.92, 0.92] }));
  if (opts.runner) {
    parts.push(cushion(0, y + 0.085, zFoot - 0.33, w + 0.07, 0.025, 0.5, 0.012, 0.006, 'cloth', { tint: opts.runner }));
    for (const sx of [-1, 1]) parts.push(cushion(sx * (w / 2 + 0.05), y - 0.05, zFoot - 0.33, 0.025, 0.24, 0.5, 0.01, 0.004, 'cloth', { tint: opts.runner }));
  }
  // sheet showing between fold and pillows
  parts.push(cushion(0, y + 0.012, zHead + d * 0.14, w - 0.02, 0.025, d * 0.3, 0.012, 0.004, 'accent', { tint: [1.04, 1.04, 1.04] }));
  // shams leaning on the headboard, sleeping pillows in front
  const ns = opts.shams ?? 2;
  const sw = (w - 0.06) / ns;
  for (let i = 0; i < ns; i++) {
    const x = -w / 2 + 0.03 + sw / 2 + i * sw;
    parts.push(cushion(x, y + 0.2, zHead + 0.11, sw - 0.03, 0.36, 0.14, 0.07, 0.05, 'accent', { r: [-0.3, 0, 0], tint: [0.94, 0.95, 0.97] }));
  }
  const pw = Math.min(0.72, (w - 0.08) / 2);
  const np = w > 1.2 ? 2 : 1;
  for (let i = 0; i < np; i++) {
    const x = np === 1 ? 0 : (i === 0 ? -1 : 1) * (pw / 2 + 0.01);
    parts.push(cushion(x, y + 0.1, zHead + 0.3, pw * 0.92, 0.12, 0.38, 0.06, 0.045, 'accent', { r: [-0.55, 0, 0] }));
  }
  // folded throw across the foot, draped over the edge
  if (opts.throw !== false) {
    const tw = w * 0.5;
    const tx = -w * 0.12;
    parts.push(cushion(tx, y + 0.085, zFoot - 0.26, tw, 0.035, 0.5, 0.015, 0.008, 'cloth', { r: [0, 0.04, 0] }));
    parts.push(cushion(tx, y - 0.08, zFoot + 0.05, tw, 0.32, 0.03, 0.012, 0.006, 'cloth'));
    if (opts.book !== false) {
      parts.push(rbox(tx - 0.05, y + 0.115, zFoot - 0.3, 0.22, 0.025, 0.15, 0.003, 'paper', { r: [0, 0.2, 0], tint: [0.22, 0.42, 0.6] }));
      parts.push(rbox(tx - 0.05, y + 0.115, zFoot - 0.3, 0.214, 0.022, 0.145, 0.002, 'paper', { r: [0, 0.2, 0], tint: [1.02, 1, 0.94] }));
    }
  }
  return parts;
}

/** Solid wood platform bed: big panel headboard with soft top corners, round corner legs, rails. */
export function panelBed(w: number, d: number, h: number): Part[] {
  const parts: Part[] = [];
  const legD = 0.075;
  const deck = 0.3;
  const zh = -d / 2;
  // headboard panel
  const hbH = h - 0.12;
  parts.push(ext(0, 0.12 + hbH / 2, zh + 0.025, roundRect(w, hbH, 0.07, 8), 0.045, 'secondary', { bevel: 0.006 }));
  // legs: round, slightly proud of the rails at the foot
  for (const sx of [-1, 1]) {
    parts.push(cyl(sx * (w / 2 - legD / 2), 0.17, d / 2 - legD / 2, legD, 0.34, legD, 'secondary'));
    parts.push(cyl(sx * (w / 2 - legD / 2), 0.07, zh + 0.07, legD, 0.14, legD, 'secondary'));
    parts.push(rbox(sx * (w / 2 - 0.022), 0.22, 0.02, 0.04, 0.14, d - 0.15, 0.006, 'secondary'));
  }
  parts.push(rbox(0, 0.22, d / 2 - 0.022, w - 0.12, 0.14, 0.04, 0.006, 'secondary'));
  // slatted deck and mattress
  parts.push(rbox(0, deck - 0.01, 0.02, w - 0.08, 0.02, d - 0.12, 0.004, 'secondary', { tint: [0.8, 0.8, 0.8] }));
  const mh = 0.24;
  parts.push(cushion(0, deck + mh / 2, 0.03, w - 0.06, mh, d - 0.13, 0.05, 0.015, 'accent'));
  parts.push(...bedding(w - 0.06, d - 0.13, deck + mh, zh + 0.065));
  return parts;
}

/** Spindle bed: bentwood arched headboard hoop with spindles, deep side rails, splayed tapered legs, tucked bedding. */
export function spindleBed(w: number, d: number, h: number): Part[] {
  const parts: Part[] = [];
  const zh = -d / 2 + 0.03;
  const hx = w / 2 - 0.03;
  const shoulder = h * 0.8;
  // arched hoop running down into the head legs
  const hoop: Vec3[] = [
    [-hx - 0.02, 0, zh - 0.06],
    [-hx, shoulder * 0.55, zh],
    [-hx + 0.005, shoulder, zh],
    [-hx * 0.75, h - 0.06, zh],
    [0, h - 0.02, zh],
    [hx * 0.75, h - 0.06, zh],
    [hx - 0.005, shoulder, zh],
    [hx, shoulder * 0.55, zh],
    [hx + 0.02, 0, zh - 0.06],
  ];
  parts.push(tube(hoop, 0.024, 'secondary', { smooth: true, rs: 12 }));
  const lowY = 0.46;
  parts.push(rod([-hx, lowY, zh], [hx, lowY, zh], 0.038, 'secondary'));
  // spindles following the arch
  const n = 9;
  for (let i = 0; i < n; i++) {
    const x = -hx * 0.82 + (i * hx * 1.64) / (n - 1);
    const t = x / hx;
    const yTop = h - 0.03 - (h - 0.03 - shoulder) * Math.pow(Math.abs(t), 2.4);
    parts.push(rod([x, lowY, zh], [x, yTop - 0.01, zh], 0.019, 'secondary', { seg: 10 }));
  }
  // deep side rails and foot rail
  for (const sx of [-1, 1]) parts.push(rbox(sx * (w / 2 - 0.02), 0.26, 0.02, 0.035, 0.15, d - 0.1, 0.008, 'secondary'));
  parts.push(rbox(0, 0.26, d / 2 - 0.035, w - 0.02, 0.15, 0.035, 0.008, 'secondary'));
  // splayed tapered foot legs
  for (const sx of [-1, 1]) parts.push(rod([sx * (w / 2 + 0.005), 0, d / 2 + 0.01], [sx * (w / 2 - 0.035), 0.33, d / 2 - 0.035], 0.04, 'secondary', { taper: 1.3 }));
  // mattress, tucked blanket with a sheet fold, one pillow
  const mt = 0.33 + 0.2;
  parts.push(cushion(0, 0.33 + 0.1, 0.02, w - 0.06, 0.2, d - 0.1, 0.05, 0.012, 'accent'));
  parts.push(cushion(0, mt + 0.012, 0.15, w - 0.04, 0.03, d - 0.36, 0.025, 0.012, 'primary'));
  for (const sx of [-1, 1]) parts.push(cushion(sx * (w / 2 - 0.015), mt - 0.07, 0.15, 0.03, 0.15, d - 0.38, 0.012, 0.005, 'primary'));
  parts.push(cushion(0, mt + 0.025, -d / 2 + 0.47, w - 0.03, 0.04, 0.14, 0.02, 0.012, 'accent', { tint: [1.04, 1.04, 1.04] }));
  parts.push(cushion(0, mt + 0.07, -d / 2 + 0.26, w * 0.72, 0.11, 0.42, 0.055, 0.04, 'accent', { r: [-0.18, 0, 0] }));
  return parts;
}

/** Low walnut platform with a floating plinth, tall channel headboard panels, white duvet, sage runner and lumbar. */
export function channelPanelBed(w: number, d: number, h: number): Part[] {
  const parts: Part[] = [];
  const sage: Vec3 = [0.52, 0.62, 0.46];
  // floating platform
  parts.push(rbox(0, 0.06, 0.02, w - 0.2, 0.1, d - 0.25, 0.01, 'secondary', { tint: [0.5, 0.48, 0.46] }));
  parts.push(rbox(0, 0.2, 0.02, w + 0.04, 0.17, d + 0.02, 0.012, 'secondary'));
  // tall channel panels
  const n = 4;
  const pw = (w + 0.12) / n;
  for (let i = 0; i < n; i++) {
    const x = -(w + 0.12) / 2 + pw / 2 + i * pw;
    parts.push(cushion(x, h / 2 + 0.04, -d / 2 - 0.02, pw - 0.008, h - 0.08, 0.08, 0.03, 0.018, 'primary'));
  }
  // mattress and bedding
  const deck = 0.285;
  const mh = 0.26;
  parts.push(cushion(0, deck + mh / 2, 0.03, w - 0.04, mh, d - 0.1, 0.05, 0.015, 'accent', { tint: [1.04, 1.04, 1.04] }));
  parts.push(...bedding(w - 0.04, d - 0.1, deck + mh, -d / 2 + 0.06, { shams: 2, throw: false, duvet: 'accent', duvetTint: [1.05, 1.05, 1.05], runner: sage }));
  // sage lumbar pillow in front of the sleeping pillows
  parts.push(cushion(w * 0.1, deck + mh + 0.2, -d / 2 + 0.5, 0.48, 0.42, 0.14, 0.08, 0.06, 'cloth', { r: [-0.3, -0.1, 0], tint: sage }));
  parts.push(cushion(-w * 0.18, deck + mh + 0.2, -d / 2 + 0.47, 0.5, 0.44, 0.15, 0.08, 0.06, 'accent', { r: [-0.3, 0.12, 0], tint: [1.05, 1.05, 1.05] }));
  return parts;
}

/** Brass mushroom knob on a drawer front at (x, y, z). */
export function knob(x: number, y: number, z: number, dia = 0.026): Part {
  return lathe(x, y, z, [[0, 0], [dia * 0.25, 0], [dia * 0.2, dia * 0.35], [dia * 0.5, dia * 0.6], [dia * 0.45, dia * 0.9], [0, dia]], 'brass', { r: [Math.PI / 2, 0, 0] });
}

/** Case of stacked drawers with lipped fronts; returns parts and the case is centred at x=0 between y0..y1. */
export function drawerCase(w: number, d: number, y0: number, y1: number, rows: number[][], opt: { knobs?: 'knob' | 'pull' | 'none'; topT?: number; topOver?: number } = {}): Part[] {
  const parts: Part[] = [];
  const topT = opt.topT ?? 0.025;
  const over = opt.topOver ?? 0.015;
  parts.push(rbox(0, y1 - topT / 2, 0, w + over * 2, topT, d + over, 0.005, 'accent'));
  const cy0 = y0;
  const cy1 = y1 - topT;
  parts.push(box(0, (cy0 + cy1) / 2, -0.005, w, cy1 - cy0, d - 0.01, 'primary'));
  const zf = d / 2 - 0.005;
  const gap = 0.006;
  const total = rows.reduce((a, r) => a + r[0], 0);
  let y = cy1 - 0.012;
  const usable = cy1 - cy0 - 0.03;
  for (const row of rows) {
    const rh = (usable * row[0]) / total;
    const cols = row.length - 1 || 1;
    const fw = (w - 0.024 - gap * (cols - 1)) / cols;
    for (let c = 0; c < cols; c++) {
      const x = -w / 2 + 0.012 + fw / 2 + c * (fw + gap);
      const fy = y - rh / 2;
      parts.push(rbox(x, fy, zf + 0.006, fw, rh - gap, 0.02, 0.004, 'primary'));
      if (opt.knobs === 'pull') parts.push(rbox(x, fy + rh * 0.18, zf + 0.022, Math.min(0.16, fw * 0.4), 0.012, 0.016, 0.005, 'brass'));
      else if (opt.knobs !== 'none') {
        if (fw > 0.5) {
          parts.push(knob(x - fw * 0.25, fy, zf + 0.016));
          parts.push(knob(x + fw * 0.25, fy, zf + 0.016));
        } else parts.push(knob(x, fy, zf + 0.016));
      }
    }
    y -= rh;
  }
  return parts;
}

/** Mid-century nightstand: overhanging top, two drawers with brass knobs, tall tapered legs. */
export function midCenturyNightstand(w: number, d: number, h: number): Part[] {
  const legH = h * 0.55;
  const cw = w - 0.06;
  const cd = d - 0.05;
  const parts = drawerCase(cw, cd, legH, h, [[1], [1]], { topOver: 0.025, topT: 0.028 });
  parts.push(rbox(0, legH - 0.02, 0, cw + 0.01, 0.04, cd + 0.005, 0.004, 'primary'));
  for (const sx of [-1, 1])
    for (const sz2 of [-1, 1]) parts.push(rod([sx * (cw / 2 - 0.005), 0, sz2 * (cd / 2 - 0.005)], [sx * (cw / 2 - 0.03), legH - 0.03, sz2 * (cd / 2 - 0.03)], 0.038, 'primary', { taper: 1.8, seg: 10 }));
  return parts;
}

/** Six-drawer dresser: corner stiles running down into tapered legs, centre divider, two brass knobs per drawer. */
export function stileDresser(w: number, d: number, h: number): Part[] {
  const parts: Part[] = [];
  const legH = 0.16;
  const stile = 0.05;
  const topT = 0.022;
  // corner stiles that become legs
  for (const sx of [-1, 1])
    for (const sz2 of [-1, 1]) {
      const x = sx * (w / 2 - stile / 2);
      const z = sz2 * (d / 2 - stile / 2);
      parts.push(rbox(x, legH + (h - topT - legH) / 2, z, stile, h - topT - legH, stile, 0.006, 'primary'));
      parts.push(rod([x - sx * 0.004, 0, z - sz2 * 0.004], [x, legH + 0.001, z], 0.044, 'primary', { taper: 1.55, seg: 12 }));
    }
  // side panels and back
  for (const sx of [-1, 1]) parts.push(box(sx * (w / 2 - 0.012), legH + (h - topT - legH) / 2, 0, 0.018, h - topT - legH - 0.02, d - stile * 2 + 0.01, 'primary'));
  parts.push(box(0, legH + (h - topT - legH) / 2, -d / 2 + 0.008, w - stile * 2 + 0.01, h - topT - legH - 0.01, 0.012, 'primary'));
  // top with a small overhang and eased edge
  parts.push(rbox(0, h - topT / 2, 0, w + 0.01, topT, d + 0.01, 0.006, 'accent'));
  // bottom rail and centre divider
  parts.push(rbox(0, legH + 0.02, d / 2 - 0.012, w - stile * 2, 0.04, 0.025, 0.004, 'primary'));
  parts.push(rbox(0, legH + (h - topT - legH) / 2 + 0.01, d / 2 - 0.012, 0.022, h - topT - legH - 0.03, 0.025, 0.003, 'primary'));
  // 2 x 3 drawers
  const fw = (w - stile * 2 - 0.022 - 0.012) / 2;
  const y0 = legH + 0.044;
  const y1 = h - topT - 0.006;
  const rh = (y1 - y0) / 3;
  for (const sx of [-1, 1])
    for (let r = 0; r < 3; r++) {
      const x = sx * (0.011 + 0.003 + fw / 2);
      const y = y0 + rh * r + rh / 2;
      parts.push(rbox(x, y, d / 2 - 0.008, fw, rh - 0.006, 0.02, 0.003, 'primary'));
      parts.push(knob(x - fw * 0.28, y, d / 2 + 0.002, 0.032));
      parts.push(knob(x + fw * 0.28, y, d / 2 + 0.002, 0.032));
    }
  return parts;
}

/** Wardrobe: black frame and plinth, two wood doors with a vertical grain, long black bar handles at the meeting stiles. */
export function framedWardrobe(w: number, d: number, h: number): Part[] {
  const parts: Part[] = [];
  const fr = 0.035;
  const plinth = 0.08;
  // black frame: sides, top cap, plinth with recessed toe kick
  for (const sx of [-1, 1]) parts.push(rbox(sx * (w / 2 - fr / 2), h / 2, 0, fr, h, d, 0.004, 'secondary'));
  parts.push(rbox(0, h - 0.012, 0, w + 0.02, 0.024, d + 0.02, 0.004, 'accent'));
  parts.push(box(0, h - 0.04, 0, w - 2 * fr, 0.035, d, 'secondary'));
  parts.push(box(0, plinth / 2, -0.02, w - 2 * fr, plinth, d - 0.04, 'secondary'));
  parts.push(rbox(0, plinth + 0.012, 0, w - 2 * fr, 0.024, d, 0.003, 'secondary'));
  parts.push(box(0, h / 2, -d / 2 + 0.008, w - 2 * fr, h - 0.05, 0.015, 'secondary'));
  // doors
  const dy0 = plinth + 0.026;
  const dy1 = h - 0.06;
  const dw = (w - 2 * fr - 0.008) / 2;
  for (const sx of [-1, 1]) {
    const x = sx * (dw / 2 + 0.002);
    parts.push(rbox(x, (dy0 + dy1) / 2, d / 2 - 0.012, dw, dy1 - dy0, 0.022, 0.003, 'primary', { gv: true }));
    // shadow-gap groove frame on each door
    parts.push(box(x, (dy0 + dy1) / 2, d / 2 - 0.0005, dw - 0.06, 0.004, 0.002, 'rubber', { tint: [0.6, 0.6, 0.6] }));
    // bar handle with standoffs
    const hx = sx * 0.045;
    const hy = (dy0 + dy1) / 2 + 0.12;
    const hl = Math.min(0.42, (dy1 - dy0) * 0.25);
    parts.push(rbox(hx, hy, d / 2 + 0.03, 0.016, hl, 0.016, 0.006, 'metal'));
    for (const s of [-1, 1]) parts.push(cyl(hx, hy + (s * hl) / 2 - s * 0.03, d / 2 + 0.015, 0.012, 0.03, 0.012, 'metal', { r: [Math.PI / 2, 0, 0], seg: 10 }));
  }
  return parts;
}

/** Live-edge slab bench on two flat-bar U legs (closed loops). */
export function slabBench(w: number, d: number, h: number): Part[] {
  const parts: Part[] = [];
  const t = 0.07;
  parts.push(ext(0, h - t / 2, 0, liveEdge(w, d * 0.96, 19, 0.03, 20), t, 'primary', { r: [-Math.PI / 2, 0, 0], bevel: 0.01, curveSeg: 4 }));
  // bark-edge band just under the top surface along both long edges
  const legX = w / 2 - Math.min(0.26, w * 0.17);
  const bw = 0.075; // flat bar width (seen face-on)
  const bt = 0.02;
  const lz = d / 2 - 0.035;
  const y1 = h - t;
  for (const sx of [-1, 1]) {
    const x = sx * legX;
    parts.push(beam([x, 0, -lz], [x, y1, -lz], bw, bt, 'secondary', 0.002));
    parts.push(beam([x, 0, lz], [x, y1, lz], bw, bt, 'secondary', 0.002));
    parts.push(beam([x, bt / 2, -lz], [x, bt / 2, lz], bw, bt, 'secondary', 0.002));
    parts.push(beam([x, y1 - bt / 2, -lz], [x, y1 - bt / 2, lz], bw, bt, 'secondary', 0.002));
  }
  return parts;
}

export const BEDROOM: CatalogItem[] = [
  {
    id: 'bed',
    name: 'Bed (queen)',
    category: 'Bedroom',
    size: sz(5.2, 6.8, 3.6),
    slots: { primary: { label: 'Duvet', default: 'fabric-olive' }, secondary: { label: 'Frame', default: 'walnut-furniture' }, accent: { label: 'Linens', default: 'bedding-linen' } },
    parts: (w, d, h) => panelBed(w, d, h),
    solid: true,
    ref: 'Solid wood platform bed with panel headboard, styled duvet, shams, throw and book',
  },
  {
    id: 'bed-twin',
    name: 'Bed (twin)',
    category: 'Bedroom',
    size: sz(3.3, 6.5, 3.2),
    slots: { primary: { label: 'Blanket', default: 'fabric-navy' }, secondary: { label: 'Frame', default: 'oak-furniture' }, accent: { label: 'Linens', default: 'bedding-linen' } },
    parts: (w, d, h) => spindleBed(w, d, h),
    solid: true,
    ref: 'Crate & Barrel oak spindle bed: bentwood arched hoop, spindles, splayed legs',
  },
  {
    id: 'bed-king',
    name: 'Bed (king)',
    category: 'Bedroom',
    size: sz(6.4, 7, 5),
    slots: { primary: { label: 'Headboard', default: 'fabric-rust' }, secondary: { label: 'Platform', default: 'walnut-furniture' }, accent: { label: 'Linens', default: 'bedding-linen' } },
    parts: (w, d, h) => channelPanelBed(w, d, h),
    solid: true,
    ref: 'Article Noel Hale rust velvet 60 in channel panels over a low walnut platform',
  },
  {
    id: 'nightstand',
    name: 'Nightstand',
    category: 'Bedroom',
    size: sz(1.8, 1.4, 2.2),
    slots: { primary: { label: 'Body', default: 'walnut-furniture' }, accent: { label: 'Top', default: 'walnut-furniture' } },
    parts: (w, d, h) => midCenturyNightstand(w, d, h),
    solid: true,
    ref: 'Mid-century two-drawer nightstand, brass knobs, tall tapered legs',
  },
  {
    id: 'dresser',
    name: 'Dresser',
    category: 'Bedroom',
    size: sz(5, 1.6, 3),
    slots: { primary: { label: 'Body', default: 'walnut-furniture' }, accent: { label: 'Top', default: 'walnut-furniture' } },
    parts: (w, d, h) => stileDresser(w, d, h),
    solid: true,
    ref: 'Plank+Beam six-drawer dresser, stile-and-leg corners, brass knobs',
  },
  {
    id: 'wardrobe',
    name: 'Wardrobe / coat closet',
    category: 'Bedroom',
    size: sz(4, 2, 7),
    slots: { primary: { label: 'Doors', default: 'walnut-furniture' }, secondary: { label: 'Frame', default: 'black-wood' }, accent: { label: 'Top', default: 'walnut-furniture' } },
    parts: (w, d, h) => framedWardrobe(w, d, h),
    solid: true,
    ref: 'Two-door wardrobe, wood doors in a black frame, long black bar handles',
  },
  {
    id: 'bench',
    name: 'Slab bench',
    category: 'Bedroom',
    size: sz(4.5, 1.3, 1.5),
    slots: { primary: { label: 'Seat', default: 'timber-dark' }, secondary: { label: 'Legs', default: 'black-metal' } },
    parts: (w, d, h) => slabBench(w, d, h),
    solid: true,
    ref: 'Tribesigns live-edge slab bench on black flat-bar U legs',
  },
];
