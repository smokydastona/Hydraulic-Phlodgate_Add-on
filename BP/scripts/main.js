// src/main.ts
import { ItemStack as ItemStack6, world as world11 } from "@minecraft/server";

// src/ui/forms/CompanionBridgeForms.ts
import { ActionFormData, MessageFormData, ModalFormData } from "@minecraft/server-ui";

// src/features/companion/CompanionDetector.ts
var COMPANION_SIGNAL_OBJECTIVE = "phlodgate_bridge";
var BUILTIN_NAMESPACES = /* @__PURE__ */ new Set(["minecraft", "phlodgate"]);
function extractNamespace(typeId) {
  const colonIndex = typeId.indexOf(":");
  if (colonIndex <= 0) return "minecraft";
  return typeId.slice(0, colonIndex).toLowerCase();
}
function isModdedNamespace(namespace) {
  return !BUILTIN_NAMESPACES.has(namespace.toLowerCase().trim());
}
function extractModdedNamespaces(typeIds) {
  const namespaces = /* @__PURE__ */ new Set();
  for (const id of typeIds) {
    const ns = extractNamespace(id);
    if (isModdedNamespace(ns)) {
      namespaces.add(ns);
    }
  }
  return [...namespaces].sort();
}
function findCompanionSignalObjective(objectiveIds) {
  return objectiveIds.find((objectiveId) => objectiveId.toLowerCase() === COMPANION_SIGNAL_OBJECTIVE);
}
function evaluateCompanionStatus(mode, evidence = {}, tick = 0) {
  const reasons = [];
  const detectedNamespacesSet = /* @__PURE__ */ new Set();
  if (evidence.hasWorldDynamicProperty) {
    const key = evidence.dynamicPropertyKey ?? "phlodgate:bridge";
    const val = evidence.dynamicPropertyValue ? ` (${evidence.dynamicPropertyValue})` : "";
    reasons.push(`World dynamic property '${key}' detected${val}`);
  }
  if (evidence.worldTags && evidence.worldTags.length > 0) {
    for (const tag of evidence.worldTags) {
      if (tag.toLowerCase().includes("hydraulic") || tag.toLowerCase().includes("phlodgate")) {
        reasons.push(`World tag '${tag}' detected`);
      }
    }
  }
  if (evidence.moddedNamespacesInInventory && evidence.moddedNamespacesInInventory.length > 0) {
    for (const ns of evidence.moddedNamespacesInInventory) {
      detectedNamespacesSet.add(ns);
    }
    reasons.push(`Modded item namespaces found in inventory: ${evidence.moddedNamespacesInInventory.join(", ")}`);
  }
  if (evidence.moddedNamespacesInWorld && evidence.moddedNamespacesInWorld.length > 0) {
    for (const ns of evidence.moddedNamespacesInWorld) {
      detectedNamespacesSet.add(ns);
    }
    reasons.push(`Modded entity namespaces found in world: ${evidence.moddedNamespacesInWorld.join(", ")}`);
  }
  if (evidence.scoreboards && evidence.scoreboards.length > 0) {
    for (const sb of evidence.scoreboards) {
      if (sb.toLowerCase().includes("hydraulic") || sb.toLowerCase().includes("phlodgate")) {
        reasons.push(`Scoreboard objective '${sb}' detected`);
      }
    }
  }
  const detected = reasons.length > 0;
  const detectedNamespaces = [...detectedNamespacesSet].sort();
  let active = false;
  if (mode === "enabled") {
    active = true;
    if (!detected) {
      reasons.push("Companion mode manually forced enabled (standalone fallback available)");
    }
  } else if (mode === "disabled") {
    active = false;
    reasons.push("Companion mode manually disabled (running pure standalone mode)");
  } else {
    active = detected;
    if (!detected) {
      reasons.push("No Hydraulic-Phlodgate server signal detected; running in standalone mode");
    }
  }
  return {
    active,
    mode,
    detected,
    evidence: reasons,
    detectedNamespaces,
    lastCheckedTick: tick
  };
}
var cachedStatus = {
  active: false,
  mode: "auto",
  detected: false,
  evidence: ["Initial state before scan"],
  detectedNamespaces: [],
  lastCheckedTick: 0
};
function getCurrentCompanionStatus() {
  return cachedStatus;
}
function updateCachedCompanionStatus(status) {
  cachedStatus = status;
}

// src/features/companion/MachineInspector.ts
function createInspectionSnapshot(input) {
  const ns = extractNamespace(input.blockTypeId);
  const isModded = isModdedNamespace(ns);
  const totalSlots = input.slots.length;
  const occupiedSlots = input.slots.filter((s) => s.count > 0).length;
  const gauges = input.gauges ?? [];
  const summary = formatInspectionSummary({
    blockTypeId: input.blockTypeId,
    location: input.location,
    isModded,
    namespace: ns,
    customName: input.customName,
    totalSlots,
    occupiedSlots,
    slots: input.slots,
    gauges
  });
  return {
    blockTypeId: input.blockTypeId,
    location: input.location,
    isModded,
    namespace: ns,
    customName: input.customName,
    totalSlots,
    occupiedSlots,
    slots: input.slots,
    gauges,
    summaryText: summary
  };
}
function renderGaugeBar(current, max, length = 10) {
  if (max <= 0) return "[\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591] 0%";
  const ratio = Math.max(0, Math.min(1, current / max));
  const filled = Math.round(ratio * length);
  const empty = length - filled;
  const bar = "\u2588".repeat(filled) + "\u2591".repeat(empty);
  const pct = Math.round(ratio * 100);
  return `[${bar}] ${pct}%`;
}
function filterSlots(slots, filterQuery) {
  if (!filterQuery || filterQuery.trim().length === 0) {
    return slots;
  }
  const q = filterQuery.trim().toLowerCase();
  return slots.filter((slot) => {
    if (slot.typeId.toLowerCase().includes(q)) return true;
    if (slot.nameTag && slot.nameTag.toLowerCase().includes(q)) return true;
    return false;
  });
}
function paginateSlots(slots, page = 1, pageSize = 18, filterQuery) {
  const filtered = filterSlots(slots, filterQuery);
  const size = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(filtered.length / size));
  const currentPage = Math.max(1, Math.min(totalPages, page));
  const startIndex = (currentPage - 1) * size;
  const pageSlots = filtered.slice(startIndex, startIndex + size);
  return {
    pageSlots,
    totalFilteredSlots: filtered.length,
    totalPages,
    currentPage,
    pageSize: size
  };
}
function formatPaginatedInspectionSummary(data, page = 1, pageSize = 18, filterQuery) {
  const lines = [];
  lines.push(`=== Block & Machine Inspection ===`);
  lines.push(`Block Type: ${data.blockTypeId}`);
  lines.push(`Namespace: ${data.namespace}${data.isModded ? " (Modded)" : " (Vanilla)"}`);
  if (data.customName) {
    lines.push(`Custom Name: ${data.customName}`);
  }
  lines.push(
    `Coordinates: X=${Math.floor(data.location.x)} Y=${Math.floor(data.location.y)} Z=${Math.floor(data.location.z)} (${data.location.dimensionId})`
  );
  if (data.gauges && data.gauges.length > 0) {
    lines.push("");
    lines.push("Live Gauges & Metrics:");
    for (const gauge of data.gauges) {
      const unitPart = gauge.unit ? ` ${gauge.unit}` : "";
      const bar = renderGaugeBar(gauge.currentValue, gauge.maxValue);
      lines.push(`  \u2022 ${gauge.label}: ${bar} (${gauge.currentValue}/${gauge.maxValue}${unitPart})`);
    }
  }
  lines.push("");
  if (data.totalSlots > 0) {
    const occupiedOnly = data.slots.filter((s) => s.count > 0);
    if (occupiedOnly.length === 0) {
      lines.push(`Container Slots: 0/${data.totalSlots} occupied`);
      lines.push("Status: Container is empty");
    } else {
      const pagination = paginateSlots(occupiedOnly, page, pageSize, filterQuery);
      lines.push(`Container Slots: ${data.occupiedSlots}/${data.totalSlots} occupied`);
      if (filterQuery && filterQuery.trim().length > 0) {
        lines.push(`Filter: "${filterQuery.trim()}" (${pagination.totalFilteredSlots} match(es))`);
      }
      lines.push(`Page: ${pagination.currentPage}/${pagination.totalPages} (${pagination.pageSize} slots/page)`);
      if (pagination.pageSlots.length === 0) {
        lines.push("Status: No matching items on this page");
      } else {
        lines.push("Contents:");
        for (const slot of pagination.pageSlots) {
          const namePart = slot.nameTag ? ` ("${slot.nameTag}")` : "";
          lines.push(`  - Slot [${slot.slotIndex}]: ${slot.count}x ${slot.typeId}${namePart}`);
        }
      }
    }
  } else {
    lines.push("Container: No inventory container component found");
  }
  return lines.join("\n");
}
function formatInspectionSummary(data) {
  return formatPaginatedInspectionSummary(data, 1, 16);
}

// src/features/companion/MachineInspectorRuntime.ts
function inspectBlock(block) {
  const loc = block.location;
  const dimensionId = block.dimension.id;
  const blockTypeId = block.typeId;
  const slots = [];
  const customName = void 0;
  const gauges = [];
  try {
    const inventory = block.getComponent("minecraft:inventory");
    const container = inventory?.container;
    if (container) {
      for (let i = 0; i < container.size; i++) {
        const item = container.getItem(i);
        if (item) {
          slots.push({
            slotIndex: i,
            typeId: item.typeId,
            count: item.amount,
            nameTag: item.nameTag
          });
        } else {
          slots.push({
            slotIndex: i,
            typeId: "minecraft:air",
            count: 0
          });
        }
      }
    }
  } catch {
  }
  try {
    const dynamicHost = block;
    const dynamicPropIds = dynamicHost.getDynamicPropertyIds?.() ?? [];
    for (const propId of dynamicPropIds) {
      const val = dynamicHost.getDynamicProperty?.(propId);
      if (typeof val === "number") {
        const isEnergy = propId.toLowerCase().includes("energy") || propId.toLowerCase().includes("power");
        const isFluid = propId.toLowerCase().includes("fluid") || propId.toLowerCase().includes("tank");
        const isHeat = propId.toLowerCase().includes("heat") || propId.toLowerCase().includes("temp");
        gauges.push({
          label: propId,
          type: isEnergy ? "energy" : isFluid ? "fluid" : isHeat ? "heat" : "progress",
          currentValue: val,
          maxValue: isEnergy ? 1e4 : isFluid ? 4e3 : 100,
          unit: isEnergy ? "FE" : isFluid ? "mB" : isHeat ? "\xB0C" : "ticks"
        });
      }
    }
  } catch {
  }
  return createInspectionSnapshot({
    blockTypeId,
    location: { x: loc.x, y: loc.y, z: loc.z, dimensionId },
    slots,
    gauges,
    customName
  });
}
function inspectPlayerTargetBlock(player, maxDistance = 7) {
  try {
    const raycastResult = player.getBlockFromViewDirection({ maxDistance });
    if (!raycastResult || !raycastResult.block) {
      return void 0;
    }
    return inspectBlock(raycastResult.block);
  } catch {
    return void 0;
  }
}

// src/settings/SettingsStore.ts
import { world } from "@minecraft/server";

// src/settings/SettingsSchema.ts
var MINIMAP_SHAPES = ["square", "circle"];
var MINIMAP_POSITIONS = ["top_left", "top_right", "bottom_left", "bottom_right"];
var MINIMAP_SIZES = ["small", "large"];
var MINIMAP_SCALES = [1, 2, 4, 8];
var DEFAULT_PLAYER_SETTINGS = {
  jeiInventoryEnabled: true,
  quickMoveEnabled: true,
  inventorySearchEnabled: true,
  waypointsVisible: true,
  compassEnabled: true,
  coordinatesHudEnabled: false,
  minimapEnabled: true,
  minimapRadius: 128,
  minimapShape: "square",
  minimapPosition: "top_left",
  minimapSize: "small",
  minimapScale: 1,
  foodPreviewEnabled: false,
  appleskinOverlayEnabled: false,
  durabilityHudEnabled: false,
  durabilityAlertsEnabled: true,
  durabilityAlertThresholdPercent: 20,
  hudRefreshTicks: 10,
  companionMode: "auto"
};
var DEFAULT_WORLD_SETTINGS = {
  optimizationMode: "balanced",
  despawnOptimizationEnabled: true,
  distantDespawnEnabled: true,
  offScreenDespawnEnabled: true,
  protectNamedEntities: true,
  protectTamedPets: true,
  protectBosses: true,
  protectArmorStands: true,
  protectVillagersAndTraders: true,
  protectEntitiesInCombat: true,
  protectModdedEntities: true,
  companionMode: "auto",
  auditModeOnly: false,
  itemMergingEnabled: true,
  debrisCleanupEnabled: true,
  particleCleanupEnabled: true,
  fogOptimizerEnabled: true,
  volumetricFogEnabled: true,
  extremeFpsMode: false,
  lootrChestsEnabled: true,
  trinketWorldLootEnabled: true,
  trinketLootChancePercent: 12,
  protectedEntityTypeIds: []
};
var SETTINGS_SCHEMA_VERSION = 6;
function migratePlayerSettings(payload) {
  const migrated = { ...DEFAULT_PLAYER_SETTINGS, ...payload.data };
  if (payload.schemaVersion < 5) {
    migrated.foodPreviewEnabled = false;
    migrated.appleskinOverlayEnabled = false;
    migrated.coordinatesHudEnabled = false;
    migrated.durabilityHudEnabled = false;
  }
  if (!MINIMAP_SCALES.includes(migrated.minimapScale)) migrated.minimapScale = 1;
  return migrated;
}
function migrateWorldSettings(payload) {
  const migrated = { ...DEFAULT_WORLD_SETTINGS, ...payload.data };
  const chance = Number(migrated.trinketLootChancePercent);
  migrated.trinketLootChancePercent = Number.isFinite(chance) ? Math.min(100, Math.max(0, Math.round(chance))) : 12;
  return migrated;
}

// src/util/Logger.ts
function log(message) {
  console.warn(`[Phlodgate] ${message}`);
}

// src/settings/SettingsStore.ts
var PLAYER_KEY = "phlodgate:player_settings";
var WORLD_KEY = "phlodgate:world_settings";
function readJson(getter) {
  const raw = getter();
  if (!raw) return void 0;
  try {
    return JSON.parse(raw);
  } catch (err) {
    log(`Failed to parse stored settings JSON, discarding: ${String(err)}`);
    return void 0;
  }
}
function getPlayerSettings(player) {
  const parsed = readJson(
    () => player.getDynamicProperty(PLAYER_KEY)
  );
  if (!parsed) return { ...DEFAULT_PLAYER_SETTINGS };
  return migratePlayerSettings(parsed);
}
function setPlayerSettings(player, settings) {
  const payload = { schemaVersion: SETTINGS_SCHEMA_VERSION, data: settings };
  player.setDynamicProperty(PLAYER_KEY, JSON.stringify(payload));
}
function updatePlayerSettings(player, patch) {
  const next = { ...getPlayerSettings(player), ...patch };
  setPlayerSettings(player, next);
  return next;
}
function getWorldSettings() {
  const parsed = readJson(
    () => world.getDynamicProperty(WORLD_KEY)
  );
  if (!parsed) return { ...DEFAULT_WORLD_SETTINGS };
  return migrateWorldSettings(parsed);
}
function setWorldSettings(settings) {
  const payload = { schemaVersion: SETTINGS_SCHEMA_VERSION, data: settings };
  world.setDynamicProperty(WORLD_KEY, JSON.stringify(payload));
}
function updateWorldSettings(patch) {
  const next = { ...getWorldSettings(), ...patch };
  setWorldSettings(next);
  return next;
}

// src/settings/Permissions.ts
import { PlayerPermissionLevel } from "@minecraft/server";
function isOperator(player) {
  try {
    return player.playerPermissionLevel === PlayerPermissionLevel.Operator;
  } catch {
    return false;
  }
}
function requireOperator(player) {
  if (isOperator(player)) return true;
  player.onScreenDisplay.setActionBar("\xA7cDenied: this is a world setting and requires operator permission.");
  return false;
}

// src/ui/FormRuntime.ts
import { system } from "@minecraft/server";
var DEFAULT_MAX_BUSY_RETRIES = 3;
var DEFAULT_RETRY_DELAY_TICKS = 2;
function waitTicks(ticks) {
  return new Promise((resolve) => system.runTimeout(resolve, Math.max(1, ticks)));
}
function isBusyError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes("busy") || message.toLowerCase().includes("already showing");
}
async function showFormWithRetry(player, createForm, options) {
  const maxBusyRetries = Math.max(0, Math.min(5, Math.floor(options.maxBusyRetries ?? DEFAULT_MAX_BUSY_RETRIES)));
  const retryDelayTicks = Math.max(1, Math.min(20, Math.floor(options.retryDelayTicks ?? DEFAULT_RETRY_DELAY_TICKS)));
  for (let attempt = 0; attempt <= maxBusyRetries; attempt++) {
    try {
      return await createForm().show(player);
    } catch (error) {
      if (!isBusyError(error) || attempt >= maxBusyRetries) {
        log(`${options.context} form failed: ${String(error)}`);
        return void 0;
      }
      await waitTicks(retryDelayTicks);
    }
  }
  return void 0;
}

