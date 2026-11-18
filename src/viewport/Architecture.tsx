import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { wallEndsFree, wallVec } from '../model/arch';
import { pointInPoly } from '../model/physics';
import { CATALOG_BY_ID } from '../model/catalog';
import type { FurnitureInstance, Id, Level, MaterialDefinition, Opening, Project, Room, Roof, Slab, Stair, Vec2, Wall } from '../model/types';
import {
  buildOpening,
  buildRoof,
  buildRoomCeiling,
  buildRoomFloor,
  buildSlab,
  buildStair,
  buildTerrain,
  buildWall,
  CUT_ID,
  type Built,
} from '../render/builders';
import { peekFurnitureGeometry, requestFurnitureGeometry, slotMaterialId, type FurnitureGeo } from '../render/furnitureGeometry';
import { landBatched, markShadowsDirty, prepareBvh } from './renderBus';
import { peekOpeningDetailed, requestOpeningDetailed } from '../render/openings';
import { buildRailDetailed, buildStairDetailed } from '../render/stairs';
import { CUT_MATERIAL, getFloorMaterial, getThreeMaterial, getFurnitureMaterial, getRugMaterial } from '../render/materials';
import { getCatalogItemMaterialFallback } from './materialFallback';
import { computeVisibility, type Visibility } from './visibility';
import { useStore } from '../store/store';

type Mats = Record<Id, MaterialDefinition>;
const FALLBACK: MaterialDefinition = { id: '?', name: 'Missing', kind: 'paint', color: '#ff00ff', roughness: 1, metalness: 0, texture: 'none', texScale: 1 };

const GHOST = new THREE.MeshBasicMaterial({ color: '#9aa3b2', transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });

const objIds = new WeakMap<object, number>();
let objCounter = 1;
const oid = (o: object) => {
  let v = objIds.get(o);
  if (!v) objIds.set(o, (v = objCounter++));
  return v;
};

export const pickProps = (kind: string, id: Id) => ({
  userData: { entity: { kind, id } },
  ref: (m: THREE.Object3D | null) => {
    if (m) m.layers.enable(1);
  },
});

function resolveMats(built: Built, mats: Mats, floor = false, ghost = false): THREE.Material[] | THREE.Material {
  if (ghost) return GHOST;
  return built.materialIds.map((id) => {
    if (id === CUT_ID) return CUT_MATERIAL;
    const d = mats[id] ?? getCatalogItemMaterialFallback(id) ?? FALLBACK;
    return floor ? getFloorMaterial(d) : built.vc ? getFurnitureMaterial(d) : getThreeMaterial(d);
  });
}

interface BuiltMeshProps {
  built: Built | null;
  mats: Mats;
  kind?: string;
  id?: Id;
  floor?: boolean;
  ghost?: boolean;
  shadows?: boolean;
  receive?: boolean;
  visible?: boolean;
}

/** One built geometry as a mesh. Geometry is disposed when it is replaced. */
function BuiltMesh({ built, mats, kind, id, floor, ghost, shadows = true, receive = true, visible = true }: BuiltMeshProps) {
  useEffect(() => () => built?.geometry.dispose(), [built]);
  const material = useMemo(() => (built ? resolveMats(built, mats, floor, ghost) : GHOST), [built, mats, floor, ghost]);
  useEffect(() => {
    if (kind && !ghost) prepareBvh(built?.geometry);
  }, [built, kind, ghost]);
  if (!built) return null;
  const extra = kind && id && !ghost ? pickProps(kind, id) : {};
  return (
    <mesh geometry={built.geometry} material={material} castShadow={shadows && !ghost && !floor} receiveShadow={receive && !ghost} visible={visible} {...extra} />
  );
}

/* ---------------------------------------------------------------- walls */

const WallItem = memo(function WallItem({
  wall,
  ops,
  level,
  levels,
  free,
  cutY,
  mats,
  ghost,
}: {
  wall: Wall;
  ops: Opening[];
  level: Level;
  levels: Record<Id, Level>;
  free: [boolean, boolean];
  cutY?: number;
  mats: Mats;
  ghost: boolean;
}) {
  const opsKey = ops.map((o) => oid(o)).join(',');
  const built = useMemo(
    () => (wall.kind === 'rail' && !ghost ? buildRailDetailed(wall, level, levels, 2) : null) ?? buildWall(wall, ops, level, levels, free, cutY),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wall, opsKey, level, levels, free[0], free[1], cutY, ghost],
  );
  if (wall.hidden) return null;
  return <BuiltMesh built={built} mats={mats} kind="wall" id={wall.id} ghost={ghost} />;
});

