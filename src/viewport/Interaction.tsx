import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { create } from 'zustand';
import { wallBase, wallLength, wallTop, wallVec } from '../model/arch';
import { CATALOG_BY_ID } from '../model/catalog';
import { stairCorePolygon } from '../model/stairs';
import { validateOpening } from '../model/validate';
import { formatLength } from '../model/units';
import type { Door, Id, Opening, Project, Selection, Vec2, Window } from '../model/types';
import { useStore } from '../store/store';
import { getFurnitureGeometry } from '../render/furnitureGeometry';
import { input } from './input';

/* ------------------------------------------------------------ transient (non-persisted) state */

interface Transient {
  /** furniture placement preview position */
  place: Vec2 | null;
  /** opening placement preview */
  opening: { wallId: Id; op: Opening; errors: string[] } | null;
  /** wall draw cursor (snapped) */
  wallCursor: Vec2 | null;
  /** drag in progress (for cursor styling) */
  dragging: boolean;
}
export const useTransient = create<Transient>(() => ({ place: null, opening: null, wallCursor: null, dragging: false }));

/* ------------------------------------------------------------ helpers */

const FLAT_SIDE = ['front', 'back', 'left', 'right'];

function snap(v: number, step: number, on: boolean) {
  return on && step > 0 ? Math.round(v / step) * step : v;
}

function levelY(p: Project, id: Id) {
  return p.levels[id]?.elevation ?? 0;
}

type HandleKind = 'corner' | 'rotate' | 'height' | 'wall-start' | 'wall-end';
interface HandleData {
  type: HandleKind;
  id: Id;
  index?: number;
}

/** Positions and kinds of the on-canvas handles for the current selection. */
function handlesFor(p: Project, sel: Selection | null, mode: string) {
  const out: { pos: THREE.Vector3; data: HandleData }[] = [];
  if (!sel) return out;
  if (sel.kind === 'furniture') {
    const f = p.furniture[sel.id];
    if (!f || f.locked) return out;
    const y = levelY(p, f.levelId) + f.elevation;
    const c = Math.cos(f.rotationY);
    const s = Math.sin(f.rotationY);
    const toW = (lx: number, lz: number) => new THREE.Vector3(f.position.x + lx * c + lz * s, y + 0.03, f.position.z - lx * s + lz * c);
    const sg: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    sg.forEach(([sx, sz], i) => out.push({ pos: toW((sx * f.size.w) / 2, (sz * f.size.d) / 2), data: { type: 'corner', id: f.id, index: i } }));
    out.push({ pos: toW(0, f.size.d / 2 + 0.4), data: { type: 'rotate', id: f.id } });
    if (!['top', 'bottom', 'plan'].includes(mode)) {
      const top = toW(0, 0);
      top.y = y + f.size.h;
      out.push({ pos: top, data: { type: 'height', id: f.id } });
    }
  } else if (sel.kind === 'wall') {
    const w = p.walls[sel.id];
    const lv = w && p.levels[w.levelId];
    if (!w || !lv || w.locked) return out;
    const y = lv.elevation + Math.min(1.0, wallTop(w, lv, p.levels) - lv.elevation);
    out.push({ pos: new THREE.Vector3(w.start.x, y, w.start.z), data: { type: 'wall-start', id: w.id } });
    out.push({ pos: new THREE.Vector3(w.end.x, y, w.end.z), data: { type: 'wall-end', id: w.id } });
  }
  return out;
}

