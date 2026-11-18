import * as THREE from 'three';
import { computeWallBoxes, wallVec } from '../model/arch';
import { pitPolygons, terrainHeight } from '../model/site';
import { stairBoxes, stairToWorld } from '../model/stairs';
import { pointInPolygon } from '../model/geometry2d';
import type { Id, Level, Opening, Project, Room, Roof, Slab, Stair, Vec2, Wall } from '../model/types';
import { MeshBuilder } from './meshBuilder';

type V3 = [number, number, number];

/** A built geometry plus the material ids its draw groups index into. */
export interface Built {
  geometry: THREE.BufferGeometry;
  materialIds: Id[];
  /** use vertex-colour (furniture) materials */
  vc?: boolean;
}

/** Sentinel material id for plan / section cut faces. */
export const CUT_ID = '__cut';

const done = (mb: MeshBuilder, materialIds: Id[]): Built | null => (mb.isEmpty ? null : { geometry: mb.build(), materialIds });

/* ------------------------------------------------------------------ walls */

export function buildWall(
  wall: Wall,
  ops: Opening[],
  level: Level,
  levels: Record<Id, Level>,
  free: [boolean, boolean],
  cutY?: number,
): Built | null {
  const { len, tx, tz, nx, nz } = wallVec(wall);
  if (len < 1e-4) return null;
  const h = wall.thickness / 2;
  const P = (a: number, s: number, y: number): V3 => [wall.start.x + tx * a + nx * s, y, wall.start.z + tz * a + nz * s];
  const mb = new MeshBuilder();
  const boxes = computeWallBoxes(wall, ops, level, levels, { cutY });
  const A = 0;
  const B = 1;
  const CAP = 2;
  const PLINTH = 3;
  const CUT = 4;
  const base = boxes.length ? Math.min(...boxes.map((b) => b.y0)) : 0;

  const addBox = (a0: number, a1: number, y0: number, y1: number, o: { endLo: boolean; endHi: boolean; top: number | null; bottom: boolean; sa: number; sb: number }) => {
    mb.quad(o.sa, [P(a0, h, y0), P(a1, h, y0), P(a1, h, y1), P(a0, h, y1)], [nx, 0, nz]);
    mb.quad(o.sb, [P(a0, -h, y0), P(a1, -h, y0), P(a1, -h, y1), P(a0, -h, y1)], [-nx, 0, -nz]);
    if (o.top !== null) mb.quad(o.top, [P(a0, -h, y1), P(a1, -h, y1), P(a1, h, y1), P(a0, h, y1)], [0, 1, 0]);
    if (o.bottom) mb.quad(CAP, [P(a0, -h, y0), P(a1, -h, y0), P(a1, h, y0), P(a0, h, y0)], [0, -1, 0]);
    if (o.endLo) mb.quad(CAP, [P(a0, -h, y0), P(a0, h, y0), P(a0, h, y1), P(a0, -h, y1)], [-tx, 0, -tz]);
    if (o.endHi) mb.quad(CAP, [P(a1, -h, y0), P(a1, h, y0), P(a1, h, y1), P(a1, -h, y1)], [tx, 0, tz]);
  };

  for (const b of boxes) {
    if (b.kind !== 'solid') continue;
    const isPl = b.mat === 'plinth';
    const clipped = cutY !== undefined && Math.abs(b.y1 - cutY) < 1e-6;
    addBox(b.a0, b.a1, b.y0, b.y1, {
      endLo: b.a0 > 1e-6 || free[0],
      endHi: b.a1 < len - 1e-6 || free[1],
      top: isPl ? null : clipped ? CUT : CAP,
      bottom: b.y0 > base + 1e-4,
      sa: isPl ? PLINTH : A,
      sb: isPl ? PLINTH : B,
    });
  }
  // close corners: extend joined ends by half a thickness
  const top = boxes.length ? Math.max(...boxes.map((b) => b.y1)) : 0;
  const clippedTop = cutY !== undefined && Math.abs(top - cutY) < 1e-6;
  const ext = (a0: number, a1: number) => {
    const plinthTop = wall.plinth ? level.elevation + wall.plinth.top : undefined;
    const pieces: [number, number, boolean][] = plinthTop !== undefined && plinthTop > base && plinthTop < top ? [[base, plinthTop, true], [plinthTop, top, false]] : [[base, top, false]];
    for (const [y0, y1, pl] of pieces) {
      addBox(a0, a1, y0, y1, { endLo: false, endHi: false, top: pl ? null : clippedTop ? CUT : CAP, bottom: false, sa: pl ? PLINTH : A, sb: pl ? PLINTH : B });
    }
  };
  if (!free[0] && boxes.length) ext(-h, 0);
  if (!free[1] && boxes.length) ext(len, len + h);

  return done(mb, [wall.finishA, wall.finishB, wall.capMaterialId, wall.plinth?.materialId ?? wall.finishA, CUT_ID]);
}

