import * as THREE from 'three';
import { unpackGeometry, type GeoPacket } from './geoPack';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { wallVec } from '../model/arch';
import { FIXED_SLOT_MATERIAL } from '../model/catalog';
import { type Part, type Slot, box, cyl, ext, lathe, rbox, rod, rotateY, sph, torus } from '../model/catalog/kit';
import type { Door, Level, Opening, Wall, Window } from '../model/types';
import type { Built } from './builders';
import { buildPart } from './partGeometry';

/*
 * Doors and windows built from the part kit in opening-local space:
 *   x along the wall (centred on the opening), y up from the level floor, z across the wall (0 = wall centreline).
 * The whole set is then placed in the world with one matrix.
 */

const CAS = 0.085; // casing width
const CAST = 0.02; // casing thickness
const JAMB = 0.02;

function casing(W: number, H: number, T: number, slot: Slot, sides: (1 | -1)[] = [1, -1], sill = false): Part[] {
  const parts: Part[] = [];
  for (const s of sides) {
    const z = s * (T / 2 + CAST / 2);
    for (const sx of [-1, 1]) parts.push(rbox(sx * (W / 2 + CAS / 2), (H + (sill ? 0 : 0)) / 2 + (sill ? 0 : 0), z, CAS, H + (sill ? 0 : 0.0), CAST, 0.003, slot, { gv: true }));
    // head casing with a cap and a small fillet
    parts.push(rbox(0, H + 0.055, z, W + 2 * CAS + 0.02, 0.11, CAST, 0.003, slot));
    parts.push(rbox(0, H + 0.12, z + s * 0.008, W + 2 * CAS + 0.05, 0.022, CAST + 0.016, 0.004, slot));
    parts.push(rbox(0, H + 0.104, z + s * 0.004, W + 2 * CAS + 0.03, 0.012, CAST + 0.008, 0.003, slot));
  }
  return parts;
}

function jambs(W: number, H: number, T: number, slot: Slot): Part[] {
  return [
    box(-W / 2 + JAMB / 2, H / 2, 0, JAMB, H, T, slot, { gv: true }),
    box(W / 2 - JAMB / 2, H / 2, 0, JAMB, H, T, slot, { gv: true }),
    box(0, H - JAMB / 2, 0, W, JAMB, T, slot),
  ];
}

/** Lever handle with round rosette, both faces, centred at (x, y) on a leaf whose faces are at z = ±t/2. dir = which way the lever points. */
function lever(x: number, y: number, t: number, dir: 1 | -1, slot: Slot = 'metal'): Part[] {
  const parts: Part[] = [];
  for (const s of [1, -1]) {
    const z = s * t / 2;
    parts.push(cyl(x, y, z + s * 0.006, 0.058, 0.012, 0.058, slot, { r: [Math.PI / 2, 0, 0], seg: 20 }));
    parts.push(cyl(x, y, z + s * 0.03, 0.02, 0.05, 0.02, slot, { r: [Math.PI / 2, 0, 0], seg: 12 }));
    parts.push(rod([x, y, z + s * 0.052], [x + dir * 0.12, y - 0.004, z + s * 0.058], 0.016, slot, { seg: 10 }));
  }
  return parts;
}

