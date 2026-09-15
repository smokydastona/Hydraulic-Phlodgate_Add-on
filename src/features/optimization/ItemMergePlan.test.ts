import { describe, expect, it } from "vitest";
import { planItemMerges } from "./ItemMergePlan";

describe("planItemMerges", () => {
  it("merges nearby matching items and leaves distant or different items alone", () => {
    const groups = planItemMerges(
      [
        { id: "a", typeId: "minecraft:dirt", count: 32, x: 0, y: 64, z: 0 },
        { id: "b", typeId: "minecraft:dirt", count: 16, x: 1, y: 64, z: 0 },
        { id: "c", typeId: "minecraft:dirt", count: 8, x: 10, y: 64, z: 0 },
        { id: "d", typeId: "minecraft:stone", count: 8, x: 1, y: 64, z: 0 },
      ],
      2,
      64
    );

    expect(groups).toEqual([
      { typeId: "minecraft:dirt", anchorId: "a", consumedIds: ["b"], totalCount: 48, x: 0, y: 64, z: 0 },
    ]);
  });

  it("caps output and never creates groups for invalid limits", () => {
    const items = [
      { id: "a", typeId: "minecraft:dirt", count: 60, x: 0, y: 64, z: 0 },
      { id: "b", typeId: "minecraft:dirt", count: 4, x: 0, y: 64, z: 1 },
    ];
    expect(planItemMerges(items, 2, 64)[0].totalCount).toBe(64);
    expect(planItemMerges(items, 0, 64)).toEqual([]);
    expect(planItemMerges(items, 2, 0)).toEqual([]);
  });
});