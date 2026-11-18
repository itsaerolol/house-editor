import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { wallBase, wallTop, wallVec } from '../model/arch';
import { type Part, type Slot, box, lathe, rbox, rod } from '../model/catalog/kit';
import { stairBoxes } from '../model/stairs';
import type { Id, Level, Stair, Wall } from '../model/types';
import type { Built } from './builders';
import { buildPart } from './partGeometry';

function assemble(parts: Part[], q: number, slotIds: Partial<Record<Slot, Id>>, m?: THREE.Matrix4): Built | null {
  const bySlot = new Map<Slot, THREE.BufferGeometry[]>();
  for (const p of parts) {
    const arr = bySlot.get(p.slot) ?? [];
    arr.push(buildPart(p, q));
    bySlot.set(p.slot, arr);
  }
  const geos: THREE.BufferGeometry[] = [];
  const ids: Id[] = [];
  for (const [slot, arr] of bySlot) {
    const g = arr.length === 1 ? arr[0] : mergeGeometries(arr, false);
    if (!g) continue;
    geos.push(g);
    ids.push(slotIds[slot] ?? 'black-metal');
  }
  if (!geos.length) return null;
  const geometry = mergeGeometries(geos, true);
  if (!geometry) return null;
  if (m) geometry.applyMatrix4(m);
  geometry.computeBoundingSphere();
  return { geometry, materialIds: ids, vc: true };
}

/** Square newel post with a stepped cap and a base block. */
function newel(x: number, y: number, z: number, h: number, slot: Slot): Part[] {
  const s = 0.09;
  return [
    rbox(x, y + 0.06, z, s + 0.02, 0.12, s + 0.02, 0.006, slot),
    rbox(x, y + h / 2, z, s, h, s, 0.008, slot, { gv: true }),
    rbox(x, y + h - 0.05, z, s + 0.014, 0.015, s + 0.014, 0.004, slot),
    rbox(x, y + h + 0.012, z, s + 0.03, 0.03, s + 0.03, 0.006, slot),
    lathe(x, y + h + 0.027, z, [[0, 0], [0.03, 0], [0.024, 0.02], [0, 0.026]], slot, { seg: 12 }),
  ];
}

/**
 * Detailed U stair in stair-local space (x along the run, z across the lanes, y absolute):
 * oak treads with bullnose overhang, painted risers, skirt boards, landing, stringer fascia on the open side,
 * square newels, a sloped wood handrail and two square black balusters per tread on the inner (open) edges.
 */
