export type MenuAction =
  | "companion"
  | "inventory"
  | "accessories"
  | "waypoints"
  | "field_map"
  | "player_settings"
  | "world_settings"
  | "diagnostics"
  | "about";

export interface MenuEntry {
  id: string;
  label: string;
  description: string;
  action: MenuAction;
  operatorOnly?: boolean;
}

export const CONTROL_ROOM_MENU: readonly MenuEntry[] = [
  { id: "companion", label: "Hydraulic Companion Bridge & Status", description: "Bridge state, machine inspection, and mod namespaces.", action: "companion" },
  { id: "inventory", label: "UI & Inventory / Recipes", description: "Recipe browser, categories, mass crafting, and transfers.", action: "inventory" },
  { id: "accessories", label: "Trinket Cabinet", description: "Equip compatible accessories and manage active abilities.", action: "accessories" },
  { id: "waypoints", label: "Waypoints & Compass", description: "Manage saved destinations and the active compass target.", action: "waypoints" },
  { id: "field_map", label: "Field Map / Minimap", description: "Open terrain sampling, radar, and waypoint actions.", action: "field_map" },
  { id: "player_settings", label: "Player Settings (Food, Durability, HUDs)", description: "Configure personal HUD and overlay preferences.", action: "player_settings" },
  { id: "world_settings", label: "World Settings (Operator)", description: "Configure world-wide optimization and protection policies.", action: "world_settings", operatorOnly: true },
  { id: "diagnostics", label: "Optimization Diagnostics", description: "Review recent audit entries and cleanup decisions.", action: "diagnostics" },
  { id: "about", label: "About / Unsupported Features", description: "Review supported boundaries and runtime limitations.", action: "about" },
];

export function validateMenuCatalog(entries: readonly MenuEntry[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const [index, entry] of entries.entries()) {
    if (!entry.id.trim()) errors.push(`entries[${index}].id is empty`);
    if (ids.has(entry.id)) errors.push(`entries[${index}].id is duplicated: ${entry.id}`);
    ids.add(entry.id);
    if (!entry.label.trim()) errors.push(`entries[${index}].label is empty`);
    if (!entry.description.trim()) errors.push(`entries[${index}].description is empty`);
  }
  if (entries.length === 0) errors.push("menu catalog must contain at least one entry");
  if (entries.length > 12) errors.push("menu catalog exceeds the Bedrock action-form button budget");
  return errors;
}

export function visibleMenuEntries(entries: readonly MenuEntry[], isOperator: boolean): MenuEntry[] {
  return entries.filter((entry) => !entry.operatorOnly || isOperator);
}