import { EntityComponentTypes, EquipmentSlot, Player } from "@minecraft/server";
import { getPlayerSettings } from "../../settings/SettingsStore";
import { isKnownFood, predictFoodEffect } from "./FoodTable";

function readCurrentValue(player: Player, componentType: string, fallback: number): number {
  const component = player.getComponent(componentType as never) as { currentValue?: number } | undefined;
  return component?.currentValue ?? fallback;
}

/** Returns HUD lines for hunger/saturation + held-food preview, or undefined if both sub-features are disabled. Rendering is composed by ui/HudManager. */
export function buildFoodLines(player: Player): string[] | undefined {
  const settings = getPlayerSettings(player);
  if (!settings.appleskinOverlayEnabled && !settings.foodPreviewEnabled) return undefined;

  const hunger = readCurrentValue(player, EntityComponentTypes.Hunger, 20);
  const saturation = readCurrentValue(player, EntityComponentTypes.Saturation, 0);
  const exhaustion = readCurrentValue(player, EntityComponentTypes.Exhaustion, 0);

  const lines: string[] = [];
  if (settings.appleskinOverlayEnabled) {
    lines.push(
      `\u00a76Hunger: ${hunger.toFixed(1)}/20  \u00a7bSaturation: ${saturation.toFixed(1)}  \u00a77Exhaustion: ${exhaustion.toFixed(2)}`
    );
  }

  if (settings.foodPreviewEnabled) {
    const equippable = player.getComponent("minecraft:equippable");
    const held = equippable?.getEquipment(EquipmentSlot.Mainhand);
    if (held && isKnownFood(held.typeId)) {
      const prediction = predictFoodEffect(held.typeId, hunger, saturation);
      if (prediction) {
        lines.push(
          `\u00a7aHeld: ${held.typeId.replace("minecraft:", "")} \u2192 Hunger +${prediction.hungerGain} \u00a7bSat +${prediction.saturationGain.toFixed(1)}`
        );
      }
    }
  }

  return lines.length > 0 ? lines : undefined;
}
