import type { MaterialDefinition } from '../model/types';
import { generateTextureCanvas } from '../render/textures';

/** Material sample chip: the real texture tile, tinted like the shader does (map x colour), with a soft physical sheen. */
export function chip(d: MaterialDefinition, size = 96): string {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.fillStyle = d.color;
  g.fillRect(0, 0, size, size);
  if (d.texture !== 'none') {
    const tile = generateTextureCanvas(d.texture);
    // about a third of a metre of the material across the chip, at least one full motif for big patterns
    const art = d.texture === 'persian' || d.texture === 'horizon';
    const frac = art ? 1 : Math.min(1, Math.max(0.35, 0.45 / Math.max(0.2, d.texScale)));
    const sw = tile.width * frac;
    g.globalCompositeOperation = 'multiply';
    g.drawImage(tile, 0, 0, sw, sw, 0, 0, size, size);
    g.globalCompositeOperation = 'source-over';
  }
  if (d.kind === 'glass') {
    g.fillStyle = 'rgba(200,225,235,0.55)';
    g.fillRect(0, 0, size, size);
    g.strokeStyle = 'rgba(255,255,255,0.7)';
    g.lineWidth = size * 0.06;
    g.beginPath();
    g.moveTo(size * 0.2, size * 0.85);
    g.lineTo(size * 0.75, size * 0.15);
    g.stroke();
  }
  if (d.emissive) {
    const r = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.7);
    r.addColorStop(0, d.emissive);
    r.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = Math.min(0.75, (d.emissiveIntensity ?? 1) * (d.kind === 'light' ? 0.6 : 0.25));
    g.fillStyle = r;
    g.fillRect(0, 0, size, size);
    g.globalAlpha = 1;
  }
  // sheen: glossy and metal finishes get a brighter diagonal highlight
  const gloss = Math.max(0, 1 - d.roughness) * 0.5 + d.metalness * 0.35;
  const s = g.createLinearGradient(0, 0, size, size);
  s.addColorStop(0, `rgba(255,255,255,${0.1 + gloss * 0.45})`);
  s.addColorStop(0.45, 'rgba(255,255,255,0)');
  s.addColorStop(1, `rgba(0,0,0,${0.18 + d.metalness * 0.15})`);
  g.fillStyle = s;
  g.fillRect(0, 0, size, size);
  return c.toDataURL('image/webp', 0.82);
}