/** Edge segments (x,y,z pairs) outlining the selected entity. */
function outlineFor(p: Project, sel: Selection | null): number[] {
  const seg: number[] = [];
  if (!sel) return seg;
  const line = (a: number[], b: number[]) => seg.push(a[0], a[1], a[2], b[0], b[1], b[2]);
  const box = (c: number[][]) => {
    // c: 8 corners, bottom 0..3 then top 4..7
    for (let i = 0; i < 4; i++) {
      line(c[i], c[(i + 1) % 4]);
      line(c[4 + i], c[4 + ((i + 1) % 4)]);
      line(c[i], c[4 + i]);
    }
  };
  const loop = (pts: Vec2[], y: number) => pts.forEach((q, i) => line([q.x, y, q.z], [pts[(i + 1) % pts.length].x, y, pts[(i + 1) % pts.length].z]));
  switch (sel.kind) {
    case 'furniture': {
      const f = p.furniture[sel.id];
      if (!f) break;
      const g = getFurnitureGeometry(f.catalogId, f.size.w, f.size.d, f.size.h, 0);
      const bb = g?.bbox ?? new THREE.Box3(new THREE.Vector3(-f.size.w / 2, 0, -f.size.d / 2), new THREE.Vector3(f.size.w / 2, f.size.h, f.size.d / 2));
      const y0 = levelY(p, f.levelId) + f.elevation;
      const c = Math.cos(f.rotationY);
      const s = Math.sin(f.rotationY);
      const W = (lx: number, ly: number, lz: number) => [f.position.x + lx * c + lz * s, y0 + ly, f.position.z - lx * s + lz * c];
      const { min: a, max: b } = bb;
      box([W(a.x, a.y, a.z), W(b.x, a.y, a.z), W(b.x, a.y, b.z), W(a.x, a.y, b.z), W(a.x, b.y, a.z), W(b.x, b.y, a.z), W(b.x, b.y, b.z), W(a.x, b.y, b.z)]);
      break;
    }
    case 'wall': {
      const w = p.walls[sel.id];
      const lv = w && p.levels[w.levelId];
      if (!w || !lv) break;
      const { len, tx, tz, nx, nz } = wallVec(w);
      const h = w.thickness / 2 + 0.01;
      const y0 = wallBase(w, lv);
      const y1 = wallTop(w, lv, p.levels);
      const P = (a: number, s: number, y: number) => [w.start.x + tx * a + nx * s, y, w.start.z + tz * a + nz * s];
      box([P(0, -h, y0), P(len, -h, y0), P(len, h, y0), P(0, h, y0), P(0, -h, y1), P(len, -h, y1), P(len, h, y1), P(0, h, y1)]);
      break;
    }
    case 'opening': {
      const o = p.openings[sel.id];
      const w = o && p.walls[o.wallId];
      const lv = w && p.levels[w.levelId];
      if (!o || !w || !lv) break;
      const { tx, tz, nx, nz } = wallVec(w);
      const h = w.thickness / 2 + 0.03;
      const y0 = lv.elevation + o.sill;
      const y1 = y0 + o.height;
      const a0 = o.offset;
      const a1 = o.offset + o.width;
      const P = (a: number, s: number, y: number) => [w.start.x + tx * a + nx * s, y, w.start.z + tz * a + nz * s];
      box([P(a0, -h, y0), P(a1, -h, y0), P(a1, h, y0), P(a0, h, y0), P(a0, -h, y1), P(a1, -h, y1), P(a1, h, y1), P(a0, h, y1)]);
      break;
    }
    case 'slab': {
      const s = p.slabs[sel.id];
      const lv = s && p.levels[s.levelId];
      if (!s || !lv) break;
      const th = s.thickness ?? lv.slabThickness;
      const y1 = lv.elevation + s.topOffset;
      loop(s.outline, y1 + 0.005);
      loop(s.outline, y1 - th);
      s.outline.forEach((q) => line([q.x, y1, q.z], [q.x, y1 - th, q.z]));
      s.holes.forEach((h) => loop(h, y1 + 0.005));
      break;
    }
    case 'room': {
      const r = p.rooms[sel.id];
      if (r) loop(r.outline, levelY(p, r.levelId) + 0.03);
      break;
    }
    case 'stair': {
      const st = p.stairs[sel.id];
      if (!st) break;
      const poly = stairCorePolygon(st);
      const y0 = levelY(p, st.levelIds[0]);
      const y1 = levelY(p, st.levelIds[st.levelIds.length - 1]);
      loop(poly, y0 + 0.02);
      loop(poly, y1);
      poly.forEach((q) => line([q.x, y0, q.z], [q.x, y1, q.z]));
      break;
    }
    case 'roof': {
      const r = p.roofs[sel.id];
      const lv = r && p.levels[r.levelId];
      if (!r || !lv) break;
      const hx = r.size.x / 2 + (r.ridgeAxis === 'x' ? r.rakeOverhang : r.eaveOverhang);
      const hz = r.size.z / 2 + (r.ridgeAxis === 'z' ? r.rakeOverhang : r.eaveOverhang);
      const y = lv.elevation + lv.ceilingHeight + r.baseOffset;
      loop([{ x: r.center.x - hx, z: r.center.z - hz }, { x: r.center.x + hx, z: r.center.z - hz }, { x: r.center.x + hx, z: r.center.z + hz }, { x: r.center.x - hx, z: r.center.z + hz }], y);
      break;
    }
    default:
      break;
  }
  return seg;
}

/* ------------------------------------------------------------ default opening sizes */

function newOpening(kind: 'door' | 'window', wallId: Id, style: string, id: string): Opening {
  if (kind === 'door') {
    const garage = style === 'garage';
    const dbl = style === 'double' || style === 'sliding';
    return {
      id,
      kind: 'door',
      wallId,
      offset: 0,
      width: garage ? 2.44 : dbl ? 1.52 : 0.914,
      height: garage ? 2.13 : 2.08,
      sill: 0,
      frameMaterialId: 'trim-black',
      style: style as Door['style'],
      hinge: 'start',
      open: false,
      leafMaterialId: garage ? 'garage-door' : 'door-int',
    };
  }
  return {
    id,
    kind: 'window',
    wallId,
    offset: 0,
    width: 1.07,
    height: 1.37,
    sill: 0.9,
    frameMaterialId: 'frame-black',
    style: style as Window['style'],
    muntinCols: 2,
    muntinRows: 3,
  };
}

/* ------------------------------------------------------------ component */