/* ------------------------------------------------------------------ polygons */

function triangulate(outline: Vec2[], holes: Vec2[][]) {
  const contour = outline.map((p) => new THREE.Vector2(p.x, p.z));
  const hs = holes.map((h) => h.map((p) => new THREE.Vector2(p.x, p.z)));
  const faces = THREE.ShapeUtils.triangulateShape(contour, hs);
  const all = [...contour, ...hs.flat()];
  return { all, faces };
}

function signedArea(poly: Vec2[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p.x * q.z - q.x * p.z;
  }
  return a / 2;
}

function addPolygonFace(mb: MeshBuilder, m: number, outline: Vec2[], holes: Vec2[][], y: number, up: boolean) {
  const { all, faces } = triangulate(outline, holes);
  for (const f of faces) {
    const [a, b, c] = f.map((i) => all[i]);
    mb.tri(m, [[a.x, y, a.y], [b.x, y, b.y], [c.x, y, c.y]], [0, up ? 1 : -1, 0]);
  }
}

/* ------------------------------------------------------------------ slabs */

export function buildSlab(slab: Slab, level: Level): Built | null {
  if (slab.outline.length < 3) return null;
  const th = slab.thickness ?? level.slabThickness;
  const yTop = level.elevation + slab.topOffset;
  const yBot = yTop - th;
  const mb = new MeshBuilder();
  addPolygonFace(mb, 0, slab.outline, slab.holes, yTop, true);
  addPolygonFace(mb, 1, slab.outline, slab.holes, yBot, false);
  const ring = (pts: Vec2[], inward: boolean) => {
    const s = Math.sign(signedArea(pts)) || 1;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const q = pts[(i + 1) % pts.length];
      const dx = q.x - p.x;
      const dz = q.z - p.z;
      const k = (inward ? -1 : 1) * s;
      mb.quad(1, [[p.x, yBot, p.z], [q.x, yBot, q.z], [q.x, yTop, q.z], [p.x, yTop, p.z]], [k * dz, 0, -k * dx]);
    }
  };
  ring(slab.outline, false);
  for (const h of slab.holes) ring(h, true);
  return done(mb, [slab.topMaterialId, slab.sideMaterialId]);
}

/* ------------------------------------------------------------------ rooms */

export function buildRoomFloor(room: Room, level: Level): Built | null {
  if (!room.hasFloor || room.outline.length < 3) return null;
  const mb = new MeshBuilder();
  addPolygonFace(mb, 0, room.outline, [], level.elevation + 0.004, true);
  return done(mb, [room.floorMaterialId]);
}

export function roomCeilingY(room: Room, level: Level, levels: Record<Id, Level>): number {
  if (room.ceilingLevelId && levels[room.ceilingLevelId]) {
    const l = levels[room.ceilingLevelId];
    return l.elevation + l.ceilingHeight;
  }
  return level.elevation + (room.ceilingHeight ?? level.ceilingHeight);
}

