import * as THREE from 'three';
import { mergeVertices, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Part, Vec3 } from '../model/catalog/kit';

/** quality 0 (low) .. 2 (high) scales tessellation */
const segFor = (q: number, hi: number, lo: number) => Math.max(3, Math.round(q >= 2 ? hi : q === 1 ? (hi + lo) / 2 : lo));

/* ---------------------------------------------------------------- noise */

function hash3(x: number, y: number, z: number, seed: number) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647 + seed * 144269) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x: number, y: number, z: number, seed: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = x - xi;
  const yf = y - yi;
  const zf = z - zi;
  const s = (t: number) => t * t * (3 - 2 * t);
  const u = s(xf);
  const v = s(yf);
  const w = s(zf);
  const L = (a: number, b: number, t: number) => a + (b - a) * t;
  const c = (dx: number, dy: number, dz: number) => hash3(xi + dx, yi + dy, zi + dz, seed);
  return L(
    L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v),
    L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  );
}
export function fbm(x: number, y: number, z: number, seed: number, oct = 3) {
  let a = 0.5;
  let f = 1;
  let sum = 0;
  for (let i = 0; i < oct; i++) {
    sum += a * (vnoise(x * f, y * f, z * f, seed + i * 17) * 2 - 1);
    f *= 2.03;
    a *= 0.5;
  }
  return sum;
}

/* ---------------------------------------------------------------- builders */

function leafGeometry(p: Extract<Part, { s: 'leaf' }>, q: number): THREE.BufferGeometry {
  // quality caps the spine segments so foliage scales with the tier
  const nu = Math.min(p.seg ?? segFor(q, 9, 4), q === 0 ? 3 : q === 1 ? 4 : 99);
  const shape = p.shape ?? 'lance';
  const nv = shape === 'needle' || shape === 'strap' || shape === 'spray' || (p.seg !== undefined && p.seg <= 4) ? 2 : q >= 1 ? 4 : 2;
  const widthAt = (u: number): number => {
    switch (shape) {
      case 'oval':
        return Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, u))), 0.65);
      case 'heart':
        return Math.pow(1 - u, 0.75) * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.6 + 0.12) * 0.5 + 0.0), 0.5) * 1.05;
      case 'strap':
        return Math.min(1, (1 - u) * 5) ** 0.8 * Math.min(1, u * 10 + 0.4);
      case 'needle':
        return Math.min(1, (1 - u) * 3) * 0.9 + 0.1 * (1 - u);
      case 'fan':
        return Math.pow(u, 0.6) * Math.min(1, (1 - u) * 6) ** 0.4;
      case 'fiddle': {
        // obovate violin: narrow base, widest high up, slight waist, blunt rounded tip
        const uu = Math.max(0, u);
        const base = Math.pow(Math.sin(Math.PI * Math.min(1, Math.pow(uu, 1.5) * 0.92 + 0.04)), 0.5) * Math.min(1, uu * 5 + 0.15);
        return base * (1 - 0.12 * Math.exp(-(((uu - 0.4) / 0.09) ** 2)));
      }
      case 'spray':
        // conifer needle spray: long, serrated, blunt-tipped
        return Math.min(1, u * 3 + 0.25) * Math.pow(1 - u * 0.85, 0.7);
      case 'round':
        return Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, u))), 0.5);
      case 'split':
        return Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, u * 0.95 + 0.04))), 0.45);
      default:
        // lance: widest a third of the way up, long pointed tip
        return Math.pow(Math.min(1, u * 2.6), 0.6) * Math.pow(1 - u, 0.9);
    }
  };
  const fold = p.fold ?? 0.35;
  const droop = p.droop ?? 0.4;
  const curl = p.curl ?? 0;
  const twist = p.twist ?? 0;
  const pos: number[] = [];
  const idx: number[] = [];
  // spine integration in the local y-z plane
  let sy = 0;
  let sz = 0;
  const ds = p.len / nu;
  for (let i = 0; i <= nu; i++) {
    const u = i / nu;
    const a = droop * Math.pow(u, 1.6);
    if (i > 0) {
      sy += Math.cos(a) * ds;
      sz -= Math.sin(a) * ds;
    }
    const half = (p.wid / 2) * widthAt(u) * (shape === 'spray' && i % 2 === 1 ? 0.62 : 1);
    const tw = twist * u;
    for (let j = 0; j <= nv; j++) {
      const v = (j / nv) * 2 - 1;
      const x = v * half;
      let z = -Math.abs(v) * half * Math.sin(fold) + curl * v * v * half;
      // the slit leaf gets ragged notches
      if (shape === 'split' && Math.abs(v) > 0.6 && i % 2 === 1) z -= half * 0.05;
      const cx = Math.cos(tw) * x - Math.sin(tw) * z * 0.2;
      const cz = Math.sin(tw) * x * 0.4 + Math.cos(tw) * z;
      // rotate the cross-section with the spine bend
      pos.push(cx, sy + cz * Math.sin(a), sz + cz * Math.cos(a));
    }
  }
  const row = nv + 1;
  for (let i = 0; i < nu; i++)
    for (let j = 0; j < nv; j++) {
      const a = i * row + j;
      idx.push(a, a + 1, a + row, a + 1, a + row + 1, a + row);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function blobGeometry(p: Extract<Part, { s: 'blob' }>, q: number): THREE.BufferGeometry {
  const detail = p.detail ?? (q >= 2 ? 3 : q === 1 ? 2 : 1);
  let g: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, detail);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g, 1e-5);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const rough = p.rough ?? 0.25;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = fbm(v.x * 1.7 + 10, v.y * 1.7, v.z * 1.7, p.seed, 4);
    v.multiplyScalar(1 + rough * n);
    if (p.flatBottom && v.y < -0.35) v.y = -0.35 + (v.y + 0.35) * 0.25;
    pos.setXYZ(i, (v.x * p.z[0]) / 2, (v.y * p.z[1]) / 2, (v.z * p.z[2]) / 2);
  }
  g.computeVertexNormals();
  return g;
}

