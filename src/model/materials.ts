import type { MaterialDefinition } from './types';

const m = (
  id: string,
  name: string,
  kind: MaterialDefinition['kind'],
  color: string,
  roughness: number,
  metalness: number,
  texture: MaterialDefinition['texture'] = 'none',
  texScale = 1,
  extra: Partial<MaterialDefinition> = {},
): MaterialDefinition => ({ id, name, kind, color, roughness, metalness, texture, texScale, ...extra });

/** Palette: black exterior, dark walnut, warm charcoal interiors, brass accents. */
export const MATERIAL_LIST: MaterialDefinition[] = [
  // exterior
  m('siding-black', 'Black board & batten', 'siding', '#2a2b2d', 0.8, 0, 'siding', 1.2),
  m('stone-dark', 'Dark ledge stone', 'stone', '#6a6561', 0.95, 0, 'stone', 1.6),
  m('limestone-cream', 'Cream limestone', 'stone', '#e4d9c4', 0.9, 0, 'limestone', 1.8),
  m('brick-red', 'Red brick', 'stone', '#93503a', 0.92, 0, 'brick', 1.2),
  m('brick-white', 'Limewashed brick', 'stone', '#dcd6cc', 0.95, 0, 'brick', 1.2),
  m('brick-black', 'Painted black brick', 'stone', '#2e2d2d', 0.85, 0, 'brick', 1.2),
  m('brick-tan', 'Tan brick', 'stone', '#b39270', 0.92, 0, 'brick', 1.2),
  m('roof-shingle', 'Charcoal shingle', 'roof', '#2b2c2e', 0.9, 0, 'shingle', 1.2),
  m('roof-seam', 'Standing seam, black', 'roof', '#232426', 0.45, 0.6, 'seam', 1.2),
  m('roof-bronze', 'Standing seam, dark bronze', 'roof', '#5a4532', 0.42, 0.6, 'seam', 1.2),
  m('cedar', 'Cedar', 'wood', '#a8673a', 0.6, 0, 'walnut', 1.6),
  m('timber', 'Natural timber', 'wood', '#a9784a', 0.65, 0, 'walnut', 1.6),
  m('timber-dark', 'Stained timber', 'wood', '#6b4a30', 0.65, 0, 'walnut', 1.6),
  m('trim-black', 'Black trim', 'paint', '#1b1c1e', 0.6, 0.1),
  m('frame-black', 'Black window frame', 'metal', '#17181a', 0.5, 0.4),
  m('glass', 'Glass', 'glass', '#a9c3cf', 0.05, 0, 'none', 1, { opacity: 0.22 }),
  m('garage-door', 'Garage door, dark wood', 'wood', '#4a3426', 0.6, 0, 'walnut', 1.6),
  m('door-entry', 'Entry door, walnut', 'wood', '#4a2e1c', 0.45, 0, 'walnut', 1.4),
  m('door-int', 'Interior door, charcoal', 'paint', '#2f2e2d', 0.55, 0),
  // interior paints
  m('paint-warm-charcoal', 'Warm charcoal', 'paint', '#4a4540', 0.9, 0),
  m('paint-deep-green', 'Muted forest green', 'paint', '#39463b', 0.9, 0),
  m('paint-navy', 'Dusk navy', 'paint', '#363f4c', 0.9, 0),
  m('paint-cream', 'Warm cream', 'paint', '#cdbfa8', 0.9, 0),
  m('paint-clay', 'Clay brown', 'paint', '#6a5242', 0.9, 0),
  m('ceiling-dark', 'Ceiling, dark cream', 'paint', '#a89a86', 0.95, 0),
  m('ceiling-wood', 'Ceiling, stained pine', 'wood', '#6e4c32', 0.8, 0, 'oak', 1.2),
  m('slab-concrete', 'Concrete', 'concrete', '#8a8782', 0.95, 0, 'concrete', 2),
  m('slab-edge', 'Floor edge, black', 'paint', '#202123', 0.8, 0),
  // floors
  m('oak-smoked', 'Smoked oak', 'wood', '#7a5a3f', 0.5, 0, 'oak', 1.6),
  m('oak-natural', 'Natural oak', 'wood', '#a98458', 0.5, 0, 'oak', 1.6),
  m('walnut', 'Dark walnut', 'wood', '#4f3324', 0.42, 0, 'walnut', 1.4),
  m('tile-slate', 'Slate tile', 'tile', '#4b4d50', 0.5, 0, 'tile', 0.6),
  m('tile-cream', 'Cream tile', 'tile', '#bdb2a0', 0.4, 0, 'tile', 0.6),
  m('carpet-grey', 'Wool carpet', 'fabric', '#6d6862', 1, 0, 'carpet', 0.6),
  m('concrete-floor', 'Sealed concrete', 'concrete', '#6c6a66', 0.6, 0, 'concrete', 2),
  m('deck-wood', 'Cedar deck', 'wood', '#8a6a4c', 0.8, 0, 'oak', 1.0),
  // kitchen
  m('soapstone', 'Soapstone', 'paint', '#3a3c3d', 0.35, 0, 'vein', 1.8),
  m('backsplash', 'Dark zellige', 'tile', '#3b4a48', 0.35, 0, 'tile', 0.5),
  m('brass', 'Aged brass', 'metal', '#a48a5c', 0.38, 0.85),
  m('black-metal', 'Blackened steel', 'metal', '#222325', 0.45, 0.8),
  m('steel', 'Brushed stainless', 'metal', '#c4c6c9', 0.32, 0.75),
  m('porcelain', 'White porcelain', 'paint', '#f6f4f0', 0.1, 0),
  // fabrics and soft goods
  m('fabric-cream', 'Cream linen', 'fabric', '#cdc2ae', 1, 0, 'linen', 0.35),
  m('fabric-charcoal', 'Charcoal boucle', 'fabric', '#4a4a4c', 1, 0, 'boucle', 0.3),
  m('fabric-rust', 'Rust velvet', 'fabric', '#86482f', 0.75, 0, 'carpet', 0.5),
  m('fabric-olive', 'Olive wool', 'fabric', '#58603f', 1, 0, 'linen', 0.4),
  m('fabric-navy', 'Navy wool', 'fabric', '#2e3a4c', 1, 0, 'linen', 0.4),
  m('leather-cognac', 'Cognac leather', 'fabric', '#8a5632', 0.5, 0, 'leather', 0.35),
  m('bedding-linen', 'Oatmeal bedding', 'fabric', '#c9bfae', 1, 0, 'linen', 0.4),
  m('art-horizon', 'Canvas: moody horizon', 'paint', '#ffffff', 0.9, 0, 'horizon', 1),
  m('rug-persian', 'Vintage Persian, rust and navy', 'fabric', '#ffffff', 0.95, 0, 'persian', 1),
  m('rug-wool', 'Patterned wool rug', 'fabric', '#6d5a49', 1, 0, 'carpet', 1),
  // wood furniture
  m('oak-furniture', 'Light oak', 'wood', '#b08a5c', 0.55, 0, 'walnut', 1.4),
  m('walnut-furniture', 'Walnut', 'wood', '#5e3c2b', 0.45, 0, 'walnut', 1.4),
  m('walnut-burl', 'Walnut burl', 'wood', '#6a4630', 0.35, 0, 'burl', 0.9),
  m('black-wood', 'Black ash', 'wood', '#26262a', 0.6, 0),
  m('painted-white', 'Painted white', 'paint', '#ecebe8', 0.35, 0),
  // light
  m('glow', 'Warm glow', 'light', '#ffd9a0', 0.6, 0, 'none', 1, { emissive: '#ffb865', emissiveIntensity: 1.6 }),
  m('fire', 'Fire', 'light', '#ff7a1a', 0.6, 0, 'none', 1, { emissive: '#ff5a0a', emissiveIntensity: 1.5 }),
  m('screen', 'Dark screen', 'glass', '#0d0e10', 0.15, 0.2),
  // site
  m('grass', 'Lawn', 'ground', '#4f6b3d', 1, 0, 'grass', 3),
  m('pavers', 'Stone pavers', 'stone', '#85817a', 0.9, 0, 'pavers', 1.6),
  m('gravel', 'Gravel drive', 'ground', '#7d7a74', 1, 0, 'pavers', 1),
  m('foliage', 'Evergreen foliage', 'foliage', '#26412c', 0.7, 0, 'none', 1, { emissive: '#1f3a16', emissiveIntensity: 0.55 }),
  m('leaf-green', 'Glossy leaf', 'foliage', '#4e8a34', 0.55, 0, 'none', 1, { emissive: '#22420f', emissiveIntensity: 0.45 }),
  m('spruce-needle', 'Blue spruce needles', 'foliage', '#5d7b7f', 0.9, 0, 'none', 1, { emissive: '#1a2e2e', emissiveIntensity: 0.4 }),
  m('leaf-shadow', 'Leaf shadow', 'foliage', '#22401a', 1, 0),
  m('foliage-light', 'Spring foliage', 'foliage', '#5a7a3a', 0.8, 0, 'none', 1, { emissive: '#2a3d15', emissiveIntensity: 0.5 }),
  m('bark', 'Bark', 'wood', '#4b3a2c', 0.95, 0),
  m('soil', 'Soil', 'ground', '#3b2f24', 1, 0),
  // fixtures and fittings
  m('powder-charcoal', 'Charcoal powder coat', 'metal', '#3c3d40', 0.55, 0.35),
  m('chrome', 'Polished chrome', 'metal', '#e6e8ea', 0.12, 0.9),
  m('rubber', 'Black rubber', 'paint', '#151516', 0.85, 0),
  m('mirror', 'Mirror', 'metal', '#c3c8c9', 0.05, 0.7),
  m('water', 'Water', 'glass', '#5d7f86', 0.02, 0.1, 'none', 1, { opacity: 0.55 }),
  m('glaze-olive', 'Olive glaze', 'paint', '#4f5a3a', 0.12, 0),
  m('glaze-sage', 'Sage glaze', 'paint', '#a9c0b2', 0.12, 0),
  m('ceramic-white', 'Glazed ceramic', 'paint', '#fbfaf8', 0.1, 0),
  m('plastic', 'Tinted plastic', 'paint', '#ffffff', 0.45, 0),
  m('paper', 'Paper and card', 'paint', '#ece6da', 0.9, 0),
  m('shade-linen', 'Linen shade', 'fabric', '#efe3cc', 0.95, 0, 'carpet', 0.6, { emissive: '#ffcf8a', emissiveIntensity: 0.35 }),
  m('amber-glass', 'Amber bulb glass', 'light', '#d98a2b', 0.15, 0, 'none', 1, { emissive: '#ff9a2e', emissiveIntensity: 1.3 }),
  m('ember', 'Embers', 'light', '#3a1a0c', 0.8, 0, 'none', 1, { emissive: '#ff4a0a', emissiveIntensity: 1.2 }),
];

export function buildMaterialRecord(): Record<string, MaterialDefinition> {
  const out: Record<string, MaterialDefinition> = {};
  for (const mat of MATERIAL_LIST) out[mat.id] = mat;
  return out;
}
