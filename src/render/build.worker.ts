/// <reference lib="webworker" />
// Off-main-thread builder: paints texture tiles (cached in IndexedDB) and builds furniture geometry.
import type { TextureKey } from '../model/types';
import { generateTextureCanvas } from './textures';
import { buildFurnitureGeometry, packFurniture } from './furnitureGeometry';
import { buildOpeningLocal } from './openings';
import { packGeometry } from './geoPack';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

/* ---------------- tiny IndexedDB cache for painted tiles */
let dbp: Promise<IDBDatabase | null> | null = null;
function db(): Promise<IDBDatabase | null> {
  if (!dbp)
    dbp = new Promise((res) => {
      try {
        const r = indexedDB.open('farmhouse-cache', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('tex');
        r.onsuccess = () => res(r.result);
        r.onerror = () => res(null);
      } catch {
        res(null);
      }
    });
  return dbp;
}
async function idbGet(k: string): Promise<Blob | null> {
  const d = await db();
  if (!d) return null;
  return new Promise((res) => {
    try {
      const q = d.transaction('tex').objectStore('tex').get(k);
      q.onsuccess = () => res((q.result as Blob) ?? null);
      q.onerror = () => res(null);
    } catch {
      res(null);
    }
  });
}
async function idbPut(k: string, v: Blob) {
  const d = await db();
  if (!d) return;
  try {
    d.transaction('tex', 'readwrite').objectStore('tex').put(v, k);
  } catch {
    /* storage full or blocked: painting again next time is fine */
  }
}

async function tile(key: TextureKey): Promise<ImageBitmap> {
  const ck = `${__TEX_HASH__}:${key}`;
  const cached = await idbGet(ck);
  if (cached) {
    try {
      return await createImageBitmap(cached, { imageOrientation: 'flipY' });
    } catch {
      /* corrupt entry: repaint */
    }
  }
  const c = generateTextureCanvas(key) as unknown as OffscreenCanvas;
  const bmp = await createImageBitmap(c, { imageOrientation: 'flipY' });
  // store after replying so the paint is never delayed by encoding
  setTimeout(() => c.convertToBlob({ type: 'image/png' }).then((b) => idbPut(ck, b), () => {}), 0);
  return bmp;
}

ctx.onmessage = async (e: MessageEvent) => {
  const m = e.data;
  try {
    if (m.type === 'tex') {
      const bmp = await tile(m.key);
      ctx.postMessage({ id: m.id, ok: true, bitmap: bmp }, [bmp]);
    } else if (m.type === 'furn') {
      const g = buildFurnitureGeometry(m.catalogId, m.w, m.d, m.h, m.q);
      if (!g) return ctx.postMessage({ id: m.id, ok: true, packet: null });
      const { packet, transfer } = packFurniture(g);
      ctx.postMessage({ id: m.id, ok: true, packet }, transfer);
    } else if (m.type === 'opening') {
      const l = buildOpeningLocal(m.op, m.T, m.q);
      if (!l) return ctx.postMessage({ id: m.id, ok: true, result: null });
      const { packet, transfer } = packGeometry(l.geometry);
      ctx.postMessage({ id: m.id, ok: true, result: { packet, slots: l.slots } }, transfer);
    }
  } catch (err) {
    ctx.postMessage({ id: m.id, ok: false, error: String(err) });
  }
};
