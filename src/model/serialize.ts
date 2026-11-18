import type { Project, ViewSettings } from './types';
import { buildMaterialRecord } from './materials';

export const FORMAT = 'farmhouse-editor.project';
export const SCHEMA_VERSION = 1;

export const DEFAULT_VIEW: ViewSettings = {
  units: 'imperial',
  gridSpacing: 0.3048,
  rotationSnap: 15,
  snapEnabled: true,
  showGrid: true,
  showAxes: false,
  showRoof: true,
  showCeilings: true,
  showFurniture: true,
  showLabels: true,
  showDimensions: true,
  showSite: true,
  levelFilter: 'all',
  activeLevelId: 'L1',
  isolateActive: false,
  cutaway: false,
  cutHeight: 1.45,
  ghostLower: true,
  quality: 'high',
  mode: 'iso',
  isoCorner: 'se',
  timeOfDay: 'day',
};

export interface ProjectFile {
  format: typeof FORMAT;
  version: number;
  savedAt: string;
  project: Project;
}

export function serializeProject(project: Project, compact = false): string {
  const file: ProjectFile = { format: FORMAT, version: SCHEMA_VERSION, savedAt: new Date().toISOString(), project };
  return compact ? JSON.stringify(file) : JSON.stringify(file, null, 2);
}

export type ParseResult =
  | { ok: true; project: Project; warnings: string[] }
  | { ok: false; errors: string[] };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

function checkVec(v: unknown, path: string, errs: string[]) {
  if (!isObj(v) || !isNum(v.x) || !isNum(v.z)) errs.push(`${path} must be {x, z} with finite numbers`);
}
function checkPoly(v: unknown, path: string, errs: string[], min = 3) {
  if (!Array.isArray(v) || v.length < min) {
    errs.push(`${path} must be a list of at least ${min} points`);
    return;
  }
  v.forEach((p, i) => checkVec(p, `${path}[${i}]`, errs));
}