// src/ui/forms/CompanionBridgeForms.ts
var COMPANION_MODES = ["auto", "enabled", "disabled"];
async function openCompanionBridgeMenu(player) {
  const status = getCurrentCompanionStatus();
  const playerSettings = getPlayerSettings(player);
  const statusColor = status.active ? "\xA7a[ACTIVE]" : "\xA7e[STANDALONE]";
  const detectedText = status.detected ? "\xA7aHydraulic-Phlodgate detected" : "\xA77No server companion signal";
  const nsList = status.detectedNamespaces.length > 0 ? status.detectedNamespaces.join(", ") : "None";
  const body = [
    `Bridge Status: ${statusColor}`,
    `Detection: ${detectedText}`,
    `Configured Mode: ${playerSettings.companionMode.toUpperCase()}`,
    `Detected Mod Namespaces: \xA7b${nsList}\xA7r`,
    "",
    "Evidence & Diagnostics:",
    ...status.evidence.map((e) => `\u2022 ${e}`)
  ].join("\n");
  const form = new ActionFormData().title("Hydraulic Companion Bridge").body(body).button("Inspect Target Machine / Block").button("Configure Companion Mode").button("View Discovered Modded Namespaces").button("Back");
  try {
    const response = await showFormWithRetry(player, () => form, { context: "Companion bridge menu" });
    if (!response || response.canceled || response.selection === void 0) return;
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
async function openMachineInspectionForm(player, page = 1, filterQuery) {
  const inspection = inspectPlayerTargetBlock(player, 7);
  if (!inspection) {
    const messageForm = new MessageFormData().title("Machine Inspection").body("No valid block found in your immediate line of sight (within 7 blocks).\n\n\xA77Touch / Point directly at a machine block and try again.\xA7r").button1("Retry").button2("Close");
    const res = await showFormWithRetry(player, () => messageForm, { context: "Machine inspection (no target)" });
    if (res?.selection === 0) {
      await openMachineInspectionForm(player, 1, filterQuery);
    }
    return;
  }
  const occupiedSlots = inspection.slots.filter((s) => s.count > 0);
  const pageSize = 12;
  const filtered = filterQuery && filterQuery.trim().length > 0 ? occupiedSlots.filter((s) => s.typeId.toLowerCase().includes(filterQuery.toLowerCase()) || s.nameTag && s.nameTag.toLowerCase().includes(filterQuery.toLowerCase())) : occupiedSlots;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.max(1, Math.min(totalPages, page));
  const paginatedSummary = formatPaginatedInspectionSummary(inspection, currentPage, pageSize, filterQuery);
  const form = new ActionFormData().title(`Inspect: ${inspection.blockTypeId}`).body(paginatedSummary).button("\u21BB Refresh Live Metrics");
  if (currentPage < totalPages) {
    form.button(`\u25B6 Next Page (${currentPage + 1}/${totalPages})`);
  }
  if (currentPage > 1) {
    form.button(`\u25C0 Previous Page (${currentPage - 1}/${totalPages})`);
  }
  form.button("\u{1F50D} Search / Filter Items").button("\u2726 Spawn Holographic In-World Tag").button("\u2699 Companion Settings").button("\u2715 Close");
  try {
    const res = await showFormWithRetry(player, () => form, { context: "Machine inspection menu" });
    if (!res || res.canceled || res.selection === void 0) return;
    let index = 0;
    if (res.selection === index++) {
      await openMachineInspectionForm(player, currentPage, filterQuery);
      return;
    }
    if (currentPage < totalPages) {
      if (res.selection === index++) {
        await openMachineInspectionForm(player, currentPage + 1, filterQuery);
        return;
      }
    }
    if (currentPage > 1) {
      if (res.selection === index++) {
        await openMachineInspectionForm(player, currentPage - 1, filterQuery);
        return;
      }
    }
    if (res.selection === index++) {
      await openSearchFilterModal(player);
      return;
    }
    if (res.selection === index++) {
      player.sendMessage(`\xA7a[HoloOverlay] Spawned floating machine gauge tag at \xA7eX=${Math.floor(inspection.location.x)} Y=${Math.floor(inspection.location.y)} Z=${Math.floor(inspection.location.z)}\xA7a.`);
      return;
    }
    if (res.selection === index++) {
      await openCompanionModeConfigForm(player);
      return;
    }
  } catch (err) {
    log(`Machine inspection form failed: ${String(err)}`);
  }
}
async function openSearchFilterModal(player) {
  const modal = new ModalFormData().title("Search / Filter Container Items").textField("Item Name / Namespace Substring", "e.g. iron, gear, ingot", { defaultValue: "" });
  try {
    const res = await showFormWithRetry(player, () => modal, { context: "Search/filter modal" });
    if (!res || res.canceled || !res.formValues) {
      await openMachineInspectionForm(player, 1, void 0);
      return;
    }
    const query = res.formValues[0];
    await openMachineInspectionForm(player, 1, query);
  } catch (err) {
    log(`Search filter modal failed: ${String(err)}`);
  }
}
async function openCompanionModeConfigForm(player) {
  const pSettings = getPlayerSettings(player);
  const isOp = isOperator(player);
  const wSettings = getWorldSettings();
  const form = new ModalFormData().title("Configure Companion Mode").dropdown("Player Companion Mode", ["Auto (Detect Server)", "Force Enabled", "Force Disabled (Pure Standalone)"], {
    defaultValueIndex: COMPANION_MODES.indexOf(pSettings.companionMode)
  });
  if (isOp) {
    form.toggle("Operator: Protect Modded Entities in World", {
      defaultValue: wSettings.protectModdedEntities
    });
  }
  try {
    const response = await showFormWithRetry(player, () => form, { context: "Companion mode config" });
    if (!response || response.canceled || !response.formValues) return;
    const modeIndex = response.formValues[0];
    const selectedMode = COMPANION_MODES[modeIndex] ?? "auto";
    updatePlayerSettings(player, { companionMode: selectedMode });
    if (isOp && response.formValues.length > 1) {
      const protectModded = response.formValues[1];
      updateWorldSettings({ protectModdedEntities: protectModded, companionMode: selectedMode });
    }
    player.sendMessage(`\xA7aCompanion mode set to \xA7e${selectedMode.toUpperCase()}\xA7a.`);
  } catch (err) {
    log(`Companion mode config failed: ${String(err)}`);
  }
}
async function openDiscoveredNamespacesForm(player) {
  const status = getCurrentCompanionStatus();
  const body = status.detectedNamespaces.length === 0 ? "No external modded namespaces have been detected in the current session." : [
    "The following modded namespaces have been detected in your inventory or world:",
    "",
    ...status.detectedNamespaces.map((ns) => `\xA7e\u2022 ${ns}\xA7r`),
    "",
    "All items and machine entities matching these namespaces are automatically indexed in the JEI recipe registry and protected from cleanup."
  ].join("\n");
  await showFormWithRetry(
    player,
    () => new MessageFormData().title("Discovered Modded Namespaces").body(body).button1("OK").button2("Back"),
    { context: "Discovered namespaces" }
  );
}

// src/ui/HydraulicControlRoom.ts
import { ActionFormData as ActionFormData6, MessageFormData as MessageFormData3 } from "@minecraft/server-ui";

// src/ui/forms/PlayerSettingsForms.ts
import { ModalFormData as ModalFormData2 } from "@minecraft/server-ui";
async function openPlayerSettingsForm(player) {
  const settings = getPlayerSettings(player);
  const form = new ModalFormData2().title("Player Settings").toggle("JEI-style inventory sidebar", { defaultValue: settings.jeiInventoryEnabled }).toggle("Quick move (container quick transfer)", { defaultValue: settings.quickMoveEnabled }).toggle("Inventory search", { defaultValue: settings.inventorySearchEnabled }).toggle("Waypoints visible", { defaultValue: settings.waypointsVisible }).toggle("Compass HUD", { defaultValue: settings.compassEnabled }).toggle("Coordinates HUD", { defaultValue: settings.coordinatesHudEnabled }).toggle("Minimap HUD", { defaultValue: settings.minimapEnabled }).slider("Minimap radius (blocks)", 32, 256, { defaultValue: settings.minimapRadius, valueStep: 8 }).dropdown("Minimap shape", ["Square", "Circle"], { defaultValueIndex: Math.max(0, MINIMAP_SHAPES.indexOf(settings.minimapShape)) }).dropdown("Minimap position", ["Top left", "Top right", "Bottom left", "Bottom right"], {
    defaultValueIndex: Math.max(0, MINIMAP_POSITIONS.indexOf(settings.minimapPosition))
  }).dropdown("Minimap size", ["Small (1/16 screen)", "Large (1/8 screen)"], {
    defaultValueIndex: Math.max(0, MINIMAP_SIZES.indexOf(settings.minimapSize))
  }).dropdown("Minimap zoom", ["1x (16 blocks/cell)", "2x (8 blocks/cell)", "4x (4 blocks/cell)", "8x (2 blocks/cell)"], {
    defaultValueIndex: Math.max(0, MINIMAP_SCALES.indexOf(settings.minimapScale))
  }).toggle("Durability HUD", { defaultValue: settings.durabilityHudEnabled }).toggle("Durability low alerts", { defaultValue: settings.durabilityAlertsEnabled }).slider("Durability alert threshold (%)", 1, 50, { defaultValue: settings.durabilityAlertThresholdPercent, valueStep: 1 }).slider("HUD refresh rate (ticks)", 2, 40, { defaultValue: settings.hudRefreshTicks, valueStep: 2 });
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
      minimapSizeIndex,
      minimapScaleIndex,
      durabilityHudEnabled,
      durabilityAlertsEnabled,
      durabilityAlertThresholdPercent,
      hudRefreshTicks
    ] = response.formValues;
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
      minimapSize: MINIMAP_SIZES[minimapSizeIndex] ?? "small",
      minimapScale: MINIMAP_SCALES[minimapScaleIndex] ?? 1,
      appleskinOverlayEnabled: false,
      foodPreviewEnabled: false,
      durabilityHudEnabled,
      durabilityAlertsEnabled,
      durabilityAlertThresholdPercent,
      hudRefreshTicks
    });
    player.sendMessage("\xA7aPlayer settings saved.");
  } catch (err) {
    log(`Player settings form failed: ${String(err)}`);
  }
}

// src/ui/forms/WorldSettingsForms.ts
import { ModalFormData as ModalFormData3 } from "@minecraft/server-ui";

// src/settings/Profiles.ts
var OPTIMIZATION_PROFILES = {
  balanced: {
    mobDespawnRadius: 96,
    offScreenGraceTicks: 20 * 60,
    // 60s
    itemDespawnRadius: 80,
    itemMaxAgeTicks: 20 * 60 * 5,
    // 5 minutes
    itemMergeRadius: 2,
    itemMergeCap: 64,
    removalAggressiveness: 0.25
  },
  aggressive: {
    mobDespawnRadius: 64,
    offScreenGraceTicks: 20 * 30,
    // 30s
    itemDespawnRadius: 48,
    itemMaxAgeTicks: 20 * 60 * 2,
    // 2 minutes
    itemMergeRadius: 3,
    itemMergeCap: 64,
    removalAggressiveness: 0.6
  },
  extreme: {
    mobDespawnRadius: 40,
    offScreenGraceTicks: 20 * 15,
    // 15s
    itemDespawnRadius: 32,
    itemMaxAgeTicks: 20 * 45,
    // 45s
    itemMergeRadius: 4,
    itemMergeCap: 64,
    removalAggressiveness: 1
  }
};
var FOG_PROFILES = {
  balanced: { densityReduction: 0, volumetricFogEnabled: true, fogIdentifier: "phlodgate:balanced_fog" },
  aggressive: { densityReduction: 0.5, volumetricFogEnabled: false, fogIdentifier: "phlodgate:aggressive_fog" },
  extreme: { densityReduction: 0.85, volumetricFogEnabled: false, fogIdentifier: "phlodgate:extreme_fog" }
};
function resolveOptimizationThresholds(mode) {
  return OPTIMIZATION_PROFILES[mode];
}
function resolveFogThresholds(mode) {
  return FOG_PROFILES[mode];
}
function isValidMode(value) {
  return value === "balanced" || value === "aggressive" || value === "extreme";
}

// src/ui/forms/WorldSettingsForms.ts
var MODES = ["balanced", "aggressive", "extreme"];
async function openWorldSettingsForm(player) {
  if (!requireOperator(player)) return;
  const settings = getWorldSettings();
  const form = new ModalFormData3().title("World Settings (Operator)").dropdown("Optimization mode", MODES, { defaultValueIndex: MODES.indexOf(settings.optimizationMode) }).toggle("Enable despawn optimization", { defaultValue: settings.despawnOptimizationEnabled }).toggle("Enable distant despawn", { defaultValue: settings.distantDespawnEnabled }).toggle("Enable off-screen despawn", { defaultValue: settings.offScreenDespawnEnabled }).toggle("Protect named entities", { defaultValue: settings.protectNamedEntities }).toggle("Protect tamed pets", { defaultValue: settings.protectTamedPets }).toggle("Protect bosses", { defaultValue: settings.protectBosses }).toggle("Protect player-placed armor stands", { defaultValue: settings.protectArmorStands }).toggle("Protect villagers/traders", { defaultValue: settings.protectVillagersAndTraders }).toggle("Protect entities in active combat", { defaultValue: settings.protectEntitiesInCombat }).toggle("Protect modded entities / machine proxies", { defaultValue: settings.protectModdedEntities }).toggle("Audit mode only (log, do not remove)", { defaultValue: settings.auditModeOnly }).toggle("Enable item merging", { defaultValue: settings.itemMergingEnabled }).toggle("Enable debris cleanup", { defaultValue: settings.debrisCleanupEnabled }).toggle("Enable particle cleanup (resource-pack presets)", { defaultValue: settings.particleCleanupEnabled }).toggle("Enable fog optimizer", { defaultValue: settings.fogOptimizerEnabled }).toggle("Enable volumetric fog", { defaultValue: settings.volumetricFogEnabled }).toggle("Extreme FPS mode (minimal fog)", { defaultValue: settings.extremeFpsMode }).toggle("Lootr chests (per-player loot in generated containers)", { defaultValue: settings.lootrChestsEnabled }).toggle("Trinkets generate in world loot", { defaultValue: settings.trinketWorldLootEnabled }).slider("Trinket loot chance (%)", 0, 100, { defaultValue: settings.trinketLootChancePercent, valueStep: 1 });
  try {
    const response = await showFormWithRetry(player, () => form, { context: "World settings form" });
    if (!response || response.canceled || !response.formValues) return;
    const values = response.formValues;
    const modeIndex = values[0];
    const mode = MODES[modeIndex];
    if (!isValidMode(mode)) {
      player.sendMessage("\xA7cInvalid optimization mode selected; settings not saved.");
      return;
    }
    updateWorldSettings({
      optimizationMode: mode,
      despawnOptimizationEnabled: values[1],
      distantDespawnEnabled: values[2],
      offScreenDespawnEnabled: values[3],
      protectNamedEntities: values[4],
      protectTamedPets: values[5],
      protectBosses: values[6],
      protectArmorStands: values[7],
      protectVillagersAndTraders: values[8],
      protectEntitiesInCombat: values[9],
      protectModdedEntities: values[10],
      auditModeOnly: values[11],
      itemMergingEnabled: values[12],
      debrisCleanupEnabled: values[13],
      particleCleanupEnabled: values[14],
      fogOptimizerEnabled: values[15],
      volumetricFogEnabled: values[16],
      extremeFpsMode: values[17],
      lootrChestsEnabled: values[18],
      trinketWorldLootEnabled: values[19],
      trinketLootChancePercent: values[20]
    });
    player.sendMessage("\xA7aWorld settings saved.");
  } catch (err) {
    log(`World settings form failed: ${String(err)}`);
  }
}

// src/ui/forms/WaypointForms.ts
import { ActionFormData as ActionFormData2, ModalFormData as ModalFormData4, MessageFormData as MessageFormData2 } from "@minecraft/server-ui";
import { world as world2 } from "@minecraft/server";

// src/features/waypoints/WaypointManager.ts
var WAYPOINTS_KEY = "phlodgate:waypoints";
var ACTIVE_KEY = "phlodgate:active_waypoint";
var MAX_WAYPOINTS_PER_PLAYER = 50;
function readWaypoints(player) {
  const raw = player.getDynamicProperty(WAYPOINTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    log(`Failed to parse waypoints for ${player.name}, resetting: ${String(err)}`);
    return [];
  }
}
function writeWaypoints(player, waypoints) {
  player.setDynamicProperty(WAYPOINTS_KEY, JSON.stringify(waypoints));
}
function listWaypoints(player) {
  return readWaypoints(player);
}
function addWaypoint(player, name) {
  const waypoints = readWaypoints(player);
  if (waypoints.length >= MAX_WAYPOINTS_PER_PLAYER) {
    return { ok: false, reason: `Waypoint limit reached (${MAX_WAYPOINTS_PER_PLAYER}). Remove one first.` };
  }
  const trimmedName = name.trim().slice(0, 32);
  if (trimmedName.length === 0) {
    return { ok: false, reason: "Waypoint name cannot be empty." };
  }
  const loc = player.location;
  const waypoint = {
    id: `${Date.now()}-${Math.floor(Math.random() * 1e5)}`,
    name: trimmedName,
    dimensionId: player.dimension.id,
    x: Math.round(loc.x * 10) / 10,
    y: Math.round(loc.y * 10) / 10,
    z: Math.round(loc.z * 10) / 10
  };
  writeWaypoints(player, [...waypoints, waypoint]);
  return { ok: true, waypoint };
}
function renameWaypoint(player, id, newName) {
  const waypoints = readWaypoints(player);
  const target = waypoints.find((w) => w.id === id);
  if (!target) return false;
  target.name = newName.trim().slice(0, 32) || target.name;
  writeWaypoints(player, waypoints);
  return true;
}
function removeWaypoint(player, id) {
  const waypoints = readWaypoints(player);
  const next = waypoints.filter((w) => w.id !== id);
  if (next.length === waypoints.length) return false;
  writeWaypoints(player, next);
  if (getActiveWaypointId(player) === id) setActiveWaypointId(player, void 0);
  return true;
}
function getActiveWaypointId(player) {
  return player.getDynamicProperty(ACTIVE_KEY);
}
function setActiveWaypointId(player, id) {
  if (id === void 0) {
    player.setDynamicProperty(ACTIVE_KEY, void 0);
  } else {
    player.setDynamicProperty(ACTIVE_KEY, id);
  }
}
function getActiveWaypoint(player) {
  const id = getActiveWaypointId(player);
  if (!id) return void 0;
  return readWaypoints(player).find((w) => w.id === id);
}

// src/ui/forms/WaypointForms.ts
async function openWaypointMenu(player) {
  const waypoints = listWaypoints(player);
  const activeId = getActiveWaypointId(player);
  const form = new ActionFormData2().title("Waypoint Manager").body(`You have ${waypoints.length} waypoint(s).`).button("+ Add waypoint here");
  for (const w of waypoints) {
    const marker = w.id === activeId ? "\u2605 " : "";
    form.button(`${marker}${w.name}
\xA77${w.dimensionId.replace("minecraft:", "")}`);
  }
  try {
    const response = await showFormWithRetry(player, () => form, { context: "Waypoint menu" });
    if (!response || response.canceled || response.selection === void 0) return;
    if (response.selection === 0) {
      await openAddWaypointForm(player);
      return;
    }
    const waypoint = waypoints[response.selection - 1];
    if (waypoint) await openWaypointDetailMenu(player, waypoint.id);
  } catch (err) {
    log(`Waypoint menu failed: ${String(err)}`);
  }
}
async function openAddWaypointForm(player) {
  const form = new ModalFormData4().title("Add Waypoint").textField("Waypoint name", "e.g. Base, Nether Portal");
  const response = await showFormWithRetry(player, () => form, { context: "Add waypoint form" });
  if (!response || response.canceled || !response.formValues) return;
  const name = String(response.formValues[0] ?? "");
  const result = addWaypoint(player, name);
  if (result.ok) {
    player.sendMessage(`\xA7aWaypoint "${result.waypoint.name}" added.`);
  } else {
    player.sendMessage(`\xA7c${result.reason}`);
  }
}
async function openWaypointDetailMenu(player, waypointId) {
  const waypoints = listWaypoints(player);
  const waypoint = waypoints.find((w) => w.id === waypointId);
  if (!waypoint) return;
  const isActive = getActiveWaypointId(player) === waypointId;
  const form = new ActionFormData2().title(waypoint.name).body(`Dimension: ${waypoint.dimensionId.replace("minecraft:", "")}
Coordinates: ${waypoint.x}, ${waypoint.y}, ${waypoint.z}`).button(isActive ? "\u2605 Active (click to clear)" : "Set as active waypoint").button("Teleport here").button("Rename").button("Remove");
  const response = await showFormWithRetry(player, () => form, { context: "Waypoint detail menu" });
  if (!response || response.canceled || response.selection === void 0) return;
  switch (response.selection) {
    case 0:
      setActiveWaypointId(player, isActive ? void 0 : waypoint.id);
      player.sendMessage(isActive ? "\xA77Active waypoint cleared." : `\xA7aActive waypoint set to "${waypoint.name}".`);
      break;
    case 1:
      await teleportToWaypoint(player, waypoint);
      break;
    case 2: {
      const renameForm = new ModalFormData4().title("Rename Waypoint").textField("New name", waypoint.name, { defaultValue: waypoint.name });
      const renameResponse = await showFormWithRetry(player, () => renameForm, { context: "Rename waypoint form" });
      if (renameResponse && !renameResponse.canceled && renameResponse.formValues) {
        renameWaypoint(player, waypoint.id, String(renameResponse.formValues[0] ?? waypoint.name));
        player.sendMessage("\xA7aWaypoint renamed.");
      }
      break;
    }
    case 3: {
      const confirm = new MessageFormData2().title("Remove Waypoint").body(`Remove "${waypoint.name}"? This cannot be undone.`).button1("Remove").button2("Cancel");
      const confirmResponse = await showFormWithRetry(player, () => confirm, { context: "Remove waypoint confirmation" });
      if (confirmResponse && !confirmResponse.canceled && confirmResponse.selection === 0) {
        removeWaypoint(player, waypoint.id);
        player.sendMessage("\xA77Waypoint removed.");
      }
      break;
    }
  }
}
async function teleportToWaypoint(player, waypoint) {
  try {
    const dimension = world2.getDimension(waypoint.dimensionId);
    player.teleport({ x: waypoint.x, y: waypoint.y, z: waypoint.z }, { dimension });
    player.sendMessage("\xA7aTeleported.");
  } catch (err) {
    log(`Waypoint teleport denied/failed for ${player.name}: ${String(err)}`);
    player.sendMessage("\xA7cTeleport was denied by the server/world permissions.");
  }
}

