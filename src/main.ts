import { EntityInventoryComponent, ItemStack, Player, world } from "@minecraft/server";
import { openMachineInspectionForm } from "./ui/forms/CompanionBridgeForms";
import { openHydraulicControlRoom } from "./ui/HydraulicControlRoom";
import { openFieldMapMenu } from "./ui/forms/MinimapForms";
import { startHudManager, clearHudStateForPlayer } from "./ui/HudManager";
import { registerQuickTransferTracking } from "./features/inventory/QuickTransfer";
import { registerOptimizationEventTracking, startOptimizationEngine } from "./features/optimization/OptimizationEngine";
import { startItemMerging } from "./features/optimization/ItemMerge";
import { startFogController, clearFogTrackingForPlayer } from "./features/fog/FogController";
import { startCompanionDetector } from "./features/companion/CompanionRuntime";
import { registerCompanionPetSystem } from "./features/companion/CompanionPetRuntime";
import { quickEquipFromSelectedSlot, startAccessoryRuntime } from "./features/accessories/AccessoryRuntime";
import { registerLootrSystem } from "./features/lootr/LootrRuntime";
import { getAccessoryDefinition } from "./features/accessories/AccessoryPlan";
import { openAccessoryCabinet } from "./ui/forms/AccessoryForms";
import { invalidateTerrainAt } from "./features/minimap/TerrainSampler";
import { log } from "./util/Logger";

const CONTROL_ROOM_ITEM = "phlodgate:control_room_remote";
const FIELD_MAP_ITEM = "phlodgate:field_map";
const ACCESSORY_CABINET_ITEM = "phlodgate:trinket_cabinet";
const STARTER_ITEMS = [CONTROL_ROOM_ITEM, FIELD_MAP_ITEM, ACCESSORY_CABINET_ITEM];

function giveItemIfMissing(player: Player, typeId: string): void {
  const inventory = player.getComponent("minecraft:inventory") as EntityInventoryComponent | undefined;
  const container = inventory?.container;
  if (!container) return;

  for (let i = 0; i < container.size; i++) {
    if (container.getItem(i)?.typeId === typeId) return;
  }

  const leftover = container.addItem(new ItemStack(typeId, 1));
  if (leftover) {
    // Inventory was full; drop it at the player's feet instead of silently discarding it.
    player.dimension.spawnItem(leftover, player.location);
  }
}

world.afterEvents.playerSpawn.subscribe((event) => {
  if (!event.initialSpawn) return;
  try {
    for (const typeId of STARTER_ITEMS) giveItemIfMissing(event.player, typeId);
  } catch (err) {
    log(`Failed to give starter items to ${event.player.name}: ${String(err)}`);
  }
});

world.afterEvents.playerLeave.subscribe((event) => {
  clearFogTrackingForPlayer(event.playerId);
  clearHudStateForPlayer(event.playerId);
});

world.afterEvents.itemUse.subscribe((event) => {
  if (event.itemStack.typeId === CONTROL_ROOM_ITEM) {
    void openHydraulicControlRoom(event.source);
  } else if (event.itemStack.typeId === FIELD_MAP_ITEM) {
    void openFieldMapMenu(event.source);
  } else if (event.itemStack.typeId === ACCESSORY_CABINET_ITEM) {
    void openAccessoryCabinet(event.source);
  } else if (getAccessoryDefinition(event.itemStack.typeId)) {
    const result = quickEquipFromSelectedSlot(event.source);
    event.source.sendMessage(result.ok ? `§a${result.message}` : `§7${result.message}`);
  }
});

world.afterEvents.playerBreakBlock.subscribe((event) =>
  invalidateTerrainAt(event.dimension.id, event.block.location.x, event.block.location.z)
);
world.afterEvents.playerPlaceBlock.subscribe((event) =>
  invalidateTerrainAt(event.dimension.id, event.block.location.x, event.block.location.z)
);

world.afterEvents.playerInteractWithBlock.subscribe((event) => {
  if (!event.isFirstEvent) return;
  if (event.beforeItemStack?.typeId === CONTROL_ROOM_ITEM) {
    void openMachineInspectionForm(event.player);
  }
});

// Note: the current @minecraft/server release used by this pack does not expose a chat-interception hook
// (world.beforeEvents.chatSend is not present in this API version), so the Hydraulic Control Room menu
// is only reachable via the control room item, matching the plan's "custom item" access path.

/** A throw while the script module loads takes the whole behavior pack down with it, which on a console
 *  client surfaces as a failure to enter the world. Each subsystem is isolated so one bad registration
 *  degrades that single feature instead of the entire add-on. */
function safeRegister(name: string, register: () => void): void {
  try {
    register();
  } catch (err) {
    log(`Subsystem "${name}" failed to start and is disabled for this session: ${String(err)}`);
  }
}

safeRegister("quick transfer", registerQuickTransferTracking);
safeRegister("optimization events", registerOptimizationEventTracking);
safeRegister("hud manager", () => startHudManager(() => [...world.getAllPlayers()]));
safeRegister("optimization engine", startOptimizationEngine);
safeRegister("item merging", startItemMerging);
safeRegister("fog controller", startFogController);
safeRegister("companion detector", startCompanionDetector);
safeRegister("companion pets", registerCompanionPetSystem);
safeRegister("accessories", startAccessoryRuntime);
safeRegister("instanced loot", registerLootrSystem);

log("Phlodgate Add-On initialized.");
