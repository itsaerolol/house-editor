import { Environment, Lightformer } from '@react-three/drei';
import { Canvas, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as THREE from 'three';
import { CATALOG_BY_ID } from '../model/catalog';
import { buildMaterialRecord } from '../model/materials';
import type { FurnitureInstance } from '../model/types';
import { getFurnitureGeometry, slotMaterialId } from '../render/furnitureGeometry';
import { getFurnitureMaterial } from '../render/materials';
import { triCount } from '../render/partGeometry';
import { buildRailDetailed, buildStairDetailed } from '../render/stairs';
import type { Built } from '../render/builders';
import type { Level, Stair, Wall } from '../model/types';

/** Special previews: ?special=stair | rail */
function specialBuilt(kind: string): Built | null {
  const levels: Record<string, Level> = {
    A: { id: 'A', name: 'A', elevation: 0, ceilingHeight: 2.74, slabThickness: 0.3 },
    B: { id: 'B', name: 'B', elevation: 3.05, ceilingHeight: 2.74, slabThickness: 0.3 },
  };
  if (kind.startsWith('mat:')) {
    const id = kind.slice(4);
    const g1 = new THREE.BoxGeometry(0.9, 0.04, 0.9, 1, 1, 1);
    g1.translate(0, 0.02, 0);
    const g2 = new THREE.SphereGeometry(0.22, 48, 32);
    g2.translate(0.12, 0.26, 0.1);
    const g3 = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    g3.translate(-0.22, 0.19, -0.2);
    const all = [g1, g2, g3].map((g) => {
      const pos = g.getAttribute('position');
      const nor = g.getAttribute('normal');
      const uv = new Float32Array(pos.count * 2);
      for (let i = 0; i < pos.count; i++) {
        const ay = Math.abs(nor.getY(i));
        const ax = Math.abs(nor.getX(i));
        if (ay > 0.5) { uv[i * 2] = pos.getX(i); uv[i * 2 + 1] = pos.getZ(i); }
        else if (ax > 0.5) { uv[i * 2] = pos.getZ(i); uv[i * 2 + 1] = pos.getY(i); }
        else { uv[i * 2] = pos.getX(i); uv[i * 2 + 1] = pos.getY(i); }
      }
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      const col = new Float32Array(pos.count * 3).fill(1);
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return g;
    });
    const geometry = mergeGeometries(all, false)!;
    geometry.addGroup(0, geometry.index ? geometry.index.count : geometry.getAttribute('position').count, 0);
    return { geometry, materialIds: [id], vc: true };
  }
  if (kind === 'stair') {
    const st: Stair = { id: 's', levelIds: ['A', 'B'], origin: { x: 1.1, z: -1.07 }, dir: { x: -1, z: 0 }, side: { x: 0, z: 1 }, laneWidth: 1, gap: 0.15, treadDepth: 0.28, landingDepth: 1.1, risersPerFlight: 9, materialId: 'oak-natural' };
    return buildStairDetailed(st, levels, quality);
  }
  const w = { id: 'w', levelId: 'A', start: { x: -1.8, z: 0 }, end: { x: 1.8, z: 0 }, thickness: 0.1, kind: 'rail', heightMode: 'custom', height: 1.0, finishA: 'timber-dark', finishB: 'timber-dark', capMaterialId: 'timber-dark' } as unknown as Wall;
  return buildRailDetailed(w, levels.A, levels, quality);
}

/**
 * Studio preview for one or more catalog items (dev only).
 *   ?item=sofa                  four angles of one item
 *   ?items=sofa,armchair        hero angle of several items
 *   &q=2  &w= &d= &h= (m)       quality and size overrides
 *   &ov=primary:fabric-rust     material overrides
 *   &views=hero,front,side,top  pick angles
 */
const qs = new URLSearchParams(location.search);
const MATS = buildMaterialRecord();
const quality = Number(qs.get('q') ?? 2);
const THUMB = qs.get('thumb') === '1';
const W = Number(qs.get('cw') ?? 0);

type View = 'hero' | 'front' | 'side' | 'top' | 'back' | 'low' | 'close' | 'eye' | 'under';
const VIEW_DIR: Record<View, [number, number, number]> = {
  hero: [-0.62, 0.42, 0.95],
  front: [0, 0.12, 1],
  side: [1, 0.15, 0.02],
  top: [0.35, 1.25, 0.6],
  back: [0.7, 0.35, -1],
  low: [-0.8, 0.05, 0.75],
  close: [-0.45, 0.3, 0.9],
  eye: [-0.5, 0.2, 1],
  under: [-0.4, -0.55, 1],
};

function instanceFor(id: string): FurnitureInstance | null {
  const it = CATALOG_BY_ID[id];
  if (!it) return null;
  const ov: Record<string, string> = {};
  for (const pair of (qs.get('ov') ?? '').split(',').filter(Boolean)) {
    const [k, v] = pair.split(':');
    ov[k] = v;
  }
  return {
    id: 'preview',
    name: it.name,
    catalogId: id,
    levelId: 'L',
    position: { x: 0, z: 0 },
    elevation: 0,
    rotationY: 0,
    size: { w: Number(qs.get('w') ?? it.size.w), d: Number(qs.get('d') ?? it.size.d), h: Number(qs.get('h') ?? it.size.h) },
    materialOverrides: ov,
  };
}

let pending = 0;
function Item({ inst, view, zoom }: { inst: FurnitureInstance; view: View; zoom: number }) {
  const geo = useMemo(() => getFurnitureGeometry(inst.catalogId, inst.size.w, inst.size.d, inst.size.h, quality), [inst]);
  const mats = useMemo(() => (geo ? geo.slots.map((s) => getFurnitureMaterial(MATS[slotMaterialId(inst, s)] ?? MATS['paint-cream'])) : []), [geo, inst]);
  const { camera, invalidate } = useThree();
  useEffect(() => {
    if (!geo) return;
    const box = geo.bbox;
    const c = box.getCenter(new THREE.Vector3());
    const r = box.getSize(new THREE.Vector3()).length() / 2;
    const dir = new THREE.Vector3(...VIEW_DIR[view]).normalize();
    const cam = camera as THREE.PerspectiveCamera;
    const vh = THREE.MathUtils.degToRad(cam.fov / 2);
    const hh = Math.atan(Math.tan(vh) * cam.aspect);
    const dist = (r / Math.sin(Math.min(vh, hh))) * (view === 'close' ? 0.55 : 1.02) / zoom;
    cam.position.copy(c).addScaledVector(dir, dist);
    cam.near = dist / 50;
    cam.far = dist * 20;
    const fy = qs.get('fy');
    const fx = qs.get('fx');
    const tgt = c.clone();
    if (fy) tgt.y = box.min.y + (box.max.y - box.min.y) * Number(fy);
    else if (view === 'close') tgt.y += r * 0.25;
    if (fx) tgt.x = box.min.x + (box.max.x - box.min.x) * Number(fx);
    if (fy || fx) cam.position.copy(tgt).addScaledVector(dir, dist);
    cam.lookAt(tgt);
    cam.updateProjectionMatrix();
    invalidate();
    pending--;
    if (pending <= 0) setTimeout(() => ((window as unknown as { __ready: boolean }).__ready = true), 400);
  }, [geo, view, camera, invalidate, zoom]);
  if (!geo) return null;
  const size = geo.bbox.getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.z, size.y) * 14;
  const top = geo.bbox.max.y;
  return (
    <>
      <mesh geometry={geo.geometry} material={mats} castShadow receiveShadow />
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.0005, 0]} receiveShadow>
        <planeGeometry args={[span, span]} />
        {THUMB ? <shadowMaterial opacity={0.28} /> : <meshStandardMaterial color="#e3dfd7" roughness={0.95} />}
      </mesh>
      <directionalLight
        position={[-span * 0.3, top * 2 + span * 0.35, span * 0.3]}
        intensity={2.2}
        color="#fff4e6"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-span / 2}
        shadow-camera-right={span / 2}
        shadow-camera-top={span / 2}
        shadow-camera-bottom={-span / 2}
        shadow-camera-far={span * 3}
        shadow-radius={4}
      />
    </>
  );
}