function cushionGeometry(p: Extract<Part, { s: 'cushion' }>, q: number): THREE.BufferGeometry {
  const [w, h, d] = p.z;
  const rad = Math.min(p.rad, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3);
  let g: THREE.BufferGeometry = new RoundedBoxGeometry(w, h, d, segFor(q, 5, 2), Math.max(1e-3, rad));
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g = mergeVertices(g, 1e-5);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const sag = p.sag ?? 0;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i);
    let y = pos.getY(i);
    let z = pos.getZ(i);
    const nx = x / (w / 2);
    const ny = y / (h / 2);
    const nz = z / (d / 2);
    const fx = Math.max(0, 1 - nx * nx);
    const fy = Math.max(0, 1 - ny * ny);
    const fz = Math.max(0, 1 - nz * nz);
    y += p.puff * ny * fx * fz;
    x += p.puff * 0.45 * nx * fy * fz;
    z += p.puff * 0.45 * nz * fx * fy;
    if (sag && ny > 0) y -= sag * ny * fx * fx * fz * fz;
    pos.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

function tubeGeometry(p: Extract<Part, { s: 'tube' }>, q: number): THREE.BufferGeometry {
  const pts = p.path.map((v) => new THREE.Vector3(v[0], v[1], v[2]));
  let curve: THREE.Curve<THREE.Vector3>;
  if (p.smooth) curve = new THREE.CatmullRomCurve3(pts, !!p.closed, 'centripetal');
  else {
    const path = new THREE.CurvePath<THREE.Vector3>();
    const cr = p.cr ?? 0;
    let cur = pts[0].clone();
    for (let i = 1; i < pts.length; i++) {
      const b = pts[i];
      const nextP = pts[i + 1];
      if (cr > 0 && nextP) {
        const inDir = b.clone().sub(pts[i - 1]).normalize();
        const outDir = nextP.clone().sub(b).normalize();
        const lin = b.distanceTo(pts[i - 1]);
        const lout = nextP.distanceTo(b);
        const r = Math.min(cr, lin * 0.45, lout * 0.45);
        const a = b.clone().addScaledVector(inDir, -r);
        const c = b.clone().addScaledVector(outDir, r);
        if (a.distanceTo(cur) > 1e-5) path.add(new THREE.LineCurve3(cur.clone(), a));
        path.add(new THREE.QuadraticBezierCurve3(a, b.clone(), c));
        cur = c;
      } else {
        if (b.distanceTo(cur) > 1e-5) path.add(new THREE.LineCurve3(cur.clone(), b.clone()));
        cur = b.clone();
      }
    }
    curve = path;
  }
  const len = curve.getLength();
  // step scales with tube radius so long thin branches stay cheap; straight polylines need few segments
  const base = q >= 2 ? 0.015 : q === 1 ? 0.03 : 0.06;
  const step = Math.max(base, p.rad * (q >= 2 ? 2.5 : 4));
  const tseg = p.ts ?? Math.min(p.smooth ? 96 : 260, Math.max(4, Math.ceil(len / step)));
  return new THREE.TubeGeometry(curve, tseg, p.rad, p.rs ?? segFor(q, 12, 6), !!p.closed);
}