/** Exterior handleset: tall escutcheon plate with thumb-latch grip, interior lever, deadbolt above. */
function handleset(x: number, y: number, t: number, outside: 1 | -1, dir: 1 | -1, slot: Slot = 'metal'): Part[] {
  const parts: Part[] = [];
  const zo = outside * (t / 2);
  parts.push(rbox(x, y + 0.06, zo + outside * 0.006, 0.055, 0.36, 0.012, 0.012, slot));
  parts.push(rbox(x, y + 0.02, zo + outside * 0.055, 0.022, 0.2, 0.022, 0.008, slot));
  for (const e of [-1, 1]) parts.push(rod([x, y + 0.02 + e * 0.085, zo + outside * 0.012], [x, y + 0.02 + e * 0.085, zo + outside * 0.05], 0.018, slot, { seg: 8 }));
  parts.push(rbox(x, y + 0.13, zo + outside * 0.03, 0.02, 0.03, 0.02, 0.005, slot));
  parts.push(cyl(x, y + 0.2, zo + outside * 0.016, 0.03, 0.02, 0.03, slot, { r: [Math.PI / 2, 0, 0], seg: 16 }));
  // inside: lever and thumb turn
  const zi = -outside * (t / 2);
  parts.push(cyl(x, y, zi - outside * 0.006, 0.058, 0.012, 0.058, slot, { r: [Math.PI / 2, 0, 0], seg: 20 }));
  parts.push(rod([x, y, zi - outside * 0.05], [x + dir * 0.12, y - 0.004, zi - outside * 0.056], 0.016, slot, { seg: 10 }));
  parts.push(cyl(x, y + 0.2, zi - outside * 0.008, 0.05, 0.016, 0.05, slot, { r: [Math.PI / 2, 0, 0], seg: 16 }));
  parts.push(rbox(x, y + 0.2, zi - outside * 0.022, 0.012, 0.04, 0.014, 0.004, slot));
  return parts;
}

function hinges(x: number, H: number, t: number, slot: Slot = 'metal'): Part[] {
  const ys = [0.24, H / 2 + 0.05, H - 0.24];
  const parts: Part[] = [];
  for (const y of ys) {
    parts.push(cyl(x, y, -t / 2 - 0.004, 0.014, 0.1, 0.014, slot, { seg: 10 }));
    parts.push(box(x, y, -t / 2 + 0.002, 0.03, 0.09, 0.004, slot));
  }
  return parts;
}

