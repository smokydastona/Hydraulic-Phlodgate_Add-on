/**
 * Runtime Environment Poller for Hydraulic-Phlodgate Companion.
 */
import { EntityInventoryComponent, system, world } from "@minecraft/server";
import { safeInterval } from "../../util/Scheduler";
import { getWorldSettings } from "../../settings/SettingsStore";
import { registerModdedRecipes } from "../inventory/RecipeRegistry";
import { HYDRAULIC_TEST_RECIPES } from "../inventory/ModdedRecipes";
import { log } from "../../util/Logger";
import {
  CompanionDetectionEvidence,
  CompanionStatus,
  evaluateCompanionStatus,
  extractModdedNamespaces,
  findCompanionSignalObjective,
  updateCachedCompanionStatus,
} from "./CompanionDetector";

const POLL_INTERVAL_TICKS = 120; // 6 seconds

export function scanRuntimeEnvironment(): CompanionStatus {
  const worldSettings = getWorldSettings();
  const evidence: Partial<CompanionDetectionEvidence> = {
    worldTags: [],
    moddedNamespacesInInventory: [],
    moddedNamespacesInWorld: [],
    scoreboards: [],
  };

  try {
    const bridgeProp = world.getDynamicProperty("phlodgate:bridge") ?? world.getDynamicProperty("hydraulic:version");
    if (bridgeProp !== undefined) {
      evidence.hasWorldDynamicProperty = true;
      evidence.dynamicPropertyKey = "phlodgate:bridge";
      evidence.dynamicPropertyValue = String(bridgeProp);
    }
  } catch {
    // Dynamic property read failed or not supported in current context
  }

  try {
    const signalObjective = findCompanionSignalObjective(world.scoreboard.getObjectives().map((objective) => objective.id));
    if (signalObjective) {
      evidence.scoreboards = [signalObjective];
    }
  } catch {
    // Scoreboard reads can fail before the world is ready or in restricted contexts.
  }

  try {
    const invTypeIds: string[] = [];
    for (const player of world.getAllPlayers()) {
      const invComp = player.getComponent("minecraft:inventory") as EntityInventoryComponent | undefined;
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
    // Player inventory scan error
  }

  const status = evaluateCompanionStatus(worldSettings.companionMode, evidence, system.currentTick);
  updateCachedCompanionStatus(status);

  if (status.active) {
    registerModdedRecipes(HYDRAULIC_TEST_RECIPES);
  }

  return status;
}

export function startCompanionDetector(): void {
  // Initial scan
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