export function Interaction() {
  const { gl, camera, scene, invalidate } = useThree();
  const controls = useThree((st) => st.controls) as unknown as { enabled: boolean } | null;
  const controlsRef = useRef(controls);
  controlsRef.current = controls;
  const project = useStore((s) => s.hist.project);
  const sel = useStore((s) => s.selection);
  const group = useStore((s) => s.group);
  const hover = useStore((s) => s.hover);
  const tool = useStore((s) => s.tool);
  const placing = useStore((s) => s.placing);
  const mode = project.view.mode;
  const walking = mode === 'walk';
  const handleGroup = useRef<THREE.Group>(null);
  const camRef = useRef(camera);
  camRef.current = camera;

  const handles = useMemo(() => (group.length > 1 ? [] : handlesFor(project, sel, mode)), [project, sel, mode, group]);
  const selSeg = useMemo(() => (group.length > 1 ? group.flatMap((g) => outlineFor(project, g)) : outlineFor(project, sel)), [project, sel, group]);
  const hovSeg = useMemo(() => (hover && (!sel || hover.id !== sel.id) && !group.some((g) => g.id === hover.id) && tool === 'select' ? outlineFor(project, hover) : []), [project, hover, sel, tool, group]);

  const selGeo = useMemo(() => segGeometry(selSeg), [selSeg]);
  const hovGeo = useMemo(() => segGeometry(hovSeg), [hovSeg]);
  useEffect(() => () => selGeo.dispose(), [selGeo]);
  useEffect(() => () => hovGeo.dispose(), [hovGeo]);

  // keep handle size constant on screen
  useFrame(() => {
    const g = handleGroup.current;
    if (!g) return;
    const cam = camRef.current;
    for (const child of g.children) {
      let k: number;
      if ((cam as THREE.OrthographicCamera).isOrthographicCamera) k = 7 / (cam as THREE.OrthographicCamera).zoom;
      else k = cam.position.distanceTo(child.position) * 0.011;
      child.scale.setScalar(k);
    }
  });

  useEffect(() => {
    if (walking) return;
    const el = gl.domElement;
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const tmp = new THREE.Vector3();
    const plane = new THREE.Plane();
    const store = useStore;
    const T = useTransient;

    type Drag =
      | { kind: 'move'; id: Id; p0: THREE.Vector3; pos0: Vec2; elev0: number; side: boolean; plane: THREE.Plane; started: boolean; px: number; py: number }
      | { kind: 'corner'; id: Id; index: number }
      | { kind: 'rotate'; id: Id }
      | { kind: 'height'; id: Id }
      | { kind: 'wall-end'; id: Id; which: 'start' | 'end' }
      | { kind: 'wall-move'; id: Id; p0: THREE.Vector3; s0: Vec2; e0: Vec2; started: boolean; px: number; py: number }
      | { kind: 'opening-move'; id: Id; px: number; py: number; started: boolean }
      | null;
    let drag: Drag = null;
    let gid = 'g:0:';
    let down: { x: number; y: number; target: 'empty' | 'entity' | 'tool' | 'tap'; tap?: Selection; touch?: boolean } | null = null;
    // touch: every finger currently on the canvas, the last tap (for double tap) and a two-finger turn of the selection
    const fingers = new Map<number, { x: number; y: number }>();
    let lastTap = { t: 0, x: 0, y: 0 };
    let twist: { id: Id; a0: number; rot0: number } | null = null;
    const fingerAngle = () => {
      const [a, b] = [...fingers.values()];
      return Math.atan2(b.y - a.y, b.x - a.x);
    };
    const isSelected = (sel: Selection) => {
      const st = store.getState();
      return (st.selection?.kind === sel.kind && st.selection.id === sel.id) || st.group.some((g) => g.kind === sel.kind && g.id === sel.id);
    };
    let raf = 0;
    let lastEvt: PointerEvent | null = null;

    const claim = (on: boolean) => {
      input.claimed = on;
      if (controlsRef.current) controlsRef.current.enabled = !on;
    };
    const P = () => store.getState().hist.project;
    const setRay = (e: { clientX: number; clientY: number }) => {
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
      ray.setFromCamera(ndc, camRef.current);
    };
    const horizontalHit = (y: number): THREE.Vector3 | null => {
      plane.set(new THREE.Vector3(0, 1, 0), -y);
      const out = new THREE.Vector3();
      return ray.ray.intersectPlane(plane, out) ? out : null;
    };
    const pickHandle = (): HandleData | null => {
      const g = handleGroup.current;
      if (!g || !g.children.length) return null;
      ray.layers.set(2);
      const hits = ray.intersectObjects(g.children, true);
      for (const h of hits) {
        const d = (h.object.userData as { handle?: HandleData }).handle ?? (h.object.parent?.userData as { handle?: HandleData } | undefined)?.handle;
        if (d) return d;
      }
      return null;
    };
    const pickEntity = (): { sel: Selection; point: THREE.Vector3; object: THREE.Object3D } | null => {
      ray.layers.set(1);
      const hits = ray.intersectObjects(scene.children, true);
      for (const h of hits) {
        const ent = (h.object.userData as { entity?: Selection }).entity;
        if (ent) return { sel: ent, point: h.point, object: h.object };
      }
      return null;
    };
    const view = () => P().view;
    const snapV = (v: Vec2): Vec2 => {
      const vw = view();
      return { x: snap(v.x, vw.gridSpacing, vw.snapEnabled), z: snap(v.z, vw.gridSpacing, vw.snapEnabled) };
    };
    const magnet = (v: Vec2, levelId: Id, skipWall?: Id): Vec2 => {
      let best: Vec2 | null = null;
      let bd = 0.3;
      for (const w of Object.values(P().walls)) {
        if (w.levelId !== levelId || w.id === skipWall) continue;
        for (const q of [w.start, w.end]) {
          const d = Math.hypot(q.x - v.x, q.z - v.z);
          if (d < bd) {
            bd = d;
            best = q;
          }
        }
      }
      return best ? { x: best.x, z: best.z } : v;
    };

    const activeY = () => levelY(P(), view().activeLevelId);

    /* ---------------- hover / previews ---------------- */
    const updateHover = (e: PointerEvent) => {
      setRay(e);
      const st = store.getState();
      const p = P();
      const vw = p.view;
      const side = FLAT_SIDE.includes(vw.mode);
      if (st.tool === 'select') {
        const h = pickHandle();
        el.style.cursor = h ? 'pointer' : 'default';
        if (h) {
          st.setHover(null);
          return;
        }
        const hit = pickEntity();
        st.setHover(hit ? hit.sel : null);
        if (hit) el.style.cursor = 'pointer';
        const g = horizontalHit(activeY());
        st.setCursor(g && !side ? { x: g.x, z: g.z } : null);
      } else if (st.tool === 'place' && st.placing) {
        if (side) {
          st.setHint('Switch to Plan, Top or a 3D view to place furniture.');
          return;
        }
        const g = horizontalHit(activeY());
        if (g) {
          const s = snapV({ x: g.x, z: g.z });
          T.setState({ place: s });
          st.setCursor(s);
        }
        st.setHint('Click to place. R rotates, Esc cancels, Shift keeps placing.');
      } else if (st.tool === 'wall') {
        if (side) {
          st.setHint('Switch to Plan, Top or a 3D view to draw walls.');
          return;
        }
        const g = horizontalHit(activeY());
        if (g) {
          let c = magnet(snapV({ x: g.x, z: g.z }), vw.activeLevelId);
          const dr = st.wallDraft;
          if (dr && e.shiftKey) {
            const dx = Math.abs(c.x - dr.start.x);
            const dz = Math.abs(c.z - dr.start.z);
            c = dx > dz ? { x: c.x, z: dr.start.z } : { x: dr.start.x, z: c.z };
          }
          T.setState({ wallCursor: c });
          st.setCursor(c);
          if (dr) {
            const L = Math.hypot(c.x - dr.start.x, c.z - dr.start.z);
            const ang = (Math.atan2(c.z - dr.start.z, -(c.x - dr.start.x)) * 180) / Math.PI;
            st.setHint(`Length ${formatLength(L, vw.units)} at ${ang.toFixed(0)}°. Click to place, Esc or right-click to finish, Shift locks the axis.`);
          } else st.setHint('Click to start a wall. Ends snap to existing wall ends.');
        }
      } else if (st.tool === 'door' || st.tool === 'window') {
        const hit = pickEntity();
        if (hit && hit.sel.kind === 'wall') {
          const w = p.walls[hit.sel.id];
          const lv = w && p.levels[w.levelId];
          if (w && lv && w.kind !== 'rail') {
            const { tx, tz } = wallVec(w);
            const a = (hit.point.x - w.start.x) * tx + (hit.point.z - w.start.z) * tz;
            const style = st.tool === 'door' ? st.doorStyle : st.windowStyle;
            const op = newOpening(st.tool, w.id, style, '__preview');
            let off = a - op.width / 2;
            off = vw.snapEnabled ? snap(off, 0.0762, true) : off;
            op.offset = Math.max(0, Math.min(off, wallLength(w) - op.width));
            const errors = validateOpening(op, w, lv, p.levels, Object.values(p.openings), (m) => formatLength(m, vw.units));
            T.setState({ opening: { wallId: w.id, op, errors } });
            st.setHint(errors.length ? errors[0] : `Click to place the ${st.tool}.`);
            return;
          }
        }
        T.setState({ opening: null });
        st.setHint(`Hover a wall to place a ${st.tool}.`);
      }
    };

    /* ---------------- drag application ---------------- */
    const applyDrag = (e: PointerEvent) => {
      if (!drag) return;
      const st = store.getState();
      const p = P();
      const vw = p.view;
      setRay(e);
      if (drag.kind === 'move') {
        const f = p.furniture[drag.id];
        if (!f) return;
        const dx = e.clientX - drag.px;
        const dy = e.clientY - drag.py;
        if (!drag.started) {
          if (Math.hypot(dx, dy) < 4) return;
          drag.started = true;
          T.setState({ dragging: true });
        }
        const hit = new THREE.Vector3();
        if (!ray.ray.intersectPlane(drag.plane, hit)) return;
        const d = hit.clone().sub(drag.p0);
        if (drag.side) {
          // elevation views: move along the screen's horizontal axis and change the height
          const camDir = camRef.current.getWorldDirection(new THREE.Vector3());
          const right = new THREE.Vector3().crossVectors(camDir, new THREE.Vector3(0, 1, 0)).normalize();
          const along = d.dot(right);
          const nx = drag.pos0.x + right.x * along;
          const nz = drag.pos0.z + right.z * along;
          const elev = snap(drag.elev0 + d.y, vw.gridSpacing, vw.snapEnabled && !e.altKey);
          st.edit('Move ' + f.name, (dr) => {
            dr.furniture[f.id].position = { x: snap(nx, vw.gridSpacing, vw.snapEnabled && !e.altKey), z: snap(nz, vw.gridSpacing, vw.snapEnabled && !e.altKey) };
            dr.furniture[f.id].elevation = Math.max(-0.5, elev);
          }, gid + 'drag' + f.id);
        } else {
          const nx = snap(drag.pos0.x + d.x, vw.gridSpacing, vw.snapEnabled && !e.altKey);
          const nz = snap(drag.pos0.z + d.z, vw.gridSpacing, vw.snapEnabled && !e.altKey);
          st.moveFurniture(f.id, { x: nx, z: nz }, gid + 'drag');
        }
      } else if (drag.kind === 'corner') {
        const f = p.furniture[drag.id];
        if (!f) return;
        const y = levelY(p, f.levelId) + f.elevation;
        const g = horizontalHit(y);
        if (!g) return;
        const c = Math.cos(f.rotationY);
        const s = Math.sin(f.rotationY);
        const dx = g.x - f.position.x;
        const dz = g.z - f.position.z;
        const lx = dx * c - dz * s;
        const lz = dx * s + dz * c;
        const sg: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
        const [sx, sz] = sg[drag.index];
        const ax = (-sx * f.size.w) / 2;
        const az = (-sz * f.size.d) / 2;
        const step = vw.snapEnabled && !e.altKey ? vw.gridSpacing : 0;
        let w = Math.max(0.05, Math.abs(lx - ax));
        let d = Math.max(0.05, Math.abs(lz - az));
        if (step) {
          w = Math.max(step, Math.round(w / step) * step);
          d = Math.max(step, Math.round(d / step) * step);
        }
        // keep the opposite corner fixed
        const cx = ax + sx * (w / 2);
        const cz = az + sz * (d / 2);
        const wx = f.position.x + cx * c + cz * s;
        const wz = f.position.z - cx * s + cz * c;
        st.edit('Resize ' + f.name, (dr) => {
          const t = dr.furniture[f.id];
          t.size.w = w;
          t.size.d = d;
          t.position = { x: wx, z: wz };
        }, gid + 'rs' + f.id);
      } else if (drag.kind === 'rotate') {
        const f = p.furniture[drag.id];
        if (!f) return;
        const g = horizontalHit(levelY(p, f.levelId) + f.elevation);
        if (!g) return;
        let a = Math.atan2(g.x - f.position.x, g.z - f.position.z);
        const stepR = (vw.rotationSnap * Math.PI) / 180;
        if (vw.snapEnabled && !e.altKey) a = Math.round(a / stepR) * stepR;
        st.rotateFurniture(f.id, a, gid + 'rot');
      } else if (drag.kind === 'height') {
        const f = p.furniture[drag.id];
        if (!f) return;
        const cam = camRef.current;
        const dir = cam.getWorldDirection(new THREE.Vector3());
        dir.y = 0;
        if (dir.lengthSq() < 1e-6) return;
        dir.normalize();
        plane.setFromNormalAndCoplanarPoint(dir.negate(), new THREE.Vector3(f.position.x, 0, f.position.z));
        const hit = new THREE.Vector3();
        if (!ray.ray.intersectPlane(plane, hit)) return;
        let h = hit.y - (levelY(p, f.levelId) + f.elevation);
        if (vw.snapEnabled && !e.altKey) h = Math.round(h / 0.0762) * 0.0762;
        st.resizeFurniture(f.id, { h: Math.max(0.05, h) }, gid + 'h');
      } else if (drag.kind === 'wall-end') {
        const w = p.walls[drag.id];
        if (!w) return;
        const g = horizontalHit(levelY(p, w.levelId));
        if (!g) return;
        let q = magnet(snapV({ x: g.x, z: g.z }), w.levelId, w.id);
        if (e.shiftKey) {
          const other = drag.which === 'start' ? w.end : w.start;
          const dx = Math.abs(q.x - other.x);
          const dz = Math.abs(q.z - other.z);
          q = dx > dz ? { x: q.x, z: other.z } : { x: other.x, z: q.z };
        }
        const errs = st.updateWall(w.id, drag.which === 'start' ? { start: q } : { end: q }, gid + 'wd');
        if (errs.length) st.setHint(errs[0]);
        else st.setHint('');
      } else if (drag.kind === 'wall-move') {
        const w = p.walls[drag.id];
        if (!w) return;
        if (!drag.started) {
          if (Math.hypot(e.clientX - drag.px, e.clientY - drag.py) < 4) return;
          drag.started = true;
          T.setState({ dragging: true });
        }
        const g = horizontalHit(levelY(p, w.levelId));
        if (!g) return;
        const dx = snap(g.x - drag.p0.x, vw.gridSpacing, vw.snapEnabled && !e.altKey);
        const dz = snap(g.z - drag.p0.z, vw.gridSpacing, vw.snapEnabled && !e.altKey);
        st.updateWall(w.id, { start: { x: drag.s0.x + dx, z: drag.s0.z + dz }, end: { x: drag.e0.x + dx, z: drag.e0.z + dz } }, gid + 'wm');
      } else if (drag.kind === 'opening-move') {
        const o = p.openings[drag.id];
        const w = o && p.walls[o.wallId];
        if (!o || !w) return;
        if (!drag.started) {
          if (Math.hypot(e.clientX - drag.px, e.clientY - drag.py) < 4) return;
          drag.started = true;
          T.setState({ dragging: true });
        }
        ray.layers.set(1);
        // intersect with the wall's vertical mid-plane
        const { tx, tz, nx, nz } = wallVec(w);
        plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(nx, 0, nz), new THREE.Vector3(w.start.x, 0, w.start.z));
        const hit = new THREE.Vector3();
        if (!ray.ray.intersectPlane(plane, hit)) return;
        const a = (hit.x - w.start.x) * tx + (hit.z - w.start.z) * tz;
        let off = a - o.width / 2;
        if (vw.snapEnabled && !e.altKey) off = snap(off, 0.0762, true);
        off = Math.max(0, Math.min(off, wallLength(w) - o.width));
        const errs = st.updateOpening(o.id, { offset: off }, gid + 'od');
        st.setHint(errs.length ? errs[0] : '');
      }
    };

    /* ---------------- pointer events ---------------- */
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const st = store.getState();
      const p = P();
      setRay(e);
      const touch = e.pointerType === 'touch';
      if (touch) {
        fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (fingers.size > 1) {
          // a second finger: a held furniture piece turns with a twist; otherwise the camera gets the pinch or pan
          const f = drag && drag.kind === 'move' ? p.furniture[drag.id] : null;
          if (f && fingers.size === 2) {
            twist = { id: f.id, a0: fingerAngle(), rot0: f.rotationY };
            drag = null;
          } else if (!twist) {
            drag = null;
            claim(false);
          }
          down = null;
          T.setState({ dragging: !!twist });
          return;
        }
        // no hover on glass: build the placement preview from the touch point itself
        if (st.tool !== 'select') updateHover(e);
      }
      gid = `g:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}:`;
      down = { x: e.clientX, y: e.clientY, target: 'empty', touch };
      if (st.tool !== 'select') {
        down.target = 'tool';
        return;
      }
      const h = pickHandle();
      if (h) {
        claim(true);
        down.target = 'entity';
        el.setPointerCapture(e.pointerId);
        if (h.type === 'corner') drag = { kind: 'corner', id: h.id, index: h.index ?? 0 };
        else if (h.type === 'rotate') drag = { kind: 'rotate', id: h.id };
        else if (h.type === 'height') drag = { kind: 'height', id: h.id };
        else drag = { kind: 'wall-end', id: h.id, which: h.type === 'wall-start' ? 'start' : 'end' };
        T.setState({ dragging: true });
        return;
      }
      const hit = pickEntity();
      if (!hit) return;
      // touch: a finger on something not yet selected still orbits; it becomes a selection only if it lifts as a tap.
      // a finger on the selected piece moves it (the camera stays put).
      if (touch && (!isSelected(hit.sel) || st.addMode)) {
        down.target = 'tap';
        down.tap = hit.sel;
        return;
      }
      down.target = 'entity';
      // Shift / Ctrl / Cmd click builds a multi-selection; no drag
      if (e.shiftKey || e.ctrlKey || e.metaKey) {
        st.toggleInGroup(hit.sel);
        return;
      }
      // clicking an item already in the group keeps the group
      if (st.group.length > 1 && st.group.some((g) => g.kind === hit.sel.kind && g.id === hit.sel.id)) return;
      st.select(hit.sel);
      if (hit.sel.kind === 'furniture') {
        const f = p.furniture[hit.sel.id];
        if (!f || f.locked) return;
        const side = FLAT_SIDE.includes(p.view.mode);
        const y = levelY(p, f.levelId) + f.elevation;
        let pl: THREE.Plane;
        if (side) {
          const dir = camRef.current.getWorldDirection(new THREE.Vector3());
          pl = new THREE.Plane().setFromNormalAndCoplanarPoint(dir.clone().negate(), new THREE.Vector3(f.position.x, y, f.position.z));
        } else pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y);
        const p0 = new THREE.Vector3();
        if (!ray.ray.intersectPlane(pl, p0)) return;
        claim(true);
        el.setPointerCapture(e.pointerId);
        drag = { kind: 'move', id: f.id, p0, pos0: { ...f.position }, elev0: f.elevation, side, plane: pl, started: false, px: e.clientX, py: e.clientY };
      } else if (hit.sel.kind === 'wall') {
        const w = p.walls[hit.sel.id];
        if (!w || w.locked || FLAT_SIDE.includes(p.view.mode)) return;
        const g = horizontalHit(levelY(p, w.levelId));
        if (!g) return;
        claim(true);
        el.setPointerCapture(e.pointerId);
        drag = { kind: 'wall-move', id: w.id, p0: g, s0: { ...w.start }, e0: { ...w.end }, started: false, px: e.clientX, py: e.clientY };
      } else if (hit.sel.kind === 'opening') {
        const o = p.openings[hit.sel.id];
        if (!o || o.locked) return;
        claim(true);
        el.setPointerCapture(e.pointerId);
        drag = { kind: 'opening-move', id: o.id, px: e.clientX, py: e.clientY, started: false };
      }
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        if (fingers.has(e.pointerId)) fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (twist && fingers.size === 2) {
          const st = store.getState();
          const vw = st.hist.project.view;
          let a = twist.rot0 - (fingerAngle() - twist.a0);
          const stepR = (vw.rotationSnap * Math.PI) / 180;
          if (vw.snapEnabled) a = Math.round(a / stepR) * stepR;
          st.rotateFurniture(twist.id, a, gid + 'twist');
          invalidate();
          return;
        }
        // fingers do not hover
        if (!drag) return;
      }
      lastEvt = e;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const ev = lastEvt;
        if (!ev) return;
        // hover changes reach the screen through React (outline, previews), which asks for its own frame;
        // only drags force one, so a still scene stays idle while the mouse moves
        if (drag) {
          applyDrag(ev);
          invalidate();
        } else updateHover(ev);
      });
    };

    const onUp = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        fingers.delete(e.pointerId);
        if (twist) {
          if (fingers.size === 0) {
            twist = null;
            claim(false);
            T.setState({ dragging: false });
          }
          return;
        }
      }
      if (e.button !== 0 && !(e.button === 2 && store.getState().tool === 'wall')) return;
      const st = store.getState();
      const p = P();
      const d = down;
      const wasDrag = drag;
      if (drag) {
        try {
          el.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      }
      drag = null;
      claim(false);
      down = null;
      T.setState({ dragging: false });
      if (e.button === 2) {
        st.setWallDraft(null);
        return;
      }
      const moved = d ? Math.hypot(e.clientX - d.x, e.clientY - d.y) : 99;
      if (wasDrag) {
        st.setHint('');
        return;
      }
      if (!d || moved > (d.touch ? 10 : 4)) return;
      setRay(e);
      const vw = p.view;
      const side = FLAT_SIDE.includes(vw.mode);
      if (d.touch && st.tool === 'select') {
        const now = performance.now();
        const dbl = now - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 40;
        lastTap = dbl ? { t: 0, x: 0, y: 0 } : { t: now, x: e.clientX, y: e.clientY };
        // double tap on empty ground frames the house
        if (dbl && d.target === 'empty') return void st.resetView();
      }
      if (st.tool === 'select') {
        if (d.target === 'tap' && d.tap) return void (st.addMode ? st.toggleInGroup(d.tap) : st.select(d.tap));
        if (d.target === 'empty' && !e.shiftKey) st.select(null);
      } else if (st.tool === 'place' && st.placing) {
        if (side) return;
        const g = horizontalHit(activeY());
        if (!g) return;
        const pos = snapV({ x: g.x, z: g.z });
        st.addFurniture(st.placing.catalogId, vw.activeLevelId, pos, st.placing.rotationY);
        if (!e.shiftKey) {
          useStore.setState({ tool: 'select', placing: null, hint: '' });
          T.setState({ place: null });
        }
      } else if (st.tool === 'wall') {
        if (side) return;
        const g = horizontalHit(activeY());
        if (!g) return;
        let c = magnet(snapV({ x: g.x, z: g.z }), vw.activeLevelId);
        const dr = st.wallDraft;
        if (!dr) {
          st.setWallDraft({ start: c });
          return;
        }
        if (e.shiftKey) {
          const dx = Math.abs(c.x - dr.start.x);
          const dz = Math.abs(c.z - dr.start.z);
          c = dx > dz ? { x: c.x, z: dr.start.z } : { x: dr.start.x, z: c.z };
        }
        if (Math.hypot(c.x - dr.start.x, c.z - dr.start.z) < 0.05) return;
        const id = st.addWall(vw.activeLevelId, dr.start, c);
        if (id) st.setWallDraft({ start: c });
      } else if (st.tool === 'door' || st.tool === 'window') {
        const pr = T.getState().opening;
        if (!pr) return;
        if (pr.errors.length) {
          st.toast('error', pr.errors[0]);
          return;
        }
        const id = `${st.tool === 'door' ? 'd' : 'o'}-${Date.now().toString(36)}`;
        const errs = st.addOpening({ ...pr.op, id });
        if (errs.length) st.toast('error', errs[0]);
        else {
          T.setState({ opening: null });
          useStore.setState({ tool: 'select', hint: '' });
        }
      }
    };

    const onLeave = () => {
      store.getState().setHover(null);
      store.getState().setCursor(null);
    };
    const onContext = (e: Event) => {
      if (store.getState().tool === 'wall') e.preventDefault();
    };

    // touch decorating: a shelf tap drops the piece where the view is centred, selected, ready to drag into place
    input.placeAtCenter = (catalogId: string) => {
      const st = store.getState();
      const vw = P().view;
      ray.setFromCamera(new THREE.Vector2(0, 0), camRef.current);
      const g = horizontalHit(activeY());
      if (!g) return false;
      const id = st.addFurniture(catalogId, vw.activeLevelId, snapV({ x: g.x, z: g.z }), 0);
      if (id) st.select({ kind: 'furniture', id });
      return !!id;
    };
    // the OS can take a touch away (an incoming call, a system swipe): drop it cleanly
    const onCancel = (e: PointerEvent) => {
      fingers.delete(e.pointerId);
      if (fingers.size === 0) {
        twist = null;
        drag = null;
        down = null;
        claim(false);
        T.setState({ dragging: false });
      }
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    el.addEventListener('pointerleave', onLeave);
    el.addEventListener('contextmenu', onContext);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      input.placeAtCenter = null;
      el.removeEventListener('pointerleave', onLeave);
      el.removeEventListener('contextmenu', onContext);
      el.style.cursor = 'default';
      claim(false);
    };
  }, [gl, scene, invalidate, walking]);

  // reset transient previews when the tool changes
  useEffect(() => {
    useTransient.setState({ place: null, opening: null, wallCursor: null });
  }, [tool, placing?.catalogId]);

  if (walking)
    // first person: outlines only, depth tested so they don't show through walls
    return (
      <>
        <lineSegments geometry={selGeo} renderOrder={999}>
          <lineBasicMaterial color="#ff9d2e" transparent opacity={0.95} />
        </lineSegments>
        <lineSegments geometry={hovGeo} renderOrder={998}>
          <lineBasicMaterial color="#ffe2b8" transparent opacity={0.7} />
        </lineSegments>
      </>
    );
  return (
    <>
      <lineSegments geometry={selGeo} renderOrder={999}>
        <lineBasicMaterial color="#ff9d2e" depthTest={false} transparent opacity={0.95} />
      </lineSegments>
      <lineSegments geometry={hovGeo} renderOrder={998}>
        <lineBasicMaterial color="#ffe2b8" depthTest={false} transparent opacity={0.55} />
      </lineSegments>
      <group ref={handleGroup}>
        {handles.map((h, i) => (
          <mesh
            key={h.data.type + (h.data.index ?? '') + i}
            position={h.pos}
            renderOrder={1000}
            userData={{ handle: h.data }}
            ref={(m) => {
              if (m) {
                m.layers.set(2);
                m.layers.enable(0);
              }
            }}
          >
            {h.data.type === 'rotate' ? <torusGeometry args={[0.6, 0.22, 8, 16]} /> : h.data.type === 'height' ? <octahedronGeometry args={[0.9]} /> : <sphereGeometry args={[0.8, 12, 8]} />}
            <meshBasicMaterial color={h.data.type === 'rotate' ? '#7ad7ff' : h.data.type === 'height' ? '#9dff7a' : '#ff9d2e'} depthTest={false} transparent opacity={0.95} />
          </mesh>
        ))}
      </group>
      <Previews />
    </>
  );
}

