import { ModalFormData } from "@minecraft/server-ui";
import { Player } from "@minecraft/server";
import { getWorldSettings, updateWorldSettings } from "../../settings/SettingsStore";
import { requireOperator } from "../../settings/Permissions";
import { isValidMode } from "../../settings/Profiles";
import { log } from "../../util/Logger";
import { showFormWithRetry } from "../FormRuntime";

const MODES = ["balanced", "aggressive", "extreme"] as const;

export async function openWorldSettingsForm(player: Player): Promise<void> {
  if (!requireOperator(player)) return;

  const settings = getWorldSettings();

  const form = new ModalFormData()
    .title("World Settings (Operator)")
    .dropdown("Optimization mode", MODES as unknown as string[], { defaultValueIndex: MODES.indexOf(settings.optimizationMode) })
    .toggle("Enable despawn optimization", { defaultValue: settings.despawnOptimizationEnabled })
    .toggle("Enable distant despawn", { defaultValue: settings.distantDespawnEnabled })
    .toggle("Enable off-screen despawn", { defaultValue: settings.offScreenDespawnEnabled })
    .toggle("Protect named entities", { defaultValue: settings.protectNamedEntities })
    .toggle("Protect tamed pets", { defaultValue: settings.protectTamedPets })
    .toggle("Protect bosses", { defaultValue: settings.protectBosses })
    .toggle("Protect player-placed armor stands", { defaultValue: settings.protectArmorStands })
    .toggle("Protect villagers/traders", { defaultValue: settings.protectVillagersAndTraders })
    .toggle("Protect entities in active combat", { defaultValue: settings.protectEntitiesInCombat })
    .toggle("Protect modded entities / machine proxies", { defaultValue: settings.protectModdedEntities })
    .toggle("Audit mode only (log, do not remove)", { defaultValue: settings.auditModeOnly })
    .toggle("Enable item merging", { defaultValue: settings.itemMergingEnabled })
    .toggle("Enable debris cleanup", { defaultValue: settings.debrisCleanupEnabled })
    .toggle("Enable particle cleanup (resource-pack presets)", { defaultValue: settings.particleCleanupEnabled })
    .toggle("Enable fog optimizer", { defaultValue: settings.fogOptimizerEnabled })
    .toggle("Enable volumetric fog", { defaultValue: settings.volumetricFogEnabled })
    .toggle("Extreme FPS mode (minimal fog)", { defaultValue: settings.extremeFpsMode });

  try {
    const response = await showFormWithRetry(player, () => form, { context: "World settings form" });
    if (!response || response.canceled || !response.formValues) return;

    const values = response.formValues as [
      number,
      boolean,
      boolean,
      boolean,
      boolean,
      boolean,
      boolean,
      boolean,
      boolean,
      boolean,
      boolean,
      boolean,
      boolean,
      boolean,
      boolean,
      boolean,
      boolean,
      boolean
    ];

    const modeIndex = values[0];
    const mode = MODES[modeIndex];
    if (!isValidMode(mode)) {
      player.sendMessage("§cInvalid optimization mode selected; settings not saved.");
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
    });

    player.sendMessage("§aWorld settings saved.");
  } catch (err) {
    log(`World settings form failed: ${String(err)}`);
  }
}
