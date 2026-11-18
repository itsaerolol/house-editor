import { applyExteriorStyle } from './exteriorStyles';
import { CATALOG_BY_ID } from './catalog';
import { wallVec } from './arch';
import { pointInPolygon, polygonArea } from './geometry2d';
import { buildMaterialRecord } from './materials';
import { DEFAULT_VIEW } from './serialize';
import { terrainHeight } from './site';
import { stairCorePolygon } from './stairs';
import type {
  Door,
  FurnitureInstance,
  Id,
  Level,
  Opening,
  Project,
  Room,
  Roof,
  Slab,
  Stair,
  Vec2,
  Wall,
  WallKind,
  Window,
} from './types';
import { FT } from './units';

/**
 * Starter house authoring.
 * Design coordinates are in feet: u runs to the RIGHT as seen in the Front view,
 * v runs away from the street (front of house at v = 0, back at v > 0).
 * World mapping: x = -u * FT, z = v * FT, Y up. The front elevation faces world -Z.
 */
const P = (u: number, v: number): Vec2 => ({ x: -u * FT || 0, z: v * FT });
const rect = (u0: number, v0: number, u1: number, v1: number): Vec2[] => [P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)];
const poly = (pts: [number, number][]): Vec2[] => pts.map(([u, v]) => P(u, v));

type Face = 'N' | 'S' | 'E' | 'W';
const FACE_ROT: Record<Face, number> = { N: 0, S: Math.PI, E: -Math.PI / 2, W: Math.PI / 2 };

export const CEILING = 9 * FT; // 9'-0" clear
export const SLAB = 1 * FT; // 12" structural floor
export const FLOOR_TO_FLOOR = CEILING + SLAB; // 3.05 m = 10'-0"

interface WallOpts {
  kind?: WallKind;
  t?: number;
  h?: number;
  top?: Id;
  base?: number;
  plinth?: Wall['plinth'];
  name?: string;
}

interface OpenOpts {
  style?: string;
  open?: boolean;
  hinge?: 'start' | 'end';
  frame?: Id;
  leaf?: Id;
  cols?: number;
  rows?: number;
  name?: string;
}

interface FOpts {
  w?: number;
  d?: number;
  h?: number;
  /** meters above the level floor */
  elev?: number;
  mat?: Record<string, Id>;
  name?: string;
}