export function buildRoomCeiling(room: Room, level: Level, levels: Record<Id, Level>): Built | null {
  if (!room.showCeiling || room.outline.length < 3) return null;
  const mb = new MeshBuilder();
  addPolygonFace(mb, 0, room.outline, [], roomCeilingY(room, level, levels) - 0.004, false);
  return done(mb, [room.ceilingMaterialId]);
}

/* ------------------------------------------------------------------ stairs */

export function buildStair(stair: Stair, levels: Record<Id, Level>): Built | null {
  const mb = new MeshBuilder();
  for (const b of stairBoxes(stair, levels)) {
    const c = [stairToWorld(stair, b.a0, b.c0), stairToWorld(stair, b.a1, b.c0), stairToWorld(stair, b.a1, b.c1), stairToWorld(stair, b.a0, b.c1)];
    mb.prism({ top: 0, side: 1, bottom: 1 }, c.map((p) => [p.x, p.z]) as [[number, number], [number, number], [number, number], [number, number]], b.bottom, b.top);
  }
  return done(mb, [stair.materialId, 'paint-warm-charcoal']);
}

/* ------------------------------------------------------------------ roofs */

/** How far the faces of the walls under a roof stand outside the roof's footprint line.
 *  `along` picks walls that run with the ridge (eave lines) or across it (gable ends). */
function wallReach(roof: Roof, walls: Wall[], along: boolean, sign: 1 | -1): number {
  const alongX = roof.ridgeAxis === 'x';
  const sizeR = alongX ? roof.size.x : roof.size.z;
  const sizeS = alongX ? roof.size.z : roof.size.x;
  const target = along ? (sign * sizeS) / 2 : (sign * sizeR) / 2;
  let reach = 0;
  for (const w of walls) {
    if (w.levelId !== roof.levelId) continue;
    const dx = w.end.x - w.start.x;
    const dz = w.end.z - w.start.z;
    const len = Math.hypot(dx, dz) || 1;
    const dr = Math.abs(alongX ? dx : dz) / len; // component along the ridge
    if (along ? dr < 0.98 : dr > 0.02) continue;
    const mx = (w.start.x + w.end.x) / 2 - roof.center.x;
    const mz = (w.start.z + w.end.z) / 2 - roof.center.z;
    const r = alongX ? mx : mz;
    const sv = alongX ? mz : mx;
    const across = along ? sv : r; // offset of this wall's centre line across its own axis
    const other = along ? r : sv; // where along the line it sits
    const half = (along ? sizeR : sizeS) / 2 + 1;
    if (Math.abs(other) > half) continue;
    if (Math.abs(across - target) > 0.45) continue;
    reach = Math.max(reach, (across - target) * sign + w.thickness / 2);
  }
  return Math.max(0, reach);
}

