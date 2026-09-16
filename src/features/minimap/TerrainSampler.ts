import { Dimension } from "@minecraft/server";
import { TerrainCell, TerrainGrid, terrainCacheKey, terrainGlyphForTypeId } from "./TerrainMap";

const DEFAULT_CELL_SIZE = 4;
const CACHE_TTL_TICKS = 100;
const DEFAULT_GRID_WIDTH = 9;
const MIN_GRID_WIDTH = 3;
const MAX_GRID_WIDTH = 11;
const MIN_CELL_SIZE = 1;
const MAX_CELL_SIZE = 32;

interface CachedGrid {
  expiresAt: number;
  grid: TerrainGrid;
}

const cache = new Map<string, CachedGrid>();

function sampleCell(dimension: Dimension, x: number, z: number, minY: number): TerrainCell {
  const block = dimension.getTopmostBlock({ x, z });
  if (!block) return { glyph: "?", height: minY, typeId: "minecraft:air" };
  const typeId = block.typeId;
  return { glyph: terrainGlyphForTypeId(typeId), height: block.location.y, typeId };
}

export function sampleTerrainGrid(
  dimension: Dimension,
  centerX: number,
  centerZ: number,
  currentTick: number,
  cellSize = DEFAULT_CELL_SIZE,
  requestedWidth = DEFAULT_GRID_WIDTH
): TerrainGrid {
  const safeCellSize = Math.min(MAX_CELL_SIZE, Math.max(MIN_CELL_SIZE, Math.floor(cellSize) || DEFAULT_CELL_SIZE));
  const normalizedWidth = Math.min(MAX_GRID_WIDTH, Math.max(MIN_GRID_WIDTH, Math.floor(requestedWidth) || DEFAULT_GRID_WIDTH));
  const width = normalizedWidth % 2 === 0 ? normalizedWidth - 1 : normalizedWidth;
  const key = `${terrainCacheKey(dimension.id, centerX, centerZ, safeCellSize)}:${width}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > currentTick) return cached.grid;

  const centerGridX = Math.floor(centerX / safeCellSize) * safeCellSize;
  const centerGridZ = Math.floor(centerZ / safeCellSize) * safeCellSize;
  const half = Math.floor(width / 2);
  const cells: TerrainCell[] = [];
  const heightRange = dimension.heightRange;
  const minY = Math.floor(heightRange.min);

  for (let row = -half; row <= half; row++) {
    for (let column = -half; column <= half; column++) {
      cells.push(sampleCell(dimension, centerGridX + column * safeCellSize, centerGridZ + row * safeCellSize, minY));
    }
  }

  const grid = { centerX: centerGridX, centerZ: centerGridZ, cellSize: safeCellSize, width, cells };
  cache.set(key, { expiresAt: currentTick + CACHE_TTL_TICKS, grid });
  return grid;
}

export function invalidateTerrainCache(): void {
  cache.clear();
}