import type { Project } from '../model/types';
import { parseProject, serializeProject } from '../model/serialize';

/* The saved-houses library: one IndexedDB record per house, on this device.
 * Each record carries the full project JSON plus what the Home screen needs to draw a card. */

export interface LibraryEntry {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  thumb: string | null;
  rooms: number;
  items: number;
}
interface Row extends LibraryEntry {
  json: string;
}

const DB = 'farmhouse-editor';
const STORE = 'projects';
let dbp: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('Storage unavailable'));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  dbp.catch(() => (dbp = null));
  return dbp;
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore, done: (v: T) => void) => void): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        let out: T;
        fn(tx.objectStore(STORE), (v) => (out = v));
        tx.oncomplete = () => resolve(out);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      }),
  );
}

const entryOf = ({ json: _j, ...e }: Row): LibraryEntry => e;

export const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8));

export async function listProjects(): Promise<LibraryEntry[]> {
  const rows = await run<Row[]>('readonly', (s, done) => {
    const r = s.getAll();
    r.onsuccess = () => done(r.result as Row[]);
  });
  return rows.map(entryOf).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function readProject(id: string): Promise<Project | null> {
  const row = await run<Row | undefined>('readonly', (s, done) => {
    const r = s.get(id);
    r.onsuccess = () => done(r.result as Row | undefined);
  });
  if (!row) return null;
  const r = parseProject(row.json);
  return r.ok ? r.project : null;
}

export async function readJson(id: string): Promise<string | null> {
  const row = await run<Row | undefined>('readonly', (s, done) => {
    const r = s.get(id);
    r.onsuccess = () => done(r.result as Row | undefined);
  });
  return row?.json ?? null;
}

/** Create or update a house. Keeps the old card picture unless a new one is given. */
export async function putProject(project: Project, opts: { thumb?: string | null; touch?: boolean; createdAt?: number } = {}): Promise<LibraryEntry> {
  const json = serializeProject(project, true);
  const now = Date.now();
  return run<LibraryEntry>('readwrite', (s, done) => {
    const g = s.get(project.id);
    g.onsuccess = () => {
      const old = g.result as Row | undefined;
      const row: Row = {
        id: project.id,
        name: project.name,
        createdAt: old?.createdAt ?? opts.createdAt ?? now,
        updatedAt: opts.touch === false && old ? old.updatedAt : now,
        thumb: opts.thumb !== undefined ? opts.thumb : old?.thumb ?? planThumb(project),
        rooms: Object.keys(project.rooms).length,
        items: Object.keys(project.furniture).length,
        json,
      };
      s.put(row);
      done(entryOf(row));
    };
  });
}

export async function hasProject(id: string): Promise<boolean> {
  return run<boolean>('readonly', (s, done) => {
    const r = s.count(id);
    r.onsuccess = () => done(r.result > 0);
  });
}

export async function deleteProject(id: string): Promise<void> {
  await run<void>('readwrite', (s, done) => {
    s.delete(id);
    done();
  });
}

export async function renameProjectRow(id: string, name: string): Promise<void> {
  const p = await readProject(id);
  if (!p) return;
  await putProject({ ...p, name }, { touch: false });
}

export async function duplicateProject(id: string): Promise<LibraryEntry | null> {
  const p = await readProject(id);
  if (!p) return null;
  return putProject({ ...p, id: newId(), name: p.name.replace(/ \(copy( \d+)?\)$/, '') + ' (copy)' });
}

/** A floor-plan picture of the main level: every house gets a card image even before a render exists. */
export function planThumb(p: Project): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const lvl = p.levelOrder.find((l) => l === 'L1') ?? p.levelOrder[Math.min(1, p.levelOrder.length - 1)];
    const walls = Object.values(p.walls).filter((w) => w.levelId === lvl);
    const W = 320;
    const H = 200;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    if (!g) return null;
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#2a3040');
    bg.addColorStop(1, '#1b1f29');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    if (walls.length) {
      let x0 = Infinity,
        x1 = -Infinity,
        z0 = Infinity,
        z1 = -Infinity;
      for (const w of walls)
        for (const v of [w.start, w.end]) {
          x0 = Math.min(x0, v.x);
          x1 = Math.max(x1, v.x);
          z0 = Math.min(z0, v.z);
          z1 = Math.max(z1, v.z);
        }
      const k = Math.min((W - 56) / Math.max(0.1, x1 - x0), (H - 56) / Math.max(0.1, z1 - z0));
      const ox = (W - (x1 - x0) * k) / 2 - x0 * k;
      const oz = (H - (z1 - z0) * k) / 2 - z0 * k;
      g.lineCap = 'round';
      g.strokeStyle = '#ffd29a';
      g.lineWidth = 3;
      g.beginPath();
      for (const w of walls) {
        g.moveTo(w.start.x * k + ox, w.start.z * k + oz);
        g.lineTo(w.end.x * k + ox, w.end.z * k + oz);
      }
      g.stroke();
    } else {
      g.strokeStyle = 'rgba(255,255,255,0.18)';
      g.lineWidth = 1.5;
      g.setLineDash([6, 6]);
      g.strokeRect(70, 45, W - 140, H - 90);
    }
    return c.toDataURL('image/jpeg', 0.8);
  } catch {
    return null;
  }
}

/** Ask the browser to keep this data when it clears space. Harmless if refused. */
export async function keepStorage(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
