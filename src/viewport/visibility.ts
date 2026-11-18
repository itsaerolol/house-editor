import type { Id, Project } from '../model/types';

export type LevelState = 'full' | 'ghost' | 'hidden';

export interface Visibility {
  level: Record<Id, LevelState>;
  /** absolute world Y at which walls on `cutLevelId` are sectioned */
  cutY?: number;
  cutLevelId?: Id;
  roofs: boolean;
  site: boolean;
  plan: boolean;
  ceilings: boolean;
  furniture: boolean;
}

/** One place that decides what is drawn for the current view settings. */
export function computeVisibility(p: Project): Visibility {
  const v = p.view;
  const order = p.levelOrder;
  const activeIdx = Math.max(0, order.indexOf(v.activeLevelId));
  const active = p.levels[v.activeLevelId] ?? p.levels[order[0]];
  const level: Record<Id, LevelState> = {};
  const plan = v.mode === 'plan';

  if (plan) {
    order.forEach((id, i) => {
      level[id] = i === activeIdx ? 'full' : i === activeIdx - 1 && v.ghostLower ? 'ghost' : 'hidden';
    });
    return { level, cutY: active.elevation + v.cutHeight, cutLevelId: active.id, roofs: false, site: false, plan: true, ceilings: false, furniture: v.showFurniture };
  }

  order.forEach((id, i) => {
    let s: LevelState = 'full';
    if (v.levelFilter !== 'all' && id !== v.levelFilter) s = 'hidden';
    if (v.isolateActive && id !== v.activeLevelId) s = 'hidden';
    if (v.cutaway && i > activeIdx) s = 'hidden';
    level[id] = s;
  });
  const everything = v.levelFilter === 'all' && !v.isolateActive;
  return {
    level,
    cutY: v.cutaway ? active.elevation + v.cutHeight : undefined,
    cutLevelId: v.cutaway ? active.id : undefined,
    roofs: v.showRoof && !v.cutaway && everything,
    site: v.showSite && everything,
    plan: false,
    ceilings: v.showCeilings,
    furniture: v.showFurniture,
  };
}
