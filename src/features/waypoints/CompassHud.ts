import { Player } from "@minecraft/server";
import { getPlayerSettings } from "../../settings/SettingsStore";
import { bearingDegrees, distanceXZ } from "../../util/Vector";
import { getActiveWaypoint } from "./WaypointManager";
import { arrowForDelta, formatDistance, isSameDimension } from "./WaypointMath";
import { angularDelta } from "../../util/Vector";
import { buildRadarStrip, cardinalEntriesForYaw } from "../minimap/MinimapMath";

function colorizeCompass(strip: string): string {
  let output = "";
  for (const glyph of strip) {
    if (glyph === "N" || glyph === "S" || glyph === "E" || glyph === "W") output += `\u00a76${glyph}`;
    else if (glyph === "\u25b2") output += `\u00a7f${glyph}`;
    else if (glyph === "\u00b7") output += `\u00a78${glyph}`;
    else output += `\u00a7e${glyph}`;
  }
  return `${output}\u00a7r`;
}

/** Returns a centered cardinal compass, optionally annotated with the active waypoint. */
export function buildCompassLines(player: Player): string[] | undefined {
  const settings = getPlayerSettings(player);
  if (!settings.compassEnabled) return undefined;

  const yaw = player.getRotation().y;
  const yaw360 = ((yaw % 360) + 360) % 360;
  const waypoint = getActiveWaypoint(player);
  const markers: Array<{ glyph: string; delta: number; distance: number }> = [];

  if (waypoint && isSameDimension(waypoint, player.dimension.id)) {
    const from = player.location;
    const to = { x: waypoint.x, y: waypoint.y, z: waypoint.z };
    const bearing = bearingDegrees(from, to);
    markers.push({ glyph: "◆", delta: angularDelta(yaw360, bearing), distance: distanceXZ(from, to) });
  }

  const strip = colorizeCompass(buildRadarStrip(markers, cardinalEntriesForYaw(yaw360, angularDelta)));
  if (!waypoint) return [`\u00a77[${strip}\u00a77]`];
  if (!isSameDimension(waypoint, player.dimension.id)) return [`\u00a77[${strip}\u00a77] \u00a7c${waypoint.name}: different dimension`];

  const marker = markers[0];
  return [`\u00a77[${strip}\u00a77] \u00a76${arrowForDelta(marker.delta)} ${waypoint.name} \u00a7f${formatDistance(marker.distance)}`];
}
