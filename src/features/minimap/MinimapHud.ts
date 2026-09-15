import { Player } from "@minecraft/server";
import { getPlayerSettings } from "../../settings/SettingsStore";
import { angularDelta, bearingDegrees, distanceXZ } from "../../util/Vector";
import { listWaypoints } from "../waypoints/WaypointManager";
import { arrowForDelta, formatDistance, isSameDimension } from "../waypoints/WaypointMath";
import { buildTerrainPreviewPattern, parseCompanionVectorPayload } from "./TerrainMap";
import { buildRadarStrip, cardinalEntriesForYaw, nearestEntries, withinRadius } from "./MinimapMath";

const RADAR_MAX_LISTED = 3;
const COMPANION_VECTOR_PROPERTY = "phlodgate:companion_vectors";
const MAX_COMPANION_TARGETS = 8;

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

function buildMapPreviewLine(): string {
  return buildTerrainPreviewPattern(0, 5).join(" ");
}

/** Returns minimap HUD lines (radar strip + nearest waypoints), or undefined if disabled. */
export function buildMinimapLines(player: Player): string[] | undefined {
  const settings = getPlayerSettings(player);
  if (!settings.minimapEnabled) return undefined;

  const from = player.location;
  const yaw360 = ((player.getRotation().y % 360) + 360) % 360;

  const companionTargets = parseCompanionVectorPayload(player.getDynamicProperty(COMPANION_VECTOR_PROPERTY) as string | undefined)
    .filter((target) => {
      const distance = Math.hypot(target.x, target.z);
      const range = target.range;
      if (range?.min !== undefined && distance < range.min) return false;
      if (range?.max !== undefined && distance > range.max) return false;
      return distance <= settings.minimapRadius;
    })
    .slice(0, MAX_COMPANION_TARGETS)
    .map((target) => {
      const to = { x: from.x + target.x, y: from.y, z: from.z + target.z };
      const bearing = bearingDegrees(from, to);
      const distance = distanceXZ(from, to);
      return {
        name: target.label ?? target.name,
        glyph: (target.glyph || target.name || "?").trim().charAt(0).toUpperCase() || "?",
        delta: angularDelta(yaw360, bearing),
        distance,
        kind: target.kind,
      };
    });

  const entries: Array<{ name: string; glyph?: string; delta: number; distance: number; kind?: string }> = [
    ...listWaypoints(player)
      .filter((w) => isSameDimension(w, player.dimension.id))
      .map((w) => {
        const to = { x: w.x, y: w.y, z: w.z };
        const bearing = bearingDegrees(from, to);
        return {
          name: w.name,
          glyph: w.name.trim().charAt(0).toUpperCase() || "?",
          delta: angularDelta(yaw360, bearing),
          distance: distanceXZ(from, to),
          kind: "waypoint",
        };
      }),
    ...companionTargets,
  ].filter((e) => withinRadius(e.distance, settings.minimapRadius));

  const cardinals = cardinalEntriesForYaw(yaw360, angularDelta);
  const strip = colorizeStrip(
    buildRadarStrip(
      entries.map((e) => ({ glyph: e.glyph ?? "?", delta: e.delta, distance: e.distance })),
      cardinals
    )
  );

  const lines = [`\u00a77[${strip}\u00a77]`, `\u00a78${buildMapPreviewLine()}`];

  if (entries.length === 0) {
    lines.push(`\u00a78No waypoints within ${settings.minimapRadius} blocks`);
  } else {
    for (const e of nearestEntries(entries, RADAR_MAX_LISTED)) {
      const kindPrefix = e.kind === "boss" ? "\u00a7c" : e.kind === "friend" ? "\u00a7a" : e.kind === "machine" ? "\u00a7b" : "\u00a7f";
      lines.push(`\u00a76${arrowForDelta(e.delta)} ${kindPrefix}${e.name} \u00a77${formatDistance(e.distance)}`);
    }
  }

  return lines;
}