export function buildRoof(roof: Roof, level: Level, levels: Record<Id, Level>, walls: Wall[] = []): Built | null {
  const mb = new MeshBuilder();
  const ybWall = level.elevation + level.ceilingHeight + roof.baseOffset;
  const alongX = roof.ridgeAxis === 'x';
  const sizeR = alongX ? roof.size.x : roof.size.z; // along the ridge
  const sizeS = alongX ? roof.size.z : roof.size.x; // across the ridge
  const hs = sizeS / 2;
  const Lr = sizeR / 2 + roof.rakeOverhang;
  const e = roof.eaveOverhang;
  const thV = roof.thickness * Math.sqrt(1 + roof.pitch * roof.pitch);
  void levels;
  // the roof sits on the outer faces of the walls, not on their centre lines: lift it so wall tops never poke through
  const eaveReach = roof.kind === 'gable' ? Math.max(wallReach(roof, walls, true, 1), wallReach(roof, walls, true, -1)) : wallReach(roof, walls, true, (-roof.shedHigh) as 1 | -1);
  const lift = eaveReach > 0 ? eaveReach * roof.pitch + 0.012 : 0;
  const yb = ybWall + lift;
  const W = (r: number, s: number, y: number): V3 =>
    alongX ? [roof.center.x + r, y, roof.center.z + s] : [roof.center.x + s, y, roof.center.z + r];
  const rDir: V3 = alongX ? [1, 0, 0] : [0, 0, 1];

  const slope = (c: [V3, V3, V3, V3]) => {
    mb.quad(0, c, [0, 1, 0]);
    const bot = c.map((p) => [p[0], p[1] - thV, p[2]] as V3) as [V3, V3, V3, V3];
    mb.quad(1, bot, [0, -1, 0]);
    const cx = (c[0][0] + c[1][0] + c[2][0] + c[3][0]) / 4;
    const cz = (c[0][2] + c[1][2] + c[2][2] + c[3][2]) / 4;
    for (let i = 0; i < 4; i++) {
      const p = c[i];
      const q = c[(i + 1) % 4];
      const bp = bot[i];
      const bq = bot[(i + 1) % 4];
      mb.quad(2, [bp, bq, q, p], [(p[0] + q[0]) / 2 - cx, 0, (p[2] + q[2]) / 2 - cz]);
    }
  };

  if (roof.kind === 'gable') {
    const yr = yb + hs * roof.pitch;
    const ye = yb - e * roof.pitch;
    slope([W(-Lr, 0, yr), W(Lr, 0, yr), W(Lr, hs + e, ye), W(-Lr, hs + e, ye)]);
    slope([W(Lr, 0, yr), W(-Lr, 0, yr), W(-Lr, -(hs + e), ye), W(Lr, -(hs + e), ye)]);
    if (roof.gableEnds) {
      // gable infill: a solid panel as thick as the wall below, flush with its outer face (no recess, no wall top showing)
      const hb = hs + eaveReach;
      const apex = yr - thV * 0.5;
      const base = apex - hb * roof.pitch;
      for (const sgn of [-1, 1] as const) {
        const reach = wallReach(roof, walls, false, sgn);
        const rOut = sgn * (sizeR / 2 + reach);
        const rIn = sgn * (sizeR / 2 - reach);
        mb.tri(3, [W(rOut, -hb, base), W(rOut, hb, base), W(rOut, 0, apex)], [rDir[0] * sgn, 0, rDir[2] * sgn]);
        if (reach > 0) mb.tri(3, [W(rIn, hb, base), W(rIn, -hb, base), W(rIn, 0, apex)], [-rDir[0] * sgn, 0, -rDir[2] * sgn]);
      }
    }
  } else {
    const sLow = -roof.shedHigh * (hs + e);
    const sHigh = roof.shedHigh * hs;
    const yLow = yb - e * roof.pitch;
    const yHigh = yb + sizeS * roof.pitch;
    slope([W(-Lr, sLow, yLow), W(Lr, sLow, yLow), W(Lr, sHigh, yHigh), W(-Lr, sHigh, yHigh)]);
  }
  return done(mb, [roof.materialId, 'trim-black', 'trim-black', roof.gableMaterialId]);
}

/* ------------------------------------------------------------------ openings */