function segGeometry(seg: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
  return g;
}

/* ------------------------------------------------------------ previews */

const OK_MAT = new THREE.MeshBasicMaterial({ color: '#7fd18b', transparent: true, opacity: 0.55, depthWrite: false });
const BAD_MAT = new THREE.MeshBasicMaterial({ color: '#ff6b5e', transparent: true, opacity: 0.6, depthWrite: false });
const PLACE_MAT = new THREE.MeshStandardMaterial({ color: '#8fd5ff', transparent: true, opacity: 0.6, depthWrite: false });

function Previews() {
  const t = useTransient();
  const project = useStore((s) => s.hist.project);
  const tool = useStore((s) => s.tool);
  const placing = useStore((s) => s.placing);
  const draft = useStore((s) => s.wallDraft);
  const lv = project.levels[project.view.activeLevelId];

  const placeGeo = useMemo(() => {
    if (!placing) return null;
    const it = CATALOG_BY_ID[placing.catalogId];
    if (!it) return null;
    return getFurnitureGeometry(it.id, it.size.w, it.size.d, it.size.h, 0);
  }, [placing?.catalogId]); // eslint-disable-line react-hooks/exhaustive-deps

  const wallPrev = useMemo(() => {
    if (tool !== 'wall' || !draft || !t.wallCursor || !lv) return null;
    const dx = t.wallCursor.x - draft.start.x;
    const dz = t.wallCursor.z - draft.start.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.01) return null;
    return { len, cx: (t.wallCursor.x + draft.start.x) / 2, cz: (t.wallCursor.z + draft.start.z) / 2, ang: Math.atan2(-dz, dx), h: lv.ceilingHeight };
  }, [tool, draft, t.wallCursor, lv]);

  return (
    <group>
      {tool === 'place' && placing && placeGeo && t.place && lv && (
        <mesh
          geometry={placeGeo.geometry}
          material={PLACE_MAT}
          position={[t.place.x, lv.elevation + (CATALOG_BY_ID[placing.catalogId]?.defaultElevation ?? 0), t.place.z]}
          rotation={[0, placing.rotationY, 0]}
          renderOrder={900}
        />
      )}
      {tool === 'wall' && t.wallCursor && lv && !draft && (
        <mesh position={[t.wallCursor.x, lv.elevation + 0.05, t.wallCursor.z]} material={OK_MAT} renderOrder={900}>
          <sphereGeometry args={[0.09, 10, 8]} />
        </mesh>
      )}
      {wallPrev && lv && (
        <mesh position={[wallPrev.cx, lv.elevation + wallPrev.h / 2, wallPrev.cz]} rotation={[0, wallPrev.ang, 0]} material={OK_MAT} renderOrder={900}>
          <boxGeometry args={[wallPrev.len, wallPrev.h, 0.125]} />
        </mesh>
      )}
      {draft && lv && (
        <mesh position={[draft.start.x, lv.elevation + 0.05, draft.start.z]} material={OK_MAT} renderOrder={900}>
          <sphereGeometry args={[0.1, 10, 8]} />
        </mesh>
      )}
      {(tool === 'door' || tool === 'window') && t.opening && <OpeningPreview />}
    </group>
  );
}

function OpeningPreview() {
  const t = useTransient((s) => s.opening);
  const project = useStore((s) => s.hist.project);
  if (!t) return null;
  const w = project.walls[t.wallId];
  const lv = w && project.levels[w.levelId];
  if (!w || !lv) return null;
  const { tx, tz, len } = wallVec(w);
  void len;
  const o = t.op;
  const a = o.offset + o.width / 2;
  const cx = w.start.x + tx * a;
  const cz = w.start.z + tz * a;
  const y = lv.elevation + o.sill + o.height / 2;
  const ang = Math.atan2(-tz, tx);
  return (
    <mesh position={[cx, y, cz]} rotation={[0, ang, 0]} material={t.errors.length ? BAD_MAT : OK_MAT} renderOrder={950}>
      <boxGeometry args={[o.width, o.height, w.thickness + 0.06]} />
    </mesh>
  );
}
