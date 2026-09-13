import { describe, it, expect } from "vitest";
import { formatDurabilityLine, isLowDurability, percentRemaining, sortByLowestFirst } from "./DurabilityMath";

describe("percentRemaining", () => {
  it("returns 100 for undamaged items", () => {
    expect(percentRemaining(0, 250)).toBe(100);
  });
  it("returns 0 for fully damaged items", () => {
    expect(percentRemaining(250, 250)).toBe(0);
  });
  it("returns 50 for half damaged items", () => {
    expect(percentRemaining(125, 250)).toBe(50);
  });
  it("returns 100 for items without durability (maxDurability 0)", () => {
    expect(percentRemaining(0, 0)).toBe(100);
  });
  it("clamps out-of-range damage", () => {
    expect(percentRemaining(-10, 100)).toBe(100);
    expect(percentRemaining(500, 100)).toBe(0);
  });
});

describe("isLowDurability", () => {
  it("flags items at or below the threshold", () => {
    expect(isLowDurability(85, 100, 15)).toBe(true);
    expect(isLowDurability(80, 100, 15)).toBe(false);
  });
});

describe("formatDurabilityLine", () => {
  it("includes slot, item name and rounded percent", () => {
    const line = formatDurabilityLine({ slot: "Mainhand", itemName: "Diamond Pickaxe", damage: 100, maxDurability: 1561 }, 20);
    expect(line).toContain("Mainhand");
    expect(line).toContain("Diamond Pickaxe");
    expect(line).toContain("94%");
  });
});

describe("sortByLowestFirst", () => {
  it("orders by ascending remaining percent", () => {
    const readings = [
      { slot: "A", itemName: "x", damage: 10, maxDurability: 100 }, // 90%
      { slot: "B", itemName: "y", damage: 90, maxDurability: 100 }, // 10%
      { slot: "C", itemName: "z", damage: 50, maxDurability: 100 }, // 50%
    ];
    expect(sortByLowestFirst(readings).map((r) => r.slot)).toEqual(["B", "C", "A"]);
  });
});
