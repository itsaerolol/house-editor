import type { MaterialDefinition } from '../model/types';
import { MATERIAL_LIST } from '../model/materials';

const byId = new Map(MATERIAL_LIST.map((m) => [m.id, m]));
/** Built-in material lookup for projects that predate a material id. */
export const getCatalogItemMaterialFallback = (id: string): MaterialDefinition | undefined => byId.get(id);