/** Panel leaf: stiles and rails with recessed panels (and optional glass lites). Leaf spans x0..x1, y 0..H, thickness t at z=0. */
function panelLeaf(
  x0: number,
  x1: number,
  H: number,
  t: number,
  slot: Slot,
  layout: 'shaker2' | 'craftsman' | 'fulllite',
  muntins: [number, number] = [1, 1],
): Part[] {
  const parts: Part[] = [];
  const W = x1 - x0;
  const cx = (x0 + x1) / 2;
  const st = layout === 'fulllite' ? 0.11 : 0.12;
  const top = layout === 'fulllite' ? 0.11 : 0.12;
  const bot = layout === 'fulllite' ? 0.24 : 0.22;
  // stiles and rails
  parts.push(rbox(x0 + st / 2, H / 2, 0, st, H, t, 0.003, slot, { gv: true }));
  parts.push(rbox(x1 - st / 2, H / 2, 0, st, H, t, 0.003, slot, { gv: true }));
  parts.push(rbox(cx, H - top / 2, 0, W - 2 * st + 0.002, top, t, 0.003, slot));
  parts.push(rbox(cx, bot / 2, 0, W - 2 * st + 0.002, bot, t, 0.003, slot));
  const iw = W - 2 * st;
  const panel = (y0: number, y1: number, xa = x0 + st, xb = x1 - st) => {
    const pw = xb - xa;
    parts.push(box((xa + xb) / 2, (y0 + y1) / 2, 0, pw + 0.004, y1 - y0 + 0.004, t * 0.45, slot, { tint: [0.82, 0.82, 0.82], gv: true }));
    // raised field with a bevel each side
    for (const s of [1, -1]) parts.push(rbox((xa + xb) / 2, (y0 + y1) / 2, s * t * 0.18, pw - 0.05, y1 - y0 - 0.05, t * 0.12, 0.012, slot, { gv: true }));
  };
  const lite = (y0: number, y1: number, cols: number, rows: number, xa = x0 + st, xb = x1 - st) => {
    parts.push(box((xa + xb) / 2, (y0 + y1) / 2, 0, xb - xa + 0.004, y1 - y0 + 0.004, 0.008, 'glass'));
    // glazing beads
    for (const s of [1, -1]) {
      parts.push(box((xa + xb) / 2, y1 - 0.008, s * 0.012, xb - xa, 0.016, 0.014, slot));
      parts.push(box((xa + xb) / 2, y0 + 0.008, s * 0.012, xb - xa, 0.016, 0.014, slot));
      parts.push(box(xa + 0.008, (y0 + y1) / 2, s * 0.012, 0.016, y1 - y0, 0.014, slot, { gv: true }));
      parts.push(box(xb - 0.008, (y0 + y1) / 2, s * 0.012, 0.016, y1 - y0, 0.014, slot, { gv: true }));
    }
    for (let i = 1; i < cols; i++) parts.push(box(xa + ((xb - xa) * i) / cols, (y0 + y1) / 2, 0, 0.03, y1 - y0, t * 0.7, slot, { gv: true }));
    for (let j = 1; j < rows; j++) parts.push(box((xa + xb) / 2, y0 + ((y1 - y0) * j) / rows, 0, xb - xa, 0.03, t * 0.7, slot));
  };
  if (layout === 'shaker2') {
    const mid = H * 0.38;
    parts.push(rbox(cx, mid, 0, iw + 0.002, 0.12, t, 0.003, slot));
    panel(bot, mid - 0.06);
    panel(mid + 0.06, H - top);
  } else if (layout === 'craftsman') {
    // top lite with two vertical lites, dentil shelf, two tall panels below
    const shelfY = H * 0.68;
    lite(shelfY + 0.03, H - top, 2, 1);
    parts.push(rbox(cx, shelfY, 0, iw + 0.002, 0.06, t, 0.003, slot));
    for (const s of [1, -1]) {
      parts.push(rbox(cx, shelfY - 0.03, s * (t / 2 + 0.02), iw + 0.04, 0.025, 0.04, 0.003, slot));
      for (let k = 0; k < 8; k++) parts.push(box(x0 + st + ((k + 0.5) * iw) / 8, shelfY - 0.055, s * (t / 2 + 0.012), iw / 16, 0.025, 0.024, slot));
    }
    const mstile = 0.1;
    parts.push(rbox(cx, (bot + shelfY - 0.03) / 2, 0, mstile, shelfY - 0.03 - bot, t, 0.003, slot, { gv: true }));
    panel(bot, shelfY - 0.03, x0 + st, cx - mstile / 2);
    panel(bot, shelfY - 0.03, cx + mstile / 2, x1 - st);
  } else {
    lite(bot, H - top, muntins[0], muntins[1]);
  }
  return parts;
}

/* ------------------------------------------------------------------ door types */

