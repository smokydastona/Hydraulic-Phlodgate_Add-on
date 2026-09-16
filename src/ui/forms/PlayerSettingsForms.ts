import { ModalFormData } from "@minecraft/server-ui";
import { Player } from "@minecraft/server";
import { getPlayerSettings, updatePlayerSettings } from "../../settings/SettingsStore";
import { MINIMAP_POSITIONS, MINIMAP_SHAPES } from "../../settings/SettingsSchema";
import { log } from "../../util/Logger";
import { showFormWithRetry } from "../FormRuntime";

export async function openPlayerSettingsForm(player: Player): Promise<void> {
  const settings = getPlayerSettings(player);

  const form = new ModalFormData()
    .title("Player Settings")
    .toggle("JEI-style inventory sidebar", { defaultValue: settings.jeiInventoryEnabled })
    .toggle("Quick move (container quick transfer)", { defaultValue: settings.quickMoveEnabled })
    .toggle("Inventory search", { defaultValue: settings.inventorySearchEnabled })
    .toggle("Waypoints visible", { defaultValue: settings.waypointsVisible })
    .toggle("Compass HUD", { defaultValue: settings.compassEnabled })
    .toggle("Coordinates HUD", { defaultValue: settings.coordinatesHudEnabled })
    .toggle("Minimap HUD", { defaultValue: settings.minimapEnabled })
    .slider("Minimap radius (blocks)", 32, 256, { defaultValue: settings.minimapRadius, valueStep: 8 })
    .dropdown("Minimap shape", ["Square", "Circle"], { defaultValueIndex: Math.max(0, MINIMAP_SHAPES.indexOf(settings.minimapShape)) })
    .dropdown("Minimap position", ["Top left", "Top right", "Bottom left", "Bottom right"], {
      defaultValueIndex: Math.max(0, MINIMAP_POSITIONS.indexOf(settings.minimapPosition)),
    })
    .toggle("Durability HUD", { defaultValue: settings.durabilityHudEnabled })
    .toggle("Durability low alerts", { defaultValue: settings.durabilityAlertsEnabled })
    .slider("Durability alert threshold (%)", 1, 50, { defaultValue: settings.durabilityAlertThresholdPercent, valueStep: 1 })
    .slider("HUD refresh rate (ticks)", 2, 40, { defaultValue: settings.hudRefreshTicks, valueStep: 2 });

  try {
    const response = await showFormWithRetry(player, () => form, { context: "Player settings form" });
    if (!response || response.canceled || !response.formValues) return;

    const [
      jeiInventoryEnabled,
      quickMoveEnabled,
      inventorySearchEnabled,
      waypointsVisible,
      compassEnabled,
      coordinatesHudEnabled,
      minimapEnabled,
      minimapRadius,
      minimapShapeIndex,
      minimapPositionIndex,
      durabilityHudEnabled,
      durabilityAlertsEnabled,
      durabilityAlertThresholdPercent,
      hudRefreshTicks,
    ] = response.formValues as [
      boolean,
      boolean,
      boolean,
      boolean,
      boolean,
      boolean,
      boolean,
      number,
      number,
      number,
      boolean,
      boolean,
      number,
      number
    ];

    updatePlayerSettings(player, {
      jeiInventoryEnabled,
      quickMoveEnabled,
      inventorySearchEnabled,
      waypointsVisible,
      compassEnabled,
      coordinatesHudEnabled,
      minimapEnabled,
      minimapRadius,
      minimapShape: MINIMAP_SHAPES[minimapShapeIndex] ?? "square",
      minimapPosition: MINIMAP_POSITIONS[minimapPositionIndex] ?? "top_left",
      appleskinOverlayEnabled: false,
      foodPreviewEnabled: false,
      durabilityHudEnabled,
      durabilityAlertsEnabled,
      durabilityAlertThresholdPercent,
      hudRefreshTicks,
    });

    player.sendMessage("§aPlayer settings saved.");
  } catch (err) {
    log(`Player settings form failed: ${String(err)}`);
  }
}
