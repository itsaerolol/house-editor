import { create } from 'zustand';
import { createStarterProject } from '../model/starter';
import { parseProject, serializeProject } from '../model/serialize';
import type { Project } from '../model/types';
import { deviceDefaults, hadWorkingCopy, markPristine, saveNow, useStore } from './store';
import { deleteProject, duplicateProject, hasProject, keepStorage, listProjects, newId, putProject, readProject, renameProjectRow, type LibraryEntry } from './library';
import { fileSafeName, saveFile } from './files';

/* Home screen state and the actions behind it: open, create, rename, copy, export, import, delete. */

interface HomeState {
  open: boolean;
  items: LibraryEntry[];
  ready: boolean;
  busy: boolean;
}
export const useHome = create<HomeState>(() => ({ open: true, items: [], ready: false, busy: false }));
const set = useHome.setState;

export async function refreshHome() {
  try {
    set({ items: await listProjects(), ready: true });
  } catch {
    set({ ready: true });
  }
}

const toast = (k: 'success' | 'error' | 'info', t: string) => useStore.getState().toast(k, t);

function adopt(project: Project, label?: string) {
  const loaded = { ...project, view: { ...project.view } };
  markPristine(loaded);
  useStore.getState().loadProject(loaded, label);
  try {
    localStorage.setItem('farmhouse-editor.autosave.v1', serializeProject(loaded, true));
  } catch {
    /* quota */
  }
}

function uniqueName(base: string, items: LibraryEntry[]) {
  const names = new Set(items.map((i) => i.name));
  if (!names.has(base)) return base;
  for (let n = 2; ; n++) if (!names.has(`${base} ${n}`)) return `${base} ${n}`;
}

/** Called once at launch: make sure the working house is in the library, restore it if the quick copy is gone, handle app shortcuts. */
export async function bootLibrary() {
  try {
    const cur = useStore.getState().hist.project;
    let items = await listProjects();
    if (!(await hasProject(cur.id))) {
      if (!hadWorkingCopy && items.length) {
        // quick copy was cleared but the library survived: pick up where the person left off
        const p = await readProject(items[0].id);
        if (p) adopt(p);
      } else {
        await putProject(cur);
      }
      items = await listProjects();
    }
    set({ items, ready: true });
    void keepStorage();
    const q = new URLSearchParams(location.search);
    const want = q.get('new');
    if (want) {
      history.replaceState(null, '', location.pathname);
      await createProject(want === 'blank' ? 'blank' : 'starter');
    } else if (q.has('home')) history.replaceState(null, '', location.pathname);
  } catch {
    set({ ready: true });
  }
}

export async function goHome() {
  const st = useStore.getState();
  try {
    document.exitPointerLock?.();
  } catch {
    /* ignore */
  }
  const m = st.hist.project.view.mode;
  const wasWalk = m === 'walk';
  // a render is only worth a card picture from a 3D view
  const thumbOk = m === 'iso' || m === 'persp';
  try {
    await saveNow(thumbOk);
  } catch {
    /* storage unavailable: the Home screen still opens */
  }
  if (wasWalk) st.setView({ mode: 'persp' });
  await refreshHome();
  set({ open: true });
}

export function closeHome() {
  set({ open: false });
}

export async function openProject(id: string) {
  if (useHome.getState().busy) return;
  set({ busy: true });
  try {
    const cur = useStore.getState().hist.project;
    if (cur.id === id) return closeHome();
    await saveNow().catch(() => {});
    const p = await readProject(id);
    if (!p) return toast('error', 'That house could not be opened.');
    adopt(p);
    closeHome();
  } finally {
    set({ busy: false });
  }
}

function blankProject(): Project {
  const p = createStarterProject();
  return { ...p, walls: {}, openings: {}, slabs: {}, rooms: {}, stairs: {}, roofs: {}, furniture: {} };
}

export async function createProject(kind: 'starter' | 'blank') {
  if (useHome.getState().busy) return;
  set({ busy: true });
  try {
    await saveNow().catch(() => {});
    const items = await listProjects().catch(() => [] as LibraryEntry[]);
    const base = kind === 'blank' ? blankProject() : createStarterProject();
    const project = deviceDefaults({ ...base, id: newId(), name: uniqueName(kind === 'blank' ? 'Blank lot' : 'My Farmhouse', items) });
    await putProject(project);
    adopt(project);
    closeHome();
    await refreshHome();
  } finally {
    set({ busy: false });
  }
}

export async function renameEntry(id: string, name: string) {
  const clean = name.trim();
  if (!clean) return;
  if (useStore.getState().hist.project.id === id) {
    useStore.getState().renameProject(clean);
    await saveNow().catch(() => {});
  } else await renameProjectRow(id, clean);
  await refreshHome();
}

export async function copyEntry(id: string) {
  if (useStore.getState().hist.project.id === id) await saveNow().catch(() => {});
  const e = await duplicateProject(id);
  await refreshHome();
  if (e) toast('success', `Copied as "${e.name}"`);
}

export async function removeEntry(id: string) {
  const wasOpen = useStore.getState().hist.project.id === id;
  await deleteProject(id);
  if (wasOpen) {
    // the library is never empty: a fresh starter takes its place
    const items = await listProjects().catch(() => [] as LibraryEntry[]);
    const project = deviceDefaults({ ...createStarterProject(), id: newId(), name: uniqueName('My Farmhouse', items) });
    await putProject(project);
    adopt(project);
  }
  await refreshHome();
  toast('info', 'House deleted');
}

export async function exportEntry(id: string) {
  const cur = useStore.getState().hist.project;
  let name = cur.name;
  let text: string | null;
  if (cur.id === id) text = serializeProject(cur);
  else {
    const p = await readProject(id);
    if (!p) return toast('error', 'That house could not be read.');
    name = p.name;
    text = serializeProject(p);
  }
  const r = await saveFile(fileSafeName(name), text);
  if (r !== 'cancelled') toast('success', r === 'shared' ? 'Choose Save to Files' : 'Saved to your downloads');
}

export async function importFiles(files: FileList | File[]) {
  const items = await listProjects().catch(() => [] as LibraryEntry[]);
  let last: Project | null = null;
  let ok = 0;
  const names = [...items.map((i) => i.name)];
  for (const f of Array.from(files)) {
    const r = parseProject(await f.text());
    if (!r.ok) {
      toast('error', `${f.name}: ${r.errors[0]}`);
      continue;
    }
    const taken = new Set(names);
    let name = r.project.name;
    for (let n = 2; taken.has(name); n++) name = `${r.project.name} ${n}`;
    names.push(name);
    last = { ...r.project, id: newId(), name };
    await putProject(last);
    ok++;
  }
  await refreshHome();
  if (ok) toast('success', ok === 1 ? `Added "${last!.name}"` : `Added ${ok} houses`);
}