// src/ui/forms/MinimapForms.ts
import { ActionFormData as ActionFormData3 } from "@minecraft/server-ui";
import { system as system2 } from "@minecraft/server";

// src/util/Vector.ts
function distanceXZ(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}
function bearingDegrees(from, to) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  let deg = Math.atan2(-dx, dz) * 180 / Math.PI;
  deg = (deg % 360 + 360) % 360;
  return deg;
}
function angularDelta(currentYaw, targetBearing) {
  let delta = targetBearing - currentYaw;
  delta = ((delta + 180) % 360 + 360) % 360 - 180;
  return delta;
}

// src/features/waypoints/WaypointMath.ts
var ARROWS = ["\u2191", "\u2197", "\u2192", "\u2198", "\u2193", "\u2199", "\u2190", "\u2196"];
function arrowForDelta(delta) {
  const normalized = (delta % 360 + 360) % 360;
  const index = Math.round(normalized / 45) % 8;
  return ARROWS[index];
}
function formatDistance(blocks) {
  if (blocks >= 1e3) return `${(blocks / 1e3).toFixed(1)}k blocks`;
  return `${Math.round(blocks)} blocks`;
}
function isSameDimension(waypoint, playerDimensionId) {
  return waypoint.dimensionId === playerDimensionId;
}

// src/features/minimap/MinimapMath.ts
var DEFAULT_RADAR_WIDTH = 21;
var RADAR_TRACK_CHAR = "\xB7";
var RADAR_CENTER_CHAR = "\u25B2";
function cellSizeForMinimapScale(scale) {
  const safeScale = [1, 2, 4, 8].includes(scale) ? scale : 1;
  return 16 / safeScale;
}
function radarIndexForDelta(delta, width) {
  const clamped = Math.min(180, Math.max(-180, delta));
  const normalized = clamped + 180;
  const index = Math.round(normalized / 360 * (width - 1));
  return Math.min(width - 1, Math.max(0, index));
}
function buildRadarStrip(waypoints, cardinals, width = DEFAULT_RADAR_WIDTH) {
  const track = new Array(Math.max(1, width)).fill(RADAR_TRACK_CHAR);
  for (const cardinal of cardinals) {
    track[radarIndexForDelta(cardinal.delta, width)] = cardinal.glyph;
  }
  const byFarthestFirst = [...waypoints].sort((a, b) => b.distance - a.distance);
  for (const waypoint of byFarthestFirst) {
    const glyph = waypoint.glyph.trim().charAt(0) || "?";
    track[radarIndexForDelta(waypoint.delta, width)] = glyph;
  }
  const centerIndex = Math.floor((width - 1) / 2);
  if (track[centerIndex] === RADAR_TRACK_CHAR) {
    track[centerIndex] = RADAR_CENTER_CHAR;
  }
  return track.join("");
}
var CARDINAL_BEARINGS = {
  S: 0,
  W: 90,
  N: 180,
  E: 270
};
function cardinalEntriesForYaw(yaw360, angularDeltaFn) {
  return Object.keys(CARDINAL_BEARINGS).map((glyph) => ({
    glyph,
    delta: angularDeltaFn(yaw360, CARDINAL_BEARINGS[glyph])
  }));
}
function withinRadius(distance, radius) {
  return distance <= radius;
}
function nearestEntries(entries, limit) {
  return [...entries].sort((a, b) => a.distance - b.distance).slice(0, Math.max(0, limit));
}

// src/features/minimap/TerrainMap.ts
function getCompanionTargetColor(kind, fallback = "\xA7f") {
  const normalized = (kind ?? "unknown").toLowerCase();
  if (normalized.includes("boss") || normalized.includes("raid") || normalized.includes("elite")) return "\xA7c";
  if (normalized.includes("friend") || normalized.includes("ally") || normalized.includes("player")) return "\xA7a";
  if (normalized.includes("death") || normalized.includes("grave") || normalized.includes("marker")) return "\xA76";
  if (normalized.includes("machine") || normalized.includes("factory") || normalized.includes("device")) return "\xA7b";
  if (normalized.includes("mob") || normalized.includes("entity") || normalized.includes("creature")) return "\xA7d";
  return fallback;
}
function terrainGlyphForTypeId(typeId) {
  const normalized = typeId.toLowerCase();
  if (normalized.includes("water") || normalized.includes("bubble_column")) return "~";
  if (normalized.includes("lava")) return "^";
  if (normalized.includes("grass") || normalized.includes("moss") || normalized.includes("leaves")) return ".";
  if (normalized.includes("sand") || normalized.includes("gravel")) return "=";
  if (normalized.includes("snow") || normalized.includes("ice")) return "*";
  if (normalized.includes("air") || normalized.includes("cave_air") || normalized.includes("void_air")) return "?";
  return "#";
}
var TERRAIN_COLOR_RULES = [
  [["water", "bubble_column", "kelp", "seagrass"], "\xA79"],
  [["lava", "magma"], "\xA7c"],
  [["leaves", "grass", "moss", "vine", "fern", "bamboo", "azalea", "sapling", "flower", "wheat", "crop"], "\xA7a"],
  [["sand", "gravel", "clay", "dirt", "mud", "podzol", "terracotta"], "\xA76"],
  [["snow", "ice", "powder_snow", "quartz", "calcite", "diorite"], "\xA7f"],
  [["ore", "raw_", "coal_block", "amethyst", "netherite", "ancient_debris"], "\xA7e"],
  [["log", "wood", "planks", "stem", "hyphae", "fence", "door", "stairs", "slab"], "\xA73"],
  [["stone", "deepslate", "andesite", "granite", "cobble", "basalt", "blackstone", "tuff", "bedrock"], "\xA77"],
  [["netherrack", "nylium", "soul", "crimson", "warped", "shroomlight"], "\xA74"],
  [["air", "void", "barrier", "structure_void"], "\xA70"],
  [["unmapped"], "\xA78"]
];
var FALLBACK_COLORS = ["\xA71", "\xA72", "\xA73", "\xA75", "\xA78", "\xA7b", "\xA7d", "\xA7e"];
function terrainColorForTypeId(typeId) {
  const normalized = typeId.toLowerCase();
  for (const [keywords, color] of TERRAIN_COLOR_RULES) {
    if (keywords.some((keyword) => normalized.includes(keyword))) return color;
  }
  let hash = 0;
  for (let index = 0; index < normalized.length; index++) hash = hash * 31 + normalized.charCodeAt(index) >>> 0;
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}
function pixelTerrainGlyphForTypeId(typeId) {
  return `${terrainColorForTypeId(typeId)}\u2588`;
}
function isHiddenMapTarget(kind) {
  const normalized = (kind ?? "").toLowerCase();
  return normalized.includes("machine") || normalized.includes("factory") || normalized.includes("device") || normalized.includes("workstation") || normalized.includes("item") || normalized.includes("drop") || normalized.includes("loot") || normalized.includes("pickup");
}
function formatTerrainGrid(grid) {
  const lines = [];
  const half = Math.floor(grid.width / 2);
  for (let row = 0; row < grid.width; row++) {
    let line = "";
    for (let column = 0; column < grid.width; column++) {
      const cell = grid.cells[row * grid.width + column];
      line += row === half && column === half ? "X" : cell?.glyph ?? "?";
    }
    lines.push(line);
  }
  return lines;
}
function formatTerrainGridPixels(grid, shape = "square", markers = []) {
  const lines = [];
  const half = Math.floor(grid.width / 2);
  const centerHeight = grid.cells[half * grid.width + half]?.height ?? 0;
  for (let row = 0; row < grid.width; row++) {
    let line = "";
    for (let column = 0; column < grid.width; column++) {
      if (shape === "circle") {
        const dx = column - half;
        const dz = row - half;
        if (dx * dx + dz * dz > half * half + 1) {
          line += " ";
          continue;
        }
      }
      const cell = grid.cells[row * grid.width + column];
      if (row === half && column === half) {
        line += "\xA7fX";
        continue;
      }
      const marker = markers.find(
        (entry) => Math.floor((entry.x - grid.centerX) / grid.cellSize) + half === column && Math.floor((entry.z - grid.centerZ) / grid.cellSize) + half === row
      );
      if (marker) {
        line += `\xA7f${marker.glyph.trim().charAt(0) || "?"}`;
        continue;
      }
      const terrainPixel = pixelTerrainGlyphForTypeId(cell?.typeId ?? "minecraft:air");
      const heightDelta = (cell?.height ?? centerHeight) - centerHeight;
      const reliefGlyph = heightDelta >= 4 ? "\u2593" : heightDelta <= -4 ? "\u2592" : "\u2588";
      const key = `${terrainPixel.slice(0, 2)}${reliefGlyph}`;
      line += key;
    }
    lines.push(line);
  }
  return lines;
}
function parseCompanionVectorPayload(raw) {
  if (!raw || raw.trim() === "") return [];
  try {
    const parsed = JSON.parse(raw);
    const root = parsed;
    const items = Array.isArray(parsed) ? parsed : Array.isArray(root?.targets) ? root.targets : Array.isArray(root?.entries) ? root.entries : Array.isArray(root?.objects) ? root.objects : [];
    const parsedTargets = [];
    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const target = item;
      const id = String(target.id ?? target.uuid ?? target.name ?? `companion:${parsedTargets.length}`);
      const name = String(target.name ?? target.label ?? target.title ?? id);
      const glyph = String(target.glyph ?? target.icon ?? target.symbol ?? target.marker ?? "\u25C7");
      const positionObject = typeof target.position === "object" && target.position !== null ? target.position : void 0;
      const relativeObject = typeof target.relative === "object" && target.relative !== null ? target.relative : void 0;
      const x = Number(target.x ?? target.posX ?? target.offsetX ?? target.dx ?? positionObject?.x ?? relativeObject?.x ?? 0);
      const z = Number(target.z ?? target.posZ ?? target.offsetZ ?? target.dz ?? positionObject?.z ?? relativeObject?.z ?? 0);
      const enabledValue = target.enabled ?? target.visible ?? target.active ?? true;
      const enabled = enabledValue !== false;
      const kind = typeof target.kind === "string" ? target.kind : typeof target.type === "string" ? target.type : typeof target.category === "string" ? target.category : "unknown";
      const colorCode = typeof target.colorCode === "string" ? target.colorCode : getCompanionTargetColor(kind);
      const priority = Number(target.priority ?? target.score ?? target.weight ?? 0);
      const range = typeof target.range === "object" && target.range !== null ? target.range : void 0;
      const label = typeof target.label === "string" ? target.label : name;
      const category = typeof target.category === "string" ? target.category : kind;
      if (!Number.isFinite(x) || !Number.isFinite(z) || !enabled) continue;
      parsedTargets.push({
        id,
        name,
        glyph,
        x,
        z,
        colorCode,
        kind,
        enabled,
        priority: Number.isFinite(priority) ? priority : 0,
        range,
        label,
        category
      });
    }
    return parsedTargets.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  } catch {
    return [];
  }
}
function terrainCacheKey(dimensionId, x, z, cellSize) {
  const centerX = Math.floor(x / cellSize) * cellSize;
  const centerZ = Math.floor(z / cellSize) * cellSize;
  return `${dimensionId}:${centerX}:${centerZ}:${cellSize}`;
}

// src/features/minimap/TerrainBudget.ts
var MAX_WORLD_READS_PER_REFRESH = 96;
var MAX_REMEMBERED_CELLS = 2e4;
function canSampleThisRefresh(readsUsed, alreadyRemembered, budget = MAX_WORLD_READS_PER_REFRESH) {
  if (alreadyRemembered) return false;
  return readsUsed < Math.max(0, budget);
}
function keysToEvict(orderedKeys, limit = MAX_REMEMBERED_CELLS) {
  const overflow = orderedKeys.length - Math.max(0, limit);
  if (overflow <= 0) return [];
  return orderedKeys.slice(0, overflow);
}
function cellKeyForBlock(dimensionId, x, z, cellSize) {
  const size = Math.max(1, Math.floor(cellSize));
  return `${dimensionId}:${Math.floor(x / size) * size}:${Math.floor(z / size) * size}`;
}

