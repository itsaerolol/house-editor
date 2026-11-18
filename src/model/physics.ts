import { computeWallBoxes, wallVec } from './arch';
import { CATALOG_BY_ID } from './catalog';
import { stairBoxes, stairToWorld } from './stairs';
import { terrainHeight } from './site';
import type { Id, Project, Vec2 } from './types';

/** Pure collision and support data for the first-person walkthrough (no Three.js). */

export const EYE = 1.65;
export const RADIUS = 0.24;
export const STEP_UP = 0.46; // max riser the walker climbs without jumping (stair risers are ~0.17 m)
export const BODY_H = 1.75;

/** Oriented rectangle in plan with a vertical extent. */
export interface Block {
  cx: number;
  cz: number;
  /** half extents along the local axes */
  hx: number;
  hz: number;
  /** unit vector of local axis x */
  ax: number;
  az: number;
  y0: number;
  y1: number;
  src: string;
}

export interface Support {
  /** polygon in plan, with optional holes */
  outline: Vec2[];
  holes: Vec2[][];
  top: number;
  /** y of the underside (so we ignore a slab above the head) */
  bottom: number;
}

export interface WalkWorld {
  blocks: Block[];
  supports: Support[];
  project: Project;
}

export function pointInPoly(x: number, z: number, poly: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}

export function buildWalkWorld(p: Project): WalkWorld {
  const blocks: Block[] = [];
  const supports: Support[] = [];
  const ops = Object.values(p.openings);

  for (const w of Object.values(p.walls)) {
    const lv = p.levels[w.levelId];
    if (!lv || w.hidden) continue;
    const { tx, tz, len } = wallVec(w);
    if (len < 1e-6) continue;
    const boxes = computeWallBoxes(w, ops, lv, p.levels, { collision: true });
    for (const b of boxes) {
      const mid = (b.a0 + b.a1) / 2;
      blocks.push({
        cx: w.start.x + tx * mid,
        cz: w.start.z + tz * mid,
        hx: (b.a1 - b.a0) / 2,
        hz: w.thickness / 2,
        ax: tx,
        az: tz,
        y0: b.y0,
        y1: b.y1,
        src: w.id,
      });
    }
  }

  for (const f of Object.values(p.furniture)) {
    if (f.hidden) continue;
    const lv = p.levels[f.levelId];
    const cat = CATALOG_BY_ID[f.catalogId];
    if (!lv || !cat || !cat.solid || cat.flat) continue;
    const y0 = lv.elevation + f.elevation;
    // hanging fixtures above head height and thin decor never block
    if (f.size.h < 0.12 || y0 > lv.elevation + 1.9) continue;
    const c = Math.cos(f.rotationY);
    const s = Math.sin(f.rotationY);
    blocks.push({
      cx: f.position.x,
      cz: f.position.z,
      hx: f.size.w / 2,
      hz: f.size.d / 2,
      ax: c,
      az: -s,
      y0,
      y1: y0 + f.size.h,
      src: f.id,
    });
  }

  for (const s of Object.values(p.slabs)) {
    const lv = p.levels[s.levelId];
    if (!lv || s.hidden) continue;
    const th = s.thickness ?? lv.slabThickness;
    const top = lv.elevation + s.topOffset;
    supports.push({ outline: s.outline, holes: s.holes, top, bottom: top - th });
  }

  // Stair treads become small blocks: low ones can be stepped onto, so they are also supports.
  for (const st of Object.values(p.stairs)) {
    for (const b of stairBoxes(st, p.levels)) {
      const c0 = stairToWorld(st, b.a0, b.c0);
      const c1 = stairToWorld(st, b.a1, b.c0);
      const c2 = stairToWorld(st, b.a1, b.c1);
      const c3 = stairToWorld(st, b.a0, b.c1);
      supports.push({ outline: [c0, c1, c2, c3], holes: [], top: b.top, bottom: b.bottom });
    }
  }

  return { blocks, supports, project: p };
}

/** Highest surface the feet can stand on at (x,z) that is no higher than maxY. */
export function supportHeight(w: WalkWorld, x: number, z: number, maxY: number): number {
  let best = terrainHeight(w.project, x, z);
  for (const s of w.supports) {
    if (s.top > maxY) continue;
    if (s.top <= best) continue;
    if (!pointInPoly(x, z, s.outline)) continue;
    if (s.holes.some((h) => pointInPoly(x, z, h))) continue;
    best = s.top;
  }
  return best;
}

/** Deepest push-out of a circle against an oriented box; returns null when clear. */
function pushOut(b: Block, x: number, z: number, r: number): { nx: number; nz: number; d: number } | null {
  const dx = x - b.cx;
  const dz = z - b.cz;
  const lx = dx * b.ax + dz * b.az;
  const lz = -dx * b.az + dz * b.ax;
  const qx = Math.max(-b.hx, Math.min(b.hx, lx));
  const qz = Math.max(-b.hz, Math.min(b.hz, lz));
  let ex = lx - qx;
  let ez = lz - qz;
  const d2 = ex * ex + ez * ez;
  if (d2 > r * r) return null;
  let d: number;
  if (d2 < 1e-10) {
    // centre is inside the box: leave through the nearest face
    const px = b.hx - Math.abs(lx);
    const pz = b.hz - Math.abs(lz);
    if (px < pz) {
      ex = Math.sign(lx || 1);
      ez = 0;
      d = px + r;
    } else {
      ex = 0;
      ez = Math.sign(lz || 1);
      d = pz + r;
    }
  } else {
    const l = Math.sqrt(d2);
    ex /= l;
    ez /= l;
    d = r - l;
  }
  // back to world space
  return { nx: ex * b.ax - ez * b.az, nz: ex * b.az + ez * b.ax, d };
}

