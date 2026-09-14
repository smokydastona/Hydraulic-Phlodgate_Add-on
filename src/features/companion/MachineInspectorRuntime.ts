/**
 * Runtime Block & Container Inspection for @minecraft/server.
 */
import { Block, BlockInventoryComponent, Player } from "@minecraft/server";
import {
  createInspectionSnapshot,
  MachineGaugeInfo,
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
  const gauges: MachineGaugeInfo[] = [];

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

  try {
    // Block dynamic properties are not in the typed API surface but may exist at runtime on modded blocks.
    const dynamicHost = block as unknown as {
      getDynamicPropertyIds?: () => string[];
      getDynamicProperty?: (id: string) => unknown;
    };
    const dynamicPropIds = dynamicHost.getDynamicPropertyIds?.() ?? [];
    for (const propId of dynamicPropIds) {
      const val = dynamicHost.getDynamicProperty?.(propId);
      if (typeof val === "number") {
        const isEnergy = propId.toLowerCase().includes("energy") || propId.toLowerCase().includes("power");
        const isFluid = propId.toLowerCase().includes("fluid") || propId.toLowerCase().includes("tank");
        const isHeat = propId.toLowerCase().includes("heat") || propId.toLowerCase().includes("temp");
        gauges.push({
          label: propId,
          type: isEnergy ? "energy" : isFluid ? "fluid" : isHeat ? "heat" : "progress",
          currentValue: val,
          maxValue: isEnergy ? 10000 : isFluid ? 4000 : 100,
          unit: isEnergy ? "FE" : isFluid ? "mB" : isHeat ? "°C" : "ticks",
        });
      }
    }
  } catch {
  }

  return createInspectionSnapshot({
    blockTypeId,
    location: { x: loc.x, y: loc.y, z: loc.z, dimensionId },
    slots,
    gauges,
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