// src/features/minimap/TerrainSampler.ts
var DEFAULT_CELL_SIZE = 4;
var CACHE_TTL_TICKS = 100;
var DEFAULT_GRID_WIDTH = 9;
var MIN_GRID_WIDTH = 3;
var MAX_GRID_WIDTH = 21;
var MIN_CELL_SIZE = 1;
var MAX_CELL_SIZE = 32;
var cache = /* @__PURE__ */ new Map();
var rememberedCells = /* @__PURE__ */ new Map();
var UNKNOWN_TYPE_ID = "phlodgate:unmapped";
function rememberCell(memoryKey, cell) {
  rememberedCells.set(memoryKey, cell);
  for (const key of keysToEvict([...rememberedCells.keys()], MAX_REMEMBERED_CELLS)) {
    rememberedCells.delete(key);
  }
}
function sampleCell(dimension, x, z, minY, context) {
  const memoryKey = `${dimension.id}:${x}:${z}`;
  const remembered = rememberedCells.get(memoryKey);
  if (!canSampleThisRefresh(context.readsUsed, remembered !== void 0)) {
    return remembered ?? { glyph: "?", height: minY, typeId: UNKNOWN_TYPE_ID };
  }
  context.readsUsed++;
  try {
    const block = dimension.getTopmostBlock({ x, z });
    if (!block) {
      const cell2 = { glyph: "?", height: minY, typeId: "minecraft:air" };
      rememberCell(memoryKey, cell2);
      return cell2;
    }
    const cell = {
      glyph: terrainGlyphForTypeId(block.typeId),
      height: block.location.y,
      typeId: block.typeId
    };
    rememberCell(memoryKey, cell);
    return cell;
  } catch {
    return remembered ?? { glyph: "?", height: minY, typeId: UNKNOWN_TYPE_ID };
  }
}
function sampleTerrainGrid(dimension, centerX, centerZ, currentTick, cellSize = DEFAULT_CELL_SIZE, requestedWidth = DEFAULT_GRID_WIDTH) {
  const safeCellSize = Math.min(MAX_CELL_SIZE, Math.max(MIN_CELL_SIZE, Math.floor(cellSize) || DEFAULT_CELL_SIZE));
  const normalizedWidth = Math.min(MAX_GRID_WIDTH, Math.max(MIN_GRID_WIDTH, Math.floor(requestedWidth) || DEFAULT_GRID_WIDTH));
  const width = normalizedWidth % 2 === 0 ? normalizedWidth - 1 : normalizedWidth;
  const key = `${terrainCacheKey(dimension.id, centerX, centerZ, safeCellSize)}:${width}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > currentTick) return cached.grid;
  const centerGridX = Math.floor(centerX / safeCellSize) * safeCellSize;
  const centerGridZ = Math.floor(centerZ / safeCellSize) * safeCellSize;
  const half = Math.floor(width / 2);
  const cells = [];
  const heightRange = dimension.heightRange;
  const minY = Math.floor(heightRange.min);
  const context = { readsUsed: 0 };
  for (let row = -half; row <= half; row++) {
    for (let column = -half; column <= half; column++) {
      cells.push(
        sampleCell(dimension, centerGridX + column * safeCellSize, centerGridZ + row * safeCellSize, minY, context)
      );
    }
  }
  const grid = { centerX: centerGridX, centerZ: centerGridZ, cellSize: safeCellSize, width, cells };
  const ttl = context.readsUsed > 0 ? Math.min(CACHE_TTL_TICKS, 20) : CACHE_TTL_TICKS;
  cache.set(key, { expiresAt: currentTick + ttl, grid });
  return grid;
}
function invalidateTerrainAt(dimensionId, x, z) {
  cache.clear();
  for (let size = MIN_CELL_SIZE; size <= MAX_CELL_SIZE; size *= 2) {
    rememberedCells.delete(cellKeyForBlock(dimensionId, x, z, size));
  }
}

// src/ui/forms/MinimapForms.ts
var FIELD_MAP_LISTED = 10;
async function openFieldMapMenu(player) {
  try {
    const settings = getPlayerSettings(player);
    const from = player.location;
    const yaw360 = (player.getRotation().y % 360 + 360) % 360;
    const entries = listWaypoints(player).filter((w) => isSameDimension(w, player.dimension.id)).map((w) => {
      const to = { x: w.x, y: w.y, z: w.z };
      const bearing = bearingDegrees(from, to);
      return {
        name: w.name,
        delta: angularDelta(yaw360, bearing),
        distance: distanceXZ(from, to)
      };
    }).filter((e) => withinRadius(e.distance, settings.minimapRadius));
    const cardinals = cardinalEntriesForYaw(yaw360, angularDelta);
    const strip = buildRadarStrip(
      entries.map((e) => ({ glyph: e.name.trim().charAt(0).toUpperCase() || "?", delta: e.delta, distance: e.distance })),
      cardinals
    );
    const listBody = entries.length === 0 ? `\xA77No waypoints within ${settings.minimapRadius} blocks.` : nearestEntries(entries, FIELD_MAP_LISTED).map((e) => `${arrowForDelta(e.delta)} ${e.name} \xA77\u2014 \xA7f${formatDistance(e.distance)}`).join("\n");
    let terrainBody = "\xA78Terrain unavailable in this area.";
    try {
      const terrainGrid = sampleTerrainGrid(player.dimension, Math.floor(from.x), Math.floor(from.z), system2.currentTick);
      terrainBody = ["\xA77Terrain", ...formatTerrainGrid(terrainGrid).map((line) => `\xA7e${line}`), "\xA78X = player, # = solid, . = vegetation, ~ = water, ^ = lava"].join("\n");
    } catch (err) {
      log(`Field Map terrain sampling failed: ${String(err)}`);
    }
    const body = [`\xA77[${strip}\xA77]`, "", terrainBody, "", listBody].join("\n");
    const form = new ActionFormData3().title("Phlodgate Field Map").body(body).button("+ Add waypoint here").button(settings.minimapEnabled ? "Turn off Minimap HUD" : "Turn on Minimap HUD").button("Manage Waypoints");
    const response = await showFormWithRetry(player, () => form, { context: "Field Map menu" });
    if (!response || response.canceled || response.selection === void 0) return;
    switch (response.selection) {
      case 0:
        await openAddWaypointForm(player);
        break;
      case 1: {
        const next = updatePlayerSettings(player, { minimapEnabled: !settings.minimapEnabled });
        player.sendMessage(next.minimapEnabled ? "\xA7aMinimap HUD enabled." : "\xA77Minimap HUD disabled.");
        break;
      }
      case 2:
        await openWaypointMenu(player);
        break;
    }
  } catch (err) {
    log(`Field Map menu failed: ${String(err)}`);
  }
}

// src/ui/forms/RecipeForms.ts
import { ActionFormData as ActionFormData4, ModalFormData as ModalFormData5 } from "@minecraft/server-ui";

// src/features/inventory/RecipeRegistry.ts
var BASE_RECIPES = [
  { id: "planks_oak", category: "building", outputTypeId: "minecraft:oak_planks", outputCount: 4, ingredients: [{ typeId: "minecraft:oak_log", count: 1 }] },
  { id: "stick", category: "building", outputTypeId: "minecraft:stick", outputCount: 4, ingredients: [{ typeId: "minecraft:oak_planks", count: 2 }] },
  { id: "crafting_table", category: "building", outputTypeId: "minecraft:crafting_table", outputCount: 1, ingredients: [{ typeId: "minecraft:oak_planks", count: 4 }] },
  { id: "furnace", category: "building", outputTypeId: "minecraft:furnace", outputCount: 1, ingredients: [{ typeId: "minecraft:cobblestone", count: 8 }] },
  { id: "chest", category: "building", outputTypeId: "minecraft:chest", outputCount: 1, ingredients: [{ typeId: "minecraft:oak_planks", count: 8 }] },
  { id: "torch", category: "building", outputTypeId: "minecraft:torch", outputCount: 4, ingredients: [{ typeId: "minecraft:coal", count: 1 }, { typeId: "minecraft:stick", count: 1 }] },
  { id: "wooden_pickaxe", category: "tools", outputTypeId: "minecraft:wooden_pickaxe", outputCount: 1, ingredients: [{ typeId: "minecraft:oak_planks", count: 3 }, { typeId: "minecraft:stick", count: 2 }] },
  { id: "stone_pickaxe", category: "tools", outputTypeId: "minecraft:stone_pickaxe", outputCount: 1, ingredients: [{ typeId: "minecraft:cobblestone", count: 3 }, { typeId: "minecraft:stick", count: 2 }] },
  { id: "iron_pickaxe", category: "tools", outputTypeId: "minecraft:iron_pickaxe", outputCount: 1, ingredients: [{ typeId: "minecraft:iron_ingot", count: 3 }, { typeId: "minecraft:stick", count: 2 }] },
  { id: "wooden_axe", category: "tools", outputTypeId: "minecraft:wooden_axe", outputCount: 1, ingredients: [{ typeId: "minecraft:oak_planks", count: 3 }, { typeId: "minecraft:stick", count: 2 }] },
  { id: "shears", category: "tools", outputTypeId: "minecraft:shears", outputCount: 1, ingredients: [{ typeId: "minecraft:iron_ingot", count: 2 }] },
  { id: "bread", category: "food", outputTypeId: "minecraft:bread", outputCount: 1, ingredients: [{ typeId: "minecraft:wheat", count: 3 }] },
  { id: "iron_ingot_from_nuggets", category: "misc", outputTypeId: "minecraft:iron_ingot", outputCount: 1, ingredients: [{ typeId: "minecraft:iron_nugget", count: 9 }] },
  { id: "bucket", category: "tools", outputTypeId: "minecraft:bucket", outputCount: 1, ingredients: [{ typeId: "minecraft:iron_ingot", count: 3 }] },
  { id: "bookshelf", category: "building", outputTypeId: "minecraft:bookshelf", outputCount: 1, ingredients: [{ typeId: "minecraft:oak_planks", count: 6 }, { typeId: "minecraft:book", count: 3 }] }
];
var activeRecipes = [...BASE_RECIPES];
function getAllRecipes() {
  return activeRecipes;
}
function registerRecipe(recipe) {
  const existingIdx = activeRecipes.findIndex((r) => r.id === recipe.id);
  if (existingIdx >= 0) {
    activeRecipes[existingIdx] = recipe;
  } else {
    activeRecipes.push(recipe);
  }
}
function registerModdedRecipes(recipes) {
  for (const recipe of recipes) {
    registerRecipe(recipe);
  }
}
function getAvailableCategories() {
  const cats = /* @__PURE__ */ new Set();
  for (const r of activeRecipes) cats.add(r.category);
  return [...cats].sort();
}
function searchRecipes(query, namespaceFilter) {
  const q = query.trim().toLowerCase();
  const ns = namespaceFilter?.trim().toLowerCase();
  return activeRecipes.filter((r) => {
    if (ns && extractNamespace(r.outputTypeId) !== ns) {
      return false;
    }
    if (!q) return true;
    return r.outputTypeId.toLowerCase().includes(q) || r.id.toLowerCase().includes(q) || r.category.toLowerCase().includes(q);
  });
}
function recipesByCategory(category) {
  return activeRecipes.filter((r) => r.category === category);
}
function getRecipe(id) {
  return activeRecipes.find((r) => r.id === id);
}
function countAvailable(inventory, typeId) {
  return inventory.filter((slot) => slot.typeId === typeId).reduce((sum, slot) => sum + slot.count, 0);
}
function maxCraftable(recipe, inventory) {
  let max = Infinity;
  for (const ingredient of recipe.ingredients) {
    const available = countAvailable(inventory, ingredient.typeId);
    max = Math.min(max, Math.floor(available / ingredient.count));
  }
  return Number.isFinite(max) ? Math.max(0, max) : 0;
}
function canCraft(recipe, inventory, times = 1) {
  return maxCraftable(recipe, inventory) >= times;
}

// src/features/inventory/MassCraft.ts
import { ItemStack } from "@minecraft/server";
function readIndexedSnapshot(inventory) {
  const container = inventory.container;
  if (!container) return [];
  const slots = [];
  for (let i = 0; i < container.size; i++) {
    const item = container.getItem(i);
    if (item) slots.push({ index: i, typeId: item.typeId, count: item.amount });
  }
  return slots;
}
function massCraft(player, recipeId, requestedTimes) {
  const recipe = getRecipe(recipeId);
  if (!recipe) return { ok: false, message: `Unknown recipe "${recipeId}".`, crafted: 0 };
  if (requestedTimes <= 0) return { ok: false, message: "Quantity must be positive.", crafted: 0 };
  const inventory = player.getComponent("minecraft:inventory");
  const container = inventory?.container;
  if (!inventory || !container) return { ok: false, message: "No inventory available.", crafted: 0 };
  const snapshot = readIndexedSnapshot(inventory);
  const flatSnapshot = snapshot.map(({ typeId, count }) => ({ typeId, count }));
  const available = maxCraftable(recipe, flatSnapshot);
  const times = Math.min(available, requestedTimes);
  if (times <= 0) {
    return { ok: false, message: "Not enough ingredients to craft even one.", crafted: 0 };
  }
  if (!canCraft(recipe, flatSnapshot, times)) {
    return { ok: false, message: "Not enough ingredients for the requested quantity.", crafted: 0 };
  }
  consumeFromContainer(container, snapshot, recipe, times);
  const outputCount = recipe.outputCount * times;
  depositOutput(player, container, recipe.outputTypeId, outputCount);
  const shortfall = requestedTimes - times;
  const message = shortfall > 0 ? `Crafted ${times}x ${recipe.outputTypeId.replace("minecraft:", "")} (limited by available ingredients).` : `Crafted ${times}x ${recipe.outputTypeId.replace("minecraft:", "")}.`;
  return { ok: true, message, crafted: times };
}
function consumeFromContainer(container, snapshot, recipe, times) {
  for (const ingredient of recipe.ingredients) {
    let remaining = ingredient.count * times;
    for (const slot of snapshot) {
      if (remaining <= 0) break;
      if (slot.typeId !== ingredient.typeId || slot.count <= 0) continue;
      const take = Math.min(slot.count, remaining);
      slot.count -= take;
      remaining -= take;
      if (slot.count <= 0) {
        container.setItem(slot.index, void 0);
      } else {
        const current = container.getItem(slot.index);
        if (current) {
          current.amount = slot.count;
          container.setItem(slot.index, current);
        }
      }
    }
  }
}
function depositOutput(player, container, typeId, count) {
  const maxStack = 64;
  let remaining = count;
  while (remaining > 0) {
    const stackSize = Math.min(maxStack, remaining);
    const leftover = container.addItem(new ItemStack(typeId, stackSize));
    if (leftover) {
      player.dimension.spawnItem(leftover, player.location);
      remaining = 0;
    } else {
      remaining -= stackSize;
    }
  }
}

// src/features/inventory/QuickTransfer.ts
import { ItemStack as ItemStack2, world as world3 } from "@minecraft/server";

// src/features/inventory/QuickTransferPlan.ts
var MAX_STACK = 64;
function planTransfer(source, dest, destFreeSlots, mode) {
  const workingDest = dest.map((s) => ({ ...s }));
  const workingSource = [];
  let freeSlots = destFreeSlots;
  for (const stack of source) {
    const eligible = mode === "all" || workingDest.some((d) => d.typeId === stack.typeId);
    if (!eligible) {
      workingSource.push({ ...stack });
      continue;
    }
    let remaining = stack.count;
    for (const dStack of workingDest) {
      if (remaining <= 0) break;
      if (dStack.typeId !== stack.typeId) continue;
      const space = MAX_STACK - dStack.count;
      if (space <= 0) continue;
      const move = Math.min(space, remaining);
      dStack.count += move;
      remaining -= move;
    }
    while (remaining > 0 && freeSlots > 0) {
      const move = Math.min(MAX_STACK, remaining);
      workingDest.push({ typeId: stack.typeId, count: move });
      remaining -= move;
      freeSlots--;
    }
    if (remaining > 0) {
      workingSource.push({ typeId: stack.typeId, count: remaining });
    }
  }
  return { source: workingSource, dest: workingDest.filter((s) => s.count > 0) };
}

// src/features/inventory/QuickTransfer.ts
var lastOpenedByPlayer = /* @__PURE__ */ new Map();
function registerQuickTransferTracking() {
  world3.afterEvents.playerInteractWithBlock.subscribe((event) => {
    if (!event.block.getComponent("minecraft:inventory")?.container) return;
    lastOpenedByPlayer.set(event.player.id, {
      dimensionId: event.player.dimension.id,
      x: event.block.location.x,
      y: event.block.location.y,
      z: event.block.location.z
    });
  });
}
function readSnapshot(container) {
  const slots = [];
  for (let i = 0; i < container.size; i++) {
    const item = container.getItem(i);
    if (item) slots.push({ typeId: item.typeId, count: item.amount });
  }
  return slots;
}
function countFreeSlots(container) {
  let free = 0;
  for (let i = 0; i < container.size; i++) {
    if (!container.getItem(i)) free++;
  }
  return free;
}
function writeSnapshot(container, snapshot) {
  for (let i = 0; i < container.size; i++) container.setItem(i, void 0);
  let index = 0;
  for (const stack of snapshot) {
    let remaining = stack.count;
    while (remaining > 0 && index < container.size) {
      const amount = Math.min(64, remaining);
      container.setItem(index, new ItemStack2(stack.typeId, amount));
      remaining -= amount;
      index++;
    }
  }
}
function quickTransfer(player, mode) {
  const ref = lastOpenedByPlayer.get(player.id);
  if (!ref) return { ok: false, message: "Open a chest or other container first, then use Quick Transfer." };
  let dimension;
  try {
    dimension = world3.getDimension(ref.dimensionId);
  } catch {
    return { ok: false, message: "That container's dimension is no longer available." };
  }
  const block = dimension.getBlock({ x: ref.x, y: ref.y, z: ref.z });
  const containerComponent = block?.getComponent("minecraft:inventory");
  const targetContainer = containerComponent?.container;
  if (!targetContainer) return { ok: false, message: "That container is no longer available." };
  const inventoryComponent = player.getComponent("minecraft:inventory");
  const playerContainer = inventoryComponent?.container;
  if (!playerContainer) return { ok: false, message: "No player inventory available." };
  try {
    const sourceSnapshot = readSnapshot(playerContainer);
    const destSnapshot = readSnapshot(targetContainer);
    const destFree = countFreeSlots(targetContainer);
    const result = planTransfer(sourceSnapshot, destSnapshot, destFree, mode);
    writeSnapshot(playerContainer, result.source);
    writeSnapshot(targetContainer, result.dest);
    return { ok: true, message: "Quick transfer complete." };
  } catch (err) {
    log(`Quick transfer failed: ${String(err)}`);
    return { ok: false, message: "Quick transfer failed unexpectedly; nothing was changed." };
  }
}

// src/ui/FormValidation.ts
function readModalValues(response, expectedCount) {
  if (response.canceled || !Array.isArray(response.formValues) || response.formValues.length < expectedCount) return void 0;
  return response.formValues;
}
function readSelection(response) {
  const selection = response.selection;
  if (response.canceled || !Number.isInteger(selection) || selection === void 0 || selection < 0) return void 0;
  return selection;
}

// src/ui/forms/RecipeForms.ts
async function openInventoryMenu(player) {
  const form = new ActionFormData4().title("Inventory & Recipes").button("Browse recipes").button("Browse by category").button("Search recipes").button("Quick transfer: Move all \u2192 container").button("Quick transfer: Move matching only \u2192 container");
  try {
    const response = await showFormWithRetry(player, () => form, { context: "Inventory menu" });
    if (!response) return;
    const selection = readSelection(response);
    if (selection === void 0) return;
    switch (selection) {
      case 0:
        await openRecipeList(player, [...getAllRecipes()], 1, "All recipes");
        break;
      case 1:
        await openCategoryList(player);
        break;
      case 2:
        await openSearchForm(player);
        break;
      case 3:
        reportTransfer(player, quickTransfer(player, "all"));
        break;
      case 4:
        reportTransfer(player, quickTransfer(player, "matching-only"));
        break;
    }
  } catch (err) {
    log(`Inventory menu failed: ${String(err)}`);
  }
}
function reportTransfer(player, result) {
  player.sendMessage(result.ok ? `\xA7a${result.message}` : `\xA7c${result.message}`);
}
async function openSearchForm(player) {
  const form = new ModalFormData5().title("Search Recipes").textField("Item name / recipe id / category", "e.g. pickaxe");
  const response = await showFormWithRetry(player, () => form, { context: "Recipe search" });
  if (!response) return;
  const values = readModalValues(response, 1);
  if (!values) return;
  const query = String(values[0] ?? "").trim().slice(0, 64);
  const results = searchRecipes(query);
  await openRecipeList(player, results, 1, `Search: ${query || "all"}`);
}
async function openCategoryList(player) {
  const categories = getAvailableCategories();
  const form = new ActionFormData4().title("Recipe Categories").button("All recipes");
  for (const category2 of categories) form.button(category2);
  const response = await showFormWithRetry(player, () => form, { context: "Recipe categories" });
  if (!response) return;
  const selection = readSelection(response);
  if (selection === void 0) return;
  const category = selection === 0 ? void 0 : categories[selection - 1];
  await openRecipeList(player, category ? recipesByCategory(category) : [...getAllRecipes()], 1, category ?? "All recipes");
}
async function openRecipeList(player, recipes, page = 1, label = "Recipes") {
  if (recipes.length === 0) {
    player.sendMessage("\xA77No recipes matched.");
    return;
  }
  const pageSize = 12;
  const totalPages = Math.max(1, Math.ceil(recipes.length / pageSize));
  const currentPage = Math.max(1, Math.min(totalPages, page));
  const pageRecipes = recipes.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const form = new ActionFormData4().title(`${label} (${currentPage}/${totalPages})`);
  for (const recipe of pageRecipes) {
    const ingredientSummary = recipe.ingredients.map((i) => `${i.count}x ${i.typeId.replace("minecraft:", "")}`).join(", ");
    form.button(`${recipe.outputTypeId.replace("minecraft:", "")} x${recipe.outputCount}
\xA77${ingredientSummary}`);
  }
  if (currentPage < totalPages) form.button(`Next page (${currentPage + 1}/${totalPages})`);
  if (currentPage > 1) form.button(`Previous page (${currentPage - 1}/${totalPages})`);
  const response = await showFormWithRetry(player, () => form, { context: "Recipe list" });
  if (!response) return;
  const selection = readSelection(response);
  if (selection === void 0) return;
  if (selection < pageRecipes.length) {
    await openRecipeDetail(player, pageRecipes[selection]);
    return;
  }
  const nextIndex = pageRecipes.length;
  if (currentPage < totalPages && selection === nextIndex) {
    await openRecipeList(player, recipes, currentPage + 1, label);
    return;
  }
  if (currentPage > 1 && selection === nextIndex + (currentPage < totalPages ? 1 : 0)) {
    await openRecipeList(player, recipes, currentPage - 1, label);
  }
}
async function openRecipeDetail(player, recipe) {
  const form = new ModalFormData5().title(recipe.outputTypeId.replace("minecraft:", "")).slider("Quantity to craft (batches)", 1, 64, { defaultValue: 1, valueStep: 1 });
  const response = await showFormWithRetry(player, () => form, { context: "Recipe detail" });
  if (!response) return;
  const values = readModalValues(response, 1);
  if (!values) return;
  const times = Math.max(1, Math.min(64, Math.floor(Number(values[0] ?? 1))));
  const result = massCraft(player, recipe.id, times);
  player.sendMessage(result.ok ? `\xA7a${result.message}` : `\xA7c${result.message}`);
}

// src/ui/forms/AccessoryForms.ts
import { ActionFormData as ActionFormData5 } from "@minecraft/server-ui";

// src/features/accessories/AccessoryPlan.ts
var ACCESSORY_SLOTS = [
  { id: "head", label: "Head" },
  { id: "necklace", label: "Necklace" },
  { id: "back", label: "Back" },
  { id: "body", label: "Body" },
  { id: "belt", label: "Belt" },
  { id: "hands", label: "Hands" },
  { id: "bracelet", label: "Bracelet" },
  { id: "ring_1", label: "Ring 1" },
  { id: "ring_2", label: "Ring 2" },
  { id: "charm", label: "Charm" }
];
var ACCESSORY_DEFINITIONS = [
  {
    itemTypeId: "phlodgate:speed_ring",
    label: "Swiftstep Ring",
    description: "Grants Speed I while equipped.",
    icon: "gold_nugget",
    allowedSlots: ["ring_1", "ring_2"],
    effects: [{ effectTypeId: "speed", amplifier: 0 }]
  },
  {
    itemTypeId: "phlodgate:water_necklace",
    label: "Tideglass Necklace",
    description: "Grants Water Breathing while equipped.",
    icon: "nautilus_shell",
    allowedSlots: ["necklace"],
    effects: [{ effectTypeId: "water_breathing", amplifier: 0 }]
  },
  {
    itemTypeId: "phlodgate:feather_charm",
    label: "Featherfall Charm",
    description: "Grants Slow Falling while equipped.",
    icon: "feather",
    allowedSlots: ["back", "charm"],
    effects: [{ effectTypeId: "slow_falling", amplifier: 0 }]
  },
  {
    itemTypeId: "phlodgate:fire_charm",
    label: "Emberguard Charm",
    description: "Grants Fire Resistance while equipped.",
    icon: "magma_cream",
    allowedSlots: ["charm"],
    effects: [{ effectTypeId: "fire_resistance", amplifier: 0 }]
  },
  {
    itemTypeId: "phlodgate:night_amulet",
    label: "Moonveil Amulet",
    description: "Grants Night Vision while equipped.",
    icon: "amethyst_shard",
    allowedSlots: ["head", "necklace"],
    effects: [{ effectTypeId: "night_vision", amplifier: 0 }]
  },
  {
    itemTypeId: "phlodgate:vitality_bracelet",
    label: "Vitality Bracelet",
    description: "Grants Resistance I while equipped.",
    icon: "iron_ingot",
    allowedSlots: ["bracelet"],
    effects: [{ effectTypeId: "resistance", amplifier: 0 }]
  },
  {
    itemTypeId: "phlodgate:haste_gloves",
    label: "Haste Gloves",
    description: "Grants Haste I while equipped.",
    icon: "leather",
    allowedSlots: ["hands"],
    effects: [{ effectTypeId: "haste", amplifier: 0 }]
  }
];
var ACCESSORY_DEFINITIONS_BY_ID = new Map(ACCESSORY_DEFINITIONS.map((definition) => [definition.itemTypeId, definition]));
var ACCESSORY_SLOTS_BY_ID = new Map(ACCESSORY_SLOTS.map((slot) => [slot.id, slot]));
function emptyAccessoryState() {
  return { equipped: [] };
}
function getAccessoryDefinition(itemTypeId) {
  return ACCESSORY_DEFINITIONS_BY_ID.get(itemTypeId);
}
function getAccessorySlot(slotId) {
  return ACCESSORY_SLOTS_BY_ID.get(slotId);
}
function normalizeAccessoryState(value) {
  if (!value || typeof value !== "object") return emptyAccessoryState();
  const entries = Array.isArray(value.equipped) ? value.equipped : [];
  const occupied = /* @__PURE__ */ new Set();
  const equipped = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const slotId = String(entry.slotId ?? "");
    const itemTypeId = String(entry.itemTypeId ?? "");
    const definition = getAccessoryDefinition(itemTypeId);
    if (!getAccessorySlot(slotId) || !definition || !definition.allowedSlots.includes(slotId) || occupied.has(slotId)) continue;
    occupied.add(slotId);
    equipped.push({ slotId, itemTypeId });
  }
  return { equipped };
}
function canEquipAccessory(state, itemTypeId, slotId) {
  const definition = getAccessoryDefinition(itemTypeId);
  return !!definition && definition.allowedSlots.includes(slotId) && !state.equipped.some((entry) => entry.slotId === slotId);
}
function equipAccessory(state, itemTypeId, slotId) {
  if (!canEquipAccessory(state, itemTypeId, slotId)) return void 0;
  return { equipped: [...state.equipped, { slotId, itemTypeId }] };
}
function unequipAccessory(state, slotId) {
  const removed = state.equipped.find((entry) => entry.slotId === slotId);
  return {
    state: { equipped: state.equipped.filter((entry) => entry.slotId !== slotId) },
    itemTypeId: removed?.itemTypeId
  };
}
function aggregateAccessoryEffects(state) {
  const effects = /* @__PURE__ */ new Map();
  for (const entry of state.equipped) {
    for (const effect of getAccessoryDefinition(entry.itemTypeId)?.effects ?? []) {
      effects.set(effect.effectTypeId, Math.max(effects.get(effect.effectTypeId) ?? 0, effect.amplifier));
    }
  }
  return [...effects.entries()].map(([effectTypeId, amplifier]) => ({ effectTypeId, amplifier }));
}

// src/features/accessories/AccessoryRuntime.ts
import { ItemStack as ItemStack3, world as world4 } from "@minecraft/server";

// src/util/Scheduler.ts
import { system as system3 } from "@minecraft/server";
function safeInterval(name, callback, tickInterval) {
  return system3.runInterval(() => {
    try {
      callback();
    } catch (err) {
      log(`Interval "${name}" threw and was skipped this cycle: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
    }
  }, tickInterval);
}