function doorParts(op: Door, T: number, q: number): Part[] {
  const W = op.width;
  const H = op.height;
  const parts: Part[] = [];
  const ext = op.leafMaterialId === 'door-entry' || op.style === 'double' || op.style === 'sliding' || op.style === 'garage';
  // casing: exterior doors get the frame material outside, trim inside
  parts.push(...casing(W, H, T, 'primary'));
  parts.push(...jambs(W, H, T, 'primary'));
  if (ext) parts.push(rbox(0, 0.012, 0, W + 0.04, 0.024, T + 0.05, 0.004, 'brass', { tint: [0.6, 0.55, 0.5] }));
  if (op.style === 'cased') return parts;
  const t = 0.045;
  const lx0 = -W / 2 + JAMB + 0.003;
  const lx1 = W / 2 - JAMB - 0.003;
  const LH = H - JAMB - 0.006 - (ext ? 0.024 : 0.01);
  const ly = ext ? 0.024 : 0.01;
  const lift = (ps: Part[]) => ps.map((p) => (p.s === 'tube' ? { ...p, path: p.path.map(([a, b, c]) => [a, b + ly, c] as [number, number, number]) } : { ...p, p: [p.p[0], p.p[1] + ly, p.p[2]] as [number, number, number] }));
  if (op.style === 'garage') {
    // carriage-house: two visual halves, crossbucks, a top row of lites, section joints
    const leaf: Part[] = [];
    const half = (lx1 - lx0) / 2;
    leaf.push(box(0, LH / 2, 0, lx1 - lx0, LH, 0.04, 'secondary', { gv: true, tint: [0.72, 0.72, 0.72] }));
    const winY = LH * 0.78;
    for (const sx of [-1, 1]) {
      const hx0 = sx < 0 ? lx0 : 0;
      const hx1 = sx < 0 ? 0 : lx1;
      const fz = -0.032;
      const fr = 0.09;
      // frame boards on the outside face
      leaf.push(box((hx0 + hx1) / 2, LH - fr / 2, fz, hx1 - hx0, fr, 0.026, 'secondary'));
      leaf.push(box((hx0 + hx1) / 2, fr / 2, fz, hx1 - hx0, fr, 0.026, 'secondary'));
      leaf.push(box((hx0 + hx1) / 2, winY - 0.03, fz, hx1 - hx0, 0.06, 0.026, 'secondary'));
      leaf.push(box(hx0 + fr / 2, LH / 2, fz, fr, LH, 0.026, 'secondary', { gv: true }));
      leaf.push(box(hx1 - fr / 2, LH / 2, fz, fr, LH, 0.026, 'secondary', { gv: true }));
      // crossbuck
      const bx0 = hx0 + fr;
      const bx1 = hx1 - fr;
      const by0 = fr;
      const by1 = winY - 0.06;
      const ang = Math.atan2(by1 - by0, bx1 - bx0);
      const len = Math.hypot(bx1 - bx0, by1 - by0);
      leaf.push(box((bx0 + bx1) / 2, (by0 + by1) / 2, fz, len, 0.09, 0.026, 'secondary', { r: [0, 0, ang] }));
      leaf.push(box((bx0 + bx1) / 2, (by0 + by1) / 2, fz - 0.003, len, 0.09, 0.026, 'secondary', { r: [0, 0, -ang] }));
      // three lites with muntin dividers
      const lw = (bx1 - bx0) / 3;
      for (let k = 0; k < 3; k++) {
        const xa = bx0 + k * lw;
        leaf.push(box(xa + lw / 2, (winY + LH - fr) / 2, -0.02, lw - 0.03, LH - fr - winY - 0.02, 0.006, 'glass'));
        leaf.push(box(xa + lw / 2, (winY + LH - fr) / 2, -0.004, lw - 0.03, LH - fr - winY - 0.02, 0.03, 'rubber', { tint: [0.35, 0.35, 0.35] }));
        if (k > 0) leaf.push(box(xa, (winY + LH - fr) / 2, fz - 0.002, 0.04, LH - fr - winY, 0.016, 'secondary', { gv: true }));
      }
      // pull handles
      leaf.push(rbox(sx * half * 0.6, LH * 0.33, fz - 0.03, 0.18, 0.02, 0.02, 0.006, 'metal'));
      for (const e of [-1, 1]) leaf.push(rod([sx * half * 0.6 + e * 0.08, LH * 0.33, fz - 0.005], [sx * half * 0.6 + e * 0.08, LH * 0.33, fz - 0.03], 0.012, 'metal'));
    }
    leaf.push(box(0, LH / 2, -0.026, 0.07, LH, 0.016, 'secondary', { gv: true }));
    // section joints
    for (let k = 1; k < 4; k++) leaf.push(box(0, (LH * k) / 4, -0.0205, lx1 - lx0, 0.006, 0.002, 'rubber', { tint: [0.6, 0.6, 0.6] }));
    parts.push(...lift(leaf));
    return parts;
  }
  if (op.style === 'sliding') {
    const mid = 0;
    const pane = (xa: number, xb: number, z: number, handle: boolean) => {
      const out: Part[] = [];
      const fr = 0.07;
      out.push(box((xa + xb) / 2, LH - fr / 2, z, xb - xa, fr, 0.05, 'secondary'));
      out.push(box((xa + xb) / 2, fr * 1.2 / 2, z, xb - xa, fr * 1.2, 0.05, 'secondary'));
      out.push(box(xa + fr / 2, LH / 2, z, fr, LH, 0.05, 'secondary', { gv: true }));
      out.push(box(xb - fr / 2, LH / 2, z, fr, LH, 0.05, 'secondary', { gv: true }));
      out.push(box((xa + xb) / 2, LH / 2, z, xb - xa - 2 * fr + 0.004, LH - fr * 2.2, 0.008, 'glass'));
      if (handle) for (const s of [1, -1]) out.push(rbox(xa + 0.04, LH * 0.48, z + s * 0.032, 0.022, 0.26, 0.014, 0.006, 'metal'));
      return out;
    };
    parts.push(...lift([...pane(lx0, mid + 0.03, -0.028, false), ...pane(mid - 0.03, lx1, 0.028, true)]));
    parts.push(box(0, LH + ly + 0.004, 0, lx1 - lx0, 0.012, 0.11, 'secondary'));
    return parts;
  }
  if (op.style === 'double') {
    const mid = 0;
    const L = panelLeaf(lx0, mid - 0.003, LH, t, 'secondary', 'fulllite');
    const R = panelLeaf(mid + 0.003, lx1, LH, t, 'secondary', 'fulllite');
    const hw: Part[] = [];
    hw.push(box(mid, LH / 2, t / 2 + 0.006, 0.04, LH - 0.02, 0.012, 'secondary', { gv: true }));
    hw.push(...handleset(-0.07, 0.95, t, -1, -1, 'brass'));
    hw.push(...handleset(0.07, 0.95, t, -1, 1, 'brass'));
    hw.push(...hinges(lx0 + 0.008, LH, t), ...hinges(lx1 - 0.008, LH, t));
    let leaves = [...L, ...R, ...hw];
    if (op.open) {
      const l2 = rotateY([...L, ...hinges(lx0 + 0.008, LH, t)], Math.PI / 2, [lx0, -t / 2]);
      const r2 = rotateY([...R, ...hinges(lx1 - 0.008, LH, t)], -Math.PI / 2, [lx1, -t / 2]);
      leaves = [...l2, ...r2];
    }
    parts.push(...lift(leaves));
    return parts;
  }
  // single hinged
  const layout = op.leafMaterialId === 'door-entry' ? 'craftsman' : 'shaker2';
  const hingeStart = op.hinge === 'start';
  const hx = hingeStart ? lx0 : lx1;
  const latchX = hingeStart ? lx1 - 0.065 : lx0 + 0.065;
  const dir: 1 | -1 = hingeStart ? -1 : 1;
  let leaf = [...panelLeaf(lx0, lx1, LH, t, 'secondary', layout), ...hinges(hx + (hingeStart ? 0.008 : -0.008), LH, t)];
  leaf.push(...(layout === 'craftsman' ? handleset(latchX, 0.95, t, -1, dir) : lever(latchX, 0.95, t, dir)));
  if (op.open) leaf = rotateY(leaf, hingeStart ? Math.PI / 2 : -Math.PI / 2, [hx, -t / 2]);
  // door stop on the jamb
  parts.push(box(0, H - JAMB - 0.01, t / 2 + 0.006, W - 2 * JAMB, 0.02, 0.012, 'primary'));
  parts.push(...lift(leaf));
  void q;
  return parts;
}

