import { create } from 'zustand';
import { createStarterProject } from '../model/starter';
import { DEFAULT_VIEW, parseProject, serializeProject } from '../model/serialize';
import { newId, putProject } from './library';
import { thumbBus } from '../viewport/thumbBus';
import { CATALOG_BY_ID } from '../model/catalog';
import { validateOpening, validateWall } from '../model/validate';
import { wallLength } from '../model/arch';
import type { EntityKind, Id, Opening, Project, Selection, Vec2, ViewSettings, Wall } from '../model/types';
import { commit, redo as histRedo, undo as histUndo, type HistoryState } from './history';
import { formatLength } from '../model/units';

export const AUTOSAVE_KEY = 'farmhouse-editor.autosave.v1';

export type Tool = 'select' | 'wall' | 'place' | 'door' | 'window';
export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

export interface Toast {
  id: number;
  kind: 'info' | 'error' | 'success';
  text: string;
}

export interface Placing {
  catalogId: string;
  rotationY: number;
}

interface Store {
  hist: HistoryState;
  selection: Selection | null;
  /** multi-select: every selected item, primary last. Empty when one or nothing is selected. */
  group: Selection[];
  /** touch: taps add to the selection instead of replacing it */
  addMode: boolean;
  hover: Selection | null;
  tool: Tool;
  placing: Placing | null;
  doorStyle: 'single' | 'double' | 'sliding' | 'garage' | 'cased';
  windowStyle: 'fixed' | 'casement' | 'transom';
  save: { status: SaveStatus; at: number | null; message?: string };
  toasts: Toast[];
  dialog: null | 'reset' | 'import-error' | 'help' | 'export';
  importErrors: string[];
  /** bumps when a viewport should reset its camera */
  resetViewNonce: number;
  /** image export request */
  exportRequest: { nonce: number; scale: number } | null;
  /** hint text shown in the status bar */
  hint: string;
  /** walkthrough position reset nonce */
  walkResetNonce: number;
  walkLocked: boolean;
  /** walk mode finish picker is open (mouse released) */
  walkPalette: boolean;
  walkInfo: { floor: string; x: number; z: number; y: number; door?: { name: string; open: boolean } | null } | null;
  /** pointer position in plan, for status display */
  cursor: Vec2 | null;
  wallDraft: { start: Vec2 } | null;
  leftTab: 'levels' | 'hierarchy' | 'catalog';

  // derived
  project: () => Project;

  // actions
  edit: (label: string, recipe: (d: Project) => void, key?: string) => void;
  undo: () => void;
  redo: () => void;
  setView: (patch: Partial<ViewSettings>) => void;
  select: (s: Selection | null) => void;
  toggleInGroup: (s: Selection) => void;
  selectMany: (list: Selection[]) => void;
  setHover: (s: Selection | null) => void;
  setTool: (t: Tool) => void;
  startPlacing: (catalogId: string) => void;
  cancel: () => void;
  toast: (kind: Toast['kind'], text: string) => void;
  dismissToast: (id: number) => void;
  setDialog: (d: Store['dialog']) => void;
  loadText: (text: string) => boolean;
  loadProject: (p: Project, label?: string) => void;
  renameProject: (name: string) => void;
  resetToStarter: () => void;
  markSaved: (at: number) => void;
  setHint: (t: string) => void;
  setCursor: (c: Vec2 | null) => void;
  setWallDraft: (d: Store['wallDraft']) => void;
  setLeftTab: (t: Store['leftTab']) => void;
  requestExport: (scale: number) => void;
  resetView: () => void;
  resetWalk: () => void;

  // entity commands
  moveFurniture: (id: Id, pos: Vec2, key?: string) => void;
  rotateFurniture: (id: Id, rotationY: number, key?: string) => void;
  resizeFurniture: (id: Id, size: { w?: number; d?: number; h?: number }, key?: string) => void;
  addFurniture: (catalogId: string, levelId: Id, pos: Vec2, rotationY: number) => Id | null;
  addWall: (levelId: Id, a: Vec2, b: Vec2) => Id | null;
  addOpening: (op: Opening) => string[];
  updateOpening: (id: Id, patch: Partial<Opening>, key?: string) => string[];
  duplicateSelected: () => void;
  deleteSelected: () => void;
  toggleLock: () => void;
  toggleHidden: () => void;
  updateWall: (id: Id, patch: Partial<Wall>, key?: string) => string[];
}