/** Structural validation of an arbitrary JSON value as a Project. */
export function validateProjectShape(p: unknown): string[] {
  const errs: string[] = [];
  if (!isObj(p)) return ['project must be an object'];
  if (!isStr(p.id)) errs.push('project.id must be a non-empty string');
  if (typeof p.name !== 'string') errs.push('project.name must be a string');
  for (const key of ['levels', 'walls', 'openings', 'slabs', 'rooms', 'stairs', 'roofs', 'furniture', 'materials']) {
    if (!isObj(p[key])) errs.push(`project.${key} must be an object keyed by id`);
  }
  if (!Array.isArray(p.levelOrder) || p.levelOrder.length === 0) errs.push('project.levelOrder must be a non-empty list');
  if (errs.length) return errs;

  const levels = p.levels as Record<string, any>;
  const walls = p.walls as Record<string, any>;
  const mats = p.materials as Record<string, any>;
  const matOk = (id: unknown, path: string) => {
    if (!isStr(id) || !mats[id]) errs.push(`${path} references missing material "${String(id)}"`);
  };

  for (const id of p.levelOrder as unknown[]) {
    if (typeof id !== 'string' || !levels[id]) errs.push(`levelOrder references missing level "${String(id)}"`);
  }
  for (const [id, l] of Object.entries(levels)) {
    const path = `levels["${id}"]`;
    if (!isObj(l)) {
      errs.push(`${path} must be an object`);
      continue;
    }
    if (l.id !== id) errs.push(`${path}.id must equal its key`);
    if (!isNum(l.elevation)) errs.push(`${path}.elevation must be a number`);
    if (!isNum(l.ceilingHeight) || l.ceilingHeight <= 0) errs.push(`${path}.ceilingHeight must be a positive number`);
    if (!isNum(l.slabThickness) || l.slabThickness <= 0) errs.push(`${path}.slabThickness must be a positive number`);
  }
  const site = p.site as any;
  if (!isObj(site)) errs.push('project.site must be an object');
  else {
    for (const k of ['minX', 'maxX', 'minZ', 'maxZ', 'frontDrop', 'rearDrop', 'rampStartZ', 'rampEndZ'])
      if (!isNum(site[k])) errs.push(`project.site.${k} must be a number`);
    if (typeof site.frontLevelId !== 'string' || !levels[site.frontLevelId]) errs.push('project.site.frontLevelId references a missing level');
    if (typeof site.rearLevelId !== 'string' || !levels[site.rearLevelId]) errs.push('project.site.rearLevelId references a missing level');
    matOk(site.groundMaterialId, 'project.site.groundMaterialId');
  }
  for (const [id, m] of Object.entries(mats)) {
    const path = `materials["${id}"]`;
    if (!isObj(m) || typeof m.color !== 'string') errs.push(`${path} needs a color string`);
  }
  for (const [id, w] of Object.entries(walls)) {
    const path = `walls["${id}"]`;
    if (!isObj(w)) {
      errs.push(`${path} must be an object`);
      continue;
    }
    if (w.id !== id) errs.push(`${path}.id must equal its key`);
    if (typeof w.levelId !== 'string' || !levels[w.levelId]) errs.push(`${path}.levelId references a missing level`);
    checkVec(w.start, `${path}.start`, errs);
    checkVec(w.end, `${path}.end`, errs);
    if (!isNum(w.thickness) || w.thickness <= 0) errs.push(`${path}.thickness must be a positive number`);
    if (w.height !== null && (!isNum(w.height) || w.height <= 0)) errs.push(`${path}.height must be null or a positive number`);
    matOk(w.finishA, `${path}.finishA`);
    matOk(w.finishB, `${path}.finishB`);
    matOk(w.capMaterialId, `${path}.capMaterialId`);
  }
  for (const [id, o] of Object.entries(p.openings as Record<string, any>)) {
    const path = `openings["${id}"]`;
    if (!isObj(o)) {
      errs.push(`${path} must be an object`);
      continue;
    }
    if (o.id !== id) errs.push(`${path}.id must equal its key`);
    if (o.kind !== 'door' && o.kind !== 'window') errs.push(`${path}.kind must be "door" or "window"`);
    if (typeof o.wallId !== 'string' || !walls[o.wallId]) errs.push(`${path}.wallId references a missing wall`);
    for (const k of ['offset', 'width', 'height', 'sill']) if (!isNum(o[k])) errs.push(`${path}.${k} must be a number`);
    if (isNum(o.width) && o.width <= 0) errs.push(`${path}.width must be positive`);
    if (isNum(o.height) && o.height <= 0) errs.push(`${path}.height must be positive`);
    matOk(o.frameMaterialId, `${path}.frameMaterialId`);
  }
  for (const [id, s] of Object.entries(p.slabs as Record<string, any>)) {
    const path = `slabs["${id}"]`;
    if (!isObj(s)) {
      errs.push(`${path} must be an object`);
      continue;
    }
    if (typeof s.levelId !== 'string' || !levels[s.levelId]) errs.push(`${path}.levelId references a missing level`);
    checkPoly(s.outline, `${path}.outline`, errs);
    if (!Array.isArray(s.holes)) errs.push(`${path}.holes must be a list`);
    else s.holes.forEach((h: unknown, i: number) => checkPoly(h, `${path}.holes[${i}]`, errs));
    matOk(s.topMaterialId, `${path}.topMaterialId`);
    matOk(s.sideMaterialId, `${path}.sideMaterialId`);
  }
  for (const [id, r] of Object.entries(p.rooms as Record<string, any>)) {
    const path = `rooms["${id}"]`;
    if (!isObj(r)) {
      errs.push(`${path} must be an object`);
      continue;
    }
    if (typeof r.levelId !== 'string' || !levels[r.levelId]) errs.push(`${path}.levelId references a missing level`);
    checkPoly(r.outline, `${path}.outline`, errs);
    matOk(r.floorMaterialId, `${path}.floorMaterialId`);
  }
  for (const [id, s] of Object.entries(p.stairs as Record<string, any>)) {
    const path = `stairs["${id}"]`;
    if (!isObj(s)) {
      errs.push(`${path} must be an object`);
      continue;
    }
    if (!Array.isArray(s.levelIds) || s.levelIds.length < 2 || s.levelIds.some((l: unknown) => typeof l !== 'string' || !levels[l]))
      errs.push(`${path}.levelIds must list at least two existing levels`);
    checkVec(s.origin, `${path}.origin`, errs);
    checkVec(s.dir, `${path}.dir`, errs);
    checkVec(s.side, `${path}.side`, errs);
    for (const k of ['laneWidth', 'treadDepth', 'landingDepth']) if (!isNum(s[k]) || s[k] <= 0) errs.push(`${path}.${k} must be positive`);
    if (!isNum(s.risersPerFlight) || s.risersPerFlight < 2) errs.push(`${path}.risersPerFlight must be at least 2`);
  }
  for (const [id, r] of Object.entries(p.roofs as Record<string, any>)) {
    const path = `roofs["${id}"]`;
    if (!isObj(r)) {
      errs.push(`${path} must be an object`);
      continue;
    }
    if (typeof r.levelId !== 'string' || !levels[r.levelId]) errs.push(`${path}.levelId references a missing level`);
    checkVec(r.center, `${path}.center`, errs);
    checkVec(r.size, `${path}.size`, errs);
    if (r.ridgeAxis !== 'x' && r.ridgeAxis !== 'z') errs.push(`${path}.ridgeAxis must be "x" or "z"`);
    if (!isNum(r.pitch) || r.pitch <= 0) errs.push(`${path}.pitch must be positive`);
  }
  for (const [id, f] of Object.entries(p.furniture as Record<string, any>)) {
    const path = `furniture["${id}"]`;
    if (!isObj(f)) {
      errs.push(`${path} must be an object`);
      continue;
    }
    if (f.id !== id) errs.push(`${path}.id must equal its key`);
    if (typeof f.catalogId !== 'string') errs.push(`${path}.catalogId must be a string`);
    if (typeof f.levelId !== 'string' || !levels[f.levelId]) errs.push(`${path}.levelId references a missing level`);
    checkVec(f.position, `${path}.position`, errs);
    if (!isNum(f.rotationY)) errs.push(`${path}.rotationY must be a number`);
    if (!isObj(f.size) || !isNum(f.size.w) || !isNum(f.size.d) || !isNum(f.size.h) || f.size.w <= 0 || f.size.d <= 0 || f.size.h <= 0)
      errs.push(`${path}.size must be {w, d, h} with positive numbers`);
    if (!isObj(f.materialOverrides)) errs.push(`${path}.materialOverrides must be an object`);
    else for (const [slot, mid] of Object.entries(f.materialOverrides)) matOk(mid, `${path}.materialOverrides.${slot}`);
  }
  return errs;
}