/* ------------------------------------------------------------------ windows */

function windowParts(op: Window, T: number): Part[] {
  const W = op.width;
  const H = op.height;
  const parts: Part[] = [];
  // the opening sits at op.sill; build from y=0 and lift later
  // exterior trim (outside face -z) with drip cap, interior casing, stool and apron
  const zo = -(T / 2 + CAST / 2);
  const zi = T / 2 + CAST / 2;
  for (const sx of [-1, 1]) parts.push(rbox(sx * (W / 2 + CAS / 2), H / 2, zo, CAS, H + 0.02, CAST, 0.003, 'primary', { gv: true }));
  parts.push(rbox(0, H + 0.055, zo, W + 2 * CAS, 0.11, CAST, 0.003, 'primary'));
  parts.push(rbox(0, H + 0.118, zo - 0.012, W + 2 * CAS + 0.04, 0.016, CAST + 0.03, 0.004, 'primary'));
  parts.push(rbox(0, -0.03, zo - 0.015, W + 2 * CAS + 0.03, 0.04, CAST + 0.04, 0.004, 'primary'));
  for (const sx of [-1, 1]) parts.push(rbox(sx * (W / 2 + CAS / 2), H / 2, zi, CAS, H, CAST, 0.003, 'accent', { gv: true }));
  parts.push(rbox(0, H + 0.055, zi, W + 2 * CAS, 0.11, CAST, 0.003, 'accent'));
  parts.push(rbox(0, H + 0.12, zi + 0.006, W + 2 * CAS + 0.03, 0.02, CAST + 0.012, 0.004, 'accent'));
  parts.push(rbox(0, -0.012, T / 2 - 0.02, W + 2 * CAS + 0.04, 0.025, 0.1, 0.006, 'accent'));
  parts.push(rbox(0, -0.07, zi, W + 2 * CAS - 0.02, 0.09, CAST, 0.003, 'accent'));
  // jamb extensions (deep returns), lined with the interior trim
  parts.push(box(-W / 2 + 0.01, H / 2, 0, 0.02, H, T, 'accent', { gv: true }));
  parts.push(box(W / 2 - 0.01, H / 2, 0, 0.02, H, T, 'accent', { gv: true }));
  parts.push(box(0, H - 0.01, 0, W, 0.02, T, 'accent'));
  parts.push(box(0, 0.01, 0, W, 0.02, T, 'accent'));
  // window unit: frame set toward the outside, sash(es), glass, simulated divided lites both faces
  const fz = -T * 0.2;
  const fd = 0.11;
  const fr = 0.045;
  const fx0 = -W / 2 + 0.02;
  const fx1 = W / 2 - 0.02;
  const fy0 = 0.02;
  const fy1 = H - 0.02;
  parts.push(box(0, fy1 - fr / 2, fz, fx1 - fx0, fr, fd, 'primary'));
  parts.push(box(0, fy0 + fr / 2, fz, fx1 - fx0, fr, fd, 'primary'));
  parts.push(box(fx0 + fr / 2, H / 2, fz, fr, fy1 - fy0, fd, 'primary', { gv: true }));
  parts.push(box(fx1 - fr / 2, H / 2, fz, fr, fy1 - fy0, fd, 'primary', { gv: true }));
  const sash = (xa: number, xb: number, ya: number, yb: number, cols: number, rows: number, crank: boolean) => {
    const sr = 0.045;
    parts.push(rbox((xa + xb) / 2, yb - sr / 2, fz, xb - xa, sr, 0.06, 0.004, 'primary'));
    parts.push(rbox((xa + xb) / 2, ya + sr / 2, fz, xb - xa, sr, 0.06, 0.004, 'primary'));
    parts.push(rbox(xa + sr / 2, (ya + yb) / 2, fz, sr, yb - ya, 0.06, 0.004, 'primary', { gv: true }));
    parts.push(rbox(xb - sr / 2, (ya + yb) / 2, fz, sr, yb - ya, 0.06, 0.004, 'primary', { gv: true }));
    const gx0 = xa + sr;
    const gx1 = xb - sr;
    const gy0 = ya + sr;
    const gy1 = yb - sr;
    parts.push(box((gx0 + gx1) / 2, (gy0 + gy1) / 2, fz, gx1 - gx0 + 0.004, gy1 - gy0 + 0.004, 0.008, 'glass'));
    for (const s of [1, -1]) {
      for (let i = 1; i < cols; i++) parts.push(box(gx0 + ((gx1 - gx0) * i) / cols, (gy0 + gy1) / 2, fz + s * 0.012, 0.022, gy1 - gy0, 0.012, 'primary', { gv: true }));
      for (let j = 1; j < rows; j++) parts.push(box((gx0 + gx1) / 2, gy0 + ((gy1 - gy0) * j) / rows, fz + s * 0.012, gx1 - gx0, 0.022, 0.012, 'primary'));
    }
    if (crank) {
      // folding crank handle and lock lever on the interior stool side
      parts.push(rbox((xa + xb) / 2 - 0.08, ya + 0.02, fz + 0.06, 0.07, 0.03, 0.03, 0.008, 'metal'));
      parts.push(rod([(xa + xb) / 2 - 0.08, ya + 0.03, fz + 0.075], [(xa + xb) / 2 - 0.02, ya + 0.05, fz + 0.09], 0.01, 'metal'));
      parts.push(rbox(xb - 0.07, (ya + yb) / 2, fz + 0.04, 0.015, 0.06, 0.015, 0.005, 'metal'));
    }
  };
  const cols = Math.max(1, op.muntinCols);
  const rows = Math.max(1, op.muntinRows);
  if (op.style === 'transom' && H > 1.0) {
    const ty = H - 0.45;
    parts.push(box(0, ty, fz, fx1 - fx0, 0.06, fd, 'primary'));
    sash(fx0 + fr, fx1 - fr, fy0 + fr, ty - 0.03, cols, Math.max(1, rows - 1), true);
    sash(fx0 + fr, fx1 - fr, ty + 0.03, fy1 - fr, cols, 1, false);
  } else if (W > 1.3 && op.style !== 'fixed') {
    // paired casements
    const mx = 0;
    parts.push(box(mx, H / 2, fz, 0.05, fy1 - fy0, fd, 'primary', { gv: true }));
    sash(fx0 + fr, mx - 0.025, fy0 + fr, fy1 - fr, Math.max(1, Math.round(cols / 2)), rows, true);
    sash(mx + 0.025, fx1 - fr, fy0 + fr, fy1 - fr, Math.max(1, Math.round(cols / 2)), rows, true);
  } else sash(fx0 + fr, fx1 - fr, fy0 + fr, fy1 - fr, cols, rows, op.style === 'casement');
  return parts;
}