export function buildStairDetailed(st: Stair, levels: Record<Id, Level>, q: number): Built | null {
  const parts: Part[] = [];
  const boxes = stairBoxes(st, levels);
  if (!boxes.length) return null;
  const W = st.laneWidth;
  const C = W * 2 + st.gap;
  const nose = 0.025;
  const tt = 0.032;
  const railH = 0.9;
  for (const b of boxes) {
    const a0 = b.a0;
    const a1 = b.a1;
    const c0 = b.c0;
    const c1 = b.c1;
    if (b.kind === 'landing') {
      parts.push(box((a0 + a1) / 2, b.top - tt / 2, (c0 + c1) / 2, a1 - a0, tt, c1 - c0, 'primary'));
      parts.push(box((a0 + a1) / 2, b.top - tt - 0.12, (c0 + c1) / 2, a1 - a0 - 0.02, 0.24, c1 - c0 - 0.02, 'secondary'));
      continue;
    }
    // lane A climbs toward +x (riser at a0), lane B climbs toward -x (riser at a1)
    const laneA = c0 < W / 2;
    const riserA = laneA ? a0 : a1;
    const rise = (levels[st.levelIds[b.pair + 1]].elevation - levels[st.levelIds[b.pair]].elevation) / (2 * st.risersPerFlight);
    const treadX = laneA ? (a0 - nose + a1) / 2 : (a0 + a1 + nose) / 2;
    parts.push(rbox(treadX, b.top - tt / 2, (c0 + c1) / 2, a1 - a0 + nose, tt, c1 - c0, 0.008, 'primary'));
    parts.push(box(riserA, b.top - tt - (rise - tt) / 2, (c0 + c1) / 2, 0.018, rise - tt, c1 - c0 - 0.004, 'secondary'));
    // carriage below (keeps the underside closed)
    parts.push(box((a0 + a1) / 2, b.top - tt - 0.14, (c0 + c1) / 2, a1 - a0, 0.2, c1 - c0 - 0.02, 'secondary', { tint: [0.85, 0.85, 0.85] }));
  }
  // flights: skirts, stringer fascia on the open edge, rails and balusters
  for (let k = 0; k + 1 < st.levelIds.length; k++) {
    const lo = levels[st.levelIds[k]];
    const hi = levels[st.levelIds[k + 1]];
    if (!lo || !hi) continue;
    const n = st.risersPerFlight;
    const rise = (hi.elevation - lo.elevation) / (2 * n);
    const t = st.treadDepth;
    const run = (n - 1) * t;
    const flights: { cOpen: number; cWall: number; yAt: (a: number) => number; a0: number; a1: number; out: number }[] = [
      { cOpen: W, cWall: 0, yAt: (a) => lo.elevation + (a / t) * rise, a0: 0, a1: run, out: 1 },
      { cOpen: W + st.gap, cWall: C, yAt: (a) => lo.elevation + (2 * n - a / t) * rise, a0: 0, a1: run, out: -1 },
    ];
    for (const f of flights) {
      const slope = Math.atan2(rise, t);
      const yA = f.yAt(f.a0);
      const yB = f.yAt(f.a1);
      const mid = (f.a0 + f.a1) / 2;
      const len = Math.hypot(f.a1 - f.a0, yB - yA);
      const ang = Math.atan2(yB - yA, f.a1 - f.a0);
      // wall skirt board
      parts.push(box(mid, (yA + yB) / 2 + 0.06, f.cWall + (f.cWall === 0 ? 0.01 : -0.01), len + 0.2, 0.26, 0.02, 'secondary', { r: [0, 0, ang] }));
      // open stringer fascia
      parts.push(box(mid, (yA + yB) / 2 - 0.06, f.cOpen + f.out * 0.015, len + 0.1, 0.3, 0.03, 'secondary', { r: [0, 0, ang] }));
      // handrail on the open edge
      const zr = f.cOpen + f.out * 0.02;
      parts.push(rbox(mid, (yA + yB) / 2 + railH, zr, len, 0.055, 0.065, 0.02, 'primary', { r: [0, 0, ang] }));
      // newels at both ends
      // newel at the bottom of each flight (lane A starts low at a0, lane B starts low at a1)
      if (f.out === 1) parts.push(...newel(f.a0 - 0.02, yA - rise, zr, railH + rise + 0.1, 'primary'));
      else parts.push(...newel(f.a0 - 0.02, yA - rise, zr, railH + rise + 0.1, 'primary'));
      // balusters: two per tread
      for (let i = 0; i < n - 1; i++) {
        for (const frac of [0.25, 0.75]) {
          const a = f.a0 + (i + frac) * t;
          const yTread = f.out === 1 ? lo.elevation + (i + 1) * rise : lo.elevation + (2 * n - i - 1) * rise;
          const yRail = f.yAt(a) + railH - 0.03;
          parts.push(box(a, (yTread + yRail) / 2, zr, 0.016, yRail - yTread, 0.016, 'metal'));
        }
      }
      void slope;
    }
    // landing guard along the open gap
    const la = run + st.landingDepth / 2;
    const ly = lo.elevation + n * rise;
    void la;
    void ly;
  }
  // stair-local -> world
  const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(st.dir.x, 0, st.dir.z), new THREE.Vector3(0, 1, 0), new THREE.Vector3(st.side.x, 0, st.side.z));
  m.setPosition(st.origin.x, 0, st.origin.z);
  return assemble(parts, q, { primary: st.materialId, secondary: 'paint-warm-charcoal', metal: 'black-metal' }, m);
}

/** Porch or deck railing on a 'rail' wall: square posts at ends and every ~1.8 m, top cap rail, bottom rail, square balusters. */
export function buildRailDetailed(wall: Wall, level: Level, levels: Record<Id, Level>, q: number): Built | null {
  const { len, tx, tz } = wallVec(wall);
  if (len < 1e-3) return null;
  const y0 = wallBase(wall, level);
  const y1 = wallTop(wall, level, levels);
  const h = y1 - y0;
  const parts: Part[] = [];
  const nPost = Math.max(1, Math.round(len / 1.8));
  for (let i = 0; i <= nPost; i++) {
    const a = (i / nPost) * len;
    parts.push(rbox(a, y0 + (h + 0.06) / 2, 0, 0.1, h + 0.06, 0.1, 0.008, 'primary', { gv: true }));
    parts.push(rbox(a, y0 + h + 0.075, 0, 0.13, 0.03, 0.13, 0.006, 'primary'));
  }
  parts.push(rbox(len / 2, y0 + h - 0.02, 0, len, 0.04, 0.14, 0.008, 'primary'));
  parts.push(box(len / 2, y0 + h - 0.06, 0, len, 0.05, 0.06, 'primary'));
  parts.push(box(len / 2, y0 + 0.09, 0, len, 0.05, 0.06, 'primary'));
  const nb = Math.floor(len / 0.11);
  for (let i = 1; i < nb; i++) {
    const a = (i / nb) * len;
    if (Array.from({ length: nPost + 1 }, (_, k) => (k / nPost) * len).some((p) => Math.abs(p - a) < 0.07)) continue;
    parts.push(box(a, y0 + 0.115 + (h - 0.2) / 2, 0, 0.019, h - 0.2, 0.019, 'metal'));
  }
  const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(tx, 0, tz), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-tz, 0, tx));
  m.setPosition(wall.start.x, 0, wall.start.z);
  return assemble(parts, q, { primary: wall.finishA ?? 'timber-dark', metal: 'black-metal' }, m);
}

void rod;
