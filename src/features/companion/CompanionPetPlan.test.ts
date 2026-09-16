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
    expect(COMPANION_SPECIES).toHaveLength(40);
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

  it("marks exactly the spider, sniffer, and ravager as rideable", () => {
    const rideableIds = COMPANION_SPECIES.filter((s) => s.rideable).map((s) => s.id).sort();
    expect(rideableIds).toEqual(["ravager", "sniffer", "spider"]);
  });

  it("contains every supported passive or breedable baby-animal family", () => {
    const babyIds = COMPANION_SPECIES.filter((species) => species.category === "baby_animal").map((species) => species.id);
    expect(babyIds).toEqual([
      "baby_armadillo",
      "baby_axolotl",
      "baby_bee",
      "baby_camel",
      "baby_cat",
      "baby_chicken",
      "baby_cow",
      "baby_donkey",
      "baby_fox",
      "baby_goat",
      "baby_hoglin",
      "baby_horse",
      "baby_llama",
      "baby_mooshroom",
      "baby_mule",
      "baby_ocelot",
      "baby_panda",
      "baby_pig",
      "baby_polar_bear",
      "baby_rabbit",
      "baby_sheep",
      "baby_sniffer",
      "baby_strider",
      "baby_turtle",
      "baby_wolf",
      "tadpole",
    ]);
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

  it("allows the default interaction (sit toggle or mount) for the owner's plain click", () => {
    expect(decideCompanionInteraction(true, false)).toBe("allow_default_interaction");
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
