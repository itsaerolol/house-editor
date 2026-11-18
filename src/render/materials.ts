import * as THREE from 'three';
import type { MaterialDefinition } from '../model/types';
import { getBumpTexture, getTexture } from './textures';

/** Bump strength by material kind (three.js bumpScale). */
const BUMP: Partial<Record<MaterialDefinition['kind'], number>> = { wood: 0.6, stone: 4, tile: 1.6, fabric: 2.2, roof: 2.5, siding: 2, ground: 2.5, concrete: 0.8 };

const cache = new Map<string, THREE.Material>();

/** Emissive materials register here so time of day can turn lamps up at night and fake leaf glow down. */
type Glowing = { m: THREE.MeshStandardMaterial; base: number; lamp: boolean };
const glowing: Glowing[] = [];
let glowScale = { lamp: 1, foliage: 1, window: 0 };
const windows: THREE.MeshStandardMaterial[] = [];
const WINDOW_GLOW = new THREE.Color('#ffb46a');
function track(m: THREE.MeshStandardMaterial, d: MaterialDefinition) {
  if (!d.emissive) return;
  const lamp = d.kind === 'light' || d.id.startsWith('shade');
  const g = { m, base: d.emissiveIntensity ?? 1, lamp };
  glowing.push(g);
  m.emissiveIntensity = g.base * (lamp ? glowScale.lamp : glowScale.foliage);
}
function trackGlass(m: THREE.MeshStandardMaterial, d: MaterialDefinition) {
  if (d.kind !== 'glass') return;
  windows.push(m);
  m.emissive = WINDOW_GLOW.clone();
  m.emissiveIntensity = glowScale.window;
}
/** Lamps, fake leaf translucency and lit windows all follow the time of day. */
export function setGlowScale(lamp: number, foliage: number, window = 0) {
  glowScale = { lamp, foliage, window };
  for (const g of glowing) g.m.emissiveIntensity = g.base * (g.lamp ? lamp : foliage);
  for (const m of windows) m.emissiveIntensity = window;
}

const sig = (d: MaterialDefinition) =>
  [d.id, d.color, d.roughness, d.metalness, d.texture, d.texScale, d.opacity ?? 1, d.emissive ?? '', d.emissiveIntensity ?? 0].join('|');

/** Shared three materials, keyed by definition contents so edits produce a fresh material. */
export function getThreeMaterial(d: MaterialDefinition): THREE.Material {
  const key = sig(d);
  let m = cache.get(key);
  if (m) return m;
  const isGlass = d.kind === 'glass' && (d.opacity ?? 1) < 1;
  const std = new THREE.MeshStandardMaterial({
    color: new THREE.Color(d.color),
    roughness: d.roughness,
    metalness: d.metalness,
    map: getTexture(d.texture, d.texScale),
    transparent: isGlass,
    opacity: d.opacity ?? 1,
    depthWrite: !isGlass,
    envMapIntensity: isGlass ? 1.6 : d.kind === 'metal' ? 1.5 : 0.8,
  });
  const bs = BUMP[d.kind];
  if (bs && d.texture !== 'none') {
    const bt = getBumpTexture(d.texture, d.texScale);
    if (bt) {
      std.bumpMap = bt;
      std.bumpScale = bs;
    }
  }
  if (d.emissive) {
    std.emissive = new THREE.Color(d.emissive);
    std.emissiveIntensity = d.emissiveIntensity ?? 1;
  }
  track(std, d);
  trackGlass(std, d);
  m = std;
  cache.set(key, m);
  return m;
}

/** Furniture variant: vertex tints on, two-sided so open shells (shades, leaves, basins) read from inside. */
const furnCache = new Map<string, THREE.Material>();
export function getFurnitureMaterial(d: MaterialDefinition): THREE.Material {
  const key = sig(d);
  let m = furnCache.get(key);
  if (m) return m;
  const c = (getThreeMaterial(d) as THREE.MeshStandardMaterial).clone();
  c.vertexColors = true;
  c.side = THREE.DoubleSide;
  c.shadowSide = THREE.FrontSide;
  track(c, d);
  trackGlass(c, d);
  furnCache.set(key, c);
  return c;
}

/** Rugs and mats: a thin layer on a floor finish that is itself nudged toward the camera (offset -2).
 *  Pull the rug further forward so the floor never wins at grazing angles or from far away. */
const rugCache = new Map<string, THREE.Material>();
export function getRugMaterial(d: MaterialDefinition): THREE.Material {
  const key = sig(d);
  let m = rugCache.get(key);
  if (m) return m;
  const c = (getFurnitureMaterial(d) as THREE.MeshStandardMaterial).clone();
  c.polygonOffset = true;
  c.polygonOffsetFactor = -5;
  c.polygonOffsetUnits = -5;
  track(c, d);
  rugCache.set(key, c);
  return c;
}

/** Floor finish: nudged toward the camera so it never z-fights with the slab. */
const floorCache = new Map<string, THREE.Material>();
export function getFloorMaterial(d: MaterialDefinition): THREE.Material {
  const key = sig(d);
  let m = floorCache.get(key);
  if (m) return m;
  const base = getThreeMaterial(d) as THREE.MeshStandardMaterial;
  const c = base.clone();
  c.polygonOffset = true;
  c.polygonOffsetFactor = -2;
  c.polygonOffsetUnits = -2;
  floorCache.set(key, c);
  return c;
}

export const CUT_MATERIAL = new THREE.MeshBasicMaterial({ color: '#efe9dc' });
export const CUT_MATERIAL_DARK = new THREE.MeshBasicMaterial({ color: '#2b2a28' });
export const HIGHLIGHT_COLOR = '#ff9d2e';

export function disposeMaterials() {
  for (const m of cache.values()) m.dispose();
  for (const m of floorCache.values()) m.dispose();
  for (const m of furnCache.values()) m.dispose();
  furnCache.clear();
  cache.clear();
  floorCache.clear();
}