/** First visit on a phone or tablet starts at Medium with a perspective camera; the settings are the person's after that. */
export function deviceDefaults(project: Project): Project {
  if (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches) return { ...project, view: { ...project.view, quality: 'medium', mode: 'persp', showGrid: false } };
  return project;
}

/** True when this device already had a working copy before this launch. */
export let hadWorkingCopy = false;

function loadInitial(): { project: Project; message?: string } {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(AUTOSAVE_KEY) : null;
    if (raw) {
      const r = parseProject(raw);
      if (r.ok) {
        hadWorkingCopy = true;
        return { project: r.project };
      }
      return { project: createStarterProject(), message: `Saved project could not be restored (${r.errors[0]}). Loaded the starter house.` };
    }
  } catch {
    /* storage unavailable */
  }
  return { project: deviceDefaults({ ...createStarterProject(), id: newId(), name: 'My Farmhouse' }) };
}

const initial = loadInitial();
// ?q=low|medium|high forces the render tier at startup (slow GPUs, automated captures)
{
  const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('q') : null;
  if (q === 'low' || q === 'medium' || q === 'high') initial.project = { ...initial.project, view: { ...initial.project.view, quality: q } };
}
let toastId = 1;
let lastCursor: Vec2 | null = null;
export const getCursor = () => lastCursor;

const kindMap: Record<EntityKind, keyof Project | null> = {
  level: 'levels',
  wall: 'walls',
  opening: 'openings',
  slab: 'slabs',
  room: 'rooms',
  stair: 'stairs',
  roof: 'roofs',
  furniture: 'furniture',
};

function uid(prefix: string, existing: Record<string, unknown>): Id {
  let n = Object.keys(existing).length + 1;
  let id = `${prefix}-${String(n).padStart(3, '0')}`;
  while (existing[id]) id = `${prefix}-${String(++n).padStart(3, '0')}`;
  return id;
}

