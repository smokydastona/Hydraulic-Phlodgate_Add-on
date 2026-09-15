import { Player } from "@minecraft/server";
import { getPlayerSettings } from "../../settings/SettingsStore";
import { formatCoordinateSnapshot } from "./CoordinatesMath";

export function buildCoordinatesLines(player: Player): string[] | undefined {
  const settings = getPlayerSettings(player);
  if (!settings.coordinatesHudEnabled) return undefined;
  return [
    formatCoordinateSnapshot({
      x: player.location.x,
      y: player.location.y,
      z: player.location.z,
      dimensionId: player.dimension.id,
    }),
  ];
}