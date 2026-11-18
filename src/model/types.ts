/**
 * Canonical, serializable project model.
 * Meters internally. Y-up. Plan coordinates are world (x, z).
 * No Three.js objects live here.
 */

export type Id = string;
export interface Vec2 {
  x: number;
  z: number;
}

export type MaterialKind =
  | 'paint'
  | 'wood'
  | 'tile'
  | 'stone'
  | 'metal'
  | 'glass'
  | 'fabric'
  | 'roof'
  | 'siding'
  | 'ground'
  | 'foliage'
  | 'concrete'
  | 'light';

export type TextureKey =
  | 'none'
  | 'siding'
  | 'oak'
  | 'walnut'
  | 'tile'
  | 'stone'
  | 'shingle'
  | 'seam'
  | 'grass'
  | 'concrete'
  | 'pavers'
  | 'carpet'
  | 'persian'
  | 'horizon'
  | 'boucle'
  | 'linen'
  | 'leather'
  | 'burl'
  | 'vein'
  | 'brick'
  | 'limestone';

export interface MaterialDefinition {
  id: Id;
  name: string;
  kind: MaterialKind;
  color: string;
  roughness: number;
  metalness: number;
  texture: TextureKey;
  /** meters covered by one texture repeat */
  texScale: number;
  opacity?: number;
  emissive?: string;
  emissiveIntensity?: number;
}

export interface Level {
  id: Id;
  name: string;
  /** top of finished floor, meters */
  elevation: number;
  /** clear height, finished floor to ceiling */
  ceilingHeight: number;
  /** structural floor thickness (modeled separately from ceiling height) */
  slabThickness: number;
}

export type WallKind = 'exterior' | 'interior' | 'rail';

export interface Wall {
  id: Id;
  name?: string;
  levelId: Id;
  start: Vec2;
  end: Vec2;
  thickness: number;
  /** clear height above the level floor; null follows the level ceiling height */
  height: number | null;
  /** when set, the wall top follows that level's ceiling (double-height walls) */
  topLevelId?: Id;
  kind: WallKind;
  /** material on the left of start->end ("side A") and right ("side B") */
  finishA: Id;
  finishB: Id;
  capMaterialId: Id;
  /** extends the wall below its default base (negative = deeper) */
  baseOffset?: number;
  /** stone band: everything below `top` (relative to level floor) uses this material */
  plinth?: { top: number; materialId: Id };
  locked?: boolean;
  hidden?: boolean;
}

export interface OpeningBase {
  id: Id;
  name?: string;
  wallId: Id;
  /** distance from wall start to the opening's start edge (meters) */
  offset: number;
  width: number;
  height: number;
  /** height of opening bottom above the wall's floor */
  sill: number;
  frameMaterialId: Id;
  locked?: boolean;
  hidden?: boolean;
}

export type DoorStyle = 'single' | 'double' | 'sliding' | 'garage' | 'cased';

export interface Door extends OpeningBase {
  kind: 'door';
  style: DoorStyle;
  hinge: 'start' | 'end';
  open: boolean;
  leafMaterialId: Id;
}

export type WindowStyle = 'fixed' | 'casement' | 'transom';

export interface Window extends OpeningBase {
  kind: 'window';
  style: WindowStyle;
  muntinCols: number;
  muntinRows: number;
}

export type Opening = Door | Window;

export type SlabKind = 'floor' | 'deck' | 'patio' | 'drive' | 'path' | 'step';

export interface Slab {
  id: Id;
  name?: string;
  levelId: Id;
  kind: SlabKind;
  outline: Vec2[];
  holes: Vec2[][];
  /** null follows level.slabThickness */
  thickness: number | null;
  /** top surface relative to the level elevation */
  topOffset: number;
  topMaterialId: Id;
  sideMaterialId: Id;
  hidden?: boolean;
}

export interface Room {
  id: Id;
  name: string;
  levelId: Id;
  kind: string;
  outline: Vec2[];
  floorMaterialId: Id;
  ceilingMaterialId: Id;
  /** null follows level ceiling height */
  ceilingHeight: number | null;
  /** ceiling follows that level's ceiling (double height rooms) */
  ceilingLevelId?: Id;
  showCeiling: boolean;
  /** false = no floor finish mesh (stairwells, voids) */
  hasFloor: boolean;
  hidden?: boolean;
}

