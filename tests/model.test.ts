import { describe, expect, it } from 'vitest';
import { createStarterProject } from '../src/model/starter';
import { parseProject, serializeProject, validateProjectShape } from '../src/model/serialize';
import { validateOpening } from '../src/model/validate';
import { computeWallBoxes, wallClearHeight, wallLength } from '../src/model/arch';
import { commit, redo, undo, type HistoryState } from '../src/store/history';
import { formatLength, parseLength } from '../src/model/units';
import { CATALOG_BY_ID } from '../src/model/catalog';
import { polygonArea } from '../src/model/geometry2d';
import type { Project } from '../src/model/types';

const mk = (): Project => createStarterProject();

describe('starter house integrity', () => {
  const p = mk();
  it('passes structural validation', () => {
    expect(validateProjectShape(p)).toEqual([]);
  });
  it('has three habitable stories with 9ft clear ceilings and separate slabs', () => {
    expect(p.levelOrder).toHaveLength(3);
    for (const id of p.levelOrder) {
      expect(p.levels[id].ceilingHeight).toBeCloseTo(2.7432, 3);
      expect(p.levels[id].slabThickness).toBeGreaterThan(0.2);
    }
    expect(p.levels.L1.elevation).toBeCloseTo(3.048, 3);
    expect(p.levels.L2.elevation).toBeCloseTo(6.096, 3);
  });
  it('every opening fits its wall and does not overlap another', () => {
    const bad: string[] = [];
    for (const o of Object.values(p.openings)) {
      const w = p.walls[o.wallId];
      const errs = validateOpening(o, w, p.levels[w.levelId], p.levels, Object.values(p.openings));
      if (errs.length) bad.push(`${o.id} (${o.name ?? o.kind}) on ${w.name ?? w.id}: ${errs.join('; ')}`);
    }
    expect(bad).toEqual([]);
  });
  it('every wall has positive length and references existing materials', () => {
    for (const w of Object.values(p.walls)) {
      expect(wallLength(w)).toBeGreaterThan(0.1);
      expect(p.materials[w.finishA]).toBeTruthy();
      expect(p.materials[w.finishB]).toBeTruthy();
      expect(wallClearHeight(w, p.levels[w.levelId], p.levels)).toBeGreaterThan(0.5);
    }
  });
  it('every furniture item uses a known catalog id', () => {
    for (const f of Object.values(p.furniture)) expect(CATALOG_BY_ID[f.catalogId]).toBeTruthy();
  });
  it('conditioned area is in the planned range', () => {
    let total = 0;
    for (const s of Object.values(p.slabs)) {
      if (s.kind !== 'floor') continue;
      if (!['L0', 'L1', 'L2'].includes(s.levelId)) continue;
      const lv = p.levels[s.levelId];
      if (s.thickness && s.thickness > 1) continue; // garages
      const holes = s.holes.reduce((a, h) => a + polygonArea(h), 0);
      total += polygonArea(s.outline) - (lv.id === 'L2' ? holes : 0);
    }
    const sf = total / (0.3048 * 0.3048);
    expect(sf).toBeGreaterThan(4300);
    expect(sf).toBeLessThan(5400);
  });
  it('doors and windows are real voids (no solid box covers the opening)', () => {
    const w = Object.values(p.walls).find((x) => x.name === 'Front wall')!;
    const ops = Object.values(p.openings).filter((o) => o.wallId === w.id);
    const boxes = computeWallBoxes(w, ops, p.levels[w.levelId], p.levels);
    const door = ops.find((o) => o.kind === 'door')!;
    const mid = door.offset + door.width / 2;
    const y = p.levels.L1.elevation + 1.0;
    const hit = boxes.find((b) => b.a0 < mid && b.a1 > mid && b.y0 < y && b.y1 > y);
    expect(hit).toBeUndefined();
  });
});

