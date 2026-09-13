/**
 * Forms for Hydraulic-Phlodgate Companion Bridge & Machine Inspection.
 */
import { ActionFormData, MessageFormData, ModalFormData } from "@minecraft/server-ui";
import { Player } from "@minecraft/server";
import { getCurrentCompanionStatus } from "../../features/companion/CompanionDetector";
import { inspectPlayerTargetBlock } from "../../features/companion/MachineInspectorRuntime";
import { getPlayerSettings, getWorldSettings, updatePlayerSettings, updateWorldSettings } from "../../settings/SettingsStore";
import { isOperator } from "../../settings/Permissions";
import { log } from "../../util/Logger";

const COMPANION_MODES = ["auto", "enabled", "disabled"] as const;

export async function openCompanionBridgeMenu(player: Player): Promise<void> {
  const status = getCurrentCompanionStatus();
  const playerSettings = getPlayerSettings(player);

  const statusColor = status.active ? "§a[ACTIVE]" : "§e[STANDALONE]";
  const detectedText = status.detected ? "§aHydraulic-Phlodgate detected" : "§7No server companion signal";
  const nsList = status.detectedNamespaces.length > 0 ? status.detectedNamespaces.join(", ") : "None";

  const body = [
    `Bridge Status: ${statusColor}`,
    `Detection: ${detectedText}`,
    `Configured Mode: ${playerSettings.companionMode.toUpperCase()}`,
    `Detected Mod Namespaces: §b${nsList}§r`,
    "",
    "Evidence & Diagnostics:",
    ...status.evidence.map((e) => `• ${e}`),
  ].join("\n");

  const form = new ActionFormData()
    .title("Hydraulic Companion Bridge")
    .body(body)
    .button("Inspect Target Machine / Block")
    .button("Configure Companion Mode")
    .button("View Discovered Modded Namespaces")
    .button("Back");

  try {
    const response = await form.show(player);
    if (response.canceled || response.selection === undefined) return;

    switch (response.selection) {
      case 0:
        await openMachineInspectionForm(player);
        break;
      case 1:
        await openCompanionModeConfigForm(player);
        break;
      case 2:
        await openDiscoveredNamespacesForm(player);
        break;
      case 3:
        break;
    }
  } catch (err) {
    log(`Companion bridge menu failed: ${String(err)}`);
  }
}

export async function openMachineInspectionForm(player: Player): Promise<void> {
  const inspection = inspectPlayerTargetBlock(player, 7);

  if (!inspection) {
    await new MessageFormData()
      .title("Machine Inspection")
      .body("No valid block found in your immediate line of sight (within 7 blocks). Look directly at a machine or container and try again.")
      .button1("OK")
      .button2("Close")
      .show(player);
    return;
  }

  await new MessageFormData()
    .title(`Inspect: ${inspection.blockTypeId}`)
    .body(inspection.summaryText)
    .button1("Inspect Another")
    .button2("Close")
    .show(player)
    .then(async (res) => {
      if (res.selection === 0) {
        await openMachineInspectionForm(player);
      }
    });
}

export async function openCompanionModeConfigForm(player: Player): Promise<void> {
  const pSettings = getPlayerSettings(player);
  const isOp = isOperator(player);
  const wSettings = getWorldSettings();

  const form = new ModalFormData()
    .title("Configure Companion Mode")
    .dropdown("Player Companion Mode", ["Auto (Detect Server)", "Force Enabled", "Force Disabled (Pure Standalone)"], {
      defaultValueIndex: COMPANION_MODES.indexOf(pSettings.companionMode),
    });

  if (isOp) {
    form.toggle("Operator: Protect Modded Entities in World", {
      defaultValue: wSettings.protectModdedEntities,
    });
  }

  try {
    const response = await form.show(player);
    if (response.canceled || !response.formValues) return;

    const modeIndex = response.formValues[0] as number;
    const selectedMode = COMPANION_MODES[modeIndex] ?? "auto";

    updatePlayerSettings(player, { companionMode: selectedMode });

    if (isOp && response.formValues.length > 1) {
      const protectModded = response.formValues[1] as boolean;
      updateWorldSettings({ protectModdedEntities: protectModded, companionMode: selectedMode });
    }

    player.sendMessage(`§aCompanion mode set to §e${selectedMode.toUpperCase()}§a.`);
  } catch (err) {
    log(`Companion mode config failed: ${String(err)}`);
  }
}

export async function openDiscoveredNamespacesForm(player: Player): Promise<void> {
  const status = getCurrentCompanionStatus();
  const body =
    status.detectedNamespaces.length === 0
      ? "No external modded namespaces have been detected in the current session."
      : [
          "The following modded namespaces have been detected in your inventory or world:",
          "",
          ...status.detectedNamespaces.map((ns) => `§e• ${ns}§r`),
          "",
          "All items and machine entities matching these namespaces are automatically indexed in the JEI recipe registry and protected from cleanup.",
        ].join("\n");

  await new MessageFormData()
    .title("Discovered Modded Namespaces")
    .body(body)
    .button1("OK")
    .button2("Back")
    .show(player);
}