/* ------------------------------------------------------------------ assembly */

const SLOT_ORDER: Slot[] = ['primary', 'secondary', 'accent', 'glass', 'metal', 'brass', 'rubber', 'chrome'];

/** outside: which world side of the wall is exterior, as +1 if it is along (-tz, 0, tx), else -1. Parts are authored with the outside at local -z. */
/* Most openings in a house repeat (same style and size), so the local-space build is cached and only placed per opening. */
const localCache = new Map<string, { geometry: THREE.BufferGeometry; slots: Slot[] } | null>();
const SKIP = new Set(['id', 'name', 'wallId', 'offset', 'sill', 'frameMaterialId', 'leafMaterialId', 'locked', 'hidden']);
function localKey(op: Opening, T: number, q: number): string {
  const o: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(op)) if (!SKIP.has(k)) o[k] = v;
  return JSON.stringify(o) + '|' + T.toFixed(4) + '|' + q;
}

function rememberLocal(key: string, v: { geometry: THREE.BufferGeometry; slots: Slot[] } | null) {
  localCache.set(key, v);
  if (localCache.size > 300) localCache.delete(localCache.keys().next().value as string);
}

/** Place a cached local build on its wall. */
function placeLocal(local: { geometry: THREE.BufferGeometry; slots: Slot[] }, op: Opening, wall: Wall, level: Level, outside: 1 | -1) {
  const { tx, tz } = wallVec(wall);
  return placeOpening(op, wall, level, outside, local.geometry.clone(), local.slots, tx, tz);
}

