import { Dimension } from "@minecraft/server";
import { TerrainCell, TerrainGrid, terrainCacheKey, terrainGlyphForTypeId } from "./TerrainMap";
import { canSampleThisRefresh, cellKeyForBlock, keysToEvict, MAX_REMEMBERED_CELLS } from "./TerrainBudget";

const DEFAULT_CELL_SIZE = 4;
const CACHE_TTL_TICKS = 100;
const DEFAULT_GRID_WIDTH = 9;
const MIN_GRID_WIDTH = 3;
const MAX_GRID_WIDTH = 21;
const MIN_CELL_SIZE = 1;
const MAX_CELL_SIZE = 32;

interface CachedGrid {
  expiresAt: number;
  grid: TerrainGrid;
}

const cache = new Map<string, CachedGrid>();

/** Terrain the player has already seen, so the map keeps showing explored ground once those chunks unload.
 *  This is the map's memory: it must survive block edits, or the map collapses to the loaded chunks only. */
const rememberedCells = new Map<string, TerrainCell>();

const UNKNOWN_TYPE_ID = "phlodgate:unmapped";

function rememberCell(memoryKey: string, cell: TerrainCell): void {
  rememberedCells.set(memoryKey, cell);
  for (const key of keysToEvict([...rememberedCells.keys()], MAX_REMEMBERED_CELLS)) {
    rememberedCells.delete(key);
  }
}

interface SampleContext {
  readsUsed: number;
}

function sampleCell(dimension: Dimension, x: number, z: number, minY: number, context: SampleContext): TerrainCell {
  const memoryKey = `${dimension.id}:${x}:${z}`;
  const remembered = rememberedCells.get(memoryKey);

  // Outside loaded chunks getTopmostBlock throws, and at map scale that would mean hundreds of exceptions
  // every refresh. Reads are budgeted so an unexplored map fills in progressively instead of spiking.
  if (!canSampleThisRefresh(context.readsUsed, remembered !== undefined)) {
    return remembered ?? { glyph: "?", height: minY, typeId: UNKNOWN_TYPE_ID };
  }

  context.readsUsed++;
  try {
    const block = dimension.getTopmostBlock({ x, z });
    if (!block) {
      const cell: TerrainCell = { glyph: "?", height: minY, typeId: "minecraft:air" };
      rememberCell(memoryKey, cell);
      return cell;
    }
    const cell: TerrainCell = {
      glyph: terrainGlyphForTypeId(block.typeId),
      height: block.location.y,
      typeId: block.typeId,
    };
    rememberCell(memoryKey, cell);
    return cell;
  } catch {
    return remembered ?? { glyph: "?", height: minY, typeId: UNKNOWN_TYPE_ID };
  }
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
  const context: SampleContext = { readsUsed: 0 };

  for (let row = -half; row <= half; row++) {
    for (let column = -half; column <= half; column++) {
      cells.push(
        sampleCell(dimension, centerGridX + column * safeCellSize, centerGridZ + row * safeCellSize, minY, context)
      );
    }
  }

  const grid = { centerX: centerGridX, centerZ: centerGridZ, cellSize: safeCellSize, width, cells };
  // A partially filled map must expire quickly so the remaining cells get sampled on the next pass.
  const ttl = context.readsUsed > 0 ? Math.min(CACHE_TTL_TICKS, 20) : CACHE_TTL_TICKS;
  cache.set(key, { expiresAt: currentTick + ttl, grid });
  return grid;
}

/** Drops the cached grids and forgets the single cell a block edit changed, leaving the rest of the
 *  explored map intact. */
export function invalidateTerrainAt(dimensionId: string, x: number, z: number): void {
  cache.clear();
  for (let size = MIN_CELL_SIZE; size <= MAX_CELL_SIZE; size *= 2) {
    rememberedCells.delete(cellKeyForBlock(dimensionId, x, z, size));
  }
}

/** Full reset. Only for dimension-wide changes; ordinary block edits must use invalidateTerrainAt. */
export function invalidateTerrainCache(): void {
  cache.clear();
  rememberedCells.clear();
}
