import { Dimension } from "@minecraft/server";
import { TerrainCell, TerrainGrid, terrainCacheKey, terrainGlyphForTypeId } from "./TerrainMap";

const GRID_WIDTH = 9;
const DEFAULT_CELL_SIZE = 4;
const MIN_Y = -64;
const MAX_Y = 320;
const CACHE_TTL_TICKS = 100;

interface CachedGrid {
  expiresAt: number;
  grid: TerrainGrid;
}

const cache = new Map<string, CachedGrid>();

function sampleCell(dimension: Dimension, x: number, z: number): TerrainCell {
  for (let y = MAX_Y; y >= MIN_Y; y--) {
    const block = dimension.getBlock({ x, y, z });
    if (!block) continue;
    const typeId = block.typeId;
    const glyph = terrainGlyphForTypeId(typeId);
    if (glyph === "?") continue;
    return { glyph, height: y, typeId };
  }
  return { glyph: "?", height: MIN_Y, typeId: "minecraft:air" };
}

export function sampleTerrainGrid(
  dimension: Dimension,
  centerX: number,
  centerZ: number,
  currentTick: number,
  cellSize = DEFAULT_CELL_SIZE
): TerrainGrid {
  const key = terrainCacheKey(dimension.id, centerX, centerZ, cellSize);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > currentTick) return cached.grid;

  const centerGridX = Math.floor(centerX / cellSize) * cellSize;
  const centerGridZ = Math.floor(centerZ / cellSize) * cellSize;
  const half = Math.floor(GRID_WIDTH / 2);
  const cells: TerrainCell[] = [];

  for (let row = -half; row <= half; row++) {
    for (let column = -half; column <= half; column++) {
      cells.push(sampleCell(dimension, centerGridX + column * cellSize, centerGridZ + row * cellSize));
    }
  }

  const grid = { centerX: centerGridX, centerZ: centerGridZ, cellSize, width: GRID_WIDTH, cells };
  cache.set(key, { expiresAt: currentTick + CACHE_TTL_TICKS, grid });
  return grid;
}

export function invalidateTerrainCache(): void {
  cache.clear();
}