export function buildOpeningDetailed(op: Opening, wall: Wall, level: Level, q: number, outside: 1 | -1 = -1): (Built & { vc: true }) | null {
  if (wallVec(wall).len < 1e-4) return null;
  const key = localKey(op, wall.thickness, q);
  let local = localCache.get(key);
  if (local === undefined) {
    local = buildOpeningLocal(op, wall.thickness, q);
    rememberLocal(key, local);
  }
  return local ? placeLocal(local, op, wall, level, outside) : null;
}

/** Already-built detailed opening, or null (no work done). */
export function peekOpeningDetailed(op: Opening, wall: Wall, level: Level, q: number, outside: 1 | -1): (Built & { vc: true }) | null | undefined {
  if (wallVec(wall).len < 1e-4) return null;
  const local = localCache.get(localKey(op, wall.thickness, q));
  if (local === undefined) return undefined;
  return local ? placeLocal(local, op, wall, level, outside) : null;
}

type LocalFetcher = (op: Opening, T: number, q: number) => Promise<{ packet: GeoPacket; slots: Slot[] } | null>;
let localFetcher: LocalFetcher | null = null;
const localInflight = new Map<string, Promise<void>>();
export const openingsPending = () => localInflight.size;
export function setOpeningFetcher(f: LocalFetcher | null) {
  localFetcher = f;
}