const NO_ROOMS: Vec2[][] = [];
const OpeningItem = memo(function OpeningItem({ op, wall, level, mats, quality, q, rooms }: { op: Opening; wall: Wall; level: Level; mats: Mats; quality: boolean; q: number; rooms: Vec2[][] }) {
  const outside = useMemo((): 1 | -1 => {
    const v = wallVec(wall);
    const a = op.offset + op.width / 2;
    const px = wall.start.x + v.tx * a;
    const pz = wall.start.z + v.tz * a;
    // the exterior is the side whose sample point is not inside any room of this level
    const inside = (x: number, z: number) => rooms.some((r) => pointInPoly(x, z, r));
    const off = wall.thickness / 2 + 0.4;
    const plus = inside(px - v.tz * off, pz + v.tx * off);
    const minus = inside(px + v.tz * off, pz - v.tx * off);
    return plus && !minus ? -1 : !plus && minus ? 1 : -1;
  }, [op, wall, rooms]);
  // the plain frame shows at once; the detailed one is built in a worker and swaps in
  const simple = useMemo(() => buildOpening(op, wall, level), [op, wall, level]);
  const [detailed, setDetailed] = useState<Built | null>(() => peekOpeningDetailed(op, wall, level, q, outside) ?? null);
  useEffect(() => {
    let alive = true;
    const hit = peekOpeningDetailed(op, wall, level, q, outside);
    if (hit !== undefined) {
      setDetailed(hit);
      return;
    }
    setDetailed(null);
    requestOpeningDetailed(op, wall, level, q, outside).then((b) =>
      landBatched(() => {
        if (alive) setDetailed(b);
      }),
    );
    return () => {
      alive = false;
    };
  }, [op, wall, level, q, outside]);
  const built = detailed ?? simple;
  if (op.hidden || wall.hidden) return null;
  return <BuiltMesh built={built} mats={mats} kind="opening" id={op.id} shadows={quality} />;
});

/* ---------------------------------------------------------------- slabs, rooms, stairs, roofs */

const SlabItem = memo(function SlabItem({ slab, level, mats, ghost }: { slab: Slab; level: Level; mats: Mats; ghost: boolean }) {
  const built = useMemo(() => buildSlab(slab, level), [slab, level]);
  if (slab.hidden) return null;
  return <BuiltMesh built={built} mats={mats} kind="slab" id={slab.id} ghost={ghost} />;
});

const RoomItem = memo(function RoomItem({ room, level, levels, mats, ceilings }: { room: Room; level: Level; levels: Record<Id, Level>; mats: Mats; ceilings: boolean }) {
  const floor = useMemo(() => buildRoomFloor(room, level), [room, level]);
  const ceil = useMemo(() => (ceilings ? buildRoomCeiling(room, level, levels) : null), [room, level, levels, ceilings]);
  if (room.hidden) return null;
  return (
    <>
      <BuiltMesh built={floor} mats={mats} kind="room" id={room.id} floor shadows={false} />
      <BuiltMesh built={ceil} mats={mats} shadows={false} />
    </>
  );
});

const StairItem = memo(function StairItem({ stair, levels, mats, q }: { stair: Stair; levels: Record<Id, Level>; mats: Mats; q: number }) {
  const built = useMemo(() => buildStairDetailed(stair, levels, q) ?? buildStair(stair, levels), [stair, levels, q]);
  if (stair.hidden) return null;
  return <BuiltMesh built={built} mats={mats} kind="stair" id={stair.id} />;
});

const NO_WALLS: Wall[] = [];
const RoofItem = memo(function RoofItem({ roof, level, levels, walls, mats }: { roof: Roof; level: Level; levels: Record<Id, Level>; walls: Wall[]; mats: Mats }) {
  const built = useMemo(() => buildRoof(roof, level, levels, walls), [roof, level, levels, walls]);
  if (roof.hidden) return null;
  return <BuiltMesh built={built} mats={mats} kind="roof" id={roof.id} />;
});

/* ---------------------------------------------------------------- furniture */