function loftGeometry(p: Extract<Part, { s: 'loft' }>, q: number): THREE.BufferGeometry {
  const n = p.bot.length;
  const rings = p.rings ?? (q >= 2 ? 10 : 4);
  const pos: number[] = [];
  const idx: number[] = [];
  const ease = (t: number) => t; // linear in height; profiles pick their own curvature through rings
  const ringAt = (a: [number, number][], b: [number, number][], t: number, y: number) => {
    for (let i = 0; i < n; i++) pos.push(a[i][0] + (b[i][0] - a[i][0]) * ease(t), y, a[i][1] + (b[i][1] - a[i][1]) * ease(t));
  };
  const strip = (base: number, flip: boolean) => {
    for (let r = 0; r < rings; r++)
      for (let i = 0; i < n; i++) {
        const a = base + r * n + i;
        const b = base + r * n + ((i + 1) % n);
        const c = a + n;
        const d = b + n;
        if (flip) idx.push(a, c, b, b, c, d);
        else idx.push(a, b, c, b, d, c);
      }
  };
  // outer wall
  for (let r = 0; r <= rings; r++) {
    const t = r / rings;
    ringAt(p.bot, p.top, Math.sin((t * Math.PI) / 2), p.y0 + (p.y1 - p.y0) * t);
  }
  strip(0, false);
  if (p.inBot && p.inTop) {
    const base = pos.length / 3;
    for (let r = 0; r <= rings; r++) {
      const t = r / rings;
      ringAt(p.inBot, p.inTop, t, p.y0 + 0.04 + (p.y1 - p.y0 - 0.04) * t);
    }
    strip(base, true);
    // rim: join outer top ring to inner top ring
    const ot = rings * n;
    const it = base + rings * n;
    for (let i = 0; i < n; i++) {
      const a = ot + i;
      const b = ot + ((i + 1) % n);
      const c = it + i;
      const d = it + ((i + 1) % n);
      idx.push(a, c, b, b, c, d);
    }
    // inner floor
    const cb = pos.length / 3;
    pos.push(0, p.y0 + 0.04, 0);
    for (let i = 0; i < n; i++) idx.push(cb, base + ((i + 1) % n), base + i);
  } else {
    const ct = pos.length / 3;
    pos.push(0, p.y1, 0);
    for (let i = 0; i < n; i++) idx.push(ct, rings * n + i, rings * n + ((i + 1) % n));
  }
  // bottom cap
  const cb2 = pos.length / 3;
  pos.push(0, p.y0, 0);
  for (let i = 0; i < n; i++) idx.push(cb2, (i + 1) % n, i);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return toCreasedNormals(g, Math.PI / 3.5);
}

function primitive(p: Part, q: number): THREE.BufferGeometry {
  switch (p.s) {
    case 'box': {
      const g = new THREE.BoxGeometry(1, 1, 1);
      g.scale(Math.max(1e-4, p.z[0]), Math.max(1e-4, p.z[1]), Math.max(1e-4, p.z[2]));
      return g;
    }
    case 'cyl': {
      const n = p.seg ?? segFor(q, 32, 10);
      const g = new THREE.CylinderGeometry(0.5 * (p.taper ?? 1), 0.5, 1, n);
      g.scale(Math.max(1e-4, p.z[0]), Math.max(1e-4, p.z[1]), Math.max(1e-4, p.z[2]));
      return g;
    }
    case 'sph': {
      const n = p.seg ?? segFor(q, 28, 10);
      const g = new THREE.SphereGeometry(0.5, n, Math.max(6, Math.round(n * 0.6)));
      g.scale(Math.max(1e-4, p.z[0]), Math.max(1e-4, p.z[1]), Math.max(1e-4, p.z[2]));
      return g;
    }
    case 'cone': {
      const n = p.seg ?? segFor(q, 28, 10);
      const g = new THREE.ConeGeometry(0.5, 1, n);
      g.scale(Math.max(1e-4, p.z[0]), Math.max(1e-4, p.z[1]), Math.max(1e-4, p.z[2]));
      return g;
    }
    case 'rbox': {
      const [w, h, d] = p.z;
      const rad = Math.max(1e-4, Math.min(p.rad, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
      // segments scale with the radius: tiny eased edges need one, soft cushions-like corners get more
      const segs = q === 0 ? 1 : rad < 0.005 ? 1 : rad < 0.014 ? 2 : q >= 2 ? 4 : 2;
      return new RoundedBoxGeometry(Math.max(1e-3, w), Math.max(1e-3, h), Math.max(1e-3, d), segs, rad);
    }
    case 'cushion':
      return cushionGeometry(p, q);
    case 'lathe': {
      const pts = p.prof.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y));
      const g = new THREE.LatheGeometry(pts, p.seg ?? segFor(q, 40, 12), p.phi0 ?? 0, p.arc ?? Math.PI * 2);
      if (p.sx || p.sz) g.scale(p.sx ?? 1, 1, p.sz ?? 1);
      return g;
    }
    case 'tube':
      return tubeGeometry(p, q);
    case 'torus':
      return new THREE.TorusGeometry(p.R, p.rad, segFor(q, 12, 6), segFor(q, 40, 14), p.arc ?? Math.PI * 2);
    case 'ext': {
      const shape = new THREE.Shape(p.shape.map(([x, y]) => new THREE.Vector2(x, y)));
      for (const h of p.holes ?? []) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
      const bev = p.bevel ?? 0;
      const g = new THREE.ExtrudeGeometry(shape, {
        depth: Math.max(1e-4, p.depth - bev * 2),
        bevelEnabled: bev > 0,
        bevelThickness: bev,
        bevelSize: bev,
        bevelOffset: -bev,
        bevelSegments: q >= 2 ? (bev > 0.02 ? 6 : 3) : 1,
        curveSegments: p.curveSeg ?? segFor(q, 12, 4),
      });
      g.translate(0, 0, -p.depth / 2 + bev);
      // smooth across bevel facets, keep the hard crease where the cap meets the side
      if (bev > 0) {
        g.deleteAttribute('uv');
        return toCreasedNormals(g, Math.PI / 5);
      }
      return g;
    }
    case 'leaf':
      return leafGeometry(p, q);
    case 'loft':
      return loftGeometry(p, q);
    case 'blob':
      return blobGeometry(p, q);
  }
}

