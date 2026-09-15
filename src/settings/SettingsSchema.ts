export type CompanionModeSetting = "auto" | "enabled" | "disabled";

export interface PlayerSettings {
  jeiInventoryEnabled: boolean;
  quickMoveEnabled: boolean;
  inventorySearchEnabled: boolean;
  waypointsVisible: boolean;
  compassEnabled: boolean;
  coordinatesHudEnabled: boolean;
  minimapEnabled: boolean;
  minimapRadius: number;
  foodPreviewEnabled: boolean;
  appleskinOverlayEnabled: boolean;
  durabilityHudEnabled: boolean;
  durabilityAlertsEnabled: boolean;
  durabilityAlertThresholdPercent: number;
  hudRefreshTicks: number;
  companionMode: CompanionModeSetting;
}

export const DEFAULT_PLAYER_SETTINGS: PlayerSettings = {
  jeiInventoryEnabled: true,
  quickMoveEnabled: true,
  inventorySearchEnabled: true,
  waypointsVisible: true,
  compassEnabled: true,
  coordinatesHudEnabled: true,
  minimapEnabled: true,
  minimapRadius: 128,
  foodPreviewEnabled: true,
  appleskinOverlayEnabled: true,
  durabilityHudEnabled: true,
  durabilityAlertsEnabled: true,
  durabilityAlertThresholdPercent: 20,
  hudRefreshTicks: 10,
  companionMode: "auto",
};

export interface WorldSettings {
  optimizationMode: "balanced" | "aggressive" | "extreme";
  despawnOptimizationEnabled: boolean;
  distantDespawnEnabled: boolean;
  offScreenDespawnEnabled: boolean;
  protectNamedEntities: boolean;
  protectTamedPets: boolean;
  protectBosses: boolean;
  protectArmorStands: boolean;
  protectVillagersAndTraders: boolean;
  protectEntitiesInCombat: boolean;
  protectModdedEntities: boolean;
  companionMode: CompanionModeSetting;
  auditModeOnly: boolean;
  itemMergingEnabled: boolean;
  debrisCleanupEnabled: boolean;
  particleCleanupEnabled: boolean;
  fogOptimizerEnabled: boolean;
  volumetricFogEnabled: boolean;
  extremeFpsMode: boolean;
  protectedEntityTypeIds: string[];
}

export const DEFAULT_WORLD_SETTINGS: WorldSettings = {
  optimizationMode: "balanced",
  despawnOptimizationEnabled: true,
  distantDespawnEnabled: true,
  offScreenDespawnEnabled: true,
  protectNamedEntities: true,
  protectTamedPets: true,
  protectBosses: true,
  protectArmorStands: true,
  protectVillagersAndTraders: true,
  protectEntitiesInCombat: true,
  protectModdedEntities: true,
  companionMode: "auto",
  auditModeOnly: false,
  itemMergingEnabled: true,
  debrisCleanupEnabled: true,
  particleCleanupEnabled: true,
  fogOptimizerEnabled: true,
  volumetricFogEnabled: true,
  extremeFpsMode: false,
  protectedEntityTypeIds: [],
};

/** Bump this whenever the shape of PlayerSettings/WorldSettings changes, and add a migration in migratePlayerSettings/migrateWorldSettings. */
export const SETTINGS_SCHEMA_VERSION = 4;

export interface VersionedPayload<T> {
  schemaVersion: number;
  data: T;
}

export function migratePlayerSettings(payload: VersionedPayload<Partial<PlayerSettings>>): PlayerSettings {
  // No migrations yet; merge onto defaults so newly added fields get sane values for existing players.
  return { ...DEFAULT_PLAYER_SETTINGS, ...payload.data };
}

export function migrateWorldSettings(payload: VersionedPayload<Partial<WorldSettings>>): WorldSettings {
  return { ...DEFAULT_WORLD_SETTINGS, ...payload.data };
}