/** Distance LOD: full tier near the camera, one lower mid-range, lowest far away. Hysteresis avoids flicker at the edges. */
function useLodQuality(enabled: boolean, x: number, y: number, z: number, quality: number): number {
  const [q, setQ] = useState(quality);
  const camera = useThree((s) => s.camera);
  const tick = useRef(0);
  const pick = (d: number, cur: number) => {
    const h = cur === quality ? 1.5 : -1.5;
    const tier = d < 16 + h ? quality : d < 34 + h ? Math.max(0, quality - 1) : 0;
    return tier;
  };
  useEffect(() => {
    if (!enabled) return setQ(quality);
    setQ(pick(camera.position.distanceTo(new THREE.Vector3(x, y, z)), quality));
  }, [enabled, quality]); // eslint-disable-line react-hooks/exhaustive-deps
  useFrame((_, dt) => {
    if (!enabled) return;
    tick.current += dt;
    if (tick.current < 0.4) return;
    tick.current = 0;
    const next = pick(camera.position.distanceTo(new THREE.Vector3(x, y, z)), q);
    if (next !== q) setQ(next);
  });
  return enabled ? q : quality;
}

/** 0 to 2.4 mm, stable per rug: two rugs overlapping at the same height never share an exact top plane. */
function rugLift(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return 0.0008 + (h % 5) * 0.0004;
}

const FurnitureItem = memo(function FurnitureItem({ f, level, mats, quality: q0 }: { f: FurnitureInstance; level: Level; mats: Mats; quality: number }) {
  const quality = useLodQuality(!!CATALOG_BY_ID[f.catalogId]?.lod, f.position.x, level.elevation + f.elevation + f.size.h / 2, f.position.z, q0);
  // built in the worker pool; the previous geometry stays up until the new one lands, so LOD swaps never blink
  const [geo, setGeo] = useState<FurnitureGeo | null>(() => peekFurnitureGeometry(f.catalogId, f.size.w, f.size.d, f.size.h, quality));
  useEffect(() => {
    let alive = true;
    const hit = peekFurnitureGeometry(f.catalogId, f.size.w, f.size.d, f.size.h, quality);
    if (hit) {
      setGeo(hit);
      markShadowsDirty();
      prepareBvh(hit.geometry);
      return;
    }
    requestFurnitureGeometry(f.catalogId, f.size.w, f.size.d, f.size.h, quality).then((g) =>
      landBatched(() => {
        if (!alive || !g) return;
        setGeo(g);
        prepareBvh(g.geometry);
      }),
    );
    return () => {
      alive = false;
    };
  }, [f.catalogId, f.size.w, f.size.d, f.size.h, quality]);
  const overrides = f.materialOverrides;
  // rugs and mats: flat floor coverings get a depth bias and a hair of lift so they never sink into the floor
  const rug = !!CATALOG_BY_ID[f.catalogId]?.flat && f.size.h <= 0.06;
  const material = useMemo(() => {
    if (!geo) return [];
    return geo.slots.map((slot) => {
      const id = slotMaterialId(f, slot);
      const d = mats[id] ?? getCatalogItemMaterialFallback(id) ?? FALLBACK;
      return rug ? getRugMaterial(d) : getFurnitureMaterial(d);
    });
  }, [geo, overrides, mats, f.catalogId, rug]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!geo || f.hidden) return null;
  const item = CATALOG_BY_ID[f.catalogId];
  return (
    <mesh
      geometry={geo.geometry}
      material={material}
      position={[f.position.x, level.elevation + f.elevation + (rug ? rugLift(f.id) : 0), f.position.z]}
      rotation={[0, f.rotationY, 0]}
      castShadow={quality > 0 && !item?.flat}
      receiveShadow
      {...pickProps('furniture', f.id)}
    />
  );
});

/* ---------------------------------------------------------------- terrain */

