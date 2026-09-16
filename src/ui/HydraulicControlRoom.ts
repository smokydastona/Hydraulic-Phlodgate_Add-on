import { ActionFormData, MessageFormData } from "@minecraft/server-ui";
import { Player } from "@minecraft/server";
import { openPlayerSettingsForm } from "./forms/PlayerSettingsForms";
import { openWorldSettingsForm } from "./forms/WorldSettingsForms";
import { openWaypointMenu } from "./forms/WaypointForms";
import { openFieldMapMenu } from "./forms/MinimapForms";
import { openInventoryMenu } from "./forms/RecipeForms";
import { openCompanionBridgeMenu } from "./forms/CompanionBridgeForms";
import { getAuditLog } from "../features/optimization/OptimizationEngine";
import { log } from "../util/Logger";
import { showFormWithRetry } from "./FormRuntime";
import { readSelection } from "./FormValidation";

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
  const form = new ActionFormData()
    .title("Hydraulic Control Room")
    .body("Phlodgate Add-On master settings")
    .button("Hydraulic Companion Bridge & Status")
    .button("UI & Inventory / Recipes")
    .button("Waypoints & Compass")
    .button("Field Map / Minimap")
    .button("Player Settings (Food, Durability, HUDs)")
    .button("World Settings (Operator)")
    .button("Optimization Diagnostics")
    .button("About / Unsupported Features");

  try {
    const response = await showFormWithRetry(player, () => form, { context: "Hydraulic Control Room" });
    if (!response) return;
    const selection = readSelection(response);
    if (selection === undefined) return;

    switch (selection) {
      case 0:
        await openCompanionBridgeMenu(player);
        break;
      case 1:
        await openInventoryMenu(player);
        break;
      case 2:
        await openWaypointMenu(player);
        break;
      case 3:
        await openFieldMapMenu(player);
        break;
      case 4:
        await openPlayerSettingsForm(player);
        break;
      case 5:
        await openWorldSettingsForm(player);
        break;
      case 6:
        await openDiagnosticsMenu(player);
        break;
      case 7:
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
