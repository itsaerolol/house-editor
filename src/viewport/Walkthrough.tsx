import { PerspectiveCamera } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Selection } from '../model/types';
import { buildWalkWorld, EYE, findDoorInReach, levelNameAt, startPose, stepWalker, supportHeight, type WalkState } from '../model/physics';
import { useStore } from '../store/store';
import { walkTouch } from './walkTouch';

const WALK = 1.6; // m/s
const RUN = 3.4;
const REACH = 12; // m, how far the crosshair can select

const _sphere = new THREE.Sphere();
const CENTER = new THREE.Vector2(0, 0);

/** First-person controller: pointer lock, WASD, Shift to run, Space to jump, R to reset, Esc to release. */
export function Walkthrough() {
  const { gl, camera, invalidate, scene } = useThree();
  const project = useStore((s) => s.hist.project);
  const resetNonce = useStore((s) => s.walkResetNonce);
  // Rebuilt only when geometry that matters for collision changes.
  const world = useMemo(() => buildWalkWorld(project), [project.walls, project.openings, project.furniture, project.slabs, project.stairs, project.levels, project.site]); // eslint-disable-line react-hooks/exhaustive-deps
  const worldRef = useRef(world);
  worldRef.current = world;

  const st = useRef<WalkState & { yaw: number; pitch: number }>({ x: 0, z: 0, y: 0, vy: 0, onGround: true, yaw: 0, pitch: 0 });
  const keys = useRef<Record<string, boolean>>({});
  const jump = useRef(false);
  const lastInfo = useRef(0);
  const bob = useRef(0);
  const aim = useRef<Selection | null>(null);
  const lastAim = useRef(0);
  const ray = useMemo(() => {
    const r = new THREE.Raycaster();
    r.layers.set(1);
    r.far = REACH;
    return r;
  }, []);

  useEffect(() => {
    (window as unknown as { __walk?: unknown }).__walk = st;
    return () => {
      delete (window as unknown as { __walk?: unknown }).__walk;
    };
  }, []);

  const reset = () => {
    const p = startPose(useStore.getState().hist.project);
    const w = worldRef.current;
    st.current = { x: p.x, z: p.z, y: supportHeight(w, p.x, p.z, 1e9), vy: 0, onGround: true, yaw: p.yaw, pitch: 0 };
  };

  // initial placement and reset button / R key
  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetNonce]);

  useEffect(() => {
    const el = gl.domElement;
    const toggleDoor = () => {
      const stt = useStore.getState();
      const q = st.current;
      const hit = findDoorInReach(stt.hist.project, q.x, q.z, q.y, q.yaw);
      if (hit) {
        const errs = stt.updateOpening(hit.id, { open: !hit.open }, 'g:door' + hit.id + performance.now());
        if (errs.length) stt.toast('error', errs[0]);
      }
    };
    walkTouch.toggleDoor = toggleDoor;
    // touch: pick whatever is under a screen point (the finger), same rules as the crosshair
    walkTouch.pickAt = (cx: number, cy: number) => {
      const r = el.getBoundingClientRect();
      const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -(((cy - r.top) / r.height) * 2 - 1));
      camera.updateMatrixWorld();
      ray.setFromCamera(ndc, camera);
      const cand: THREE.Object3D[] = [];
      scene.traverseVisible((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || !m.layers.isEnabled(1) || !(m.userData as { entity?: unknown }).entity) return;
        const g = m.geometry;
        if (!g.boundingSphere) g.computeBoundingSphere();
        _sphere.copy(g.boundingSphere!).applyMatrix4(m.matrixWorld);
        if (_sphere.distanceToPoint(camera.position) > REACH || !ray.ray.intersectsSphere(_sphere)) return;
        cand.push(m);
      });
      const hit = ray.intersectObjects(cand, false)[0];
      return (hit?.object.userData as { entity?: Selection } | undefined)?.entity ?? null;
    };
    const lock = () => {
      // fingers walk with the on-screen controls; pointer lock is for mice
      if (matchMedia('(pointer: coarse)').matches) return;
      if (document.pointerLockElement !== el) el.requestPointerLock?.();
    };
    let unlockedAt = 0;
    const onLockChange = () => {
      const on = document.pointerLockElement === el;
      if (!on) unlockedAt = performance.now();
      useStore.setState({ walkLocked: on, ...(on ? { walkPalette: false } : {}) });
    };
    // left click while walking selects whatever the crosshair is on (or clears the selection)
    const onDown = (e: MouseEvent) => {
      if (document.pointerLockElement !== el || e.button !== 0) return;
      const stt = useStore.getState();
      const a = aim.current;
      if (!a) return stt.select(null);
      if (e.shiftKey || e.ctrlKey || e.metaKey) stt.toggleInGroup(a);
      else stt.select(a);
    };
    const onMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== el) return;
      const s = st.current;
      s.yaw -= e.movementX * 0.0022;
      s.pitch = Math.max(-1.45, Math.min(1.45, s.pitch - e.movementY * 0.0022));
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      const stt0 = useStore.getState();
      if (stt0.walkPalette) return;
      // quick edits on what you clicked: F opens the finish picker, Delete removes
      if (e.code === 'KeyF' && !e.ctrlKey && !e.metaKey && stt0.selection) {
        e.preventDefault();
        keys.current = {};
        useStore.setState({ walkPalette: true });
        if (document.pointerLockElement === el) document.exitPointerLock();
        return;
      }
      if ((e.code === 'Delete' || e.code === 'Backspace') && stt0.selection) {
        e.preventDefault();
        stt0.deleteSelected();
        return;
      }
      keys.current[e.code] = true;
      if (e.code === 'Space') {
        jump.current = true;
        e.preventDefault();
      }
      if (e.code === 'KeyE' && !e.ctrlKey && !e.metaKey && !e.repeat) toggleDoor();
      if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey) useStore.getState().resetWalk();
      // the Esc that releases the mouse must not also clear the selection
      if (e.code === 'Escape' && document.pointerLockElement !== el && performance.now() - unlockedAt > 400) {
        const stt = useStore.getState();
        // first Esc after pausing clears the selection; the next one leaves the walk
        if (stt.selection) stt.select(null);
        else stt.setView({ mode: 'iso' });
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };
    const onBlur = () => {
      keys.current = {};
    };
    el.addEventListener('click', lock);
    el.addEventListener('mousedown', onDown);
    document.addEventListener('pointerlockchange', onLockChange);
    document.addEventListener('mousemove', onMove);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    el.style.cursor = 'crosshair';
    return () => {
      el.removeEventListener('click', lock);
      el.removeEventListener('mousedown', onDown);
      document.removeEventListener('pointerlockchange', onLockChange);
      document.removeEventListener('mousemove', onMove);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      if (document.pointerLockElement === el) document.exitPointerLock();
      el.style.cursor = 'default';
      useStore.setState({ walkLocked: false, walkInfo: null, hover: null });
      walkTouch.pickAt = null;
      walkTouch.toggleDoor = null;
      walkTouch.jx = walkTouch.jy = 0;
    };
  }, [gl]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const s = st.current;
    const k = keys.current;
    let fx = 0;
    let fz = 0;
    // yaw 0 faces +Z in world; right-hand vector is -X
    if (k.KeyW || k.ArrowUp) fz += 1;
    if (k.KeyS || k.ArrowDown) fz -= 1;
    if (k.KeyA || k.ArrowLeft) fx += 1;
    if (k.KeyD || k.ArrowRight) fx -= 1;
    // thumbstick: analog, pushed to the rim it runs
    const jm = Math.min(1, Math.hypot(walkTouch.jx, walkTouch.jy));
    let analog = 1;
    if (jm > 0.12 && !(fx || fz)) {
      fx = -walkTouch.jx;
      fz = -walkTouch.jy;
      analog = jm;
    }
    if (walkTouch.look.yaw || walkTouch.look.pitch) {
      s.yaw -= walkTouch.look.yaw;
      s.pitch = Math.max(-1.45, Math.min(1.45, s.pitch - walkTouch.look.pitch));
      walkTouch.look.yaw = walkTouch.look.pitch = 0;
    }
    if (walkTouch.jump) {
      jump.current = true;
      walkTouch.jump = false;
    }
    const len = Math.hypot(fx, fz) || 1;
    const speed = (k.ShiftLeft || k.ShiftRight || jm > 0.92 ? RUN : WALK) * (jm > 0.12 ? Math.min(1, analog * 1.15) : 1);
    const sin = Math.sin(s.yaw);
    const cos = Math.cos(s.yaw);
    // forward = (sin, cos); left = (cos, -sin)
    const mx = ((fz * sin + fx * cos) / len) * speed * (fx || fz ? 1 : 0);
    const mz = ((fz * cos - fx * sin) / len) * speed * (fx || fz ? 1 : 0);

    const next = stepWalker(worldRef.current, s, mx, mz, dt, jump.current);
    jump.current = false;
    s.x = next.x;
    s.z = next.z;
    s.y = next.y;
    s.vy = next.vy;
    s.onGround = next.onGround;

    if ((fx || fz) && s.onGround) bob.current += dt * speed * 3.2;
    const bobY = s.onGround && (fx || fz) ? Math.sin(bob.current) * 0.018 : 0;
    camera.position.set(s.x, s.y + EYE + bobY, s.z);
    camera.rotation.order = 'YXZ';
    camera.rotation.set(s.pitch, s.yaw + Math.PI, 0);

    const now = performance.now();
    // what the crosshair is on: cheap sphere cull first so far-off trees are never triangle-tested
    if (now - lastAim.current > 110 && document.pointerLockElement === gl.domElement) {
      lastAim.current = now;
      camera.updateMatrixWorld();
      ray.setFromCamera(CENTER, camera);
      const cand: THREE.Object3D[] = [];
      scene.traverseVisible((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh || !m.layers.isEnabled(1) || !(m.userData as { entity?: unknown }).entity) return;
        const g = m.geometry;
        if (!g.boundingSphere) g.computeBoundingSphere();
        _sphere.copy(g.boundingSphere!).applyMatrix4(m.matrixWorld);
        if (_sphere.distanceToPoint(camera.position) > REACH) return;
        if (!ray.ray.intersectsSphere(_sphere)) return;
        cand.push(m);
      });
      const hit = ray.intersectObjects(cand, false)[0];
      const ent = (hit?.object.userData as { entity?: Selection } | undefined)?.entity ?? null;
      const prev = aim.current;
      if (ent?.id !== prev?.id || ent?.kind !== prev?.kind) {
        aim.current = ent;
        useStore.getState().setHover(ent);
      }
    }
    if (now - lastInfo.current > 150) {
      lastInfo.current = now;
      const lv = levelNameAt(worldRef.current.project, s.y);
      const d = findDoorInReach(worldRef.current.project, s.x, s.z, s.y, s.yaw);
      useStore.setState({ walkInfo: { floor: lv.name, x: s.x, z: s.z, y: s.y, door: d ? { name: d.name, open: d.open } : null } });
    }
    invalidate();
  });

  return <PerspectiveCamera makeDefault fov={72} near={0.1} far={600} />;
}