// src/features/accessories/AccessoryRuntime.ts
var ACCESSORY_STATE_KEY = "phlodgate:accessory_state";
var EFFECT_REFRESH_TICKS = 45;
var EFFECT_REFRESH_INTERVAL = 20;
function getContainer(player) {
  const inventory = player.getComponent("minecraft:inventory");
  return inventory?.container;
}
function getAccessoryState(player) {
  const raw = player.getDynamicProperty(ACCESSORY_STATE_KEY);
  if (!raw) return emptyAccessoryState();
  try {
    return normalizeAccessoryState(JSON.parse(raw));
  } catch {
    return emptyAccessoryState();
  }
}
function setAccessoryState(player, state) {
  player.setDynamicProperty(ACCESSORY_STATE_KEY, JSON.stringify(state));
}
function equipAccessoryFromInventorySlot(player, inventorySlot, slotId) {
  const container = getContainer(player);
  const item = container?.getItem(inventorySlot);
  const definition = item ? getAccessoryDefinition(item.typeId) : void 0;
  if (!container || !item || !definition) return { ok: false, message: "That inventory slot does not contain a Phlodgate trinket." };
  const state = getAccessoryState(player);
  if (!canEquipAccessory(state, item.typeId, slotId)) return { ok: false, message: `${definition.label} cannot be equipped in that slot.` };
  const nextState = equipAccessory(state, item.typeId, slotId);
  if (!nextState) return { ok: false, message: "That accessory slot is already occupied." };
  const original = item.clone();
  try {
    item.amount -= 1;
    container.setItem(inventorySlot, item.amount > 0 ? item : void 0);
    setAccessoryState(player, nextState);
    return { ok: true, message: `${definition.label} equipped in ${slotId.replace("_", " ")}.` };
  } catch (error) {
    try {
      container.setItem(inventorySlot, original);
    } catch {
      player.dimension.spawnItem(original, player.location);
    }
    log(`Accessory equip rollback for ${player.name}: ${String(error)}`);
    return { ok: false, message: "Accessory equip failed; your item was restored." };
  }
}
function quickEquipFromSelectedSlot(player) {
  const container = getContainer(player);
  const selectedSlot = player.selectedSlotIndex;
  const item = container?.getItem(selectedSlot);
  const definition = item ? getAccessoryDefinition(item.typeId) : void 0;
  if (!item || !definition) return { ok: false, message: "Hold a Phlodgate trinket to quick-equip it." };
  const state = getAccessoryState(player);
  const slot = ACCESSORY_SLOTS.find((candidate) => canEquipAccessory(state, item.typeId, candidate.id));
  if (!slot) return { ok: false, message: `${definition.label} has no compatible empty slot.` };
  return equipAccessoryFromInventorySlot(player, selectedSlot, slot.id);
}
function unequipAccessoryToInventory(player, slotId) {
  const container = getContainer(player);
  if (!container) return { ok: false, message: "No player inventory is available." };
  const current = getAccessoryState(player);
  const result = unequipAccessory(current, slotId);
  if (!result.itemTypeId) return { ok: false, message: "That accessory slot is empty." };
  try {
    const leftover = container.addItem(new ItemStack3(result.itemTypeId, 1));
    if (leftover) player.dimension.spawnItem(leftover, player.location);
    setAccessoryState(player, result.state);
    const label = getAccessoryDefinition(result.itemTypeId)?.label ?? result.itemTypeId;
    return { ok: true, message: `${label} unequipped.` };
  } catch (error) {
    log(`Accessory unequip failed for ${player.name}: ${String(error)}`);
    return { ok: false, message: "Accessory unequip failed; it remains equipped." };
  }
}
function refreshAccessoryEffects(player) {
  const effects = aggregateAccessoryEffects(getAccessoryState(player));
  for (const effect of effects) {
    try {
      player.addEffect(effect.effectTypeId, EFFECT_REFRESH_TICKS, { amplifier: effect.amplifier, showParticles: false });
    } catch (error) {
      log(`Accessory effect ${effect.effectTypeId} failed for ${player.name}: ${String(error)}`);
    }
  }
}
function startAccessoryRuntime() {
  return safeInterval(
    "accessory-effects",
    () => {
      for (const player of world4.getAllPlayers()) refreshAccessoryEffects(player);
    },
    EFFECT_REFRESH_INTERVAL
  );
}

// src/ui/forms/AccessoryForms.ts
function getInventory(player) {
  return player.getComponent("minecraft:inventory")?.container;
}
async function openAccessoryCabinet(player) {
  const state = getAccessoryState(player);
  const form = new ActionFormData5().title("Phlodgate Trinket Cabinet").body("Equip compatible trinkets in named slots. Hold any trinket and use it for quick-equip.");
  for (const slot of ACCESSORY_SLOTS) {
    const equipped = state.equipped.find((entry) => entry.slotId === slot.id);
    const label = equipped ? getAccessoryDefinition(equipped.itemTypeId)?.label ?? equipped.itemTypeId : "Empty";
    form.button(`${slot.label}: ${label}${equipped ? "\n\xA77Unequip" : "\n\xA77Choose an item"}`);
  }
  form.button("Close");
  try {
    const response = await showFormWithRetry(player, () => form, { context: "Trinket cabinet" });
    const selection = response ? readSelection(response) : void 0;
    if (selection === void 0 || selection >= ACCESSORY_SLOTS.length) return;
    const slot = ACCESSORY_SLOTS[selection];
    const equipped = state.equipped.find((entry) => entry.slotId === slot.id);
    if (equipped) {
      const result = unequipAccessoryToInventory(player, slot.id);
      player.sendMessage(result.ok ? `\xA7a${result.message}` : `\xA7c${result.message}`);
      return;
    }
    await openAccessoryEquipChoice(player, slot.id);
  } catch (error) {
    log(`Trinket cabinet failed for ${player.name}: ${String(error)}`);
  }
}
async function openAccessoryEquipChoice(player, slotId) {
  const container = getInventory(player);
  if (!container) return;
  const state = getAccessoryState(player);
  const choices = [];
  for (let inventorySlot = 0; inventorySlot < container.size; inventorySlot++) {
    const item = container.getItem(inventorySlot);
    const definition = item ? getAccessoryDefinition(item.typeId) : void 0;
    if (!item || !definition || !canEquipAccessory(state, item.typeId, slotId)) continue;
    choices.push({ inventorySlot, label: `${definition.label} x${item.amount}
\xA77${definition.description}` });
  }
  if (choices.length === 0) {
    player.sendMessage("\xA77No compatible trinkets are available in your inventory.");
    return;
  }
  const slotLabel = ACCESSORY_SLOTS.find((slot) => slot.id === slotId)?.label ?? slotId;
  const form = new ActionFormData5().title(`Equip in ${slotLabel}`);
  for (const choice of choices) form.button(choice.label);
  form.button("Back");
  try {
    const response = await showFormWithRetry(player, () => form, { context: "Trinket equip choice" });
    const selection = response ? readSelection(response) : void 0;
    if (selection === void 0 || selection >= choices.length) return;
    const result = equipAccessoryFromInventorySlot(player, choices[selection].inventorySlot, slotId);
    player.sendMessage(result.ok ? `\xA7a${result.message}` : `\xA7c${result.message}`);
  } catch (error) {
    log(`Trinket equip choice failed for ${player.name}: ${String(error)}`);
  }
}

// src/features/optimization/OptimizationEngine.ts
import { system as system4, world as world5 } from "@minecraft/server";

// src/features/optimization/EntityClassifier.ts
var DEFAULT_PROTECTION_RULES = {
  protectNamedEntities: true,
  protectTamedPets: true,
  protectBosses: true,
  protectArmorStands: true,
  protectVillagersAndTraders: true,
  protectEntitiesInCombat: true,
  protectModdedEntities: true,
  combatGraceTicks: 20 * 15,
  // 15s after last hit
  nearPlayerSafeRadius: 12,
  recentItemGraceTicks: 20 * 5,
  // items always safe for their first 5s
  valuableItemTypeIds: [
    "minecraft:diamond",
    "minecraft:netherite_ingot",
    "minecraft:netherite_scrap",
    "minecraft:emerald",
    "minecraft:nether_star",
    "minecraft:totem_of_undying",
    "minecraft:enchanted_golden_apple",
    "minecraft:dragon_egg"
  ]
};
function classifyEntity(signal, rules) {
  const reasons = [];
  if (signal.isPlayer) reasons.push("players are always protected");
  if (signal.explicitlyProtectedByConfig) reasons.push("explicitly protected by world configuration");
  if (rules.protectTamedPets && signal.isTamed) reasons.push("tamed entity");
  if (rules.protectNamedEntities && signal.nameTag && signal.nameTag.trim().length > 0) reasons.push("named entity");
  if (rules.protectBosses && signal.isBoss) reasons.push("boss entity");
  if (rules.protectArmorStands && signal.isArmorStand) reasons.push("player-placed armor stand");
  if (rules.protectVillagersAndTraders && signal.isVillagerOrTrader) reasons.push("villager/trader");
  if (rules.protectModdedEntities && (signal.isModdedEntity || isModdedNamespace(extractNamespace(signal.typeId)) || signal.isItemEntity && signal.itemTypeId && isModdedNamespace(extractNamespace(signal.itemTypeId)))) {
    reasons.push("modded entity / machine proxy / modded item");
  }
  if (rules.protectEntitiesInCombat && signal.ticksSinceLastCombatInvolvement !== void 0 && signal.ticksSinceLastCombatInvolvement <= rules.combatGraceTicks) {
    reasons.push("recently involved in combat");
  }
  if (signal.distanceToNearestPlayer <= rules.nearPlayerSafeRadius) reasons.push("within a player's immediate safe radius");
  if (signal.isItemEntity && signal.ageTicks <= rules.recentItemGraceTicks) reasons.push("recently dropped item grace period");
  if (signal.isItemEntity && signal.itemTypeId && rules.valuableItemTypeIds.includes(signal.itemTypeId)) {
    reasons.push("valuable/rare item contents");
  }
  const protectedFromRemoval = reasons.length > 0;
  const removalPriority = protectedFromRemoval ? -1 : signal.ageTicks * 0.01 + signal.distanceToNearestPlayer;
  return {
    protectedFromRemoval,
    reasons,
    eligibleForRemoval: !protectedFromRemoval,
    removalPriority
  };
}
function selectForRemoval(candidates, removalAggressiveness) {
  const eligible = candidates.filter((c) => c.classification.eligibleForRemoval).sort((a, b) => b.classification.removalPriority - a.classification.removalPriority);
  const count = Math.ceil(eligible.length * Math.max(0, Math.min(1, removalAggressiveness)));
  return eligible.slice(0, count).map((c) => c.signal.entityId);
}

// src/features/optimization/OptimizationEngine.ts
var SCAN_INTERVAL_TICKS = 100;
var spawnTickByEntityId = /* @__PURE__ */ new Map();
var lastCombatTickByEntityId = /* @__PURE__ */ new Map();
var auditLog = [];
var MAX_AUDIT_ENTRIES = 200;
function getAuditLog() {
  return auditLog;
}
function pushAudit(entry) {
  auditLog.push(entry);
  if (auditLog.length > MAX_AUDIT_ENTRIES) auditLog.shift();
}
function registerOptimizationEventTracking() {
  world5.afterEvents.entitySpawn.subscribe((event) => {
    spawnTickByEntityId.set(event.entity.id, system4.currentTick);
  });
  world5.afterEvents.entityHurt.subscribe((event) => {
    if (event.hurtEntity) lastCombatTickByEntityId.set(event.hurtEntity.id, system4.currentTick);
  });
  world5.afterEvents.entityRemove.subscribe((event) => {
    spawnTickByEntityId.delete(event.removedEntityId);
    lastCombatTickByEntityId.delete(event.removedEntityId);
  });
}
function isTamed(entity) {
  try {
    return entity.getComponent("minecraft:is_tamed") !== void 0;
  } catch {
    return false;
  }
}
function isVillagerOrTrader(typeId) {
  return typeId.includes("villager") || typeId === "minecraft:wandering_trader";
}
function isBoss(typeId) {
  return typeId === "minecraft:ender_dragon" || typeId === "minecraft:wither";
}
function nearestPlayerDistance(entity, players) {
  let minSquared = Infinity;
  const loc = entity.location;
  for (const player of players) {
    if (player.dimension.id !== entity.dimension.id) continue;
    const p = player.location;
    const squared = (p.x - loc.x) ** 2 + (p.y - loc.y) ** 2 + (p.z - loc.z) ** 2;
    if (squared < minSquared) minSquared = squared;
  }
  return Number.isFinite(minSquared) ? Math.sqrt(minSquared) : Infinity;
}
function toSignal(entity, players, protectedTypeIds) {
  const spawnTick = spawnTickByEntityId.get(entity.id);
  const ageTicks = spawnTick !== void 0 ? Math.max(0, system4.currentTick - spawnTick) : 0;
  const lastCombat = lastCombatTickByEntityId.get(entity.id);
  const isItemEntity = entity.typeId === "minecraft:item";
  let itemTypeId;
  if (isItemEntity) {
    const itemComponent = entity.getComponent("minecraft:item");
    itemTypeId = itemComponent?.itemStack?.typeId;
  }
  return {
    entityId: entity.id,
    typeId: entity.typeId,
    isPlayer: false,
    nameTag: entity.nameTag,
    isTamed: isTamed(entity),
    isVillagerOrTrader: isVillagerOrTrader(entity.typeId),
    isBoss: isBoss(entity.typeId),
    isArmorStand: entity.typeId === "minecraft:armor_stand",
    isItemEntity,
    itemTypeId,
    isModdedEntity: isModdedNamespace(extractNamespace(entity.typeId)),
    ageTicks,
    distanceToNearestPlayer: nearestPlayerDistance(entity, players),
    ticksSinceLastCombatInvolvement: lastCombat !== void 0 ? system4.currentTick - lastCombat : void 0,
    explicitlyProtectedByConfig: protectedTypeIds.includes(entity.typeId)
  };
}
function rulesFromSettings() {
  const settings = getWorldSettings();
  return {
    ...DEFAULT_PROTECTION_RULES,
    protectNamedEntities: settings.protectNamedEntities,
    protectTamedPets: settings.protectTamedPets,
    protectBosses: settings.protectBosses,
    protectArmorStands: settings.protectArmorStands,
    protectVillagersAndTraders: settings.protectVillagersAndTraders,
    protectEntitiesInCombat: settings.protectEntitiesInCombat,
    protectModdedEntities: settings.protectModdedEntities
  };
}
function passesDespawnGate(signal, settings, thresholds) {
  if (signal.isItemEntity) {
    const farEnough2 = settings.distantDespawnEnabled && signal.distanceToNearestPlayer > thresholds.itemDespawnRadius;
    const staleEnough = signal.ageTicks > thresholds.itemMaxAgeTicks;
    return farEnough2 || staleEnough;
  }
  const farEnough = settings.distantDespawnEnabled && signal.distanceToNearestPlayer > thresholds.mobDespawnRadius;
  const offScreenStale = settings.offScreenDespawnEnabled && signal.ageTicks > thresholds.offScreenGraceTicks && signal.distanceToNearestPlayer > thresholds.mobDespawnRadius / 2;
  return farEnough || offScreenStale;
}
function runScan() {
  const settings = getWorldSettings();
  if (!settings.despawnOptimizationEnabled) return;
  const thresholds = resolveOptimizationThresholds(settings.optimizationMode);
  const rules = rulesFromSettings();
  const players = [...world5.getAllPlayers()];
  for (const dimensionId of ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"]) {
    let entities;
    try {
      entities = [...world5.getDimension(dimensionId).getEntities()];
    } catch {
      continue;
    }
    const candidates = [];
    for (const entity of entities) {
      if (entity.typeId === "minecraft:player") continue;
      const isItem = entity.typeId === "minecraft:item";
      if (!isItem && !isMobFamily(entity)) continue;
      const signal = toSignal(entity, players, settings.protectedEntityTypeIds);
      if (!passesDespawnGate(signal, settings, thresholds)) continue;
      candidates.push({ entity, signal });
    }
    const classified = candidates.map((c) => ({
      entity: c.entity,
      signal: c.signal,
      classification: classifyEntity(c.signal, rules)
    }));
    const selectedIds = new Set(
      selectForRemoval(
        classified.map((c) => ({ signal: c.signal, classification: c.classification })),
        thresholds.removalAggressiveness
      )
    );
    for (const c of classified) {
      if (!selectedIds.has(c.signal.entityId)) continue;
      if (settings.auditModeOnly) {
        pushAudit({ tick: system4.currentTick, entityId: c.signal.entityId, typeId: c.signal.typeId, action: "would-remove", reasonsAvoided: [] });
        continue;
      }
      try {
        c.entity.remove();
        pushAudit({ tick: system4.currentTick, entityId: c.signal.entityId, typeId: c.signal.typeId, action: "removed", reasonsAvoided: [] });
      } catch (err) {
        log(`Failed to remove entity ${c.signal.entityId} (${c.signal.typeId}): ${String(err)}`);
      }
    }
  }
}
function isMobFamily(entity) {
  const excluded = ["minecraft:boat", "minecraft:chest_boat", "minecraft:xp_orb", "minecraft:arrow", "minecraft:trident", "minecraft:fireball", "minecraft:egg", "minecraft:snowball", "minecraft:ender_pearl", "minecraft:fishing_hook", "minecraft:area_effect_cloud"];
  if (excluded.includes(entity.typeId)) return false;
  if (entity.typeId.includes("minecart")) return false;
  return true;
}
function startOptimizationEngine() {
  return safeInterval("optimization-engine", runScan, SCAN_INTERVAL_TICKS);
}

