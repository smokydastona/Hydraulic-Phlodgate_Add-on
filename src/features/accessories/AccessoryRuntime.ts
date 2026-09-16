import { EntityInventoryComponent, ItemStack, Player, world } from "@minecraft/server";
import { safeInterval } from "../../util/Scheduler";
import { log } from "../../util/Logger";
import {
  ACCESSORY_SLOTS,
  AccessorySlotId,
  aggregateAccessoryEffects,
  canEquipAccessory,
  emptyAccessoryState,
  equipAccessory,
  getAccessoryDefinition,
  normalizeAccessoryState,
  unequipAccessory,
} from "./AccessoryPlan";

const ACCESSORY_STATE_KEY = "phlodgate:accessory_state";
const EFFECT_REFRESH_TICKS = 45;
const EFFECT_REFRESH_INTERVAL = 20;

function getContainer(player: Player): NonNullable<EntityInventoryComponent["container"]> | undefined {
  const inventory = player.getComponent("minecraft:inventory") as EntityInventoryComponent | undefined;
  return inventory?.container;
}

export function getAccessoryState(player: Player) {
  const raw = player.getDynamicProperty(ACCESSORY_STATE_KEY) as string | undefined;
  if (!raw) return emptyAccessoryState();
  try {
    return normalizeAccessoryState(JSON.parse(raw));
  } catch {
    return emptyAccessoryState();
  }
}

function setAccessoryState(player: Player, state: ReturnType<typeof emptyAccessoryState>): void {
  player.setDynamicProperty(ACCESSORY_STATE_KEY, JSON.stringify(state));
}

export function equipAccessoryFromInventorySlot(player: Player, inventorySlot: number, slotId: AccessorySlotId): { ok: boolean; message: string } {
  const container = getContainer(player);
  const item = container?.getItem(inventorySlot);
  const definition = item ? getAccessoryDefinition(item.typeId) : undefined;
  if (!container || !item || !definition) return { ok: false, message: "That inventory slot does not contain a Phlodgate trinket." };

  const state = getAccessoryState(player);
  if (!canEquipAccessory(state, item.typeId, slotId)) return { ok: false, message: `${definition.label} cannot be equipped in that slot.` };
  const nextState = equipAccessory(state, item.typeId, slotId);
  if (!nextState) return { ok: false, message: "That accessory slot is already occupied." };

  const original = item.clone();
  try {
    item.amount -= 1;
    container.setItem(inventorySlot, item.amount > 0 ? item : undefined);
    setAccessoryState(player, nextState);
    return { ok: true, message: `${definition.label} equipped in ${slotId.replace("_", " ")}.` };
  } catch (error) {
    try {
      container.setItem(inventorySlot, original);
    } catch {
      player.dimension.spawnItem(original, player.location);
    }
    log(`Accessory equip rollback for ${player.name}: ${String(error)}`);
    return { ok: false, message: "Accessory equip failed; your item was restored." };
  }
}

export function quickEquipFromSelectedSlot(player: Player): { ok: boolean; message: string } {
  const container = getContainer(player);
  const selectedSlot = player.selectedSlotIndex;
  const item = container?.getItem(selectedSlot);
  const definition = item ? getAccessoryDefinition(item.typeId) : undefined;
  if (!item || !definition) return { ok: false, message: "Hold a Phlodgate trinket to quick-equip it." };

  const state = getAccessoryState(player);
  const slot = ACCESSORY_SLOTS.find((candidate) => canEquipAccessory(state, item.typeId, candidate.id));
  if (!slot) return { ok: false, message: `${definition.label} has no compatible empty slot.` };
  return equipAccessoryFromInventorySlot(player, selectedSlot, slot.id);
}

export function unequipAccessoryToInventory(player: Player, slotId: AccessorySlotId): { ok: boolean; message: string } {
  const container = getContainer(player);
  if (!container) return { ok: false, message: "No player inventory is available." };

  const current = getAccessoryState(player);
  const result = unequipAccessory(current, slotId);
  if (!result.itemTypeId) return { ok: false, message: "That accessory slot is empty." };

  try {
    const leftover = container.addItem(new ItemStack(result.itemTypeId, 1));
    if (leftover) player.dimension.spawnItem(leftover, player.location);
    setAccessoryState(player, result.state);
    const label = getAccessoryDefinition(result.itemTypeId)?.label ?? result.itemTypeId;
    return { ok: true, message: `${label} unequipped.` };
  } catch (error) {
    log(`Accessory unequip failed for ${player.name}: ${String(error)}`);
    return { ok: false, message: "Accessory unequip failed; it remains equipped." };
  }
}

export function refreshAccessoryEffects(player: Player): void {
  const effects = aggregateAccessoryEffects(getAccessoryState(player));
  for (const effect of effects) {
    try {
      player.addEffect(effect.effectTypeId, EFFECT_REFRESH_TICKS, { amplifier: effect.amplifier, showParticles: false });
    } catch (error) {
      log(`Accessory effect ${effect.effectTypeId} failed for ${player.name}: ${String(error)}`);
    }
  }
}

export function startAccessoryRuntime(): number {
  return safeInterval(
    "accessory-effects",
    () => {
      for (const player of world.getAllPlayers()) refreshAccessoryEffects(player);
    },
    EFFECT_REFRESH_INTERVAL
  );
}
