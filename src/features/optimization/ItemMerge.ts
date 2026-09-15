import { Entity, ItemStack, world } from "@minecraft/server";
import { getWorldSettings } from "../../settings/SettingsStore";
import { resolveOptimizationThresholds } from "../../settings/Profiles";
import { safeInterval } from "../../util/Scheduler";
import { log } from "../../util/Logger";
import { planItemMerges } from "./ItemMergePlan";

const MERGE_INTERVAL_TICKS = 60; // 3 seconds

function mergeInDimension(dimensionId: string, radius: number, cap: number): void {
  let items: Entity[];
  try {
    items = [...world.getDimension(dimensionId).getEntities({ type: "minecraft:item" })];
  } catch {
    return;
  }

  const snapshots = items.flatMap((item) => {
    const stack = item.getComponent("minecraft:item")?.itemStack;
    return stack ? [{ id: item.id, typeId: stack.typeId, count: stack.amount, x: item.location.x, y: item.location.y, z: item.location.z }] : [];
  });
  const byId = new Map(items.map((item) => [item.id, item]));

  for (const group of planItemMerges(snapshots, radius, Math.min(cap, 64))) {
    const anchor = byId.get(group.anchorId);
    const merged = group.consumedIds.map((id) => byId.get(id)).filter((item): item is Entity => item !== undefined);
    if (!anchor || merged.length === 0) continue;

    try {
      const newStack = new ItemStack(group.typeId, group.totalCount);
      const spawnLocation = anchor.location;
      const dimension = anchor.dimension;
      anchor.remove();
      for (const other of merged) {
        other.remove();
      }
      dimension.spawnItem(newStack, spawnLocation);
    } catch (err) {
      log(`Item merge failed for ${group.typeId}: ${String(err)}`);
    }
  }
}

function runMergePass(): void {
  const settings = getWorldSettings();
  if (!settings.itemMergingEnabled) return;
  const thresholds = resolveOptimizationThresholds(settings.optimizationMode);

  for (const dimensionId of ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"]) {
    mergeInDimension(dimensionId, thresholds.itemMergeRadius, thresholds.itemMergeCap);
  }
}

export function startItemMerging(): number {
  return safeInterval("item-merging", runMergePass, MERGE_INTERVAL_TICKS);
}
