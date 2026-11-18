import * as THREE from 'three';

/** A BufferGeometry as plain typed arrays, for transfer between threads. */
export interface GeoPacket {
  attrs: { name: string; array: Float32Array; itemSize: number }[];
  index: Uint32Array | Uint16Array | null;
  groups: { start: number; count: number; materialIndex: number }[];
}

export function packGeometry(g: THREE.BufferGeometry): { packet: GeoPacket; transfer: ArrayBuffer[] } {
  const attrs: GeoPacket['attrs'] = [];
  const transfer: ArrayBuffer[] = [];
  for (const [name, a] of Object.entries(g.attributes)) {
    const arr = (a as THREE.BufferAttribute).array as Float32Array;
    attrs.push({ name, array: arr, itemSize: (a as THREE.BufferAttribute).itemSize });
    transfer.push(arr.buffer as ArrayBuffer);
  }
  const idx = g.index ? (g.index.array as Uint32Array) : null;
  if (idx) transfer.push(idx.buffer as ArrayBuffer);
  return { packet: { attrs, index: idx, groups: g.groups.map((x) => ({ start: x.start, count: x.count, materialIndex: x.materialIndex ?? 0 })) }, transfer };
}

export function unpackGeometry(p: GeoPacket): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  for (const a of p.attrs) g.setAttribute(a.name, new THREE.BufferAttribute(a.array, a.itemSize));
  if (p.index) g.setIndex(new THREE.BufferAttribute(p.index, 1));
  for (const x of p.groups) g.addGroup(x.start, x.count, x.materialIndex);
  return g;
}