export function parseProject(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: [`File is not valid JSON: ${(e as Error).message}`] };
  }
  if (!isObj(raw)) return { ok: false, errors: ['Top level of the file must be an object'] };
  if (raw.format !== FORMAT)
    return { ok: false, errors: [`Not a farmhouse editor project (expected format "${FORMAT}", found ${JSON.stringify(raw.format)})`] };
  if (!isNum(raw.version)) return { ok: false, errors: ['Missing numeric "version" field'] };
  if (raw.version > SCHEMA_VERSION)
    return { ok: false, errors: [`File version ${raw.version} is newer than this editor supports (${SCHEMA_VERSION}). Update the editor.`] };
  const errs = validateProjectShape(raw.project);
  if (errs.length) return { ok: false, errors: errs.slice(0, 25).concat(errs.length > 25 ? [`...and ${errs.length - 25} more problems`] : []) };
  const project = raw.project as Project;
  const warnings: string[] = [];
  const view = { ...DEFAULT_VIEW, ...(isObj(project.view) ? (project.view as Partial<ViewSettings>) : {}) };
  if (!project.levels[view.activeLevelId]) {
    view.activeLevelId = project.levelOrder[0];
    warnings.push('Active level was missing; reset to the first level.');
  }
  if (view.levelFilter !== 'all' && !project.levels[view.levelFilter]) view.levelFilter = 'all';
  // Built-in material definitions are a library, not user data: always take the current versions.
  const materials = { ...project.materials, ...buildMaterialRecord() };
  return { ok: true, project: { ...project, view, materials }, warnings };
}
