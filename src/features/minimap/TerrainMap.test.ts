import { describe, expect, it } from "vitest";
import { formatTerrainGrid, formatTerrainGridPixels, terrainCacheKey, terrainGlyphForTypeId, pixelTerrainGlyphForTypeId, parseCompanionVectorPayload, isMachineTarget } from "./TerrainMap";

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
    expect(pixelTerrainGlyphForTypeId("minecraft:iron_ore")).toBe("§e█");
  });

  it("resolves every leaf variant through one family rule", () => {
    for (const leaf of ["oak_leaves", "cherry_leaves", "azalea_leaves", "pale_oak_leaves", "some_future_leaves"]) {
      expect(pixelTerrainGlyphForTypeId(`minecraft:${leaf}`)).toBe("§a█");
    }
  });

  it("gives unknown blocks a stable, non-uniform fallback color", () => {
    const first = pixelTerrainGlyphForTypeId("somemod:unheard_of_block");
    expect(first).toBe(pixelTerrainGlyphForTypeId("somemod:unheard_of_block"));

    const distinct = new Set(
      ["a:one", "a:two", "a:three", "a:four", "a:five", "a:six"].map((id) => pixelTerrainGlyphForTypeId(id))
    );
    expect(distinct.size).toBeGreaterThan(1);
  });

  it("treats machine-like target kinds as hidden from the map", () => {
    expect(isMachineTarget("machine")).toBe(true);
    expect(isMachineTarget("Hydraulic Factory")).toBe(true);
    expect(isMachineTarget("device")).toBe(true);
    expect(isMachineTarget("workstation")).toBe(true);
    expect(isMachineTarget("waypoint")).toBe(false);
    expect(isMachineTarget(undefined)).toBe(false);
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

  it("masks grid corners for the circular minimap shape", () => {
    const grid = {
      centerX: 0,
      centerZ: 0,
      cellSize: 4,
      width: 5,
      cells: Array.from({ length: 25 }, () => ({ glyph: "#" as const, height: 64, typeId: "minecraft:stone" })),
    };

    const lines = formatTerrainGridPixels(grid, "circle");
    expect(lines[0]).toBe(" §7█§7█§7█ ");
    expect(lines[2]).toBe("§7█§7█§fX§7█§7█");
    expect(lines[4]).toBe(" §7█§7█§7█ ");
  });

  it("snaps equivalent positions to one cache key", () => {
    expect(terrainCacheKey("minecraft:overworld", 9, 11, 4)).toBe("minecraft:overworld:8:8:4");
    expect(terrainCacheKey("minecraft:overworld", 10, 13, 4)).toBe("minecraft:overworld:8:12:4");
  });

  it("renders every sampled terrain cell and keeps the player marker centered", () => {
    const grid = {
      centerX: 0,
      centerZ: 0,
      cellSize: 4,
      width: 5,
      cells: Array.from({ length: 25 }, () => ({ glyph: "~" as const, height: 62, typeId: "minecraft:water" })),
    };

    expect(formatTerrainGridPixels(grid)).toEqual([
      "§9█§9█§9█§9█§9█",
      "§9█§9█§9█§9█§9█",
      "§9█§9█§fX§9█§9█",
      "§9█§9█§9█§9█§9█",
      "§9█§9█§9█§9█§9█",
    ]);
  });

  it("uses relief shading for terrain substantially above or below the player cell", () => {
    const heights = [70, 64, 58, 64, 64, 64, 64, 64, 64];
    const grid = {
      centerX: 0,
      centerZ: 0,
      cellSize: 2,
      width: 3,
      cells: heights.map((height) => ({ glyph: "#" as const, height, typeId: "minecraft:stone" })),
    };

    expect(formatTerrainGridPixels(grid)[0]).toBe("§7▓§7█§7▒");
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