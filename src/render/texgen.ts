import { makeCanvas } from './canvas';
/** Pixel-level, seamlessly tiling texture generators (grayscale, 0..255). Materials tint them. */

export function rng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Periodic value-noise lattice: period p cells, returns smooth noise in 0..1 for x,y in cell units. */
export function makeNoise(seed: number, p: number) {
  const r = rng(seed);
  const tab = new Float32Array(p * p);
  for (let i = 0; i < tab.length; i++) tab[i] = r();
  const s = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = s(x - xi);
    const fy = s(y - yi);
    const x0 = ((xi % p) + p) % p;
    const y0 = ((yi % p) + p) % p;
    const x1 = (x0 + 1) % p;
    const y1 = (y0 + 1) % p;
    const a = tab[y0 * p + x0];
    const b = tab[y0 * p + x1];
    const c = tab[y1 * p + x0];
    const d = tab[y1 * p + x1];
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}

/** Tileable fbm over the unit square [0,1)^2 with base period `cells`. */
export function makeFbm(seed: number, cells: number, oct = 4) {
  const ns = Array.from({ length: oct }, (_, i) => makeNoise(seed + i * 101, cells << i));
  return (u: number, v: number) => {
    let sum = 0;
    let amp = 0.5;
    let norm = 0;
    for (let i = 0; i < oct; i++) {
      const c = cells << i;
      sum += ns[i](u * c, v * c) * amp;
      norm += amp;
      amp *= 0.5;
    }
    return sum / norm;
  };
}

export type Px = (u: number, v: number, x: number, y: number) => number;

