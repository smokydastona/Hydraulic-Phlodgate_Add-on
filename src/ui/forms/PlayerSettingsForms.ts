import { ModalFormData } from "@minecraft/server-ui";
import { Player } from "@minecraft/server";
import { getPlayerSettings, updatePlayerSettings } from "../../settings/SettingsStore";
import { log } from "../../util/Logger";

export async function openPlayerSettingsForm(player: Player): Promise<void> {
  const settings = getPlayerSettings(player);

  const form = new ModalFormData()
    .title("Player Settings")
    .toggle("JEI-style inventory sidebar", { defaultValue: settings.jeiInventoryEnabled })
    .toggle("Quick move (container quick transfer)", { defaultValue: settings.quickMoveEnabled })
    .toggle("Inventory search", { defaultValue: settings.inventorySearchEnabled })
    .toggle("Waypoints visible", { defaultValue: settings.waypointsVisible })
    .toggle("Compass HUD", { defaultValue: settings.compassEnabled })
    .toggle("Minimap HUD (radar strip)", { defaultValue: settings.minimapEnabled })
    .slider("Minimap radius (blocks)", 32, 256, { defaultValue: settings.minimapRadius, valueStep: 8 })
    .toggle("AppleSkin-style saturation overlay", { defaultValue: settings.appleskinOverlayEnabled })
    .toggle("Held-food preview", { defaultValue: settings.foodPreviewEnabled })
    .toggle("Durability HUD", { defaultValue: settings.durabilityHudEnabled })
    .toggle("Durability low alerts", { defaultValue: settings.durabilityAlertsEnabled })
    .slider("Durability alert threshold (%)", 1, 50, { defaultValue: settings.durabilityAlertThresholdPercent, valueStep: 1 })
    .slider("HUD refresh rate (ticks)", 2, 40, { defaultValue: settings.hudRefreshTicks, valueStep: 2 });

  try {
    const response = await form.show(player);
    if (response.canceled || !response.formValues) return;

    const [
      jeiInventoryEnabled,
      quickMoveEnabled,
      inventorySearchEnabled,
      waypointsVisible,
      compassEnabled,
      minimapEnabled,
      minimapRadius,
      appleskinOverlayEnabled,
      foodPreviewEnabled,
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
      number,
      boolean,
      boolean,
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
      minimapEnabled,
      minimapRadius,
      appleskinOverlayEnabled,
      foodPreviewEnabled,
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