/** Build the detailed opening in the worker pool, then place it here. */
export async function requestOpeningDetailed(op: Opening, wall: Wall, level: Level, q: number, outside: 1 | -1): Promise<(Built & { vc: true }) | null> {
  const key = localKey(op, wall.thickness, q);
  if (!localCache.has(key)) {
    let job = localInflight.get(key);
    if (!job) {
      job = (localFetcher ? localFetcher(op, wall.thickness, q).then((r) => (r ? { geometry: unpackGeometry(r.packet), slots: r.slots } : null)) : Promise.resolve(buildOpeningLocal(op, wall.thickness, q)))
        .catch(() => buildOpeningLocal(op, wall.thickness, q))
        .then((v) => {
          rememberLocal(key, v);
          localInflight.delete(key);
        });
      localInflight.set(key, job);
    }
    await job;
  }
  return peekOpeningDetailed(op, wall, level, q, outside) ?? null;
}

export function buildOpeningLocal(op: Opening, T: number, q: number): { geometry: THREE.BufferGeometry; slots: Slot[] } | null {
  const parts = op.kind === 'door' ? doorParts(op, T, q) : windowParts(op, T);
  const bySlot = new Map<Slot, THREE.BufferGeometry[]>();
  for (const p of parts) {
    const arr = bySlot.get(p.slot) ?? [];
    arr.push(buildPart(p, q));
    bySlot.set(p.slot, arr);
  }
  const geos: THREE.BufferGeometry[] = [];
  const slots: Slot[] = [];
  for (const s of SLOT_ORDER) {
    const arr = bySlot.get(s);
    if (!arr?.length) continue;
    const g = arr.length === 1 ? arr[0] : mergeGeometries(arr, false);
    if (!g) continue;
    geos.push(g);
    slots.push(s);
  }
  if (!geos.length) return null;
  const geometry = mergeGeometries(geos, true);
  if (!geometry) return null;
  return { geometry, slots };
}

function placeOpening(op: Opening, wall: Wall, level: Level, outside: 1 | -1, geometry: THREE.BufferGeometry, slots: Slot[], tx: number, tz: number): (Built & { vc: true }) | null {
  // local x -> wall tangent, y up, z = x × y (right-handed)
  const a = op.offset + op.width / 2;
  const zs = outside === 1 ? -1 : 1;
  const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(tx, 0, tz), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-tz * zs, 0, tx * zs));
  m.setPosition(wall.start.x + tx * a, level.elevation + op.sill, wall.start.z + tz * a);
  geometry.applyMatrix4(m);
  geometry.computeBoundingSphere();
  const frame = op.frameMaterialId;
  const leaf = op.kind === 'door' ? op.leafMaterialId : op.frameMaterialId;
  const ids: Record<string, string> = {
    primary: frame,
    secondary: leaf,
    accent: 'timber-dark',
    glass: 'glass',
    metal: 'black-metal',
    brass: 'brass',
    rubber: FIXED_SLOT_MATERIAL.rubber,
    chrome: FIXED_SLOT_MATERIAL.chrome,
  };
  return { geometry, materialIds: slots.map((s) => ids[s]), vc: true };
}

void ext;
void lathe;
void sph;
void torus;