export function createStarterProject(): Project {
  const counters: Record<string, number> = {};
  const nid = (prefix: string) => `${prefix}-${String((counters[prefix] = (counters[prefix] ?? 0) + 1)).padStart(3, '0')}`;

  const levels: Record<Id, Level> = {
    L0: { id: 'L0', name: 'Basement (walkout)', elevation: 0, ceilingHeight: CEILING, slabThickness: SLAB },
    L1: { id: 'L1', name: 'Main floor', elevation: FLOOR_TO_FLOOR, ceilingHeight: CEILING, slabThickness: SLAB },
    L2: { id: 'L2', name: 'Upper floor', elevation: FLOOR_TO_FLOOR * 2, ceilingHeight: CEILING, slabThickness: SLAB },
  };
  const walls: Record<Id, Wall> = {};
  const openings: Record<Id, Opening> = {};
  const slabs: Record<Id, Slab> = {};
  const rooms: Record<Id, Room> = {};
  const stairs: Record<Id, Stair> = {};
  const roofs: Record<Id, Roof> = {};
  const furniture: Record<Id, FurnitureInstance> = {};
  const roomPaint: Record<Id, Id> = {};
  const design: Record<Id, { a: [number, number]; b: [number, number] }> = {};

  // ------------------------------------------------------------------ builders
  function wall(levelId: Id, a: [number, number], b: [number, number], o: WallOpts = {}): Id {
    const id = nid('w');
    const kind = o.kind ?? 'interior';
    walls[id] = {
      id,
      name: o.name,
      levelId,
      start: P(a[0], a[1]),
      end: P(b[0], b[1]),
      thickness: o.t ?? (kind === 'exterior' ? 0.3 : kind === 'rail' ? 0.08 : 0.125),
      height: o.h ?? (kind === 'rail' ? 1.05 : null),
      topLevelId: o.top,
      kind,
      finishA: 'paint-warm-charcoal',
      finishB: 'paint-warm-charcoal',
      capMaterialId: kind === 'exterior' ? 'trim-black' : kind === 'rail' ? 'timber-dark' : 'paint-warm-charcoal',
      baseOffset: o.base,
      plinth: o.plinth,
    };
    if (o.base === undefined) delete walls[id].baseOffset;
    if (!o.plinth) delete walls[id].plinth;
    if (!o.top) delete walls[id].topLevelId;
    if (!o.name) delete walls[id].name;
    design[id] = { a, b };
    return id;
  }

  /** Add a door/window to a wall. c = center coordinate along the wall in feet (u or v). */
  function opening(wid: Id, kind: 'door' | 'window', c: number, wFt: number, hFt: number, sillFt: number, o: OpenOpts = {}): Id {
    const d = design[wid];
    const alongU = Math.abs(d.b[1] - d.a[1]) < 1e-9;
    const along = alongU ? Math.abs(c - d.a[0]) : Math.abs(c - d.a[1]);
    const width = wFt * FT;
    const base = {
      id: nid(kind === 'door' ? 'd' : 'o'),
      name: o.name,
      wallId: wid,
      offset: along * FT - width / 2,
      width,
      height: hFt * FT,
      sill: sillFt * FT,
      frameMaterialId: o.frame ?? (kind === 'window' ? 'frame-black' : 'trim-black'),
    };
    if (!o.name) delete (base as any).name;
    if (kind === 'door') {
      const ext = walls[wid].kind === 'exterior';
      const door: Door = {
        ...base,
        kind: 'door',
        style: (o.style as Door['style']) ?? 'single',
        hinge: o.hinge ?? 'start',
        open: o.open ?? !ext,
        leafMaterialId: o.leaf ?? (ext ? 'door-entry' : 'door-int'),
      };
      openings[door.id] = door;
      return door.id;
    }
    const win: Window = {
      ...base,
      kind: 'window',
      style: (o.style as Window['style']) ?? 'casement',
      muntinCols: o.cols ?? Math.max(1, Math.round(wFt / 2)),
      muntinRows: o.rows ?? Math.max(1, Math.round(hFt / 3)),
    };
    openings[win.id] = win;
    return win.id;
  }
  const door = (wid: Id, c: number, wFt = 3, o: OpenOpts = {}) => opening(wid, 'door', c, wFt, 6.83, 0, o);
  const cased = (wid: Id, c: number, wFt: number, hFt = 7.2) => opening(wid, 'door', c, wFt, hFt, 0, { style: 'cased', open: true, frame: 'paint-warm-charcoal' });
  const win = (wid: Id, c: number, wFt: number, hFt: number, sillFt: number, o: OpenOpts = {}) => opening(wid, 'window', c, wFt, hFt, sillFt, o);

  function slab(levelId: Id, kind: Slab['kind'], outline: Vec2[], o: Partial<Slab> & { name?: string } = {}): Id {
    const id = nid('s');
    slabs[id] = {
      id,
      name: o.name,
      levelId,
      kind,
      outline,
      holes: o.holes ?? [],
      thickness: o.thickness ?? null,
      topOffset: o.topOffset ?? 0,
      topMaterialId: o.topMaterialId ?? 'slab-concrete',
      sideMaterialId: o.sideMaterialId ?? 'slab-edge',
    };
    if (!o.name) delete slabs[id].name;
    return id;
  }

  function room(
    levelId: Id,
    name: string,
    kind: string,
    outline: Vec2[],
    floor: Id,
    paint: Id,
    o: { ceilingLevelId?: Id; ceilingMat?: Id; noCeiling?: boolean; noFloor?: boolean } = {},
  ): Id {
    const id = nid('r');
    rooms[id] = {
      id,
      name,
      levelId,
      kind,
      outline,
      floorMaterialId: floor,
      ceilingMaterialId: o.ceilingMat ?? 'ceiling-dark',
      ceilingHeight: null,
      showCeiling: !o.noCeiling,
      hasFloor: !o.noFloor,
    };
    if (o.ceilingLevelId) rooms[id].ceilingLevelId = o.ceilingLevelId;
    roomPaint[id] = paint;
    return id;
  }

  function F(levelId: Id, cat: string, u: number, v: number, face: Face, o: FOpts = {}): Id {
    const c = CATALOG_BY_ID[cat];
    if (!c) throw new Error(`Unknown catalog item ${cat}`);
    const id = nid('f');
    furniture[id] = {
      id,
      name: o.name ?? c.name,
      catalogId: cat,
      levelId,
      position: P(u, v),
      elevation: o.elev ?? c.defaultElevation ?? 0,
      rotationY: FACE_ROT[face],
      size: { w: o.w !== undefined ? o.w * FT : c.size.w, d: o.d !== undefined ? o.d * FT : c.size.d, h: o.h !== undefined ? o.h * FT : c.size.h },
      materialOverrides: { ...(o.mat ?? {}) },
    };
    return id;
  }
  /** furniture sized in meters (height) */
  const FM = (levelId: Id, cat: string, u: number, v: number, face: Face, hMeters: number, o: FOpts = {}) =>
    F(levelId, cat, u, v, face, { ...o, h: hMeters / FT });

  // ------------------------------------------------------------------ site
  const site: Project['site'] = {
    minX: -43,
    maxX: 22,
    minZ: -19,
    maxZ: 23,
    groundMaterialId: 'grass',
    frontLevelId: 'L1',
    frontDrop: 0.45,
    rearLevelId: 'L0',
    rearDrop: 0.05,
    rampStartZ: 4.5,
    rampEndZ: 10.0,
  };
  const groundElevOn = (levelId: Id, v: number) => terrainHeight({ site, levels }, 0, v * FT) - levels[levelId].elevation;

  // ================================================================== ROOMS
  // ---- L0 basement (under the main body only)
  const L0 = 'L0';
  const stairRoomPoly = (): Vec2[] => rect(50, 0.5, 60.04, 7.55);
  room(L0, 'Home theater', 'theater', rect(22, 0, 40, 14), 'carpet-grey', 'paint-navy');
  room(L0, 'Lower hall', 'hall', rect(40, 0, 50, 14), 'oak-smoked', 'paint-warm-charcoal');
  room(L0, 'Stair', 'stair', stairRoomPoly(), 'oak-smoked', 'paint-warm-charcoal', { noFloor: true, noCeiling: true });
  room(L0, 'Rec room & bar', 'rec', rect(31, 14, 50, 34), 'oak-smoked', 'paint-deep-green');
  room(L0, 'Lower bath', 'bath', rect(22, 14, 31, 22), 'tile-slate', 'tile-slate');
  room(L0, 'Basement bedroom 1', 'bedroom', rect(22, 22, 31, 34), 'carpet-grey', 'paint-clay');
  room(L0, 'Family room', 'family', poly([[50, 15], [70, 15], [70, 24], [60, 24], [60, 34], [50, 34]]), 'oak-smoked', 'paint-warm-charcoal');
  room(L0, 'Basement bedroom 2', 'bedroom', rect(60, 24, 70, 34), 'carpet-grey', 'paint-navy');
  room(L0, 'Mechanical', 'utility', rect(50, 7.8, 70, 15), 'concrete-floor', 'paint-warm-charcoal');
  room(L0, 'Storage', 'storage', rect(60.2, 0, 70, 7.8), 'concrete-floor', 'paint-warm-charcoal');

  // ---- L1 main floor
  const L1 = 'L1';
  room(L1, 'Entry', 'foyer', rect(31, 0, 50, 13), 'oak-smoked', 'paint-warm-charcoal');
  room(L1, 'Powder room', 'bath', rect(22, 0, 31, 8), 'tile-slate', 'paint-deep-green');
  room(L1, 'Hall', 'hall', rect(22, 8, 31, 21), 'oak-smoked', 'paint-warm-charcoal');
  room(L1, 'Flex office / guest', 'office', rect(22, 21, 31, 34), 'oak-smoked', 'paint-deep-green');
  room(L1, 'Great room', 'living', rect(31, 13, 50, 34), 'oak-smoked', 'paint-warm-charcoal', { ceilingLevelId: 'L2', ceilingMat: 'ceiling-wood' });
  room(L1, 'Kitchen', 'kitchen', rect(50, 13, 70, 24), 'oak-smoked', 'paint-deep-green');
  room(L1, 'Dining', 'dining', rect(50, 24, 70, 34), 'oak-smoked', 'paint-clay');
  room(L1, 'Walk-in pantry', 'pantry', rect(50, 7.8, 56, 13), 'tile-slate', 'paint-warm-charcoal');
  room(L1, 'Mudroom', 'mud', rect(56, 7.8, 70, 13), 'tile-slate', 'paint-warm-charcoal');
  room(L1, 'Pocket office', 'office', rect(60.2, 0, 70, 7.8), 'oak-smoked', 'paint-navy');
  room(L1, 'Stair', 'stair', stairRoomPoly(), 'oak-smoked', 'paint-warm-charcoal', { noFloor: true, noCeiling: true });
  room(L1, 'Private hall', 'hall', rect(8, 8, 22, 14), 'oak-smoked', 'paint-warm-charcoal');
  room(L1, 'Primary bedroom', 'bedroom', rect(8, 14, 22, 30), 'oak-smoked', 'paint-navy');
  room(L1, 'Primary bath', 'bath', rect(0, 8, 8, 20), 'tile-slate', 'tile-slate');
  room(L1, 'Primary closet', 'closet', rect(0, 20, 8, 30), 'oak-smoked', 'paint-clay');
  room(L1, 'Garage (2-car)', 'garage', rect(76, -6, 98, 14), 'concrete-floor', 'paint-warm-charcoal', { noCeiling: true });
  room(L1, 'Garage (1-car)', 'garage', rect(-20, -6, -4, 16), 'concrete-floor', 'paint-warm-charcoal', { noCeiling: true });

  // ---- L2 upper floor
  const L2 = 'L2';
  room(L2, 'Loft', 'loft', rect(31, 0, 50, 13), 'oak-smoked', 'paint-warm-charcoal');
  room(L2, 'Stair', 'stair', stairRoomPoly(), 'oak-smoked', 'paint-warm-charcoal', { noFloor: true });
  room(L2, 'Guest bedroom', 'bedroom', rect(22, 0, 31, 18), 'oak-natural', 'paint-deep-green');
  room(L2, 'Guest bath', 'bath', rect(22, 18, 31, 28), 'tile-slate', 'tile-slate');
  room(L2, 'Linen storage', 'storage', rect(22, 28, 31, 34), 'oak-smoked', 'paint-warm-charcoal');
  room(L2, 'Upper hall & gallery', 'hall', poly([[50, 7.8], [70, 7.8], [70, 11.3], [54, 11.3], [54, 34], [50, 34]]), 'oak-smoked', 'paint-warm-charcoal');
  room(L2, 'Laundry', 'laundry', rect(60.2, 0, 70, 7.8), 'tile-cream', 'paint-clay');
  room(L2, "Kid's room 1", 'bedroom', rect(54, 11.3, 70, 20.3), 'oak-natural', 'paint-navy');
  room(L2, 'Jack-and-Jill bath', 'bath', rect(54, 20.3, 70, 25.3), 'tile-slate', 'tile-slate');
  room(L2, "Kid's room 2", 'bedroom', rect(54, 25.3, 70, 34), 'oak-natural', 'paint-deep-green');

  // ================================================================== SLABS
  const core = stairCorePolygon({
    origin: P(50, 0.5),
    dir: { x: -1, z: 0 },
    side: { x: 0, z: 1 },
    laneWidth: 1.0,
    gap: 0.15,
    treadDepth: 0.28,
    landingDepth: 1.1,
    risersPerFlight: 8,
  } as Stair);
  const L1_OUTLINE = poly([[0, 8], [22, 8], [22, 0], [70, 0], [70, 34], [22, 34], [22, 30], [0, 30]]);
  slab(L0, 'floor', rect(22, 0, 70, 34), { name: 'Basement slab' });
  slab(L1, 'floor', L1_OUTLINE, { name: 'Main floor slab', holes: [core] });
  slab(L2, 'floor', rect(22, 0, 70, 34), { name: 'Upper floor slab', holes: [core, rect(31, 13, 50, 34)] });
  // garages: thick plinths, floor flush with the main level
  slab(L1, 'floor', rect(76, -6, 98, 14), { name: 'Garage slab (2-car)', thickness: 1.7, topMaterialId: 'concrete-floor', sideMaterialId: 'stone-dark' });
  slab(L1, 'floor', rect(-20, -6, -4, 16), { name: 'Garage slab (1-car)', thickness: 1.7, topMaterialId: 'concrete-floor', sideMaterialId: 'stone-dark' });
  // exterior flatwork
  slab(L1, 'deck', rect(30, -12, 51, 0), { name: 'Front porch deck', thickness: 0.3, topOffset: -0.04, topMaterialId: 'deck-wood', sideMaterialId: 'timber-dark' });
  slab(L1, 'step', rect(36, -15, 45, -12), { name: 'Porch step', thickness: 0.45, topOffset: -0.25, topMaterialId: 'pavers', sideMaterialId: 'stone-dark' });
  slab(L1, 'path', rect(37, -60, 44, -15), { name: 'Front walk', thickness: 0.3, topOffset: -0.43, topMaterialId: 'pavers', sideMaterialId: 'stone-dark' });
  slab(L1, 'drive', rect(76, -60, 98, -9), { name: 'Driveway (2-car)', thickness: 0.4, topOffset: -0.43, topMaterialId: 'gravel', sideMaterialId: 'stone-dark' });
  slab(L1, 'step', rect(76, -9, 98, -6), { name: 'Garage apron (2-car)', thickness: 0.5, topOffset: -0.2, topMaterialId: 'slab-concrete', sideMaterialId: 'stone-dark' });
  slab(L1, 'drive', rect(-20, -60, -4, -9), { name: 'Driveway (1-car)', thickness: 0.4, topOffset: -0.43, topMaterialId: 'gravel', sideMaterialId: 'stone-dark' });
  slab(L1, 'step', rect(-20, -9, -4, -6), { name: 'Garage apron (1-car)', thickness: 0.5, topOffset: -0.2, topMaterialId: 'slab-concrete', sideMaterialId: 'stone-dark' });
  slab(L1, 'deck', rect(70, 5, 76, 16), { name: 'Breezeway', thickness: 0.3, topOffset: -0.04, topMaterialId: 'timber', sideMaterialId: 'timber-dark' });
  slab(L1, 'deck', rect(28, 34, 70, 44), { name: 'Rear covered deck', thickness: 0.3, topOffset: -0.04, topMaterialId: 'deck-wood', sideMaterialId: 'timber-dark' });
  slab(L0, 'patio', rect(14, 34, 78, 52), { name: 'Lower patio', thickness: 0.3, topOffset: -0.03, topMaterialId: 'pavers', sideMaterialId: 'stone-dark' });

  // ================================================================== STAIR
  stairs['stair-001'] = {
    id: 'stair-001',
    name: 'Main stair (basement to upper)',
    levelIds: ['L0', 'L1', 'L2'],
    origin: P(50, 0.5),
    dir: { x: -1, z: 0 },
    side: { x: 0, z: 1 },
    laneWidth: 1.0,
    gap: 0.15,
    treadDepth: 0.28,
    landingDepth: 1.1,
    risersPerFlight: 8,
    materialId: 'timber-dark',
  };

  // ================================================================== WALLS
  const EXT: WallOpts = { kind: 'exterior' };
  const STONE_FOUNDATION: WallOpts = { kind: 'exterior', base: -3.2, plinth: { top: -SLAB, materialId: 'stone-dark' } };

  // ---------------- L0
  const b_front = wall(L0, [22, 0], [70, 0], { ...EXT, name: 'Basement front wall' });
  const b_right = wall(L0, [70, 0], [70, 34], { ...EXT, name: 'Basement right wall' });
  const b_back = wall(L0, [70, 34], [22, 34], { ...EXT, name: 'Basement rear wall' });
  const b_left = wall(L0, [22, 34], [22, 0], { ...EXT, name: 'Basement left wall' });
  void b_front;
  win(b_right, 29, 3, 4, 3);
  win(b_back, 65, 3, 4, 3);
  opening(b_back, 'door', 55, 7, 6.83, 0, { style: 'sliding', frame: 'frame-black', leaf: 'glass', open: false, name: 'Family room slider' });
  opening(b_back, 'door', 45.5, 5, 6.83, 0, { style: 'double', frame: 'frame-black', leaf: 'frame-black', open: false, name: 'Bar french doors' });
  win(b_back, 38, 4, 4, 3);
  win(b_back, 26.5, 3, 4, 3);
  win(b_left, 29, 3, 4, 3);

  const b_thea = wall(L0, [40, 0], [40, 14]);
  door(b_thea, 7, 3);
  const b_n = wall(L0, [22, 14], [50, 14]);
  cased(b_n, 45, 6);
  const b_w = wall(L0, [31, 14], [31, 34]);
  door(b_w, 17, 2.8);
  door(b_w, 28, 3);
  wall(L0, [22, 22], [31, 22]);
  const b_e = wall(L0, [50, 7.8], [50, 34]);
  cased(b_e, 23, 10);
  const b_mech = wall(L0, [50, 15], [70, 15]);
  door(b_mech, 55, 3);
  const b_core_n = wall(L0, [50, 7.8], [70, 7.8]);
  door(b_core_n, 65, 3);
  wall(L0, [60.2, 0], [60.2, 7.8]);
  wall(L0, [60, 24], [70, 24]);
  const b_bed2 = wall(L0, [60, 24], [60, 34]);
  door(b_bed2, 29, 3);

  // ---------------- L1 exterior
  const w_wingfront = wall(L1, [0, 8], [22, 8], { ...STONE_FOUNDATION, name: 'Wing front wall' });
  win(w_wingfront, 15, 3.5, 5, 2.3);
  const w_notch = wall(L1, [22, 8], [22, 0], { ...EXT, name: 'Powder room wall' });
  win(w_notch, 4, 2, 2, 4.5, { style: 'fixed' });
  const w_front = wall(L1, [22, 0], [70, 0], { ...EXT, name: 'Front wall' });
  win(w_front, 34, 3.5, 5, 1.8);
  opening(w_front, 'window', 37.9, 1.4, 6.83, 0, { style: 'fixed', cols: 1, rows: 3, name: 'Entry sidelight L' });
  door(w_front, 40.5, 3.2, { name: 'Front door', hinge: 'start', open: false });
  opening(w_front, 'window', 43.1, 1.4, 6.83, 0, { style: 'fixed', cols: 1, rows: 3, name: 'Entry sidelight R' });
  win(w_front, 47, 3.5, 5, 1.8);
  win(w_front, 55, 3, 4.5, 2.5, { style: 'fixed' });
  win(w_front, 65, 4, 3.5, 3);
  const w_right = wall(L1, [70, 0], [70, 34], { ...EXT, name: 'Right wall' });
  win(w_right, 4, 3, 3.5, 3);
  door(w_right, 10.4, 3, { name: 'Mudroom door', open: false });
  win(w_right, 19, 5, 3.5, 3.5);
  win(w_right, 29, 5, 4, 3);
  const w_back_e = wall(L1, [70, 34], [50, 34], { ...EXT, name: 'Rear wall (dining)' });
  win(w_back_e, 67.5, 3, 4, 3);
  opening(w_back_e, 'door', 60, 8, 6.83, 0, { style: 'sliding', frame: 'frame-black', leaf: 'glass', open: false, name: 'Dining slider' });
  win(w_back_e, 52.5, 2.5, 4, 3);
  const w_back_gr = wall(L1, [50, 34], [31, 34], { ...EXT, top: 'L2', name: 'Great room rear wall' });
  win(w_back_gr, 46.5, 4, 14.5, 2, { style: 'fixed', cols: 2, rows: 5 });
  win(w_back_gr, 34.5, 4, 14.5, 2, { style: 'fixed', cols: 2, rows: 5 });
  const w_back_off = wall(L1, [31, 34], [22, 34], { ...EXT, name: 'Rear wall (office)' });
  win(w_back_off, 26.5, 3.5, 4, 3);
  const w_off_w = wall(L1, [22, 34], [22, 30], { ...EXT, name: 'Office west wall' });
  win(w_off_w, 32, 2, 4, 3);
  const w_wingback = wall(L1, [22, 30], [0, 30], { ...STONE_FOUNDATION, name: 'Wing rear wall' });
  win(w_wingback, 20.5, 2.5, 4.5, 2.5);
  opening(w_wingback, 'door', 15, 5, 6.83, 0, { style: 'double', frame: 'frame-black', leaf: 'frame-black', open: false, name: 'Primary patio doors' });
  win(w_wingback, 9.8, 2.5, 4.5, 2.5);
  const w_wingwest = wall(L1, [0, 30], [0, 8], { ...STONE_FOUNDATION, name: 'Wing west wall' });
  win(w_wingwest, 14, 2.5, 1.5, 5, { style: 'fixed' });

  // ---------------- L1 interior
  const i_fw = wall(L1, [31, 0], [31, 13]);
  door(i_fw, 4.2, 2.6);
  cased(i_fw, 10.5, 4);
  const i_fg = wall(L1, [31, 13], [50, 13]);
  cased(i_fg, 40.5, 14, 7.6);
  wall(L1, [50, 7.8], [50, 13]);
  const i_ke = wall(L1, [50, 13], [50, 34]);
  cased(i_ke, 19, 8);
  cased(i_ke, 29.5, 7);
  const i_core_n = wall(L1, [50, 7.8], [70, 7.8]);
  door(i_core_n, 65, 2.8);
  wall(L1, [60.2, 0], [60.2, 7.8]);
  wall(L1, [56, 7.8], [56, 13]);
  const i_kn = wall(L1, [50, 13], [70, 13]);
  door(i_kn, 53, 2.5);
  door(i_kn, 64, 3);
  wall(L1, [22, 8], [31, 8]);
  const i_ho = wall(L1, [22, 21], [31, 21]);
  door(i_ho, 26.5, 3);
  const i_bw = wall(L1, [22, 8], [22, 30]);
  door(i_bw, 11, 3);
  const i_gw = wall(L1, [31, 13], [31, 34], { top: 'L2', name: 'Great room west wall' });
  door(i_gw, 17, 3);
  const i_wv = wall(L1, [8, 14], [22, 14]);
  cased(i_wv, 15, 4.5);
  const i_wb = wall(L1, [8, 8], [8, 30]);
  door(i_wb, 11, 2.5);
  door(i_wb, 25, 2.5);
  wall(L1, [0, 20], [8, 20]);

  // ---------------- L1 garages
  const gr_front = wall(L1, [76, -6], [98, -6], { ...EXT, name: 'Garage (2-car) front' });
  opening(gr_front, 'door', 82, 8, 7, 0, { style: 'garage', frame: 'trim-black', leaf: 'garage-door', open: false, name: 'Garage door A' });
  opening(gr_front, 'door', 92, 8, 7, 0, { style: 'garage', frame: 'trim-black', leaf: 'garage-door', open: false, name: 'Garage door B' });
  const gr_right = wall(L1, [98, -6], [98, 14], { ...EXT, name: 'Garage (2-car) right' });
  win(gr_right, 4, 3, 3, 4.5);
  const gr_back = wall(L1, [98, 14], [76, 14], { ...EXT, name: 'Garage (2-car) rear' });
  win(gr_back, 87, 4, 3, 4.5);
  const gr_left = wall(L1, [76, 14], [76, -6], { ...EXT, name: 'Garage (2-car) left' });
  door(gr_left, 10.4, 3, { open: false, name: 'Garage side door' });
  const gl_front = wall(L1, [-4, -6], [-20, -6], { ...EXT, name: 'Garage (1-car) front' });
  opening(gl_front, 'door', -12, 9, 7, 0, { style: 'garage', frame: 'trim-black', leaf: 'garage-door', open: false, name: 'Garage door C' });
  const gl_left = wall(L1, [-20, -6], [-20, 16], { ...EXT, name: 'Garage (1-car) left' });
  win(gl_left, 6, 3, 3, 4.5);
  wall(L1, [-20, 16], [-4, 16], { ...EXT, name: 'Garage (1-car) rear' });
  const gl_right = wall(L1, [-4, 16], [-4, -6], { ...EXT, name: 'Garage (1-car) right' });
  door(gl_right, 12, 3, { open: false, name: 'Garage side door' });

  // ---------------- L1 rails (porch, decks, breezeway)
  wall(L1, [30, -12], [30, -1], { kind: 'rail', h: 1.0, name: 'Porch rail W' });
  wall(L1, [51, -12], [51, -1], { kind: 'rail', h: 1.0, name: 'Porch rail E' });
  wall(L1, [28, 34], [28, 44], { kind: 'rail', h: 1.0, name: 'Deck rail W' });
  wall(L1, [28, 44], [70, 44], { kind: 'rail', h: 1.0, name: 'Deck rail rear' });
  wall(L1, [70, 44], [70, 34], { kind: 'rail', h: 1.0, name: 'Deck rail E' });
  wall(L1, [70, 5], [76, 5], { kind: 'rail', h: 1.0, name: 'Breezeway rail S' });
  wall(L1, [70, 16], [76, 16], { kind: 'rail', h: 1.0, name: 'Breezeway rail N' });

  // ---------------- L2 exterior
  const u_front = wall(L2, [22, 0], [70, 0], { ...EXT, name: 'Upper front wall' });
  win(u_front, 26.5, 3.5, 4, 3);
  win(u_front, 35, 4, 7, 1.5, { style: 'fixed', cols: 2, rows: 3, name: 'Loft window L' });
  win(u_front, 40.5, 4, 7, 1.5, { style: 'fixed', cols: 2, rows: 3, name: 'Loft window C' });
  win(u_front, 46, 4, 7, 1.5, { style: 'fixed', cols: 2, rows: 3, name: 'Loft window R' });
  win(u_front, 55, 3, 4.5, 2.5, { style: 'fixed' });
  win(u_front, 65, 3, 3.5, 3);
  const u_right = wall(L2, [70, 0], [70, 34], { ...EXT, name: 'Upper right wall' });
  win(u_right, 4, 3, 3.5, 3);
  win(u_right, 16, 4, 4.5, 2.5);
  win(u_right, 29, 4, 4.5, 2.5);
  const u_back_e = wall(L2, [70, 34], [50, 34], { ...EXT, name: 'Upper rear wall' });
  win(u_back_e, 62, 4, 4.5, 2.5);
  win(u_back_e, 52, 2.5, 4.5, 2.5);
  wall(L2, [31, 34], [22, 34], { ...EXT, name: 'Upper rear wall (linen)' });
  const u_left = wall(L2, [22, 34], [22, 0], { ...EXT, name: 'Upper left wall' });
  win(u_left, 23, 2, 2.5, 4);
  win(u_left, 8, 3.5, 4.5, 2.5);
  // ---------------- L2 interior
  const u_gw = wall(L2, [31, 0], [31, 13]);
  door(u_gw, 10, 3);
  const u_gb = wall(L2, [22, 18], [31, 18]);
  door(u_gb, 26.5, 2.8);
  const u_gl = wall(L2, [22, 28], [31, 28]);
  door(u_gl, 28.2, 2.5);
  const u_core_n = wall(L2, [50, 7.8], [70, 7.8]);
  door(u_core_n, 65, 2.8);
  wall(L2, [60.2, 0], [60.2, 7.8]);
  const u_k1 = wall(L2, [54, 11.3], [70, 11.3]);
  door(u_k1, 58, 3);
  const u_kw = wall(L2, [54, 11.3], [54, 34]);
  door(u_kw, 27, 3);
  const u_jn = wall(L2, [54, 20.3], [70, 20.3]);
  door(u_jn, 62, 2.8);
  const u_js = wall(L2, [54, 25.3], [70, 25.3]);
  door(u_js, 57, 2.8);
  // ---------------- L2 guard rails
  wall(L2, [31, 13], [50, 13], { kind: 'rail', h: 1.07, name: 'Loft rail' });
  wall(L2, [50, 13], [50, 34], { kind: 'rail', h: 1.07, name: 'Gallery rail' });
  wall(L2, [50, 0.5], [50, 3.8], { kind: 'rail', h: 1.07, name: 'Stair opening rail' });

  // ================================================================== WALL FINISHES (from the room on each side)
  const roomsAt = (levelId: Id, p: Vec2): Room | undefined => {
    let best: Room | undefined;
    let bestArea = Infinity;
    for (const r of Object.values(rooms)) {
      if (r.levelId !== levelId) continue;
      if (!pointInPolygon(p, r.outline)) continue;
      const a = polygonArea(r.outline);
      if (a < bestArea) {
        best = r;
        bestArea = a;
      }
    }
    return best;
  };
  for (const w of Object.values(walls)) {
    if (w.kind === 'rail') {
      w.finishA = 'timber-dark';
      w.finishB = 'timber-dark';
      continue;
    }
    const { nx, nz } = wallVec(w);
    const mx = (w.start.x + w.end.x) / 2;
    const mz = (w.start.z + w.end.z) / 2;
    const off = w.thickness / 2 + 0.25;
    const outside = w.levelId === 'L0' ? 'stone-dark' : 'siding-black';
    const sideFinish = (sgn: number): Id => {
      const rm = roomsAt(w.levelId, { x: mx + nx * off * sgn, z: mz + nz * off * sgn });
      return rm ? roomPaint[rm.id] : outside;
    };
    w.finishA = sideFinish(1);
    w.finishB = sideFinish(-1);
    if (w.kind === 'exterior') {
      if (w.finishA !== outside && w.finishB !== outside) {
        // both sides inside rooms (should not happen for exterior walls) - keep as is
      }
    }
  }

  // ================================================================== ROOFS
  const baseRoof = {
    thickness: 0.16,
    shedHigh: 1 as 1 | -1,
    materialId: 'roof-shingle',
    gableMaterialId: 'siding-black',
    gableEnds: true,
    baseOffset: 0,
    pitch: 8 / 12,
    eaveOverhang: 0.5,
    rakeOverhang: 0.45,
  };
  const roofAt = (id: string, name: string, levelId: Id, uc: number, vc: number, wUft: number, dVft: number, ridgeAxis: 'x' | 'z', o: Partial<Roof> = {}) => {
    roofs[id] = {
      ...baseRoof,
      id,
      name,
      levelId,
      kind: 'gable',
      center: P(uc, vc),
      size: { x: wUft * FT, z: dVft * FT },
      ridgeAxis,
      ...o,
    } as Roof;
  };
  roofAt('roof-main', 'Main gable roof', 'L2', 46, 17, 48, 34, 'x', { rakeOverhang: 0.6 });
  roofAt('roof-cross', 'Front cross-gable', 'L2', 40.5, 8, 19, 16, 'z', { rakeOverhang: 0.5 });
  roofAt('roof-wing', 'Primary wing roof', 'L1', 11, 19, 22, 22, 'z');
  roofAt('roof-gar-r', 'Garage roof (2-car)', 'L1', 87, 4, 22, 20, 'z');
  roofAt('roof-gar-l', 'Garage roof (1-car)', 'L1', -12, 5, 16, 22, 'z');
  roofAt('roof-porch', 'Front porch roof (standing seam)', 'L1', 40.5, -6, 21, 12, 'x', {
    kind: 'shed',
    pitch: 0.2,
    baseOffset: 0.2,
    materialId: 'roof-seam',
    gableEnds: false,
    shedHigh: 1,
    eaveOverhang: 0.3,
    rakeOverhang: 0.3,
    thickness: 0.12,
  });
  roofAt('roof-deck', 'Rear deck roof (standing seam)', 'L1', 49, 39, 42, 10, 'x', {
    kind: 'shed',
    pitch: 0.2,
    baseOffset: 0.2,
    materialId: 'roof-seam',
    gableEnds: false,
    shedHigh: -1,
    eaveOverhang: 0.3,
    rakeOverhang: 0.3,
    thickness: 0.12,
  });
  roofAt('roof-breeze', 'Breezeway roof (standing seam)', 'L1', 73, 10.5, 6, 11, 'z', {
    kind: 'shed',
    pitch: 0.2,
    baseOffset: 0.0,
    materialId: 'roof-seam',
    gableEnds: false,
    shedHigh: 1,
    eaveOverhang: 0.05,
    rakeOverhang: 0.3,
    thickness: 0.12,
  });

  // ================================================================== FURNITURE
  // ---- porch & structure
  for (const [u, v] of [[30.6, -11.4], [50.4, -11.4]] as [number, number][]) FM(L1, 'post', u, v, 'N', 2.2, { elev: -0.04, w: 0.7, d: 0.7 });
  for (const u of [29, 40, 51, 62, 69.4]) FM(L1, 'post', u, 43.4, 'N', 2.4, { elev: -0.04, w: 0.7, d: 0.7 });
  FM(L1, 'chimney', 40.5, 35.6, 'N', 9.8, { elev: 0 });
  // porch
  F(L1, 'bench', 35, -8, 'S', { name: 'Porch bench', mat: { primary: 'timber-dark' } });
  F(L1, 'plant', 47.5, -9, 'N', { name: 'Porch planter' });
  F(L1, 'plant', 33, -3.5, 'N');

  // ---- L1 entry
  F(L1, 'wardrobe', 48.8, 10.4, 'W', { name: 'Coat closet' });
  F(L1, 'bench', 34.6, 1.4, 'N', { name: 'Entry bench' });
  F(L1, 'rug', 40.5, 6, 'N', { w: 4.5, d: 9, name: 'Entry runner' });
  F(L1, 'side-table', 46.8, 1.3, 'N');
  F(L1, 'table-lamp', 46.8, 1.3, 'N', { elev: 0.61 });
  F(L1, 'wall-art', 36, 12.8, 'N', { w: 3, h: 2.5, elev: 1.3, name: 'Foyer art' });
  // powder room
  F(L1, 'toilet', 23.5, 3.7, 'E');
  F(L1, 'vanity', 28, 7.0, 'S');
  F(L1, 'mirror', 28, 7.9, 'S', { elev: 1.1 });
  // hall + flex office / guest
  F(L1, 'plant', 23, 19.5, 'N');
  F(L1, 'desk', 26.5, 32.7, 'S', { name: 'Office desk' });
  F(L1, 'office-chair', 26.5, 30.6, 'N');
  F(L1, 'sofa', 23.9, 25.5, 'E', { w: 5.5, name: 'Guest loveseat' });
  F(L1, 'bookshelf', 30.3, 26.5, 'W');
  F(L1, 'floor-lamp', 29.5, 22.6, 'N');
  // ---- great room
  F(L1, 'fireplace', 40.5, 33.2, 'S');
  F(L1, 'sectional', 40.5, 20.4, 'N', { mat: { primary: 'fabric-charcoal' } });
  F(L1, 'coffee-table', 40.5, 25.2, 'N');
  F(L1, 'armchair', 33.8, 26.4, 'E', { mat: { primary: 'leather-cognac' } });
  F(L1, 'armchair', 47.2, 26.4, 'W', { mat: { primary: 'leather-cognac' } });
  F(L1, 'rug', 40.5, 24, 'N', { w: 12, d: 9.5, name: 'Great room rug' });
  F(L1, 'floor-lamp', 49, 16, 'N');
  F(L1, 'floor-lamp', 32.2, 22, 'N');
  F(L1, 'plant', 32.6, 31, 'N');
  F(L1, 'plant', 48.4, 31.6, 'N');
  FM(L1, 'chandelier', 40.5, 22.5, 'N', 2.4, { w: 4.5, d: 4.5, elev: 3.35, name: 'Timber chandelier' });
  F(L1, 'wall-art', 31.15, 24, 'E', { w: 4, h: 3, elev: 1.5, name: 'Great room art' });
  // ---- kitchen
  F(L1, 'refrigerator', 68.6, 14.9, 'W');
  F(L1, 'base-cabinet', 68.9, 17.3, 'W', { w: 2.3 });
  F(L1, 'sink', 68.9, 20.0, 'W');
  F(L1, 'dishwasher', 68.9, 22.6, 'W');
  F(L1, 'base-cabinet', 55.7, 14.3, 'S', { w: 2.4 });
  F(L1, 'range', 58.6, 14.3, 'S');
  F(L1, 'base-cabinet', 61.2, 14.3, 'S', { w: 2.0 });
  F(L1, 'wall-cabinet', 55.8, 13.6, 'S', { w: 2.4, elev: 1.5 });
  F(L1, 'wall-cabinet', 61.0, 13.6, 'S', { w: 2.2, elev: 1.5 });
  F(L1, 'island', 60, 19.8, 'N', { name: 'Kitchen island' });
  for (const u of [57.4, 60, 62.6]) F(L1, 'bar-stool', u, 22.9, 'S');
  FM(L1, 'pendant', 57.8, 19.8, 'N', 0.95, { elev: 1.78 });
  FM(L1, 'pendant', 62.2, 19.8, 'N', 0.95, { elev: 1.78 });
  F(L1, 'rug', 59.5, 21.6, 'N', { w: 8, d: 3.2, name: 'Kitchen runner' });
  // ---- dining
  F(L1, 'dining-table', 60, 29.5, 'N');
  for (const u of [57.8, 60, 62.2]) {
    F(L1, 'dining-chair', u, 27.3, 'S');
    F(L1, 'dining-chair', u, 31.7, 'N');
  }
  F(L1, 'dining-chair', 56, 29.5, 'E');
  F(L1, 'dining-chair', 64, 29.5, 'W');
  F(L1, 'rug', 60, 29.5, 'N', { w: 9.5, d: 7, name: 'Dining rug' });
  F(L1, 'sideboard', 69, 29, 'W');
  FM(L1, 'chandelier', 60, 29.5, 'N', 0.95, { w: 3.6, d: 3.6, elev: 1.75, name: 'Dining chandelier' });
  // ---- pantry, mudroom, pocket office
  F(L1, 'shelving', 50.9, 10.4, 'E', { name: 'Pantry shelving' });
  F(L1, 'shelving', 55.1, 10.4, 'W', { name: 'Pantry shelving' });
  F(L1, 'wardrobe', 57.1, 9.9, 'E', { name: 'Mudroom lockers' });
  F(L1, 'bench', 66.5, 12.0, 'S', { w: 3.5, name: 'Mudroom bench' });
  F(L1, 'desk', 65, 1.4, 'N', { name: 'Pocket office desk' });
  F(L1, 'office-chair', 65, 3.7, 'S');
  F(L1, 'bookshelf', 69.2, 4.8, 'W');
  // ---- primary suite
  F(L1, 'bench', 15, 9.4, 'N', { name: 'Hall bench' });
  F(L1, 'plant', 20.5, 9.2, 'N');
  F(L1, 'bed-king', 18.6, 22, 'W', { name: 'Primary bed' });
  F(L1, 'nightstand', 21.0, 17.6, 'W');
  F(L1, 'nightstand', 21.0, 26.4, 'W');
  F(L1, 'table-lamp', 21.0, 17.6, 'W', { elev: 0.61 });
  F(L1, 'table-lamp', 21.0, 26.4, 'W', { elev: 0.61 });
  F(L1, 'dresser', 9.1, 18.2, 'E');
  F(L1, 'bench', 13.0, 22, 'W', { w: 4.5, name: 'Bed bench' });
  F(L1, 'rug', 15.5, 22, 'W', { w: 10, d: 9, name: 'Primary rug' });
  F(L1, 'armchair', 10.8, 27.8, 'N');
  F(L1, 'floor-lamp', 10.2, 29.2, 'N');
  F(L1, 'bathtub', 2.1, 14.6, 'E');
  F(L1, 'vanity-double', 4, 9.1, 'N');
  F(L1, 'mirror', 4, 8.1, 'N', { w: 5, elev: 1.1 });
  F(L1, 'toilet', 6.2, 18.7, 'S');
  F(L1, 'shower', 6.0, 14.0, 'W');
  F(L1, 'shelving', 0.9, 25, 'E', { name: 'Closet shelving' });
  F(L1, 'dresser', 4, 29.1, 'S', { name: 'Closet dresser' });
  F(L1, 'wardrobe', 7.0, 22.5, 'W', { name: 'Hanging rail' });
  // ---- garages
  F(L1, 'workbench', 87, 13.0, 'S');
  F(L1, 'shelving', 96.9, 5, 'W');
  F(L1, 'shelving', 96.9, 10, 'W');
  F(L1, 'storage-bin', 78, 13.2, 'S');
  F(L1, 'storage-bin', 80.5, 13.2, 'S');
  F(L1, 'shelving', -19, 6, 'E');
  F(L1, 'storage-bin', -5.2, 3, 'W');

  // ---- L0 basement
  F(L0, 'screen', 22.4, 7, 'E', { name: 'Projection screen' });
  F(L0, 'platform', 36.6, 7, 'W', { w: 12, d: 5, name: 'Seating platform' });
  for (const v of [3.6, 7, 10.4]) {
    F(L0, 'theater-seat', 29.5, v, 'W');
    F(L0, 'theater-seat', 36.6, v, 'W', { elev: 0.4 });
  }
  F(L0, 'rug', 29.5, 7, 'W', { w: 12, d: 6, mat: { primary: 'fabric-charcoal' }, name: 'Theater carpet' });
  F(L0, 'pool-table', 40.5, 21, 'N');
  F(L0, 'island', 38.5, 30.4, 'S', { name: 'Bar' });
  for (const u of [35.5, 38.5, 41.5]) F(L0, 'bar-stool', u, 27.8, 'N');
  F(L0, 'wall-cabinet', 38.5, 33.6, 'S', { w: 6, elev: 1.5 });
  F(L0, 'sofa', 32.5, 24, 'E', { w: 7 });
  F(L0, 'floor-lamp', 32.6, 18, 'N');
  FM(L0, 'pendant', 40.5, 21, 'N', 0.95, { elev: 1.78, name: 'Pool light' });
  F(L0, 'plant', 48.5, 12, 'N');
  F(L0, 'plant', 48.5, 32.6, 'N');
  F(L0, 'toilet', 23.4, 19.4, 'E');
  F(L0, 'vanity', 27, 21.1, 'S');
  F(L0, 'shower', 24.0, 15.8, 'E');
  F(L0, 'bed', 25.6, 28.5, 'E', { name: 'Basement bed 1' });
  F(L0, 'nightstand', 22.9, 24.7, 'E');
  F(L0, 'dresser', 27.5, 23.1, 'S', { w: 4 });
  F(L0, 'tv-console', 69, 19.5, 'W');
  F(L0, 'sofa', 62.3, 19.5, 'E', { w: 7 });
  F(L0, 'coffee-table', 66, 19.5, 'E');
  F(L0, 'rug', 65, 19.5, 'E', { w: 8, d: 10 });
  F(L0, 'armchair', 54, 22.5, 'N');
  F(L0, 'bookshelf', 52.5, 15.8, 'S');
  F(L0, 'floor-lamp', 51.6, 24.2, 'N');
  F(L0, 'bed', 66.5, 29, 'W', { name: 'Basement bed 2', mat: { primary: 'fabric-navy' } });
  F(L0, 'nightstand', 69, 25.3, 'W');
  F(L0, 'shelving', 52, 9.5, 'N', { name: 'Utility shelving' });
  F(L0, 'storage-bin', 66, 8.9, 'S', { name: 'Water heater cabinet' });
  F(L0, 'shelving', 69, 3.5, 'W');
  F(L0, 'shelving', 62, 0.9, 'N');

  // ---- L2 upper
  F(L2, 'sectional', 40.5, 9, 'S', { name: 'Loft sectional', mat: { primary: 'fabric-rust' } });
  F(L2, 'coffee-table', 40.5, 6, 'S');
  F(L2, 'armchair', 34, 4.2, 'E');
  F(L2, 'armchair', 47, 4.2, 'W');
  F(L2, 'rug', 40.5, 6.5, 'S', { w: 11, d: 8 });
  F(L2, 'floor-lamp', 33, 11.7, 'S');
  F(L2, 'plant', 48.7, 11.7, 'S');
  F(L2, 'bookshelf', 31.8, 11.2, 'E');
  F(L2, 'bench', 52, 31, 'E', { w: 3.5 });
  F(L2, 'plant', 52, 9.5, 'S');
  // guest suite
  F(L2, 'bed', 25.6, 4.5, 'E', { name: 'Guest bed' });
  F(L2, 'nightstand', 22.9, 1.2, 'E');
  F(L2, 'nightstand', 22.9, 7.9, 'E');
  F(L2, 'wardrobe', 29.9, 3.2, 'W');
  F(L2, 'bench', 26.5, 13, 'S', { w: 4 });
  F(L2, 'toilet', 23.4, 20.6, 'E');
  F(L2, 'vanity', 30.0, 22.5, 'W');
  F(L2, 'shower', 24.1, 26.1, 'E');
  F(L2, 'shelving', 22.9, 31, 'E', { name: 'Linen shelving' });
  F(L2, 'shelving', 28.5, 33.2, 'S', { name: 'Linen shelving' });
  // laundry with folding island
  F(L2, 'washer', 68.8, 2.3, 'W', { name: 'Washer' });
  F(L2, 'dryer', 68.8, 5.1, 'W', { name: 'Dryer' });
  F(L2, 'base-cabinet', 63.5, 4.0, 'E', { w: 4.5, d: 2.5, name: 'Folding island' });
  F(L2, 'sink', 62.0, 1.1, 'N', { name: 'Laundry sink' });
  F(L2, 'wall-cabinet', 61.2, 0.6, 'N', { w: 2, elev: 1.5, name: 'Linen cabinet' });
  // kids
  F(L2, 'bed-twin', 66.6, 15.5, 'W', { name: "Kid's bed 1", mat: { primary: 'fabric-navy' } });
  F(L2, 'desk', 55.2, 15.3, 'E', { w: 4 });
  F(L2, 'office-chair', 57.2, 15.3, 'W');
  F(L2, 'dresser', 63, 12.4, 'N', { w: 4 });
  F(L2, 'rug', 62.5, 16.5, 'N', { w: 6, d: 8 });
  F(L2, 'bed-twin', 66.6, 29.8, 'W', { name: "Kid's bed 2", mat: { primary: 'fabric-olive' } });
  F(L2, 'desk', 60, 32.6, 'S', { w: 4.5 });
  F(L2, 'office-chair', 60, 30.5, 'N');
  F(L2, 'dresser', 56.5, 27.2, 'N', { w: 3.5 });
  F(L2, 'rug', 62.5, 29, 'N', { w: 6, d: 8 });
  F(L2, 'vanity-double', 62, 24.4, 'N');
  F(L2, 'toilet', 54.9, 23, 'E');
  F(L2, 'shower', 68.3, 22.2, 'N', { w: 3, d: 3 });

  // ---- landscaping (heights follow the terrain)
  const plant = (cat: string, u: number, v: number, extra: FOpts = {}) => F(L1, cat, u, v, 'N', { elev: groundElevOn('L1', v), ...extra });
  plant('tree-conifer', -32, -26);
  plant('tree-conifer', -36, 4, { w: 17, d: 17, h: 34 });
  plant('tree-oak', 112, -30);
  plant('tree-oak', 118, 14);
  plant('tree-conifer', 108, 48, { w: 18, d: 18, h: 36 });
  plant('tree-oak', -18, 40);
  plant('tree-conifer', 18, 62);
  plant('tree-conifer', 52, 64, { w: 10, d: 10, h: 40 });
  plant('tree-oak', 86, 60);
  for (const u of [3, 8, 13, 18]) plant('shrub', u, 5.5, { name: 'Boxwood' });
  for (const u of [24, 58, 63, 68]) plant('shrub', u, -2.4);
  plant('shrub', 28, -4);
  plant('shrub', 53, -4);
  plant('planter', 33.5, -17.5, { w: 5, d: 1.5, name: 'Entry planter' });
  plant('shrub', 33, -20);
  plant('shrub', 48, -20);

  const project: Project = {
    id: 'starter-modern-farmhouse',
    name: 'Modern Farmhouse (starter)',
    levelOrder: ['L0', 'L1', 'L2'],
    levels,
    walls,
    openings,
    slabs,
    rooms,
    stairs,
    roofs,
    furniture,
    materials: buildMaterialRecord(),
    site,
    view: { ...DEFAULT_VIEW },
  };
  applyExteriorStyle(project, 'limestone');
  return project;
}
