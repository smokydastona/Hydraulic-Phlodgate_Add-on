import { describe, expect, it } from "vitest";
import { formatTerrainGrid, formatTerrainGridPixels, terrainCacheKey, terrainGlyphForTypeId, pixelTerrainGlyphForTypeId, parseCompanionVectorPayload } from "./TerrainMap";

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

  it("produces pseudo-pixel terrain colors for richer map rendering", () => {
    expect(pixelTerrainGlyphForTypeId("minecraft:water")).toBe("§9█");
    expect(pixelTerrainGlyphForTypeId("minecraft:grass_block")).toBe("§a█");
    expect(pixelTerrainGlyphForTypeId("minecraft:stone")).toBe("§7█");
  });

  it("formats colorful pseudo-pixel terrain grids with a centered player marker", () => {
    const grid = {
      centerX: 0,
      centerZ: 0,
      cellSize: 4,
      width: 3,
      cells: Array.from({ length: 9 }, () => ({ glyph: "#" as const, height: 64, typeId: "minecraft:stone" })),
    };

    expect(formatTerrainGridPixels(grid)).toEqual(["§7█§7█§7█", "§7█§fX§7█", "§7█§7█§7█"]);
  });

  it("snaps equivalent positions to one cache key", () => {
    expect(terrainCacheKey("minecraft:overworld", 9, 11, 4)).toBe("minecraft:overworld:8:8:4");
    expect(terrainCacheKey("minecraft:overworld", 10, 13, 4)).toBe("minecraft:overworld:8:12:4");
  });

  it("parses companion-vector payloads from the server bridge", () => {
    const parsed = parseCompanionVectorPayload(
      JSON.stringify({
        targets: [
          { id: "boss:1", name: "Ancient Boss", glyph: "⚔", x: 20, z: 30 },
          { id: "friend:1", name: "Ally", glyph: "☻", x: -5, z: 2 },
        ],
      })
    );

    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toMatchObject({ id: "boss:1", name: "Ancient Boss", glyph: "⚔", x: 20, z: 30 });
    expect(parsed[1].name).toBe("Ally");
  });
});