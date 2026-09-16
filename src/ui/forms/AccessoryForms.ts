import { ActionFormData } from "@minecraft/server-ui";
import { EntityInventoryComponent, Player as MinecraftPlayer } from "@minecraft/server";
import { showFormWithRetry } from "../FormRuntime";
import { readSelection } from "../FormValidation";
import {
  ACCESSORY_SLOTS,
  AccessorySlotId,
  canEquipAccessory,
  getAccessoryDefinition,
} from "../../features/accessories/AccessoryPlan";
import {
  equipAccessoryFromInventorySlot,
  getAccessoryState,
  unequipAccessoryToInventory,
} from "../../features/accessories/AccessoryRuntime";
import { log } from "../../util/Logger";

function getInventory(player: MinecraftPlayer) {
  return (player.getComponent("minecraft:inventory") as EntityInventoryComponent | undefined)?.container;
}

export async function openAccessoryCabinet(player: MinecraftPlayer): Promise<void> {
  const state = getAccessoryState(player);
  const form = new ActionFormData()
    .title("Phlodgate Trinket Cabinet")
    .body("Equip compatible trinkets in named slots. Hold any trinket and use it for quick-equip.");

  for (const slot of ACCESSORY_SLOTS) {
    const equipped = state.equipped.find((entry) => entry.slotId === slot.id);
    const label = equipped ? getAccessoryDefinition(equipped.itemTypeId)?.label ?? equipped.itemTypeId : "Empty";
    form.button(`${slot.label}: ${label}${equipped ? "\n§7Unequip" : "\n§7Choose an item"}`);
  }
  form.button("Close");

  try {
    const response = await showFormWithRetry(player, () => form, { context: "Trinket cabinet" });
    const selection = response ? readSelection(response) : undefined;
    if (selection === undefined || selection >= ACCESSORY_SLOTS.length) return;

    const slot = ACCESSORY_SLOTS[selection];
    const equipped = state.equipped.find((entry) => entry.slotId === slot.id);
    if (equipped) {
      const result = unequipAccessoryToInventory(player, slot.id);
      player.sendMessage(result.ok ? `§a${result.message}` : `§c${result.message}`);
      return;
    }
    await openAccessoryEquipChoice(player, slot.id);
  } catch (error) {
    log(`Trinket cabinet failed for ${player.name}: ${String(error)}`);
  }
}

async function openAccessoryEquipChoice(player: MinecraftPlayer, slotId: AccessorySlotId): Promise<void> {
  const container = getInventory(player);
  if (!container) return;
  const state = getAccessoryState(player);
  const choices: Array<{ inventorySlot: number; label: string }> = [];

  for (let inventorySlot = 0; inventorySlot < container.size; inventorySlot++) {
    const item = container.getItem(inventorySlot);
    const definition = item ? getAccessoryDefinition(item.typeId) : undefined;
    if (!item || !definition || !canEquipAccessory(state, item.typeId, slotId)) continue;
    choices.push({ inventorySlot, label: `${definition.label} x${item.amount}\n§7${definition.description}` });
  }

  if (choices.length === 0) {
    player.sendMessage("§7No compatible trinkets are available in your inventory.");
    return;
  }

  const slotLabel = ACCESSORY_SLOTS.find((slot) => slot.id === slotId)?.label ?? slotId;
  const form = new ActionFormData().title(`Equip in ${slotLabel}`);
  for (const choice of choices) form.button(choice.label);
  form.button("Back");

  try {
    const response = await showFormWithRetry(player, () => form, { context: "Trinket equip choice" });
    const selection = response ? readSelection(response) : undefined;
    if (selection === undefined || selection >= choices.length) return;
    const result = equipAccessoryFromInventorySlot(player, choices[selection].inventorySlot, slotId);
    player.sendMessage(result.ok ? `§a${result.message}` : `§c${result.message}`);
  } catch (error) {
    log(`Trinket equip choice failed for ${player.name}: ${String(error)}`);
  }
}
