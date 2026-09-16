import { describe, it, expect } from "vitest";
import {
  COMPANION_SPECIES,
  computeCompanionSpawnLocation,
  decideCompanionInteraction,
  DEFAULT_COMPANION_SPECIES_ID,
  companionSpeciesForEntityType,
  findCompanionSpecies,
  isCompanionEntityType,
  resolveChosenSpecies,
} from "./CompanionPetPlan";

describe("COMPANION_SPECIES", () => {
  it("provides a reasonably sized, uniquely identified selection", () => {
    expect(COMPANION_SPECIES.length).toBeGreaterThanOrEqual(3);
    const ids = new Set(COMPANION_SPECIES.map((s) => s.id));
    const entityTypeIds = new Set(COMPANION_SPECIES.map((s) => s.entityTypeId));
    expect(ids.size).toBe(COMPANION_SPECIES.length);
    expect(entityTypeIds.size).toBe(COMPANION_SPECIES.length);
    for (const species of COMPANION_SPECIES) {
      expect(species.entityTypeId.startsWith("phlodgate:companion_")).toBe(true);
    }
  });

  it("includes the default species", () => {
    expect(findCompanionSpecies(DEFAULT_COMPANION_SPECIES_ID)).toBeDefined();
  });
});

describe("companionSpeciesForEntityType / isCompanionEntityType", () => {
  it("resolves known companion entity type ids", () => {
    expect(companionSpeciesForEntityType("phlodgate:companion_wolf")?.id).toBe("wolf");
    expect(isCompanionEntityType("phlodgate:companion_cat")).toBe(true);
  });

  it("rejects unrelated entity type ids", () => {
    expect(companionSpeciesForEntityType("minecraft:wolf")).toBeUndefined();
    expect(isCompanionEntityType("minecraft:zombie")).toBe(false);
  });
});

describe("resolveChosenSpecies", () => {
  it("returns the selected species for a valid index", () => {
    expect(resolveChosenSpecies(1)?.id).toBe(COMPANION_SPECIES[1].id);
  });

  it("falls back to the default species for an undefined, out-of-range, or negative selection", () => {
    expect(resolveChosenSpecies(undefined).id).toBe(DEFAULT_COMPANION_SPECIES_ID);
    expect(resolveChosenSpecies(-1).id).toBe(DEFAULT_COMPANION_SPECIES_ID);
    expect(resolveChosenSpecies(999).id).toBe(DEFAULT_COMPANION_SPECIES_ID);
    expect(resolveChosenSpecies(1.5).id).toBe(DEFAULT_COMPANION_SPECIES_ID);
  });
});

describe("decideCompanionInteraction", () => {
  it("denies non-owners regardless of sneak state", () => {
    expect(decideCompanionInteraction(false, false)).toBe("deny_not_owner");
    expect(decideCompanionInteraction(false, true)).toBe("deny_not_owner");
  });

  it("opens the control room for the owner's sneak-click", () => {
    expect(decideCompanionInteraction(true, true)).toBe("open_control_room");
  });

  it("allows the default (vanilla-like) sit/stand toggle for the owner's plain click", () => {
    expect(decideCompanionInteraction(true, false)).toBe("allow_default_sit_toggle");
  });
});

describe("computeCompanionSpawnLocation", () => {
  it("places the companion behind the player for yaw 0 (south)", () => {
    const result = computeCompanionSpawnLocation({ x: 0, y: 64, z: 0 }, 0, 2);
    expect(result.x).toBeCloseTo(0, 5);
    expect(result.z).toBeCloseTo(-2, 5);
    expect(result.y).toBe(64);
  });

  it("places the companion behind the player for yaw 180 (north)", () => {
    const result = computeCompanionSpawnLocation({ x: 0, y: 64, z: 0 }, 180, 2);
    expect(result.x).toBeCloseTo(0, 5);
    expect(result.z).toBeCloseTo(2, 5);
  });

  it("places the companion behind the player for yaw 90 (west)", () => {
    const result = computeCompanionSpawnLocation({ x: 0, y: 64, z: 0 }, 90, 2);
    expect(result.x).toBeCloseTo(2, 5);
    expect(result.z).toBeCloseTo(0, 5);
  });

  it("defaults to a 1.5 block offset when none is given", () => {
    const result = computeCompanionSpawnLocation({ x: 10, y: 70, z: 10 }, 0);
    expect(result.z).toBeCloseTo(8.5, 5);
  });
});
