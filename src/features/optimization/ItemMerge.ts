import { Entity, ItemStack, world } from "@minecraft/server";
import { getWorldSettings } from "../../settings/SettingsStore";
import { resolveOptimizationThresholds } from "../../settings/Profiles";
import { safeInterval } from "../../util/Scheduler";
import { log } from "../../util/Logger";
import { distance3D } from "../../util/Vector";

const MERGE_INTERVAL_TICKS = 60; // 3 seconds

function mergeInDimension(dimensionId: string, radius: number, cap: number): void {
  let items: Entity[];
  try {
    items = [...world.getDimension(dimensionId).getEntities({ type: "minecraft:item" })];
  } catch {
    return;
  }

  const consumed = new Set<string>();

  for (const anchor of items) {
    if (consumed.has(anchor.id)) continue;
    const anchorItemComp = anchor.getComponent("minecraft:item");
    const anchorStack = anchorItemComp?.itemStack;
    if (!anchorStack) continue;

    let total = anchorStack.amount;
    const merged: Entity[] = [];

    for (const other of items) {
      if (other.id === anchor.id || consumed.has(other.id)) continue;
      const otherStack = other.getComponent("minecraft:item")?.itemStack;
      if (!otherStack || otherStack.typeId !== anchorStack.typeId) continue;
      if (distance3D(anchor.location, other.location) > radius) continue;
      if (total >= cap) break;

      total += otherStack.amount;
      merged.push(other);
    }

    if (merged.length === 0) continue;

    const finalAmount = Math.min(total, cap, 64);
    try {
      const newStack = new ItemStack(anchorStack.typeId, finalAmount);
      const spawnLocation = anchor.location;
      const dimension = anchor.dimension;
      anchor.remove();
      consumed.add(anchor.id);
      for (const other of merged) {
        other.remove();
        consumed.add(other.id);
      }
      dimension.spawnItem(newStack, spawnLocation);
    } catch (err) {
      log(`Item merge failed for ${anchorStack.typeId}: ${String(err)}`);
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
