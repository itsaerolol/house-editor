import { makeCanvas } from './canvas';
import * as THREE from 'three';
import type { TextureKey } from '../model/types';
import * as TG from './texgen';

/** Procedural, asset-free textures. Everything is generated on a canvas, so nothing can 404. */

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const g = (v: number) => {
  const c = Math.max(0, Math.min(255, Math.round(v)));
  return `rgb(${c},${c},${c})`;
};

function canvas(size: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = makeCanvas(size);
  return [c, c.getContext('2d')!];
}

function speckle(ctx: CanvasRenderingContext2D, size: number, r: () => number, count: number, lo: number, hi: number, a = 0.12) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = `rgba(${lo + r() * (hi - lo) | 0},${lo + r() * (hi - lo) | 0},${lo + r() * (hi - lo) | 0},${a})`;
    ctx.fillRect(r() * size, r() * size, 1 + r() * 2, 1 + r() * 2);
  }
}

const painters: Partial<Record<TextureKey, (size: number) => HTMLCanvasElement>> = {
  siding(size) {
    const [c, ctx] = canvas(size);
    const r = rng(11);
    const boards = 4;
    const bw = size / boards;
    for (let i = 0; i < boards; i++) {
      ctx.fillStyle = g(228 + r() * 18);
      ctx.fillRect(i * bw, 0, bw, size);
      for (let k = 0; k < 14; k++) {
        ctx.fillStyle = `rgba(0,0,0,${0.025 + r() * 0.04})`;
        ctx.fillRect(i * bw + r() * bw, 0, 1, size);
      }
    }
    for (let i = 0; i < boards; i++) {
      const x = i * bw;
      ctx.fillStyle = g(150);
      ctx.fillRect(x - 6, 0, 12, size);
      ctx.fillStyle = g(250);
      ctx.fillRect(x - 3, 0, 6, size);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(x + 3, 0, 2, size);
      ctx.fillRect(x - 6, 0, 2, size);
    }
    speckle(ctx, size, r, 1200, 190, 255, 0.1);
    return c;
  },
  oak(size) {
    const [c, ctx] = canvas(size);
    const r = rng(21);
    const rows = 6;
    const rh = size / rows;
    for (let i = 0; i < rows; i++) {
      let x = -r() * size * 0.5;
      while (x < size) {
        const len = size * (0.45 + r() * 0.55);
        ctx.fillStyle = g(218 + r() * 30);
        ctx.fillRect(x, i * rh, len, rh);
        for (let k = 0; k < 18; k++) {
          ctx.fillStyle = `rgba(60,40,20,${0.04 + r() * 0.09})`;
          ctx.fillRect(x + r() * len, i * rh + r() * rh, 30 + r() * 120, 1 + r());
        }
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(x, i * rh, 2, rh);
        x += len;
      }
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(0, i * rh, size, 2);
    }
    speckle(ctx, size, r, 800, 160, 255, 0.07);
    return c;
  },
  walnut(size) {
    const [c, ctx] = canvas(size);
    const r = rng(31);
    ctx.fillStyle = g(225);
    ctx.fillRect(0, 0, size, size);
    for (let k = 0; k < 220; k++) {
      ctx.fillStyle = `rgba(40,20,10,${0.05 + r() * 0.12})`;
      const y = r() * size;
      ctx.fillRect(0, y, size, 1 + r() * 2);
    }
    for (let k = 0; k < 60; k++) {
      ctx.fillStyle = `rgba(255,235,210,${0.04 + r() * 0.06})`;
      ctx.fillRect(r() * size, r() * size, 60 + r() * 200, 1);
    }
    return c;
  },
  tile(size) {
    const [c, ctx] = canvas(size);
    const r = rng(41);
    const n = 2;
    const t = size / n;
    ctx.fillStyle = g(140);
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        ctx.fillStyle = g(228 + r() * 22);
        ctx.fillRect(i * t + 5, j * t + 5, t - 10, t - 10);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(i * t + 5, j * t + 5, t - 10, 3);
      }
    speckle(ctx, size, r, 600, 190, 255, 0.07);
    return c;
  },
  stone(size) {
    const [c, ctx] = canvas(size);
    const r = rng(51);
    ctx.fillStyle = g(95);
    ctx.fillRect(0, 0, size, size);
    let y = 0;
    while (y < size) {
      const h = 34 + r() * 40;
      let x = -r() * 80;
      while (x < size) {
        const w = 80 + r() * 130;
        const tone = 165 + r() * 80;
        ctx.fillStyle = g(tone);
        ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
        ctx.fillStyle = 'rgba(255,255,255,0.14)';
        ctx.fillRect(x + 3, y + 3, w - 6, 4);
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(x + 3, y + h - 8, w - 6, 5);
        x += w;
      }
      y += h;
    }
    speckle(ctx, size, r, 2500, 110, 255, 0.14);
    return c;
  },
  shingle(size) {
    const [c, ctx] = canvas(size);
    const r = rng(61);
    const rows = 8;
    const rh = size / rows;
    for (let i = 0; i < rows; i++) {
      const off = (i % 2) * (size / 8);
      for (let x = -size / 4; x < size; x += size / 4) {
        ctx.fillStyle = g(205 + r() * 40);
        ctx.fillRect(x + off + 2, i * rh, size / 4 - 3, rh - 1);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, i * rh + rh - 5, size, 5);
    }
    speckle(ctx, size, r, 2500, 120, 255, 0.12);
    return c;
  },
  seam(size) {
    const [c, ctx] = canvas(size);
    const ribs = 3;
    const w = size / ribs;
    ctx.fillStyle = g(235);
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < ribs; i++) {
      const x = i * w;
      ctx.fillStyle = g(255);
      ctx.fillRect(x, 0, 8, size);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(x + 8, 0, 10, size);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(x + 18, 0, w - 18, size);
    }
    return c;
  },
  grass(size) {
    const [c, ctx] = canvas(size);
    const r = rng(71);
    ctx.fillStyle = g(225);
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 9000; i++) {
      const v = 170 + r() * 85;
      ctx.fillStyle = `rgba(${v},${v},${v},0.22)`;
      ctx.fillRect(r() * size, r() * size, 1 + r() * 2, 2 + r() * 5);
    }
    return c;
  },
  concrete(size) {
    const [c, ctx] = canvas(size);
    const r = rng(81);
    ctx.fillStyle = g(232);
    ctx.fillRect(0, 0, size, size);
    speckle(ctx, size, r, 5000, 150, 255, 0.1);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, 0, size, 2);
    ctx.fillRect(0, 0, 2, size);
    return c;
  },
  pavers(size) {
    const [c, ctx] = canvas(size);
    const r = rng(91);
    ctx.fillStyle = g(120);
    ctx.fillRect(0, 0, size, size);
    const n = 4;
    const t = size / n;
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = g(190 + r() * 60);
        ctx.fillRect(i * t + 4, j * t + 4, t - 8, t - 8);
      }
    speckle(ctx, size, r, 3000, 130, 255, 0.1);
    return c;
  },
  carpet(size) {
    const [c, ctx] = canvas(size);
    const r = rng(101);
    ctx.fillStyle = g(235);
    ctx.fillRect(0, 0, size, size);
    speckle(ctx, size, r, 9000, 170, 255, 0.18);
    return c;
  },
};

