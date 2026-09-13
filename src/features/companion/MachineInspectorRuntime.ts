/**
 * Runtime Block & Container Inspection for @minecraft/server.
 */
import { Block, BlockInventoryComponent, Player } from "@minecraft/server";
import {
  createInspectionSnapshot,
  MachineInspectionData,
  MachineSlotInfo,
} from "./MachineInspector";

/**
 * Inspects a block at a given location in the dimension.
 */
export function inspectBlock(block: Block): MachineInspectionData {
  const loc = block.location;
  const dimensionId = block.dimension.id;
  const blockTypeId = block.typeId;

  const slots: MachineSlotInfo[] = [];
  const customName: string | undefined = undefined;

  try {
    const inventory = block.getComponent("minecraft:inventory") as BlockInventoryComponent | undefined;
    const container = inventory?.container;

    if (container) {
      for (let i = 0; i < container.size; i++) {
        const item = container.getItem(i);
        if (item) {
          slots.push({
            slotIndex: i,
            typeId: item.typeId,
            count: item.amount,
            nameTag: item.nameTag,
          });
        } else {
          slots.push({
            slotIndex: i,
            typeId: "minecraft:air",
            count: 0,
          });
        }
      }
    }
  } catch {
    // Some modded blocks or non-container blocks may throw or lack containers
  }

  return createInspectionSnapshot({
    blockTypeId,
    location: { x: loc.x, y: loc.y, z: loc.z, dimensionId },
    slots,
    customName,
  });
}

/**
 * Inspects the block the player is currently looking at (up to maxDistance blocks).
 */
export function inspectPlayerTargetBlock(player: Player, maxDistance = 7): MachineInspectionData | undefined {
  try {
    const raycastResult = player.getBlockFromViewDirection({ maxDistance });
    if (!raycastResult || !raycastResult.block) {
      return undefined;
    }
    return inspectBlock(raycastResult.block);
  } catch {
    return undefined;
  }
}
