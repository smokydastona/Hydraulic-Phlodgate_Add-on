import { describe, expect, it } from "vitest";
import { canSampleThisRefresh, cellKeyForBlock, keysToEvict, MAX_REMEMBERED_CELLS } from "./TerrainBudget";

describe("canSampleThisRefresh", () => {
  it("never spends budget redrawing terrain already in memory", () => {
    expect(canSampleThisRefresh(0, true, 10)).toBe(false);
    expect(canSampleThisRefresh(999, true, 10)).toBe(false);
  });

  it("allows fresh reads until the budget is exhausted", () => {
    expect(canSampleThisRefresh(0, false, 3)).toBe(true);
    expect(canSampleThisRefresh(2, false, 3)).toBe(true);
    expect(canSampleThisRefresh(3, false, 3)).toBe(false);
    expect(canSampleThisRefresh(4, false, 3)).toBe(false);
  });

  it("treats a zero or negative budget as no reads at all", () => {
    expect(canSampleThisRefresh(0, false, 0)).toBe(false);
    expect(canSampleThisRefresh(0, false, -5)).toBe(false);
  });
});

describe("keysToEvict", () => {
  it("evicts nothing while under the limit", () => {
    expect(keysToEvict(["a", "b"], 5)).toEqual([]);
    expect(keysToEvict(["a", "b"], 2)).toEqual([]);
  });

  it("evicts the oldest entries only, not the whole memory", () => {
    expect(keysToEvict(["a", "b", "c", "d"], 2)).toEqual(["a", "b"]);
  });

  it("defaults to the documented memory ceiling", () => {
    const keys = Array.from({ length: MAX_REMEMBERED_CELLS + 3 }, (_unused, index) => `k${index}`);
    expect(keysToEvict(keys)).toEqual(["k0", "k1", "k2"]);
  });
});

describe("cellKeyForBlock", () => {
  it("snaps an arbitrary block position to its sampling cell", () => {
    expect(cellKeyForBlock("minecraft:overworld", 17, 33, 16)).toBe("minecraft:overworld:16:32");
    expect(cellKeyForBlock("minecraft:overworld", 31, 47, 16)).toBe("minecraft:overworld:16:32");
  });

  it("handles negative coordinates without collapsing onto the wrong cell", () => {
    expect(cellKeyForBlock("minecraft:overworld", -1, -1, 16)).toBe("minecraft:overworld:-16:-16");
    expect(cellKeyForBlock("minecraft:overworld", -16, -16, 16)).toBe("minecraft:overworld:-16:-16");
    expect(cellKeyForBlock("minecraft:overworld", -17, -17, 16)).toBe("minecraft:overworld:-32:-32");
  });

  it("guards against a zero or fractional cell size", () => {
    expect(cellKeyForBlock("minecraft:overworld", 5, 5, 0)).toBe("minecraft:overworld:5:5");
    expect(cellKeyForBlock("minecraft:overworld", 5, 5, 0.4)).toBe("minecraft:overworld:5:5");
  });
});
