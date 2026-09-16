import { describe, expect, it } from "vitest";
import {
  aggregateAccessoryEffects,
  canEquipAccessory,
  emptyAccessoryState,
  equipAccessory,
  normalizeAccessoryState,
  unequipAccessory,
} from "./AccessoryPlan";

describe("AccessoryPlan", () => {
  it("accepts only catalog items in their declared slots", () => {
    const state = emptyAccessoryState();
    expect(canEquipAccessory(state, "phlodgate:speed_ring", "ring_1")).toBe(true);
    expect(canEquipAccessory(state, "phlodgate:speed_ring", "head")).toBe(false);
    expect(canEquipAccessory(state, "minecraft:diamond", "ring_1")).toBe(false);
  });

  it("prevents duplicate occupancy and keeps independent ring slots", () => {
    const first = equipAccessory(emptyAccessoryState(), "phlodgate:speed_ring", "ring_1");
    expect(first).toBeDefined();
    expect(equipAccessory(first!, "phlodgate:speed_ring", "ring_1")).toBeUndefined();
    expect(equipAccessory(first!, "phlodgate:speed_ring", "ring_2")?.equipped).toHaveLength(2);
  });

  it("aggregates active effects without duplicate effect entries", () => {
    const state = {
      equipped: [
        { slotId: "ring_1" as const, itemTypeId: "phlodgate:speed_ring" },
        { slotId: "ring_2" as const, itemTypeId: "phlodgate:speed_ring" },
        { slotId: "charm" as const, itemTypeId: "phlodgate:fire_charm" },
      ],
    };
    expect(aggregateAccessoryEffects(state)).toEqual([
      { effectTypeId: "speed", amplifier: 0 },
      { effectTypeId: "fire_resistance", amplifier: 0 },
    ]);
  });

  it("drops malformed, incompatible, and duplicate persisted entries", () => {
    const state = normalizeAccessoryState({
      equipped: [
        { slotId: "ring_1", itemTypeId: "phlodgate:speed_ring" },
        { slotId: "ring_1", itemTypeId: "phlodgate:speed_ring" },
        { slotId: "head", itemTypeId: "phlodgate:fire_charm" },
        { slotId: "charm", itemTypeId: "phlodgate:fire_charm" },
        { slotId: "charm", itemTypeId: "phlodgate:fire_charm" },
      ],
    });
    expect(state.equipped).toEqual([
      { slotId: "ring_1", itemTypeId: "phlodgate:speed_ring" },
      { slotId: "charm", itemTypeId: "phlodgate:fire_charm" },
    ]);
  });

  it("returns the removed item when unequipping", () => {
    const state = equipAccessory(emptyAccessoryState(), "phlodgate:night_amulet", "head")!;
    expect(unequipAccessory(state, "head")).toEqual({ state: { equipped: [] }, itemTypeId: "phlodgate:night_amulet" });
  });
});
