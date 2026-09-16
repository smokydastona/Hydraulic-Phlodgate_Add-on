/** Pure sampling-budget and memory-eviction helpers for the terrain sampler.
 *  Kept free of @minecraft/server imports so the bounding rules are unit-testable. */

/** World reads are expensive and, outside loaded chunks, throw. Spreading them across refreshes keeps a
 *  large map affordable on low-end devices while still filling in over time. */
export const MAX_WORLD_READS_PER_REFRESH = 96;

/** Upper bound on remembered cells before the oldest are evicted. */
export const MAX_REMEMBERED_CELLS = 20000;

/** Decides whether a cell may perform a fresh world read this refresh.
 *  Cells already in memory never consume budget: redrawing known terrain must stay free. */
export function canSampleThisRefresh(readsUsed: number, alreadyRemembered: boolean, budget = MAX_WORLD_READS_PER_REFRESH): boolean {
  if (alreadyRemembered) return false;
  return readsUsed < Math.max(0, budget);
}

/** Returns the keys to drop so the memory stays at or below `limit`, oldest first.
 *  A Map preserves insertion order, so the first keys are the least recently added. */
export function keysToEvict(orderedKeys: readonly string[], limit = MAX_REMEMBERED_CELLS): string[] {
  const overflow = orderedKeys.length - Math.max(0, limit);
  if (overflow <= 0) return [];
  return orderedKeys.slice(0, overflow);
}

/** Cell coordinates are snapped to the sampling grid, so a block edit at an arbitrary position maps to the
 *  one cell that represents it. */
export function cellKeyForBlock(dimensionId: string, x: number, z: number, cellSize: number): string {
  const size = Math.max(1, Math.floor(cellSize));
  return `${dimensionId}:${Math.floor(x / size) * size}:${Math.floor(z / size) * size}`;
}