// src/ui/MenuCatalog.ts
var CONTROL_ROOM_MENU = [
  { id: "companion", label: "Hydraulic Companion Bridge & Status", description: "Bridge state, machine inspection, and mod namespaces.", action: "companion" },
  { id: "inventory", label: "UI & Inventory / Recipes", description: "Recipe browser, categories, mass crafting, and transfers.", action: "inventory" },
  { id: "accessories", label: "Trinket Cabinet", description: "Equip compatible accessories and manage active abilities.", action: "accessories" },
  { id: "waypoints", label: "Waypoints & Compass", description: "Manage saved destinations and the active compass target.", action: "waypoints" },
  { id: "field_map", label: "Field Map / Minimap", description: "Open terrain sampling, radar, and waypoint actions.", action: "field_map" },
  { id: "player_settings", label: "Player Settings (Food, Durability, HUDs)", description: "Configure personal HUD and overlay preferences.", action: "player_settings" },
  { id: "world_settings", label: "World Settings (Operator)", description: "Configure world-wide optimization and protection policies.", action: "world_settings", operatorOnly: true },
  { id: "diagnostics", label: "Optimization Diagnostics", description: "Review recent audit entries and cleanup decisions.", action: "diagnostics" },
  { id: "about", label: "About / Unsupported Features", description: "Review supported boundaries and runtime limitations.", action: "about" }
];
function visibleMenuEntries(entries, isOperator2) {
  return entries.filter((entry) => !entry.operatorOnly || isOperator2);
}

// src/ui/HydraulicControlRoom.ts
var UNSUPPORTED_NOTICE = [
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
  "Where relevant, static Resource Pack presets (Aggressive/Extreme) are provided instead."
].join("\n");
async function openHydraulicControlRoom(player) {
  const entries = visibleMenuEntries(CONTROL_ROOM_MENU, isOperator(player));
  const form = new ActionFormData6().title("Hydraulic Control Room").body(
    ["Phlodgate Add-On master settings", "", ...entries.map((entry) => `\xA77${entry.description}`)].join("\n")
  );
  for (const entry of entries) form.button(entry.label);
  try {
    const response = await showFormWithRetry(player, () => form, { context: "Hydraulic Control Room" });
    if (!response) return;
    const selection = readSelection(response);
    if (selection === void 0) return;
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
          () => new MessageFormData3().title("About / Unsupported Features").body(UNSUPPORTED_NOTICE).button1("OK").button2("Close"),
          { context: "Unsupported Features" }
        );
        break;
    }
  } catch (err) {
    log(`Hydraulic Control Room failed to open: ${String(err)}`);
  }
}
async function openDiagnosticsMenu(player) {
  const entries = getAuditLog().slice(-25).reverse();
  const body = entries.length === 0 ? "No optimization actions recorded yet." : entries.map((e) => `[tick ${e.tick}] ${e.action}: ${e.typeId} (${e.entityId})`).join("\n");
  await showFormWithRetry(
    player,
    () => new MessageFormData3().title("Optimization Audit Log (latest 25)").body(body).button1("OK").button2("Close"),
    { context: "Optimization Diagnostics" }
  );
}

// src/features/durability/DurabilityHud.ts
import { EquipmentSlot } from "@minecraft/server";

// src/features/durability/DurabilityMath.ts
function percentRemaining(damage, maxDurability) {
  if (maxDurability <= 0) return 100;
  const remaining = maxDurability - damage;
  return Math.max(0, Math.min(100, remaining / maxDurability * 100));
}
function isLowDurability(damage, maxDurability, thresholdPercent) {
  return percentRemaining(damage, maxDurability) <= thresholdPercent;
}
function formatDurabilityLine(reading, thresholdPercent) {
  const pct = percentRemaining(reading.damage, reading.maxDurability);
  const rounded = Math.round(pct);
  const color = pct <= thresholdPercent ? "\xA7c" : pct <= thresholdPercent * 2 ? "\xA7e" : "\xA7a";
  return `${color}${reading.slot}: ${reading.itemName} ${rounded}%\xA7r`;
}
function sortByLowestFirst(readings) {
  return [...readings].sort(
    (a, b) => percentRemaining(a.damage, a.maxDurability) - percentRemaining(b.damage, b.maxDurability)
  );
}

// src/features/durability/DurabilityHud.ts
var SLOT_LABELS = [
  [EquipmentSlot.Mainhand, "Main Hand"],
  [EquipmentSlot.Offhand, "Off Hand"],
  [EquipmentSlot.Head, "Helmet"],
  [EquipmentSlot.Chest, "Chestplate"],
  [EquipmentSlot.Legs, "Leggings"],
  [EquipmentSlot.Feet, "Boots"]
];
function collectReadings(player) {
  const equippable = player.getComponent("minecraft:equippable");
  if (!equippable) return [];
  const readings = [];
  for (const [slot, label] of SLOT_LABELS) {
    const stack = equippable.getEquipment(slot);
    if (!stack) continue;
    const durability = stack.getComponent("minecraft:durability");
    if (!durability) continue;
    readings.push({
      slot: label,
      itemName: stack.nameTag ?? stack.typeId.replace("minecraft:", ""),
      damage: durability.damage,
      maxDurability: durability.maxDurability
    });
  }
  return readings;
}
function buildDurabilityLines(player) {
  const settings = getPlayerSettings(player);
  if (!settings.durabilityHudEnabled) return void 0;
  const readings = sortByLowestFirst(collectReadings(player));
  if (readings.length === 0) return void 0;
  const lines = readings.map((r) => formatDurabilityLine(r, settings.durabilityAlertThresholdPercent));
  if (settings.durabilityAlertsEnabled) {
    const lowest = readings[0];
    if (isLowDurability(lowest.damage, lowest.maxDurability, settings.durabilityAlertThresholdPercent)) {
      return [`\xA7l\xA74! LOW DURABILITY !\xA7r`, ...lines];
    }
  }
  return lines;
}

// src/features/waypoints/CompassHud.ts
function colorizeCompass(strip) {
  let output = "";
  for (const glyph of strip) {
    if (glyph === "N" || glyph === "S" || glyph === "E" || glyph === "W") output += `\xA76${glyph}`;
    else if (glyph === "\u25B2") output += `\xA7f${glyph}`;
    else if (glyph === "\xB7") output += `\xA78${glyph}`;
    else output += `\xA7e${glyph}`;
  }
  return `${output}\xA7r`;
}
function buildCompassLines(player) {
  const settings = getPlayerSettings(player);
  if (!settings.compassEnabled) return void 0;
  const yaw = player.getRotation().y;
  const yaw360 = (yaw % 360 + 360) % 360;
  const waypoint = getActiveWaypoint(player);
  const markers = [];
  if (waypoint && isSameDimension(waypoint, player.dimension.id)) {
    const from = player.location;
    const to = { x: waypoint.x, y: waypoint.y, z: waypoint.z };
    const bearing = bearingDegrees(from, to);
    markers.push({ glyph: "\u25C6", delta: angularDelta(yaw360, bearing), distance: distanceXZ(from, to) });
  }
  const strip = colorizeCompass(buildRadarStrip(markers, cardinalEntriesForYaw(yaw360, angularDelta)));
  if (!waypoint) return [`\xA77[${strip}\xA77]`];
  if (!isSameDimension(waypoint, player.dimension.id)) return [`\xA77[${strip}\xA77] \xA7c${waypoint.name}: different dimension`];
  const marker = markers[0];
  return [`\xA77[${strip}\xA77] \xA76${arrowForDelta(marker.delta)} ${waypoint.name} \xA7f${formatDistance(marker.distance)}`];
}

// src/features/minimap/MinimapHud.ts
import { system as system5 } from "@minecraft/server";
var RADAR_MAX_LISTED = 3;
var COMPANION_VECTOR_PROPERTY = "phlodgate:companion_vectors";
var MAX_COMPANION_TARGETS = 8;
var HUD_GRID_WIDTH = 21;
function buildTerrainLines(player, shape, cellSize, markers) {
  try {
    const location = player.location;
    const grid = sampleTerrainGrid(
      player.dimension,
      Math.floor(location.x),
      Math.floor(location.z),
      system5.currentTick,
      cellSize,
      HUD_GRID_WIDTH
    );
    return formatTerrainGridPixels(grid, shape, markers);
  } catch {
    return ["\xA78Terrain map unavailable"];
  }
}
function buildMinimapLines(player) {
  const settings = getPlayerSettings(player);
  if (!settings.minimapEnabled) return void 0;
  const from = player.location;
  const zoom = [1, 2, 4, 8].includes(settings.minimapScale) ? settings.minimapScale : 1;
  const cellSize = cellSizeForMinimapScale(zoom);
  const yaw360 = (player.getRotation().y % 360 + 360) % 360;
  const parsedCompanionTargets = parseCompanionVectorPayload(player.getDynamicProperty(COMPANION_VECTOR_PROPERTY));
  const companionTargets = parsedCompanionTargets.filter((target) => {
    if (isHiddenMapTarget(target.kind) || isHiddenMapTarget(target.category)) return false;
    const distance = Math.hypot(target.x, target.z);
    const range = target.range;
    if (range?.min !== void 0 && distance < range.min) return false;
    if (range?.max !== void 0 && distance > range.max) return false;
    return distance <= settings.minimapRadius;
  }).slice(0, MAX_COMPANION_TARGETS).map((target) => {
    const to = { x: from.x + target.x, y: from.y, z: from.z + target.z };
    const bearing = bearingDegrees(from, to);
    const distance = distanceXZ(from, to);
    return {
      name: target.label ?? target.name,
      glyph: (target.glyph || target.name || "?").trim().charAt(0).toUpperCase() || "?",
      delta: angularDelta(yaw360, bearing),
      distance,
      kind: target.kind
    };
  });
  const entries = [
    ...listWaypoints(player).filter((w) => isSameDimension(w, player.dimension.id)).map((w) => {
      const to = { x: w.x, y: w.y, z: w.z };
      const bearing = bearingDegrees(from, to);
      return {
        name: w.name,
        glyph: w.name.trim().charAt(0).toUpperCase() || "?",
        delta: angularDelta(yaw360, bearing),
        distance: distanceXZ(from, to),
        kind: "waypoint"
      };
    }),
    ...companionTargets
  ].filter((e) => withinRadius(e.distance, settings.minimapRadius));
  const terrainMarkers = listWaypoints(player).filter((waypoint) => isSameDimension(waypoint, player.dimension.id)).map((waypoint) => ({ x: waypoint.x, z: waypoint.z, glyph: waypoint.name })).concat(
    parsedCompanionTargets.filter((target) => {
      if (isHiddenMapTarget(target.kind) || isHiddenMapTarget(target.category)) return false;
      return Math.hypot(target.x, target.z) <= settings.minimapRadius;
    }).slice(0, MAX_COMPANION_TARGETS).map((target) => ({
      x: from.x + target.x,
      z: from.z + target.z,
      glyph: target.glyph || target.name
    }))
  );
  const lines = [`\xA7fMAP \xA77${zoom}x`, ...buildTerrainLines(player, settings.minimapShape, cellSize, terrainMarkers)];
  if (entries.length === 0) {
    lines.push(`\xA78No waypoints within ${settings.minimapRadius} blocks`);
  } else {
    for (const e of nearestEntries(entries, RADAR_MAX_LISTED)) {
      const kindPrefix = getCompanionTargetColor(e.kind);
      lines.push(`\xA76${arrowForDelta(e.delta)} ${kindPrefix}${e.name} \xA77${formatDistance(e.distance)}`);
    }
  }
  return lines;
}

// src/features/waypoints/CoordinatesMath.ts
function formatCoordinateSnapshot(snapshot) {
  const dimension = snapshot.dimensionId.replace("minecraft:", "");
  return `\xA7bXYZ \xA7f${Math.floor(snapshot.x)}, ${Math.floor(snapshot.y)}, ${Math.floor(snapshot.z)} \xA77(${dimension})`;
}

// src/features/waypoints/CoordinatesHud.ts
function buildCoordinatesLines(player) {
  const settings = getPlayerSettings(player);
  if (!settings.coordinatesHudEnabled) return void 0;
  return [
    formatCoordinateSnapshot({
      x: player.location.x,
      y: player.location.y,
      z: player.location.z,
      dimensionId: player.dimension.id
    })
  ];
}

