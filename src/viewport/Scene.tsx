import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { AdaptiveDpr, Environment, Lightformer, OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import { EffectComposer, N8AO, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useStore } from '../store/store';
import { Architecture } from './Architecture';
import { FLAT_VIEWS, fitZoom, framingBox, isoDirection } from './cameraViews';
import { FlatControls } from './FlatControls';
import { Interaction } from './Interaction';
import { Overlays } from './Overlays';
import { Walkthrough } from './Walkthrough';
import { ExportBridge } from './ExportBridge';
import { ThumbBridge } from './ThumbBridge';
import { computeVisibility } from './visibility';
import { CATALOG_BY_ID, FIXED_SLOT_MATERIAL } from '../model/catalog';
import { SkyDome } from './SkyDome';
import { ATMOSPHERES, sunDirection } from './timeOfDay';
import { getFloorMaterial, getFurnitureMaterial, getThreeMaterial, setGlowScale } from '../render/materials';
import { bindRenderer, markShadowsDirty, requestRender, takeShadowsDirty } from './renderBus';
type N8AOPostPass = { enabled: boolean };


function Lights() {
  const project = useStore((s) => s.hist.project);
  const q = project.view.quality;
  const vis = useMemo(() => computeVisibility(project), [project.view, project.levels, project.levelOrder]); // eslint-disable-line react-hooks/exhaustive-deps
  const sun = useRef<THREE.DirectionalLight>(null);
  const plan = project.view.mode === 'plan';
  const a = ATMOSPHERES[project.view.timeOfDay ?? 'day'];
  const { scene } = useThree();
  // aim the sun at the middle of the house so the shadow frustum stays on it
  const centre = useMemo(() => framingBox({ ...project, view: { ...project.view, mode: 'persp' } }).getCenter(new THREE.Vector3()), [project.walls, project.levels]); // eslint-disable-line react-hooks/exhaustive-deps
  const sunPos = useMemo(() => sunDirection(a).multiplyScalar(60).add(centre), [a, centre]);
  useEffect(() => {
    const s = sun.current;
    if (!s) return;
    s.target.position.copy(centre);
    if (!s.target.parent) scene.add(s.target);
    s.target.updateMatrixWorld();
  }, [centre, scene]);
  useEffect(() => setGlowScale(plan ? 1 : a.lampGlow, plan ? 1 : a.foliageGlow, plan ? 0 : a.windowGlow), [a, plan]);
  const rooms = useMemo(() => {
    // after dark the house needs its lights even on low quality
    const dark = a.interior > 1;
    const max = plan ? 0 : q === 'high' ? 14 : q === 'medium' ? (dark ? 10 : 6) : dark ? 5 : 0;
    const wanted = ['living', 'kitchen', 'dining', 'foyer', 'bedroom', 'loft', 'rec', 'theater', 'office', 'family', 'laundry'];
    const out: { x: number; y: number; z: number; key: string; i: number }[] = [];
    for (const r of Object.values(project.rooms)) {
      if (vis.level[r.levelId] !== 'full' || !wanted.includes(r.kind) || out.length >= max) continue;
      const lv = project.levels[r.levelId];
      let cx = 0;
      let cz = 0;
      for (const p of r.outline) {
        cx += p.x;
        cz += p.z;
      }
      cx /= r.outline.length;
      cz /= r.outline.length;
      const big = r.kind === 'living';
      out.push({ x: cx, y: lv.elevation + (big ? 5.2 : lv.ceilingHeight - 0.45), z: cz, key: r.id, i: big ? 90 : 26 });
    }
    return out;
  }, [project.rooms, project.levels, vis, q, plan, a]);
  return (
    <>
      <hemisphereLight args={[plan ? '#aab8d4' : a.hemiSky, plan ? '#3c3228' : a.hemiGround, plan ? 1.5 : a.hemi]} />
      <ambientLight intensity={plan ? 0.9 : a.ambient} color="#ffe2c0" />
      <directionalLight
        ref={sun}
        position={plan ? [-26, 36, -22] : sunPos.toArray()}
        intensity={plan ? 0.8 : a.sunIntensity}
        color={plan ? '#ffe7c8' : a.sunColor}
        castShadow={q !== 'low' && !plan}
        shadow-mapSize={q === 'high' ? [4096, 4096] : [1536, 1536]}
        shadow-camera-left={-42}
        shadow-camera-right={42}
        shadow-camera-top={42}
        shadow-camera-bottom={-42}
        shadow-camera-near={1}
        shadow-camera-far={140}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
      {rooms.map((l) => (
        <pointLight key={l.key} position={[l.x, l.y, l.z]} intensity={l.i * (plan ? 1 : a.interior)} distance={13} decay={1.6} color="#ffb877" />
      ))}
      <Environment key={project.view.timeOfDay} resolution={256} frames={1} background={false}>
        <Lightformer form="rect" intensity={1.6 * a.env} position={[0, 8, -10]} scale={[18, 8, 1]} color="#ffe0b8" />
        <Lightformer form="rect" intensity={1.0 * a.env} position={[0, 8, 12]} scale={[18, 8, 1]} color="#cdd9f2" />
        <Lightformer form="rect" intensity={0.9 * a.env} position={[-12, 5, 0]} rotation-y={Math.PI / 2} scale={[14, 6, 1]} color="#ffd4a0" />
        <Lightformer form="rect" intensity={0.8 * a.env} position={[12, 5, 0]} rotation-y={-Math.PI / 2} scale={[14, 6, 1]} color="#b9c8ea" />
        <Lightformer form="ring" intensity={2 * a.env} position={[0, 14, 0]} rotation-x={Math.PI / 2} scale={10} color="#fff1dd" />
      </Environment>
    </>
  );
}

/** Orthographic flat views, plan, and true-isometric (with orbit). */
function OrthoRig() {
  const project = useStore((s) => s.hist.project);
  const nonce = useStore((s) => s.resetViewNonce);
  const { size, camera, set } = useThree();
  const ctrl = useRef<OrbitControlsImpl>(null);
  const cam = useRef<THREE.OrthographicCamera>(null);
  const mode = project.view.mode;
  const corner = project.view.isoCorner;
  const isIso = mode === 'iso';
  const spec = FLAT_VIEWS[mode];
  const box = useMemo(() => framingBox(project), [project.view.mode, project.view.activeLevelId, project.view.levelFilter, project.view.isolateActive, project.view.showSite, project.walls, project.roofs, project.slabs, project.levels]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const c = cam.current;
    if (!c) return;
    const center = box.getCenter(new THREE.Vector3());
    const dir = isIso ? isoDirection(corner) : spec.dir.clone();
    const up = isIso ? new THREE.Vector3(0, 1, 0) : spec.up.clone();
    const dist = 200;
    c.up.copy(up);
    c.position.copy(center).addScaledVector(dir, dist);
    c.zoom = fitZoom(box, dir, up, size.width, size.height);
    c.near = 0.1;
    c.far = 1000;
    c.lookAt(center);
    c.updateProjectionMatrix();
    c.updateMatrixWorld();
    if (ctrl.current) {
      ctrl.current.target.copy(center);
      ctrl.current.update();
    }
    set({ camera: c });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, corner, nonce, box, size.width, size.height]);

  return (
    <>
      <OrthographicCamera ref={cam} makeDefault position={[0, 200, 0]} zoom={20} near={0.1} far={1000} />
      {isIso ? <OrbitControls ref={ctrl} makeDefault regress enableDamping={false} zoomSpeed={1.2} maxPolarAngle={Math.PI * 0.499} minZoom={4} maxZoom={400} mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: THREE.MOUSE.PAN }} /> : <FlatControls />}
    </>
  );
  void camera;
}

