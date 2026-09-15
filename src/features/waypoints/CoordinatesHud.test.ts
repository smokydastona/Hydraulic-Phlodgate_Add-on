import { describe, expect, it } from "vitest";
import { formatCoordinateSnapshot } from "./CoordinatesMath";

describe("coordinate HUD", () => {
  it("formats integer coordinates and a readable dimension", () => {
    expect(
      formatCoordinateSnapshot({ x: 12.9, y: 64.8, z: -3.2, dimensionId: "minecraft:overworld" })
    ).toBe("§bXYZ §f12, 64, -4 §7(overworld)");
  });

  it("preserves non-vanilla dimension identifiers", () => {
    expect(formatCoordinateSnapshot({ x: 0, y: 80, z: 0, dimensionId: "hydraulic:factory" })).toContain("hydraulic:factory");
  });
});