// src/ui/HudManager.ts
var HUD_TEXT_PROPERTY = "phlodgate:hud_text";
var NO_SUBTITLE_TITLE = " ";
var SUBTITLE_STAY_DURATION_TICKS = 72e6;
var subtitleInitialized = /* @__PURE__ */ new Map();
var MINIMAP_ROUTING_MARKERS = {
  top_left: { small: "[PGL:TL1]", large: "[PGL:TL2]" },
  top_right: { small: "[PGL:TR1]", large: "[PGL:TR2]" },
  bottom_left: { small: "[PGL:BL1]", large: "[PGL:BL2]" },
  bottom_right: { small: "[PGL:BR1]", large: "[PGL:BR2]" }
};
function composeMinimapBox(player) {
  const sections = [buildMinimapLines(player), buildCoordinatesLines(player), buildDurabilityLines(player)].filter((s) => s !== void 0).map((lines) => lines.join("\n"));
  if (sections.length === 0) return void 0;
  return sections.join("\n\xA78--------\xA7r\n");
}
function composeCompassSubtitle(player) {
  const lines = buildCompassLines(player);
  return lines ? lines.join(" ") : "";
}
function updateCompassChannel(player, text) {
  const last = subtitleInitialized.get(player.id);
  if (last === text) return;
  try {
    if (last === void 0) {
      player.onScreenDisplay.setTitle(NO_SUBTITLE_TITLE, {
        subtitle: text,
        fadeInDuration: 0,
        fadeOutDuration: 0,
        stayDuration: SUBTITLE_STAY_DURATION_TICKS
      });
    } else {
      player.onScreenDisplay.updateSubtitle(text);
    }
    subtitleInitialized.set(player.id, text);
  } catch {
  }
}
function clearHudStateForPlayer(playerId) {
  subtitleInitialized.delete(playerId);
}
function startHudManager(getPlayers) {
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
          const positionedText = `${MINIMAP_ROUTING_MARKERS[settings.minimapPosition][settings.minimapSize]}${text}`;
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

// src/features/optimization/ItemMerge.ts
import { ItemStack as ItemStack4, world as world6 } from "@minecraft/server";

// src/features/optimization/ItemMergePlan.ts
function distanceSquared(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}
function bucketKey(typeId, x, y, z, cellSize) {
  return `${typeId}:${Math.floor(x / cellSize)}:${Math.floor(y / cellSize)}:${Math.floor(z / cellSize)}`;
}
function planItemMerges(items, radius, cap) {
  if (radius <= 0 || cap <= 0) return [];
  const buckets = /* @__PURE__ */ new Map();
  for (const item of items) {
    if (item.count <= 0) continue;
    const key = bucketKey(item.typeId, item.x, item.y, item.z, radius);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  }
  const consumed = /* @__PURE__ */ new Set();
  const groups = [];
  const radiusSquared = radius * radius;
  for (const anchor of items) {
    if (consumed.has(anchor.id) || anchor.count <= 0) continue;
    let totalCount = anchor.count;
    const consumedIds = [];
    const cellX = Math.floor(anchor.x / radius);
    const cellY = Math.floor(anchor.y / radius);
    const cellZ = Math.floor(anchor.z / radius);
    for (let dx = -1; dx <= 1 && totalCount < cap; dx++) {
      for (let dy = -1; dy <= 1 && totalCount < cap; dy++) {
        for (let dz = -1; dz <= 1 && totalCount < cap; dz++) {
          const candidates = buckets.get(`${anchor.typeId}:${cellX + dx}:${cellY + dy}:${cellZ + dz}`) ?? [];
          for (const candidate of candidates) {
            if (candidate.id === anchor.id || consumed.has(candidate.id) || candidate.typeId !== anchor.typeId) continue;
            if (distanceSquared(anchor, candidate) > radiusSquared) continue;
            if (totalCount + candidate.count > cap) continue;
            consumed.add(candidate.id);
            consumedIds.push(candidate.id);
            totalCount += candidate.count;
            if (totalCount >= cap) break;
          }
        }
      }
    }
    if (consumedIds.length > 0) {
      consumed.add(anchor.id);
      groups.push({ typeId: anchor.typeId, anchorId: anchor.id, consumedIds, totalCount, x: anchor.x, y: anchor.y, z: anchor.z });
    }
  }
  return groups;
}

// src/features/optimization/ItemMerge.ts
var MERGE_INTERVAL_TICKS = 60;
function mergeInDimension(dimensionId, radius, cap) {
  let items;
  try {
    items = [...world6.getDimension(dimensionId).getEntities({ type: "minecraft:item" })];
  } catch {
    return;
  }
  const snapshots = items.flatMap((item) => {
    const stack = item.getComponent("minecraft:item")?.itemStack;
    return stack ? [{ id: item.id, typeId: stack.typeId, count: stack.amount, x: item.location.x, y: item.location.y, z: item.location.z }] : [];
  });
  const byId = new Map(items.map((item) => [item.id, item]));
  for (const group of planItemMerges(snapshots, radius, Math.min(cap, 64))) {
    const anchor = byId.get(group.anchorId);
    const merged = group.consumedIds.map((id) => byId.get(id)).filter((item) => item !== void 0);
    if (!anchor || merged.length === 0) continue;
    try {
      const newStack = new ItemStack4(group.typeId, group.totalCount);
      const spawnLocation = anchor.location;
      const dimension = anchor.dimension;
      anchor.remove();
      for (const other of merged) {
        other.remove();
      }
      dimension.spawnItem(newStack, spawnLocation);
    } catch (err) {
      log(`Item merge failed for ${group.typeId}: ${String(err)}`);
    }
  }
}
function runMergePass() {
  const settings = getWorldSettings();
  if (!settings.itemMergingEnabled) return;
  const thresholds = resolveOptimizationThresholds(settings.optimizationMode);
  for (const dimensionId of ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"]) {
    mergeInDimension(dimensionId, thresholds.itemMergeRadius, thresholds.itemMergeCap);
  }
}
function startItemMerging() {
  return safeInterval("item-merging", runMergePass, MERGE_INTERVAL_TICKS);
}

// src/features/fog/FogController.ts
import { world as world7 } from "@minecraft/server";
var FOG_USER_ID = "phlodgate_mode";
var CHECK_INTERVAL_TICKS = 40;
var lastFogIdByPlayer = /* @__PURE__ */ new Map();
function desiredFogIdentifier(settings) {
  if (!settings.fogOptimizerEnabled) return void 0;
  if (settings.extremeFpsMode) return "phlodgate:extreme_fps_fog";
  return resolveFogThresholds(settings.optimizationMode).fogIdentifier;
}
function applyFog(player, fogId) {
  const current = lastFogIdByPlayer.get(player.id);
  if (current === fogId) return;
  try {
    if (current) {
      player.runCommand(`fog @s pop ${FOG_USER_ID}`);
    }
    if (fogId) {
      player.runCommand(`fog @s push ${fogId} ${FOG_USER_ID}`);
      lastFogIdByPlayer.set(player.id, fogId);
    } else {
      lastFogIdByPlayer.delete(player.id);
    }
  } catch (err) {
    log(`Fog command failed for ${player.name}: ${String(err)}`);
  }
}
function runFogPass() {
  const settings = getWorldSettings();
  const fogId = desiredFogIdentifier(settings);
  for (const player of world7.getAllPlayers()) {
    applyFog(player, fogId);
  }
}
function startFogController() {
  return safeInterval("fog-controller", runFogPass, CHECK_INTERVAL_TICKS);
}
function clearFogTrackingForPlayer(playerId) {
  lastFogIdByPlayer.delete(playerId);
}

// src/features/companion/CompanionRuntime.ts
import { system as system6, world as world8 } from "@minecraft/server";

// src/features/inventory/ModdedRecipes.ts
var HYDRAULIC_TEST_RECIPES = [
  {
    id: "hydraulic_golden_barrel",
    category: "hydraulic_machines",
    outputTypeId: "hydraulic_test_mod:golden_barrel",
    outputCount: 1,
    ingredients: [
      { typeId: "minecraft:gold_ingot", count: 8 },
      { typeId: "minecraft:barrel", count: 1 }
    ]
  },
  {
    id: "hydraulic_item_transfer_machine",
    category: "hydraulic_machines",
    outputTypeId: "hydraulic_test_mod:item_transfer_machine",
    outputCount: 1,
    ingredients: [
      { typeId: "minecraft:iron_ingot", count: 4 },
      { typeId: "minecraft:hopper", count: 1 },
      { typeId: "minecraft:redstone", count: 2 }
    ]
  },
  {
    id: "hydraulic_processing_machine",
    category: "hydraulic_machines",
    outputTypeId: "hydraulic_test_mod:processing_machine",
    outputCount: 1,
    ingredients: [
      { typeId: "minecraft:cobblestone", count: 4 },
      { typeId: "minecraft:furnace", count: 1 },
      { typeId: "minecraft:iron_ingot", count: 2 }
    ]
  },
  {
    id: "hydraulic_fluid_machine",
    category: "hydraulic_machines",
    outputTypeId: "hydraulic_test_mod:fluid_machine",
    outputCount: 1,
    ingredients: [
      { typeId: "minecraft:bucket", count: 2 },
      { typeId: "minecraft:iron_ingot", count: 4 },
      { typeId: "minecraft:glass", count: 1 }
    ]
  },
  {
    id: "hydraulic_energy_machine",
    category: "hydraulic_machines",
    outputTypeId: "hydraulic_test_mod:energy_machine",
    outputCount: 1,
    ingredients: [
      { typeId: "minecraft:copper_ingot", count: 4 },
      { typeId: "minecraft:redstone_block", count: 1 },
      { typeId: "minecraft:iron_ingot", count: 2 }
    ]
  },
  {
    id: "hydraulic_menu_machine",
    category: "hydraulic_machines",
    outputTypeId: "hydraulic_test_mod:menu_machine",
    outputCount: 1,
    ingredients: [
      { typeId: "minecraft:iron_ingot", count: 4 },
      { typeId: "minecraft:comparator", count: 1 },
      { typeId: "minecraft:crafting_table", count: 1 }
    ]
  }
];

// src/features/companion/CompanionRuntime.ts
var POLL_INTERVAL_TICKS = 120;
function scanRuntimeEnvironment() {
  const worldSettings = getWorldSettings();
  const evidence = {
    worldTags: [],
    moddedNamespacesInInventory: [],
    moddedNamespacesInWorld: [],
    scoreboards: []
  };
  try {
    const bridgeProp = world8.getDynamicProperty("phlodgate:bridge") ?? world8.getDynamicProperty("hydraulic:version");
    if (bridgeProp !== void 0) {
      evidence.hasWorldDynamicProperty = true;
      evidence.dynamicPropertyKey = "phlodgate:bridge";
      evidence.dynamicPropertyValue = String(bridgeProp);
    }
  } catch {
  }
  try {
    const signalObjective = findCompanionSignalObjective(world8.scoreboard.getObjectives().map((objective) => objective.id));
    if (signalObjective) {
      evidence.scoreboards = [signalObjective];
    }
  } catch {
  }
  try {
    const invTypeIds = [];
    for (const player of world8.getAllPlayers()) {
      const invComp = player.getComponent("minecraft:inventory");
      const container = invComp?.container;
      if (container) {
        for (let i = 0; i < container.size; i++) {
          const item = container.getItem(i);
          if (item?.typeId) invTypeIds.push(item.typeId);
        }
      }
    }
    evidence.moddedNamespacesInInventory = extractModdedNamespaces(invTypeIds);
  } catch {
  }
  const status = evaluateCompanionStatus(worldSettings.companionMode, evidence, system6.currentTick);
  updateCachedCompanionStatus(status);
  if (status.active) {
    registerModdedRecipes(HYDRAULIC_TEST_RECIPES);
  }
  return status;
}
function startCompanionDetector() {
  try {
    const initialStatus = scanRuntimeEnvironment();
    log(`Companion detector initialized. Status: ${initialStatus.active ? "Companion Active" : "Standalone"}`);
  } catch (err) {
    log(`Companion detector initial scan failed: ${String(err)}`);
  }
  safeInterval(
    "CompanionDetector.poll",
    () => {
      try {
        scanRuntimeEnvironment();
      } catch (err) {
        log(`Companion detector periodic poll error: ${String(err)}`);
      }
    },
    POLL_INTERVAL_TICKS
  );
}

// src/features/companion/CompanionPetRuntime.ts
import {
  InputPermissionCategory,
  system as system7,
  world as world9
} from "@minecraft/server";
import { ActionFormData as ActionFormData7, ModalFormData as ModalFormData6 } from "@minecraft/server-ui";

// src/features/companion/CompanionPetPlan.ts
function babyAnimal(id, label) {
  return {
    id,
    entityTypeId: `phlodgate:companion_${id}`,
    label,
    description: `A tame, always-neutral ${label.toLowerCase()} companion that follows, sits on command, and never grows up.`,
    defaultName: `Companion ${label}`,
    category: "baby_animal",
    rideable: false
  };
}
var COMPANION_SPECIES = [
  {
    id: "wolf",
    entityTypeId: "phlodgate:companion_wolf",
    label: "Wolf",
    description: "A loyal wolf companion that follows, sits on command, and never leaves your side.",
    defaultName: "Companion Wolf",
    category: "companion",
    rideable: false
  },
  {
    id: "cat",
    entityTypeId: "phlodgate:companion_cat",
    label: "Cat",
    description: "A calm cat companion that follows, sits on command, and never leaves your side.",
    defaultName: "Companion Cat",
    category: "companion",
    rideable: false
  },
  {
    id: "fox",
    entityTypeId: "phlodgate:companion_fox",
    label: "Fox",
    description: "A quiet fox companion that follows, sits on command, and never leaves your side.",
    defaultName: "Companion Fox",
    category: "companion",
    rideable: false
  },
  {
    id: "snow_fox",
    entityTypeId: "phlodgate:companion_snow_fox",
    label: "Snow Fox",
    description: "An arctic fox companion that follows, sits on command, and never leaves your side.",
    defaultName: "Companion Snow Fox",
    category: "companion",
    rideable: false
  },
  {
    id: "creaking",
    entityTypeId: "phlodgate:companion_creaking",
    label: "Creaking",
    description: "A silent, always-neutral creaking companion that follows, sits on command, and never leaves your side.",
    defaultName: "Companion Creaking",
    category: "companion",
    rideable: false
  },
  {
    id: "rabbit",
    entityTypeId: "phlodgate:companion_rabbit",
    label: "Rabbit",
    description: "A small rabbit companion that follows, sits on command, and never leaves your side.",
    defaultName: "Companion Rabbit",
    category: "companion",
    rideable: false
  },
  {
    id: "spider",
    entityTypeId: "phlodgate:companion_spider",
    label: "Spider (rideable)",
    description: "A tame, always-neutral spider companion you can ride any time \u2014 no saddle required.",
    defaultName: "Companion Spider",
    category: "companion",
    rideable: true
  },
  {
    id: "cave_spider",
    entityTypeId: "phlodgate:companion_cave_spider",
    label: "Cave Spider",
    description: "A small, always-neutral cave spider companion that follows, sits on command, and never leaves your side.",
    defaultName: "Companion Cave Spider",
    category: "companion",
    rideable: false
  },
  {
    id: "sniffer",
    entityTypeId: "phlodgate:companion_sniffer",
    label: "Sniffer (rideable)",
    description: "A tame, always-neutral sniffer companion you can ride any time \u2014 no saddle required.",
    defaultName: "Companion Sniffer",
    category: "companion",
    rideable: true
  },
  {
    id: "ravager",
    entityTypeId: "phlodgate:companion_ravager",
    label: "Ravager (rideable)",
    description: "A tame, always-neutral ravager companion you can ride any time \u2014 no saddle required.",
    defaultName: "Companion Ravager",
    category: "companion",
    rideable: true
  },
  {
    id: "copper_golem",
    entityTypeId: "phlodgate:companion_copper_golem",
    label: "Copper Golem",
    description: "A tame, always-neutral copper golem companion that follows, sits on command, and never leaves your side.",
    defaultName: "Companion Copper Golem",
    category: "companion",
    rideable: false
  },
  {
    id: "zoglin",
    entityTypeId: "phlodgate:companion_zoglin",
    label: "Zoglin",
    description: "A tame, always-neutral zoglin companion that follows, sits on command, and never leaves your side.",
    defaultName: "Companion Zoglin",
    category: "companion",
    rideable: false
  },
  {
    id: "axolotl",
    entityTypeId: "phlodgate:companion_axolotl",
    label: "Axolotl",
    description: "A tame, always-neutral axolotl companion that follows, sits on command, and never leaves your side.",
    defaultName: "Companion Axolotl",
    category: "companion",
    rideable: false
  },
  {
    id: "baby_piglin",
    entityTypeId: "phlodgate:companion_baby_piglin",
    label: "Baby Piglin",
    description: "A tame, always-neutral baby piglin companion, immune to zombification, that follows, sits on command, and never leaves your side.",
    defaultName: "Companion Baby Piglin",
    category: "companion",
    rideable: false
  },
  ...[
    babyAnimal("baby_armadillo", "Baby Armadillo"),
    babyAnimal("baby_axolotl", "Baby Axolotl"),
    babyAnimal("baby_bee", "Baby Bee"),
    babyAnimal("baby_camel", "Baby Camel"),
    babyAnimal("baby_cat", "Baby Cat"),
    babyAnimal("baby_chicken", "Baby Chicken"),
    babyAnimal("baby_cow", "Baby Cow"),
    babyAnimal("baby_donkey", "Baby Donkey"),
    babyAnimal("baby_fox", "Baby Fox"),
    babyAnimal("baby_goat", "Baby Goat"),
    babyAnimal("baby_hoglin", "Baby Hoglin"),
    babyAnimal("baby_horse", "Baby Horse"),
    babyAnimal("baby_llama", "Baby Llama"),
    babyAnimal("baby_mooshroom", "Baby Mooshroom"),
    babyAnimal("baby_mule", "Baby Mule"),
    babyAnimal("baby_ocelot", "Baby Ocelot"),
    babyAnimal("baby_panda", "Baby Panda"),
    babyAnimal("baby_pig", "Baby Pig"),
    babyAnimal("baby_polar_bear", "Baby Polar Bear"),
    babyAnimal("baby_rabbit", "Baby Rabbit"),
    babyAnimal("baby_sheep", "Baby Sheep"),
    babyAnimal("baby_sniffer", "Baby Sniffer"),
    babyAnimal("baby_strider", "Baby Strider"),
    babyAnimal("baby_turtle", "Baby Turtle"),
    babyAnimal("baby_wolf", "Baby Wolf"),
    babyAnimal("tadpole", "Tadpole")
  ]
];
var DEFAULT_COMPANION_SPECIES_ID = "wolf";
function findCompanionSpecies(id) {
  return COMPANION_SPECIES.find((species) => species.id === id);
}
function decideCompanionInteraction(isOwner, isSneaking) {
  if (!isOwner) return "deny_not_owner";
  return isSneaking ? "open_control_room" : "allow_default_interaction";
}
function computeCompanionSpawnLocation(playerLocation, yawDegrees, backDistance = 1.5) {
  const yawRad = yawDegrees * Math.PI / 180;
  const forwardX = -Math.sin(yawRad);
  const forwardZ = Math.cos(yawRad);
  return {
    x: playerLocation.x - forwardX * backDistance,
    y: playerLocation.y,
    z: playerLocation.z - forwardZ * backDistance
  };
}

// src/features/companion/CompanionPetRuntime.ts
var COMPANION_TAG = "phlodgate:companion";
var OWNER_ID_PROPERTY = "phlodgate:ownerId";
var SPECIES_ID_PROPERTY = "phlodgate:speciesId";
var COMPANION_SPECIES_PLAYER_PROPERTY = "phlodgate:companionSpecies";
var COMPANION_ENTITY_PLAYER_PROPERTY = "phlodgate:companionEntityId";
var RESPAWN_DELAY_TICKS = 40;
var FORCED_CHOICE_RETRY_TICKS = 30;
var onboardingPlayers = /* @__PURE__ */ new Set();
function isCompanionEntity(entity) {
  return !!entity && entity.isValid && entity.hasTag(COMPANION_TAG);
}
function spawnCompanion(player, species) {
  let entity;
  try {
    const rotation = player.getRotation();
    const location = computeCompanionSpawnLocation(player.location, rotation.y);
    entity = player.dimension.spawnEntity(species.entityTypeId, location);
    entity.nameTag = species.defaultName;
    entity.addTag(COMPANION_TAG);
    entity.setDynamicProperty(OWNER_ID_PROPERTY, player.id);
    entity.setDynamicProperty(SPECIES_ID_PROPERTY, species.id);
    const tameable = entity.getComponent("minecraft:tameable");
    if (!tameable?.tame(player)) throw new Error("entity could not be assigned to its owner");
    player.setDynamicProperty(COMPANION_ENTITY_PLAYER_PROPERTY, entity.id);
    log(`Spawned companion ${species.entityTypeId} for ${player.name}.`);
    return entity;
  } catch (err) {
    try {
      if (entity?.isValid) entity.remove();
    } catch {
    }
    log(`Failed to spawn companion ${species.entityTypeId} for ${player.name}: ${String(err)}`);
    return void 0;
  }
}
async function promptCompanionName(player, entity, species) {
  const form = new ModalFormData6().title("Name Your Companion").textField("Companion name", species.defaultName, { defaultValue: species.defaultName });
  const response = await showFormWithRetry(player, () => form, { context: "Companion naming" });
  if (!response) return;
  const values = readModalValues(response, 1);
  if (!values) return;
  const requestedName = String(values[0] ?? "").trim();
  if (!requestedName || !entity.isValid) return;
  entity.nameTag = requestedName.slice(0, 32);
}
function buildCompanionCategoryForm() {
  return new ActionFormData7().title("Choose Your Companion").body("You must pick a bound companion before you can play.").button("Companions\n\xA77Adults, special creatures, and mounts").button("Baby Animals\n\xA77Passive animal babies");
}
function buildCompanionChoiceForm(speciesOptions) {
  const form = new ActionFormData7().title("Choose Your Companion").body(
    "You must pick a bound companion before you can play. It is invulnerable, always neutral, and follows you. Shift+click it any time to open the Hydraulic Control Room."
  );
  for (const species of speciesOptions) form.button(`${species.label}
\xA77${species.description}`);
  return form;
}
function setOnboardingMovement(player, enabled) {
  try {
    player.inputPermissions.setPermissionCategory(InputPermissionCategory.Movement, enabled);
  } catch (err) {
    log(`Failed to ${enabled ? "restore" : "lock"} movement during companion onboarding for ${player.name}: ${String(err)}`);
  }
}
function scheduleForcedCompanionChoice(player) {
  if (!player.isValid) return;
  if (onboardingPlayers.has(player.id)) return;
  onboardingPlayers.add(player.id);
  setOnboardingMovement(player, false);
  const prompt = () => {
    if (!player.isValid) {
      onboardingPlayers.delete(player.id);
      return;
    }
    void (async () => {
      let categoryResponse;
      try {
        categoryResponse = await buildCompanionCategoryForm().show(player);
      } catch (err) {
        log(`Companion choice form failed for ${player.name}: ${String(err)}`);
        categoryResponse = void 0;
      }
      if (!player.isValid) return;
      const categorySelection = categoryResponse ? readSelection(categoryResponse) : void 0;
      if (categorySelection === void 0 || categorySelection > 1) {
        system7.runTimeout(prompt, FORCED_CHOICE_RETRY_TICKS);
        return;
      }
      const category = categorySelection === 0 ? "companion" : "baby_animal";
      const speciesOptions = COMPANION_SPECIES.filter((species2) => species2.category === category);
      let choiceResponse;
      try {
        choiceResponse = await buildCompanionChoiceForm(speciesOptions).show(player);
      } catch (err) {
        log(`Companion species form failed for ${player.name}: ${String(err)}`);
        choiceResponse = void 0;
      }
      if (!player.isValid) return;
      const selection = choiceResponse ? readSelection(choiceResponse) : void 0;
      if (selection === void 0) {
        system7.runTimeout(prompt, FORCED_CHOICE_RETRY_TICKS);
        return;
      }
      const species = speciesOptions[selection] ?? findCompanionSpecies(DEFAULT_COMPANION_SPECIES_ID);
      const entity = spawnCompanion(player, species);
      if (!entity) {
        system7.runTimeout(prompt, FORCED_CHOICE_RETRY_TICKS);
        return;
      }
      player.setDynamicProperty(COMPANION_SPECIES_PLAYER_PROPERTY, species.id);
      onboardingPlayers.delete(player.id);
      setOnboardingMovement(player, true);
      system7.run(() => {
        void promptCompanionName(player, entity, species).catch(
          (err) => log(`Companion naming prompt failed for ${player.name}: ${String(err)}`)
        );
      });
    })();
  };
  system7.runTimeout(prompt, 20);
}
function handlePlayerSpawn(player) {
  try {
    const selectedSpeciesId = player.getDynamicProperty(COMPANION_SPECIES_PLAYER_PROPERTY);
    const selectedSpecies = typeof selectedSpeciesId === "string" ? findCompanionSpecies(selectedSpeciesId) : void 0;
    if (selectedSpecies) {
      setOnboardingMovement(player, true);
      const entityId = player.getDynamicProperty(COMPANION_ENTITY_PLAYER_PROPERTY);
      const existing = typeof entityId === "string" ? world9.getEntity(entityId) : void 0;
      if (!isCompanionEntity(existing)) system7.runTimeout(() => spawnCompanion(player, selectedSpecies), 20);
      return;
    }
    scheduleForcedCompanionChoice(player);
  } catch (err) {
    log(`Failed to evaluate companion grant for ${player.name}: ${String(err)}`);
  }
}
function handleInteract(event) {
  if (!isCompanionEntity(event.target)) return;
  let ownerId;
  try {
    ownerId = event.target.getDynamicProperty(OWNER_ID_PROPERTY);
  } catch (err) {
    log(`Failed to read companion owner id: ${String(err)}`);
    event.cancel = true;
    return;
  }
  const isOwner = typeof ownerId === "string" && ownerId === event.player.id;
  const action = decideCompanionInteraction(isOwner, event.player.isSneaking);
  if (action === "deny_not_owner") {
    event.cancel = true;
    return;
  }
  if (action === "open_control_room") {
    event.cancel = true;
    const player = event.player;
    system7.run(() => {
      void openHydraulicControlRoom(player).catch((err) => log(`Companion-triggered Control Room failed to open: ${String(err)}`));
    });
    return;
  }
}
function handleEntityHurt(event) {
  if (isCompanionEntity(event.hurtEntity)) event.cancel = true;
}
function handleEntityDie(deadEntity) {
  let ownerId;
  let speciesId;
  let name;
  try {
    if (!deadEntity.hasTag(COMPANION_TAG)) return;
    ownerId = deadEntity.getDynamicProperty(OWNER_ID_PROPERTY);
    speciesId = deadEntity.getDynamicProperty(SPECIES_ID_PROPERTY);
    name = deadEntity.nameTag;
  } catch {
    return;
  }
  if (typeof ownerId !== "string" || typeof speciesId !== "string") return;
  const species = COMPANION_SPECIES.find((s) => s.id === speciesId);
  if (!species) return;
  system7.runTimeout(() => {
    const owner = [...world9.getAllPlayers()].find((p) => p.id === ownerId);
    if (!owner) return;
    const respawned = spawnCompanion(owner, species);
    if (respawned && name) respawned.nameTag = name;
  }, RESPAWN_DELAY_TICKS);
}
function registerCompanionPetSystem() {
  world9.afterEvents.playerSpawn.subscribe((event) => {
    if (!event.initialSpawn) return;
    handlePlayerSpawn(event.player);
  });
  world9.beforeEvents.playerInteractWithEntity.subscribe(handleInteract);
  world9.beforeEvents.entityHurt.subscribe(handleEntityHurt);
  world9.afterEvents.entityDie.subscribe((event) => handleEntityDie(event.deadEntity));
  world9.afterEvents.playerLeave.subscribe((event) => onboardingPlayers.delete(event.playerId));
}

// src/features/lootr/LootrRuntime.ts
import {
  ItemStack as ItemStack5,
  system as system8,
  world as world10
} from "@minecraft/server";

// src/features/lootr/LootrPlan.ts
var MAX_TRACKED_CONTAINERS = 192;
var MAX_SERIALIZED_LENGTH = 28e3;
function containerKey(dimensionId, x, y, z) {
  return `${dimensionId}:${Math.floor(x)}:${Math.floor(y)}:${Math.floor(z)}`;
}
function sanitizeEnchantments(raw) {
  if (!Array.isArray(raw)) return void 0;
  const result = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const candidate = entry;
    const id = typeof candidate.id === "string" ? candidate.id : void 0;
    const level = Number(candidate.level);
    if (!id || !Number.isFinite(level) || level <= 0) continue;
    result.push({ id, level: Math.min(255, Math.floor(level)) });
  }
  return result.length > 0 ? result : void 0;
}
function sanitizeDescriptor(raw) {
  if (!raw || typeof raw !== "object") return void 0;
  const candidate = raw;
  const typeId = typeof candidate.typeId === "string" ? candidate.typeId.trim() : "";
  const slot = Number(candidate.slot);
  const amount = Number(candidate.amount);
  if (!typeId || !Number.isInteger(slot) || slot < 0 || !Number.isFinite(amount) || amount <= 0) return void 0;
  const descriptor = { slot, typeId, amount: Math.min(255, Math.floor(amount)) };
  if (typeof candidate.nameTag === "string" && candidate.nameTag.length > 0) {
    descriptor.nameTag = candidate.nameTag.slice(0, 64);
  }
  if (Array.isArray(candidate.lore)) {
    const lore = candidate.lore.filter((line) => typeof line === "string").slice(0, 8);
    if (lore.length > 0) descriptor.lore = lore;
  }
  const damage = Number(candidate.damage);
  if (Number.isFinite(damage) && damage > 0) descriptor.damage = Math.floor(damage);
  const enchantments = sanitizeEnchantments(candidate.enchantments);
  if (enchantments) descriptor.enchantments = enchantments;
  return descriptor;
}
function sanitizeDescriptorList(raw) {
  if (!Array.isArray(raw)) return [];
  const result = [];
  for (const entry of raw) {
    const descriptor = sanitizeDescriptor(entry);
    if (descriptor) result.push(descriptor);
  }
  return result;
}
function parseLootrState(raw) {
  if (!raw || raw.trim() === "") return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const state = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!value || typeof value !== "object") continue;
      const record = value;
      const players = {};
      if (record.players && typeof record.players === "object" && !Array.isArray(record.players)) {
        for (const [playerId, items] of Object.entries(record.players)) {
          if (typeof playerId !== "string" || playerId.length === 0) continue;
          players[playerId] = sanitizeDescriptorList(items);
        }
      }
      const touched = Number(record.touched);
      state[key] = {
        snapshot: sanitizeDescriptorList(record.snapshot),
        players,
        lastOpener: typeof record.lastOpener === "string" ? record.lastOpener : void 0,
        touched: Number.isFinite(touched) ? touched : 0
      };
    }
    return state;
  } catch {
    return {};
  }
}
function serializeLootrState(state) {
  const entries = Object.entries(state).sort((a, b) => b[1].touched - a[1].touched);
  let kept = entries.slice(0, MAX_TRACKED_CONTAINERS);
  let serialized = JSON.stringify(Object.fromEntries(kept));
  while (serialized.length > MAX_SERIALIZED_LENGTH && kept.length > 0) {
    kept = kept.slice(0, kept.length - 1);
    serialized = JSON.stringify(Object.fromEntries(kept));
  }
  return serialized;
}
function decideOpenAction(record, playerId) {
  if (!playerId) return { kind: "none" };
  if (!record) return { kind: "snapshot", loadFor: playerId };
  if (record.lastOpener === playerId) return { kind: "none" };
  return { kind: "load", loadFor: playerId, persistFor: record.lastOpener };
}
function copyForPlayer(record, playerId) {
  const existing = record.players[playerId];
  const source = existing ?? record.snapshot;
  return source.map((item) => ({ ...item }));
}
function rollTrinketDrop(roll, pick, chancePercent, trinketIds) {
  if (trinketIds.length === 0) return void 0;
  if (!Number.isFinite(roll) || !Number.isFinite(pick)) return void 0;
  const chance = Math.min(100, Math.max(0, chancePercent));
  if (chance <= 0) return void 0;
  if (roll * 100 >= chance) return void 0;
  const index = Math.min(trinketIds.length - 1, Math.max(0, Math.floor(pick * trinketIds.length)));
  return trinketIds[index];
}
function withTrinketInserted(items, trinketTypeId, containerSize) {
  const used = new Set(items.map((item) => item.slot));
  for (let slot = 0; slot < containerSize; slot++) {
    if (used.has(slot)) continue;
    return [...items.map((item) => ({ ...item })), { slot, typeId: trinketTypeId, amount: 1 }];
  }
  return items.map((item) => ({ ...item }));
}