function PerspRig() {
  const project = useStore((s) => s.hist.project);
  const nonce = useStore((s) => s.resetViewNonce);
  const ctrl = useRef<OrbitControlsImpl>(null);
  const cam = useRef<THREE.PerspectiveCamera>(null);
  const box = useMemo(() => framingBox(project), [project.walls, project.roofs, project.slabs, project.levels]); // eslint-disable-line react-hooks/exhaustive-deps
  const { set, size: vp } = useThree();
  useEffect(() => {
    const c = cam.current;
    if (!c) return;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    // portrait screens see less sideways: back off so the whole house fits the narrow width
    const aspect = vp.width / Math.max(1, vp.height);
    const r = (Math.max(size.x, size.z) * 0.95) / Math.min(1, Math.max(0.42, aspect * 0.6));
    c.position.set(center.x + r * 0.55, center.y + r * 0.42, center.z - r * 0.85);
    c.lookAt(center);
    set({ camera: c });
    if (ctrl.current) {
      ctrl.current.target.copy(center);
      ctrl.current.update();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce, box]);
  return (
    <>
      <PerspectiveCamera ref={cam} makeDefault fov={42} near={0.3} far={1000} position={[20, 20, -40]} />
      <OrbitControls ref={ctrl} makeDefault regress maxPolarAngle={Math.PI * 0.495} />
    </>
  );
}

function Post() {
  const q = useStore((s) => s.hist.project.view.quality);
  const mode = useStore((s) => s.hist.project.view.mode);
  const ao = useRef<N8AOPostPass>(null);
  const perf = useThree((s) => s.performance);
  // ambient occlusion is the costliest pass: skip it while the camera is moving, refine at rest
  useFrame(() => {
    const p = ao.current as unknown as { enabled: boolean } | null;
    if (p) p.enabled = mode === 'walk' || perf.current >= 1;
  });
  if (q === 'low' || mode === 'plan') return null;
  return (
    <EffectComposer multisampling={q === 'high' ? 4 : 0} enableNormalPass={false}>
      <N8AO ref={ao} aoRadius={q === 'high' ? 1.1 : 0.9} distanceFalloff={1} intensity={q === 'high' ? 2.4 : 1.6} quality={q === 'high' ? 'medium' : 'performance'} halfRes={q !== 'high'} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}


/** Compile every material's shader in parallel (KHR_parallel_shader_compile) before the first frame,
 *  so neither the first view nor furniture arriving later stalls the page on a synchronous shader link. */
function Warmup({ onDone }: { onDone: () => void }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      onDone();
    };
    const p = useStore.getState().hist.project;
    const mats = p.materials;
    // only the variants this house actually uses: building finishes, furniture slots, room floors
    const furn = new Set<string>(Object.values(FIXED_SLOT_MATERIAL));
    for (const f of Object.values(p.furniture)) {
      const it = CATALOG_BY_ID[f.catalogId];
      for (const slot of ['primary', 'secondary', 'accent'] as const) {
        const id = f.materialOverrides[slot] ?? it?.slots[slot]?.default;
        if (id) furn.add(id);
      }
    }
    const floors = new Set(Object.values(p.rooms).map((r) => r.floorMaterialId));
    const json = JSON.stringify({ w: p.walls, o: p.openings, s: p.slabs, r: p.roofs, st: p.stairs, rm: p.rooms, site: p.site });
    const arch = Object.keys(mats).filter((id) => json.includes(`"${id}"`));
    const list: THREE.Material[] = [];
    for (const id of arch) list.push(getThreeMaterial(mats[id]));
    for (const id of furn) if (mats[id]) list.push(getFurnitureMaterial(mats[id]));
    for (const id of floors) if (mats[id]) list.push(getFloorMaterial(mats[id]));
    const g = new THREE.Group();
    const geo = new THREE.BoxGeometry(0.01, 0.01, 0.01);
    geo.setAttribute('color', new THREE.Float32BufferAttribute(new Array(geo.getAttribute('position').count * 3).fill(1), 3));
    for (const m of list) {
      const mesh = new THREE.Mesh(geo, m);
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.position.set(0, -500, 0);
      g.add(mesh);
    }
    scene.add(g);
    const t = setTimeout(finish, 6000);
    gl.compileAsync(scene, camera)
      .catch(() => {})
      .then(() => {
        scene.remove(g);
        geo.dispose();
        clearTimeout(t);
        finish();
      });
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

/** Shadows render once per scene change, not once per frame: orbiting and walking reuse the baked map. */
function ShadowBaker() {
  const gl = useThree((s) => s.gl);
  const project = useStore((s) => s.hist.project);
  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    return () => {
      gl.shadowMap.autoUpdate = true;
    };
  }, [gl]);
  useEffect(() => markShadowsDirty(), [project]);
  useFrame(() => {
    if (takeShadowsDirty()) gl.shadowMap.needsUpdate = true;
  });
  return null;
}