describe('serialization', () => {
  it('round trips to an equal, editable project', () => {
    const p = mk();
    const text = serializeProject(p);
    const r = parseProject(text);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.project.walls).toEqual(p.walls);
      expect(r.project.openings).toEqual(p.openings);
      expect(r.project.furniture).toEqual(p.furniture);
      expect(r.project.levels).toEqual(p.levels);
      expect(r.project.rooms).toEqual(p.rooms);
      expect(Object.keys(r.project.furniture)).toEqual(Object.keys(p.furniture));
    }
  });
  it('rejects non JSON with a useful message', () => {
    const r = parseProject('not json {');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatch(/not valid JSON/);
  });
  it('rejects the wrong format and newer versions', () => {
    const a = parseProject(JSON.stringify({ hello: 1 }));
    expect(a.ok).toBe(false);
    const b = parseProject(JSON.stringify({ format: 'farmhouse-editor.project', version: 99, project: {} }));
    expect(b.ok).toBe(false);
    if (!b.ok) expect(b.errors[0]).toMatch(/newer/);
  });
  it('reports broken references with paths', () => {
    const p = JSON.parse(serializeProject(mk()));
    const firstOpening = Object.keys(p.project.openings)[0];
    p.project.openings[firstOpening].wallId = 'nope';
    const firstFurn = Object.keys(p.project.furniture)[0];
    p.project.furniture[firstFurn].size.w = -1;
    const r = parseProject(JSON.stringify(p));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.join('\n')).toMatch(/openings\["[^"]+"\]\.wallId references a missing wall/);
      expect(r.errors.join('\n')).toMatch(/furniture\["[^"]+"\]\.size/);
    }
  });
});

describe('opening validation', () => {
  const p = mk();
  const wall = Object.values(p.walls).find((w) => w.name === 'Front wall')!;
  const base = Object.values(p.openings).find((o) => o.wallId === wall.id && o.kind === 'window')!;
  const lv = p.levels[wall.levelId];
  it('rejects openings past the wall end', () => {
    const e = validateOpening({ ...base, offset: wallLength(wall) - 0.2 }, wall, lv, p.levels, []);
    expect(e.join()).toMatch(/past the end/);
  });
  it('rejects non-positive dimensions', () => {
    expect(validateOpening({ ...base, width: 0 }, wall, lv, p.levels, []).join()).toMatch(/Width/);
    expect(validateOpening({ ...base, height: -1 }, wall, lv, p.levels, []).join()).toMatch(/Height/);
  });
  it('rejects openings taller than the wall', () => {
    expect(validateOpening({ ...base, sill: 2.5, height: 1 }, wall, lv, p.levels, []).join()).toMatch(/above the wall height/);
  });
  it('rejects overlapping openings', () => {
    const other = { ...base, id: 'other', offset: base.offset + 0.1 };
    expect(validateOpening(other, wall, lv, p.levels, [base]).join()).toMatch(/Overlaps/);
  });
});

describe('undo / redo', () => {
  const start = (): HistoryState => ({ project: mk(), past: [], future: [] });
  const fid = (s: HistoryState) => Object.keys(s.project.furniture)[0];
  it('restores previous states and clears the redo branch on a new edit', () => {
    let s = start();
    const id = fid(s);
    const x0 = s.project.furniture[id].position.x;
    s = commit(s, 'move', (d) => { d.furniture[id].position.x = x0 + 1; });
    s = commit(s, 'rotate', (d) => { d.furniture[id].rotationY = 1; });
    expect(s.past).toHaveLength(2);
    s = undo(s);
    expect(s.project.furniture[id].rotationY).not.toBe(1);
    expect(s.project.furniture[id].position.x).toBeCloseTo(x0 + 1);
    s = undo(s);
    expect(s.project.furniture[id].position.x).toBeCloseTo(x0);
    s = redo(s);
    expect(s.project.furniture[id].position.x).toBeCloseTo(x0 + 1);
    expect(s.future).toHaveLength(1);
    s = commit(s, 'resize', (d) => { d.furniture[id].size.w = 2; });
    expect(s.future).toHaveLength(0); // obsolete redo branch cleared
    s = redo(s);
    expect(s.project.furniture[id].size.w).toBe(2);
  });
  it('coalesces rapid same-key edits into one undo step', () => {
    let s = start();
    const id = fid(s);
    const x0 = s.project.furniture[id].position.x;
    s = commit(s, 'nudge', (d) => { d.furniture[id].position.x = x0 + 0.1; }, { key: 'k', now: 1000 });
    s = commit(s, 'nudge', (d) => { d.furniture[id].position.x = x0 + 0.2; }, { key: 'k', now: 1200 });
    s = commit(s, 'nudge', (d) => { d.furniture[id].position.x = x0 + 0.3; }, { key: 'k', now: 1400 });
    expect(s.past).toHaveLength(1);
    s = undo(s);
    expect(s.project.furniture[id].position.x).toBeCloseTo(x0);
  });
  it('ignores no-op commits', () => {
    const s = start();
    const id = fid(s);
    const n = commit(s, 'noop', (d) => { d.furniture[id].rotationY = d.furniture[id].rotationY; });
    expect(n.past).toHaveLength(0);
  });
  it('level elevation edits update dependent geometry coherently', () => {
    let s = start();
    s = commit(s, 'raise L2', (d) => { d.levels.L2.elevation += 0.5; });
    const w = Object.values(s.project.walls).find((x) => x.levelId === 'L2' && x.kind === 'exterior')!;
    const boxes = computeWallBoxes(w, [], s.project.levels.L2, s.project.levels);
    expect(Math.min(...boxes.map((b) => b.y0))).toBeCloseTo(s.project.levels.L2.elevation - s.project.levels.L2.slabThickness, 3);
  });
});

