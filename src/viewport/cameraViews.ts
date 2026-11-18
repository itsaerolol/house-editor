import * as THREE from 'three';
import { projectBounds } from '../model/arch';
import type { IsoCorner, Project, ViewMode } from '../model/types';

export interface ViewSpec {
  /** direction from target to camera */
  dir: THREE.Vector3;
  up: THREE.Vector3;
  label: string;
  hint: string;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const ISO_EL = Math.atan(1 / Math.SQRT2); // true isometric elevation, 35.264 degrees

export const FLAT_VIEWS: Record<string, ViewSpec> = {
  front: { dir: V(0, 0, -1), up: V(0, 1, 0), label: 'Front', hint: 'Looking +Z. Screen right = -X (house right).' },
  back: { dir: V(0, 0, 1), up: V(0, 1, 0), label: 'Back', hint: 'Looking -Z. Screen right = +X.' },
  left: { dir: V(1, 0, 0), up: V(0, 1, 0), label: 'Left', hint: 'Looking -X. Screen right = -Z.' },
  right: { dir: V(-1, 0, 0), up: V(0, 1, 0), label: 'Right', hint: 'Looking +X. Screen right = +Z.' },
  top: { dir: V(0, 1, 0), up: V(0, 0, 1), label: 'Top', hint: 'Looking down. Screen up = +Z, right = -X.' },
  bottom: { dir: V(0, -1, 0), up: V(0, 0, -1), label: 'Bottom', hint: 'Looking up. Screen up = -Z, right = -X.' },
  plan: { dir: V(0, 1, 0), up: V(0, 0, 1), label: 'Floor plan', hint: 'Active level, cut at the section height.' },
};

/** Corner presets, named as seen from the Front view (front faces -Z). */
export const ISO_CORNERS: Record<IsoCorner, { label: string; sx: number; sz: number }> = {
  sw: { label: 'Front-left', sx: 1, sz: -1 },
  se: { label: 'Front-right', sx: -1, sz: -1 },
  nw: { label: 'Back-left', sx: 1, sz: 1 },
  ne: { label: 'Back-right', sx: -1, sz: 1 },
};

export function isoDirection(corner: IsoCorner): THREE.Vector3 {
  const c = ISO_CORNERS[corner];
  const h = Math.cos(ISO_EL);
  return V((c.sx * h) / Math.SQRT2, Math.sin(ISO_EL), (c.sz * h) / Math.SQRT2).normalize();
}

export function viewLabel(mode: ViewMode, corner: IsoCorner): string {
  if (mode === 'iso') return `Isometric - ${ISO_CORNERS[corner].label}`;
  if (mode === 'persp') return 'Perspective';
  if (mode === 'walk') return 'Walkthrough';
  return FLAT_VIEWS[mode]?.label ?? mode;
}

/** World-space box that the camera should frame for a given view. */
export function framingBox(p: Project): THREE.Box3 {
  const levelIds = p.view.mode === 'plan' ? [p.view.activeLevelId] : p.view.levelFilter !== 'all' ? [p.view.levelFilter] : p.view.isolateActive ? [p.view.activeLevelId] : undefined;
  const b = projectBounds(p, levelIds);
  const pad = p.view.showSite && !levelIds ? 4 : 0.5;
  return new THREE.Box3(new THREE.Vector3(b.minX - pad, Math.min(0, b.minY), b.minZ - pad), new THREE.Vector3(b.maxX + pad, b.maxY + 0.5, b.maxZ + pad));
}

/** Pixels-per-meter so that `box` fits a viewport when looked at along `dir`. */
export function fitZoom(box: THREE.Box3, dir: THREE.Vector3, up: THREE.Vector3, w: number, h: number, margin = 1.12): number {
  const cam = new THREE.Object3D();
  cam.position.copy(dir);
  cam.up.copy(up);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld();
  const inv = cam.matrixWorld.clone().invert();
  const mn = new THREE.Vector3(Infinity, Infinity, Infinity);
  const mx = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  const c = new THREE.Vector3();
  for (const x of [box.min.x, box.max.x])
    for (const y of [box.min.y, box.max.y])
      for (const z of [box.min.z, box.max.z]) {
        c.set(x, y, z).applyMatrix4(inv);
        mn.min(c);
        mx.max(c);
      }
  const ew = Math.max(0.5, mx.x - mn.x) * margin;
  const eh = Math.max(0.5, mx.y - mn.y) * margin;
  return Math.min(w / ew, h / eh);
}
