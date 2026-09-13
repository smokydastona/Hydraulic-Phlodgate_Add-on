import { EquipmentSlot, Player } from "@minecraft/server";
import { getPlayerSettings } from "../../settings/SettingsStore";
import { DurabilityReading, formatDurabilityLine, isLowDurability, sortByLowestFirst } from "./DurabilityMath";

const SLOT_LABELS: Array<[EquipmentSlot, string]> = [
  [EquipmentSlot.Mainhand, "Main Hand"],
  [EquipmentSlot.Offhand, "Off Hand"],
  [EquipmentSlot.Head, "Helmet"],
  [EquipmentSlot.Chest, "Chestplate"],
  [EquipmentSlot.Legs, "Leggings"],
  [EquipmentSlot.Feet, "Boots"],
];

function collectReadings(player: Player): DurabilityReading[] {
  const equippable = player.getComponent("minecraft:equippable");
  if (!equippable) return [];

  const readings: DurabilityReading[] = [];
  for (const [slot, label] of SLOT_LABELS) {
    const stack = equippable.getEquipment(slot);
    if (!stack) continue;
    const durability = stack.getComponent("minecraft:durability");
    if (!durability) continue;
    readings.push({
      slot: label,
      itemName: stack.nameTag ?? stack.typeId.replace("minecraft:", ""),
      damage: durability.damage,
      maxDurability: durability.maxDurability,
    });
  }
  return readings;
}

/** Returns HUD lines for this player's durability display, or undefined if the HUD is disabled/there's nothing equipped with durability. Rendering is composed by ui/HudManager alongside other HUD sections. */
export function buildDurabilityLines(player: Player): string[] | undefined {
  const settings = getPlayerSettings(player);
  if (!settings.durabilityHudEnabled) return undefined;

  const readings = sortByLowestFirst(collectReadings(player));
  if (readings.length === 0) return undefined;

  const lines = readings.map((r) => formatDurabilityLine(r, settings.durabilityAlertThresholdPercent));

  if (settings.durabilityAlertsEnabled) {
    const lowest = readings[0];
    if (isLowDurability(lowest.damage, lowest.maxDurability, settings.durabilityAlertThresholdPercent)) {
      return [`§l§4! LOW DURABILITY !§r`, ...lines];
    }
  }

  return lines;
}
