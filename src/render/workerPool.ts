import BuildWorker from './build.worker.ts?worker&inline';
import type { TextureKey } from '../model/types';
import { setTextureFetcher } from './textures';
import { setFurnitureFetcher, type FurniturePacket } from './furnitureGeometry';
import { setOpeningFetcher } from './openings';
import type { GeoPacket } from './geoPack';
import type { Slot as PartSlot } from '../model/catalog';

/** A small pool of module workers. Jobs go to the least busy worker; texture jobs jump the queue. */
interface Slot {
  w: Worker;
  busy: number;
}
let pool: Slot[] = [];
let nextId = 1;
const waiting = new Map<number, { res: (v: any) => void; rej: (e: unknown) => void; slot: Slot }>();
const queue: { msg: any; res: (v: any) => void; rej: (e: unknown) => void; prio: boolean }[] = [];
const MAX_PER_WORKER = 2;

function pump() {
  while (queue.length) {
    const slot = pool.reduce((a, b) => (b.busy < a.busy ? b : a));
    if (slot.busy >= MAX_PER_WORKER) return;
    const job = queue.shift()!;
    const id = nextId++;
    slot.busy++;
    waiting.set(id, { res: job.res, rej: job.rej, slot });
    slot.w.postMessage({ ...job.msg, id });
  }
}

function run<T>(msg: any, prio = false): Promise<T> {
  return new Promise<T>((res, rej) => {
    const j = { msg, res, rej, prio };
    if (prio) {
      const at = queue.findIndex((q) => !q.prio);
      queue.splice(at < 0 ? queue.length : at, 0, j);
    } else queue.push(j);
    pump();
  });
}

/** Start the pool and route texture painting and furniture building through it. Returns false where workers are unavailable. */
export function startWorkers(land: (apply: () => void) => void): boolean {
  if (pool.length) return true;
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') return false;
  const n = Math.max(2, Math.min(4, (navigator.hardwareConcurrency || 4) - 1));
  try {
    for (let i = 0; i < n; i++) {
      const w = new BuildWorker();
      const slot: Slot = { w, busy: 0 };
      w.onmessage = (e) => {
        const r = waiting.get(e.data.id);
        if (!r) return;
        waiting.delete(e.data.id);
        r.slot.busy--;
        if (e.data.ok) r.res(e.data);
        else r.rej(e.data.error);
        pump();
      };
      w.onerror = (ev) => {
        console.warn('build worker failed; falling back to the main thread', (ev as ErrorEvent).message ?? ev);
        // a broken worker: fail its jobs so callers fall back to the main thread
        for (const [id, r] of waiting) if (r.slot === slot) (waiting.delete(id), r.rej('worker error'));
        slot.busy = 99;
      };
      pool.push(slot);
    }
  } catch {
    pool = [];
    return false;
  }
  setTextureFetcher((key: TextureKey) => run<{ bitmap: ImageBitmap }>({ type: 'tex', key }, true).then((r) => r.bitmap), land);
  setOpeningFetcher((op, T, q) => run<{ result: { packet: GeoPacket; slots: PartSlot[] } | null }>({ type: 'opening', op, T, q }, true).then((r) => r.result));
  setFurnitureFetcher((catalogId, w, d, h, q) => run<{ packet: FurniturePacket | null }>({ type: 'furn', catalogId, w, d, h, q }).then((r) => r.packet));
  return true;
}
