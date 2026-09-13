import { Player } from "@minecraft/server";
import { getPlayerSettings } from "../../settings/SettingsStore";
import { angularDelta, bearingDegrees, distanceXZ } from "../../util/Vector";
import { listWaypoints } from "../waypoints/WaypointManager";
import { arrowForDelta, formatDistance, isSameDimension } from "../waypoints/WaypointMath";
import { buildRadarStrip, cardinalEntriesForYaw, nearestEntries, withinRadius } from "./MinimapMath";

const RADAR_MAX_LISTED = 3;

function colorizeStrip(strip: string): string {
  let out = "";
  for (const ch of strip) {
    if (ch === "N" || ch === "S" || ch === "E" || ch === "W") out += `\u00a76${ch}`;
    else if (ch === "\u25b2") out += `\u00a7f${ch}`;
    else if (ch === "\u00b7") out += `\u00a78${ch}`;
    else out += `\u00a7e${ch}`;
  }
  return out + "\u00a7r";
}

/** Returns minimap HUD lines (radar strip + nearest waypoints), or undefined if disabled. */
export function buildMinimapLines(player: Player): string[] | undefined {
  const settings = getPlayerSettings(player);
  if (!settings.minimapEnabled) return undefined;

  const from = player.location;
  const yaw360 = ((player.getRotation().y % 360) + 360) % 360;

  const entries = listWaypoints(player)
    .filter((w) => isSameDimension(w, player.dimension.id))
    .map((w) => {
      const to = { x: w.x, y: w.y, z: w.z };
      const bearing = bearingDegrees(from, to);
      return {
        name: w.name,
        delta: angularDelta(yaw360, bearing),
        distance: distanceXZ(from, to),
      };
    })
    .filter((e) => withinRadius(e.distance, settings.minimapRadius));

  const cardinals = cardinalEntriesForYaw(yaw360, angularDelta);
  const strip = colorizeStrip(
    buildRadarStrip(
      entries.map((e) => ({ glyph: e.name.trim().charAt(0).toUpperCase() || "?", delta: e.delta, distance: e.distance })),
      cardinals
    )
  );

  const lines = [`\u00a77[${strip}\u00a77]`];

  if (entries.length === 0) {
    lines.push(`\u00a78No waypoints within ${settings.minimapRadius} blocks`);
  } else {
    for (const e of nearestEntries(entries, RADAR_MAX_LISTED)) {
      lines.push(`\u00a76${arrowForDelta(e.delta)} \u00a7f${e.name} \u00a77${formatDistance(e.distance)}`);
    }
  }

  return lines;
}