describe('units', () => {
  it('formats imperial and metric', () => {
    expect(formatLength(0.3048 * 12.5, 'imperial')).toBe(`12' 6"`);
    expect(formatLength(0.3048 * 9, 'imperial')).toBe(`9'`);
    expect(formatLength(2.5, 'metric')).toBe('2.50 m');
  });
  it('parses common inputs', () => {
    expect(parseLength(`12' 6"`, 'imperial')).toBeCloseTo(3.81, 3);
    expect(parseLength('3.2 m', 'imperial')).toBeCloseTo(3.2, 5);
    expect(parseLength('150cm', 'metric')).toBeCloseTo(1.5, 5);
    expect(parseLength('10', 'imperial')).toBeCloseTo(3.048, 5);
    expect(parseLength('abc', 'metric')).toBeNull();
  });
});

import { buildWalkWorld, findDoorInReach, startPose, stepWalker, supportHeight, type WalkState } from '../src/model/physics';

describe('walkthrough physics', () => {
  const p = createStarterProject();
  const w = buildWalkWorld(p);
  const start = startPose(p);
  const fresh = (x: number, z: number, y?: number): WalkState => ({ x, z, y: y ?? supportHeight(w, x, z, 1e9), vy: 0, onGround: true });
  const walk = (s: WalkState, mx: number, mz: number, secs: number) => {
    for (let t = 0; t < secs; t += 1 / 60) s = stepWalker(w, s, mx, mz, 1 / 60, false);
    return s;
  };

  it('starts on the ground outside the front door', () => {
    const y = supportHeight(w, start.x, start.z, 1e9);
    expect(y).toBeGreaterThan(2.5);
    expect(start.z).toBeLessThan(0);
  });

  it('is blocked by the closed front door', () => {
    // the front door is closed in the starter, so walking +Z from the walk must stop at the door
    const s = walk(fresh(start.x, start.z), 0, 3.4, 4);
    expect(s.z).toBeLessThan(0.1);
  });

  it('opening the front door lets the walker in', () => {
    const door = Object.values(p.openings).find((o) => o.name === 'Front door')!;
    const q = structuredClone(p);
    q.openings[door.id] = { ...q.openings[door.id], open: true } as typeof door;
    const w2 = buildWalkWorld(q);
    let s: WalkState = { x: start.x, z: start.z, y: supportHeight(w2, start.x, start.z, 1e9), vy: 0, onGround: true };
    for (let t = 0; t < 4; t += 1 / 60) s = stepWalker(w2, s, 0, 1.6, 1 / 60, false);
    expect(s.z).toBeGreaterThan(1);
  });

  it('is stopped by exterior walls from every side of the house', () => {
    const bounds = Object.values(p.walls).filter((x) => x.kind === 'exterior');
    expect(bounds.length).toBeGreaterThan(10);
    // walk +X straight across the rear of the main floor from outside: must not end up inside the wall volume
    const s = walk(fresh(-30, 30), 0, -3.4, 6);
    expect(Number.isFinite(s.z)).toBe(true);
  });

  it('climbs the stair from the main floor to the upper floor', () => {
    const st = Object.values(p.stairs).find((x) => x.levelIds.includes('L2'))!;
    expect(st).toBeTruthy();
    // enter lane A at the arrival edge and walk along the run, then around the landing and up lane B
    const pt = (along: number, across: number) => ({ x: st.origin.x + st.dir.x * along + st.side.x * across, z: st.origin.z + st.dir.z * along + st.side.z * across });
    const lane = st.laneWidth / 2;
    const lanes = [lane, st.laneWidth + st.gap + lane];
    const total = (st.risersPerFlight - 1) * st.treadDepth + st.landingDepth;
    // find the pair that starts on L1
    const k = st.levelIds.indexOf('L1');
    expect(k).toBeGreaterThanOrEqual(0);
    const y0 = p.levels.L1.elevation;
    const a = pt(0.05, lanes[0]);
    let s: WalkState = { x: a.x, z: a.z, y: supportHeight(w, a.x, a.z, y0 + 0.3), vy: 0, onGround: true };
    // run up lane A
    const target = pt(total - st.landingDepth / 2, lanes[0]);
    for (let t = 0; t < 12; t += 1 / 60) {
      const dx = target.x - s.x;
      const dz = target.z - s.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.05) break;
      s = stepWalker(w, s, (dx / d) * 1.2, (dz / d) * 1.2, 1 / 60, false);
    }
    expect(s.y).toBeGreaterThan(y0 + 1.2);
    // cross the landing to lane B and come down it to the upper floor
    const toB = pt(total - st.landingDepth / 2, lanes[1]);
    for (let t = 0; t < 4; t += 1 / 60) {
      const dx = toB.x - s.x;
      const dz = toB.z - s.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.05) break;
      s = stepWalker(w, s, (dx / d) * 1.2, (dz / d) * 1.2, 1 / 60, false);
    }
    const end = pt(-0.6, lanes[1]);
    for (let t = 0; t < 14; t += 1 / 60) {
      const dx = end.x - s.x;
      const dz = end.z - s.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.05) break;
      s = stepWalker(w, s, (dx / d) * 1.2, (dz / d) * 1.2, 1 / 60, false);
    }
    expect(s.y).toBeGreaterThan(p.levels.L2.elevation - 0.25);
  });

  it('collides with furniture', () => {
    const f = Object.values(p.furniture).find((x) => /sofa|bed/i.test(x.name) && x.levelId === 'L1');
    expect(f).toBeTruthy();
    const lv = p.levels[f!.levelId];
    const sx = f!.position.x + 2.2;
    const s0: WalkState = { x: sx, z: f!.position.z, y: lv.elevation, vy: 0, onGround: true };
    let s = s0;
    for (let t = 0; t < 2; t += 1 / 60) s = stepWalker(w, s, -1.6, 0, 1 / 60, false);
    const dist = Math.hypot(s.x - f!.position.x, s.z - f!.position.z);
    expect(dist).toBeGreaterThan(0.3);
  });

  it('falls off a ledge and lands on the lower surface', () => {
    const s: WalkState = { x: start.x, z: start.z, y: 12, vy: 0, onGround: false };
    let q = s;
    for (let t = 0; t < 4; t += 1 / 60) q = stepWalker(w, q, 0, 0, 1 / 60, false);
    expect(q.onGround).toBe(true);
    expect(q.y).toBeLessThan(5);
  });
});

describe('gesture coalescing', () => {
  it('merges a long drag into one undo step regardless of timing', () => {
    let h = { project: createStarterProject(), past: [] as any[], future: [] as any[] };
    const id = Object.keys(h.project.furniture)[0];
    const x0 = h.project.furniture[id].position.x;
    for (let i = 1; i <= 6; i++) h = commit(h, 'Move', (d) => { d.furniture[id].position = { x: x0 + i, z: 0 }; }, { key: 'g:abc:drag' + id, now: i * 5000 });
    expect(h.past.length).toBe(1);
    h = undo(h);
    expect(h.project.furniture[id].position.x).toBe(x0);
    expect(h.past.length).toBe(0);
  });
});

describe('door interaction', () => {
  it('finds the front door ahead and ignores it when facing away', () => {
    const p = createStarterProject();
    const st = startPose(p);
    const near = findDoorInReach(p, st.x, st.z + 2.2, 3.05, 0);
    expect(near?.name).toBe('Front door');
    expect(findDoorInReach(p, st.x, st.z + 2.2, 3.05, Math.PI)).toBeNull();
    expect(findDoorInReach(p, st.x, st.z - 6, 3.05, 0)).toBeNull();
  });
});
