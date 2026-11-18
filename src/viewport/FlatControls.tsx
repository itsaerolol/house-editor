import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';
import { input } from './input';

/** Pan (drag) and cursor-anchored zoom (wheel) for orthographic flat views. No rotation by design. */
export function FlatControls() {
  const { gl, camera, invalidate } = useThree();
  const perf = useThree((s) => s.performance);
  useEffect(() => {
    const el = gl.domElement;
    const cam = camera as THREE.OrthographicCamera;
    const right = new THREE.Vector3();
    const up = new THREE.Vector3();
    const axes = () => {
      cam.updateMatrixWorld();
      right.setFromMatrixColumn(cam.matrixWorld, 0);
      up.setFromMatrixColumn(cam.matrixWorld, 1);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
      const ny = -(((e.clientY - r.top) / r.height) * 2 - 1);
      axes();
      const before = (k: number) => ({ x: (nx * r.width) / 2 / k, y: (ny * r.height) / 2 / k });
      const b0 = before(cam.zoom);
      const factor = Math.exp(-e.deltaY * 0.0015);
      cam.zoom = Math.min(600, Math.max(3, cam.zoom * factor));
      const b1 = before(cam.zoom);
      cam.position.addScaledVector(right, b0.x - b1.x).addScaledVector(up, b0.y - b1.y);
      cam.updateProjectionMatrix();
      perf.regress();
      invalidate();
    };
    let drag: { x: number; y: number; id: number; button: number; started: boolean } | null = null;
    // touch: two fingers pinch-zoom about their midpoint and pan together
    const pts = new Map<number, { x: number; y: number }>();
    let pinch: { d: number; mx: number; my: number } | null = null;
    const pinchState = () => {
      const [a, b] = [...pts.values()];
      return { d: Math.hypot(b.x - a.x, b.y - a.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    };
    const zoomAt = (clientX: number, clientY: number, factor: number) => {
      const r = el.getBoundingClientRect();
      const nx = ((clientX - r.left) / r.width) * 2 - 1;
      const ny = -(((clientY - r.top) / r.height) * 2 - 1);
      axes();
      const before = (k: number) => ({ x: (nx * r.width) / 2 / k, y: (ny * r.height) / 2 / k });
      const b0 = before(cam.zoom);
      cam.zoom = Math.min(600, Math.max(3, cam.zoom * factor));
      const b1 = before(cam.zoom);
      cam.position.addScaledVector(right, b0.x - b1.x).addScaledVector(up, b0.y - b1.y);
      cam.updateProjectionMatrix();
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pts.size === 2) {
          pinch = pinchState();
          drag = null;
          return;
        }
      }
      if (e.button === 1 || e.button === 2 || e.button === 0) drag = { x: e.clientX, y: e.clientY, id: e.pointerId, button: e.button, started: false };
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch' && pts.has(e.pointerId)) {
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pinch && pts.size === 2) {
          if (input.claimed) return;
          const now = pinchState();
          zoomAt(now.mx, now.my, now.d / Math.max(1, pinch.d));
          axes();
          cam.position.addScaledVector(right, -(now.mx - pinch.mx) / cam.zoom).addScaledVector(up, (now.my - pinch.my) / cam.zoom);
          pinch = now;
          perf.regress();
          invalidate();
          return;
        }
      }
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (!drag.started) {
        if (Math.hypot(dx, dy) < 3) return;
        if (drag.button === 0 && input.claimed) return;
        drag.started = true;
      }
      axes();
      cam.position.addScaledVector(right, -dx / cam.zoom).addScaledVector(up, dy / cam.zoom);
      drag.x = e.clientX;
      drag.y = e.clientY;
      perf.regress();
      invalidate();
    };
    const upH = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      drag = null;
    };
    const noMenu = (e: Event) => e.preventDefault();
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', upH);
    window.addEventListener('pointercancel', upH);
    el.addEventListener('contextmenu', noMenu);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', upH);
      window.removeEventListener('pointercancel', upH);
      el.removeEventListener('contextmenu', noMenu);
    };
  }, [gl, camera, invalidate, perf]);
  return null;
}