export function buildOpening(op: Opening, wall: Wall, level: Level): Built | null {
  const { len, tx, tz, nx, nz } = wallVec(wall);
  if (len < 1e-4) return null;
  const P = (a: number, s: number, y: number): V3 => [wall.start.x + tx * a + nx * s, y, wall.start.z + tz * a + nz * s];
  const mb = new MeshBuilder();
  const FRAME = 0;
  const LEAF = 1;
  const GLASS = 2;
  const METAL = 3;
  const box = (m: number, a0: number, a1: number, s0: number, s1: number, y0: number, y1: number) => {
    if (a1 <= a0 || y1 <= y0 || s1 <= s0) return;
    mb.quad(m, [P(a0, s1, y0), P(a1, s1, y0), P(a1, s1, y1), P(a0, s1, y1)], [nx, 0, nz]);
    mb.quad(m, [P(a0, s0, y0), P(a1, s0, y0), P(a1, s0, y1), P(a0, s0, y1)], [-nx, 0, -nz]);
    mb.quad(m, [P(a0, s0, y1), P(a1, s0, y1), P(a1, s1, y1), P(a0, s1, y1)], [0, 1, 0]);
    mb.quad(m, [P(a0, s0, y0), P(a1, s0, y0), P(a1, s1, y0), P(a0, s1, y0)], [0, -1, 0]);
    mb.quad(m, [P(a0, s0, y0), P(a0, s1, y0), P(a0, s1, y1), P(a0, s0, y1)], [-tx, 0, -tz]);
    mb.quad(m, [P(a1, s0, y0), P(a1, s1, y0), P(a1, s1, y1), P(a1, s0, y1)], [tx, 0, tz]);
  };
  const a0 = op.offset;
  const a1 = op.offset + op.width;
  const y0 = level.elevation + op.sill;
  const y1 = y0 + op.height;
  const D = wall.thickness / 2 + 0.015;
  const fw = 0.065;

  if (op.kind === 'window') {
    const sillH = 0.04;
    box(FRAME, a0 - 0.02, a1 + 0.02, -(wall.thickness / 2 + 0.05), wall.thickness / 2 + 0.05, y0, y0 + sillH);
    box(FRAME, a0, a0 + fw, -D, D, y0 + sillH, y1);
    box(FRAME, a1 - fw, a1, -D, D, y0 + sillH, y1);
    box(FRAME, a0 + fw, a1 - fw, -D, D, y1 - fw, y1);
    const gx0 = a0 + fw;
    const gx1 = a1 - fw;
    const gy0 = y0 + sillH;
    const gy1 = y1 - fw;
    box(GLASS, gx0, gx1, -0.006, 0.006, gy0, gy1);
    const mw = 0.022;
    for (let i = 1; i < op.muntinCols; i++) {
      const a = gx0 + ((gx1 - gx0) * i) / op.muntinCols;
      box(METAL, a - mw / 2, a + mw / 2, -0.014, 0.014, gy0, gy1);
    }
    for (let j = 1; j < op.muntinRows; j++) {
      const y = gy0 + ((gy1 - gy0) * j) / op.muntinRows;
      box(METAL, gx0, gx1, -0.014, 0.014, y - mw / 2, y + mw / 2);
    }
    if (op.style === 'transom') box(METAL, gx0, gx1, -0.016, 0.016, gy1 - 0.45 - 0.02, gy1 - 0.45 + 0.02);
  } else {
    const dw = op.width - fw * 2;
    const dy1 = y1 - fw;
    box(FRAME, a0, a0 + fw, -D, D, y0, y1);
    box(FRAME, a1 - fw, a1, -D, D, y0, y1);
    box(FRAME, a0 + fw, a1 - fw, -D, D, y1 - fw, y1);
    const lx0 = a0 + fw;
    const lx1 = a1 - fw;
    const th = 0.045;
    if (op.style === 'cased') {
      /* open cased opening: trim only */
    } else if (op.style === 'garage') {
      const n = 4;
      const gap = 0.012;
      const sh = (dy1 - y0) / n;
      for (let i = 0; i < n; i++) {
        box(LEAF, lx0, lx1, -0.03, 0.03, y0 + i * sh + gap / 2, y0 + (i + 1) * sh - gap / 2);
        // window strip in the second panel
        if (i === 2) {
          const k = 4;
          const wsw = (lx1 - lx0 - 0.5) / k;
          for (let w = 0; w < k; w++) {
            const wa = lx0 + 0.25 + w * wsw;
            box(GLASS, wa + 0.04, wa + wsw - 0.04, -0.034, 0.034, y0 + i * sh + sh * 0.3, y0 + i * sh + sh * 0.72);
          }
        }
      }
    } else if (op.style === 'sliding') {
      const mid = (lx0 + lx1) / 2;
      const pane = (pa0: number, pa1: number, s: number) => {
        box(GLASS, pa0, pa1, s - 0.006, s + 0.006, y0 + 0.05, dy1 - 0.05);
        box(METAL, pa0, pa1, s - 0.02, s + 0.02, y0, y0 + 0.05);
        box(METAL, pa0, pa1, s - 0.02, s + 0.02, dy1 - 0.05, dy1);
        box(METAL, pa0, pa0 + 0.045, s - 0.02, s + 0.02, y0, dy1);
        box(METAL, pa1 - 0.045, pa1, s - 0.02, s + 0.02, y0, dy1);
      };
      pane(lx0, mid + 0.03, -0.03);
      pane(mid - 0.03, lx1, 0.03);
    } else if (op.style === 'double') {
      const mid = (lx0 + lx1) / 2;
      const leaf = (pa0: number, pa1: number) => {
        const sw = 0.07;
        box(LEAF, pa0, pa0 + sw, -th / 2, th / 2, y0, dy1);
        box(LEAF, pa1 - sw, pa1, -th / 2, th / 2, y0, dy1);
        box(LEAF, pa0, pa1, -th / 2, th / 2, y0, y0 + 0.12);
        box(LEAF, pa0, pa1, -th / 2, th / 2, dy1 - sw, dy1);
        box(GLASS, pa0 + sw, pa1 - sw, -0.006, 0.006, y0 + 0.12, dy1 - sw);
        const rows = 4;
        for (let j = 1; j < rows; j++) {
          const y = y0 + 0.12 + ((dy1 - sw - y0 - 0.12) * j) / rows;
          box(LEAF, pa0 + sw, pa1 - sw, -0.014, 0.014, y - 0.012, y + 0.012);
        }
        box(LEAF, (pa0 + pa1) / 2 - 0.012, (pa0 + pa1) / 2 + 0.012, -0.014, 0.014, y0 + 0.12, dy1 - sw);
      };
      leaf(lx0, mid - 0.004);
      leaf(mid + 0.004, lx1);
    } else {
      // single hinged leaf, optional open swing
      if (!op.open) {
        box(LEAF, lx0, lx1, -th / 2, th / 2, y0, dy1);
        const hx = op.hinge === 'start' ? lx1 - 0.1 : lx0 + 0.1;
        box(METAL, hx - 0.02, hx + 0.02, th / 2, th / 2 + 0.05, y0 + 0.95, y0 + 0.99);
        box(METAL, hx - 0.02, hx + 0.02, -th / 2 - 0.05, -th / 2, y0 + 0.95, y0 + 0.99);
      } else {
        const pivot = op.hinge === 'start' ? lx0 : lx1;
        const swing = dw;
        box(LEAF, pivot - th / 2, pivot + th / 2, 0, swing, y0, dy1);
      }
    }
  }
  const leafMat = op.kind === 'door' ? op.leafMaterialId : op.frameMaterialId;
  return done(mb, [op.frameMaterialId, leafMat, 'glass', op.kind === 'window' ? op.frameMaterialId : 'black-metal']);
}

