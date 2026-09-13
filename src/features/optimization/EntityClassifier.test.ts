import { describe, it, expect } from "vitest";
import {
  classifyEntity,
  DEFAULT_PROTECTION_RULES,
  EntitySignal,
  selectForRemoval,
} from "./EntityClassifier";

const baseSignal: EntitySignal = {
  entityId: "1",
  typeId: "minecraft:zombie",
  isPlayer: false,
  isTamed: false,
  isVillagerOrTrader: false,
  isBoss: false,
  isArmorStand: false,
  isItemEntity: false,
  ageTicks: 20 * 60 * 10, // 10 minutes old
  distanceToNearestPlayer: 100,
  explicitlyProtectedByConfig: false,
};

describe("classifyEntity", () => {
  it("protects players unconditionally", () => {
    const result = classifyEntity({ ...baseSignal, isPlayer: true }, DEFAULT_PROTECTION_RULES);
    expect(result.protectedFromRemoval).toBe(true);
    expect(result.reasons).toContain("players are always protected");
  });

  it("protects tamed pets", () => {
    const result = classifyEntity({ ...baseSignal, isTamed: true }, DEFAULT_PROTECTION_RULES);
    expect(result.protectedFromRemoval).toBe(true);
  });

  it("protects named entities", () => {
    const result = classifyEntity({ ...baseSignal, nameTag: "Fluffy" }, DEFAULT_PROTECTION_RULES);
    expect(result.protectedFromRemoval).toBe(true);
  });

  it("protects bosses, armor stands, and villagers/traders", () => {
    expect(classifyEntity({ ...baseSignal, isBoss: true }, DEFAULT_PROTECTION_RULES).protectedFromRemoval).toBe(true);
    expect(classifyEntity({ ...baseSignal, isArmorStand: true }, DEFAULT_PROTECTION_RULES).protectedFromRemoval).toBe(true);
    expect(classifyEntity({ ...baseSignal, isVillagerOrTrader: true }, DEFAULT_PROTECTION_RULES).protectedFromRemoval).toBe(true);
  });

  it("protects entities recently in combat but not ones long past it", () => {
    const recent = classifyEntity({ ...baseSignal, ticksSinceLastCombatInvolvement: 10 }, DEFAULT_PROTECTION_RULES);
    expect(recent.protectedFromRemoval).toBe(true);

    const longAgo = classifyEntity(
      { ...baseSignal, ticksSinceLastCombatInvolvement: 20 * 60 },
      DEFAULT_PROTECTION_RULES
    );
    expect(longAgo.protectedFromRemoval).toBe(false);
  });

  it("protects entities near a player regardless of type", () => {
    const result = classifyEntity({ ...baseSignal, distanceToNearestPlayer: 5 }, DEFAULT_PROTECTION_RULES);
    expect(result.protectedFromRemoval).toBe(true);
  });

  it("protects explicitly-configured entities", () => {
    const result = classifyEntity({ ...baseSignal, explicitlyProtectedByConfig: true }, DEFAULT_PROTECTION_RULES);
    expect(result.protectedFromRemoval).toBe(true);
  });

  it("protects modded entities and machine proxies when protectModdedEntities is true", () => {
    const moddedSignal: EntitySignal = {
      ...baseSignal,
      typeId: "hydraulic:item_transfer_machine",
      isModdedEntity: true,
    };
    const protectedResult = classifyEntity(moddedSignal, DEFAULT_PROTECTION_RULES);
    expect(protectedResult.protectedFromRemoval).toBe(true);
    expect(protectedResult.reasons).toContain("modded entity / machine proxy / modded item");

    const unprotectedRules = { ...DEFAULT_PROTECTION_RULES, protectModdedEntities: false };
    const unprotectedResult = classifyEntity(moddedSignal, unprotectedRules);
    expect(unprotectedResult.protectedFromRemoval).toBe(false);
  });

  it("protects modded dropped items when protectModdedEntities is true", () => {
    const moddedItemSignal: EntitySignal = {
      ...baseSignal,
      isItemEntity: true,
      itemTypeId: "create:brass_casing",
      ageTicks: 20 * 60 * 10,
    };
    const result = classifyEntity(moddedItemSignal, DEFAULT_PROTECTION_RULES);
    expect(result.protectedFromRemoval).toBe(true);
    expect(result.reasons).toContain("modded entity / machine proxy / modded item");
  });

  it("protects recently dropped items and valuable item contents, but not stale common items", () => {
    const fresh = classifyEntity(
      { ...baseSignal, isItemEntity: true, itemTypeId: "minecraft:dirt", ageTicks: 5 },
      DEFAULT_PROTECTION_RULES
    );
    expect(fresh.protectedFromRemoval).toBe(true);

    const valuable = classifyEntity(
      { ...baseSignal, isItemEntity: true, itemTypeId: "minecraft:diamond", ageTicks: 20 * 60 * 30 },
      DEFAULT_PROTECTION_RULES
    );
    expect(valuable.protectedFromRemoval).toBe(true);

    const staleCommon = classifyEntity(
      { ...baseSignal, isItemEntity: true, itemTypeId: "minecraft:dirt", ageTicks: 20 * 60 * 30, distanceToNearestPlayer: 100 },
      DEFAULT_PROTECTION_RULES
    );
    expect(staleCommon.protectedFromRemoval).toBe(false);
    expect(staleCommon.eligibleForRemoval).toBe(true);
  });

  it("leaves an ordinary distant unnamed hostile mob eligible for removal", () => {
    const result = classifyEntity(baseSignal, DEFAULT_PROTECTION_RULES);
    expect(result.protectedFromRemoval).toBe(false);
    expect(result.eligibleForRemoval).toBe(true);
  });
});

describe("selectForRemoval", () => {
  it("never selects protected candidates", () => {
    const protectedSignal = classifyEntity({ ...baseSignal, isTamed: true }, DEFAULT_PROTECTION_RULES);
    const selected = selectForRemoval([{ signal: baseSignal, classification: protectedSignal }], 1);
    expect(selected).toEqual([]);
  });

  it("respects the aggressiveness fraction", () => {
    const candidates = Array.from({ length: 10 }, (_, i) => {
      const signal: EntitySignal = { ...baseSignal, entityId: String(i), distanceToNearestPlayer: 100 + i };
      return { signal, classification: classifyEntity(signal, DEFAULT_PROTECTION_RULES) };
    });
    expect(selectForRemoval(candidates, 0.5).length).toBe(5);
    expect(selectForRemoval(candidates, 1).length).toBe(10);
    expect(selectForRemoval(candidates, 0).length).toBe(0);
  });

  it("prioritizes older/farther candidates first", () => {
    const near = { ...baseSignal, entityId: "near", distanceToNearestPlayer: 50, ageTicks: 100 };
    const far = { ...baseSignal, entityId: "far", distanceToNearestPlayer: 500, ageTicks: 100 };
    const candidates = [near, far].map((signal) => ({ signal, classification: classifyEntity(signal, DEFAULT_PROTECTION_RULES) }));
    expect(selectForRemoval(candidates, 0.5)).toEqual(["far"]);
  });
});