/** Vintage Persian rug (one full rug, not a tile): rust field, navy and cream borders, stepped medallion, corner spandrels, scattered florals, distressed wash. */
function paintPersian(size: number): HTMLCanvasElement {
  const [c, ctx] = canvas(size);
  const r = rng(77);
  const S = size;
  const rust = '#9b4a37';
  const rustD = '#7c3527';
  const navy = '#2c3a55';
  const cream = '#e6d9c0';
  const sky = '#7f99a8';
  const gold = '#c79a52';
  ctx.fillStyle = rust;
  ctx.fillRect(0, 0, S, S);
  // borders from the outside in
  const band = (inset: number, w: number, col: string) => {
    ctx.fillStyle = col;
    ctx.fillRect(inset, inset, S - 2 * inset, w);
    ctx.fillRect(inset, S - inset - w, S - 2 * inset, w);
    ctx.fillRect(inset, inset, w, S - 2 * inset);
    ctx.fillRect(S - inset - w, inset, w, S - 2 * inset);
  };
  band(0, S * 0.012, cream);
  band(S * 0.012, S * 0.006, navy);
  band(S * 0.018, S * 0.07, '#a9a59d');
  band(S * 0.088, S * 0.006, navy);
  band(S * 0.094, S * 0.03, rustD);
  band(S * 0.124, S * 0.005, gold);
  // repeating motifs in the main border (rosettes and leaves)
  // angular 8-point star (two rotated squares) with a contrasting core and a dark contour
  const motif = (x: number, y: number, rr: number, a: string, b: string) => {
    const star = (rad: number, col: string) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      for (let k = 0; k < 16; k++) {
        const an = (k / 16) * Math.PI * 2 + Math.PI / 16;
        const l = k % 2 ? rad * 0.62 : rad;
        ctx.lineTo(x + Math.cos(an) * l, y + Math.sin(an) * l);
      }
      ctx.closePath();
      ctx.fill();
    };
    ctx.lineWidth = Math.max(1, rr * 0.08);
    ctx.strokeStyle = 'rgba(40,25,25,0.55)';
    star(rr, a);
    ctx.stroke();
    star(rr * 0.5, b);
    ctx.fillStyle = a;
    ctx.fillRect(x - rr * 0.12, y - rr * 0.12, rr * 0.24, rr * 0.24);
  };
  // boteh (paisley teardrop)
  const boteh = (x: number, y: number, rr: number, ang: number, col: string, edge: string) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.fillStyle = col;
    ctx.strokeStyle = edge;
    ctx.lineWidth = Math.max(1, rr * 0.12);
    ctx.beginPath();
    ctx.moveTo(0, -rr);
    ctx.bezierCurveTo(rr * 0.9, -rr * 0.6, rr * 0.8, rr * 0.9, 0, rr);
    ctx.bezierCurveTo(-rr * 0.9, rr * 0.7, -rr * 0.3, -rr * 0.2, rr * 0.25, -rr * 0.55);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };
  const bm = S * 0.053;
  const vine = (horiz: boolean, at: number) => {
    ctx.strokeStyle = navy;
    ctx.lineWidth = S * 0.0025;
    ctx.beginPath();
    for (let t = 0.03; t <= 0.97; t += 0.004) {
      const off = Math.sin(t * 120) * S * 0.016;
      if (horiz) ctx.lineTo(t * S, at + off);
      else ctx.lineTo(at + off, t * S);
    }
    ctx.stroke();
  };
  vine(true, bm);
  vine(true, S - bm);
  vine(false, bm);
  vine(false, S - bm);
  for (let t = 0.04; t < 0.97; t += 0.026) {
    const i = Math.round(t * 1000);
    const c1 = i % 3 === 0 ? navy : i % 3 === 1 ? rust : sky;
    motif(t * S, bm, S * 0.012, c1, gold);
    motif(t * S, S - bm, S * 0.012, c1, gold);
    motif(bm, t * S, S * 0.012, c1, gold);
    motif(S - bm, t * S, S * 0.012, c1, gold);
  }
  // field: stepped inner panel in rust with darker lattice
  const f0 = S * 0.13;
  // corner spandrels (quarter medallions)
  const spandrel = (cx: number, cy: number, sx: number, sy: number) => {
    ctx.fillStyle = cream;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    for (let k = 0; k <= 8; k++) {
      const a = (k / 8) * (Math.PI / 2);
      const rr = S * (0.2 + (k % 2) * 0.02);
      ctx.lineTo(cx + sx * Math.cos(a) * rr, cy + sy * Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d8c4a6';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    for (let k = 0; k <= 8; k++) {
      const a = (k / 8) * (Math.PI / 2);
      const rr = S * (0.12 + (k % 2) * 0.015);
      ctx.lineTo(cx + sx * Math.cos(a) * rr, cy + sy * Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    motif(cx + sx * S * 0.06, cy + sy * S * 0.06, S * 0.025, rust, navy);
  };
  spandrel(f0, f0, 1, 1);
  spandrel(S - f0, f0, -1, 1);
  spandrel(f0, S - f0, 1, -1);
  spandrel(S - f0, S - f0, -1, -1);
  // central stepped medallion (lozenge with step edges) in layers
  const cx = S / 2;
  const cy = S / 2;
  const lozenge = (rx: number, ry: number, col: string, steps: number) => {
    ctx.fillStyle = col;
    ctx.strokeStyle = 'rgba(40,25,25,0.6)';
    ctx.lineWidth = S * 0.002;
    ctx.beginPath();
    const dx = rx / steps;
    const dy = ry / steps;
    // quadrants: top -> right -> bottom -> left, each a staircase
    const quads: [number, number][] = [[1, 1], [-1, 1], [-1, -1], [1, -1]];
    let x = cx;
    let y = cy - ry;
    ctx.moveTo(x, y);
    for (const [sx, sy] of quads) {
      for (let k = 0; k < steps; k++) {
        x += sx * dx;
        ctx.lineTo(x, y);
        y += sy * dy;
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };
  lozenge(S * 0.27, S * 0.36, cream, 11);
  lozenge(S * 0.23, S * 0.31, rust, 10);
  lozenge(S * 0.18, S * 0.24, navy, 8);
  lozenge(S * 0.13, S * 0.18, cream, 7);
  lozenge(S * 0.085, S * 0.12, rustD, 5);
  motif(cx, cy, S * 0.07, cream, gold);
  motif(cx, cy, S * 0.035, rust, cream);
  // pendants above and below the medallion
  for (const sy of [-1, 1]) {
    motif(cx, cy + sy * S * 0.33, S * 0.035, navy, cream);
    motif(cx, cy + sy * S * 0.37, S * 0.02, cream, rust);
  }
  // fine ornament everywhere: hooks, tiny rosettes, dots and vine strokes, clipped per zone
  const orn = (clip: () => void, count: number, pal: string[], scale: number) => {
    ctx.save();
    ctx.beginPath();
    clip();
    ctx.clip();
    for (let i = 0; i < count; i++) {
      const x = r() * S;
      const y = r() * S;
      const col = pal[Math.floor(r() * pal.length)];
      ctx.fillStyle = col;
      ctx.strokeStyle = col;
      const k = r();
      const sc = S * scale * (0.6 + r() * 0.8);
      if (k < 0.3) {
        // hooked stroke
        ctx.lineWidth = sc * 0.18;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + sc, y + (r() - 0.5) * sc);
        ctx.lineTo(x + sc * 1.2, y - sc * 0.5);
        ctx.stroke();
      } else if (k < 0.45) {
        motif(x, y, sc * 0.9, col, pal[(pal.indexOf(col) + 1) % pal.length]);
      } else if (k < 0.6) {
        boteh(x, y, sc * 0.9, r() * 6.28, col, 'rgba(40,25,25,0.5)');
      } else if (k < 0.8) {
        ctx.fillRect(x, y, sc * 0.35, sc * 0.35);
      } else {
        ctx.lineWidth = sc * 0.12;
        ctx.beginPath();
        ctx.arc(x, y, sc * 0.7, r() * 6, r() * 6 + 2.4);
        ctx.stroke();
      }
    }
    ctx.restore();
  };
  const fullField = () => ctx.rect(f0, f0, S - 2 * f0, S - 2 * f0);
  orn(fullField, 16000, [navy, cream, sky, gold, rustD], 0.005);
  orn(() => ctx.rect(S * 0.018, S * 0.018, S * 0.964, S * 0.07), 2600, [navy, rust, sky, gold], 0.0045);
  orn(() => ctx.rect(S * 0.018, S * 0.912, S * 0.964, S * 0.07), 2600, [navy, rust, sky, gold], 0.0045);
  orn(() => ctx.rect(S * 0.018, S * 0.018, S * 0.07, S * 0.964), 2600, [navy, rust, sky, gold], 0.0045);
  orn(() => ctx.rect(S * 0.912, S * 0.018, S * 0.07, S * 0.964), 2600, [navy, rust, sky, gold], 0.0045);
  orn(() => ctx.ellipse(cx, cy, S * 0.25, S * 0.33, 0, 0, Math.PI * 2), 7000, [rust, navy, cream, gold, sky], 0.004);
  // distressed wash: worn pale patches, pile streaks, overall fade
  for (let i = 0; i < 420; i++) {
    ctx.fillStyle = `rgba(232,220,200,${0.06 + r() * 0.16})`;
    ctx.beginPath();
    ctx.ellipse(r() * S, r() * S, S * (0.01 + r() * 0.06), S * (0.002 + r() * 0.01), (r() - 0.5) * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(228,214,196,0.12)';
  ctx.fillRect(0, 0, S, S);
  speckle(ctx, S, r, 90000, 60, 230, 0.1);
  return c;
}

/** Moody abstract horizon painting: smoky umber sky, a dark band of distant hills, misty ground, canvas weave. */
function paintHorizon(size: number): HTMLCanvasElement {
  const [c, ctx] = canvas(size);
  const r = rng(5);
  const S = size;
  const H0 = 0.46;
  const sky = ctx.createLinearGradient(0, 0, 0, S);
  sky.addColorStop(0, '#6a6158');
  sky.addColorStop(0.25, '#857d74');
  sky.addColorStop(H0 - 0.02, '#9a9083');
  sky.addColorStop(H0 + 0.04, '#5c5045');
  sky.addColorStop(0.75, '#6e6255');
  sky.addColorStop(1, '#4e443b');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, S, S);
  // smoky clouds and dry-brush texture
  ctx.filter = `blur(${Math.round(S * 0.01)}px)`;
  for (let i = 0; i < 260; i++) {
    const y = r() * S * H0;
    const k = r();
    ctx.fillStyle = k > 0.5 ? `rgba(190,178,160,${0.05 + r() * 0.08})` : `rgba(70,60,52,${0.05 + r() * 0.08})`;
    ctx.beginPath();
    ctx.ellipse(r() * S, y, S * (0.05 + r() * 0.2), S * (0.01 + r() * 0.035), (r() - 0.5) * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  // tree-line silhouette: ragged bumps on a thin dark band
  ctx.fillStyle = '#231d18';
  ctx.beginPath();
  ctx.moveTo(0, S * (H0 + 0.03));
  for (let x = 0; x <= S; x += S / 240) {
    const t = x / S;
    let y = S * (H0 + 0.012 - 0.008 * Math.sin(t * 13) - 0.01 * t);
    if ((t > 0.36 && t < 0.42) || (t > 0.66 && t < 0.78)) y -= S * 0.05 * Math.sin(((t > 0.6 ? (t - 0.66) / 0.12 : (t - 0.36) / 0.06)) * Math.PI) * (0.7 + r() * 0.5);
    y -= S * r() * 0.006;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(S, S * (H0 + 0.045));
  ctx.lineTo(0, S * (H0 + 0.045));
  ctx.closePath();
  ctx.fill();
  // misty ground: soft horizontal washes
  for (let i = 0; i < 200; i++) {
    const y = S * (H0 + 0.04 + r() * (1 - H0));
    ctx.fillStyle = r() > 0.5 ? `rgba(150,138,122,${0.05 + r() * 0.09})` : `rgba(60,50,43,${0.05 + r() * 0.1})`;
    ctx.fillRect(r() * S - S * 0.2, y, S * (0.15 + r() * 0.7), S * (0.006 + r() * 0.02));
  }
  ctx.filter = 'none';
  // fine paint speckle and a faint canvas tooth
  speckle(ctx, S, r, 18000, 70, 200, 0.08);
  ctx.globalAlpha = 0.025;
  for (let i = 0; i < S; i += 2) {
    ctx.fillStyle = i % 4 ? '#000' : '#fff';
    ctx.fillRect(i, 0, 1, S);
    ctx.fillRect(0, i, S, 1);
  }
  ctx.globalAlpha = 1;
  return c;
}

const PAINT_SIZE: Partial<Record<TextureKey, number>> = { persian: 2048, horizon: 1024 };

/** High-detail generators (1024 px, seamless); fall back to the legacy painters if one is missing. */
const DETAILED: Partial<Record<TextureKey, (size: number) => HTMLCanvasElement>> = {
  siding: (n) => TG.boardBatten(n, 11),
  oak: (n) => TG.plankFloor(n, 21, 5),
  walnut: (n) => TG.woodGrain(n, 31, { contrast: 1.1, bands: 26 }),
  tile: (n) => TG.zellige(n, 41),
  stone: (n) => TG.ledgestone(n, 51),
  shingle: (n) => TG.shingles(n, 61),
  seam: (n) => TG.standingSeam(n, 63),
  grass: (n) => TG.lawn(n, 71),
  concrete: (n) => TG.concrete(n, 81),
  pavers: (n) => TG.ashlar(n, 91),
  carpet: (n) => TG.carpet(n, 101),
  boucle: (n) => TG.boucle(n, 111),
  linen: (n) => TG.linen(n, 121),
  leather: (n) => TG.leather(n, 131),
  burl: (n) => TG.burl(n, 141),
  vein: (n) => TG.veins(n, 151),
  brick: (n) => TG.brick(n, 161),
  limestone: (n) => TG.limestone(n, 171),
};
const DETAILED_SIZE = 1024;

/** Paint one texture tile. Pure: runs on the main thread or in a worker. */
export function generateTextureCanvas(key: TextureKey): HTMLCanvasElement {
  if (key === 'persian') return paintPersian(PAINT_SIZE.persian ?? 1024);
  if (key === 'horizon') return paintHorizon(PAINT_SIZE.horizon ?? 1024);
  const gen = DETAILED[key];
  return gen ? gen(DETAILED_SIZE) : painters[key]!(PAINT_SIZE[key] ?? 512);
}

/* ---------------------------------------------------------------- async loading
 * Textures are painted in a worker pool (and cached in IndexedDB) so the page never blocks.
 * Until a tile arrives, a materials shows its flat colour through a tiny neutral placeholder;
 * every clone of the texture then swaps to the real image in place.
 */
type TexFetcher = (key: TextureKey) => Promise<ImageBitmap | HTMLCanvasElement>;
let fetcher: TexFetcher | null = null;
let onArrive: (apply: () => void) => void = (apply) => apply();
/** Install the async painter (worker pool). `land` decides when an arrived tile is applied (batched with other arrivals). */
export function setTextureFetcher(f: TexFetcher | null, land: (apply: () => void) => void = (apply) => apply()) {
  fetcher = f;
  onArrive = land;
}

let placeholder: HTMLCanvasElement | null = null;
function neutral(): HTMLCanvasElement {
  if (!placeholder) {
    placeholder = makeCanvas(2);
    const ctx = placeholder.getContext('2d')!;
    ctx.fillStyle = 'rgb(196,196,196)';
    ctx.fillRect(0, 0, 2, 2);
  }
  return placeholder;
}

const baseCache = new Map<TextureKey, THREE.Texture>();
const scaledCache = new Map<string, THREE.Texture>();
/** every texture object that shows a given tile (colour and bump clones) */
const users = new Map<TextureKey, THREE.Texture[]>();
const pendingTiles = new Set<TextureKey>();
export const texturesPending = () => pendingTiles.size;

function deliver(key: TextureKey, img: ImageBitmap | HTMLCanvasElement) {
  onArrive(() => apply(key, img));
}
function apply(key: TextureKey, img: ImageBitmap | HTMLCanvasElement) {
  const bitmap = typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap;
  for (const t of users.get(key) ?? []) {
    t.image = img;
    // worker bitmaps arrive pre-flipped; WebGL cannot flip ImageBitmaps itself
    t.flipY = !bitmap;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.needsUpdate = true;
  }
  pendingTiles.delete(key);
}

function base(key: TextureKey): THREE.Texture {
  let b = baseCache.get(key);
  if (b) return b;
  if (!fetcher) {
    b = new THREE.CanvasTexture(generateTextureCanvas(key));
  } else {
    b = new THREE.Texture(neutral());
    b.needsUpdate = true;
    pendingTiles.add(key);
    fetcher(key).then((img) => deliver(key, img), () => deliver(key, generateTextureCanvas(key)));
  }
  b.wrapS = b.wrapT = THREE.RepeatWrapping;
  b.colorSpace = THREE.SRGBColorSpace;
  b.anisotropy = 8;
  b.generateMipmaps = true;
  b.minFilter = THREE.LinearMipmapLinearFilter;
  baseCache.set(key, b);
  users.set(key, [b]);
  return b;
}

export function getTexture(key: TextureKey, metersPerRepeat: number): THREE.Texture | null {
  if (key === 'none') return null;
  const id = `${key}@${metersPerRepeat.toFixed(3)}`;
  let t = scaledCache.get(id);
  if (t) return t;
  const b = base(key);
  t = b.clone();
  t.needsUpdate = true;
  const s = 1 / Math.max(0.05, metersPerRepeat);
  t.repeat.set(s, s);
  scaledCache.set(id, t);
  users.get(key)!.push(t);
  return t;
}

export function disposeTextures() {
  for (const t of scaledCache.values()) t.dispose();
  for (const t of baseCache.values()) t.dispose();
  scaledCache.clear();
  baseCache.clear();
}

/** Same image as a linear (non-sRGB) texture for bump mapping. */
const bumpScaled = new Map<string, THREE.Texture>();
export function getBumpTexture(key: TextureKey, metersPerRepeat: number): THREE.Texture | null {
  if (key === 'none' || key === 'persian' || key === 'horizon') return null;
  const id = `${key}@${metersPerRepeat.toFixed(3)}`;
  const hit = bumpScaled.get(id);
  if (hit) return hit;
  const color = getTexture(key, metersPerRepeat);
  if (!color) return null;
  const t = color.clone();
  t.colorSpace = THREE.NoColorSpace;
  t.needsUpdate = true;
  bumpScaled.set(id, t);
  users.get(key)!.push(t);
  return t;
}