/** Fill a canvas from a per-pixel function returning 0..255 grey. */
export function fill(size: number, f: Px): HTMLCanvasElement {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const g = Math.max(0, Math.min(255, f(x / size, y / size, x, y)));
      const i = (y * size + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = g;
      d[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  return c;
}

const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const smooth = (a: number, b: number, t: number) => {
  const k = clamp01((t - a) / (b - a));
  return k * k * (3 - 2 * k);
};

/** Long-grain wood (plain sawn slab): warped flame/cathedral bands, ray flecks, pores. Grain runs along u. */
export function woodGrain(size: number, seed: number, opts: { contrast?: number; bands?: number; pores?: number } = {}): HTMLCanvasElement {
  const warp = makeFbm(seed, 2, 4);
  const warp2 = makeFbm(seed + 7, 6, 3);
  const fine = makeFbm(seed + 13, 96, 2);
  const tone = makeFbm(seed + 17, 3, 3);
  const pore = makeNoise(seed + 29, 768);
  const bands = opts.bands ?? 26;
  const con = opts.contrast ?? 1;
  return fill(size, (u, v) => {
    // gentle cathedral waves: rings across v, bent slowly along u
    const w = warp(u, v) * 0.55 + warp2(u, v) * 0.12;
    const ring = (v + w * 0.22 + 0.025 * Math.sin(u * Math.PI * 2 * 2 + w * 4)) * bands;
    const f = ring - Math.floor(ring);
    const late = smooth(0.62, 0.86, f) * (1 - smooth(0.86, 0.98, f));
    const streak = fine(u * 0.12, v) - 0.5;
    const p = pore(u * 768, v * 160) > 0.82 ? -14 : 0;
    return 196 - late * 46 * con + streak * 34 * con + (tone(u, v) - 0.5) * 36 + p * (opts.pores ?? 1);
  });
}

/** Wide-plank floor: staggered planks, each with its own grain offset, bevelled seams, occasional knots. Planks run along u. */
export function plankFloor(size: number, seed: number, rows = 5): HTMLCanvasElement {
  const r = rng(seed);
  const rowsData = Array.from({ length: rows }, () => {
    const joints: number[] = [];
    let x = r() * 0.6;
    while (joints.length < 3) {
      joints.push(x % 1);
      x += 0.45 + r() * 0.5;
    }
    return { joints: joints.sort((a, b) => a - b), tone: Array.from({ length: 4 }, () => (r() - 0.5) * 38), shift: Array.from({ length: 4 }, () => r() * 10) };
  });
  const warp = makeFbm(seed, 4, 4);
  const fine = makeFbm(seed + 5, 48, 2);
  const pore = makeNoise(seed + 11, 512);
  const knot = makeNoise(seed + 19, 6);
  return fill(size, (u, v) => {
    const rowF = v * rows;
    const row = Math.floor(rowF);
    const fv = rowF - row;
    const rd = rowsData[row % rows];
    let seg = 0;
    for (let i = 0; i < rd.joints.length; i++) if (u >= rd.joints[i]) seg = i + 1;
    seg %= rd.joints.length;
    const dj = Math.min(...rd.joints.map((j) => Math.min(Math.abs(u - j), 1 - Math.abs(u - j))));
    const w = warp(u, v + rd.shift[seg]);
    const ring = (fv * 1.2 + w * 0.35 + 0.04 * Math.sin(u * Math.PI * 4 + w * 3) + rd.shift[seg]) * 9;
    const f = ring - Math.floor(ring);
    const late = smooth(0.62, 0.86, f) * (1 - smooth(0.86, 0.98, f));
    let g = 200 + rd.tone[seg] - late * 34 + (fine(u * 0.15, v) - 0.5) * 30 + (pore(u * 512, v * 128) > 0.84 ? -12 : 0);
    // knots
    const k = knot(u * 6, v * 6);
    if (k > 0.9) g -= (k - 0.9) * 700;
    // bevelled long edges and butt joints
    const edge = Math.min(fv, 1 - fv) * (size / rows);
    if (edge < 1.6) g *= 0.45;
    else if (edge < 3.2) g *= 0.8;
    if (dj * size < 1.2) g *= 0.4;
    return g;
  });
}

/** Board-and-batten siding (vertical boards, battens every 1/4), faint wood texture and battens' shadows. */
export function boardBatten(size: number, seed: number): HTMLCanvasElement {
  const fine = makeFbm(seed, 24, 3);
  const grain = makeFbm(seed + 3, 4, 3);
  const n = 4;
  return fill(size, (u, v) => {
    const x = (u * n) % 1;
    let g = 214 + (fine(u, v * 0.2) - 0.5) * 30 + (grain(u * 3, v) - 0.5) * 20;
    // batten: 0..0.12 of each bay, with a bevelled shadow edge
    if (x < 0.1) g += 18 - Math.abs(x - 0.05) * 160;
    else if (x < 0.13) g -= 90 * (1 - (x - 0.1) / 0.03);
    else if (x > 0.985) g -= 50;
    return g;
  });
}

/** Ledgestone: random-length courses of stones with rough faces, deep shadowed joints. */
export function ledgestone(size: number, seed: number): HTMLCanvasElement {
  const r = rng(seed);
  const courses: { y0: number; y1: number; stones: { x0: number; x1: number; tone: number; s: number }[] }[] = [];
  let y = 0;
  while (y < 1) {
    const h = Math.min(1 - y, 0.05 + r() * 0.07);
    const stones: { x0: number; x1: number; tone: number; s: number }[] = [];
    let x = r() * 0.2;
    const start = x;
    while (x < start + 1) {
      const w = 0.08 + r() * 0.24;
      stones.push({ x0: x % 1, x1: (x + w) % 1, tone: (r() - 0.5) * 70, s: r() * 50 });
      x += w;
    }
    courses.push({ y0: y, y1: y + h, stones });
    y += h;
  }
  const rough = makeFbm(seed + 3, 32, 4);
  const big = makeFbm(seed + 9, 6, 3);
  return fill(size, (u, v) => {
    const c = courses.find((cc) => v >= cc.y0 && v < cc.y1) ?? courses[courses.length - 1];
    let st = c.stones[0];
    let dEdge = 1;
    for (const s of c.stones) {
      const inside = s.x0 < s.x1 ? u >= s.x0 && u < s.x1 : u >= s.x0 || u < s.x1;
      if (inside) {
        st = s;
        const dx = s.x0 < s.x1 ? Math.min(u - s.x0, s.x1 - u) : Math.min(((u - s.x0) % 1 + 1) % 1, ((s.x1 - u) % 1 + 1) % 1);
        dEdge = Math.min(dx, v - c.y0, c.y1 - v);
      }
    }
    const jitter = (rough(u + st.s, v) - 0.5) * 0.012;
    if (dEdge + jitter < 0.004) return 45 + rough(u, v) * 25;
    const face = 170 + st.tone + (rough(u + st.s, v + st.s) - 0.5) * 90 + (big(u, v) - 0.5) * 30;
    // top lip catches light, bottom edge shadowed
    const topLight = smooth(0.012, 0.0, v - c.y0) * 30;
    const botShadow = smooth(0.016, 0.0, c.y1 - v) * 55;
    return face + topLight - botShadow;
  });
}

/** Laminated architectural shingles: staggered tabs of varied width with dark shadow bands and granules. */
export function shingles(size: number, seed: number): HTMLCanvasElement {
  const r = rng(seed);
  const rows = 8;
  const tabs = Array.from({ length: rows }, () => {
    const cuts: number[] = [];
    let x = r() * 0.1;
    while (x < 1) {
      cuts.push(x);
      x += 0.08 + r() * 0.12;
    }
    return { cuts, tones: cuts.map(() => (r() - 0.5) * 60) };
  });
  const gran = makeNoise(seed + 5, 512);
  const gran2 = makeFbm(seed + 7, 64, 2);
  return fill(size, (u, v) => {
    const rf = v * rows;
    const row = Math.floor(rf);
    const fv = rf - row;
    const t = tabs[row];
    let k = 0;
    for (let i = 0; i < t.cuts.length; i++) if (u >= t.cuts[i]) k = i;
    let g = 150 + t.tones[k] + (gran(u * 512, v * 512) - 0.5) * 70 + (gran2(u, v) - 0.5) * 30;
    if (fv > 0.82) g -= 80 * smooth(0.82, 0.9, fv);
    const dc = Math.min(...t.cuts.map((c) => Math.abs(u - c)));
    if (dc * size < 1.5 && fv > 0.35) g -= 60;
    return g;
  });
}

/** Standing seam panels: raised ribs every 1/3, flat pans with subtle oil-canning. */
export function standingSeam(size: number, seed: number): HTMLCanvasElement {
  const oil = makeFbm(seed, 3, 3);
  const fine = makeFbm(seed + 3, 128, 2);
  return fill(size, (u, v) => {
    const x = (u * 3) % 1;
    let g = 200 + (oil(u, v) - 0.5) * 26 + (fine(u, v) - 0.5) * 8;
    if (x < 0.012) g = 245;
    else if (x < 0.03) g = 120;
    else if (x < 0.05) g -= 30 * (1 - (x - 0.03) / 0.02);
    return g;
  });
}

/** Lawn: dense grass blades at several scales with clumps and patches. */
export function lawn(size: number, seed: number): HTMLCanvasElement {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d')!;
  const big = makeFbm(seed, 4, 4);
  const base = fill(size, (u, v) => 150 + (big(u, v) - 0.5) * 70);
  ctx.drawImage(base, 0, 0);
  const r = rng(seed + 1);
  const N = size * size * 0.06;
  for (let i = 0; i < N; i++) {
    const x = r() * size;
    const y = r() * size;
    const l = 3 + r() * 9;
    const a = -Math.PI / 2 + (r() - 0.5) * 0.9;
    const g = 100 + r() * 150;
    ctx.strokeStyle = `rgba(${g},${g},${g},${0.35 + r() * 0.4})`;
    ctx.lineWidth = 0.6 + r() * 0.9;
    ctx.beginPath();
    for (const ox of [0, -size, size]) {
      for (const oy of [0, -size, size]) {
        if (ox === 0 && oy === 0) {
          ctx.moveTo(x, y);
          ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
        } else if (x + ox > -12 && x + ox < size + 12 && y + oy > -12 && y + oy < size + 12) {
          ctx.moveTo(x + ox, y + oy);
          ctx.lineTo(x + ox + Math.cos(a) * l, y + oy + Math.sin(a) * l);
        }
      }
    }
    ctx.stroke();
  }
  return c;
}

/** Sealed / board-formed concrete: mottling, pores, faint trowel arcs, one control joint per tile. */
export function concrete(size: number, seed: number): HTMLCanvasElement {
  const m = makeFbm(seed, 6, 5);
  const p = makeNoise(seed + 3, 384);
  const t = makeFbm(seed + 7, 2, 3);
  return fill(size, (u, v, x, y) => {
    let g = 205 + (m(u, v) - 0.5) * 60;
    if (p(u * 384, v * 384) > 0.86) g -= 45;
    g += Math.sin((Math.hypot(u - t(u, v), v) * 40) % (Math.PI * 2)) * 3;
    if (x < 2 || y < 2) g -= 70;
    return g;
  });
}

/** Ashlar pavers: two courses of mixed-size rectangular stones, each with its own tone and cleft texture. */
export function ashlar(size: number, seed: number): HTMLCanvasElement {
  const r = rng(seed);
  // a fixed tiling of rectangles over a 6x6 grid
  const grid = 6;
  const owner = new Int32Array(grid * grid).fill(-1);
  const rects: { x: number; y: number; w: number; h: number; tone: number }[] = [];
  for (let j = 0; j < grid; j++)
    for (let i = 0; i < grid; i++) {
      if (owner[j * grid + i] >= 0) continue;
      let w = 1 + Math.floor(r() * 2);
      let h = 1 + Math.floor(r() * 2);
      if (i + w > grid) w = grid - i;
      if (j + h > grid) h = grid - j;
      for (let b = 0; b < h; b++) for (let a = 0; a < w; a++) if (owner[(j + b) * grid + i + a] >= 0) { w = a || 1; }
      for (let b = 0; b < h; b++) for (let a = 0; a < w; a++) if (owner[(j + b) * grid + i + a] >= 0) h = b || 1;
      const id = rects.length;
      rects.push({ x: i, y: j, w, h, tone: (r() - 0.5) * 70 });
      for (let b = 0; b < h; b++) for (let a = 0; a < w; a++) owner[(j + b) * grid + i + a] = id;
    }
  const cleft = makeFbm(seed + 3, 24, 4);
  return fill(size, (u, v) => {
    const gi = Math.min(grid - 1, Math.floor(u * grid));
    const gj = Math.min(grid - 1, Math.floor(v * grid));
    const rc = rects[owner[gj * grid + gi]];
    const lx = u * grid - rc.x;
    const ly = v * grid - rc.y;
    const d = Math.min(lx, ly, rc.w - lx, rc.h - ly) / grid;
    if (d < 0.006) return 70 + cleft(u, v) * 40;
    return 175 + rc.tone + (cleft(u + rc.x, v + rc.y) - 0.5) * 80 - smooth(0.014, 0.006, d) * 40;
  });
}

/** Handmade zellige / ceramic tile: 4x4 squares with glaze pooling, uneven edges, grout. */
export function zellige(size: number, seed: number): HTMLCanvasElement {
  const r = rng(seed);
  const n = 4;
  const tones = Array.from({ length: n * n }, () => (r() - 0.5) * 60);
  const glaze = makeFbm(seed + 3, 16, 4);
  return fill(size, (u, v) => {
    const i = Math.floor(u * n);
    const j = Math.floor(v * n);
    const lx = u * n - i;
    const ly = v * n - j;
    const wob = (glaze(u, v) - 0.5) * 0.06;
    const d = Math.min(lx, ly, 1 - lx, 1 - ly) + wob;
    if (d < 0.025) return 120;
    const pool = smooth(0.03, 0.12, d);
    return 200 + tones[j * n + i] + (glaze(u * 2, v * 2) - 0.5) * 70 - (1 - pool) * 40;
  });
}

/** Cut-pile carpet: fine tufts with soft mottling. */
export function carpet(size: number, seed: number): HTMLCanvasElement {
  const tuft = makeNoise(seed, 256);
  const mot = makeFbm(seed + 3, 8, 3);
  return fill(size, (u, v) => 190 + (tuft(u * 256, v * 256) - 0.5) * 80 + (mot(u, v) - 0.5) * 40);
}

/** Bouclé: a dense field of small looped curls. */
export function boucle(size: number, seed: number): HTMLCanvasElement {
  const c = makeCanvas(size);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = 'rgb(150,150,150)';
  ctx.fillRect(0, 0, size, size);
  const r = rng(seed);
  const N = size * size * 0.012;
  for (let i = 0; i < N; i++) {
    const x = r() * size;
    const y = r() * size;
    const rad = 2 + r() * 4;
    const g = 150 + r() * 105;
    ctx.strokeStyle = `rgba(${g},${g},${g},0.85)`;
    ctx.lineWidth = 1 + r() * 1.4;
    for (const [ox, oy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) {
      if (ox !== 0 || oy !== 0) if (x + ox < -8 || x + ox > size + 8 || y + oy < -8 || y + oy > size + 8) continue;
      ctx.beginPath();
      ctx.arc(x + ox, y + oy, rad, r() * 6, r() * 6 + 4.5);
      ctx.stroke();
    }
  }
  return c;
}

/** Linen: slubby plain weave with irregular thread thickness. */
export function linen(size: number, seed: number): HTMLCanvasElement {
  const slubU = makeFbm(seed, 64, 2);
  const slubV = makeFbm(seed + 3, 64, 2);
  const mot = makeFbm(seed + 7, 6, 3);
  return fill(size, (u, v, x, y) => {
    const wu = Math.sin((x / size) * Math.PI * 2 * 180) * 0.5 + 0.5;
    const wv = Math.sin((y / size) * Math.PI * 2 * 180) * 0.5 + 0.5;
    const over = (Math.floor(x / (size / 180)) + Math.floor(y / (size / 180))) % 2 ? wu : wv;
    return 170 + over * 40 + (slubU(u, v * 0.1) - 0.5) * 40 + (slubV(u * 0.1, v) - 0.5) * 40 + (mot(u, v) - 0.5) * 20;
  });
}

/** Leather: pebble grain cells, fine pores and soft creases. */
export function leather(size: number, seed: number): HTMLCanvasElement {
  const r = rng(seed);
  const cells = 2200;
  const pts = Array.from({ length: cells }, () => [r(), r()] as [number, number]);
  // spatial hash
  const G = 48;
  const buckets: number[][] = Array.from({ length: G * G }, () => []);
  pts.forEach(([x, y], i) => buckets[Math.floor(y * G) * G + Math.floor(x * G)].push(i));
  const crease = makeFbm(seed + 5, 4, 4);
  const pore = makeNoise(seed + 7, 512);
  return fill(size, (u, v) => {
    const gx = Math.floor(u * G);
    const gy = Math.floor(v * G);
    let d1 = 9;
    let d2 = 9;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const bx = (gx + dx + G) % G;
        const by = (gy + dy + G) % G;
        for (const i of buckets[by * G + bx]) {
          let ddx = Math.abs(pts[i][0] - u);
          let ddy = Math.abs(pts[i][1] - v);
          if (ddx > 0.5) ddx = 1 - ddx;
          if (ddy > 0.5) ddy = 1 - ddy;
          const dd = ddx * ddx + ddy * ddy;
          if (dd < d1) {
            d2 = d1;
            d1 = dd;
          } else if (dd < d2) d2 = dd;
        }
      }
    const edge = Math.sqrt(d2) - Math.sqrt(d1);
    let g = 175 + smooth(0, 0.01, edge) * 45;
    const c = crease(u, v);
    g -= Math.max(0, 1 - Math.abs(c - 0.5) * 40) * 35;
    if (pore(u * 512, v * 512) > 0.9) g -= 25;
    return g;
  });
}

/** Burl: swirling figure with eyes. */
export function burl(size: number, seed: number): HTMLCanvasElement {
  const w = makeFbm(seed, 4, 5);
  const w2 = makeFbm(seed + 3, 10, 4);
  const eye = makeNoise(seed + 5, 24);
  return fill(size, (u, v) => {
    const a = w(u, v) * 9 + w2(u, v) * 3;
    const f = a - Math.floor(a);
    let g = 190 - smooth(0.6, 0.95, f) * 70 + (w2(u * 2, v * 2) - 0.5) * 40;
    const e = eye(u * 24, v * 24);
    if (e > 0.88) g -= (e - 0.88) * 900;
    return g;
  });
}

/** Soapstone: smooth dark field, soft clouding and a few thin pale veins. */
export function veins(size: number, seed: number): HTMLCanvasElement {
  const cloud = makeFbm(seed, 3, 4);
  const w = makeFbm(seed + 3, 2, 4);
  const w2 = makeFbm(seed + 5, 5, 3);
  return fill(size, (u, v) => {
    let g = 120 + (cloud(u, v) - 0.5) * 40;
    const a = (u + v * 0.6 + w(u, v) * 0.8) * 4;
    const d = Math.abs(a - Math.round(a));
    g += Math.max(0, 1 - d * 60) * 55;
    const b = (u * 0.4 - v + w2(u, v) * 0.6) * 6;
    const d2 = Math.abs(b - Math.round(b));
    g += Math.max(0, 1 - d2 * 110) * 30;
    return g;
  });
}

/** Modular brick, running bond: 18 courses x 6 bricks per tile (tile = 1.2 m), raked mortar, per-brick tone, sand speckle. */
export function brick(size: number, seed: number): HTMLCanvasElement {
  const r = rng(seed);
  const rows = 18;
  const per = 6;
  const tone: number[] = [];
  for (let i = 0; i < rows * per; i++) tone.push((r() - 0.5) * 46 + (r() < 0.08 ? -30 : 0));
  const grain = makeFbm(seed + 3, 48, 3);
  const speck = makeNoise(seed + 9, 512);
  const edge = makeFbm(seed + 5, 12, 2);
  return fill(size, (u, v) => {
    const row = Math.min(rows - 1, Math.floor(v * rows));
    const fv = v * rows - row;
    const shift = row % 2 ? 0.5 : 0;
    const bu = u * per + shift;
    const col = Math.floor(bu);
    const fu = bu - col;
    // mortar joints ~10 mm, slightly irregular brick edges
    const j = 0.075 + (edge(u, v) - 0.5) * 0.05;
    const dv = Math.min(fv, 1 - fv);
    const du = Math.min(fu, 1 - fu) * (200 / 67);
    const d = Math.min(dv, du);
    if (d < j) return 118 + (grain(u, v) - 0.5) * 30 + (speck(u * 512, v * 512) > 0.9 ? -20 : 0);
    const b = tone[row * per + (((col % per) + per) % per)];
    const bevel = smooth(j, j + 0.07, d);
    return 150 + b + (grain(u, v) - 0.5) * 40 + (speck(u * 512, v * 512) > 0.86 ? -26 : 0) - (1 - bevel) * 30;
  });
}

/** Sawn limestone, random coursed ashlar: courses 1-3 units tall, blocks 3-8 units long (24 units per tile), thin pale joints. */
export function limestone(size: number, seed: number): HTMLCanvasElement {
  const r = rng(seed);
  const U = 24;
  const courses: { y: number; h: number; cuts: number[]; tones: number[] }[] = [];
  let y = 0;
  while (y < U) {
    let h = 1 + Math.floor(r() * 3);
    if (y + h > U) h = U - y;
    const cuts: number[] = [];
    const tones: number[] = [];
    let x = r() * 4;
    const x0 = x;
    while (x < x0 + U - 2) {
      cuts.push(x);
      tones.push((r() - 0.5) * 36 + (r() < 0.15 ? 16 : 0) + (r() < 0.1 ? -16 : 0));
      x += 2.5 + r() * 5;
    }
    courses.push({ y, h, cuts, tones });
    y += h;
  }
  const sand = makeFbm(seed + 2, 64, 3);
  const cloud = makeFbm(seed + 4, 6, 3);
  const pore = makeNoise(seed + 6, 640);
  return fill(size, (u, v) => {
    const gy = v * U;
    let c = courses[courses.length - 1];
    for (const cc of courses) if (gy >= cc.y && gy < cc.y + cc.h) { c = cc; break; }
    const gx = u * U;
    // find block within the course, wrapping around the tile
    let k = c.cuts.length - 1;
    for (let i = 0; i < c.cuts.length; i++) {
      const a = c.cuts[i];
      const b = i + 1 < c.cuts.length ? c.cuts[i + 1] : c.cuts[0] + U;
      const xx = gx < a ? gx + U : gx;
      if (xx >= a && xx < b) { k = i; break; }
    }
    const a = c.cuts[k];
    const b = k + 1 < c.cuts.length ? c.cuts[k + 1] : c.cuts[0] + U;
    const xx = gx < a ? gx + U : gx;
    const dx = Math.min(xx - a, b - xx);
    const dy = Math.min(gy - c.y, c.y + c.h - gy);
    const d = Math.min(dx, dy);
    if (d < 0.05) return 182 + (sand(u, v) - 0.5) * 20;
    const chamfer = smooth(0.05, 0.14, d);
    const p = pore(u * 640, v * 640);
    return 200 + c.tones[k] + (cloud(u + k * 0.13, v) - 0.5) * 34 + (sand(u, v) - 0.5) * 30 - (p > 0.88 ? 22 : 0) - (1 - chamfer) * 16;
  });
}