const _e = new THREE.Euler();
const _m = new THREE.Matrix4();

/** Geometry for one part in item space, with position, normal, uv (meter-planar) and color. Always indexed. */
export function buildPart(p: Part, q: number): THREE.BufferGeometry {
  let g = primitive(p, q);
  if (p.r) {
    _e.set(p.r[0], p.r[1], p.r[2], p.ro ?? (p.s === 'leaf' ? 'YXZ' : 'XYZ'));
    _m.makeRotationFromEuler(_e);
    g.applyMatrix4(_m);
  }
  if (p.yaw) g.rotateY(p.yaw);
  g.translate(p.p[0], p.p[1], p.p[2]);
  // keep only position + normal, index everything
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
  if (!g.index) g = mergeVertices(g, 1e-6);
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nor.getX(i));
    const ay = Math.abs(nor.getY(i));
    const az = Math.abs(nor.getZ(i));
    if (ay >= ax && ay >= az) {
      uv[i * 2] = pos.getX(i);
      uv[i * 2 + 1] = pos.getZ(i);
    } else if (ax >= az) {
      uv[i * 2] = pos.getZ(i);
      uv[i * 2 + 1] = pos.getY(i);
    } else {
      uv[i * 2] = pos.getX(i);
      uv[i * 2 + 1] = pos.getY(i);
    }
    if (p.gv && ay < Math.max(ax, az)) {
      const u = uv[i * 2];
      uv[i * 2] = uv[i * 2 + 1];
      uv[i * 2 + 1] = u;
    }
  }
  if (p.uvFit) {
    g.computeBoundingBox();
    const bb = g.boundingBox!;
    const sx = Math.max(1e-6, bb.max.x - bb.min.x);
    const sz2 = Math.max(1e-6, bb.max.z - bb.min.z);
    const sy = Math.max(1e-6, bb.max.y - bb.min.y);
    for (let i = 0; i < pos.count; i++) {
      const az = Math.abs(nor.getZ(i));
      const ay = Math.abs(nor.getY(i));
      if (ay >= az && sy < Math.min(sx, sz2)) {
        uv[i * 2] = (pos.getX(i) - bb.min.x) / sx;
        uv[i * 2 + 1] = (pos.getZ(i) - bb.min.z) / sz2;
      } else {
        uv[i * 2] = (pos.getX(i) - bb.min.x) / sx;
        uv[i * 2 + 1] = (pos.getY(i) - bb.min.y) / sy;
      }
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const t: Vec3 = p.tint ?? [1, 1, 1];
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    col[i * 3] = t[0];
    col[i * 3 + 1] = t[1];
    col[i * 3 + 2] = t[2];
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/** Rough triangle count, for budgets. */
export function triCount(g: THREE.BufferGeometry) {
  return g.index ? g.index.count / 3 : g.getAttribute('position').count / 3;
}
