import { Player, world } from "@minecraft/server";
import { getWorldSettings } from "../../settings/SettingsStore";
import { resolveFogThresholds } from "../../settings/Profiles";
import { safeInterval } from "../../util/Scheduler";
import { log } from "../../util/Logger";

const FOG_USER_ID = "phlodgate_mode";
const CHECK_INTERVAL_TICKS = 40; // 2 seconds - fog only needs to change when settings change, not every tick
const lastFogIdByPlayer = new Map<string, string>();

function desiredFogIdentifier(settings: ReturnType<typeof getWorldSettings>): string | undefined {
  if (!settings.fogOptimizerEnabled) return undefined;
  if (settings.extremeFpsMode) return "phlodgate:extreme_fps_fog";
  return resolveFogThresholds(settings.optimizationMode).fogIdentifier;
}

function applyFog(player: Player, fogId: string | undefined): void {
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

function runFogPass(): void {
  const settings = getWorldSettings();
  const fogId = desiredFogIdentifier(settings);
  for (const player of world.getAllPlayers()) {
    applyFog(player, fogId);
  }
}

export function startFogController(): number {
  return safeInterval("fog-controller", runFogPass, CHECK_INTERVAL_TICKS);
}

export function clearFogTrackingForPlayer(playerId: string): void {
  lastFogIdByPlayer.delete(playerId);
}