function Special({ kind, view, zoom }: { kind: string; view: View; zoom: number }) {
  const built = useMemo(() => specialBuilt(kind), [kind]);
  const { camera, invalidate } = useThree();
  const mats = useMemo(() => (built ? built.materialIds.map((m) => getFurnitureMaterial(MATS[m] ?? MATS['paint-cream'])) : []), [built]);
  useEffect(() => {
    if (!built) return;
    built.geometry.computeBoundingBox();
    const box = built.geometry.boundingBox!;
    const c = box.getCenter(new THREE.Vector3());
    const r = box.getSize(new THREE.Vector3()).length() / 2;
    const dir = new THREE.Vector3(...VIEW_DIR[view]).normalize();
    const cam = camera as THREE.PerspectiveCamera;
    const dist = (r / Math.sin(THREE.MathUtils.degToRad(cam.fov / 2))) / zoom;
    cam.position.copy(c).addScaledVector(dir, dist);
    cam.lookAt(c);
    cam.near = dist / 50;
    cam.far = dist * 20;
    cam.updateProjectionMatrix();
    invalidate();
    setTimeout(() => ((window as unknown as { __ready: boolean }).__ready = true), 2500);
  }, [built, camera, invalidate, view, zoom]);
  if (!built) return null;
  return (
    <>
      <mesh geometry={built.geometry} material={mats} castShadow receiveShadow />
      <directionalLight position={[-4, 8, 5]} intensity={2.2} castShadow shadow-bias={-0.0005} shadow-normalBias={0.02} shadow-mapSize={[2048, 2048]} shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={6} shadow-camera-bottom={-6} />
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#e3dfd7" />
      </mesh>
    </>
  );
}

