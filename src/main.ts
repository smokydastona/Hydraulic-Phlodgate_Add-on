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
import { invalidateTerrainCache } from "./features/minimap/TerrainSampler";
import { log } from "./util/Logger";

const CONTROL_ROOM_ITEM = "phlodgate:control_room_remote";
const FIELD_MAP_ITEM = "phlodgate:field_map";
const STARTER_ITEMS = [CONTROL_ROOM_ITEM, FIELD_MAP_ITEM];

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
  }
});

world.afterEvents.playerBreakBlock.subscribe(() => invalidateTerrainCache());
world.afterEvents.playerPlaceBlock.subscribe(() => invalidateTerrainCache());

world.afterEvents.playerInteractWithBlock.subscribe((event) => {
  if (!event.isFirstEvent) return;
  if (event.beforeItemStack?.typeId === CONTROL_ROOM_ITEM) {
    void openMachineInspectionForm(event.player);
  }
});

// Note: the current @minecraft/server release used by this pack does not expose a chat-interception hook
// (world.beforeEvents.chatSend is not present in this API version), so the Hydraulic Control Room menu
// is only reachable via the control room item, matching the plan's "custom item" access path.

registerQuickTransferTracking();
registerOptimizationEventTracking();

startHudManager(() => [...world.getAllPlayers()]);
startOptimizationEngine();
startItemMerging();
startFogController();
startCompanionDetector();
registerCompanionPetSystem();

log("Phlodgate Add-On initialized.");
