import { describe, it, expect } from "vitest";
import {
  DEFAULT_PLAYER_SETTINGS,
  DEFAULT_WORLD_SETTINGS,
  migratePlayerSettings,
  migrateWorldSettings,
} from "./SettingsSchema";

describe("migratePlayerSettings", () => {
  it("fills missing fields from defaults", () => {
    const migrated = migratePlayerSettings({ schemaVersion: 1, data: { compassEnabled: false } });
    expect(migrated.compassEnabled).toBe(false);
    expect(migrated.jeiInventoryEnabled).toBe(DEFAULT_PLAYER_SETTINGS.jeiInventoryEnabled);
    expect(migrated.companionMode).toBe("auto");
  });

  it("returns full defaults for an empty payload", () => {
    expect(migratePlayerSettings({ schemaVersion: 1, data: {} })).toEqual(DEFAULT_PLAYER_SETTINGS);
  });

  it("preserves custom companionMode if provided", () => {
    const migrated = migratePlayerSettings({ schemaVersion: 2, data: { companionMode: "enabled" } });
    expect(migrated.companionMode).toBe("enabled");
  });
});

describe("migrateWorldSettings", () => {
  it("fills missing fields from defaults", () => {
    const migrated = migrateWorldSettings({ schemaVersion: 1, data: { optimizationMode: "extreme" } });
    expect(migrated.optimizationMode).toBe("extreme");
    expect(migrated.protectTamedPets).toBe(DEFAULT_WORLD_SETTINGS.protectTamedPets);
    expect(migrated.protectModdedEntities).toBe(true);
    expect(migrated.companionMode).toBe("auto");
  });

  it("preserves custom companionMode and protectModdedEntities if provided", () => {
    const migrated = migrateWorldSettings({
      schemaVersion: 2,
      data: { companionMode: "disabled", protectModdedEntities: false },
    });
    expect(migrated.companionMode).toBe("disabled");
    expect(migrated.protectModdedEntities).toBe(false);
  });
});
