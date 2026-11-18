import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CATALOG_BY_ID, FIXED_SLOT_MATERIAL, type Slot } from '../model/catalog';
import { buildPart } from './partGeometry';
import type { FurnitureInstance, Id } from '../model/types';

export const SLOT_ORDER: Slot[] = ['primary', 'secondary', 'accent', 'metal', 'brass', 'chrome', 'rubber', 'ceramic', 'cloth', 'paper', 'shade', 'plastic', 'soil', 'bark', 'foliage', 'leaf', 'leafdark', 'needle', 'amber', 'screen', 'mirror', 'water', 'glow', 'ember', 'fire', 'glass'];

export interface FurnitureGeo {
  geometry: THREE.BufferGeometry;
  /** slot for each draw group, in group order */
  slots: Slot[];
  /** local bounding box (item bottom-center origin) */
  bbox: THREE.Box3;
}

const cache = new Map<string, FurnitureGeo>();

export const furnitureKey = (catalogId: string, w: number, d: number, h: number, quality: number) => `${catalogId}|${w.toFixed(3)}|${d.toFixed(3)}|${h.toFixed(3)}|${quality}`;

function remember(key: string, out: FurnitureGeo) {
  cache.set(key, out);
  if (cache.size > 400) {
    const first = cache.keys().next().value as string;
    cache.get(first)?.geometry.dispose();
    cache.delete(first);
  }
}

/** Cached geometry if it is already built (no work). */
export function peekFurnitureGeometry(catalogId: string, w: number, d: number, h: number, quality = 2): FurnitureGeo | null {
  return cache.get(furnitureKey(catalogId, w, d, h, quality)) ?? null;
}

/** Synchronous build (preview tools, tests and the worker). The app uses requestFurnitureGeometry. */
export function getFurnitureGeometry(catalogId: string, w: number, d: number, h: number, quality = 2): FurnitureGeo | null {
  const key = furnitureKey(catalogId, w, d, h, quality);
  const hit = cache.get(key);
  if (hit) return hit;
  const out = buildFurnitureGeometry(catalogId, w, d, h, quality);
  if (out) remember(key, out);
  return out;
}

export function buildFurnitureGeometry(catalogId: string, w: number, d: number, h: number, quality = 2): FurnitureGeo | null {
  const item = CATALOG_BY_ID[catalogId];
  if (!item) return null;
  const parts = item.parts(w, d, h, quality);
  const bySlot = new Map<Slot, THREE.BufferGeometry[]>();
  for (const p of parts) {
    const arr = bySlot.get(p.slot) ?? [];
    arr.push(buildPart(p, quality));
    bySlot.set(p.slot, arr);
  }
  const slots: Slot[] = [];
  const merged: THREE.BufferGeometry[] = [];
  for (const slot of SLOT_ORDER) {
    const arr = bySlot.get(slot);
    if (!arr?.length) continue;
    const m = arr.length === 1 ? arr[0] : mergeGeometries(arr, false);
    if (!m) continue;
    slots.push(slot);
    merged.push(m);
  }
  const geometry = mergeGeometries(merged, true);
  if (!geometry) return null;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return { geometry, slots, bbox: geometry.boundingBox!.clone() };
}

/* ---------------------------------------------------------------- worker transport */

export interface FurniturePacket {
  attrs: { name: string; array: Float32Array; itemSize: number }[];
  index: Uint32Array | Uint16Array | null;
  groups: { start: number; count: number; materialIndex: number }[];
  slots: Slot[];
  bbox: [number, number, number, number, number, number];
}

export function packFurniture(g: FurnitureGeo): { packet: FurniturePacket; transfer: ArrayBuffer[] } {
  const attrs: FurniturePacket['attrs'] = [];
  const transfer: ArrayBuffer[] = [];
  for (const [name, a] of Object.entries(g.geometry.attributes)) {
    const arr = (a as THREE.BufferAttribute).array as Float32Array;
    attrs.push({ name, array: arr, itemSize: (a as THREE.BufferAttribute).itemSize });
    transfer.push(arr.buffer as ArrayBuffer);
  }
  const idx = g.geometry.index ? (g.geometry.index.array as Uint32Array) : null;
  if (idx) transfer.push(idx.buffer as ArrayBuffer);
  const b = g.bbox;
  return { packet: { attrs, index: idx, groups: g.geometry.groups.map((x) => ({ start: x.start, count: x.count, materialIndex: x.materialIndex ?? 0 })), slots: g.slots, bbox: [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z] }, transfer };
}

export function unpackFurniture(p: FurniturePacket): FurnitureGeo {
  const geometry = new THREE.BufferGeometry();
  for (const a of p.attrs) geometry.setAttribute(a.name, new THREE.BufferAttribute(a.array, a.itemSize));
  if (p.index) geometry.setIndex(new THREE.BufferAttribute(p.index, 1));
  for (const g of p.groups) geometry.addGroup(g.start, g.count, g.materialIndex);
  const bbox = new THREE.Box3(new THREE.Vector3(p.bbox[0], p.bbox[1], p.bbox[2]), new THREE.Vector3(p.bbox[3], p.bbox[4], p.bbox[5]));
  geometry.boundingBox = bbox.clone();
  geometry.boundingSphere = bbox.getBoundingSphere(new THREE.Sphere());
  return { geometry, slots: p.slots, bbox };
}

type FurnFetcher = (catalogId: string, w: number, d: number, h: number, q: number) => Promise<FurniturePacket | null>;
let furnFetcher: FurnFetcher | null = null;
const inflight = new Map<string, Promise<FurnitureGeo | null>>();
export function setFurnitureFetcher(f: FurnFetcher | null) {
  furnFetcher = f;
}
export const furniturePending = () => inflight.size;

/** Geometry without blocking: cached, or built in the worker pool (falls back to building here). */
export function requestFurnitureGeometry(catalogId: string, w: number, d: number, h: number, quality = 2): Promise<FurnitureGeo | null> {
  const key = furnitureKey(catalogId, w, d, h, quality);
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  const running = inflight.get(key);
  if (running) return running;
  const job = (furnFetcher ? furnFetcher(catalogId, w, d, h, quality).then((p) => (p ? unpackFurniture(p) : null)) : Promise.resolve(buildFurnitureGeometry(catalogId, w, d, h, quality)))
    .catch(() => buildFurnitureGeometry(catalogId, w, d, h, quality))
    .then((g) => {
      inflight.delete(key);
      if (g) remember(key, g);
      return g;
    });
  inflight.set(key, job);
  return job;
}

/** Resolve the material id for a slot of an instance. */
export function slotMaterialId(inst: FurnitureInstance, slot: Slot): Id {
  const item = CATALOG_BY_ID[inst.catalogId];
  const ov = inst.materialOverrides[slot];
  if (ov) return ov;
  if (slot === 'primary' || slot === 'secondary' || slot === 'accent') return item?.slots[slot]?.default ?? 'oak-furniture';
  return FIXED_SLOT_MATERIAL[slot] ?? 'black-metal';
}
