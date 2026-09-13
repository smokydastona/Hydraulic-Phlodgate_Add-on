import { Player, world } from "@minecraft/server";
import {
  DEFAULT_PLAYER_SETTINGS,
  DEFAULT_WORLD_SETTINGS,
  migratePlayerSettings,
  migrateWorldSettings,
  PlayerSettings,
  SETTINGS_SCHEMA_VERSION,
  VersionedPayload,
  WorldSettings,
} from "./SettingsSchema";
import { log } from "../util/Logger";

const PLAYER_KEY = "phlodgate:player_settings";
const WORLD_KEY = "phlodgate:world_settings";

/** Dynamic properties store strings only, and Player/World payloads are small, so JSON round-tripping is safe and well within the property size limit. */
function readJson<T>(getter: () => string | undefined): T | undefined {
  const raw = getter();
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    log(`Failed to parse stored settings JSON, discarding: ${String(err)}`);
    return undefined;
  }
}

export function getPlayerSettings(player: Player): PlayerSettings {
  const parsed = readJson<VersionedPayload<Partial<PlayerSettings>>>(() =>
    player.getDynamicProperty(PLAYER_KEY) as string | undefined
  );
  if (!parsed) return { ...DEFAULT_PLAYER_SETTINGS };
  return migratePlayerSettings(parsed);
}

export function setPlayerSettings(player: Player, settings: PlayerSettings): void {
  const payload: VersionedPayload<PlayerSettings> = { schemaVersion: SETTINGS_SCHEMA_VERSION, data: settings };
  player.setDynamicProperty(PLAYER_KEY, JSON.stringify(payload));
}

export function updatePlayerSettings(player: Player, patch: Partial<PlayerSettings>): PlayerSettings {
  const next = { ...getPlayerSettings(player), ...patch };
  setPlayerSettings(player, next);
  return next;
}

export function getWorldSettings(): WorldSettings {
  const parsed = readJson<VersionedPayload<Partial<WorldSettings>>>(() =>
    world.getDynamicProperty(WORLD_KEY) as string | undefined
  );
  if (!parsed) return { ...DEFAULT_WORLD_SETTINGS };
  return migrateWorldSettings(parsed);
}

export function setWorldSettings(settings: WorldSettings): void {
  const payload: VersionedPayload<WorldSettings> = { schemaVersion: SETTINGS_SCHEMA_VERSION, data: settings };
  world.setDynamicProperty(WORLD_KEY, JSON.stringify(payload));
}

export function updateWorldSettings(patch: Partial<WorldSettings>): WorldSettings {
  const next = { ...getWorldSettings(), ...patch };
  setWorldSettings(next);
  return next;
}
