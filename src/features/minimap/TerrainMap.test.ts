import { describe, expect, it } from "vitest";
import { formatTerrainGrid, terrainCacheKey, terrainGlyphForTypeId } from "./TerrainMap";

describe("Atlas-inspired terrain map helpers", () => {
  it("classifies common surface blocks into stable glyphs", () => {
    expect(terrainGlyphForTypeId("minecraft:water")).toBe("~");
    expect(terrainGlyphForTypeId("minecraft:lava")).toBe("^");
    expect(terrainGlyphForTypeId("minecraft:grass_block")).toBe(".");
    expect(terrainGlyphForTypeId("minecraft:stone")).toBe("#");
    expect(terrainGlyphForTypeId("minecraft:air")).toBe("?");
  });

  it("renders a fixed grid and keeps the player marker centered", () => {
    const grid = {
      centerX: 0,
      centerZ: 0,
      cellSize: 4,
      width: 3,
      cells: Array.from({ length: 9 }, () => ({ glyph: "#" as const, height: 64, typeId: "minecraft:stone" })),
    };
    expect(formatTerrainGrid(grid)).toEqual(["###", "#X#", "###"]);
  });

  it("snaps equivalent positions to one cache key", () => {
    expect(terrainCacheKey("minecraft:overworld", 9, 11, 4)).toBe("minecraft:overworld:8:8:4");
    expect(terrainCacheKey("minecraft:overworld", 10, 13, 4)).toBe("minecraft:overworld:8:12:4");
  });
});