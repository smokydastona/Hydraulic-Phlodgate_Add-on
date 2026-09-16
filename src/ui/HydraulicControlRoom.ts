import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { Player } from "@minecraft/server";
import { openPlayerSettingsForm } from "./forms/PlayerSettingsForms";
import { openWorldSettingsForm } from "./forms/WorldSettingsForms";
import { openWaypointMenu } from "./forms/WaypointForms";
import { openFieldMapMenu } from "./forms/MinimapForms";
import { openInventoryMenu } from "./forms/RecipeForms";
import { openAccessoryCabinet } from "./forms/AccessoryForms";
import { openCompanionBridgeMenu } from "./forms/CompanionBridgeForms";
import { getAuditLog } from "../features/optimization/OptimizationEngine";
import { log } from "../util/Logger";
import { showFormWithRetry } from "./FormRuntime";
import { readSelection } from "./FormValidation";
import { CONTROL_ROOM_MENU, visibleMenuEntries } from "./MenuCatalog";
import { isOperator } from "../settings/Permissions";

const UNSUPPORTED_NOTICE = [
  "The following are NOT available because the Bedrock Script API does not expose the required hooks:",
  "- True render-only entity/particle culling (this add-on uses despawn + cleanup instead)",
  "- Custom hotkey registration",
  "- Auto-update / auto-install of packs",
  "- Native camera-rendered/pixel minimap (no world-render texture or mesh access in Script API)",
  "- Runtime block-animation or lighting-pass simplification",
  "- Full vanilla particle suppression at runtime",
  "",
  "Instead, the Minimap HUD provides a sampled colored terrain grid, rotating radar strip (cardinal",
  "directions + nearby waypoints), persistent top-left JSON UI placement, and a Field Map form. The",
  "Inventory & Recipes screen provides categorized, paginated workbench browsing and bounded mass crafting.",
  "",
  "Where relevant, static Resource Pack presets (Aggressive/Extreme) are provided instead.",
].join("\n");

export async function openHydraulicControlRoom(player: Player): Promise<void> {
  const entries = visibleMenuEntries(CONTROL_ROOM_MENU, isOperator(player));
  const form = new ActionFormData().title("Hydraulic Control Room").body(
    ["Phlodgate Add-On master settings", "", ...entries.map((entry) => `§7${entry.description}`)].join("\n")
  );
  for (const entry of entries) form.button(entry.label);

  try {
    const response = await showFormWithRetry(player, () => form, { context: "Hydraulic Control Room" });
    if (!response) return;
    const selection = readSelection(response);
    if (selection === undefined) return;

    switch (entries[selection]?.action) {
      case "companion":
        await openCompanionBridgeMenu(player);
        break;
      case "inventory":
        await openInventoryMenu(player);
        break;
      case "accessories":
        await openAccessoryCabinet(player);
        break;
      case "waypoints":
        await openWaypointMenu(player);
        break;
      case "field_map":
        await openFieldMapMenu(player);
        break;
      case "player_settings":
        await openPlayerSettingsForm(player);
        break;
      case "world_settings":
        await openWorldSettingsForm(player);
        break;
      case "diagnostics":
        await openDiagnosticsMenu(player);
        break;
      case "about":
        await showFormWithRetry(
          player,
          () => new MessageFormData().title("About / Unsupported Features").body(UNSUPPORTED_NOTICE).button1("OK").button2("Close"),
          { context: "Unsupported Features" }
        );
        break;
    }
  } catch (err) {
    log(`Hydraulic Control Room failed to open: ${String(err)}`);
  }
}

async function openDiagnosticsMenu(player: Player): Promise<void> {
  const entries = getAuditLog().slice(-25).reverse();
  const body =
    entries.length === 0
      ? "No optimization actions recorded yet."
      : entries.map((e) => `[tick ${e.tick}] ${e.action}: ${e.typeId} (${e.entityId})`).join("\n");

  await showFormWithRetry(
    player,
    () => new MessageFormData().title("Optimization Audit Log (latest 25)").body(body).button1("OK").button2("Close"),
    { context: "Optimization Diagnostics" }
  );
}