/* ------------------------------------------------------------------ terrain */

export function buildTerrain(p: Project, cell = 0.3, withSkirt = true): Built | null {
  const s = p.site;
  const nx = Math.max(2, Math.ceil((s.maxX - s.minX) / cell));
  const nz = Math.max(2, Math.ceil((s.maxZ - s.minZ) / cell));
  const dx = (s.maxX - s.minX) / nx;
  const dz = (s.maxZ - s.minZ) / nz;
  const pits = pitPolygons(p);
  const lowest = p.levels[p.levelOrder[0]];
  const pitY = lowest ? lowest.elevation - lowest.slabThickness - 0.003 : -0.31;
  const W = nx + 1;
  const pos = new Float32Array(W * (nz + 1) * 3);
  const uv = new Float32Array(W * (nz + 1) * 2);
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const x = s.minX + i * dx;
      const z = s.minZ + j * dz;
      let y = terrainHeight(p, x, z);
      for (const poly of pits) {
        if (pointInPolygon({ x, z }, poly)) {
          y = Math.min(y, pitY);
          break;
        }
      }
      const k = j * W + i;
      pos[k * 3] = x;
      pos[k * 3 + 1] = y;
      pos[k * 3 + 2] = z;
      uv[k * 2] = x;
      uv[k * 2 + 1] = z;
    }
  }
  const idx: number[] = [];
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const a = j * W + i;
      const b = a + 1;
      const c = a + W;
      const d = c + 1;
      // CCW seen from +Y: (x, z) with +z "down" => a, c, b
      idx.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  geo.addGroup(0, idx.length, 0);
  if (!withSkirt) return { geometry: geo, materialIds: [s.groundMaterialId] };

  // skirt so side views show a clean cut through the ground
  const sk = new MeshBuilder();
  const bottom = -3;
  const edge = (x0: number, z0: number, x1: number, z1: number, n: V3, steps: number) => {
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps;
      const t1 = (i + 1) / steps;
      const xa = x0 + (x1 - x0) * t0;
      const za = z0 + (z1 - z0) * t0;
      const xb = x0 + (x1 - x0) * t1;
      const zb = z0 + (z1 - z0) * t1;
      sk.quad(0, [[xa, bottom, za], [xb, bottom, zb], [xb, terrainHeight(p, xb, zb), zb], [xa, terrainHeight(p, xa, za), za]], n);
    }
  };
  edge(s.minX, s.minZ, s.maxX, s.minZ, [0, 0, -1], 1);
  edge(s.minX, s.maxZ, s.maxX, s.maxZ, [0, 0, 1], 1);
  edge(s.minX, s.minZ, s.minX, s.maxZ, [-1, 0, 0], 60);
  edge(s.maxX, s.minZ, s.maxX, s.maxZ, [1, 0, 0], 60);
  const skirt = sk.build();
  return { geometry: mergeTwo(geo, skirt), materialIds: [s.groundMaterialId, 'soil'] };
}

