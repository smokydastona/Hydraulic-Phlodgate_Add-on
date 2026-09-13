import { describe, it, expect } from "vitest";
import { planTransfer } from "./QuickTransferPlan";

describe("planTransfer - all mode", () => {
  it("moves everything when there is enough space", () => {
    const source = [{ typeId: "minecraft:cobblestone", count: 32 }];
    const dest: { typeId: string; count: number }[] = [];
    const result = planTransfer(source, dest, 5, "all");
    expect(result.source).toEqual([]);
    expect(result.dest).toEqual([{ typeId: "minecraft:cobblestone", count: 32 }]);
  });

  it("tops up existing stacks before using free slots", () => {
    const source = [{ typeId: "minecraft:cobblestone", count: 40 }];
    const dest = [{ typeId: "minecraft:cobblestone", count: 32 }];
    const result = planTransfer(source, dest, 1, "all");
    // 32 existing + top-up to 64 (32 more) = 40 - 32 = 8 remaining go to a new slot
    expect(result.dest).toEqual([
      { typeId: "minecraft:cobblestone", count: 64 },
      { typeId: "minecraft:cobblestone", count: 8 },
    ]);
    expect(result.source).toEqual([]);
  });

  it("leaves leftovers in source when dest is full", () => {
    const source = [{ typeId: "minecraft:dirt", count: 64 }];
    const dest: { typeId: string; count: number }[] = [];
    const result = planTransfer(source, dest, 0, "all");
    expect(result.source).toEqual([{ typeId: "minecraft:dirt", count: 64 }]);
    expect(result.dest).toEqual([]);
  });
});

describe("planTransfer - matching-only mode", () => {
  it("only moves stacks whose type already exists in dest", () => {
    const source = [
      { typeId: "minecraft:cobblestone", count: 10 },
      { typeId: "minecraft:diamond", count: 3 },
    ];
    const dest = [{ typeId: "minecraft:cobblestone", count: 5 }];
    const result = planTransfer(source, dest, 5, "matching-only");
    expect(result.dest).toEqual([{ typeId: "minecraft:cobblestone", count: 15 }]);
    expect(result.source).toEqual([{ typeId: "minecraft:diamond", count: 3 }]);
  });
});