export interface WalkState {
  x: number;
  z: number;
  /** feet height */
  y: number;
  vy: number;
  onGround: boolean;
}

/**
 * Advance one step. Horizontal motion is resolved against walls and furniture whose vertical extent
 * overlaps the body, ignoring anything the feet can step over. Vertical motion follows the supporting surface.
 */
export function stepWalker(w: WalkWorld, s: WalkState, mx: number, mz: number, dt: number, jump: boolean): WalkState {
  let { x, z, y, vy, onGround } = s;

  // ---- horizontal (sub-stepped so fast movement cannot tunnel through a 12 cm wall)
  const dist = Math.hypot(mx, mz) * dt;
  const n = Math.max(1, Math.ceil(dist / 0.08));
  for (let i = 0; i < n; i++) {
    x += (mx * dt) / n;
    z += (mz * dt) / n;
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      for (const b of w.blocks) {
        if (b.y1 <= y + STEP_UP || b.y0 >= y + BODY_H) continue;
        if (Math.abs(x - b.cx) > b.hx + b.hz + RADIUS + 0.1 && Math.abs(z - b.cz) > b.hx + b.hz + RADIUS + 0.1) continue;
        const o = pushOut(b, x, z, RADIUS);
        if (o) {
          x += o.nx * o.d;
          z += o.nz * o.d;
          moved = true;
        }
      }
      if (!moved) break;
    }
  }

  // ---- vertical
  const ground = supportHeight(w, x, z, y + STEP_UP);
  if (onGround && ground <= y + STEP_UP && vy <= 0) {
    // glide to the surface: smooth up on stairs, fast down so we do not float
    if (ground > y) y = Math.min(ground, y + 6 * dt * 1.0 + (ground - y) * Math.min(1, 14 * dt));
    else y = Math.max(ground, y - Math.max(0.25, (y - ground) * 12) * dt);
    if (Math.abs(y - ground) < 0.004) y = ground;
    vy = 0;
    if (jump) {
      vy = 4.2;
      onGround = false;
    } else if (y - ground > 0.6) onGround = false;
  } else {
    vy -= 9.8 * dt;
    y += vy * dt;
    const g2 = supportHeight(w, x, z, y + 0.05 + Math.max(0, -vy * dt));
    if (y <= g2 && vy <= 0) {
      y = g2;
      vy = 0;
      onGround = true;
    } else onGround = false;
  }

  // ---- head bump: a slab above the head stops upward motion
  if (vy > 0) {
    for (const sp of w.supports) {
      if (sp.bottom > y + BODY_H - 0.3 && sp.bottom < y + BODY_H + vy * dt + 0.2 && pointInPoly(x, z, sp.outline) && !sp.holes.some((h) => pointInPoly(x, z, h))) {
        vy = 0;
        break;
      }
    }
  }
  return { x, z, y, vy, onGround };
}

/** Name of the level whose floor the feet are closest to, for the HUD. */
export function levelNameAt(p: Project, y: number): { id: Id; name: string } {
  let best: Id = p.levelOrder[0];
  for (const id of p.levelOrder) if (p.levels[id].elevation <= y + 0.5) best = id;
  if (y < p.levels[p.levelOrder[0]].elevation - 0.4) return { id: best, name: 'Outside' };
  return { id: best, name: p.levels[best].name };
}

/** Default start: on the front walk, facing the entry door. */
export function startPose(p: Project): { x: number; z: number; yaw: number } {
  const door = Object.values(p.openings).find((o) => o.kind === 'door' && o.name === 'Front door');
  const wall = door && p.walls[door.wallId];
  if (door && wall) {
    const { tx, tz } = wallVec(wall);
    const a = door.offset + door.width / 2;
    const cx = wall.start.x + tx * a;
    const cz = wall.start.z + tz * a;
    // step out on the exterior side (front faces -Z)
    return { x: cx, z: cz - 3.6, yaw: 0 };
  }
  return { x: -12, z: -5, yaw: 0 };
}

export interface DoorHit {
  id: Id;
  name: string;
  open: boolean;
  dist: number;
}

/** Nearest hinged or sliding door within reach, in front of the viewer. Cased openings never block, so they are skipped. */
export function findDoorInReach(p: Project, x: number, z: number, y: number, yaw: number, reach = 2.2): DoorHit | null {
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  let best: DoorHit | null = null;
  let bestScore = Infinity;
  for (const o of Object.values(p.openings)) {
    if (o.kind !== 'door' || o.style === 'cased' || o.locked) continue;
    const w = p.walls[o.wallId];
    const lv = w && p.levels[w.levelId];
    if (!w || !lv) continue;
    const { tx, tz } = wallVec(w);
    const a = o.offset + o.width / 2;
    const dx = w.start.x + tx * a - x;
    const dz = w.start.z + tz * a - z;
    const d = Math.hypot(dx, dz);
    if (d > reach) continue;
    const midY = lv.elevation + o.sill + o.height / 2;
    if (Math.abs(midY - (y + EYE)) > 1.6) continue;
    const facing = d < 1e-6 ? 1 : (dx * fx + dz * fz) / d;
    if (facing < 0.35) continue;
    const score = d - facing * 0.6;
    if (score < bestScore) {
      bestScore = score;
      best = { id: o.id, name: o.name ?? 'Door', open: o.open, dist: d };
    }
  }
  return best;
}