// src/features/lootr/LootrRuntime.ts
var LOOTR_STATE_PROPERTY = "phlodgate:lootr_state";
var PLACED_CONTAINERS_PROPERTY = "phlodgate:lootr_placed";
var MAX_PLACED_TRACKED = 512;
var placedContainers = /* @__PURE__ */ new Set();
var touchCounter = 0;
function readState() {
  return parseLootrState(world10.getDynamicProperty(LOOTR_STATE_PROPERTY));
}
function writeState(state) {
  try {
    world10.setDynamicProperty(LOOTR_STATE_PROPERTY, serializeLootrState(state));
  } catch (err) {
    log(`Failed to persist Lootr state: ${String(err)}`);
  }
}
function loadPlacedContainers() {
  try {
    const raw = world10.getDynamicProperty(PLACED_CONTAINERS_PROPERTY);
    const parsed = raw ? JSON.parse(raw) : [];
    placedContainers = new Set(Array.isArray(parsed) ? parsed.filter((k) => typeof k === "string") : []);
  } catch {
    placedContainers = /* @__PURE__ */ new Set();
  }
}
function savePlacedContainers() {
  try {
    world10.setDynamicProperty(PLACED_CONTAINERS_PROPERTY, JSON.stringify([...placedContainers]));
  } catch (err) {
    log(`Failed to persist player-placed container list: ${String(err)}`);
  }
}
function getContainer2(block) {
  try {
    const inventory = block.getComponent("minecraft:inventory");
    return inventory?.container ?? void 0;
  } catch {
    return void 0;
  }
}
function describeItem(item, slot) {
  const descriptor = { slot, typeId: item.typeId, amount: item.amount };
  if (item.nameTag) descriptor.nameTag = item.nameTag;
  const lore = item.getLore();
  if (lore.length > 0) descriptor.lore = lore;
  try {
    const durability = item.getComponent("minecraft:durability");
    if (durability && durability.damage > 0) descriptor.damage = durability.damage;
  } catch {
  }
  try {
    const enchantable = item.getComponent("minecraft:enchantable");
    const enchantments = enchantable?.getEnchantments() ?? [];
    if (enchantments.length > 0) {
      descriptor.enchantments = enchantments.map((entry) => ({ id: entry.type.id, level: entry.level }));
    }
  } catch {
  }
  return descriptor;
}
function buildItem(descriptor) {
  let item;
  try {
    item = new ItemStack5(descriptor.typeId, descriptor.amount);
  } catch {
    return void 0;
  }
  if (descriptor.nameTag) item.nameTag = descriptor.nameTag;
  if (descriptor.lore) item.setLore(descriptor.lore);
  if (descriptor.damage !== void 0) {
    try {
      const durability = item.getComponent("minecraft:durability");
      if (durability) durability.damage = Math.min(durability.maxDurability, descriptor.damage);
    } catch {
    }
  }
  if (descriptor.enchantments) {
    try {
      const enchantable = item.getComponent("minecraft:enchantable");
      for (const entry of descriptor.enchantments) {
        try {
          enchantable?.addEnchantment({ type: entry.id, level: entry.level });
        } catch {
        }
      }
    } catch {
    }
  }
  return item;
}
function snapshotContainer(container) {
  const items = [];
  for (let slot = 0; slot < container.size; slot++) {
    const item = container.getItem(slot);
    if (item) items.push(describeItem(item, slot));
  }
  return items;
}
function applyToContainer(container, items) {
  for (let slot = 0; slot < container.size; slot++) container.setItem(slot, void 0);
  for (const descriptor of items) {
    if (descriptor.slot >= container.size) continue;
    const item = buildItem(descriptor);
    if (item) container.setItem(descriptor.slot, item);
  }
}
function seedTrinket(items, containerSize) {
  const settings = getWorldSettings();
  if (!settings.trinketWorldLootEnabled) return items;
  const trinketIds = ACCESSORY_DEFINITIONS.map((entry) => entry.itemTypeId);
  const chosen = rollTrinketDrop(Math.random(), Math.random(), settings.trinketLootChancePercent, trinketIds);
  if (!chosen) return items;
  return withTrinketInserted(items, chosen, containerSize);
}
function handleContainerOpen(player, block) {
  const settings = getWorldSettings();
  if (!settings.lootrChestsEnabled) return;
  let key;
  let container;
  try {
    if (!block.isValid || !player.isValid) return;
    key = containerKey(block.dimension.id, block.location.x, block.location.y, block.location.z);
    if (placedContainers.has(key)) return;
    container = getContainer2(block);
  } catch (err) {
    log(`Lootr could not inspect a container: ${String(err)}`);
    return;
  }
  if (!container) return;
  const state = readState();
  const existing = state[key];
  const action = decideOpenAction(existing, player.id);
  if (action.kind === "none") return;
  try {
    if (action.kind === "snapshot") {
      const generated = seedTrinket(snapshotContainer(container), container.size);
      if (generated.length === 0) return;
      state[key] = { snapshot: generated, players: {}, lastOpener: player.id, touched: ++touchCounter };
      applyToContainer(container, copyForPlayer(state[key], player.id));
      writeState(state);
      return;
    }
    const record = existing;
    if (action.persistFor) record.players[action.persistFor] = snapshotContainer(container);
    applyToContainer(container, copyForPlayer(record, action.loadFor));
    record.lastOpener = action.loadFor;
    record.touched = ++touchCounter;
    state[key] = record;
    writeState(state);
  } catch (err) {
    log(`Lootr failed to swap container contents for ${player.name}: ${String(err)}`);
  }
}
function forgetContainer(dimensionId, x, y, z) {
  const key = containerKey(dimensionId, x, y, z);
  let changed = false;
  if (placedContainers.delete(key)) {
    savePlacedContainers();
    changed = true;
  }
  const state = readState();
  if (state[key]) {
    delete state[key];
    writeState(state);
    changed = true;
  }
  if (!changed) return;
}
function registerLootrSystem() {
  loadPlacedContainers();
  world10.afterEvents.playerPlaceBlock.subscribe((event) => {
    try {
      if (!getContainer2(event.block)) return;
      const key = containerKey(event.block.dimension.id, event.block.location.x, event.block.location.y, event.block.location.z);
      if (placedContainers.size >= MAX_PLACED_TRACKED) {
        const oldest = placedContainers.values().next().value;
        if (typeof oldest === "string") placedContainers.delete(oldest);
      }
      placedContainers.add(key);
      savePlacedContainers();
    } catch (err) {
      log(`Lootr failed to record a player-placed container: ${String(err)}`);
    }
  });
  world10.afterEvents.playerBreakBlock.subscribe((event) => {
    try {
      forgetContainer(
        event.dimension.id,
        event.block.location.x,
        event.block.location.y,
        event.block.location.z
      );
    } catch (err) {
      log(`Lootr failed to release a broken container: ${String(err)}`);
    }
  });
  world10.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    if (event.player.isSneaking) return;
    const player = event.player;
    const block = event.block;
    system8.run(() => handleContainerOpen(player, block));
  });
}

// src/main.ts
var CONTROL_ROOM_ITEM = "phlodgate:control_room_remote";
var FIELD_MAP_ITEM = "phlodgate:field_map";
var ACCESSORY_CABINET_ITEM = "phlodgate:trinket_cabinet";
var STARTER_ITEMS = [CONTROL_ROOM_ITEM, FIELD_MAP_ITEM, ACCESSORY_CABINET_ITEM];
function giveItemIfMissing(player, typeId) {
  const inventory = player.getComponent("minecraft:inventory");
  const container = inventory?.container;
  if (!container) return;
  for (let i = 0; i < container.size; i++) {
    if (container.getItem(i)?.typeId === typeId) return;
  }
  const leftover = container.addItem(new ItemStack6(typeId, 1));
  if (leftover) {
    player.dimension.spawnItem(leftover, player.location);
  }
}
world11.afterEvents.playerSpawn.subscribe((event) => {
  if (!event.initialSpawn) return;
  try {
    for (const typeId of STARTER_ITEMS) giveItemIfMissing(event.player, typeId);
  } catch (err) {
    log(`Failed to give starter items to ${event.player.name}: ${String(err)}`);
  }
});
world11.afterEvents.playerLeave.subscribe((event) => {
  clearFogTrackingForPlayer(event.playerId);
  clearHudStateForPlayer(event.playerId);
});
world11.afterEvents.itemUse.subscribe((event) => {
  if (event.itemStack.typeId === CONTROL_ROOM_ITEM) {
    void openHydraulicControlRoom(event.source);
  } else if (event.itemStack.typeId === FIELD_MAP_ITEM) {
    void openFieldMapMenu(event.source);
  } else if (event.itemStack.typeId === ACCESSORY_CABINET_ITEM) {
    void openAccessoryCabinet(event.source);
  } else if (getAccessoryDefinition(event.itemStack.typeId)) {
    const result = quickEquipFromSelectedSlot(event.source);
    event.source.sendMessage(result.ok ? `\xA7a${result.message}` : `\xA77${result.message}`);
  }
});
world11.afterEvents.playerBreakBlock.subscribe(
  (event) => invalidateTerrainAt(event.dimension.id, event.block.location.x, event.block.location.z)
);
world11.afterEvents.playerPlaceBlock.subscribe(
  (event) => invalidateTerrainAt(event.dimension.id, event.block.location.x, event.block.location.z)
);
world11.afterEvents.playerInteractWithBlock.subscribe((event) => {
  if (!event.isFirstEvent) return;
  if (event.beforeItemStack?.typeId === CONTROL_ROOM_ITEM) {
    void openMachineInspectionForm(event.player);
  }
});
function safeRegister(name, register) {
  try {
    register();
  } catch (err) {
    log(`Subsystem "${name}" failed to start and is disabled for this session: ${String(err)}`);
  }
}
safeRegister("quick transfer", registerQuickTransferTracking);
safeRegister("optimization events", registerOptimizationEventTracking);
safeRegister("hud manager", () => startHudManager(() => [...world11.getAllPlayers()]));
safeRegister("optimization engine", startOptimizationEngine);
safeRegister("item merging", startItemMerging);
safeRegister("fog controller", startFogController);
safeRegister("companion detector", startCompanionDetector);
safeRegister("companion pets", registerCompanionPetSystem);
safeRegister("accessories", startAccessoryRuntime);
safeRegister("instanced loot", registerLootrSystem);
log("Phlodgate Add-On initialized.");
//# sourceMappingURL=main.js.map
