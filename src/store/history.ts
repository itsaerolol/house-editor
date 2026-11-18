import { applyPatches, enablePatches, produceWithPatches, type Patch } from 'immer';
import type { Project } from '../model/types';

enablePatches();

export interface HistoryEntry {
  label: string;
  patches: Patch[];
  inverse: Patch[];
  key?: string;
  time: number;
}

export interface HistoryState {
  project: Project;
  past: HistoryEntry[];
  future: HistoryEntry[];
}

export const COALESCE_MS = 900;
export const MAX_HISTORY = 200;

export interface CommitOptions {
  /** consecutive commits with the same key inside COALESCE_MS merge into one undo step.
   *  Keys starting with 'g:' identify one pointer gesture and merge with no time limit. */
  key?: string;
  now?: number;
}

/**
 * Apply `recipe` as one reversible command. Starting a new command clears the redo branch.
 * Returns the same state object when the recipe changed nothing.
 */
export function commit(
  state: HistoryState,
  label: string,
  recipe: (draft: Project) => void,
  opts: CommitOptions = {},
): HistoryState {
  const [next, patches, inverse] = produceWithPatches(state.project, recipe);
  if (patches.length === 0) return state;
  const now = opts.now ?? Date.now();
  const last = state.past[state.past.length - 1];
  if (opts.key && last && last.key === opts.key && (opts.key.startsWith('g:') || now - last.time < COALESCE_MS) && state.future.length === 0) {
    const merged: HistoryEntry = {
      label: last.label,
      key: last.key,
      time: now,
      patches: [...last.patches, ...patches],
      inverse: [...inverse, ...last.inverse],
    };
    return { project: next, past: [...state.past.slice(0, -1), merged], future: [] };
  }
  const entry: HistoryEntry = { label, patches, inverse, key: opts.key, time: now };
  const past = [...state.past, entry];
  if (past.length > MAX_HISTORY) past.shift();
  return { project: next, past, future: [] };
}

export function undo(state: HistoryState): HistoryState {
  const entry = state.past[state.past.length - 1];
  if (!entry) return state;
  return {
    project: applyPatches(state.project, entry.inverse),
    past: state.past.slice(0, -1),
    future: [entry, ...state.future],
  };
}

export function redo(state: HistoryState): HistoryState {
  const entry = state.future[0];
  if (!entry) return state;
  return {
    project: applyPatches(state.project, entry.patches),
    past: [...state.past, { ...entry, time: 0 }],
    future: state.future.slice(1),
  };
}

export const canUndo = (s: HistoryState) => s.past.length > 0;
export const canRedo = (s: HistoryState) => s.future.length > 0;