function mergeTwo(a: THREE.BufferGeometry, b: THREE.BufferGeometry): THREE.BufferGeometry {
  const ai = a.getIndex()!;
  const bi = b.getIndex()!;
  const ap = a.getAttribute('position');
  const bp = b.getAttribute('position');
  const an = a.getAttribute('normal');
  const bn = b.getAttribute('normal');
  const au = a.getAttribute('uv');
  const bu = b.getAttribute('uv');
  const na = ap.count;
  const pos = new Float32Array((ap.count + bp.count) * 3);
  pos.set(ap.array as Float32Array, 0);
  pos.set(bp.array as Float32Array, ap.count * 3);
  const nor = new Float32Array((an.count + bn.count) * 3);
  nor.set(an.array as Float32Array, 0);
  nor.set(bn.array as Float32Array, an.count * 3);
  const uvs = new Float32Array((au.count + bu.count) * 2);
  uvs.set(au.array as Float32Array, 0);
  uvs.set(bu.array as Float32Array, au.count * 2);
  const idx = new Uint32Array(ai.count + bi.count);
  idx.set(ai.array as unknown as Uint32Array, 0);
  for (let i = 0; i < bi.count; i++) idx[ai.count + i] = (bi.array as unknown as number[])[i] + na;
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.addGroup(0, ai.count, 0);
  out.addGroup(ai.count, bi.count, 1);
  out.computeBoundingBox();
  out.computeBoundingSphere();
  return out;
}
