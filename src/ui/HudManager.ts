import { Player } from "@minecraft/server";
import { getPlayerSettings } from "../settings/SettingsStore";
import { safeInterval } from "../util/Scheduler";
import { buildDurabilityLines } from "../features/durability/DurabilityHud";
import { buildCompassLines } from "../features/waypoints/CompassHud";
import { buildMinimapLines } from "../features/minimap/MinimapHud";
import { buildCoordinatesLines } from "../features/waypoints/CoordinatesHud";

/** Two independent per-player text channels are the only custom HUD surfaces the Script API exposes, so the
 *  minimap (top-left box, via the actionbar) and the compass (bottom-center above the hunger/armor/health row,
 *  via the title/subtitle) are rendered through different vanilla text slots instead of being blended into one
 *  string. There is no third channel: coordinates/food/durability (all opt-in, food/AppleSkin default OFF) join
 *  the minimap box rather than getting their own position. */
const HUD_TEXT_PROPERTY = "phlodgate:hud_text";
const NO_SUBTITLE_TITLE = " "; // A single space: setTitle requires non-empty text; the title label itself is hidden via hud_screen.json.
const SUBTITLE_STAY_DURATION_TICKS = 72000000; // ~500 hours; refreshed content uses updateSubtitle so this practically never expires mid-session.

/** Players who have had their title/subtitle channel initialized this session, and the last subtitle text sent
 *  (so we only call the (cheap, non-flashing) updateSubtitle when the compass text actually changes). */
const subtitleInitialized = new Map<string, string>();
const MINIMAP_POSITION_MARKERS = {
  top_left: "§0§0§r",
  top_right: "§0§1§r",
  bottom_left: "§0§2§r",
  bottom_right: "§0§3§r",
} as const;

function composeMinimapBox(player: Player): string | undefined {
  const sections = [buildMinimapLines(player), buildCoordinatesLines(player), buildDurabilityLines(player)]
    .filter((s): s is string[] => s !== undefined)
    .map((lines) => lines.join("\n"));

  if (sections.length === 0) return undefined;
  return sections.join("\n\u00a78--------\u00a7r\n");
}

function composeCompassSubtitle(player: Player): string {
  const lines = buildCompassLines(player);
  return lines ? lines.join(" ") : "";
}

function updateCompassChannel(player: Player, text: string): void {
  const last = subtitleInitialized.get(player.id);
  if (last === text) return;

  try {
    if (last === undefined) {
      player.onScreenDisplay.setTitle(NO_SUBTITLE_TITLE, {
        subtitle: text,
        fadeInDuration: 0,
        fadeOutDuration: 0,
        stayDuration: SUBTITLE_STAY_DURATION_TICKS,
      });
    } else {
      player.onScreenDisplay.updateSubtitle(text);
    }
    subtitleInitialized.set(player.id, text);
  } catch {
    // Title/subtitle can throw if the player isn't fully loaded yet; it will retry on the next HUD tick.
  }
}

export function clearHudStateForPlayer(playerId: string): void {
  subtitleInitialized.delete(playerId);
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

        const text = composeMinimapBox(player);
        if (text) {
          const positionedText = `${MINIMAP_POSITION_MARKERS[settings.minimapPosition]}${text}`;
          player.setDynamicProperty(HUD_TEXT_PROPERTY, positionedText);
          player.onScreenDisplay.setActionBar(positionedText);
        } else {
          player.setDynamicProperty(HUD_TEXT_PROPERTY, "");
          player.onScreenDisplay.setActionBar("");
        }

        updateCompassChannel(player, composeCompassSubtitle(player));
      }
    },
    2
  );
}