function Cell({ id, view, w, h, zoom }: { id: string; view: View; w: number; h: number; zoom: number }) {
  const special = id.startsWith('special:') ? id.slice(8) : null;
  const inst = useMemo(() => (special ? null : instanceFor(id)), [id, special]);
  const geo = inst ? getFurnitureGeometry(inst.catalogId, inst.size.w, inst.size.d, inst.size.h, quality) : null;
  return (
    <div className="cell" style={{ width: w, height: h }}>
      <Canvas
        shadows="soft"
        dpr={1}
        frameloop="demand"
        camera={{ fov: 28, position: [3, 2, 3] }}
        gl={{ antialias: true, alpha: THUMB, preserveDrawingBuffer: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      >
        {!THUMB && <color attach="background" args={['#ebe8e2']} />}
        <hemisphereLight args={['#fdf8f0', '#b9b2a6', 0.7]} />
        <directionalLight position={[4, 3, -3]} intensity={0.6} color="#dfe6f5" />
        <Environment resolution={128} frames={1} background={false}>
          <Lightformer form="rect" intensity={2} position={[0, 5, 6]} scale={[10, 5, 1]} color="#fff3e2" />
          <Lightformer form="rect" intensity={1} position={[-6, 3, 0]} rotation-y={Math.PI / 2} scale={[8, 4, 1]} color="#ffe6c8" />
          <Lightformer form="rect" intensity={0.8} position={[6, 3, 0]} rotation-y={-Math.PI / 2} scale={[8, 4, 1]} color="#dfe8ff" />
          <Lightformer form="ring" intensity={1.4} position={[0, 8, 0]} rotation-x={Math.PI / 2} scale={6} color="#ffffff" />
        </Environment>
        {inst && <Item inst={inst} view={view} zoom={zoom} />}
        {special && <Special kind={special} view={view} zoom={zoom} />}
      </Canvas>
      {!THUMB && (
        <div className="lab">
          {inst?.name ?? id} · {view}
        </div>
      )}
      {geo && !THUMB && (
        <div className="sub">
          {Math.round(triCount(geo.geometry)).toLocaleString()} tris · {inst!.size.w.toFixed(2)} × {inst!.size.d.toFixed(2)} × {inst!.size.h.toFixed(2)} m · q{quality}
        </div>
      )}
    </div>
  );
}

function App() {
  const one = qs.get('item');
  const many = qs.get('items');
  const zoom = Number(qs.get('zoom') ?? 1);
  const cells: { id: string; view: View }[] = [];
  if (one) {
    const views = (qs.get('views') ?? 'hero,front,side,top').split(',') as View[];
    for (const v of views) cells.push({ id: one, view: v });
  } else if (many) for (const id of many.split(',')) cells.push({ id, view: (qs.get('view') as View) ?? 'hero' });
  pending = cells.length;
  const cols = Number(qs.get('cols') ?? (cells.length <= 2 ? cells.length : cells.length <= 4 ? 2 : 3));
  const cw = W || Math.floor((window.innerWidth - 8 - (cols - 1) * 4) / cols);
  const rows = Math.ceil(cells.length / cols);
  const ch = Number(qs.get('ch') ?? Math.floor((window.innerHeight - 8 - (rows - 1) * 4) / rows));
  return (
    <div id="grid" style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, ${cw}px)`, gap: 4 }}>
      {cells.map((c, i) => (
        <Cell key={i} id={c.id} view={c.view} w={cw} h={ch} zoom={zoom} />
      ))}
    </div>
  );
}

if (qs.get('chips') === '1') {
  // build-time material chips for the UI: window.__chips = { id: dataURL }
  import('./chips').then(({ chip }) => {
    const out: Record<string, string> = {};
    for (const d of Object.values(MATS)) out[d.id] = chip(d);
    (window as unknown as { __chips: unknown }).__chips = out;
  });
} else createRoot(document.getElementById('root')!).render(<App />);