export function Scene() {
  const mode = useStore((s) => s.hist.project.view.mode);
  const q = useStore((s) => s.hist.project.view.quality);
  const flat = !!FLAT_VIEWS[mode] || mode === 'iso';
  const [warm, setWarm] = useState(false);
  return (
    <Canvas
      className={warm ? 'scene-ready' : 'scene-warming'}
      frameloop={!warm ? 'never' : mode === 'walk' ? 'always' : 'demand'}
      performance={{ min: 0.5, debounce: 300 }}
      shadows={q === 'low' ? false : 'soft'}
      dpr={q === 'high' ? [1, 2] : 1}
      gl={{ antialias: q !== 'high', preserveDrawingBuffer: true, powerPreference: 'high-performance', toneMapping: THREE.NoToneMapping }}
      onCreated={(state) => {
        const { gl, raycaster } = state;
        (window as any).__three = state;
        bindRenderer(() => state.invalidate());
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        raycaster.layers.set(1);
        // shader error checks force a synchronous GPU round trip per program; dev builds keep them
        gl.debug.checkShaderErrors = !import.meta.env.PROD;
        (window as any).__gl = gl;
      }}
    >
      {!warm && <Warmup onDone={() => (setWarm(true), setTimeout(requestRender, 0), setTimeout(requestRender, 120))} />}
      <SkyDome />
      <ShadowBaker />
      {q === 'high' && <AdaptiveDpr pixelated={false} />}
      <Lights />
      <Architecture />
      <Overlays />
      {flat ? <OrthoRig /> : mode === 'persp' ? <PerspRig /> : null}
      {mode === 'walk' && <Walkthrough />}
      <Interaction />
      <ExportBridge />
      <ThumbBridge />
      <Post />
    </Canvas>
  );
}
