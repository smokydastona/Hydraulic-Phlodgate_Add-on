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

export async function openMachineInspectionForm(player: Player, page = 1, filterQuery?: string): Promise<void> {
  const inspection = inspectPlayerTargetBlock(player, 7);

  if (!inspection) {
    await new MessageFormData()
      .title("Machine Inspection")
      .body("No valid block found in your immediate line of sight (within 7 blocks).\n\n§7Touch / Point directly at a machine block and try again.§r")
      .button1("Retry")
      .button2("Close")
      .show(player)
      .then(async (res) => {
        if (res.selection === 0) {
          await openMachineInspectionForm(player, 1, filterQuery);
        }
      });
    return;
  }

  const occupiedSlots = inspection.slots.filter((s) => s.count > 0);
  const pageSize = 12;
  const filtered = filterQuery && filterQuery.trim().length > 0
    ? occupiedSlots.filter((s) => s.typeId.toLowerCase().includes(filterQuery.toLowerCase()) || (s.nameTag && s.nameTag.toLowerCase().includes(filterQuery.toLowerCase())))
    : occupiedSlots;

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.max(1, Math.min(totalPages, page));

  const paginatedSummary = formatPaginatedInspectionSummary(inspection, currentPage, pageSize, filterQuery);

  const form = new ActionFormData()
    .title(`Inspect: ${inspection.blockTypeId}`)
    .body(paginatedSummary)
    .button("↻ Refresh Live Metrics");

  if (currentPage < totalPages) {
    form.button(`▶ Next Page (${currentPage + 1}/${totalPages})`);
  }
  if (currentPage > 1) {
    form.button(`◀ Previous Page (${currentPage - 1}/${totalPages})`);
  }

  form.button("🔍 Search / Filter Items")
    .button("⚙ Companion Settings")
    .button("✕ Close");

  try {
    const res = await form.show(player);
    if (res.canceled || res.selection === undefined) return;

    let index = 0;
    if (res.selection === index++) {
      // 0: Refresh
      await openMachineInspectionForm(player, currentPage, filterQuery);
      return;
    }

    if (currentPage < totalPages) {
      if (res.selection === index++) {
        // Next page
        await openMachineInspectionForm(player, currentPage + 1, filterQuery);
        return;
      }
    }

    if (currentPage > 1) {
      if (res.selection === index++) {
        // Prev page
        await openMachineInspectionForm(player, currentPage - 1, filterQuery);
        return;
      }
    }

    if (res.selection === index++) {
      // Search
      await openSearchFilterModal(player, inspection, currentPage);
      return;
    }

    if (res.selection === index++) {
      // Companion Settings
      await openCompanionModeConfigForm(player);
      return;
    }
  } catch (err) {
    log(`Machine inspection form failed: ${String(err)}`);
  }
}

async function openSearchFilterModal(player: Player, inspection: any, page: number): Promise<void> {
  const modal = new ModalFormData()
    .title("Search / Filter Container Items")
    .textField("Item Name / Namespace Substring", "e.g. iron, gear, ingot", { defaultValue: "" });

  try {
    const res = await modal.show(player);
    if (res.canceled || !res.formValues) {
      await openMachineInspectionForm(player, 1, undefined);
      return;
    }
    const query = res.formValues[0] as string;
    await openMachineInspectionForm(player, 1, query);
  } catch (err) {
    log(`Search filter modal failed: ${String(err)}`);
  }
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