export interface Stair {
  id: Id;
  name?: string;
  /** consecutive levels (bottom to top) this stacked U-stair connects */
  levelIds: Id[];
  /** corner of lane A at the arrival edge, world plan coords */
  origin: Vec2;
  /** unit vector along the run (away from the arrival edge) */
  dir: Vec2;
  /** unit vector across the lanes (lane A at 0, lane B at laneWidth+gap) */
  side: Vec2;
  laneWidth: number;
  gap: number;
  treadDepth: number;
  landingDepth: number;
  risersPerFlight: number;
  materialId: Id;
  hidden?: boolean;
}

export type RoofKind = 'gable' | 'shed';

export interface Roof {
  id: Id;
  name?: string;
  /** roof base sits at the top of this level's walls */
  levelId: Id;
  /** adjustment from (level elevation + ceiling height) */
  baseOffset: number;
  kind: RoofKind;
  /** footprint covered (without overhang), world axes */
  center: Vec2;
  size: Vec2;
  /** direction of the ridge (gable) or of the eave line (shed) */
  ridgeAxis: 'x' | 'z';
  /** rise/run, e.g. 8/12 = 0.667 */
  pitch: number;
  eaveOverhang: number;
  rakeOverhang: number;
  thickness: number;
  /** shed only: which side across the ridge axis is high */
  shedHigh: 1 | -1;
  materialId: Id;
  gableMaterialId: Id;
  /** gable end infill (false for roofs that rest on a wall) */
  gableEnds: boolean;
  hidden?: boolean;
}

export interface MaterialOverrides {
  [slot: string]: Id;
}

export interface FurnitureInstance {
  id: Id;
  name: string;
  catalogId: string;
  levelId: Id;
  position: Vec2;
  /** height of the item base above the level floor */
  elevation: number;
  rotationY: number;
  size: { w: number; d: number; h: number };
  materialOverrides: MaterialOverrides;
  locked?: boolean;
  hidden?: boolean;
}

export type UnitSystem = 'imperial' | 'metric';
export type ViewMode =
  | 'front'
  | 'back'
  | 'left'
  | 'right'
  | 'top'
  | 'bottom'
  | 'iso'
  | 'persp'
  | 'plan'
  | 'walk';
export type IsoCorner = 'ne' | 'nw' | 'se' | 'sw';
export type Quality = 'high' | 'medium' | 'low';
export type TimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';

export interface ViewSettings {
  units: UnitSystem;
  gridSpacing: number;
  rotationSnap: number;
  snapEnabled: boolean;
  showGrid: boolean;
  showAxes: boolean;
  showRoof: boolean;
  showCeilings: boolean;
  showFurniture: boolean;
  showLabels: boolean;
  showDimensions: boolean;
  showSite: boolean;
  /** 'all' or a level id */
  levelFilter: 'all' | Id;
  activeLevelId: Id;
  isolateActive: boolean;
  cutaway: boolean;
  cutHeight: number;
  ghostLower: boolean;
  quality: Quality;
  mode: ViewMode;
  isoCorner: IsoCorner;
  /** sky, sun and lighting preset */
  timeOfDay: TimeOfDay;
}

export interface SiteSettings {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  groundMaterialId: Id;
  /** front grade sits this far below the front level's floor */
  frontLevelId: Id;
  frontDrop: number;
  /** rear grade sits this far below the rear level's floor */
  rearLevelId: Id;
  rearDrop: number;
  /** terrain ramps between these world z values */
  rampStartZ: number;
  rampEndZ: number;
}

export interface Project {
  id: Id;
  name: string;
  levelOrder: Id[];
  levels: Record<Id, Level>;
  walls: Record<Id, Wall>;
  openings: Record<Id, Opening>;
  slabs: Record<Id, Slab>;
  rooms: Record<Id, Room>;
  stairs: Record<Id, Stair>;
  roofs: Record<Id, Roof>;
  furniture: Record<Id, FurnitureInstance>;
  materials: Record<Id, MaterialDefinition>;
  site: SiteSettings;
  view: ViewSettings;
}

export type EntityKind =
  | 'level'
  | 'wall'
  | 'opening'
  | 'slab'
  | 'room'
  | 'stair'
  | 'roof'
  | 'furniture';

export interface Selection {
  kind: EntityKind;
  id: Id;
}
