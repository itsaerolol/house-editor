import * as THREE from 'three';

type V3 = [number, number, number];

interface Group {
  pos: number[];
  nor: number[];
  uv: number[];
  idx: number[];
}

/**
 * Small indexed-geometry accumulator with one draw group per material slot.
 * Faces are auto-wound to face the supplied "outward" hint.
 */
export class MeshBuilder {
  private groups = new Map<number, Group>();

  private g(m: number): Group {
    let grp = this.groups.get(m);
    if (!grp) {
      grp = { pos: [], nor: [], uv: [], idx: [] };
      this.groups.set(m, grp);
    }
    return grp;
  }

  /** quad p0..p3 (a loop). outward: direction the visible face should point. */
  quad(m: number, p: [V3, V3, V3, V3], outward?: V3, uvs?: [number, number][]) {
    let pts = p;
    let uv = uvs;
    let n = normal(pts[0], pts[1], pts[3]);
    if (outward && dot(n, outward) < 0) {
      pts = [p[0], p[3], p[2], p[1]];
      uv = uvs ? [uvs[0], uvs[3], uvs[2], uvs[1]] : undefined;
      n = normal(pts[0], pts[1], pts[3]);
    }
    const grp = this.g(m);
    const base = grp.pos.length / 3;
    const auto = uv ?? planarUV(pts, n);
    for (let i = 0; i < 4; i++) {
      grp.pos.push(pts[i][0], pts[i][1], pts[i][2]);
      grp.nor.push(n[0], n[1], n[2]);
      grp.uv.push(auto[i][0], auto[i][1]);
    }
    grp.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  tri(m: number, p: [V3, V3, V3], outward?: V3) {
    let pts = p;
    let n = normal(pts[0], pts[1], pts[2]);
    if (outward && dot(n, outward) < 0) {
      pts = [p[0], p[2], p[1]];
      n = normal(pts[0], pts[1], pts[2]);
    }
    const grp = this.g(m);
    const base = grp.pos.length / 3;
    const uv = planarUV([pts[0], pts[1], pts[2], pts[2]], n);
    for (let i = 0; i < 3; i++) {
      grp.pos.push(pts[i][0], pts[i][1], pts[i][2]);
      grp.nor.push(n[0], n[1], n[2]);
      grp.uv.push(uv[i][0], uv[i][1]);
    }
    grp.idx.push(base, base + 1, base + 2);
  }

  /** vertical prism over a convex footprint (CCW or CW, any order of 4 corners). */
  prism(mats: { top: number; side: number; bottom?: number }, f: [[number, number], [number, number], [number, number], [number, number]], y0: number, y1: number) {
    const cx = (f[0][0] + f[1][0] + f[2][0] + f[3][0]) / 4;
    const cz = (f[0][1] + f[1][1] + f[2][1] + f[3][1]) / 4;
    const top = f.map(([x, z]) => [x, y1, z] as V3) as [V3, V3, V3, V3];
    this.quad(mats.top, top, [0, 1, 0]);
    if (mats.bottom !== undefined) this.quad(mats.bottom, f.map(([x, z]) => [x, y0, z] as V3) as [V3, V3, V3, V3], [0, -1, 0]);
    for (let i = 0; i < 4; i++) {
      const a = f[i];
      const b = f[(i + 1) % 4];
      const mx = (a[0] + b[0]) / 2 - cx;
      const mz = (a[1] + b[1]) / 2 - cz;
      this.quad(mats.side, [[a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]]], [mx, 0, mz]);
    }
  }

  build(): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry();
    const pos: number[] = [];
    const nor: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    const entries = [...this.groups.entries()].sort((a, b) => a[0] - b[0]);
    for (const [m, grp] of entries) {
      const vBase = pos.length / 3;
      const start = idx.length;
      pos.push(...grp.pos);
      nor.push(...grp.nor);
      uv.push(...grp.uv);
      for (const i of grp.idx) idx.push(i + vBase);
      geo.addGroup(start, idx.length - start, m);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    return geo;
  }

  get isEmpty() {
    return this.groups.size === 0;
  }
}

function normal(a: V3, b: V3, c: V3): V3 {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];
  const x = uy * vz - uz * vy;
  const y = uz * vx - ux * vz;
  const z = ux * vy - uy * vx;
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
}
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function planarUV(p: V3[], n: V3): [number, number][] {
  const ax = Math.abs(n[0]);
  const ay = Math.abs(n[1]);
  const az = Math.abs(n[2]);
  return p.map((q) => {
    if (ay >= ax && ay >= az) return [q[0], q[2]] as [number, number];
    if (ax >= az) return [q[2], q[1]] as [number, number];
    return [q[0], q[1]] as [number, number];
  });
}