function Terrain({ project, mats }: { project: Project; mats: Mats }) {
  const lowest = project.levels[project.levelOrder[0]];
  const pits = useMemo(
    () => Object.values(project.slabs).filter((s) => s.levelId === lowest?.id && s.kind === 'floor').map((s) => s.outline),
    [project.slabs, lowest?.id],
  );
  // in 3D and walk the ground carries on to the horizon, so the cut-away skirt would show as a seam
  const skirt = project.view.mode !== 'persp' && project.view.mode !== 'walk' && project.view.mode !== 'iso';
  const key = [project.site, project.levels, pits].map(oid).join('|') + skirt;
  const built = useMemo(() => buildTerrain(project, 0.3, skirt), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return <BuiltMesh built={built} mats={mats} shadows={false} />;
}

/* ---------------------------------------------------------------- root */

export function Architecture() {
  const project = useStore((s) => s.hist.project);
  const vis: Visibility = useMemo(() => computeVisibility(project), [project.view, project.levelOrder, project.levels]); // eslint-disable-line react-hooks/exhaustive-deps
  const mats = project.materials;
  const q = project.view.quality;
  const qn = q === 'high' ? 2 : q === 'medium' ? 1 : 0;

  const free = useMemo(() => wallEndsFree(Object.values(project.walls)), [project.walls]);
  const roomsByLevel = useMemo(() => {
    const out: Record<Id, Vec2[][]> = {};
    for (const r of Object.values(project.rooms)) (out[r.levelId] ??= []).push(r.outline);
    return out;
  }, [project.rooms]);
  const opsByWall = useMemo(() => {
    const m: Record<Id, Opening[]> = {};
    for (const o of Object.values(project.openings)) (m[o.wallId] ??= []).push(o);
    return m;
  }, [project.openings]);
  // Stable per-wall opening arrays: reuse the previous array when its members are identical
  const stable = useMemo(() => new Map<Id, Opening[]>(), []);
  const wallsByLevel = useMemo(() => {
    const m: Record<Id, Wall[]> = {};
    for (const w of Object.values(project.walls)) (m[w.levelId] ??= []).push(w);
    return m;
  }, [project.walls]);
  const wallsOfLevel = (id: Id): Wall[] => wallsByLevel[id] ?? NO_WALLS;
  const getOps = (wid: Id): Opening[] => {
    const next = opsByWall[wid] ?? EMPTY;
    const prev = stable.get(wid);
    if (prev && prev.length === next.length && prev.every((o, i) => o === next[i])) return prev;
    stable.set(wid, next);
    return next;
  };

  const lv = (id: Id) => project.levels[id];
  const state = (id: Id) => vis.level[id] ?? 'hidden';

  return (
    <group>
      {vis.site && <Terrain project={project} mats={mats} />}
      {Object.values(project.slabs).map((s) => {
        const st = state(s.levelId);
        if (st === 'hidden' || !lv(s.levelId)) return null;
        if (vis.plan && st === 'full' && s.kind !== 'floor' && false) return null;
        return <SlabItem key={s.id} slab={s} level={lv(s.levelId)} mats={mats} ghost={st === 'ghost'} />;
      })}
      {Object.values(project.walls).map((w) => {
        const st = state(w.levelId);
        if (st === 'hidden' || !lv(w.levelId)) return null;
        const cut = vis.cutLevelId === w.levelId ? vis.cutY : undefined;
        return (
          <WallItem
            key={w.id}
            wall={w}
            ops={getOps(w.id)}
            level={lv(w.levelId)}
            levels={project.levels}
            free={free[w.id] ?? [true, true]}
            cutY={cut}
            mats={mats}
            ghost={st === 'ghost'}
          />
        );
      })}
      {Object.values(project.openings).map((o) => {
        const w = project.walls[o.wallId];
        if (!w) return null;
        const st = state(w.levelId);
        if (st !== 'full' || !lv(w.levelId)) return null;
        if (vis.cutLevelId === w.levelId && vis.cutY !== undefined && lv(w.levelId).elevation + o.sill > vis.cutY) return null;
        return <OpeningItem key={o.id} op={o} wall={w} level={lv(w.levelId)} mats={mats} quality={qn > 0} q={qn} rooms={roomsByLevel[w.levelId] ?? NO_ROOMS} />;
      })}
      {Object.values(project.rooms).map((r) => {
        if (state(r.levelId) !== 'full' || !lv(r.levelId)) return null;
        return <RoomItem key={r.id} room={r} level={lv(r.levelId)} levels={project.levels} mats={mats} ceilings={vis.ceilings && !vis.plan && vis.cutY === undefined} />;
      })}
      {Object.values(project.stairs).map((s) => {
        const visible = s.levelIds.some((id) => state(id) === 'full');
        return visible ? <StairItem key={s.id} stair={s} levels={project.levels} mats={mats} q={qn} /> : null;
      })}
      {vis.roofs && Object.values(project.roofs).map((r) => (state(r.levelId) === 'full' && lv(r.levelId) ? <RoofItem key={r.id} roof={r} level={lv(r.levelId)} levels={project.levels} walls={wallsOfLevel(r.levelId)} mats={mats} /> : null))}
      {vis.furniture &&
        Object.values(project.furniture).map((f) => {
          if (state(f.levelId) !== 'full' || !lv(f.levelId)) return null;
          if (CATALOG_BY_ID[f.catalogId]?.category === 'Site' && (vis.plan || !project.view.showSite)) return null;
          if (vis.cutLevelId === f.levelId && vis.cutY !== undefined && lv(f.levelId).elevation + f.elevation > vis.cutY) return null;
          return <FurnitureItem key={f.id} f={f} level={lv(f.levelId)} mats={mats} quality={qn} />;
        })}
    </group>
  );
}

const EMPTY: Opening[] = [];
