import { Player } from "@minecraft/server";
import { getPlayerSettings } from "../settings/SettingsStore";
import { safeInterval } from "../util/Scheduler";
import { buildDurabilityLines } from "../features/durability/DurabilityHud";
import { buildFoodLines } from "../features/food/FoodHud";
import { buildCompassLines } from "../features/waypoints/CompassHud";
import { buildMinimapLines } from "../features/minimap/MinimapHud";

/** Combines all per-player HUD sections into a single actionbar write per tick per player so features never overwrite one another. */
function composeHud(player: Player): string | undefined {
  const sections = [buildMinimapLines(player), buildCompassLines(player), buildFoodLines(player), buildDurabilityLines(player)]
    .filter((s): s is string[] => s !== undefined)
    .map((lines) => lines.join("\n"));

  if (sections.length === 0) return undefined;
  return sections.join("\n\u00a78--------\u00a7r\n");
}

export function startHudManager(getPlayers: () => Player[]): number {
  let tickCounter = 0;
  return safeInterval(
    "hud-manager",
    () => {
      tickCounter++;
      for (const player of getPlayers()) {
        const settings = getPlayerSettings(player);
        if (tickCounter % Math.max(1, settings.hudRefreshTicks) !== 0) continue;
        const text = composeHud(player);
        if (text) player.onScreenDisplay.setActionBar(text);
      }
    },
    2
  );
}
