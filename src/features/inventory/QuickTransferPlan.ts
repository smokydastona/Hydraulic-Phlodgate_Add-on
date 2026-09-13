/** Pure quick-transfer planning: given simplified source/dest slot snapshots, computes the resulting slot arrays after moving items. Runtime (QuickTransfer.ts) adapts this to real Containers. */

export interface SlotSnapshot {
  typeId: string;
  count: number;
}

export type TransferMode = "all" | "matching-only";

const MAX_STACK = 64;

/**
 * Moves items from `source` into `dest`.
 * - "all": moves every source stack.
 * - "matching-only": moves only source stacks whose typeId already exists somewhere in dest.
 * Existing dest stacks are topped up first (respecting MAX_STACK), then remaining amounts fill up to `destFreeSlots` new slots.
 * Returns the resulting source/dest snapshots; anything that could not fit stays in source.
 */
export function planTransfer(
  source: SlotSnapshot[],
  dest: SlotSnapshot[],
  destFreeSlots: number,
  mode: TransferMode
): { source: SlotSnapshot[]; dest: SlotSnapshot[] } {
  const workingDest = dest.map((s) => ({ ...s }));
  const workingSource: SlotSnapshot[] = [];
  let freeSlots = destFreeSlots;

  for (const stack of source) {
    const eligible = mode === "all" || workingDest.some((d) => d.typeId === stack.typeId);
    if (!eligible) {
      workingSource.push({ ...stack });
      continue;
    }

    let remaining = stack.count;

    // Top up existing dest stacks of the same type first.
    for (const dStack of workingDest) {
      if (remaining <= 0) break;
      if (dStack.typeId !== stack.typeId) continue;
      const space = MAX_STACK - dStack.count;
      if (space <= 0) continue;
      const move = Math.min(space, remaining);
      dStack.count += move;
      remaining -= move;
    }

    // Then use free slots for the rest.
    while (remaining > 0 && freeSlots > 0) {
      const move = Math.min(MAX_STACK, remaining);
      workingDest.push({ typeId: stack.typeId, count: move });
      remaining -= move;
      freeSlots--;
    }

    if (remaining > 0) {
      workingSource.push({ typeId: stack.typeId, count: remaining });
    }
  }

  return { source: workingSource, dest: workingDest.filter((s) => s.count > 0) };
}