export const useStore = create<Store>((set, get) => ({
  hist: { project: initial.project, past: [], future: [] },
  selection: null,
  group: [],
  addMode: false,
  hover: null,
  tool: 'select',
  placing: null,
  doorStyle: 'single',
  windowStyle: 'casement',
  save: { status: 'saved', at: null },
  toasts: initial.message ? [{ id: toastId++, kind: 'error', text: initial.message }] : [],
  dialog: null,
  importErrors: [],
  resetViewNonce: 0,
  exportRequest: null,
  hint: '',
  walkResetNonce: 0,
  walkLocked: false,
  walkPalette: false,
  walkInfo: null,
  cursor: null,
  wallDraft: null,
  leftTab: 'levels',

  project: () => get().hist.project,

  edit: (label, recipe, key) => {
    const next = commit(get().hist, label, recipe, { key });
    if (next !== get().hist) set({ hist: next, save: { ...get().save, status: 'unsaved' } });
  },
  undo: () => {
    const s = get();
    const next = histUndo(s.hist);
    if (next === s.hist) return;
    const sel = s.selection;
    const stillThere = sel ? !!(next.project as any)[kindMap[sel.kind]!]?.[sel.id] : true;
    const group = s.group.filter((g) => !!(next.project as any)[kindMap[g.kind]!]?.[g.id]);
    set({ hist: next, selection: stillThere ? sel : null, group: group.length > 1 ? group : [], save: { ...s.save, status: 'unsaved' } });
  },
  redo: () => {
    const s = get();
    const next = histRedo(s.hist);
    if (next === s.hist) return;
    const sel = s.selection;
    const stillThere = sel ? !!(next.project as any)[kindMap[sel.kind]!]?.[sel.id] : true;
    const group = s.group.filter((g) => !!(next.project as any)[kindMap[g.kind]!]?.[g.id]);
    set({ hist: next, selection: stillThere ? sel : null, group: group.length > 1 ? group : [], save: { ...s.save, status: 'unsaved' } });
  },
  setView: (patch) => {
    const s = get();
    const view = { ...s.hist.project.view, ...patch };
    set({ hist: { ...s.hist, project: { ...s.hist.project, view } }, save: { ...s.save, status: 'unsaved' } });
  },
  select: (selection) => set({ selection, group: [], ...(selection ? {} : { addMode: false }) }),
  toggleInGroup: (it) => {
    const s = get();
    const base = s.group.length ? s.group : s.selection ? [s.selection] : [];
    const has = base.some((g) => g.kind === it.kind && g.id === it.id);
    const list = has ? base.filter((g) => !(g.kind === it.kind && g.id === it.id)) : [...base, it];
    set({ group: list.length > 1 ? list : [], selection: list.length ? list[list.length - 1] : null });
  },
  selectMany: (list) => set({ group: list.length > 1 ? list : [], selection: list.length ? list[list.length - 1] : null }),
  setHover: (hover) => {
    const h = get().hover;
    if (h?.id === hover?.id && h?.kind === hover?.kind) return;
    set({ hover });
  },
  setTool: (tool) => set({ tool, placing: tool === 'place' ? get().placing : null, wallDraft: null }),
  startPlacing: (catalogId) => set({ tool: 'place', placing: { catalogId, rotationY: 0 }, selection: null, group: [], wallDraft: null }),
  cancel: () => {
    const s = get();
    if (s.dialog) return set({ dialog: null });
    if (s.wallDraft) return set({ wallDraft: null });
    if (s.tool !== 'select' || s.placing) return set({ tool: 'select', placing: null, hint: '' });
    set({ selection: null, group: [] });
  },
  toast: (kind, text) => {
    const id = toastId++;
    set({ toasts: [...get().toasts.slice(-3), { id, kind, text }] });
    setTimeout(() => get().dismissToast(id), kind === 'error' ? 7000 : 3500);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  setDialog: (dialog) => set({ dialog }),

  loadText: (text) => {
    const r = parseProject(text);
    if (!r.ok) {
      set({ importErrors: r.errors, dialog: 'import-error' });
      return false;
    }
    get().loadProject(r.project, 'Imported project');
    return true;
  },
  loadProject: (project, label) => {
    set({
      hist: { project, past: [], future: [] },
      selection: null,
      group: [],
      tool: 'select',
      placing: null,
      wallDraft: null,
      save: { status: 'unsaved', at: null },
      resetViewNonce: get().resetViewNonce + 1,
    });
    if (label) get().toast('success', label);
  },
  resetToStarter: () => {
    const cur = get().hist.project;
    get().loadProject({ ...createStarterProject(), id: cur.id, name: cur.name }, 'Reset to the starter house');
    try {
      localStorage.removeItem(AUTOSAVE_KEY);
    } catch {
      /* ignore */
    }
  },
  markSaved: (at) => set({ save: { status: 'saved', at } }),
  renameProject: (name) => set((st) => ({ hist: { ...st.hist, project: { ...st.hist.project, name: name.trim() || st.hist.project.name } } })),
  setHint: (hint) => set({ hint }),
  // nothing on screen reads the cursor any more; keep it out of the reactive store so pointer moves never re-render the HUD
  setCursor: (cursor) => void (lastCursor = cursor),
  setWallDraft: (wallDraft) => set({ wallDraft }),
  setLeftTab: (leftTab) => set({ leftTab }),
  requestExport: (scale) => set({ exportRequest: { nonce: (get().exportRequest?.nonce ?? 0) + 1, scale } }),
  resetView: () => set({ resetViewNonce: get().resetViewNonce + 1 }),
  resetWalk: () => set({ walkResetNonce: get().walkResetNonce + 1 }),

  moveFurniture: (id, pos, key = 'move') => {
    const f = get().hist.project.furniture[id];
    if (!f || f.locked) return;
    get().edit('Move ' + f.name, (d) => {
      d.furniture[id].position = { x: pos.x, z: pos.z };
    }, key + id);
  },
  rotateFurniture: (id, rotationY, key = 'rotate') => {
    const f = get().hist.project.furniture[id];
    if (!f || f.locked) return;
    get().edit('Rotate ' + f.name, (d) => {
      d.furniture[id].rotationY = rotationY;
    }, key + id);
  },
  resizeFurniture: (id, size, key = 'resize') => {
    const f = get().hist.project.furniture[id];
    if (!f || f.locked) return;
    get().edit('Resize ' + f.name, (d) => {
      const s = d.furniture[id].size;
      if (size.w !== undefined) s.w = Math.max(0.05, size.w);
      if (size.d !== undefined) s.d = Math.max(0.05, size.d);
      if (size.h !== undefined) s.h = Math.max(0.02, size.h);
    }, key + id);
  },
  addFurniture: (catalogId, levelId, pos, rotationY) => {
    const item = CATALOG_BY_ID[catalogId];
    if (!item) return null;
    const p = get().hist.project;
    const id = uid('f', p.furniture);
    get().edit('Add ' + item.name, (d) => {
      d.furniture[id] = {
        id,
        name: item.name,
        catalogId,
        levelId,
        position: { x: pos.x, z: pos.z },
        elevation: item.defaultElevation ?? 0,
        rotationY,
        size: { ...item.size },
        materialOverrides: {},
      };
    });
    set({ selection: { kind: 'furniture', id } });
    return id;
  },
  addWall: (levelId, a, b) => {
    const p = get().hist.project;
    const id = uid('w', p.walls);
    const wall: Wall = {
      id,
      levelId,
      start: { x: a.x, z: a.z },
      end: { x: b.x, z: b.z },
      thickness: 0.125,
      height: null,
      kind: 'interior',
      finishA: 'paint-warm-charcoal',
      finishB: 'paint-warm-charcoal',
      capMaterialId: 'paint-warm-charcoal',
    };
    const errs = validateWall(wall);
    if (errs.length) {
      get().toast('error', errs[0]);
      return null;
    }
    get().edit('Add wall', (d) => {
      d.walls[id] = wall;
    });
    return id;
  },
  addOpening: (op) => {
    const p = get().hist.project;
    const wall = p.walls[op.wallId];
    if (!wall) return ['The host wall no longer exists.'];
    const errs = validateOpening(op, wall, p.levels[wall.levelId], p.levels, Object.values(p.openings), (m) => formatLength(m, p.view.units));
    if (errs.length) return errs;
    get().edit('Add ' + op.kind, (d) => {
      d.openings[op.id] = op;
    });
    set({ selection: { kind: 'opening', id: op.id } });
    return [];
  },
  updateOpening: (id, patch, key) => {
    const p = get().hist.project;
    const op = p.openings[id];
    if (!op) return ['Opening not found.'];
    const next = { ...op, ...patch } as Opening;
    const wall = p.walls[next.wallId];
    const errs = validateOpening(next, wall, p.levels[wall.levelId], p.levels, Object.values(p.openings), (m) => formatLength(m, p.view.units));
    if (errs.length) return errs;
    get().edit('Edit ' + op.kind, (d) => {
      Object.assign(d.openings[id], patch);
    }, key ? key + id : undefined);
    return [];
  },
  updateWall: (id, patch, key) => {
    const p = get().hist.project;
    const w = p.walls[id];
    if (!w) return ['Wall not found.'];
    const next = { ...w, ...patch };
    const errs = validateWall(next);
    // moving/shortening a wall must not strand its openings
    const ops = Object.values(p.openings).filter((o) => o.wallId === id);
    const L = wallLength(next);
    for (const o of ops) if (o.offset + o.width > L + 1e-6) errs.push(`The wall would be shorter than its ${o.kind} (${o.name ?? o.id}). Move or delete the ${o.kind} first.`);
    if (errs.length) return errs;
    get().edit('Edit wall', (d) => {
      Object.assign(d.walls[id], patch);
    }, key ? key + id : undefined);
    return [];
  },

  duplicateSelected: () => {
    const s = get();
    const sel = s.selection;
    if (!sel) return;
    const p = s.hist.project;
    if (sel.kind === 'furniture') {
      const f = p.furniture[sel.id];
      if (!f) return;
      const id = uid('f', p.furniture);
      s.edit('Duplicate ' + f.name, (d) => {
        d.furniture[id] = JSON.parse(JSON.stringify({ ...f, id, locked: false, position: { x: f.position.x - 0.3, z: f.position.z + 0.3 } }));
      });
      set({ selection: { kind: 'furniture', id } });
    } else if (sel.kind === 'wall') {
      const w = p.walls[sel.id];
      if (!w) return;
      const id = uid('w', p.walls);
      s.edit('Duplicate wall', (d) => {
        d.walls[id] = JSON.parse(JSON.stringify({ ...w, id, locked: false, start: { x: w.start.x - 0.5, z: w.start.z + 0.5 }, end: { x: w.end.x - 0.5, z: w.end.z + 0.5 } }));
      });
      set({ selection: { kind: 'wall', id } });
    } else {
      s.toast('info', 'Only furniture and walls can be duplicated.');
    }
  },
  deleteSelected: () => {
    const s = get();
    if (s.group.length > 1) {
      const p = s.hist.project;
      const list = s.group.filter((g) => {
        const coll = kindMap[g.kind];
        const ent = coll && (p as any)[coll][g.id];
        return ent && !ent.locked && !['level', 'room', 'roof', 'stair', 'slab'].includes(g.kind);
      });
      const skipped = s.group.length - list.length;
      if (!list.length) return s.toast('info', 'Nothing in the selection can be deleted.');
      s.edit(`Delete ${list.length} items`, (d) => {
        for (const g of list) {
          delete (d as any)[kindMap[g.kind]!][g.id];
          if (g.kind === 'wall') for (const o of Object.values(d.openings)) if (o.wallId === g.id) delete d.openings[o.id];
        }
      });
      set({ selection: null, group: [] });
      if (skipped) s.toast('info', `${skipped} locked or fixed item${skipped > 1 ? 's were' : ' was'} kept.`);
      return;
    }
    const sel = s.selection;
    if (!sel) return;
    const p = s.hist.project;
    const coll = kindMap[sel.kind];
    if (!coll || sel.kind === 'level') {
      s.toast('info', 'Levels cannot be deleted from here.');
      return;
    }
    const ent = (p as any)[coll][sel.id];
    if (!ent) return;
    if (ent.locked) {
      s.toast('error', 'That item is locked. Unlock it first.');
      return;
    }
    s.edit('Delete ' + (ent.name ?? sel.kind), (d) => {
      delete (d as any)[coll][sel.id];
      if (sel.kind === 'wall') for (const o of Object.values(d.openings)) if (o.wallId === sel.id) delete d.openings[o.id];
    });
    set({ selection: null, group: [] });
  },
  toggleLock: () => {
    const s = get();
    const sel = s.selection;
    if (!sel) return;
    const coll = kindMap[sel.kind];
    if (!coll || !['wall', 'opening', 'furniture'].includes(sel.kind)) return s.toast('info', 'Only walls, openings and furniture can be locked.');
    s.edit('Toggle lock', (d) => {
      const e = (d as any)[coll][sel.id];
      e.locked = !e.locked;
    });
  },
  toggleHidden: () => {
    const s = get();
    const sel = s.selection;
    if (!sel) return;
    const coll = kindMap[sel.kind];
    if (!coll || sel.kind === 'level') return;
    s.edit('Toggle visibility', (d) => {
      const e = (d as any)[coll][sel.id];
      e.hidden = !e.hidden;
    });
  },
}));

export { DEFAULT_VIEW, serializeProject };

let pristine: Project | null = null;
/** The next project object put into the store was just loaded, not edited: do not count it as a change. */
export function markPristine(p: Project) {
  pristine = p;
}
/** Write the open house to the library right now (used before switching houses or going Home). */
export async function saveNow(withThumb = false): Promise<void> {
  const p = useStore.getState().hist.project;
  const thumb = withThumb ? thumbBus.grab?.() : undefined;
  try {
    localStorage.setItem(AUTOSAVE_KEY, serializeProject(p, true));
  } catch {
    /* quota: the library copy below is the one that counts */
  }
  await putProject(p, thumb ? { thumb } : {});
  useStore.getState().markSaved(Date.now());
}

/** Autosave: debounced write of the open house to the library (and a quick local copy for the next launch). */
export function startAutosave(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let last = useStore.getState().hist.project;
  const write = async () => {
    try {
      await saveNow();
    } catch (e) {
      useStore.setState({ save: { status: 'error', at: null, message: e instanceof Error ? e.message : 'Storage unavailable' } });
    }
  };
  const unsub = useStore.subscribe((s) => {
    if (s.hist.project === last) return;
    last = s.hist.project;
    if (pristine === last) {
      pristine = null;
      clearTimeout(timer);
      return;
    }
    useStore.setState({ save: { ...s.save, status: 'saving' } });
    clearTimeout(timer);
    timer = setTimeout(write, 600);
  });
  // phones kill background tabs without warning: save as the page is hidden
  const hide = () => {
    if (document.visibilityState === 'hidden') void write();
  };
  document.addEventListener('visibilitychange', hide);
  return () => {
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', hide);
    unsub();
  };
}
