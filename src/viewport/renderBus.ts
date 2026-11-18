import * as THREE from 'three';
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh';

/* The canvas renders on demand. Anything outside React that changes what is on screen
 * (a texture tile arriving, a geometry swap) asks for one frame here. */
let invalidate: (() => void) | null = null;
let shadowsDirty = true;
export function bindRenderer(fn: () => void) {
  invalidate = fn;
}
export function requestRender() {
  invalidate?.();
}
/** Shadows are baked once and only re-rendered when the scene (not the camera) changes. */
export function markShadowsDirty() {
  shadowsDirty = true;
  invalidate?.();
}
export function takeShadowsDirty(): boolean {
  const d = shadowsDirty;
  shadowsDirty = false;
  return d;
}

/* Streamed results (textures, furniture, trim) land in batches: one React commit and one frame
 * per ~100 ms instead of one per item, so loading never competes with itself for the GPU. */
let batch: (() => void)[] = [];
let batchTimer: ReturnType<typeof setTimeout> | null = null;
export function landBatched(fn: () => void) {
  batch.push(fn);
  if (batchTimer) return;
  batchTimer = setTimeout(() => {
    const run = batch;
    batch = [];
    batchTimer = null;
    for (const f of run) f();
    shadowsDirty = true;
    invalidate?.();
  }, 100);
}

/* BVH picking: hover and click raycasts walk a bounds tree instead of every triangle. */
(THREE.BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree;
(THREE.BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

const idle: (cb: () => void) => void = (cb) => ((window as any).requestIdleCallback ? (window as any).requestIdleCallback(cb, { timeout: 1500 }) : setTimeout(cb, 30));
const queued = new WeakSet<THREE.BufferGeometry>();
/** Build a bounds tree for a pickable geometry when the browser is idle. Small meshes skip it. */
export function prepareBvh(g: THREE.BufferGeometry | null | undefined) {
  if (!g || queued.has(g) || (g as any).boundsTree) return;
  const tris = (g.index ? g.index.count : g.getAttribute('position')?.count ?? 0) / 3;
  if (tris < 600) return;
  queued.add(g);
  idle(() => {
    try {
      if (!(g as any).boundsTree && g.getAttribute('position')) (g as any).computeBoundsTree();
    } catch {
      /* geometry disposed meanwhile */
    }
  });
}
